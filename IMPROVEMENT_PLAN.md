# Improvement Plan — Arete + Givelink
*Generated 2026-07-26 · Reviewed: all HTML, JS, SW, API files in repo*

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notifications and in-app reminders show a broken icon
**What:** `./icons/icon-192.png` is referenced in both the push payload and the in-app notification call, but the file lives at `./icon-192.png` (no subdirectory).
**Where:** `sw.js:46-47`, `index.html:11289`
**Why it matters:** Every reminder and push notification shows a broken/missing icon on Android and Chrome. On stricter Android configs, `showNotification` silently fails when the icon URL 404s — reminders users opted into never arrive.
**Effort:** S
**Suggested fix:**
- In `sw.js` lines 46-47, change `'./icons/icon-192.png'` → `'./icon-192.png'` (both `icon` and `badge`).
- In `index.html:11289`, same change in the `new Notification(...)` call.

---

### 2. AI proxy exists but is never wired up — every user needs their own API key
**What:** `api/claude.js` is deployed but `APP_CONFIG.aiProxy` is an empty string, forcing every user who wants AI features to paste their personal Anthropic API key into a Settings field where it is stored unencrypted in `localStorage`.
**Where:** `index.html:9959`, `api/claude.js`
**Why it matters:** New users hit a hard wall on every AI feature ("Add Claude API key in Settings") with no guidance. Users who do add a key expose it to any XSS or browser extension. This is the single largest onboarding friction for the AI-first pitch on the landing page.
**Effort:** S
**Suggested fix:**
- Set `aiProxy: '/api/claude'` in `APP_CONFIG`.
- Confirm `ANTHROPIC_API_KEY` is set in Vercel environment variables and `SUPABASE_URL`/`SUPABASE_ANON_KEY` are set so only signed-in users can call it.
- Remove the "Add Claude API key in Settings" toast message shown to proxy users (the gate is now the Supabase session, not a local key).

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 3. PostHog analytics disabled — zero funnel visibility
**What:** Both `APP_CONFIG.posthogKey` (app) and `POSTHOG_KEY` (landing) are empty strings. All `track()` calls are no-ops.
**Where:** `index.html:9960`, `landing.html:701`
**Why it matters:** You can't measure which CTA drives signups, can't see where users drop off, can't connect the landing → signup funnel. The landing page's analytics instrumentation (scroll depth, demo seen, CTA location) is wired up and ready but collecting nothing.
**Effort:** S
**Suggested fix:**
- Paste the PostHog project key into `posthogKey` in `APP_CONFIG` (index.html) and into `POSTHOG_KEY` on landing.html.
- Same key in both files — the landing comment already explains this connects the funnel automatically.

---

### 4. All production URLs point to the Vercel staging subdomain
**What:** `task-management-beige-eight.vercel.app` is hardcoded 12+ times: OG/Twitter meta tags, canonical link, JSON-LD structured data, `sitemap.xml`, `robots.txt`, and the social share card canvas text.
**Where:** `index.html:24,25,32,10180,10232`, `landing.html:11,16,17,21,25`, `sitemap.xml:4`, `robots.txt:4`
**Why it matters:** Shared links look like a dev/staging URL. The social share card PNG (which renders when users share their wins) literally says `task-management-beige-eight.vercel.app`. Search engine canonical points to the wrong place if a custom domain is added.
**Effort:** S
**Suggested fix:**
- Add a custom domain in Vercel (e.g. `arete.app`).
- Global-replace the Vercel subdomain in all files above.
- On line `10232`, derive the URL from `_APP_URL` rather than repeating a string literal.

---

### 5. No rate limiting on the `/api/claude` proxy
**What:** The serverless handler has zero per-user rate limiting. Any authenticated user can call it in a tight loop.
**Where:** `api/claude.js:12-13` (the file even warns about this in a comment)
**Why it matters:** A single misbehaving or malicious account can drain the Anthropic budget. At `claude-haiku-4-5` pricing, even a modest 10 req/s for an hour is hundreds of dollars.
**Effort:** M
**Suggested fix:**
- Add Upstash Redis (free tier covers most small apps) with a sliding-window limiter: 20 requests per user per hour.
- Return `429` with a `Retry-After` header if the limit is exceeded.
- Add a brief comment with the Upstash `@upstash/ratelimit` setup snippet so the next person can enable it easily.

---

### 6. Givelink AI Sprint Planner uses `claude-opus-4-5` instead of Haiku
**What:** The sprint planner's `runAiSprintPlanner()` hardcodes `model:'claude-opus-4-5'` while every other Givelink AI call uses `claude-haiku-4-5-20251001` (the `callClaudeGL` default).
**Where:** `givelink.html:1140`
**Why it matters:** Opus is roughly 10–15x the cost of Haiku for a task (suggest 10 tasks from a backlog) that needs no special reasoning depth. Every time a user clicks "Generate" they burn a user-key API budget 10x faster than expected.
**Effort:** S
**Suggested fix:**
- Change `model:'claude-opus-4-5'` → `model:'claude-haiku-4-5-20251001'` on line 1140.
- Alternatively, promote the model choice to a constant at the top of the script block so it's easy to upgrade intentionally.

