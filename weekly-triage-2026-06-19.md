# Weekly Triage — 2026-06-19

## 📊 Week at a glance
- Commits this week: **0** (last commit was 2026-06-08, 11 days ago)
- Files changed: 0 | Debt markers added this week: 0
- High-churn files from the last active sprint (2026-06-08): `index.html`, `givelink.html` (both changed in 4 commits same day)

> No new commits since 2026-06-08. This triage covers the pre-existing technical debt in the current HEAD (`0b54845`), based on static analysis of changed files from the most recent active week (4 commits on Jun 8).

---

## 🚨 Needs immediate attention

### 1. `vercel.json:14` — CSP blocks all Supabase fetches (connect-src)
**File:** `vercel.json:14` | **Commit:** `67de902` (Supabase cloud sync feature)
**Why this matters:** Cloud sync was shipped in commit `67de902` (May 29) but the CSP `connect-src` was never updated to include `https://*.supabase.co`. Every production user who configured cloud sync has broken sync — silently, with no error. Data diverges across devices.

### 2. `vercel.json:14` — CSP blocks Google Fonts (style-src / font-src)
**File:** `vercel.json:14` | **Commit:** `dd16e0c` (Brand identity pass that introduced Google Fonts)
**Why this matters:** `dd16e0c` added `<link href="https://fonts.googleapis.com/...">` for Inter but didn't add the domain to CSP `style-src` or `font-src`. Inter has never loaded in production. All typography is rendered in system font fallback.

### 3. `givelink.html:1075-1087` — `getApiKey()` always falls through to `window.prompt()`
**File:** `givelink.html:1075-1087` | **Commit:** `c1facf8` (Givelink OS feature)
**Why this matters:** The function tries to find the Claude API key under `taskos_profiles[n].apiKey` — a data format that was never used. Task OS stores the key at `S.claudeKey` inside `taskos`. The AI Sprint Planner always triggers `window.prompt()` even when the key is configured, blocking the feature for all real users.

### 4. `index.html:2864-2865`, `2888`, `2895` — Unescaped user content in innerHTML
**File:** `index.html:2864-2865`, `2888`, `2895`, `2897`, `2046-2050` | **Commit:** `0b54845` (and earlier)
**Why this matters:** Goal titles (`g.title`), goal descriptions (`g.description`), task titles (`t.title`), and checklist items (`c.text`) are interpolated directly into innerHTML template strings without `esc()`. A goal/task title containing `<img src=x onerror=...>` or `<script>` runs arbitrary code. The Claude API key stored in localStorage is exfiltrable.

### 5. `sw.js:38-39` — `./icons/icon-192.png` referenced but directory does not exist
**File:** `sw.js:38-39`, `index.html:9286` | **Commit:** `dd16e0c` (PWA/brand polish)
**Why this matters:** The `icons/` directory was never created. Push notification events reference a 404 asset. On some platforms `showNotification()` rejects silently when the icon fails to load. Reminder notifications — a key daily retention feature — are degraded.

---

## 🧹 Cleanup opportunities

### 6. `givelink.html:1431` — `window.prompt()` for CRM activity log
**File:** `givelink.html:1431` | **Commit:** `c1facf8`
`const note=window.prompt('Log activity (what happened?):');` — a blocking browser dialog for what should be an inline form. `prompt()` returns `null` in sandboxed contexts, silently dropping the log entry.

### 7. `givelink.html:1075-1087` vs `givelink.html:1259` — Two conflicting API key lookup paths
**File:** `givelink.html:1075-1087`, `1259` | **Commit:** `c1facf8`
`getApiKey()` searches a non-existent `taskos_profiles` format; `callClaudeGL()` reads from the actual `taskos` blob. The two approaches can return different values. `getApiKey()` should be deleted and all callers should use `callClaudeGL()`'s pattern.

### 8. `sw.js:1` — Hardcoded cache key date not updated with deploys
**File:** `sw.js:1` | **Commit:** `dd16e0c` (last update: `task-os-20260530`)
`const CACHE = 'task-os-20260530'` — four subsequent bug-fix PRs (#51-54) shipped without bumping the SW cache key. Some users may have received stale cached versions. Needs a comment `// BUMP ON EVERY DEPLOY` and a process to tie it to the PR number.

### 9. `index.html:9773` — `esc()` defined near bottom, used from line 2046
**File:** `index.html:9773` | **Commit:** multiple
The HTML-escape helper is 7,727 lines below its first use. Contributors adding innerHTML code won't see it exists, leading to more unescaped insertions. Should be moved to the top of the script block.

### 10. `givelink.html:1140` — Uses `claude-opus-4-5` for sprint planning (expensive)
**File:** `givelink.html:1140` | **Commit:** `c1facf8`
The AI Sprint Planner calls `claude-opus-4-5` (the heaviest model) for a structured JSON task list. This is 5-10× more expensive per call than `claude-haiku-4-5-20251001`, which handles this prompt pattern well. No model rationale comment explains why Opus was chosen here vs Haiku used everywhere else in the codebase.

---

## 🤔 Worth a second look

### 11. `index.html:8638` — `_sbScheduleSync()` calls `sbPush()` directly, bypassing `_sbBusy` guard
**File:** `index.html:8633-8639` | **Commit:** `67de902`
The scheduled debounced sync timer calls `sbPush()` directly rather than `sbSyncNow()`. If a manual `sbSyncNow()` is in progress when the timer fires, two concurrent Supabase POST requests can occur simultaneously. Unlikely to cause data loss (last-write-wins by `_updatedAt`), but worth validating.

### 12. `index.html:2036` — `S` state object contains 70+ properties, grows with every feature
**File:** `index.html:2036` | **Commit:** multiple (most recently `c1facf8`, `0e8dc99`)
Arrays like `S.contextLog`, `S.challengeLogs`, `S.happinessLogs`, and `S.maslowLog` are appended to indefinitely. No pruning logic exists. After 6 months of daily use, the `taskos` localStorage blob may approach the 5-10MB browser limit. The `save()` catch at `index.html:2101` only surfaces the error after the write fails.

### 13. `givelink.html:1220-1246` — Task OS sync matches by title string, not ID
**File:** `givelink.html:1220-1246` | **Commit:** `c1facf8`
`syncToTaskOS()` matches tasks between apps with `.toLowerCase()` string comparison. A task renamed in either app is orphaned and duplicated on next sync. Intentional design or oversight? No comment explains the choice.

### 14. `index.html:8507-8521` — Supabase password stored on Connect, never cleared on disconnect
**File:** `index.html:8507-8521` | **Commit:** `67de902`
`saveSettings()` persists `set-sb-url`, `set-sb-anon`, and `set-sb-email` to localStorage on every "Save Settings" call, even if the user is not yet connected. The Supabase password input (`set-sb-pass`) is cleared after connect (`index.html:8585`), but the email and anon key remain in localStorage indefinitely even after `sbDisconnect()` (which only removes access/refresh/exp/uid keys). May expose credentials if the device is shared.

### 15. `index.html:9661` — Morning briefing cache failure caught but stale data still rendered
**File:** `index.html:9661` | **Commit:** `1d3ea98`
JSON parse error is caught with `console.warn` but then continues to call `_renderAIBriefing(d, el)` where `d` is the value from before the try block (stale or undefined). If the cache is corrupt, the briefing renders empty or throws in `_renderAIBriefing`. Needs a `d=null; return;` in the catch to fall through to a fresh fetch.
