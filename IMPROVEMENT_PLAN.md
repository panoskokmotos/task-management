# Task OS / Givelink — Improvement Plan

Generated: 2026-07-10

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. All AI features silently fail for signed-in users
**What:** `APP_CONFIG.aiProxy` is an empty string, so every AI button — "Plan my day," "Auto-triage," "AI Sprint Planner," ⌘K natural-language commands — shows "Add Claude API key in Settings." Signed-in users who don't have their own Anthropic key are completely locked out of AI.

**Where:** `index.html:9812` — `aiProxy: ''` in `APP_CONFIG`; also `api/claude.js` is already deployed at `/api/claude` on the same Vercel project.

**Why it matters:** Every AI touchpoint converts to a confusing error toast. This is the core value proposition of the app. New signed-up users hit it on their first action.

**Effort:** S

**Suggested fix:**
- Set `aiProxy: '/api/claude'` (relative URL works since both are on the same Vercel deployment) or the full `https://<your-domain>/api/claude`.
- Alternatively, set it via the environment variable at build time (Vercel env → bake into the HTML via a build step) rather than hardcoding.
- Verify that the Supabase Bearer token is being sent correctly once wired up (the proxy validates it when `SUPABASE_URL` env var is set).

---

### 2. Push notification icons point to a non-existent path
**What:** The service worker's push handler references `./icons/icon-192.png` for `icon` and `badge`. No `icons/` subdirectory exists — the actual file is `./icon-192.png`. Every push notification shows a broken/blank icon on all platforms.

**Where:** `sw.js:42–43`

**Why it matters:** Push reminders are a core retention mechanic. Broken icons look broken and erode trust on the lock screen — the one place users see the app when they're away.

**Effort:** S

