# Arete — Improvement Plan

_Generated: 2026-08-03. Based on static analysis of index.html (14 924 lines), landing.html, sw.js, api/claude.js, vercel.json, and git log._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icons 404 — all notifications show broken image

**What:** The service worker references `./icons/icon-192.png` for both the notification `icon` and `badge`, but the `icons/` directory doesn't exist. The actual file is at `./icon-192.png`.

**Where:** `sw.js:46-47`

**Why it matters:** Every push reminder (task due, custom reminder) shows a broken icon on Android. On iOS it silently degrades. Push is the one re-engagement surface that works offline — breaking the icon erodes trust at the moment it's needed most.

**Effort:** S

**Suggested fix:**
- Change `'./icons/icon-192.png'` → `'./icon-192.png'` on both lines 46 and 47 of `sw.js`
- Bump `CACHE` version string (`sw.js:1`) so existing clients reinstall the corrected worker

---

### 2. Google Fonts blocked by CSP — app renders in system fonts, not Inter

**What:** `index.html` loads Inter from `fonts.googleapis.com` (the CSS) and `fonts.gstatic.com` (the font binary). The CSP in `vercel.json` has `font-src 'self'` and does not include either Google Fonts domain in `style-src`. Both the stylesheet load and the font file download are silently blocked by the browser.

**Where:** `vercel.json` (the `Content-Security-Policy` header) + `index.html:14-16`

**Why it matters:** Every user sees fallback system fonts instead of Inter. On Windows this is Times New Roman in older browsers. The carefully tuned letter-spacing and weight choices in the design all assume Inter — the UI degrades visibly. The landing page (which uses system fonts) is unaffected.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src` in the CSP header (vercel.json)
- Add `https://fonts.gstatic.com` to `font-src` in the same header
- Final `font-src` should read: `font-src 'self' https://fonts.gstatic.com;`

---

### 3. AI proxy not wired up — all AI features dead for all signed-in users

**What:** `APP_CONFIG.aiProxy` is an empty string (`index.html:9959`). The `callClaude()` function falls through to the user-key path, and since no user arriving from the landing page has a personal Claude key, every AI action (auto-triage, plan-my-day, reply-to-act, AI workflows) throws a toast: _"Add your Claude API key in Settings to plan your day."_ The `/api/claude.js` proxy is deployed and working — it simply isn't pointed to.

**Where:** `index.html:9959` (`aiProxy: ''`), `api/claude.js`

**Why it matters:** The entire AI value proposition — the core differentiator from a flat to-do app — is invisible to 100% of new signed-in users. The landing page demos "AI that clears your inbox" but the feature silently fails from day one.

**Effort:** S

**Suggested fix:**
- Set `aiProxy: '/api/claude'` in `APP_CONFIG` (relative URL resolves to the same Vercel deployment)
- Alternatively set the full URL: `'https://task-management-beige-eight.vercel.app/api/claude'`
- Verify `ANTHROPIC_API_KEY` is set in the Vercel project environment variables

---

### 4. Session expiry creates a permanent "Sync error" with no recovery path

**What:** When a Supabase refresh token expires, `_sbToken()` throws, `sbSyncNow()` catches it and calls `_sbSetStatus('⚠ ' + e.message)`. The sync pill shows "Sync error — retry" forever. There is no re-auth prompt, no logout button in the pill, and clicking "retry" calls `sbSyncNow()` again which will fail again. The user's data stops syncing silently.

**Where:** `index.html:10022-10026` (`_sbToken`), `index.html:10439` (catch in `sbSyncNow`), `index.html:9984-9985` (`_sbRenderPill`)

**Why it matters:** Users who use the app daily across a week will hit this. Their data diverges silently between devices. No data is lost locally, but the promise of sync is broken without any actionable message.

**Effort:** M

**Suggested fix:**
- In the `sbSyncNow` catch block, detect auth errors (401 or the `not connected`/`invalid_grant` strings) and either call `authLogout()` or show a "Session expired — sign in again" toast with a button
- Add a "Sign in again" action to the sync-error pill state in `_sbRenderPill`
- Guard `_sbToken()` against concurrent calls with an in-flight flag (also fixes the race condition in P2-item-5 below)

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. PostHog key not configured — zero visibility into user behaviour

**What:** `APP_CONFIG.posthogKey` is `''` (`index.html:9960`). The analytics stubs are all in place (`track()` calls throughout, scroll depth, CTA click attribution on the landing), but no events fire. There's no funnel data: no conversion rates, no drop-off points, no feature adoption.

