# Improvement Plan — Arete

*Generated 2026-08-15. Max 20 items, ordered by ROI within each tier.*

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Every new user sees "Good morning, Panos 👋" and all AI prompts impersonate the owner
**What**: The default name fallback for new users is the developer's first name (`localStorage.getItem('taskos_name') || 'Panos'`), the dashboard H1 is hardcoded to "Good morning, Panos 👋", and three AI prompt templates inject "Panos, founder of Givelink (B2B SaaS for nonprofits)" as the user persona.
**Where**: `index.html:2519` (default name), `index.html:1070` (H1 greeting), `index.html:11672, 11734, 5445` (AI prompts)
**Why it matters**: Every new user's first experience of the app is a greeting addressed to someone else. AI responses are shaped around the owner's business context and identity, making them wrong for everyone else. This is a launch-blocking embarrassment.
**Effort**: S
**Suggested fix**:
- Change the default name to `'there'` or `'friend'` so greeting reads "Good morning 👋" until the user sets their name
- Replace the static H1 with a JS-rendered greeting that uses the resolved name
- Scrub all `Panos` / `founder of Givelink` literals from AI prompt templates and use a generic persona ("a productive professional") or the user's stored name

---

### 2. All users' Finance view shows the owner's personal financial goals
**What**: The Finance view renders hardcoded personal targets — "Income 2026 (goal: €25K)" and "Passive this month (goal: €300)" — in the stats strip for every user. These are used directly in arithmetic (`yearIncome/25000*100`), not as user-configurable settings.
**Where**: `index.html:5223, 5323–5324`
**Why it matters**: Any user who opens Finance sees someone else's financial goals with a progress bar calibrated to those numbers. For a product built around personal data privacy, this is acutely ironic.
**Effort**: M
**Suggested fix**:
- Move `incomeGoal` and `passiveGoal` into the user's `S` state object with neutral defaults (0 or null)
- Add a "Set target" affordance in the Finance view header
- Remove hardcoded magic numbers from arithmetic — compute against `S.financeGoals.annualIncome || 0`

---

### 3. AI features silently broken for all users (`aiProxy` is empty)
**What**: `APP_CONFIG.aiProxy` is an empty string. Every AI call (triage, plan-my-day, AI commands, morning briefing) falls back to a "add your Claude API key" toast. The `/api/claude` serverless proxy is deployed and ready but not wired in.
**Where**: `index.html:9959`
**Why it matters**: AI is the primary differentiator called out in every headline and CTA. If signed-in users can't access it without their own API key, the guest → account conversion loop is broken at its payoff moment.
**Effort**: S
**Suggested fix**:
- Set `aiProxy: '/api/claude'` in `APP_CONFIG`
- Confirm `ANTHROPIC_API_KEY` is set in Vercel project env vars
- Test with a signed-in and a guest session

---

### 4. No rate limiting on `/api/claude` proxy — open to bill exhaustion
**What**: The serverless proxy has no per-user or per-IP request cap. A single account (or automated loop) can run up the Anthropic bill indefinitely. Line 12 of the file explicitly acknowledges this is missing.
**Where**: `api/claude.js:12-48`
**Why it matters**: A single abuse loop overnight could create a four-figure surprise bill. There is no circuit breaker, spend cap, or alerting.
**Effort**: M
**Suggested fix**:
- Add Upstash Redis rate limiting (free tier handles the scale): 10 req/min per Supabase UID
- Return `429` with `Retry-After: 60` on breach
- Fall back to IP-based limiting for unauthenticated/guest calls

---

