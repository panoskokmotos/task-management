# Arete — Improvement Plan

> Generated 2026-09-08. All line numbers reference `index.html` unless noted.
> Max 20 items, ordered by ROI within each tier.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP blocks Google Fonts — Inter not loading in production

- **What**: `vercel.json` CSP is missing `https://fonts.googleapis.com` from `style-src` and `https://fonts.gstatic.com` from `font-src`, so the Inter stylesheet and its font files are blocked by the browser in production.
- **Where**: `vercel.json:15`, `index.html:14-16`
- **Why it matters**: Every user in production sees the system-font fallback (`-apple-system, Segoe UI, sans-serif`) instead of Inter. The app was designed for Inter at specific weights (400–800) and looks noticeably different without it — particularly letter-spacing, weights, and the "Superhuman-caliber" headline typography.
- **Effort**: S
- **Suggested fix**:
  - Add `https://fonts.googleapis.com` to `style-src`
  - Add `https://fonts.gstatic.com` to `font-src`
  - Final `style-src` clause: `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;`
  - Final `font-src` clause: `font-src 'self' https://fonts.gstatic.com;`

---

### 2. Push notification icons point to a non-existent path

- **What**: `sw.js` references `./icons/icon-192.png` for both `icon` and `badge` in push notifications, but there is no `/icons/` subdirectory — icons live at root (`icon-192.png`).
- **Where**: `sw.js:48-49`
- **Why it matters**: Every push reminder notification (the ntfy.sh integration) shows a broken/empty icon, making the app look broken on mobile lock screens.
- **Effort**: S
- **Suggested fix**:
  - Change `'./icons/icon-192.png'` → `'./icon-192.png'` on both lines.

---

### 3. XSS — task and goal titles interpolated unescaped into innerHTML

- **What**: Three `body.innerHTML = ...` calls in the Weekly Review wizard insert `t.title` and `g.title` without calling `esc()`. A task titled `<img src=x onerror=alert(1)>` would execute.
- **Where**: `index.html:3594`, `index.html:3601`, `index.html:3603`
- **Why it matters**: Users who can craft task titles (themselves or via template imports) can inject arbitrary HTML/JS into their own session. In a shared/hosted deployment this is self-XSS only, but it erodes trust and can escalate if multi-user features arrive.
- **Effort**: S
- **Suggested fix**:
  - Wrap every `t.title` and `g.title` in `esc()` on all three lines (the helper already exists at line 11776).
  - Also wrap `t.title` in `<option>` generation at `index.html:2543`.

---

### 4. AI proxy is unauthenticated when `SUPABASE_URL` env var is absent

- **What**: `api/claude.js` skips the Supabase session check when `process.env.SUPABASE_URL` is falsy. If deployed without that env var set, the proxy is open to anyone on the internet.
- **Where**: `api/claude.js:22-31`
- **Why it matters**: Any anonymous request can burn the operator's Anthropic budget. The comment acknowledges no rate limiting; an open proxy compounds this.
- **Effort**: S
- **Suggested fix**:
  - Make auth mandatory, not conditional: always validate the Bearer token. If no Supabase is configured, reject with 401 and log a clear server-side warning.
  - Alternatively, gate on `!!APP_CONFIG.aiProxy` in the client and ensure the server never runs without `SUPABASE_URL`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. 336 interactive `<div>`/`<span>` elements — app is keyboard-inaccessible

- **What**: Grep shows 336 `<div>` and `<span>` tags with `onclick` handlers, but only 1 `tabindex` attribute in the entire file. Task cards, goal cards, nav items, and modal buttons are unreachable by Tab/Enter for keyboard-only users.
- **Where**: `index.html` — pervasive, e.g. `.ni`, `.tc`, `.gc`, `.sc`, `.proc-btn`, `.snooze-opt`
- **Why it matters**: WCAG 2.1 AA requires keyboard operability. Power users (Superhuman-style target audience) use keyboards heavily. App store PWA listings are increasingly penalizing inaccessibility.
- **Effort**: M
- **Suggested fix**:
  - Add `tabindex="0"` and `role="button"` + `onkeydown="if(event.key==='Enter'||event.key===' ')this.onclick(event)"` to interactive divs, or refactor to `<button>` where feasible.
  - Prioritise: nav items (`.ni`), task cards (`.tc`), stat cards (`.sc`), and the FAB dial.
  - Add a skip-to-main-content link at the top.

