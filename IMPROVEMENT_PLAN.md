# Arete / Givelink — Improvement Plan

> Scanned: 2026-10-10 | Files: `index.html` (14 926 lines), `givelink.html`, `api/claude.js`, `sw.js`

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. Owner's personal seed data shown to all new users
**What:** The `seed()` function hard-codes the owner's personal tasks (Givelink pipeline items, personal brand goals, LinkedIn posts, "move to SF" milestones) and they land in every new user's starter set on a non-hosted instance.
**Where:** `index.html:4537–4780` (`seed()` and `seedGoals()`)
**Why it matters:** New users see tasks about *your* life instead of a neutral starter, which is jarring and breaks trust in the product.
**Effort:** S
**Suggested fix:**
- Replace personal tasks with 5–7 generic templates (e.g. "Inbox zero", "Deep work session", "Weekly review").
- Alternatively, gate `seed()` behind a `__DEV__` flag so it only runs locally.
- The `_hostedMode()` guard at line 10662 already skips seeding in hosted mode — extend the same guard to local dev.

---

### 2. No rate limiting on the AI proxy — unbounded Anthropic bill risk
**What:** `api/claude.js` proxies Anthropic calls for any signed-in user with no per-user or per-day token cap.
**Where:** `api/claude.js` (entire file, the `NOTE` at line 12 is self-aware)
**Why it matters:** One bad actor (or a runaway client loop) can exhaust the monthly API budget in minutes. There is no circuit-breaker.
**Effort:** M
**Suggested fix:**
- Add a lightweight Upstash Redis rate limit (e.g. 100 calls / user / day) in the handler before the `fetch` call.
- Log `uid` + token count to a Supabase table so you can spot abuse.
- Set a hard `max_tokens` cap of 1 500 (already enforced client-side, but enforce server-side too).

---

### 3. Hardcoded "Panos / Givelink" persona baked into AI prompts
**What:** Five AI functions fall back to a hardcoded personal bio string (`'Panos, founder of Givelink (nonprofit fundraising SaaS), Greece, moving to SF, targeting financial freedom'`) when `getAboutMe()` returns empty.
**Where:** `index.html:13535, 13544, 13553, 13614, 13624`
**Why it matters:** Any user who has not filled in their "About me" in Settings gets AI analysis written from the owner's perspective — wrong goals, wrong context, wrong advice.
**Effort:** S
**Suggested fix:**
- Change all five fallback strings to a neutral placeholder: `'A person working on their goals, tasks, and personal growth.'`
- Optionally prompt the user to fill in their bio if `getAboutMe()` is empty when they trigger an AI feature.

---

### 4. Claude API key persisted in plaintext `localStorage` via `S` object
**What:** `S.claudeKey` is stored as part of the main `S` state and serialised to `localStorage` on every `save()` call. Any XSS vulnerability (or browser extension) can read it.
**Where:** `index.html:2580` (`save()` → `JSON.stringify(S)`), key stored at `index.html:9917`
**Why it matters:** API keys persisted in `localStorage` violate Anthropic's usage policy and are a high-severity credential exposure risk.
**Effort:** S
**Suggested fix:**
- Remove `claudeKey` from `S` and store it separately under its own `localStorage` key (e.g., `taskos_claude_key`) so it is explicitly isolated.
- Never include it in exports (`exportData()` at line 2599) — strip it from the JSON blob.
- Long-term: migrate users to the server-side proxy so no client key is needed.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. Guest nudge uses raw `innerHTML` — potential XSS surface + bad UX timing
**What:** `_maybeGuestNudge()` fires a toast with `innerHTML` containing unsanitised user-adjacent content. Separately, the threshold of 9 tasks is too low (5 starters + 4 user tasks) and fires before the user has genuinely invested.
**Where:** `index.html:2590–2597`
**Why it matters:** The toast fires almost immediately for new guests, which feels pushy and causes bounce. The `innerHTML` pattern is a latent XSS risk if `profileName` ever lands in the string.
**Effort:** S
**Suggested fix:**
- Raise the threshold to 15 active tasks.
- Use `textContent` + a proper button element instead of raw `innerHTML` for the toast.
- Delay at least 2 minutes from session start before checking.

---

### 6. `localStorage` access outside `try/catch` can silently crash in private browsing
**What:** Dozens of `localStorage.getItem` / `setItem` calls sit at the top level of functions (e.g., lines 2519, 2558, 2564, 3314, 3323, 3344, 3679–3681) with no error handling.
**Where:** `index.html:2519, 2558–2572, 3314, 3323, 3344, 3679`
**Why it matters:** In Safari private browsing and some Firefox configurations, `localStorage` throws a `SecurityError`. The app silently breaks for any user in private mode.
**Effort:** M
**Suggested fix:**
- Create a `safeLS` wrapper with `get(key, fallback)` / `set(key, val)` methods that swallow `SecurityError`.
- Replace bare `localStorage.*` calls at the top of functions. The `save()` function already has a `QuotaExceededError` guard — extend that pattern.

