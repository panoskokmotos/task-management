# Weekly Triage — 2026-08-28

## 📊 Week at a glance
- Commits: 1 | Files changed: 1 | Debt markers added: 0
- High-churn files: `README.md` (only file touched this week)
- Quiet week on code — single documentation commit. Main findings come from static analysis of the existing codebase.

---

## 🚨 Needs immediate attention

### 1. `givelink.html:448` — No try/catch in `load()` around `JSON.parse`
- **Commit**: pre-dates this week (baseline issue)
- **Why this matters**: A corrupted `givelink_sprint` key crashes the entire app on startup with an uncaught `SyntaxError`. The user sees a blank screen. `index.html` guards this identically — the fix is a two-line change.

### 2. `givelink.html:1488` — Standup generator counts "yesterday" as 2 days ago
- **Commit**: pre-dates this week (baseline issue)
- **Why this matters**: `yesterday.setDate(now.getDate()-2)` is off by one. Tasks completed yesterday never appear in the standup. This silently produces wrong output every single day the feature is used.

### 3. `givelink.html:1264–1271` — `callClaudeGL` has no HTTP error check
- **Commit**: pre-dates this week (baseline issue)
- **Why this matters**: HTTP 401/429/500 from Anthropic returns `null` silently — no toast, no user feedback. Standup and outreach generation fail invisibly when the key is wrong or rate-limited.

### 4. `givelink.html:1085–1086` — Anthropic API key stored plaintext in `localStorage`
- **Commit**: pre-dates this week (baseline issue)
- **Why this matters**: With `anthropic-dangerous-direct-browser-access:true`, the key is used directly from the browser. Any script on the page can read `localStorage.taskos_api_key`. Exfiltrating one key gives full billing access to the Anthropic account.

---

## 🧹 Cleanup opportunities

### 5. `givelink.html:1075–1088` and `givelink.html:1257–1262` — Duplicate API key lookup
- **Commit**: baseline
- **Why this matters**: `getApiKey()` checks `taskos_profiles` first, then falls back to `taskos_api_key`. `callClaudeGL` only checks `taskos_api_key` and `taskos` object. Different lookup order → inconsistent behavior. Extract one shared `getKey()`.

### 6. `givelink.html:1140` and `givelink.html:1256` — Two hardcoded model strings
- **Commit**: baseline
- **Why this matters**: Sprint planner uses `claude-opus-4-5`, standup/outreach uses `claude-haiku-4-5-20251001`. When models are deprecated these will 404 silently. Define `const GL_MODELS` at the top.

### 7. `givelink.html:1720–1733` — SW update banner can double-trigger
- **Commit**: baseline
- **Why this matters**: Both `updatefound→statechange→activated` and `controllerchange` call `showUpdateBanner()`. The `_swRefreshing` flag prevents a second show in the same session — but the flag is never reset, so if a second real update ships, the banner never shows.

### 8. `givelink.html:11` — SVG used as `apple-touch-icon`
- **Commit**: baseline
- **Why this matters**: iOS ignores SVGs for home screen icons. Installed PWA shows a generic bookmark instead of the logo.

### 9. `README.md` — Badges placeholder committed this week
- **Commit**: `5cd9437`
- **Why this matters**: The README was improved with overview/features/install docs. The `badges placeholder` note in the commit message suggests badge links (build status, version) were added as `TODO` placeholders. These should either be filled in or removed before the repo goes public.

---

## 🤔 Worth a second look

### 10. `givelink.html:197` — CRM Kanban grid overflows on mobile with no scroll container
- **Commit**: baseline
- **Why this matters**: `grid-template-columns:repeat(6,1fr)` with `min-width:160px` and no `overflow-x:auto` on the container. On a 375px viewport, columns 4–6 are unreachable. Looks intentional (desktop-first CRM) but worth confirming mobile isn't a use case — the PWA manifest and `apple-touch-icon` suggest it is.

### 11. `api/claude.js:42` — Proxy hardcoded to `claude-haiku-4-5-20251001`
- **Commit**: baseline
- **Why this matters**: Model is not configurable via the request body. If the app ever needs Sonnet-quality responses via the proxy, a code change is required. Could accept an optional `model` param with an allowlist.

### 12. `givelink.html:1222` — Task OS sync matches by title, not ID
- **Commit**: baseline
- **Why this matters**: `tt.title.toLowerCase()===gt.title.toLowerCase()` will create duplicates if a task title is edited in either app. Pattern that looks intentional but creates silent data integrity issues at scale.

---

*Triage methodology: static analysis of changed files + full codebase review. No PostHog/analytics data available in repo. All items pre-date this week's commit except item 9.*