**Suggested fix:**
- Change both values to `'./icon-192.png'`.
- Also update the `badge` to `'./icon-192.png'` (or omit it — badge is Android-specific and a 96×96 monochrome PNG is required; the current 192px coloured PNG won't qualify).
- Bump `CACHE` version in `sw.js` after the fix so the new worker replaces the old one.

---

### 3. Google Fonts (Inter) blocked by Content-Security-Policy
**What:** `vercel.json` sets `style-src 'self' 'unsafe-inline'` and `font-src 'self'`, but the HTML `<head>` loads Inter from `https://fonts.googleapis.com`. Neither directive allows that domain. The browser blocks both the CSS and the font files. Inter never loads; the app falls back to `-apple-system, BlinkMacSystemFont, Segoe UI`.

**Where:** `vercel.json:14` (CSP header); `index.html:16` (the font `<link>`)

**Why it matters:** The entire UI is designed around Inter's proportional weights (800 for headings, 500 for labels). System font fallbacks look measurably different — thinner, wrong letter-spacing. Every user on Chromium or Firefox in production is seeing the wrong typeface.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` in the CSP.
- Or — better for performance and privacy — self-host Inter via `@fontsource/inter` and serve it as a static asset, eliminating the external dependency entirely.

---

### 4. `_welcomeSeed` silently skips on a returning user's new device
**What:** `_welcomeSeed()` only runs when `!S._welcomed && S.tasks.length === 0`. `S._welcomed` lives in the synced state blob. A user who previously signed in on another device will have `_welcomed: true` in their cloud row. When they log in on a new device, `sbSyncNow` pulls their cloud state (which sets `S._welcomed = true`), then falls through to `sbPush()` without seeding — leaving them with a blank app and no welcome tasks if their actual data isn't there yet (e.g. first sync is still in-flight, or their row IS null because the push from the first device failed).

**Where:** `index.html:10066–10082` (`sbSyncNow` merge logic); `index.html:10087–10102` (`_welcomeSeed`)

**Why it matters:** The welcome experience is the first impression. A blank dashboard with no guidance is confusing and triggers immediate churn.

**Effort:** M

**Suggested fix:**
- Change the guard to check `!remote && !S._welcomed` (only seed if there is literally no cloud row), but separately persist `_welcomed` in `localStorage` (not in the synced `S` blob) so it is device-local.
- Add an empty-state "Get started" prompt in the dashboard view as a fallback for any user who ends up with zero tasks, regardless of seed status.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. No per-user rate limiting on the AI proxy
**What:** `/api/claude.js` is a flat passthrough with a shared `ANTHROPIC_API_KEY`. Any signed-in user (including future hostile ones) can loop-call it and exhaust the monthly quota. The file itself notes: "add per-user rate limiting (e.g. Upstash)."

**Where:** `api/claude.js:13–48`

**Why it matters:** One user running a script against the proxy can rack up hundreds of dollars of Anthropic charges overnight. As soon as the hosted signup is live (it already is — `APP_CONFIG.supabaseUrl` is set), this is a real financial risk.

**Effort:** M

**Suggested fix:**
- Add Upstash Redis rate limiting (free tier covers ~10K/day): 20 calls per user per hour keyed by the Supabase JWT `sub` claim.
- Parse the JWT from `Authorization: Bearer <token>` in the proxy (the `sub` is in the payload; no verification is needed since Supabase already validated it).
- Return HTTP 429 with `Retry-After` if the limit is exceeded; the client already handles 429 gracefully (`index.html:4884`).

---

### 6. New users see "Panos" in the page title and greeting
**What:** `<title>Task OS — Panos</title>` (`index.html:17`), the dashboard `h1` defaults to "Good morning, Panos 👋" (`index.html:951`), and `profileName` defaults to `localStorage.getItem('taskos_name') || 'Panos'` (`index.html:2406`). On a fresh device or incognito tab, any new user sees the previous owner's name until they explicitly rename themselves.

**Where:** `index.html:17`, `index.html:951`, `index.html:2406`

**Why it matters:** First impression. A new user who just signed up thinks the app belongs to someone else, or that it's broken. This also leaks PII to any user who shares a device.

**Effort:** S

**Suggested fix:**
- Change the default `profileName` to `''` (empty) and render the greeting as "Good morning 👋" when no name is set.
- In `_afterAuth`, derive the name from the Supabase email (already done in `_welcomeSeed` at line 10090) and call `_renderAccountChip()` — but also call the greeting update.
- Change `<title>` to `Task OS` and update it to `Task OS — ${name}` only after the profile name is known.

---

### 7. AI action buttons have no loading or disabled state
**What:** Clicking "☀️ Plan my day," "✨ Auto-triage," or the ⌘K AI command shows only a toast while the fetch runs. The button stays enabled and clickable. Tapping it again in slow-network conditions fires a second request. The `_aiLock`/`_aiUnlock` pattern prevents double-execution, but the button gives no visual feedback that it was heard.

**Where:** `index.html:4862–4890` (`callClaude`); dashboard buttons at `index.html:959–960`

**Why it matters:** Users don't know the AI is thinking. On mobile (3G, Wi-Fi drops), the 2–5s latency feels like a miss. They retry. When the lock silently blocks the second call, they get nothing.

**Effort:** S

**Suggested fix:**
- In `aiPlanDay` and `aiAutoTriage`, disable the triggering button and replace its text with a spinner `<span class="spin-icon">⏳</span>` (the animation already exists at `index.html:433`).
- Re-enable in `_aiUnlock` (or in the `finally` block of `callClaude`).
- The `_aiLock` already exists — just wire the button state to it.

---

### 8. Auto-save pushes without pulling first; multi-device edits silently clobber
**What:** `_sbScheduleSync()` fires a raw `sbPush()` with no prior `sbPull()`. If two devices are active and Device B edits a task 3 seconds after Device A pushed an update, Device B's debounced push overwrites Device A's newer data — because both have the same `_updatedAt` from their last sync and neither wins consistently.

**Where:** `index.html:10104–10113` (`_sbScheduleSync`); `index.html:10060–10084` (`sbSyncNow`)

**Why it matters:** Switching between phone and laptop mid-day can cause silent data loss. The "last-write-wins by `_updatedAt`" mechanism only works if the app pulls before pushing during a sync — the scheduled auto-save skips this step.

**Effort:** M

**Suggested fix:**
- Change `_sbScheduleSync` to call `sbSyncNow()` (which does pull-then-push) instead of `sbPush()` directly.
- If the full sync is too slow for every keystroke debounce, add an optimistic local write path: update `S._updatedAt = Date.now()` locally before the push, so the timestamp advances correctly and the next full sync won't overwrite.
- Add a `_sbConflict` flag that logs a warning when the server timestamp is newer than `_updatedAt` but a local push was already queued.

---

### 9. Givelink Sprint Board uses off-brand blue instead of brand violet
**What:** `givelink.html` defines `--accent:#3b82f6` (Tailwind blue-500). All active nav indicators, progress bars, button backgrounds, pillar overview borders, and goal tag chips render in blue. The Givelink brand uses violet (`#6B3FA0` / `#5718CA`) and pink — the same family as Task OS's `#8b7cff`.

**Where:** `givelink.html:17` (`:root` variables)

**Why it matters:** Users switch between Task OS and Givelink via the workspace switcher (`index.html:862`). The jarring color shift signals "different product" rather than "same product, different view." It also violates the stated brand guide.

**Effort:** S

**Suggested fix:**
- Replace `--accent:#3b82f6` with `--accent:#8b7cff` (or `#6B3FA0` if the darker variant is preferred per the Givelink brand guide).
- Update `--done`, `--prog`, `--block`, and `--todo` to match Task OS's semantic palette for consistency.
- Update `manifest-givelink.json`'s `theme_color` accordingly.

---

### 10. Signup error surfaces raw Supabase error strings
**What:** On signup failure, `_agErr(e.message)` displays whatever Supabase returns — strings like `"User already registered"`, `"Password should be at least 6 characters"`, or server error traces. On login failure, the message is hardcoded and user-friendly, but signup falls through to `e.message` (`index.html:9946`).

**Where:** `index.html:9933–9947` (`authSubmit`)

**Why it matters:** Technical error strings erode trust in the auth flow. "User already registered" leaks account existence (user enumeration). This is especially sensitive during early growth when sign-up friction is critical to conversion.

**Effort:** S

**Suggested fix:**
- Map known Supabase error codes/messages to friendly copy: "Already have an account? Log in instead." for duplicate registration, "Check your email to confirm your account" for unconfirmed users.
- Never pass `e.message` directly to `_agErr`. Build a `_friendlyAuthError(code, message)` helper.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Entire state blob (~100KB+) pushed on every save
**What:** `sbPush()` serialises the full `S` object as a JSONB body on every debounced save. `S` includes health logs, habit logs, finance entries, deepwork sessions, goal arrays, and 50+ other arrays. As data accumulates over months, each push will grow to several megabytes.

**Where:** `index.html:10053–10058` (`sbPush`)

**Why it matters:** Sync will visibly lag as the user's data grows. The 2500ms debounce was designed for fast small writes; a 2MB payload changes that math. Also exhausts Supabase's row size limits (~1GB per row, but network latency is the practical ceiling).

**Effort:** L

**Suggested fix:**
- For now, add differential compression: only sync `S._updatedAt` + top-level arrays that actually changed (track a `_dirty` set per key).
- Longer-term: migrate to a per-entity table (tasks, goals, habits) rather than a single JSONB blob — enabling fine-grained RLS and conflict-free merges.

---

### 12. Supabase URL and project ID committed to source
**What:** `APP_CONFIG.supabaseUrl: 'https://bgvddpkdsftgynxyhnoc.supabase.co'` and the anon key are hard-coded in the public HTML file, checked into git. While the anon key is designed to be public, the project URL exposes the Supabase project identity to anyone who reads the source.

**Where:** `index.html:9810–9811`

**Why it matters:** Project URL + anon key is sufficient to probe auth endpoints, attempt brute-force login, or abuse the Supabase API directly (rate limits aside). It also couples the codebase to one specific project — impossible to deploy fresh for another user without a code edit.

**Effort:** M

**Suggested fix:**
- Move to Vercel environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON`) and inject them at build time via a build script or Vercel's `env` substitution.
- Rotate the current anon key in Supabase settings after migration.

---

### 13. Startup init chain called without try-catch; one error silences the rest
**What:** `index.html:10152` calls `resetRecurring(); _genDailyQuests(); _maybeShowWeeklyWrapped(); _initSidebarSwipe(); _autoSnapshot();` in a single unguarded statement. An exception in any one of these silently terminates the rest. The comment at line 10186 notes a TDZ error that previously "silently halted all remaining top-level init" — this is the same class of problem.

**Where:** `index.html:10151–10153`

**Why it matters:** On load-time failures, users see a half-initialised app (no reminders, no PWA install prompt, no swipe dismiss) with no indication anything is wrong. Debugging these in production is hard.

**Effort:** S

**Suggested fix:**
- Wrap each init call individually: `[resetRecurring, _genDailyQuests, _maybeShowWeeklyWrapped, _initSidebarSwipe, _autoSnapshot].forEach(fn => { try { fn(); } catch(e) { console.error(fn.name, e); } });`
- Add a minimal error reporter that logs to the JS console with the function name (already present as `console.warn` in some places — extend that pattern).

---

### 14. 14,401-line single HTML file makes every change a merge conflict risk
**What:** All CSS (>700 lines), HTML, and JavaScript (~12,000 lines) live in one file. The recent week saw 7 commits all touching `index.html`. Git blame is unusable, PR reviews require scrolling thousands of lines, and any concurrent feature branch will produce conflicts spanning hundreds of lines.

**Where:** `index.html` (entire file)

**Why it matters:** Velocity tax. Every PR review takes longer. Merge conflicts in CSS require manual reconciliation of deeply minified single-line rules. This is the single biggest brake on shipping speed.

**Effort:** L

**Suggested fix:**
- Start with the easiest extraction: move the `<style>` block into `styles.css` (served from the same origin — no CSP change needed).
- Then split the `<script>` into logical modules: `auth.js`, `sync.js`, `ai.js`, `render-tasks.js`. Use native ES modules (`type="module"`) since all target browsers support it.
- Don't attempt a full rewrite — extract one module per sprint, test manually, keep the HTML file as the entry point.

---

### 15. No ARIA roles on interactive task cards, sidebar items, or custom modals
**What:** Task cards (`.tc`) are `<div>` elements with `onclick` handlers but no `role="button"`, `tabindex`, or `aria-label`. Modals use custom `.mo` classes without `role="dialog"`, `aria-modal`, or focus trapping. The sidebar navigation uses `<div class="ni">` elements rather than `<nav>/<a>/<button>`.

**Where:** `index.html:110–117` (`.tc` definition); `index.html:182–193` (`.mo`/`.md`); `index.html:63–69` (`.ni`)

**Why it matters:** Screen readers can't navigate the app. Task list, sidebar, and modals are inaccessible to keyboard-only users and assistive tech. WCAG 2.1 AA requires at minimum: focus management in modals, `role="button"` on interactive divs, and logical tab order.

**Effort:** M

**Suggested fix:**
- Add `role="button" tabindex="0"` and `onkeydown="if(event.key==='Enter'||event.key===' ')this.click()"` to every `.tc` in the render functions.
- Add `role="dialog" aria-modal="true" aria-labelledby="..."` to modal containers; trap focus on open.
- Convert sidebar `.ni` items to `<button>` elements for free keyboard handling.

---

### 16. `aiProxy` is effectively undocumented for deployers
**What:** The comment on `index.html:9812` says `// e.g. 'https://taskos.vercel.app/api/claude'` — but the actual deployed proxy URL for this project lives at the same origin. Anyone deploying this codebase has to figure out the right URL from context clues. Meanwhile the proxy `api/claude.js` is live and unused.

**Where:** `index.html:9812`; `api/claude.js:1–49`

**Why it matters:** This is both a P0 (AI is broken) and a documentation gap. Future deployers will make the same mistake. The proxy could instead be wired up automatically.

**Effort:** S

**Suggested fix:**
- Set `aiProxy: '/api/claude'` — relative to the origin, works for any deployment domain.
- Add a Vercel environment variable `VITE_AI_PROXY_URL` override path for self-hosters who want a different endpoint.

---

### 17. `_sbScheduleSync` debounce means in-flight pushes can collide
**What:** `_sbTimer = setTimeout(() => { sbPush()... }, 2500)`. If the user edits rapidly (quick-add 3 tasks in 2 seconds), the timer resets each time. But if the user pauses at 2.4s, a push fires; if they immediately edit again at 2.6s, another push fires while the first HTTP request is still in flight. There's no queue or in-flight guard on `sbPush`.

**Where:** `index.html:10104–10113` (`_sbScheduleSync`)

**Why it matters:** Two concurrent `sbPush` calls to Supabase's `merge-duplicates` upsert can race to write different `updated_at` timestamps, leading to inconsistent state.

**Effort:** S

**Suggested fix:**
- Gate `sbPush` calls: `if(_sbBusy) { _sbPending=true; return; }` at the top of the timeout callback. When a push completes and `_sbPending` is true, re-fire the push.
- Alternatively, debounce to 5000ms — users don't notice a 5s autosave delay but it eliminates most collision windows.

---

## 💡 P3 — Nice to have

### 18. Burndown chart shows "complete tasks to see progress" for first-time sprints
**What:** `renderBurndown()` returns early with a placeholder message when `snapshots.length < 2`. A brand-new sprint always starts with 0 snapshots and stays empty until two separate days have had tasks completed.

**Where:** `index.html:10758` (`renderBurndown`); `givelink.html`'s burndown counterpart

**Why it matters:** The first time a user opens the sprint board, they see an empty chart widget instead of a clear "get started" call to action. This is a missed engagement moment.

**Effort:** S

**Suggested fix:**
- Show a single baseline point (today, 0 done, N total) when there's only one or zero snapshots: a horizontal line with "Complete tasks to see trend" as a subtitle — visually informative rather than completely empty.
- Call `_recordSnapshot()` on app load (not just on task completion) to build history passively.

---

### 19. Notion and Readwise settings fields have no connection status indicator
**What:** Settings has input fields for Readwise and Notion API keys (`index.html:9752–9781`). After saving, there's no indication of whether the keys are valid or what the integration actually does. The keys are stored in `localStorage` but there's no UI showing "Connected ✓" or "API key invalid."

**Where:** `index.html:1933–1960` (settings modal); `index.html:9751–9789` (saveSettings)

**Why it matters:** Users don't know if the integration is working. They set it and forget it, then wonder why nothing happened. This kills trust in integrations as a feature.

**Effort:** M

**Suggested fix:**
- On save, fire a lightweight test call to the Readwise `https://readwise.io/api/v2/auth/` endpoint (1 API call) and update a status chip next to the field.
- Show a ✓ green dot or ✗ red dot based on the response.

---

### 20. Givelink Sprint Board has no service worker or PWA install flow
**What:** `givelink.html` does not register `sw.js` and has no `beforeinstallprompt` handler. Users who add it to their home screen via the manifest link won't get cached offline access or push notifications. The `manifest-givelink.json` exists but the PWA lifecycle isn't wired up.

**Where:** `givelink.html` (no SW registration at all); `sw.js:11` (HTML array includes `givelink.html` — so it IS cached by Task OS's SW when Task OS is visited first, but Givelink itself never registers the worker)

**Why it matters:** If a Givelink user opens the sprint board directly (bookmark, shared link) without first visiting Task OS, they get no offline support. On mobile, opening `givelink.html` directly also means no update banner when the app changes.

**Effort:** S

**Suggested fix:**
- Add a `<script>` at the bottom of `givelink.html` that registers `./sw.js` (the same worker handles both pages since `HTML` already includes `./givelink.html`).
- Add a `beforeinstallprompt` listener and an install banner matching the Task OS style.