### 5. Two `setInterval` calls are never stored or cleared — stack up on any reinit
**What**: `setInterval(() => { /* streak saver */ }, 60000)` at line 10712 and `setInterval(checkReminders, 60000)` at line 11273 are created at module init and never assigned to a variable, making them impossible to clear. Any future teardown/reinit (e.g., auth state change, hot reload) creates duplicate intervals.
**Where**: `index.html:10712, 11273`
**Why it matters**: Duplicate intervals fire streak-save and reminder-check multiple times per minute, causing redundant saves, potential toast spam, and memory growth over long sessions.
**Effort**: S
**Suggested fix**:
- Assign each to a module-level variable: `let _streakInterval = null`
- Before creating, clear any existing: `clearInterval(_streakInterval); _streakInterval = setInterval(...)`

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. PostHog analytics disabled — zero funnel visibility
**What**: `posthogKey` is an empty string in both `index.html:9960` and `landing.html:699`. Every `track()` call across the app is a no-op. No pageview, CTA, signup, retention, or AI usage events are firing.
**Where**: `index.html:9960`, `landing.html:699`
**Why it matters**: Without analytics there is no signal on which PLG features (referrals, templates, guest mode) shipped in July are driving conversions, or where users drop off. Every growth decision is guesswork.
**Effort**: S
**Suggested fix**:
- Add the PostHog project key to both files (same key — same origin means landing → app funnel stitches automatically)
- Move key to an env var baked at deploy time so it is not committed in plaintext

---

### 7. "Givelink" category, 20+ seed tasks, and AI prompt angle leaked into Arete
**What**: After commit #73 removed Givelink from navigation, the `CATS` object still exposes a `givelink` category, 20+ seed tasks categorised as `givelink` are injected for every new user, and the social-post AI prompt offers a "Givelink" angle ("startup progress building B2B SaaS for nonprofits").
**Where**: `index.html:2503` (CATS), `index.html:4546–4711` (seed tasks), `index.html:6077` (social post angles)
**Why it matters**: New users see "Givelink" in their task picker and inbox on day one — a B2B SaaS product they have never heard of. The AI social generator can produce Givelink-branded copy for a personal productivity user. Kills the "personal, calm" brand promise immediately.
**Effort**: M
**Suggested fix**:
- Remove `givelink` key from `CATS` (replace with a generic `startup` or `side-project` if a work category is needed)
- Remove or reclassify the 20+ Givelink seed tasks — replace with universally relevant onboarding tasks
- Remove `givelink` angle from the social post angles object

---

### 8. Hardcoded dev Vercel URL breaks social sharing, SEO, and sharing card
**What**: `_APP_URL = 'https://task-management-beige-eight.vercel.app/'` is hardcoded and used for referral links, invite URLs, and the social sharing card watermark. OG/Twitter meta tags and the canonical URL in `landing.html` point to the same dev subdomain.
**Where**: `index.html:10180, 10232, 24–32`, `landing.html:11-21`
**Why it matters**: Every share card and invite link generated in production carries the wrong domain. The social card canvas renders "Made with Arete · task-management-beige-eight.vercel.app". The canonical URL prevents SEO value flowing to any custom domain.
**Effort**: S
**Suggested fix**:
- Move `_APP_URL` into `APP_CONFIG.appUrl` with a default of `location.origin`
- Use `APP_CONFIG.appUrl` in all invite/share URL construction
- Update OG tags and canonical URL in landing.html to the production domain

---

### 9. Push notification icon path is wrong — silently breaks reminders
**What**: The push notification handler references `./icons/icon-192.png` (line 47) but the icon lives at `./icon-192.png` (no `icons/` subdirectory). Every push notification fires without an icon; on Android this can suppress delivery entirely.
**Where**: `sw.js:47`
**Why it matters**: Reminders are a core retention loop. Users who enabled notifications receive silent failures they cannot diagnose.
**Effort**: S
**Suggested fix**:
- Change `./icons/icon-192.png` → `./icon-192.png` for both `icon` and `badge` fields in the push handler
- Verify with DevTools → Application → Push Notifications

---

### 10. Givelink Sprint Board still accessible and serves entirely off-brand UI
**What**: `givelink.html` is a fully operational blue-branded (accent: `#3b82f6`) sprint board for a separate product. It is still precached by the service worker and reachable via direct URL.
**Where**: `givelink.html:17`, `sw.js:16`
**Why it matters**: Any user who discovers the URL sees a completely different product with a different color system and brand. Confusing and embarrassing post-split.
**Effort**: S
**Suggested fix**:
- Add a redirect in `vercel.json`: `{ "source": "/givelink.html", "destination": "/", "statusCode": 301 }`
- Remove from service worker STATIC and HTML arrays and bump the cache version string

