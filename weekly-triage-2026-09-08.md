# Weekly Triage — 2026-09-08

## 📊 Week at a glance
- **Commits**: 0 (last commit: 2026-08-22, `5cd9437`)
- **Files changed**: 0
- **Debt markers added this week**: 0 (no commits to scan)
- **High-churn files**: N/A — no activity this week
- **Observation**: The codebase has been unchanged for 17 days. Triage is based on a full static scan of current HEAD.

---

## 🚨 Needs immediate attention

### 1. Direct browser API calls bypass the proxy — key exposure risk
- **File**: `givelink.html:1131`, `givelink.html:1264`
- **Commit introduced**: `fb33461` (PLG Tier 2) or earlier — predates the 7-day window
- **Why this matters**: Both `runAiSprintPlanner()` and `callClaudeGL()` POST directly to `api.anthropic.com` from the browser with the user's Anthropic key stored in `localStorage`. The key is visible in DevTools Network tab for anyone with physical or remote access to the browser. The serverless proxy at `api/claude.js` was built to prevent exactly this and is never called.

### 2. `JSON.parse()` in `load()` has no error boundary
- **File**: `givelink.html:448`
- **Commit introduced**: predates 7-day window
- **Why this matters**: A single invalid character in `localStorage` (`givelink_sprint`) throws, leaving the user with a blank screen and no recovery path. This is a silent data-loss scenario that's hard to reproduce and impossible for the user to self-diagnose.

### 3. Push notification icons will 404 in production
- **File**: `sw.js:47–48`
- **Commit introduced**: predates 7-day window
- **Why this matters**: `showNotification()` sets `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'` — the `icons/` directory does not exist; the file is at `./icon-192.png`. Every push notification will show a broken image. Push notifications are a key re-engagement mechanic.

---

## 🧹 Cleanup opportunities

### 4. `anthropic-dangerous-direct-browser-access` header is a red flag in code review
- **File**: `givelink.html:1137`, `givelink.html:1266`
- **Commit introduced**: predates 7-day window
- **Why this matters**: This header is required by Anthropic specifically to allow browser-direct API calls — its presence is an explicit acknowledgement of a security bypass. Removing it (by routing through the proxy) also removes the header.

### 5. `window.prompt()` used in three production flows
- **File**: `givelink.html:1086` (API key), `givelink.html:1261` (API key fallback), `givelink.html:1433` (activity log)
- **Commit introduced**: predates 7-day window
- **Why this matters**: `window.prompt()` is blocked in some iOS PWA contexts, looks completely out of place in a polished app, and cannot be styled. All three usages are in user-facing primary flows.

### 6. `document.execCommand('copy')` is deprecated in both copy functions
- **File**: `givelink.html:1521`, `givelink.html:1621`
- **Commit introduced**: predates 7-day window
- **Why this matters**: The Clipboard API (`navigator.clipboard.writeText`) is available in all modern browsers including mobile. The `execCommand` fallback should be removed — it is scheduled for removal in Chromium.

### 7. Sprint settings allows saving with no start or end date
- **File**: `givelink.html:789`
- **Commit introduced**: predates 7-day window
- **Why this matters**: `if(start && end && new Date(end) <= new Date(start))` silently skips validation when either date is empty. A sprint saved with no dates causes `daysLeft()` and `sprintPct()` to return `NaN`, corrupting the sprint bar and burndown displays app-wide.

### 8. Burndown chart shows empty state for the first full calendar day of any sprint
- **File**: `givelink.html:754–758`
- **Commit introduced**: predates 7-day window
- **Why this matters**: `if(snapshots.length < 2)` means the burndown is invisible until at least two separate calendar days have passed with task completions. Sprint kickoff day — highest engagement — produces an empty chart.

---

## 🤔 Worth a second look

### 9. Seed data with real partner names baked into the HTML source
- **File**: `givelink.html:1284–1290` (`seedNonprofits`)
- **Commit introduced**: predates 7-day window
- **Why this matters**: St. Anthony Foundation, SF Safehouse, Edgewood, Swords to Plowshares — real organization names with internal notes like "Apollo onboarding in progress" and "meeting scheduled". If this repo is ever made public or shared, this is a partner data leak.

### 10. Service worker cache key is a hardcoded date that requires manual bumps
- **File**: `sw.js:1` — `const CACHE = 'arete-20260723'`
- **Commit introduced**: predates 7-day window
- **Why this matters**: Last updated 2026-07-23 — 47 days ago. The README and landing page have been updated since then. PWA users who installed before the last deploy may be running the cached version of files that have since changed.

### 11. `givelink.html` accent color is `#3b82f6` (blue) — off-brand
- **File**: `givelink.html:17`
- **Commit introduced**: predates commit `#81` (Brand consistency: rebrand update banner + purge stray old-brand colors) — suggesting it was missed in the rebrand sweep.
- **Why this matters**: Commit `72d9c68` ("Brand consistency") explicitly purged old-brand colors from `index.html` but `givelink.html` was not touched. The brand palette is purple; givelink.html remains entirely blue.

### 12. AI proxy at `api/claude.js` has no rate limiting despite comment flagging it
- **File**: `api/claude.js:13`
- **Commit introduced**: predates 7-day window
- **Why this matters**: The comment says "For production add per-user rate limiting" — this is still unimplemented. No circuit breaker on AI spend.

---

*Triage complete. No commits in the last 7 days — all items above are pre-existing technical debt surfaced via static analysis.*
