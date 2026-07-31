# Arete — Improvement Plan
_Generated: 2026-07-31_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP blocks Google Fonts — Inter never loads

**What:** The Content-Security-Policy in `vercel.json` has `style-src 'self' 'unsafe-inline'` and `font-src 'self'`, but the app loads Inter from `fonts.googleapis.com` (stylesheet) and `fonts.gstatic.com` (font files). Both are blocked — the app renders in system fonts for every user.

**Where:** `vercel.json:15` (CSP header), `index.html:14-16` (font link tags)

**Why it matters:** The entire visual brand depends on Inter. System font fallback looks different on every OS — destroying the premium, polished feel the landing sells. Also causes CSP console errors on every page load.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src` in `vercel.json:15`
- Add `https://fonts.gstatic.com` to `font-src` in `vercel.json:15`
- Resulting: `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;`

---

### 2. Push notification icons broken (wrong path in service worker)

**What:** `sw.js` lines 46–47 reference `./icons/icon-192.png` for the notification icon and badge, but no `icons/` directory exists. The actual file is at `./icon-192.png`. All web push notifications show a broken/missing icon.

**Where:** `sw.js:46-47`

**Why it matters:** Push notifications are the only re-engagement channel. A notification with a broken icon looks like spam or a malformed alert — users dismiss or disable them.

**Effort:** S

**Suggested fix:**
- Change both occurrences: `./icons/icon-192.png` → `./icon-192.png`
- Bump the `CACHE` version string in `sw.js:1` so the corrected service worker activates immediately

---

### 3. XSS: task and goal titles injected raw into innerHTML

**What:** Multiple render functions insert `${t.title}` and `${g.title}` directly into `innerHTML` template literals without escaping. The `esc()` function (line 11776) exists but is not applied consistently. A task title containing `<script>alert(1)</script>` or `<img onerror=...>` executes immediately when that view renders.

**Where:** `index.html:3159, 3223, 3274, 3306` (buckets/inbox render), `index.html:3594, 3601, 3603` (weekly review wizard), `index.html:3519, 3570` (goal cards)

**Why it matters:** Data comes from `localStorage` (user-owned, low risk) but also from Supabase sync — a compromised or shared account, or a future template-import path, could deliver a crafted title to another user. Also fails a basic security audit.

**Effort:** M

**Suggested fix:**
- Replace every unescaped `${t.title}` in innerHTML contexts with `${esc(t.title)}` (same for `g.title`, `p.name`)
- Add a test: create a task titled `<b>bold</b>` and confirm it renders as literal text in every view
- Long-term: adopt a `textContent`-based render helper so the mistake is impossible by default

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. AI features unavailable to most users — aiProxy not configured

**What:** `APP_CONFIG.aiProxy` is an empty string (`index.html:9959`). Every AI feature (auto-triage, plan-my-day, task reply, brain dump) is gated behind a user-supplied Anthropic API key. New users who can't or won't obtain an API key hit a dead wall immediately after the feature is described on the landing.

**Where:** `index.html:9959` (APP_CONFIG), `api/claude.js` (proxy, already built but unused)

**Why it matters:** The landing page's hero copy and every AI feature description assumes AI works out of the box. The activation gap between "I want to try this" and "I have an Anthropic API key" is enormous — this is likely the biggest drop-off point after sign-up.

**Effort:** S (the proxy endpoint is already written and deployed)

**Suggested fix:**
- Deploy `api/claude.js` on Vercel with `ANTHROPIC_API_KEY` set as an environment variable
- Paste the resulting URL into `APP_CONFIG.aiProxy` in `index.html:9959`
- For guests, gate behind `SUPABASE_URL` check (already supported in the proxy) so only signed-in users get free AI calls

---

### 5. No rate limiting on the AI proxy — one user can exhaust the bill

**What:** `api/claude.js` has no per-user quota or rate limit. The comment at line 12 acknowledges this explicitly ("For production add per-user rate limiting"). Any signed-in user can make unlimited Claude API calls via the proxy.

**Where:** `api/claude.js:12-49`

**Why it matters:** A single user (or an automated script with a valid session) can run up an unbounded Anthropic bill the moment `aiProxy` is configured. This is the one thing that has to exist before enabling the proxy.

**Effort:** S

**Suggested fix:**
- Add Upstash Redis (free tier covers ~10k ops/day) with a sliding-window rate limiter: 20 requests/hour per `user_id` from the Supabase JWT
- Return `429 Too Many Requests` with a human-readable retry time when exceeded
- Log the user ID and token count in Vercel logs for billing visibility

---

### 6. PostHog analytics not configured — zero funnel visibility

**What:** `APP_CONFIG.posthogKey` is `''` in `index.html:9960` and `POSTHOG_KEY = ''` in `landing.html:702`. The PostHog SDK, all `track()` calls, and all scroll/demo/CTA event listeners are wired up and ready — just waiting for a key.

**Where:** `index.html:9960`, `landing.html:702`

**Why it matters:** Without analytics there is no way to know which landing CTAs convert, where users drop off in onboarding, which AI features are actually used, or whether the rebrand to Arete affected activation. Every product decision is a guess.

**Effort:** S

**Suggested fix:**
- Create a free PostHog Cloud project (posthog.com), copy the project API key
- Paste into `index.html:9960` as `posthogKey: 'phc_...'`
- Paste the same key into `landing.html:702` as `POSTHOG_KEY = 'phc_...'` — same origin means the landing → app funnel joins automatically

---

### 7. Anthropic API key stored in localStorage and sent from browser