---

### 7. Guest mode sign-up nudge fires after only ~4 user-added tasks
**What:** The nudge threshold is 9 active tasks, but seed data creates ~5, so a user who adds just 4 real tasks gets prompted to create an account.
**Where:** `index.html:2593`
**Why it matters:** A user who's barely started gets a conversion push before they've seen the value. Early friction leads to abandonment; the nudge should fire when they've invested enough to want to protect their work.
**Effort:** S
**Suggested fix:**
- Raise the threshold to 15 (`active < 15` instead of `< 9`).
- Or, filter to only tasks created after the session start (use a session timestamp vs `createdAt`) so seeded tasks don't count toward the threshold.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 8. `index.html` is a 14,924-line single file
**What:** The entire Arete application — CSS, HTML, Supabase auth, AI integration, service worker registration, analytics, and all views — lives in one HTML file.
**Where:** `index.html` (entire file)
**Why it matters:** Any change risks silently breaking an unrelated feature. Merge conflicts on this file will be painful. There is no way to unit test any individual function without loading the whole page.
**Effort:** L
**Suggested fix:**
- Start with three extractions (don't do it all at once): `supabase.js` (auth + sync), `claude.js` (AI calls), `analytics.js` (PostHog wrapper).
- Use `<script type="module">` with dynamic imports to keep the initial load lightweight.
- Do not attempt a full split until the proxy and analytics issues above are resolved (they touch many files).

---

### 9. SW update banner fires twice per app update
**What:** Both the `reg.installing → statechange → 'activated'` handler and the `controllerchange` handler call `showUpdateBanner()`. A normal SW update cycle triggers both.
**Where:** `index.html` (SW registration block around line 13720), `givelink.html:1720-1732`
**Why it matters:** The "App updated! Reload now" banner flashes, disappears (hidden by the second show), and can cause the banner to render in a broken half-shown state depending on timing.
**Effort:** S
**Suggested fix:**
- Remove the `updatefound/statechange/activated` listener. Keep only `controllerchange`, since it fires reliably when the new SW takes control — that's the correct moment to show the banner.
- Add `let _bannerShown = false` guard if you want both handlers as a belt-and-suspenders approach.

---

### 10. `givelink.html`: CRM seed runs inside every `renderCRM()` call
**What:** `renderCRM()` calls `seedNonprofits()` unconditionally on every navigation to the CRM view. The function guards with `if((S.nonprofits||[]).length)return` but this is a fast-path miss, not the right architecture.
**Where:** `givelink.html:1301`
**Why it matters:** If the guard ever breaks (e.g., data migration clears `nonprofits`), the seed re-runs mid-session. It also makes `renderCRM` harder to read — render and initialization are mixed.
**Effort:** S
**Suggested fix:**
- Move `seedNonprofits()` call to the `// INIT` block at the bottom of the file (line 1717, next to `load()` and `seed()`).
- Remove it from `renderCRM()`.

---

## 💡 P3 — Nice to have

### 11. Social share card PNG bakes in the Vercel subdomain
**What:** The canvas-drawn share image renders the literal string `task-management-beige-eight.vercel.app` at the bottom of the image.
**Where:** `index.html:10232`
**Why it matters:** Every image shared by a user carries the ugly staging URL. Low-visibility but affects brand perception.
**Effort:** S
**Suggested fix:** Replace the hardcoded string with `new URL(_APP_URL).hostname` so it updates automatically when the domain changes.

---

### 12. `sitemap.xml` only includes the root URL
**What:** `sitemap.xml` lists only `https://task-management-beige-eight.vercel.app/` and omits `/landing.html`.
**Where:** `sitemap.xml`
**Why it matters:** The landing page, which has structured data and SEO copy from the PR #83, won't be discovered efficiently by crawlers without a sitemap entry.
**Effort:** S
**Suggested fix:** Add a `<url>` entry for `/landing.html` with `changefreq: monthly` and `priority: 0.8`.

---

### 13. `index.html` (the app) should be `noindex`
**What:** The app shell has no `<meta name="robots">` directive. Search engines may index it, surface task data previews, or waste crawl budget on authenticated views.
**Where:** `index.html` (head, around line 18)
**Why it matters:** Authenticated SPA shells should not appear in search results; the landing page is the indexed surface.
**Effort:** S
**Suggested fix:** Add `<meta name="robots" content="noindex, nofollow">` to the `<head>` of `index.html`.

---

### 14. `callClaudeGL` fallback uses `window.prompt()` for API key entry
**What:** In `givelink.html`, when no stored key is found, `callClaudeGL()` opens a browser `prompt()` dialog — a blocking, system-modal UX.
**Where:** `givelink.html:1261`
**Why it matters:** On mobile, `prompt()` is a jarring system dialog that breaks flow. It also prevents the key from benefiting from the Task OS settings key lookup path.
**Effort:** S
**Suggested fix:** Replace the `prompt()` fallback with a toast that says "Add your API key in Arete Settings" and returns `null` immediately, identical to how the Task OS handles this.