**Where:** `index.html:9960`, `landing.html:701`

**Why it matters:** Can't run a growth loop without knowing where users leave. The landing page comparison table, the hero demo, the multi-step onboarding tour — there's no data on whether any of it works.

**Effort:** S

**Suggested fix:**
- Create a PostHog project (free tier covers 1M events/month)
- Paste the project key into `APP_CONFIG.posthogKey` in `index.html` and into the `POSTHOG_KEY` variable in `landing.html:703`
- Same key on both pages so landing → signup funnel stitches automatically

---

### 6. Hardcoded personal financial and health targets appear for every user

**What:** `renderFinance()` and `renderHealth()` contain hardcoded goal targets: `"goal: 12%"` (body fat), `"goal: €25K"` (annual income), `"goal: €300/mo"` (passive income). These are the owner's personal goals embedded in the render logic, not in the user's data. `_NS_TARGETS` (`index.html:6163`) also hardcodes `{bodyfat:12, income:25000, passive:3600}` used in progress bar calculations.

**Where:** `index.html:5223`, `index.html:5323-5324`, `index.html:6163`

**Why it matters:** Every new user sees Panos's personal goals pre-filled as their progress benchmarks. The Finance and Health views feel like a personal journal belonging to someone else, not a blank slate. This erodes trust and makes the product feel un-shipped.

**Effort:** M

**Suggested fix:**
- Move the numeric targets into `S` state (e.g., `S.healthTargets`, `S.financeTargets`) with sensible defaults that the user sets during onboarding or in settings
- Remove the hardcoded strings from the render functions; replace with `S.healthTargets?.bodyfat ?? '—'`
- Add a quick "Set your targets" prompt on first visit to the Health/Finance views

---

### 7. AI proxy has no per-user rate limiting — open bill exposure

**What:** `/api/claude.js` is an unauthenticated (or session-gated) proxy with no per-user or global request rate limiting. The file itself documents this: _"for production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."_

**Where:** `api/claude.js:12-13`

**Why it matters:** A single bad actor (or a bug in a loop) can run up an unlimited Anthropic bill. At scale, even legitimate usage with no caps could spike costs unpredictably. This is especially acute now that the proxy is being wired up (P0 item 3 above).

**Effort:** M

**Suggested fix:**
- Add Upstash Redis (free tier) for sliding-window rate limiting: 20 calls per user per hour
- Gate on `_SB.uid` from the verified session, not just whether a session exists
- Return `429` with a Retry-After header; the client already handles 429 with a toast

---

### 8. Seed function contains 100+ lines of owner's personal tasks (Greek included)

**What:** `seed()` at `index.html:4532` populates ~80 tasks including personal items: "Battery Fix — check insurance τεχνικός", "Ακτινογραφία στα γόνατα", "245€ in investments from seminaria", "Γενέθλια Σοφίας". This runs for every user in non-hosted mode (`!_hostedMode()`), and is reachable by any developer cloning the repo.

**Where:** `index.html:4532–4800` (the entire `seed()` function)

**Why it matters:** A developer trying to fork or evaluate the codebase gets a confusing dump of someone else's personal life tasks in Greek. If `_hostedMode()` is ever called incorrectly, real users could see these tasks. The "Givelink" business tasks embedded here are also brand-confusing.

**Effort:** M

**Suggested fix:**
- Replace the 80 personal tasks with 8-10 generic, aspirational placeholder tasks (English only)
- Move any real personal tasks to a private local override file that's `.gitignore`d
- Keep the `seededV2` guard so existing local installs aren't re-seeded

---

### 9. Hardcoded Vercel subdomain used in all SEO and social sharing signals

**What:** `_APP_URL` = `'https://task-management-beige-eight.vercel.app/'` is hardcoded at `index.html:10180` and used in the share-card canvas watermark. Both `landing.html` and `index.html` have `<link rel="canonical">` and all OG/Twitter image URLs pointing to this subdomain. Any custom domain change requires a multi-file find-replace with no single source of truth.

**Where:** `index.html:10180`, `index.html:10232`, `landing.html:11-21`, `index.html:24-32`

**Why it matters:** The vercel subdomain is not indexable by most search engines that trust canonicals, and social shares show an ugly URL. Once a real domain is acquired this is a tedious manual update that will likely be missed in a few places.

**Effort:** S

