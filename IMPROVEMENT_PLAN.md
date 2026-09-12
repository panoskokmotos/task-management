# Givelink · Task OS — Improvement Plan
> Generated 2026-09-12 by automated codebase audit

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `givelink.html` crashes on corrupted localStorage data
- **What**: `load()` calls `JSON.parse(d)` with no try/catch — a single corrupted byte in `givelink_sprint` key wipes out the entire app for that user.
- **Where**: `givelink.html:453`
- **Why it matters**: All sprint data is localStorage-only. One bad write (disk full, browser crash mid-save) permanently breaks the app for that user with no recovery path.
- **Effort**: S
- **Suggested fix**:
  - Wrap in `try { … } catch(e) { console.warn('Corrupt givelink data', e); }` — let it fall back to the default `S`
  - Optionally show a one-time toast warning the user their data was reset

---

### 2. Push notification icon is a 404
- **What**: Service worker references `./icons/icon-192.png` for notification icon/badge, but the `icons/` directory does not exist — files live at root (`./icon-192.png`).
- **Where**: `sw.js:47`, `sw.js:49`
- **Why it matters**: Every push notification fires with a broken icon. On Chrome Android this shows the "broken image" placeholder; some browsers silently drop the notification entirely.
- **Effort**: S
- **Suggested fix**:
  - Change `./icons/icon-192.png` → `./icon-192.png` on both lines
  - Consider using `./icon-gl.svg` as the badge for Givelink-specific notifications

---

### 3. `aiProxy` is unconfigured — all AI features require user's own API key
- **What**: `APP_CONFIG.aiProxy` is set to `''` in `index.html`, so every AI call in Task OS falls through to the direct Anthropic path, gating all AI features behind users having their own `sk-ant-` key.
- **Where**: `index.html:9959` (`aiProxy: ''`), `api/claude.js` (proxy exists but URL never wired)
- **Why it matters**: The proxy infrastructure (`api/claude.js`) is deployed on Vercel but unused. Every AI button (Plan Day, Auto-Triage, CMDK AI) silently fails or shows "Add your Claude API key in Settings" — dead on arrival for new users.
- **Effort**: S
- **Suggested fix**:
  - Set `aiProxy: '/api/claude'` in `APP_CONFIG`
  - Confirm `ANTHROPIC_API_KEY` env var is set in Vercel project settings
  - Guard with a per-user rate limit (Upstash or simple IP-based token bucket) before enabling for all users

---

### 4. Givelink AI calls Anthropic directly from the browser — bypasses proxy entirely
- **What**: `runAiSprintPlanner()` and `callClaudeGL()` call `https://api.anthropic.com/v1/messages` directly with the user's API key stored in localStorage, ignoring the proxy entirely.
- **Where**: `givelink.html:1200`, `givelink.html:1333`
- **Why it matters**: (a) The API key is exposed in localStorage to any JS on the page. (b) Without the proxy, Givelink AI features are dead for users who don't have a personal key. (c) Costs are borne by the user, not the app — friction kills the feature.
- **Effort**: M
- **Suggested fix**:
  - Replace `callClaudeGL` body to call `/api/claude` with a Bearer token if the user is signed in (same pattern as `callClaude` in `index.html`)
  - Fall back to `S.claudeKey` only if proxy is unavailable
  - Remove `'anthropic-dangerous-direct-browser-access': 'true'` header once proxy is live

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. API key collection via `window.prompt()` is a conversion killer
- **What**: When no API key is found, `callClaudeGL` calls `window.prompt('Enter Anthropic API key:')` — a browser modal that blocks the page, looks like a phishing attack, and has no clear UX for where to get the key.
- **Where**: `givelink.html:1330`
- **Why it matters**: Every first-time user who clicks an AI feature hits a browser-native prompt with zero branding or guidance. Most will dismiss and assume the feature is broken.
- **Effort**: S
- **Suggested fix**:
  - Remove the `window.prompt` fallback
  - If key is missing AND proxy is unavailable, show an inline toast: "Add your Anthropic API key in Task OS → Settings → AI"
  - `callClaudeGL` already reads from `taskos.claudeKey` — that path is sufficient once users know where to set it

