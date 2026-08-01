# Arete – Improvement Plan
_Generated 2026-08-01 · 20 items max · ordered by ROI within each tier_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icon is a 404
**What:** The service worker registers push notifications with `icon: './icons/icon-192.png'`, but the directory `icons/` does not exist.
**Where:** `sw.js:46–47`
**Why it matters:** Every push notification (task reminders, daily nudges) shows a broken icon or the browser default. This erodes trust for PWA-installed users.
**Effort:** S
**Suggested fix:**
- Change `'./icons/icon-192.png'` → `'./icon-192.png'` (and `badge` on the same line)
- Verify by triggering a push via the ntfy integration in staging

---

### 2. Shareable progress card emits stale "Task OS" branding
**What:** The canvas-rendered share card (used for social sharing) draws "Task" + "OS" in the header, not "Arete", and watermarks with the raw Vercel URL.
**Where:** `index.html:10214–10215` (`fillText('Task', ...)` + `fillText('OS', ...)`) and `index.html:10232` (`Made with Arete · task-management-beige-eight.vercel.app`)
**Why it matters:** Every time a user shares their progress, they spread "TaskOS" branding, undermining the Arete rebrand and pointing people to the ugly Vercel URL.
**Effort:** S
**Suggested fix:**
- Replace the two-part text render with a single `x.fillText('Arete', 170, 124)` in the accent colour
- Change the watermark to `'Made with Arete · arete.app'` (or whatever the production domain is)

---

### 3. All AI features require a personal Anthropic API key
**What:** `APP_CONFIG.aiProxy` is set to an empty string (`''`). Every AI feature (AI triage, plan-my-day, AI command bar, notes synthesis) is gated behind "Add your Claude API key in Settings", which asks for a raw `sk-ant-api03-...` key.
**Where:** `index.html:9959` (config), `index.html:4328`, `5007–5028`, `5047`, `5111` (gate checks)
**Why it matters:** Asking new users to sign up for Anthropic, obtain an API key, and paste it into Settings before experiencing the core value proposition is a conversion killer. The proxy infrastructure (`api/claude.js`) already exists — it just isn't wired up.
**Effort:** S (already built — just set the value)
**Suggested fix:**
- Deploy `/api/claude.js` to Vercel with `ANTHROPIC_API_KEY` and `SUPABASE_URL`/`SUPABASE_ANON_KEY` env vars
- Set `aiProxy: 'https://<your-domain>/api/claude'` in `APP_CONFIG`
- Add per-user rate limiting (Upstash is noted in the comment at `api/claude.js:13`)

---

### 4. Self-XSS: task titles rendered into `innerHTML` without escaping
**What:** Multiple render functions interpolate `t.title` and `g.title` directly into `innerHTML` template strings. The `esc()` helper exists at `index.html:11776` but is not used consistently.
**Where:** `index.html:3223` (`inboxHTML`), `3274`, `3306`, `3519`, `3570`, `3594`, `3601`, `3603`, `3716`
**Why it matters:** A task title like `<img src=x onerror="...">` executes arbitrary JS. Today it's self-XSS (the attacker is the user), but if task sharing or cloud sync between accounts is ever added, this becomes a real cross-user XSS vector. It's also a path for malicious templates to execute code.
**Effort:** M
**Suggested fix:**
- Audit all `innerHTML` assignments for unescaped user data (titles, notes, names)
- Wrap every interpolation with the existing `esc()` — e.g., `${esc(t.title)}` — in: `inboxHTML`, `buckets` render, `review` render, the weekly wizard steps
- Consider replacing hot-path renders with `textContent` assignments on `<div>` elements created via `createElement`

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Product analytics not wired up — flying blind on every funnel
**What:** `APP_CONFIG.posthogKey` is `''`. All 30+ `track()` calls (`task_created`, `auth_signup`, `guest_to_signup`, `share`, `triage_applied`, etc.) fire silently into nothing.
**Where:** `index.html:9960`, `index.html:10390–10394`
**Why it matters:** Without PostHog data, there's no visibility into activation rate, guest→signup conversion, or which AI features drive retention. Every product decision is a guess.
**Effort:** S
**Suggested fix:**
- Create a PostHog project, paste the key into `APP_CONFIG.posthogKey`
- Verify `auth_signup`, `guest_started`, `guest_to_signup`, and `share` events appear in PostHog after a test flow

---

### 6. `task-management-beige-eight.vercel.app` hardcoded in 4 places
**What:** The raw Vercel project URL appears in: OG meta tags (index.html:24–32), canonical tag (landing.html:11), the `_APP_URL` constant (index.html:10180), and the share card canvas text (index.html:10232).
**Where:** `index.html:24–32`, `index.html:10180`, `index.html:10232`, `landing.html:11–21`
**Why it matters:** Referral links, share cards, and OG previews all point to the Vercel URL. If a custom domain is set (or the project is renamed), none of these update automatically. Social shares permanently route to the wrong URL.
**Effort:** S
**Suggested fix:**
- Centralise the production URL into a single constant (`_APP_URL`) and derive OG/canonical tags from it at build time, or use a relative URL where possible
- For the canonical and OG tags, set them to the actual production domain (update if not yet on a custom domain)