---

### 11. XSS: task title rendered as raw HTML in delete-undo toast
**What**: Line 3844 builds the undo toast with `t.title.slice(0,30)` interpolated directly into innerHTML. A task titled `<img src=x onerror=alert(1)>` executes script on every delete. The `esc()` helper exists (line 11776) but is missed here and in the blocking-tasks `<option>` builder (line 2543).
**Where**: `index.html:3844, 2543`
**Why it matters**: Stored XSS triggered by user's own content now; becomes cross-user if template import or shared goal links ever allow external task content.
**Effort**: S
**Suggested fix**:
- Wrap `t.title.slice(0,30)` in `esc()` at line 3844
- Wrap `t.title.slice(0,45)` in `esc()` at line 2543
- Run `grep -n "innerHTML.*\.title\|innerHTML.*\.name"` and audit every hit

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 12. Stale Givelink assets precached in service worker inflate every install
**What**: `sw.js` precaches `manifest-givelink.json`, `icon-gl.svg`, and `givelink.html`. All three are dead assets after the product split. Cache version `arete-20260723` was not bumped after the July 22 landing commit added new content.
**Where**: `sw.js:4, 6, 16` and `sw.js:1`
**Why it matters**: Every fresh install fetches dead assets. The CACHE version mismatch means the July 22 SEO/analytics changes may not reach returning users for up to 24 hours after their next visit.
**Effort**: S
**Suggested fix**:
- Remove stale Givelink entries from STATIC and HTML arrays
- Bump CACHE to `arete-20260815` (or a git-hash-derived string)
- Add cache version bump to the deploy checklist

---

### 13. `givelinkMetrics` and `givelinkHistory` dead state synced to every user's cloud row
**What**: The `S` state object carries `givelinkMetrics` (with ARR, MRR, pipeline, impact model, viral coefficient targeting 1M people) and `givelinkHistory: []` for every user. These are serialised to localStorage and synced to Supabase on every save.
**Where**: `index.html:2517`
**Why it matters**: Owner business data is baked into every user's cloud storage row. Adds unnecessary serialization overhead, and any future name collision with a real feature key creates a silent migration bug.
**Effort**: M
**Suggested fix**:
- Remove `givelinkMetrics`, `givelinkHistory` from the default `S` object
- Add a one-time migration in `load()` to `delete` the old keys from any existing stored state
- Remove `renderGivelinkDash` from the `renderView()` dispatch table (line 2984) if not reachable via navigation

---

### 14. Export filenames still say "taskos-" — wrong brand on every download
**What**: All data exports, backups, and the social sharing card use the old internal codename: `taskos-backup-*.json`, `taskos-tasks-*.csv`, `taskos-progress.png`.
**Where**: `index.html:2602, 2628, 2652, 2668, 2675, 10243`
**Why it matters**: Every exported file shows a brand name the user has never seen. Creates confusion and looks unfinished, especially if a user shares the progress card.
**Effort**: S
**Suggested fix**:
- Replace `taskos-` prefix with `arete-` in all download filename strings
- The canvas sharing card also says "Made with Arete · task-management-beige-eight.vercel.app" — update to just "Made with Arete · [APP_CONFIG.appUrl]"

---

### 15. Stats row rendered then immediately hidden — dead code in every dashboard render
**What**: `renderDash()` builds the 5-stat overview (Inbox/Week/Month/Backlog/Done Today) into `#stats` innerHTML, then immediately sets `_statsEl.style.display = 'none'`. The stats are never visible.
**Where**: `index.html:3025`
**Why it matters**: Dead render on every dashboard load. Either the stats row should be shown (it was presumably useful at some point) or the render call should be removed to reduce render work.
**Effort**: S
**Suggested fix**:
- If stats are intentionally hidden: remove the `innerHTML` assignment and any data prep above it
- If stats should be visible: remove the `style.display = 'none'` and verify the layout