---

### 6. Hardcoded stale sprint dates mean every new user lands on an expired sprint
- **What**: The default `S.sprint` object has `start:'2026-03-28'` and `end:'2026-04-11'` — dates that are 5 months in the past for anyone loading the app now.
- **Where**: `givelink.html:442`
- **Why it matters**: New users see "–22 days left" in the sprint banner immediately, the sprint progress bar is 100%, and the burndown shows nothing. The first impression is that the app is broken.
- **Effort**: S
- **Suggested fix**:
  - Compute defaults dynamically: `start: today`, `end: today + 14 days` (in the state initializer or in `load()` when no saved data exists)

---

### 7. Burndown chart doesn't update when tasks are completed via the edit modal
- **What**: `_recordSnapshot()` is called inside `toggleDone()` (checkbox) but not inside `saveTask()` (modal save). Completing a task via the edit form doesn't update the burndown.
- **Where**: `givelink.html:779` (`saveTask`), `givelink.html:806` (`toggleDone`)
- **Why it matters**: Most users edit task status in the modal. The burndown silently lags behind, making it look like progress isn't being tracked even when work is getting done.
- **Effort**: S
- **Suggested fix**:
  - Call `_recordSnapshot()` inside `saveTask()` after the task status update, before `save()`
  - Or call it inside `refresh()` once per unique calendar day

---

### 8. Week view grid collapses to 2 columns on mobile only at render time — doesn't respond to resize
- **What**: The 7-column week grid checks `window.innerWidth < 600` once when `renderWeekPlan()` runs, then sets `gridTemplateColumns` via inline style — no resize listener.
- **Where**: `givelink.html:682–685`
- **Why it matters**: Rotating the phone from portrait to landscape (or resizing a browser window) leaves the grid stuck in 2-column layout even when 7 columns fit.
- **Effort**: S
- **Suggested fix**:
  - Remove the JS breakpoint check entirely
  - Add a CSS rule: `@media(max-width:600px){#v-week [style*="grid-template-columns:repeat(7"]{grid-template-columns:1fr 1fr!important;}}`

---

### 9. `syncToTaskOS` matches by title only — silently breaks on same-name tasks and misses in-progress work
- **What**: The sync function matches Givelink tasks to Task OS tasks using case-insensitive title comparison. It only syncs (a) completed sprint tasks, (b) all backlog items. In-progress tasks are not synced.
- **Where**: `givelink.html:1292`, `givelink.html:1303`
- **Why it matters**: If two tasks share a title (e.g. "Write email"), the wrong Task OS task gets marked done. More importantly, Task OS never knows what you're actively working on in Givelink — the whole point of the Sync button is broken.
- **Effort**: M
- **Suggested fix**:
  - Add a `givelinkId` field when pushing new tasks to Task OS on first sync; use ID matching on subsequent syncs
  - Include `in-progress` sprint tasks in the sync, updating their status in Task OS too

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `callClaudeGL` in givelink duplicates `callClaude` from index.html with worse error handling
- **What**: Two separate Claude caller implementations — `callClaudeGL` (givelink) and `callClaude` (index.html). `callClaudeGL` doesn't check `res.ok` before calling `res.json()`, so API errors (429, 401) silently swallow the actual error message.
- **Where**: `givelink.html:1325–1341`, `index.html:5006–5033`
- **Why it matters**: A 429 rate-limit or an expired API key shows a vague `SyntaxError` or silent null — no actionable feedback. Also means every improvement to one caller must be manually copied to the other.
- **Effort**: M
- **Suggested fix**:
  - In `callClaudeGL`, add: `if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.error?.message||res.statusText);}`
  - Long-term: share a single `callClaude` utility (extract to a `claude-utils.js` once files are separated)

---