**Suggested fix:**
- Set the domain as a single constant at the top of each HTML file (or via a build step)
- Update `landing.html` canonical and OG tags to the custom domain
- Set `_APP_URL` in `index.html` from the constant, not hardcoded

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. 14 924-line single HTML file — unmaintainable and untestable

**What:** All CSS, all JS (60+ functions, 30+ views, auth, sync, AI, analytics), and all HTML live in one file. A grep for any symbol returns dozens of irrelevant hits. There are no unit tests because there is no module boundary to test against.

**Where:** `index.html` (entire file)

**Why it matters:** Every change risks an accidental global scope collision. PR reviews are meaningless when diffs are 200-line hunks of minified inline CSS. The file already takes ~3 seconds to parse in Chrome DevTools profiler.

**Effort:** L

**Suggested fix:**
- Extract CSS into `app.css`, JS into `app.js` (can still be served statically on Vercel)
- Group JS into modules: `auth.js`, `sync.js`, `ai.js`, `render.js` — even just via `<script src>` tags initially
- The SW already caches individual assets; the split costs nothing in load performance

---

### 11. "Givelink Outreach" hardcoded in the day-planning time blocks

**What:** The "Plan my day" feature (`aiPlanDay`) renders a fixed schedule with a hardcoded time block: `{id:'fp-block-2', time:'11–12pm', icon:'🟣', label:'Givelink Outreach', task:top.find(t=>t.category==='givelink')}`. This appears for every user in their generated day plan.

**Where:** `index.html:4375`

**Why it matters:** Users unrelated to Givelink see a "Givelink Outreach" block in their AI-generated schedule. This is confusing, unprofessional, and makes the product feel like it wasn't built for them.

**Effort:** S

**Suggested fix:**
- Replace the hardcoded label/icon with a generic label like "Focus Block 2" and category filtering based on the user's actual top tasks or goals
- Remove the `givelink`-specific category filter from `top.find(...)`

---

### 12. "Givelink" appears as a global task category for all users

**What:** `CATS` object at `index.html:2503` defines `givelink:{l:'Givelink', e:'🟣'}` as one of eight global task categories. It also appears in `LIFE_AREAS.wealth.cats` at line 2507. Every user sees "Givelink" as a category option when creating or editing tasks.

**Where:** `index.html:2503`, `index.html:2507`

**Why it matters:** Givelink is a specific business venture, not a universal life category. New users see it and don't know what it means. It crowds out a category slot that could be more universally useful (e.g., "Creativity" or "Side project").

**Effort:** S

**Suggested fix:**
- Replace the `givelink` CATS entry with a generic one like `project:{l:'Projects', e:'🚀'}`
- Update `LIFE_AREAS.wealth.cats` to use the new key
- Migrate any existing tasks with `category:'givelink'` to `'project'` in the seeded data

---

### 13. `_sbToken()` has a concurrency race — double refresh on token expiry

**What:** `_sbToken()` checks `Date.now() < _SB.exp - 60000` and calls `_sbAuth('refresh_token', ...)` if false. If two concurrent `callClaude()` calls both check the condition at the same instant when the token is 60 seconds from expiry, both fire a refresh request. The second refresh uses a one-time token that the first call already consumed, causing a 400 from Supabase and a silent sync failure.

**Where:** `index.html:10022-10026`

**Why it matters:** AI features involve multiple concurrent calls (e.g., auto-triage + morning briefing). A single-user refresh race can silently log them out of sync.

**Effort:** S

**Suggested fix:**
- Add an in-flight promise cache: `let _refreshPromise = null; _sbToken = async () => { if(_refreshPromise) return _refreshPromise; ... _refreshPromise = doRefresh(); const t = await _refreshPromise; _refreshPromise = null; return t; }`

---

### 14. Claude API key stored in the synced Supabase state blob

**What:** `S.claudeKey` is part of the main state object `S` (`index.html:2517`). When `save()` is called, the entire `S` object — including `claudeKey` — is pushed to Supabase via `sbPush()`. While RLS ensures only the owner can read it, API keys shouldn't travel in the main data blob.