---

### 16. Offline promise broken: Google Fonts not cached by service worker
**What**: `index.html` loads Inter from `fonts.googleapis.com` (lines 14-16). The service worker routes all non-local requests as network-only (sw.js:98-101). Going offline → Inter unavailable → layout shift and fallback to system fonts.
**Where**: `index.html:14-16`, `sw.js:98-101`
**Why it matters**: The landing page's trust section and comparison table prominently claim "Works fully offline" as a key differentiator. The font is the first visible element that breaks that promise.
**Effort**: M
**Suggested fix**:
- Self-host Inter via `@fontsource/inter` and serve from the same origin so the service worker can cache it
- Or add a font-caching strategy in sw.js for `fonts.gstatic.com` responses

---

### 17. `window._justWelcomed` global creates fragile one-shot onboarding trigger
**What**: The onboarding tour is triggered by checking `window._justWelcomed` set at line 10456 and read at line 10136. A window global can be accidentally re-triggered by any other script or concurrent async path.
**Where**: `index.html:10136, 10456`
**Why it matters**: If onboarding fires twice, users see the modal stack on their first session — the highest-impact impression moment. The fix takes under five minutes.
**Effort**: S
**Suggested fix**:
- Replace `window._justWelcomed` with a module-level `let _justWelcomed = false`
- Clear it immediately after `_maybeOnboard()` is called

---

## 💡 P3 — Nice to have

### 18. Primary accent colors diverge from brand spec — blue-purple instead of true purple
**What**: Dark mode uses `--accent:#8272f2` and `--brand-gradient:linear-gradient(135deg,#6a58ee,#9878ea)`. Light mode uses `--accent:#5a49e0`. Both are in the blue-purple/indigo family — approximately 30° bluer than the specified brand palette (#6B3FA0 / #5718CA). The brand pink (#C2185B / #E353B6) is completely absent from the UI.
**Where**: `index.html:44-50` (dark), `index.html:53-57` (light)
**Why it matters**: The current palette is aesthetically coherent but not the specified brand identity. Growing divergence makes future realignment progressively harder as colors are copied in new feature code.
**Effort**: L
**Suggested fix**:
- Define final palette as CSS variables in `:root` and `body.light` only — update `--accent`, `--brand-gradient`, and introduce `--accent-alt` for the pink
- Audit for hardcoded hex values that bypass the variable system (bucket colors in `BCOLORS` at line 2515, inline style colors in template literals)
- Enforce the no-pink-on-purple rule via a comment in the variable definition block

---

### 19. "Plan my day" button bypasses `_aiBtn` wrapper — no spinner or double-click guard
**What**: The "☀️ Plan my day" button calls `aiPlanDay()` directly. Every other AI button uses `_aiBtn(btn, fn)` which disables the button and shows a spinner during the request. `aiPlanDay` relies only on `_aiLock()` inside the async body, which is not checked until after the async starts.
**Where**: `index.html:1078, 2774, 5110-5141`
**Why it matters**: On slow connections, users see no feedback and may click multiple times. The toast appears but can scroll off-screen on mobile before the plan arrives.
**Effort**: S
**Suggested fix**:
- Change the onclick to `_aiBtn(this, aiPlanDay)` to match the pattern used by other AI action buttons

---

### 20. `<meta name="robots">` absent on `index.html` — app shell may be indexed
**What**: `index.html` has no `robots` meta tag. Search crawlers can discover and attempt to index the app shell.
**Where**: `index.html:1-32`
**Why it matters**: Indexed app shell creates low-quality search results and confuses users who click through from search with no session. Easy to prevent now before traffic scales.
**Effort**: S
**Suggested fix**:
- Add `<meta name="robots" content="noindex,nofollow">` to `index.html`
- Confirm `robots.txt` already contains `Disallow: /index.html`
