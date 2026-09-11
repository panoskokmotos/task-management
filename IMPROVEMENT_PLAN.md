# Improvement Plan — Arete (task-management)

Generated: 2026-09-11

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Claude API key synced to Supabase cloud in plaintext
- **What**: `S.claudeKey` is stored inside the main state object `S`, which `sbPush()` serialises and uploads verbatim to Supabase.
- **Where**: `index.html:9917` (key written into `S`), `index.html:10408` (`S` pushed wholesale), `index.html:10396–10410` (`sbPush`)
- **Why it matters**: Every user who enables cloud sync is silently uploading their Anthropic API key to your Supabase database. A DB leak, a misconfigured RLS rule, or a rogue admin query exposes every key at once.
- **Effort**: S
- **Suggested fix**:
  - Strip `S.claudeKey` before pushing: `const {claudeKey, ...toSync} = S; upload(toSync)`.
  - Store the key only in `localStorage` (`taskos_claudeKey`), never in `S`.
  - Migrate existing users silently: on load, if `S.claudeKey` is populated, move it to `localStorage` then delete it from `S` and save.

---

### 2. `aiAutoTriage` and `aiPlanDay` leak their `_aiLock` on error
- **What**: Both functions call `_aiUnlock()` in the happy-path only; if `callClaude()` throws, the lock is never released, permanently disabling those features until the user reloads.
- **Where**: `index.html:5048–5060` (`aiAutoTriage`), `index.html:5126–5136` (`aiPlanDay`)
- **Why it matters**: Any network hiccup, timeout, or 5xx from the API leaves "Plan my day" and "Triage Inbox" silently dead for the rest of the session with no visible error.
- **Effort**: S
- **Suggested fix**:
  - Wrap both function bodies in `try { … } finally { _aiUnlock('key'); }`.
  - Same pattern already used correctly in `aiRelNudge`, `aiSequenceTasks`, etc — follow that.

---

### 3. Content-Security-Policy blocks Google Fonts
- **What**: `index.html` and `landing.html` load Inter from `fonts.googleapis.com` and `fonts.gstatic.com`, but the CSP in `vercel.json` lists neither in `style-src` or `font-src`.
- **Where**: `vercel.json:15` (CSP header), `index.html:14–16` (font link tags)
- **Why it matters**: On any browser that enforces CSP, the stylesheet fetch is blocked → the app falls back to system fonts. The UI looks wrong and the brand gradient text on the splash may render incorrectly.
- **Effort**: S
- **Suggested fix**:
  - Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` in the CSP.
  - Alternatively, self-host Inter (already loaded at `font-weight:400;500;600;700;800`) via a build step to remove the external dependency entirely.

---

### 4. Hardcoded "Panos" name shown to new users before profile load
- **What**: The dashboard greeting and AI prompts default to "Panos" at three points instead of the user's actual name.
- **Where**: `index.html:1070` (HTML default greeting), `index.html:2519` (`profileName` default), `index.html:11524`, `11810`, `12666` (AI prompts hardcoded to "Panos")
- **Why it matters**: Any new user who signs up sees "Good morning, Panos 👋" before they set their name. AI-generated messages (relationship nudges, content strategy) also address them as "Panos", making the app feel broken or private to one person.
- **Effort**: S
- **Suggested fix**:
  - Change default in `profileName` fallback to a neutral value: `localStorage.getItem('taskos_name') || 'there'`.
  - Replace hardcoded "Panos" in AI prompts with `${getAboutMe()||'the user'}` or `${profileName}` (already used elsewhere in the file).

---

### 5. `aiAutoTriage` and `aiPlanDay` lock never acquired if user exits early
- **What**: In `aiAutoTriage`, the check for an empty inbox `return`s *before* acquiring the lock, but also before calling `callClaude` — this is fine. However, in `aiPlanDay`, the guard `if(!scored.length)` at line 5125 returns before `_aiLock`, which is correct. The real risk is that if `callClaude` returns `null` (network failure), `_aiUnlock` is still called (line 5060/5136), releasing a lock that should no longer gate the next call. This is safe but inconsistent; see P0-2 for the actual deadlock path.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. No AI proxy configured — self-serve key flow is a conversion killer
- **What**: `APP_CONFIG.aiProxy` is empty (`index.html:9959`); every new user must paste their own Anthropic API key in Settings to access AI features.
- **Where**: `index.html:9959`, `index.html:5007–5033` (`callClaude`)
- **Why it matters**: Asking users to get their own API key before they can try the headline AI features (Plan my day, Triage inbox) is a hard conversion wall. Guest mode lets users try the app, but AI is the differentiator.
- **Effort**: S (backend is already written in `api/claude.js`)
- **Suggested fix**:
  - Deploy `api/claude.js` to Vercel and set `ANTHROPIC_API_KEY` as an env var.
  - Set `aiProxy: '/api/claude'` in `APP_CONFIG`.
  - The Supabase auth guard in the proxy already limits to signed-in users.

---

### 7. Hardcoded owner-specific seeded goals/tasks shown to all new users
- **What**: `seed()` and `seedGoals()` populate new accounts with personal Givelink business goals, SF move milestones, and specific nonprofit outreach tasks.
- **Where**: `index.html:4532–4610` (`seed` function, tasks like "Nonprofits Board Follow Ups", "Dex CRM"), `index.html:4924–4980` (`seedGoals`, goals like "Financial Independency w/ Givelink")
- **Why it matters**: New users see someone else's life goals as their starting data, which is deeply confusing and erodes trust. Comment at line 10660 says "don't seed for hostedMode" but the check is only for `_hostedMode()` — any self-hosted or guest user sees owner data.
- **Effort**: M
- **Suggested fix**:
  - Replace the owner-specific seed data with the generic `_seedStarter()` call already written at `index.html:10443–10453`.
  - Remove or gate the owner-specific `seed()`/`seedGoals()` behind a dev-only flag.

---

### 8. Guest-to-signup conversion nudge fires once then never again
- **What**: The guest nudge is gated on `taskos_guest_nudged` in localStorage and never shown again once dismissed.
- **Where**: `index.html:2587`, `index.html:2595` (nudge guard)
- **Why it matters**: Users who dismiss the first nudge are never reminded again, even after adding significant data. The guest save CTA in the sidebar chip exists but is easy to miss.
- **Effort**: S
- **Suggested fix**:
  - Re-show the nudge after the user completes 5 tasks or adds 3 goals (meaningful engagement signal).
  - Add a small unobtrusive banner at the top of the Today view after 3 days as guest.

---

### 9. Notion API call blocked by CSP
- **What**: The Notion integration fetches from `https://api.notion.com` but the `connect-src` CSP only allows `https://api.notion.com` — wait, it does include it. However the Notion API requires a `Notion-Version` header and uses CORS; direct browser calls will fail because the Notion API does not support browser CORS requests without a proxy.
- **Where**: `index.html:10940–10956` (`notionFetch`)
- **Why it matters**: The Notion integration will silently fail for all users — no proxy, and Notion's CORS policy blocks direct browser requests.
- **Effort**: M
- **Suggested fix**:
  - Add a `/api/notion.js` serverless function as a thin proxy (similar to `/api/claude.js`).
  - Or document clearly in Settings that this feature requires the user to deploy their own proxy.