---

### 6. Share card and OG metadata expose non-branded Vercel URL

- **What**: `_APP_URL` is hardcoded to `https://task-management-beige-eight.vercel.app/` and appears in the share-win canvas text. OG/Twitter tags and the `schema.org` data in `landing.html` also use this URL.
- **Where**: `index.html:10180`, `index.html:10232`, `landing.html:11,16,17,19,21,24,25`
- **Why it matters**: The share card generated for social ("I just hit Inbox Zero 🎉") shows `task-management-beige-eight.vercel.app` as the destination — ugly and non-authoritative. Kills referral loop at the last second.
- **Effort**: S
- **Suggested fix**:
  - Add a `APP_CONFIG.siteUrl` field (or just use the canonical domain).
  - Replace the hardcoded string in `_APP_URL` and the canvas `fillText` call.
  - Update OG/Twitter/schema.org in `landing.html` to the canonical custom domain.

---

### 7. Toast renders raw HTML — user-data could reach it

- **What**: `toast()` uses `el.innerHTML = msg` (line 2789). Callers pass emoji + HTML tags like `<strong>`. If any user-supplied string (goal title, task name) ever reaches `toast()` without escaping, it would execute.
- **Where**: `index.html:2789`
- **Why it matters**: Currently most toast strings are literals, but `toast('AI error: ' + e.message)` (line 5033) forwards a network error message that could contain crafted content from a malicious API response.
- **Effort**: S
- **Suggested fix**:
  - Split into two code paths: use `el.textContent = msg` by default; provide a separate `toastHTML(msg)` for the handful of callers that intentionally pass markup.
  - Or sanitize with a tiny allowlist (only `<strong>`, `<em>`).

---

### 8. `max_tokens` capped at 2000 on the proxy — AI responses truncated

- **What**: `api/claude.js:35` clamps `max_tokens` to 2000. Complex AI features (day planning, notes synthesis, life-score analysis) send prompts that generate responses that can easily exceed this.
- **Where**: `api/claude.js:35`
- **Why it matters**: Users see truncated AI output that ends mid-sentence. The `callClaude` callsites already pass higher limits (`callClaude(prompt, 1500)` is common; some pass 2000 directly); the proxy silently truncates them.
- **Effort**: S
- **Suggested fix**:
  - Raise the proxy cap to `4096` (Haiku supports up to 8192).
  - Consider surfacing a `⚠ Response truncated` notice in `showAiOut` if the stop reason is `max_tokens`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. Stale Givelink artifacts — four dead references post-rebrand

- **What**: Four artefacts from the old Givelink product remain after the Arete rebrand.
- **Where**:
  - `index.html:2517` — `givelinkMetrics` and `givelinkHistory` fields in the `S` state schema
  - `sw.js:4` — `./manifest-givelink.json` in cached static assets
  - `sw.js:16` — `./givelink.html` in cached HTML list
  - `vercel.json:4` — `/givelink` rewrite route → `givelink.html`
- **Why it matters**: `givelinkMetrics` in state is synced to Supabase for every user — wasted storage. The service worker actively fetches and caches `givelink.html` on install, adding payload and potential 404 failures if the file is ever deleted. The `/givelink` route stays live as an orphan.
- **Effort**: S
- **Suggested fix**:
  - Remove `givelinkMetrics` and `givelinkHistory` from `S`; run a one-time migration to strip them from existing localStorage/Supabase data.
  - Remove `manifest-givelink.json` and `givelink.html` from `sw.js` STATIC/HTML lists.
  - Remove the `/givelink` rewrite from `vercel.json` (or redirect it to `/`).

---

### 10. 14,924-line monolithic `index.html` — all logic in a single file

