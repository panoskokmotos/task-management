# Givelink — Improvement Plan
> Generated: 2026-09-08

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icons are 404
- **What**: Service worker references `./icons/icon-192.png` for push notification icons, but the actual asset lives at `./icon-192.png` (no `icons/` subdirectory).
- **Where**: `sw.js:47–48`
- **Why it matters**: Any push notification shows a broken icon, which looks unprofessional and erodes trust at the moment of highest re-engagement.
- **Effort**: S
- **Suggested fix**:
  - Change `'./icons/icon-192.png'` → `'./icon-192.png'` in both the `icon` and `badge` fields of `showNotification()`.
  - Confirm the asset path by checking the STATIC array at `sw.js:3–12`.

---

### 2. `load()` crashes the entire app on corrupted localStorage
- **What**: `JSON.parse(d)` in `load()` has no error boundary — any malformed localStorage entry throws an uncaught exception and leaves the app blank.
- **Where**: `givelink.html:448`
- **Why it matters**: Any user whose storage gets corrupted (browser bug, partial write, quota error) sees a broken blank screen with no recovery path.
- **Effort**: S
- **Suggested fix**:
  - Wrap `JSON.parse(d)` in try/catch and fall back to the default `S` object on error.
  - Optionally show a toast: "Couldn't load saved data — starting fresh."

---

### 3. Anthropic API key exposed in direct browser-to-API calls
- **What**: Both `runAiSprintPlanner()` and `callClaudeGL()` call `https://api.anthropic.com/v1/messages` directly from the browser, using a key stored in localStorage and the `anthropic-dangerous-direct-browser-access` header — bypassing the serverless proxy in `api/claude.js`.
- **Where**: `givelink.html:1131–1143` (`runAiSprintPlanner`), `givelink.html:1264–1271` (`callClaudeGL`)
- **Why it matters**: The API key is visible in DevTools Network tab and readable by any XSS. A single compromised key can rack up a large Anthropic bill. The proxy was built specifically to avoid this.
- **Effort**: M
- **Suggested fix**:
  - Route all Claude calls in `givelink.html` through `/api/claude` instead of directly to Anthropic.
  - Drop the `anthropic-dangerous-direct-browser-access` header and the key exposure entirely.
  - Remove `getApiKey()` / the localStorage API-key prompts for givelink users — the proxy handles auth.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. AI features are gated behind a raw API key prompt
- **What**: When a user clicks "AI Sprint Planner" or "Standup", `getApiKey()` calls `window.prompt('Enter your Anthropic API key:')` if no key is found — a jarring modal asking for a developer credential that most users don't have.
- **Where**: `givelink.html:1075–1088` (`getApiKey`), `givelink.html:1259–1262` (`callClaudeGL`)
- **Why it matters**: This is a hard conversion wall. Non-technical founders will abandon the feature immediately. The proxy in `api/claude.js` already exists to remove this friction; it just isn't wired up.
- **Effort**: M
- **Suggested fix**:
  - Route AI calls through `/api/claude` (fixes P0/3 above) and remove the key-prompt flow.
  - If a Supabase auth token is available, forward it as the `Authorization` header so the proxy gates access to signed-in users only.
  - Remove `getApiKey()` and the `taskos_api_key` localStorage entry entirely.

---

### 5. Mobile navigation missing CRM and Past Sprints
- **What**: The bottom navigation bar shows only 5 views (Overview, Growth, Product, Execute, Backlog). CRM and Past Sprints have no bottom nav entry — mobile users can only reach them by opening the hamburger sidebar.
- **Where**: `givelink.html:307–312` (`.bnav`), `givelink.html:155–175` (mobile CSS)
- **Why it matters**: CRM is one of the app's core features. On mobile — the likely primary device for founders doing field outreach — it's two taps away from an awkward slide-out menu, not the nav.
- **Effort**: S
- **Suggested fix**:
  - Replace a lower-priority bottom nav item (e.g. "Execute") with "CRM" on mobile, or switch to a scrollable bottom nav that shows all 7 items.
  - Alternatively add CRM as a centered FAB-style shortcut on the CRM overview.