---

### 10. The "Plan my day" modal shows time blocks from 9am even at 3pm
- **What**: `aiPlanDay` passes `hour` to Claude (line 5128) but the prompt instructs it to "propose an ordered schedule of at most 6 items" with example times of "9–11am", which Claude echoes back regardless of time of day.
- **Where**: `index.html:5128–5134`
- **Why it matters**: At 3pm the AI suggests "9am deep work" — the plan is useless and makes the AI feel broken.
- **Effort**: S
- **Suggested fix**:
  - Strengthen the prompt: `It is currently ${hour}:${min}. Only suggest time blocks from now onwards.`
  - Filter out any returned time blocks that are already past when rendering `_renderPlanModal`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Single 14,924-line HTML file — no modularity
- **What**: The entire app (HTML, 437+ functions, ~8000 lines of JS, all CSS) lives in one file with no build step, imports, or modules.
- **Where**: `index.html` (entire file)
- **Why it matters**: Any edit risks introducing syntax errors with no linting, no tree-shaking, no dead-code elimination. Functions like `renderGivelinkDash` at line 8618 persist even though the Givelink product was supposedly separated in commit `d635c06`.
- **Effort**: L
- **Suggested fix**:
  - Introduce a minimal Vite build (zero-config for vanilla JS) to split into feature modules.
  - Start with extracting the ~1000-line Supabase sync section and the ~900-line AI section as separate files.
  - Don't attempt a full rewrite — extract one module per sprint.

---

### 12. Givelink product artifacts not fully removed after separation
- **What**: Despite commit #73 removing Givelink from Task OS, `givelink.html`, `manifest-givelink.json`, `icon-gl.svg`, `renderGivelinkDash`, `CATS.givelink`, the Givelink sidebar nav item, and seed data still exist.
- **Where**: `sw.js:16` (caches `givelink.html`), `vercel.json:4` (routes `/givelink`), `index.html:8618` (`renderGivelinkDash`), `index.html:2503` (`CATS`), `index.html:9569` (nav entry), `index.html:4375` (day planner Givelink block)
- **Why it matters**: Dead code confuses contributors; the `/givelink` route still serves a fully functional sprint board that isn't linked from anywhere; the service worker caches the file unnecessarily.
- **Effort**: M
- **Suggested fix**:
  - Remove `givelink.html`, `manifest-givelink.json`, `icon-gl.svg` from the repo.
  - Delete the `/givelink` rewrite from `vercel.json` and the cache entry from `sw.js`.
  - Remove `renderGivelinkDash` and the `givelink-dash` nav entry from `index.html`.
  - Replace `CATS.givelink` with `CATS.work` or `CATS.business`.