- **What**: The entire app (CSS, HTML, 731 JS functions, 167 async paths) lives in one file. Individual concerns — auth, sync, AI calls, gamification, finance tracker, health logger — are interleaved with no module boundary.
- **Where**: `index.html` (entire file)
- **Why it matters**: Build times are N/A (no build step), but every change requires searching through ~15K lines. Feature work on one subsystem carries hidden risk of touching unrelated code. Incremental rendering is blocked since the browser must parse the full file before paint.
- **Effort**: L
- **Suggested fix**:
  - Adopt a lightweight bundler (Vite + vanilla JS modules) to split `index.html` into feature modules: `auth.js`, `sync.js`, `ai.js`, `render.js`, etc.
  - Not an emergency — but each new feature added increases the cost of the eventual extraction. Draw the line at ~16K lines.

---

### 11. Off-brand hardcoded colors not using CSS design tokens

- **What**: Several color values are hardcoded inline rather than using `var(--...)` tokens:
  - `gold` (CSS keyword, line 244) — top goal border
  - `#ff8fab` (line 710) — board dot for "relationships" category
  - `#ef4444` (lines 847, 1080) — offline pill, checklist overdue badge
  - `#58a6ff` (line 8250) — sleep gap chart bar
  - `BCOLORS` object (line 2515) duplicates `--q1/q2/q3` hex values as magic strings
- **Why it matters**: Inconsistent colors break the theme toggle (light/dark) since hardcoded values don't respond to `:root` variable changes. `gold` is especially jarring in dark mode.
- **Effort**: S
- **Suggested fix**:
  - Replace `gold` with `var(--bm)` (amber/warm tone), `#ef4444` with `var(--q1)`, `#ff8fab` with `var(--cb)` (pink token).
  - Rewrite `BCOLORS` to reference CSS variable values from a JS `getComputedStyle` call so they stay in sync with theme.

---

### 12. Silent swallowed errors via `catch(e){}` — 30+ instances

- **What**: At least 30 `catch(e){}` blocks discard errors silently. Key ones: auth callback (`index.html:10374`), sync after login (`index.html:10381`), template application (`index.html:10134`).
- **Where**: `index.html` — pervasive
- **Why it matters**: When something fails silently (e.g. template not applied, sync skipped), the user sees no feedback and the bug is invisible in production.
- **Effort**: M
- **Suggested fix**:
  - At minimum, add `console.warn(e)` inside the empty blocks so errors surface in devtools.
  - For the critical paths (auth, sync, template apply), replace silent swallows with a `toast('Something went wrong — reload to retry')`.

---

## 💡 P3 — Nice to have

### 13. PostHog key not configured — no product analytics

- **What**: `APP_CONFIG.posthogKey` is an empty string; analytics are entirely disabled.
- **Where**: `index.html:9960`
- **Why it matters**: Without event data (signup, first_win, guest_started, etc.) there is no funnel visibility. Track calls exist throughout the codebase but fire into a void.
- **Effort**: S
- **Suggested fix**: Create a PostHog project, paste the key. The tracking calls are already wired.

---

### 14. No rate limiting on the Claude API proxy

- **What**: `api/claude.js` acknowledges in a comment that per-user rate limiting is missing. A single signed-in account can call the proxy indefinitely.
- **Where**: `api/claude.js:12`
- **Why it matters**: One power user or bad actor can run up the operator's Anthropic bill. Low risk while user base is small; grows linearly with growth.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (10 req/min per `_SB.uid`) using the `@upstash/ratelimit` package — it's the canonical solution for Vercel serverless.

---

### 15. Service worker caches stale Givelink manifest unnecessarily

- **What**: `manifest-givelink.json` is included in the service worker's static cache list even though it is not used anywhere in the current app.
- **Where**: `sw.js:4`
- **Why it matters**: Wastes ~1KB of cache quota and a network request on every fresh SW install. Confuses anyone reading the codebase about which manifest is authoritative.
- **Effort**: S
- **Suggested fix**: Remove the entry from `STATIC` (this overlaps with item 9 but is noted independently for tracking).

---

*End of plan — 15 items across 4 tiers.*