---

### 7. Auth gate has no loading state or timeout feedback
**What:** `authSubmit()` / `authGoogle()` / `authMagic()` make async Supabase calls but the buttons have no disabled/spinner state. A slow network leads to duplicate submissions.
**Where:** `index.html:10075–10095` (login flow), buttons at `index.html:880–882`
**Why it matters:** Users tap "Log in" twice, creating duplicate sessions or confusing error states. This directly hurts conversion on the most critical flow.
**Effort:** S
**Suggested fix:**
- Wrap the `authSubmit` button in the same `_aiBtn()` spinner pattern already used for AI buttons (line 2774).
- Disable all three auth buttons during in-flight requests.
- Add a minimum 300 ms delay before re-enabling to prevent double-tap on fast networks.

---

### 8. Givelink sprint board (`givelink.html`) uses a completely different brand (blue)
**What:** `givelink.html` uses `--accent:#3b82f6` (blue) and a dark navy theme, completely disconnected from Arete's purple gradient brand. The meta `theme-color` is also blue.
**Where:** `givelink.html:6, 17` (`--accent`, meta theme-color)
**Why it matters:** If the Givelink board is ever shown to co-founders, investors, or team members, it looks like a different product. Violates brand consistency rule.
**Effort:** S
**Suggested fix:**
- Update `--accent` to `#5a49e0` (brand purple) and the gradient to match `--brand-gradient` from `index.html`.
- Change the meta `theme-color` to `#5a49e0`.
- Consider pulling in the shared CSS variables rather than duplicating them.

---

### 9. Service worker update detection fires on `activated` state, misses installs
**What:** The `statechange` listener at line 10695 calls `showUpdateBanner()` when `nw.state === 'activated'`, but the banner should also fire on `installed` (when the SW is waiting to take over).
**Where:** `index.html:10693–10706`
**Why it matters:** Users on a cached version don't see the update prompt until the next full lifecycle cycle, meaning they can run a stale app for hours.
**Effort:** S
**Suggested fix:**
- Change the condition to `nw.state === 'installed'` (fires when the new SW is ready and waiting).
- Alternatively check for both: `if (nw.state === 'installed' || nw.state === 'activated') showUpdateBanner();`

---

### 10. AI proxy model ID may be stale (`claude-haiku-4-5-20251001`)
**What:** `api/claude.js:42` and `index.html:5022` both reference `claude-haiku-4-5-20251001`. Model IDs change and this specific string should be verified against the current Anthropic API.
**Where:** `api/claude.js:42`, `index.html:5022`
**Why it matters:** If the model ID is retired, every AI call silently returns a 404/400 error and the feature breaks with a confusing toast.
**Effort:** S
**Suggested fix:**
- Move the model ID to `APP_CONFIG` so it can be updated in one place.
- Add a fallback: if the primary model fails with 404, retry with `claude-haiku-4-5`.
- Monitor Anthropic model deprecation notices.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. Entire app is a single 14 926-line HTML file
**What:** All styles, markup, and JavaScript live in `index.html`. There is no build system, no module splitting, and no way to tree-shake or lazy-load features.
**Where:** `index.html` (entire file)
**Why it matters:** PRs touch the same file every time — conflict-prone and impossible to review. The browser parses ~1 MB of JS/CSS before the first render.
**Effort:** L
**Suggested fix:**
- Introduce a minimal Vite/esbuild pipeline (zero config); move CSS to `styles.css`, feature modules to `src/`.
- Short-term (lower effort): at least extract `seed()` and `seedGoals()` into a `dev-seed.js` import so they don't ship to production.
- Do not do a full rewrite — incremental extraction per feature is safer.

---

### 12. Task object shape duplicated 10+ times
**What:** The task creation literal `{id:uid(), title, notes:'', bucket, ..., status:'todo', isT3:false, ...}` appears verbatim at 10+ call sites (lines 3205, 3822, 3828, 4241, 4347, 5528, 6934, 7710, 10269, 10332, 10445, 10541, 10805, 11038).
**Where:** `index.html:3205, 3822, 3828, 4241, 4347` (and 9 more)
**Why it matters:** Any new field added to the task schema must be updated in all 14 places. Two recent bugs (`createdAt` overwrite, `hoursLogged` NaN crash from commit `72e03fe`) resulted from this exact drift.
**Effort:** M
**Suggested fix:**
- Extract a `makeTask(overrides)` factory that merges defaults with provided fields.
- Replace all 14 call sites. This is a pure refactor with no behaviour change.

---