**Where:** `index.html:2517` (state definition), `index.html:9917` (where it's saved)

**Why it matters:** A future bug in RLS or a sync logic error could expose the key. API keys should be stored separately, ideally in a dedicated `secrets` table or in `localStorage` only (never synced).

**Effort:** M

**Suggested fix:**
- Remove `claudeKey` from `S` and store it only in `localStorage.getItem('taskos_claude_key')` (never sync it)
- Update the few read sites (`S.claudeKey`) to use the localStorage fallback instead

---

## 💡 P3 — Nice to have

### 15. No error boundary on `renderView()` — a bug in one view crashes silently

**What:** `renderView(v)` dispatches to 30+ render functions via an object lookup (`{dashboard:renderDash, health:renderHealth, ...}[v]?.()`). If any render function throws, the exception is swallowed by the optional-chain `?.()` call with no fallback UI.

**Where:** `index.html:2984`

**Why it matters:** A bug in `renderHealth()` shows users a blank white content area with no error message and no way to recover other than navigating away. Hard to diagnose in production.

**Effort:** S

**Suggested fix:**
- Wrap the dispatch in `try { ... } catch(e) { mainEl.innerHTML = '<div class="empty">This view failed to load. Try refreshing.</div>'; console.error(v, e); }`

---

### 16. `manifest-givelink.json` unnecessarily cached by Arete's service worker

**What:** `sw.js:8` caches `manifest-givelink.json` in the Arete STATIC cache. This manifest belongs to the separate Givelink product (`givelink.html`) and is irrelevant to Arete users.

**Where:** `sw.js:8`

**Why it matters:** Minor wasted cache space and a failed fetch during SW install would have been a hard failure before `Promise.allSettled` was added. Conceptually it's a leaky abstraction between two separate products.

**Effort:** S

**Suggested fix:**
- Remove `'./manifest-givelink.json'` from the `STATIC` array in `sw.js`
- Bump the CACHE version

---

### 17. Landing hero demo uses hardcoded example tasks (not adaptive)

**What:** `landing.html:666-669` hardcodes five demo lines ("Finish the Q3 deck", "Call the dentist tomorrow", etc.) and three Top-3 results. These never change and may not resonate with non-English-speaking or non-corporate users.

**Where:** `landing.html:666-669`

**Why it matters:** A/B testing different demo scenarios could meaningfully improve hero conversion. The hardcoded data makes this impossible without a deploy.

**Effort:** M

**Suggested fix:**
- Move the demo data to a JSON array that can be swapped via URL param (`?demo=health` / `?demo=work`) for easy A/B testing
- Track `landing_demo_seen` already fires — add the scenario name to the event properties

---

### 18. Share-card canvas watermarks the vercel subdomain URL

**What:** The social share card generator at `index.html:10232` draws `'Made with Arete · task-management-beige-eight.vercel.app'` directly on the canvas.

**Where:** `index.html:10232`

**Why it matters:** Every shared progress card permanently advertises the ugly subdomain. Fixing P1-item-9 (the `_APP_URL` constant) would fix this too if the canvas text is updated to use that constant.

**Effort:** S

**Suggested fix:**
- Replace the hardcoded string with `_APP_URL` once that's extracted to a constant (see P1-item-9)

---

### 19. `callClaude()` catches all errors and returns `null` — no distinction between network failures and AI errors

**What:** The catch block at `index.html:5033` shows a generic `toast('AI error: ' + e.message)` and returns `null` for any failure: network timeout, auth error, JSON parse failure. All callers do `if(!raw) return;` with no further handling.

**Where:** `index.html:5007-5034`

**Why it matters:** A network timeout looks the same as an invalid API key. Users can't tell whether to retry, sign in again, or check their key. Makes debugging user-reported AI issues hard.

**Effort:** M

**Suggested fix:**
- Differentiate `TypeError` (network) from HTTP errors (key / rate limit)
- For network errors: show "No internet — changes will retry when you're back online" and set `_sbPending=true`
- For 401 on proxy path: prompt re-auth (same as P0-item-4 logic)

---

### 20. `_NS_TARGETS` hardcodes personal health and financial benchmarks

**What:** `index.html:6163` sets `_NS_TARGETS = {bodyfat:12, sleep:85, workout:5, weight:75, income:25000, passive:3600}`. These are used to compute progress bar widths in Life OS stat tiles. They reflect the owner's personal goals, not configurable user targets.

**Where:** `index.html:6163`

**Why it matters:** A user with a 20% body fat goal sees their progress calculated against 12%. Progress bars are inaccurate and feel irrelevant until the user figures out the mismatch — most won't.

**Effort:** M

**Suggested fix:**
- Merge into the `S.healthTargets` and `S.financeTargets` objects proposed in P1-item-6
- Prompt users to set targets on first visit to each Life OS section
- Fall back to the current values as defaults if the user hasn't set anything
