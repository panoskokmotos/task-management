# Arete Improvement Plan
_Generated 2026-07-29 by automated codebase review_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. AI proxy not wired up — all hosted AI features silently fail
- **What**: `APP_CONFIG.aiProxy` is an empty string, so every AI call (auto-triage, plan-my-day, reply-to-act, brain-dump organizer) falls through to "Add your Claude API key in Settings" — even though the serverless proxy is deployed and ready.
- **Where**: `index.html:9959` (`aiProxy: ''`), cross-referenced with `api/claude.js` (the proxy that exists but isn't connected)
- **Why it matters**: The entire product pitch is "AI that plans your day." Every new user hitting the hosted app finds AI completely broken. This directly kills the conversion moment.
- **Effort**: S
- **Suggested fix**:
  - Set `aiProxy: '/api/claude'` in `APP_CONFIG` (or the full Vercel URL if cross-origin)
  - Confirm `ANTHROPIC_API_KEY` is set in Vercel environment variables
  - The auth gate in `api/claude.js` already handles unauthenticated guests gracefully

---

### 2. XSS in Weekly Review wizard — unescaped task/goal titles in innerHTML
- **What**: Three steps of the weekly review wizard inject `t.title` and `g.title` directly into template-literal `innerHTML` without calling `esc()`. A task named `<img src=x onerror=alert(1)>` executes arbitrary JS during the review.
- **Where**: `index.html:3594` (Completed this week panel), `index.html:3601` (Promote from Backlog panel), `index.html:3603` (Goal Progress panel)
- **Why it matters**: While self-XSS from a user's own data is lower severity, shared templates (the PLG feature) could carry payloads across accounts. Also sets a dangerous precedent in a 14k-line codebase.
- **Effort**: S
- **Suggested fix**:
  - Wrap every `${t.title}` and `${g.title}` injection inside those three `innerHTML` blocks with `esc()`
  - Audit `option` select at line `2543` — same pattern: `'>'+t.title.slice(0,45)+'</option>'` without escaping

---

### 3. Push notification icon is a 404 — wrong path in service worker
- **What**: `sw.js` references `./icons/icon-192.png` for push notification icons, but that path doesn't exist. The real icon lives at `./icon-192.png` (no `icons/` subdirectory). Same bug in `index.html` for in-app `new Notification()`.
- **Where**: `sw.js:46-47`, `index.html:11289`
- **Why it matters**: Every push notification (reminders, streaks) shows a broken image icon. On Android PWAs this can also cause notification delivery failures.
- **Effort**: S
- **Suggested fix**:
  - Change `./icons/icon-192.png` → `./icon-192.png` in both `sw.js` (lines 46, 47) and `index.html` (line 11289)

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. PostHog analytics completely dark — both app and landing page
- **What**: `APP_CONFIG.posthogKey` is `''` in `index.html` and `POSTHOG_KEY = ''` in `landing.html`. Every `track()` call is a silent no-op. No funnel data, no conversion events, no AI usage tracking.
- **Where**: `index.html:9960`, `landing.html:700`
- **Why it matters**: You can't iterate on growth or diagnose friction without seeing what users actually do. The code instruments 20+ events that are generating zero data.
- **Effort**: S
- **Suggested fix**:
  - Paste the PostHog project key into both `APP_CONFIG.posthogKey` (index.html) and `POSTHOG_KEY` (landing.html)
  - Verify `posthogHost` matches your PostHog region (EU vs US)

---

### 5. Canonical URL and OG tags point to Vercel staging domain
- **What**: All canonical `<link>`, Open Graph `og:url`/`og:image`, Twitter card, and `schema.org` URLs hardcode `https://task-management-beige-eight.vercel.app/`. If the app serves from a custom domain, every social share and Google index entry points at the wrong URL.
- **Where**: `landing.html:11,16,18,21,24`, `index.html:24-32`
- **Why it matters**: Google splits PageRank between the two URLs. Social previews link to the staging domain. New users land on the wrong origin and might hit auth quirks.
- **Effort**: S
- **Suggested fix**:
  - Replace the Vercel hostname with the production custom domain everywhere (or use a Vercel env var `VITE_BASE_URL` baked in at deploy time)
  - Update `sitemap.xml` and `robots.txt` to match

---

### 6. `showConfirm()` and `toast()` use `innerHTML` — latent XSS sink
- **What**: `showConfirm(msg, …)` sets `confirm-msg.innerHTML = msg` (line 2807) and `toast(msg)` creates a div with `innerHTML = msg` (line 2789). Most callers pass static strings today, but it's one careless `showConfirm('Delete "'+t.title+'"', …)` away from XSS.
- **Where**: `index.html:2789`, `index.html:2807`
- **Why it matters**: The pattern will eventually be misused as the codebase grows. The `esc()` utility already exists; it just isn't applied here.
- **Effort**: S
- **Suggested fix**:
  - Change both functions to use `textContent` for the message portion, or accept an options object with a separate `html` key for the rare cases that genuinely need formatting
  - Search-and-replace existing callers to ensure they pass already-escaped strings

---

### 7. AI features prompt to "add API key" even in hosted mode — misleading UX
- **What**: When `aiProxy` is empty (see P0 #1), users are told "Add your Claude API key in Settings to use AI commands." A new user of a hosted app has no idea what a Claude API key is. This is a dead end.
- **Where**: `index.html:4328`, `5047`, `5111` (three separate AI entry points)
- **Why it matters**: The confusing message makes the product feel broken rather than feature-gated. Users churn thinking AI "doesn't work."
- **Effort**: S (follow-on to P0 #1 — fixing the proxy also fixes the messaging)
- **Suggested fix**:
  - Once `aiProxy` is set, this resolves. But also add a graceful fallback if the proxy returns 503: "AI is temporarily unavailable — try again in a moment" instead of the API-key prompt.

---

### 8. Task title unescaped in `<option>` dependency selector
- **What**: Line 2543 builds `<option>` HTML by concatenating `t.title.slice(0,45)` without HTML encoding. A title containing `"` or `>` can break the option element and potentially close the `<select>` tag early.
- **Where**: `index.html:2543`
- **Why it matters**: Corrupts the task-linking UI for anyone with punctuation-heavy task titles.
- **Effort**: S
- **Suggested fix**:
  - Wrap `t.title.slice(0,45)` in `esc()` in that line

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. No rate limiting on the AI proxy — open Anthropic billing risk
- **What**: `api/claude.js` has a comment "For production add per-user rate limiting (e.g. Upstash)" — but it has never been implemented. A single authenticated account can call Claude in an unbounded loop.
- **Where**: `api/claude.js:12-13` (the comment itself), `api/claude.js:15-49`
- **Why it matters**: Once `aiProxy` is wired up (P0 #1), a misbehaving client or an attacker with a valid session token can drain the Anthropic API budget.
- **Effort**: M
- **Suggested fix**:
  - Add [Upstash Rate Limit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — 20 AI calls per user per day is a reasonable starting limit
  - Fall back to 429 response with a user-friendly message
  - Track overages in PostHog once analytics are live

---

### 10. Third-party API keys (Readwise, Notion) stored in `localStorage`
- **What**: `taskos_readwise_key` and `taskos_notion_key` are stored as plain strings in localStorage. Any XSS on the page can exfiltrate these tokens.
- **Where**: `index.html:9899-9900`, `index.html:9924-9926`, `index.html:10817`, `index.html:10826`
- **Why it matters**: Readwise and Notion tokens are long-lived. Exfiltrating them gives an attacker full read access to the user's reading highlights and Notion workspace.
- **Effort**: M
- **Suggested fix**:
  - Short-term: ensure all XSS vectors are closed (P0 #2, P1 #6) so nothing can read these keys
  - Long-term: route Readwise/Notion calls through the server proxy so the browser never holds raw third-party tokens

---

### 11. Supabase auth tokens in `localStorage` (not httpOnly)
- **What**: `taskos_sb_access` and `taskos_sb_refresh` are stored in localStorage (lines 10017-10018). JWTs in localStorage are accessible to any JavaScript on the page, including XSS payloads.
- **Where**: `index.html:10017-10018`, function `_sbStoreSession`
- **Why it matters**: A successful XSS can steal the refresh token, giving indefinite session access even after the access token expires.
- **Effort**: M
- **Suggested fix**:
  - Supabase's official JS client uses `httpOnly` cookie storage via PKCE — consider switching to `@supabase/ssr` session management which handles this transparently
  - Alternatively, at minimum reduce refresh token lifetime in Supabase project settings

---

### 12. Stale Givelink artifacts still cached by service worker
- **What**: `sw.js` still pre-caches `./givelink.html`, `./manifest-givelink.json`, and `./icon-gl.svg` despite the Givelink product being fully removed in commit `d635c06`. These requests will 404 on every fresh SW install, wasting bandwidth and polluting the cache.
- **Where**: `sw.js:3-18`
- **Why it matters**: Each new user's first load triggers 3 unnecessary network requests that all 404. On slow connections this adds visible delay to the install step.
- **Effort**: S
- **Suggested fix**:
  - Remove `'./givelink.html'`, `'./manifest-givelink.json'`, `'./icon-gl.svg'` from the `HTML` and `STATIC` arrays in `sw.js`
  - Bump the `CACHE` version string after the change

---

### 13. Service worker cache name is a hardcoded date string
- **What**: `const CACHE = 'arete-20260723'` must be manually updated on every deploy to bust the cache. If forgotten, users run stale assets indefinitely.
- **Where**: `sw.js:1`
- **Why it matters**: Stale JS/HTML served from cache causes silent bugs after deploys. The current cache name will never auto-invalidate.
- **Effort**: S
- **Suggested fix**:
  - Inject the cache name at build time: `const CACHE = 'arete-__BUILD_HASH__'` replaced by a Vercel build hook
  - Or use a content-hash from the main JS bundle as the cache key

---

### 14. `index.html` is a 14,924-line, ~1 MB monolith
- **What**: The entire app — CSS, HTML structure, and all JavaScript — lives in one file. There's no bundler, no modules, no component separation.
- **Where**: `index.html` (all of it)
- **Why it matters**: Cannot tree-shake dead code, can't parallelize JS parsing, onboarding new contributors is very high friction, and test coverage is impossible without a build step. At this size, browsers parse the entire file before rendering anything.
- **Effort**: L
- **Suggested fix**:
  - Don't rewrite; extract incrementally: start with `<style>` → `styles.css` and the AI functions → `api-client.js`
  - Add a simple Vite config for the bundling step without restructuring the app logic
  - Set a rule: no new feature lands in the monolith — new features go into separate `.js` modules included via `<script type="module">`

---

## 💡 P3 — Nice to have

### 15. Google OAuth redirect lacks explicit CSRF state parameter
- **What**: `authGoogle()` constructs a redirect URL with no `state` parameter for CSRF protection.
- **Where**: `index.html:10108-10111`
- **Why it matters**: Low severity — Supabase handles OAuth state server-side — but worth noting if Supabase's behavior ever changes.
- **Effort**: S
- **Suggested fix**: Pass `state: crypto.randomUUID()` stored in `sessionStorage`, verify it on redirect return.

---

### 16. Landing page demo animation leaks `setTimeout` handles if user closes the tab early
- **What**: The hero demo loop at `landing.html:673-694` accumulates timers in the `timers` array and clears them on each loop, but never on page unload.
- **Where**: `landing.html:673-694`
- **Why it matters**: Negligible in practice for a static landing page (single-page navigation doesn't apply). Worth fixing if the landing ever becomes a SPA route.
- **Effort**: S
- **Suggested fix**: Add `window.addEventListener('beforeunload', () => timers.forEach(clearTimeout))` in the demo script block.

---

_Items ordered by ROI within each tier. Max 16 items selected from a larger candidate set; items dropped were lower-leverage duplicates or edge cases in rarely-used views._