---

### 6. Burndown chart invisible for the first calendar day of every sprint
- **What**: `renderBurndown()` returns an empty placeholder state if `snapshots.length < 2`. Since snapshots are only recorded when tasks are toggled, the chart is invisible for the entire first day of a sprint.
- **Where**: `givelink.html:754–758`
- **Why it matters**: New sprint → no burndown → users assume the feature is broken. It undermines confidence in the app during the most important day (sprint kickoff).
- **Effort**: S
- **Suggested fix**:
  - Seed an initial snapshot at sprint creation time (in `confirmNewSprint()`) with `done=0, total=tasks.length` so the baseline always exists.
  - The burndown then renders from day 1 with a single starting point.

---

### 7. Givelink uses blue instead of brand purple throughout
- **What**: `givelink.html` uses `#3b82f6` (blue) as its accent/primary color — `--accent`, theme-color meta, logo text, FAB, progress bars, active nav indicator. The Givelink/Arete brand palette is purple (`#6B3FA0` / `#5718CA` / `#8272f2`).
- **Where**: `givelink.html:17` (`--accent:#3b82f6`), `givelink.html:6` (`theme-color`), and every element using `var(--accent)`.
- **Why it matters**: Users who switch between Task OS (purple) and Givelink (blue) see two different brand identities. The givelink.html was never rebranded when the project moved to the Arete/Givelink purple palette (commit #81).
- **Effort**: M
- **Suggested fix**:
  - Replace `:root { --accent: #3b82f6 }` with `--accent: #6B3FA0` (or `#8272f2` for the lighter purple used in Arete's dark theme).
  - Update `theme-color` meta to match.
  - Review pillar colors — the green/blue/pink/yellow/purple pillar scheme can stay as-is; only the primary accent needs changing.

---

### 8. Sprint dates not validated when empty — silent data corruption
- **What**: `saveSprint()` checks `if(start && end && new Date(end) <= new Date(start))` — but if either date is empty the comparison is skipped entirely, allowing a sprint with no start or end date to be saved.
- **Where**: `givelink.html:789`
- **Why it matters**: A sprint with no dates causes `daysLeft()`, `sprintPct()`, and burndown calculations to return `NaN` or `Infinity`, silently corrupting the display throughout the app.
- **Effort**: S
- **Suggested fix**:
  - Add `if(!start || !end){ toast('Sprint start and end dates are required.'); return; }` before the date comparison.
  - Apply the same check in `confirmNewSprint()` at `givelink.html:825`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. `givelink.html` is a 1756-line monolith — all JS/CSS/HTML in one file
- **What**: The entire Givelink app — styles, markup, data, business logic, AI integrations, CRM, standup generator — lives in a single HTML file with no module boundaries.
- **Where**: `givelink.html` (entire file)
- **Why it matters**: Adding a new feature requires scanning 1700+ lines. Functions like `renderCRM()`, `generateOutreach()`, and `renderBurndown()` are interspersed with unrelated CSS. Bugs are hard to isolate.
- **Effort**: L
- **Suggested fix**:
  - Extract styles to `givelink.css` and JS to `givelink.js` as a first step.
  - Group JS into logical modules: `data.js`, `nav.js`, `ai.js`, `crm.js`.
  - This is a refactor — do it incrementally; don't block other work on it.

---

### 10. `window.prompt()` and `window.confirm()` used for destructive/critical UX
- **What**: `logActivityNP()` uses `window.prompt()` for activity notes; `delCur()` uses `window.confirm()` for deletion confirmation; `getApiKey()` uses `window.prompt()` for the API key.
- **Where**: `givelink.html:732` (delete), `givelink.html:1433` (activity log), `givelink.html:1086` (API key)
- **Why it matters**: `window.prompt/confirm` is blocked or styled poorly on many mobile browsers (especially iOS PWA mode), creates jarring UX breaks, and cannot be styled to match the app's design system.
- **Effort**: M
- **Suggested fix**:
  - Replace `logActivityNP()` prompt with a small inline textarea inside the CRM modal (already open).
  - Replace `delCur()` confirm with a red confirmation button state (already have the `.bd` button style).
  - API key prompt is resolved by routing through the proxy (P0/3).

---

### 11. Priority badge falls back to raw string, not display label
- **What**: In `taskHTML()`, the priority badge renders `${PRI[t.priority]?.l||'medium'}` — when `PRI[t.priority]` is undefined (e.g. corrupt data), it shows the raw lowercase value `'medium'` instead of nothing or a styled fallback.
- **Where**: `givelink.html:666`
- **Why it matters**: Breaks visual consistency; the other badges use proper display labels.
- **Effort**: S
- **Suggested fix**:
  - Change `||'medium'` to `||t.priority||'medium'` to at least show the stored value, or `||'—'` to show a clear unknown state.

---

### 12. `document.execCommand('copy')` is deprecated
- **What**: The clipboard fallback in both `copyStandup()` and the outreach copy handler uses `document.execCommand('copy')`, which is deprecated across all modern browsers.
- **Where**: `givelink.html:1521`, `givelink.html:1621`
- **Why it matters**: Will eventually stop working in Chrome/Firefox; already unsupported in some edge cases.
- **Effort**: S
- **Suggested fix**:
  - Use only `navigator.clipboard.writeText()` with a user-facing error message if it fails (e.g. "Copy manually: Ctrl+C").
  - Remove the `document.execCommand` fallback branch.

---

### 13. No rate limiting on the AI proxy
- **What**: `api/claude.js` has a comment noting that per-user rate limiting should be added (e.g. Upstash), but it is not implemented. Any authenticated user can make unlimited AI calls.
- **Where**: `api/claude.js:13`
- **Why it matters**: A single misconfigured client, abuse scenario, or loop bug can run up a large Anthropic bill with no circuit breaker.
- **Effort**: M
- **Suggested fix**:
  - Add an Upstash Redis rate limiter: e.g. 20 requests/user/hour using the Supabase JWT `sub` as the key.
  - Return HTTP 429 with a `Retry-After` header on limit breach.
  - Upstash has a free tier and a Vercel integration — setup is ~30 minutes.

---

## 💡 P3 — Nice to have

### 14. Seed data embeds real organization names and internal business context in source code
- **What**: `seedNonprofits()` hardcodes real nonprofit names, cities, missions, and internal notes ("Materials sent, onboarded", "Apollo onboarding in progress") directly in the HTML source.
- **Where**: `givelink.html:1284–1290`
- **Why it matters**: This data is visible in DevTools, in GitHub, and in any fork. If this repo is ever made public, it leaks partner details.
- **Effort**: S
- **Suggested fix**:
  - Move seed data to a `seed-data.json` file excluded from version control via `.gitignore`.
  - Or replace real names with anonymized placeholders for the public-facing seed.

---

### 15. Service worker cache name not updated with the codebase
- **What**: `CACHE = 'arete-20260723'` was set on 2026-07-23. Whenever HTML/JS/CSS changes are deployed without bumping this constant, PWA users may receive stale cached files until they manually clear storage.
- **Where**: `sw.js:1`
- **Why it matters**: Users who installed the PWA may silently run old code after a deploy.
- **Effort**: S
- **Suggested fix**:
  - Automate the cache key bump: use a build step that writes `CACHE = 'arete-<git-sha>'`, or at minimum add a comment reminding to update this on every deploy.
  - Alternatively use the Vercel deploy URL as the cache key source.

---

### 16. `api/claude.js` still targets `anthropic-version: 2023-06-01`
- **What**: The proxy uses the initial Anthropic API version. While backward-compatible today, newer API features (structured outputs, prompt caching, extended thinking) require higher version strings.
- **Where**: `api/claude.js:40`
- **Why it matters**: As features are added, developers will hit "feature not available" errors without understanding why.
- **Effort**: S
- **Suggested fix**:
  - Update to `'anthropic-version': '2023-06-01'` → `'2023-10-01'` or `'2024-08-01'` per the Anthropic docs to unlock all current stable features.