### 13. `getAboutMe()` returns `localStorage` directly — no validation or default
**What:** `function getAboutMe(){ return localStorage.getItem('taskos_about')||''; }` at line 9936 returns an empty string when the user hasn't set a bio. Callers then either get empty context (lines 5444, 5454, 5646) or fall back to the owner's hardcoded personal bio (P0 item #3).
**Where:** `index.html:9936`
**Why it matters:** Empty bio → generic AI output. Hardcoded owner bio → wrong AI output. Neither is acceptable for a multi-user app.
**Effort:** S
**Suggested fix:**
- Make `getAboutMe()` assemble a bio dynamically from `S` fields if the manual bio is empty: `profileName + ', a person working on ' + top goals + '.'`
- This gives every user a meaningful context string without requiring Settings setup.

---

### 14. `checklist-badge` uses hardcoded `#ef4444` inline style
**What:** Multiple badge/status elements use hardcoded hex colours as inline styles rather than CSS variables or classes.
**Where:** `index.html:1080` (checklist badge), `index.html:3073–3074` (next-habit score), `index.html:7382` (This Week count)
**Why it matters:** Colours don't respect the dark/light theme system and are invisible to the brand-consistency check.
**Effort:** S
**Suggested fix:**
- Add CSS variables `--color-danger: #ef4444; --color-warn: #f59e0b; --color-success: #22c55e;` to `:root`.
- Replace all inline hex colour strings with `var(--color-danger)` etc.

---

### 15. `sw.js` cache manifest is not versioned — stale assets served indefinitely
**What:** The service worker caches a fixed list of asset paths with no cache-busting version string. When `index.html` is updated, the SW may serve the old cached version.
**Where:** `sw.js:1–117`
**Why it matters:** Users on mobile or with aggressive caching may run weeks-old code after a deploy, especially since the SW update detection is already broken (P1 item #9).
**Effort:** S
**Suggested fix:**
- Add a `CACHE_VERSION = 'v1.2'` constant at the top of `sw.js` and include it in the cache name.
- Bump the version with each deploy (this can be automated by injecting the git short SHA at build time).

---

## 💡 P3 — Nice to have

---

### 16. `posthogKey` is empty — analytics are not running
**What:** `APP_CONFIG.posthogKey` is an empty string (`''`) at line 9960. PostHog initialises but never captures events to a real project.
**Where:** `index.html:9960, 10392`
**Why it matters:** You can't see conversion funnels, feature adoption, or guest→signup rates without real PostHog data.
**Effort:** S
**Suggested fix:** Add the PostHog project API key to `APP_CONFIG.posthogKey`. The integration code is already written and correct.

---

### 17. `exportData()` includes `claudeKey` in the JSON dump
**What:** `exportData()` at line 2599 calls `JSON.stringify(S)`, which includes `S.claudeKey`. Users who share their backup file inadvertently expose their API key.
**Where:** `index.html:2599–2604`
**Why it matters:** A support request ("here's my export file") becomes a credential leak.
**Effort:** S
**Suggested fix:** Strip sensitive fields before export: `const {claudeKey, ...exportable} = S; JSON.stringify(exportable)`.

---

### 18. `aiProxy` is empty — all AI calls go direct from the browser with the user's key
**What:** `APP_CONFIG.aiProxy` is an empty string (line 9959). The proxy is deployed at `/api/claude.js` but not wired up, so users must supply their own key.
**Where:** `index.html:9959`
**Why it matters:** Requiring a personal Anthropic key is the single biggest friction point for the AI feature funnel. Every user who hits the "Add API key" toast and doesn't have one leaves.
**Effort:** S
**Suggested fix:** Set `aiProxy` to the deployed Vercel URL (e.g. `https://<project>.vercel.app/api/claude`) so signed-in users get AI for free via the server proxy.

---

### 19. Keyboard-nav accessibility: most buttons lack `aria-label` when icon-only
**What:** Several icon-only buttons (the compact-mode toggle `🗜`, the FAB `+`, mobile search, the sync pill) have no `aria-label` or `title` that screen readers can announce.
**Where:** `index.html:1089` (compact), `index.html:256` (FAB), `index.html:1079` (search chip)
**Why it matters:** WCAG 2.1 AA requires all interactive elements to have an accessible name. Also affects keyboard users navigating by tab.
**Effort:** S
**Suggested fix:** Add `aria-label="Toggle compact mode"` etc. to icon-only buttons. The `title` attribute already present on some (line 1079) helps tooltips but is not sufficient for screen readers alone.

---

### 20. `supabase-setup.sql` is committed but contains no RLS policies
**What:** `supabase-setup.sql` creates the `taskos_data` table but the RLS policy shown is a placeholder that may allow cross-user data access if the project's default RLS is misconfigured.
**Where:** `supabase-setup.sql` (entire file)
**Why it matters:** A misconfigured RLS policy would let any authenticated user read another user's task data — a serious privacy violation.
**Effort:** S
**Suggested fix:** Verify that the `taskos_data` table has RLS enabled and that the policy restricts rows to `auth.uid() = user_id`. Run `select * from pg_policies where tablename = 'taskos_data';` to confirm.

---

*Total items: 20 | P0: 4 | P1: 6 | P2: 5 | P3: 5*