**What:** When users configure their own Claude key in Settings, it is stored inside the flat `S` object (`S.claudeKey`), which is JSON-serialised to `localStorage('taskos')` on every save. It is then sent directly to `api.anthropic.com` from the browser with the `anthropic-dangerous-direct-browser-access: true` header. The key is visible to anyone who opens DevTools → Application → Local Storage.

**Where:** `index.html:5022` (direct fetch), `index.html:9917` (key storage), `index.html:2517` (S object definition)

**Why it matters:** Users who paste their personal Anthropic key are trusting the app not to expose it. Once `aiProxy` is live, this direct-browser path becomes unnecessary. Even before then, the key should not sit inside the full serialised state blob.

**Effort:** M

**Suggested fix:**
- Once `aiProxy` is live: remove the entire `!useProxy` code branch in `callClaude()` and the key input from Settings UI
- If keeping the direct path temporarily: store `claudeKey` in a separate `localStorage` entry (`taskos_api_key`) that is not included in the main `S` dump, and never log or export it

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 8. Everything lives in a 14,924-line single HTML file

**What:** `index.html` contains all CSS (~1,500 lines), all HTML markup (~2,000 lines), and all JavaScript (~11,000 lines) for 40+ views and 80+ functions in one file. There is no module system, no bundler, no clear section boundaries beyond comments.

**Where:** `index.html:1-14924`

**Why it matters:** Onboarding a collaborator takes hours of orientation. Merge conflicts are catastrophic. Finding any function requires text search. The file is large enough that IDE tooling slows down.

**Effort:** L

**Suggested fix:**
- Don't attempt a full rewrite. Extract `<style>` content into `app.css` and `<script>` content into `app.js` as a first step — no behaviour change, just file separation
- Reference them via `<link rel="stylesheet" href="app.css">` and `<script src="app.js"></script>` in `index.html`
- This alone reduces the main file to ~2,000 lines and makes the rest tractable

---

### 9. State object has no schema version — migrations are impossible

**What:** The `S` object (line 2517) has 60+ fields in a flat struct. `load()` does `{...S,...JSON.parse(d)}` — a shallow merge with no version check. Any field rename, type change, or removal silently corrupts existing sessions or leaves stale keys forever.

**Where:** `index.html:2517` (S definition), `index.html:2598` (load function)

**Why it matters:** As the product evolves, old localStorage schemas in users' browsers become landmines. A breaking change to any field can silently corrupt data for returning users.

**Effort:** M

**Suggested fix:**
- Add `_version: 1` to the `S` definition
- Add a `_migrate(loaded)` function that runs before the spread: checks `loaded._version`, applies any needed field transformations, and returns the upgraded object
- Bump `_version` in any commit that changes a field name or type

---

### 10. ntfy push subscription failure is silent

**What:** `initReminders()` at line 11304 calls `fetch('https://ntfy.sh', {...})` to subscribe to push. If the request fails, the `catch` block at line 11335 only does `console.warn('ntfy connection failed:', e)`. The user sees no feedback — they believe reminders are enabled when they're not.

**Where:** `index.html:11304-11335`

**Why it matters:** Reminders are a retention feature. A user who enables them but never receives one will either feel like the app is broken, or silently churn because they never get re-engaged at the right moment.

**Effort:** S

**Suggested fix:**
- In the `catch` block, replace `console.warn` with `toast('⚠ Reminders: could not connect — check your ntfy topic and try again')`
- Update the subscription UI state so the toggle reverts to off on failure, not stays on

---

## 💡 P3 — Nice to have

### 11. Google Fonts causes a render-blocking waterfall

**What:** Even after fixing the CSP, the Google Fonts link (`index.html:16`) is render-blocking. The browser must DNS-resolve `fonts.googleapis.com`, download the CSS, resolve `fonts.gstatic.com`, and download the WOFF2 — adding 200–400ms on cold loads before text paints.

**Where:** `index.html:14-16`

**Why it matters:** Slower TTI hurts perceived quality and Core Web Vitals. Not critical — fix the CSP first.

**Effort:** M

**Suggested fix:**
- Self-host the Inter subset (latin only, 5 weights) as WOFF2 — eliminates two cross-origin round trips entirely
- Add `font-display: swap` to avoid invisible text during font load

---

### 12. Comparison table missing accessible column header

**What:** `landing.html:526` has `<th></th>` as the first header cell in the feature comparison table. Screen readers announce a column with no name — the table is confusing to keyboard and assistive-technology users.

**Where:** `landing.html:526`

**Why it matters:** Low severity but easy to fix; affects any user who navigates the landing with a screen reader.

**Effort:** S

**Suggested fix:**
- Replace `<th></th>` with `<th scope="col"><span class="sr-only">Feature</span></th>`
- Add `scope="col"` to the other `<th>` cells in the same row

---

### 13. Landing PostHog code loads even when key is blank

**What:** When `POSTHOG_KEY = ''`, the PostHog SDK init is skipped, but the CTA click and scroll listener are still registered. They call `track()` which is a no-op, but the listeners add a small cost to every page interaction regardless.

**Where:** `landing.html:710-728`

**Why it matters:** Negligible but clean — move the listener setup inside the `if(POSTHOG_KEY)` block so it's dead code when analytics are off.

**Effort:** S

**Suggested fix:**
- Move the `document.addEventListener('click', ...)` and `window.addEventListener('scroll', ...)` blocks inside the `if(POSTHOG_KEY){ ... }` guard

---

_Max 20 items · Ordered by ROI within each tier · Last scan: 2026-07-31_