### 11. `index.html` is 14,926 lines; `givelink.html` is 1,829 lines — both single-file monoliths
- **What**: All CSS, HTML, and JavaScript — including multiple distinct features (CRM, AI planner, weekly review wizard, habit tracker) — lives in single HTML files with no build step.
- **Where**: `index.html` (whole file), `givelink.html` (whole file)
- **Why it matters**: Every edit requires full-file context. Even with search/grep, finding related code across a 15k-line file takes minutes. There's no way to unit-test any function in isolation.
- **Effort**: L
- **Suggested fix**:
  - Don't rewrite; instead, extract the CSS to a `styles.css` and JS to a `app.js` loaded via `<script src="...">` — a 2-day refactor that unlocks linting, formatting, and eventual module splitting
  - Givelink is small enough (1,829 lines) to do first as a proof-of-concept

---

### 12. `_recordSnapshot` function exists but is only triggered by checkbox clicks
- **What**: The burndown snapshot mechanism only fires when a user toggles the checkbox. If the sprint wraps or tasks are changed via bulk imports/syncs, the burndown data is never recorded.
- **Where**: `givelink.html:812–821`, `givelink.html:802–806`
- **Why it matters**: Sparse or missing snapshot data causes the burndown to show "Complete tasks to see burndown progress" even when the sprint is half done.
- **Effort**: S
- **Suggested fix**:
  - Record a snapshot on every `save()` call (debounced or at most once per hour via timestamp check), not only on checkbox clicks
  - At minimum, call `_recordSnapshot()` in `saveTask()` when `d.status === 'done'`

---

## 💡 P3 — Nice to have

### 13. Brand colors are inconsistent between Task OS and Givelink
- **What**: `givelink.html` uses `--accent:#3b82f6` (blue), while `index.html` uses `--brand:#8272f2`/`--brand2:#a385ee` (purple). Neither matches the stated brand palette (`#6B3FA0`/`#5718CA`). The two apps look like different products.
- **Where**: `givelink.html:17` (`--accent:#3b82f6`), `index.html:46` (`--brand:#8272f2`)
- **Why it matters**: Users switching between Task OS and Givelink get whiplash. Blue-accented Givelink doesn't read as "the same product family" as the purple Task OS. Weakens brand recognition.
- **Effort**: S
- **Suggested fix**:
  - Update `givelink.html`'s `--accent` to match `index.html`'s `--brand:#8272f2` (or the canonical `#5718CA`) — a one-line CSS change
  - Long-term: extract a `brand-tokens.css` shared by both files

---

### 14. `vercel.json` rewrites `"/"` to `landing.html` but has no `/app` or `/dashboard` route for the main app
- **What**: The root URL shows the landing page; users who want the app must navigate to `/index.html` directly. There's no clean `/app` route.
- **Where**: `vercel.json:3`
- **Why it matters**: Sharing the app URL means sharing `/index.html` — ugly and breaks if the file is ever renamed. The landing page becomes a dead end for returning users.
- **Effort**: S
- **Suggested fix**:
  - Add `{ "source": "/app", "destination": "/index.html" }` to rewrites
  - Update all internal links to use `/app`

---

### 15. Service worker cache key (`arete-20260723`) is a manual date stamp — cache will never bust automatically
- **What**: The SW cache is named `arete-20260723` — a date hardcoded to July 2023. New deploys won't bust old caches unless the developer manually bumps this string.
- **Where**: `sw.js:1`
- **Why it matters**: Users on old cached versions won't pick up fixes unless they manually clear site data. This especially matters for bug fixes shipped in P0 above.
- **Effort**: S
- **Suggested fix**:
  - Inject the cache key with the deploy hash at build time (e.g. via a Vercel build step or a script tag that sets `window.SW_VERSION`)
  - Or use a date-based auto-bump: `const CACHE = 'arete-' + new Date().toISOString().slice(0,10).replace(/-/g,'');` and update at each deploy

---

*Max items reached (15/20). Items excluded from this cut: mobile bottom nav missing CRM and Past Sprints links; `openCloseSprint` doesn't guard against empty sprint name on new sprint; `renderWeekPlan` builds 7-column HTML string with no `key` prop and fully re-renders on every nav — janky scroll position reset.*