---

### 13. `aiAutoTriage` unlocks before checking `callClaude` result
- **What**: The lock is released at line 5060 before `arr` is validated, so a malformed response leaves the UI in an inconsistent partially-applied triage state.
- **Where**: `index.html:5060–5073`
- **Why it matters**: If Claude returns garbled JSON, the toast fires but the modal doesn't open — the user sees a toast error but can't retry without reloading (lock is released, so they can retry, but the UI state is dirty).
- **Effort**: S
- **Suggested fix**: Move `_aiUnlock` into `finally` block; clear `_triageProposals` on error before unlocking.

---

### 14. No per-user rate limiting on the Claude proxy
- **What**: `api/claude.js` has no rate limiting — any authenticated user can make unlimited Anthropic API calls.
- **Where**: `api/claude.js:12–13` (comment acknowledges this)
- **Why it matters**: A single active user running repeated AI features (or a compromised token) could run up significant Anthropic bills with no circuit breaker.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (free tier covers low-traffic apps): 10 requests/user/minute.
  - Or use a simple Vercel KV count with a 24h TTL and a daily cap (e.g. 50 AI calls/user/day).

---

### 15. Readwise and Notion API tokens stored in localStorage without encryption
- **What**: Third-party API tokens (`taskos_readwise_key`, `taskos_notion_key`) are stored as plaintext in localStorage.
- **Where**: `index.html:9923–9926` (save), `index.html:10817` (load)
- **Why it matters**: Any XSS vulnerability (the app uses `innerHTML` in many places) could exfiltrate these tokens. localStorage is also accessible to any script on the origin.
- **Effort**: M
- **Suggested fix**:
  - Short-term: at minimum, mask the displayed values (already done with `type="password"` inputs).
  - Medium-term: encrypt tokens with a session-derived key before localStorage storage, or store server-side via Supabase.

---

## 💡 P3 — Nice to have

### 16. `profileName` fallback "Panos" duplicated in AI prompt strings
- **What**: Several AI prompt strings hardcode "Panos" instead of using `${profileName}` — easy grep-and-fix.
- **Where**: `index.html:11524`, `11810`, `12187`, `12666`, `12945`, `13111`
- **Why it matters**: Makes AI output feel non-personalized for any user who isn't the owner.
- **Effort**: S
- **Suggested fix**: Global replace `Panos` (in prompt strings only) with `${profileName}`.

---

### 17. PostHog analytics not wired up — no product data
- **What**: `APP_CONFIG.posthogKey` is empty, so all `track()` calls are no-ops. The app fires events for every key user action but none are recorded.
- **Where**: `index.html:9960`
- **Why it matters**: Without analytics, there's no way to know which features drive retention, where users drop off, or whether the guest-to-signup funnel is working.
- **Effort**: S
- **Suggested fix**: Create a free PostHog project, paste the project API key into `APP_CONFIG.posthogKey`.

---

### 18. Service worker cache version is date-stamped manually
- **What**: `sw.js:1` has `const CACHE = 'arete-20260723'` — must be manually updated on each deploy or the SW serves stale assets.
- **Where**: `sw.js:1`
- **Why it matters**: If a deploy goes out without updating this string, users on PWA will see the old version indefinitely until they clear cache.
- **Effort**: S
- **Suggested fix**: Generate the cache name at build time (e.g. inject a git commit hash via Vercel's `VERCEL_GIT_COMMIT_SHA` env var) or use Workbox for cache versioning.

---

### 19. `innerHTML` used for rendering without consistent XSS sanitisation
- **What**: Many render functions set `el.innerHTML = ...` using `esc()` for user strings, but some places interpolate task titles or goal names without escaping.
- **Where**: `index.html:5082` (`esc(p.title)` — good), but check `renderGoals`, `renderDash` for unescaped goal titles in headlines
- **Why it matters**: A task title containing `<script>` or `<img onerror=...>` could execute arbitrary JS and exfiltrate localStorage (including API keys and session tokens).
- **Effort**: M
- **Suggested fix**: Audit all `innerHTML` assignments; replace unescaped interpolations with `esc()`. Consider adopting `DOMPurify` for rich-text fields.

---

### 20. The `today` view greeting reads from HTML static text until JS loads
- **What**: The `<h1 id="greeting">Good morning, Panos 👋</h1>` is in the static HTML and stays visible until JS overwrites it.
- **Where**: `index.html:1070`
- **Why it matters**: On slow connections users see "Good morning, Panos" for 1-3 seconds before the correct name replaces it — a jarring flash.
- **Effort**: S
- **Suggested fix**: Set the `<h1>` content to an empty string or a non-personalized placeholder (`<h1 id="greeting">Good morning 👋</h1>`) in HTML; let JS populate it on load.