---

### 7. No rate limiting on the `/api/claude` proxy — runaway billing risk
**What:** `api/claude.js` authenticates the user via Supabase but has no per-user or global rate limiting. A single signed-in user can send unlimited 2,000-token requests.
**Where:** `api/claude.js:15–49` (the comment at line 13 acknowledges this gap)
**Why it matters:** One bad actor or a runaway client bug can run up an unbounded Anthropic bill. This blocks safely opening the proxy to all users.
**Effort:** M
**Suggested fix:**
- Add [Upstash Redis rate limiting](https://upstash.com/docs/redis/integrations/vercel) (the comment already suggests this)
- Suggested limits: 20 requests / user / hour, 100 requests / day
- Return a 429 with a clear "try again in X minutes" message (the client at `index.html:5028` already handles 429)

---

### 8. Auth error message leaks internal state on login failure
**What:** When login fails, the error message is `'Wrong email or password — or confirm your email first.'` — but when signup fails, `e.message` from the Supabase response is shown raw to the user.
**Where:** `index.html:10093`
**Why it matters:** Supabase error messages like `"User already registered"` or internal status codes can appear verbatim as user-facing errors.
**Effort:** S
**Suggested fix:**
- Map known Supabase error codes to friendly messages for signup: `"User already registered"` → `"An account with that email already exists — try logging in"`
- Catch and sanitise any unknown error with a generic fallback

---

### 9. Massive accessibility gap: 88 ARIA labels for 643 buttons
**What:** The app has 643 `<button>` elements and 222 `<input>` elements but only 88 `aria-label` attributes. Most icon-only buttons (checkboxes, close buttons, filter chips, FAB actions) have no accessible name.
**Where:** Globally across `index.html` — worst offenders are the task checkboxes (`.ck` class), the FAB and its dial, and all modal close buttons (`.mc`)
**Why it matters:** The app is completely unusable with a screen reader or keyboard-only nav. The landing page claims the app is "fast" — but it's fast only for mouse/touch users.
**Effort:** M
**Suggested fix:**
- Add `aria-label` to all icon-only buttons: task checkboxes (`aria-label="Mark complete"`), FAB (`aria-label="Add"`), close buttons (`aria-label="Close"`)
- Add `aria-live="polite"` to the toast container so status changes are announced
- Run axe DevTools scan and fix the highest-severity violations first

---

### 10. Seed data includes Givelink business tasks and personal goals for all new users
**What:** `seed()` and `seedGoals()` (which run for all non-hosted mode users) populate tasks like "Nonprofits Board Follow Ups", "Dan Martell & Mark Moses Frameworks", and personal health goals. `CATS` and the `S` state also include `givelinkMetrics` and `givelinkHistory`.
**Where:** `index.html:4532–5000` (seed), `index.html:4926–5000` (seedGoals), `index.html:2517` (S state), `index.html:2503` (CATS)
**Why it matters:** Self-hosters and non-hosted guests see Givelink business tasks as their starter content. The "Remove Givelink from Task OS" commit (#73) separated the products at the UI level, but the seed data and schema still embed Givelink as a category and business metric object.
**Effort:** M
**Suggested fix:**
- Replace `seed()` and `seedGoals()` content with generic, product-demo-appropriate tasks (similar to what `_seedStarter()` does)
- Remove `givelinkMetrics`, `givelinkHistory`, and the `givelink` category from the default `S` state (or gate them behind a feature flag)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `index.html` is a 14,924-line monolith
**What:** The entire app — CSS, HTML, and ~12,000 lines of JavaScript — lives in a single file.
**Where:** `index.html` (entire file)
**Why it matters:** Every PR touching any feature must diff 14k lines. Merge conflicts are common. The file takes ~3s to open in most editors. Static analysis and test tooling don't apply.
**Effort:** L
**Suggested fix:**
- Extract JavaScript into ES modules (`src/sync.js`, `src/render.js`, `src/ai.js`, etc.) and bundle with Vite
- Extract CSS into a stylesheet — the browser can cache it independently from the HTML
- This is the only L-effort item in P2; the others listed below are actionable now

---

### 12. Claude API key stored in plain localStorage via the global `S` state
**What:** `S.claudeKey` is persisted to `localStorage` via `save()` and loaded back on boot. Any XSS (see P0/item 4) can read it via `localStorage.getItem('taskos')`.
**Where:** `index.html:2029` (input), `index.html:9917` (save), `index.html:9897` (load)
**Why it matters:** A leaked API key allows unlimited Anthropic API usage billed to the user.
**Effort:** S
**Suggested fix:**
- Store the key under a separate `localStorage` key (`taskos_claude_key`) that is explicitly excluded from the synced `S` state
- Never sync the key to Supabase (check `sbPush` — it currently pushes all of `S` including `claudeKey`)

---

### 13. No CORS/Origin check on the Claude proxy
**What:** `api/claude.js` validates the Supabase session but doesn't verify the `Origin` header. Any website that can obtain a valid Supabase token can POST to the proxy.
**Where:** `api/claude.js:22–31`
**Why it matters:** If a user is social-engineered into visiting a malicious page while signed in (session token in localStorage), that page can call the proxy via a background fetch.
**Effort:** S
**Suggested fix:**
- Add `Origin` header check: allow only `https://<your-domain>` and `http://localhost:*` in development
- Return 403 for unknown origins

---

### 14. Token refresh failure leaves the user in a broken sync state silently
**What:** When the Supabase refresh token is expired or revoked, `_sbToken()` throws, `sbSyncNow()` catches it and shows `⚠ not connected` in the sync pill — but the user is never prompted to re-authenticate. They can keep using the app locally but see a permanent error badge.
**Where:** `index.html:10022–10026`, `index.html:10439`
**Why it matters:** Users on long sessions (30+ days) will silently stop syncing. Their changes accumulate locally but never push. If they clear localStorage, their data is gone.
**Effort:** S
**Suggested fix:**
- In `sbSyncNow`'s catch, detect `'not connected'` and call `authLogout()` or show a modal: "Your session expired — log in again to resume syncing"
- Display a persistent in-app banner (not just the sync pill) when sync has been broken for >5 minutes

---

### 15. Google Fonts loaded from CDN — not cached by service worker
**What:** `index.html:16` loads Inter from `fonts.googleapis.com` and `fonts.gstatic.com`. The SW `fetch` handler only catches local-origin and treats external requests as network-only. If the CDN fails or the user is offline, the fallback is `-apple-system,BlinkMacSystemFont,'Segoe UI'`, causing a visible FOUT.
**Where:** `index.html:14–16`, `sw.js:97–101`
**Why it matters:** The landing page and app claim to "work offline" — but the Inter font (used for branding and the logo) degrades visually.
**Effort:** S
**Suggested fix:**
- Download Inter as a self-hosted font and add it to the SW's `STATIC` precache list, or
- Accept the system-font fallback and remove the external font CDN dependency entirely (the `font-family` stack already includes good fallbacks)

---

### 16. `sbPush` sends the entire app state as one blob — no conflict resolution
**What:** Cloud sync uses last-write-wins at the row level: whoever pushes last overwrites the other device's changes. Two devices open simultaneously will silently drop one side's changes.
**Where:** `index.html:10405–10411` (`sbPush`), `index.html:10412–10441` (`sbSyncNow`)
**Why it matters:** Multi-device users (the main sync use case) risk data loss when they switch between desktop and mobile quickly.
**Effort:** L
**Suggested fix:**
- Short-term: add optimistic lock (`If-Match` on the Supabase row's `updated_at`) and retry on 412 after pulling the latest
- Long-term: move to per-task sync (store individual rows in Supabase) so merges are item-level, not whole-state

---

## 💡 P3 — Nice to have

### 17. Missing `rel="noopener noreferrer"` on external links
**What:** External links in the landing page (e.g., footer links) open in a new tab but lack `rel="noopener noreferrer"`, exposing the app to `window.opener` abuse.
**Where:** `landing.html:638–640` (footer nav links)
**Effort:** S
**Suggested fix:** Add `target="_blank" rel="noopener noreferrer"` to all external-domain links.

---

### 18. Life Score and Wheel of Life recalculated on every `renderDash` call
**What:** `_renderLifeScoreWidget()` and Wheel of Life computations run synchronously on every dashboard render, iterating over potentially large `healthLogs`, `wheelAssessments`, etc.
**Where:** `index.html:3065` (`renderDash` → `_renderLifeScoreWidget`)
**Effort:** S
**Suggested fix:** Cache the computed score in `S.lifeScore` with a `lastCalc` timestamp (the field already exists in the state schema) and only recompute when data has changed since `lastCalc`.

---

### 19. `esc()` function defined at line 11776 — used before it's defined in many render paths
**What:** `esc()` is defined near the bottom of the script (line 11776) but called throughout the file in inline `onclick` attributes and render functions that execute on page load. This works due to hoisting only if `function` declarations are used — but `esc` is defined as a function declaration, so it hoists correctly. This is fragile and confusing.
**Where:** `index.html:11776`
**Effort:** S
**Suggested fix:** Move `esc()` to the top of the `<script>` block (near line 2500) so it's visually co-located with the code that uses it.

---

### 20. Landing page comparison table row "AI triage & plan-my-day" claims ✓ — but requires a personal Anthropic key
**What:** The landing page at `landing.html:530` shows Arete's AI triage as a full ✓. But until `aiProxy` is configured (P0/item 3), it actually requires the user to supply their own API key, making it closer to "partial".
**Where:** `landing.html:530`
**Why it matters:** Users expect AI to "just work" after signing up. The friction of needing an API key is a surprise that damages trust on first use.
**Effort:** S (wording fix) / S (real fix via item 3 above)
**Suggested fix:**
- Fix the underlying issue (item 3 above) so the ✓ is honest
- Until then, change that row to "partial" so the landing page stays accurate

---

_Total: 4 P0 · 6 P1 · 6 P2 · 4 P3_
