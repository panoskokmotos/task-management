# Weekly Triage — 2026-04-20

## 📊 Week at a glance
- Commits: 3 | Files changed: 3 | Debt markers added: 0 (no TODO/FIXME/HACK)
- High-churn files: `givelink.html` (3 commits), `index.html` (2 commits), `sw.js` (1 commit)
- All 3 commits were feature/fix — **zero test commits this week**

---

## 🚨 Needs immediate attention

### 1. `callClaude()` swallows API errors silently — index.html:2293
**Commit:** `537b01a`
Every AI feature in Life OS routes through `callClaude()`. It calls `res.json()` without first checking `res.ok`. A 401 (bad key), 429 (rate limit), or 500 will silently return `null`, and the UI just does nothing. Users have no feedback that their key is invalid or they're being rate-limited.

### 2. `autoFillRetro()` also skips `res.ok` — givelink.html:2185
**Commit:** `537b01a`
The Givelink retro auto-fill fetch has the same pattern: no `res.ok` check before `res.json()`. The Sprint Planner (`givelink.html:1755`) and Goal Breakdown (`givelink.html:1845`) *do* check `res.ok` — the inconsistency means this one is easy to miss in review.

### 3. Silent catch swallows key-not-found errors — givelink.html:1672, 1681
**Commit:** `537b01a`
`getApiKey()` has two bare `catch(e){}` blocks when parsing localStorage. If the stored value is malformed JSON, the function silently falls through and returns `undefined`, causing AI calls to fail with a misleading "API key required" toast rather than the real error.

### 4. API key exposed in localStorage, passed directly to browser fetch — givelink.html:1744, index.html:2290
**Commits:** `23d3020`, `537b01a`
`S.claudeKey` is stored as plaintext in localStorage and sent via `x-api-key` header in direct browser-to-Anthropic fetches. The `anthropic-dangerous-direct-browser-access: true` header makes this work, but it means the key is trivially readable via DevTools. Any XSS on the same origin would exfiltrate it. This is a known tradeoff for browser-only apps, but worth a conscious decision, not a default.

### 5. Mixed model names — no central config — givelink.html:1749,1843,2185,2214 | index.html:2291
**Commit:** `537b01a`
Four different model strings hardcoded across two files: `claude-opus-4-5` (sprint planner and goal breakdown in givelink), `claude-haiku-4-5-20251001` (retro, standup, all index.html AI calls). Swapping a model requires a grep-and-replace across the codebase. If a model is deprecated, this breaks silently at runtime.

---

## 🧹 Cleanup opportunities

### 6. Real business data baked into `initDefaultData()` — givelink.html:1505–1660
**Commit:** `dcaaeb8`
The seed/demo data function contains actual Givelink business tasks: "O1 Application under legal processing", "Pay Gerald", "Hellenic Impact Grant $20k", "Girl who has 12 giving circles — contact", "Social Innovation Award — apply — fillout.applysocialinnovationaward.com/start". This runs on first load when localStorage is empty, so new-device sessions start with real operational data. It's a confidentiality and correctness risk.

### 7. Service worker cache version is a manual timestamp — sw.js:1
**Commit:** `23d3020`
`const CACHE = 'task-os-20260413-174350'` must be hand-bumped every deploy. It was already updated in the last commit, but a missed bump means users get stale cached HTML. A build-time hash or auto-increment would eliminate the category of bug.

### 8. `getApiKey()` has a 3-location fallback chain — givelink.html:1667–1685
**Commit:** `537b01a`
Tries `givelink_api_key` → `taskos.claudeKey` → `taskos_profiles[n]`. This was the "AI key fix" in the commit message. The fix works but leaves three sources of truth for one config value. The next person to debug a "key not found" issue will trace through all three.

### 9. `generateStandup()` has no explicit user feedback on failure — givelink.html:2211
**Commit:** `537b01a`
The standup generator catches errors and shows a toast, but if `!apiKey` it returns silently with no toast. Contrast with the retro fill that at least shows "API key required." Inconsistent UX.

---

## 🤔 Worth a second look

### 10. Feature-only week with no tests — all commits
**Commits:** `537b01a`, `dcaaeb8`, `23d3020`
435 lines added to `index.html`, 108 to `givelink.html` this week — Weekly Plan, Monthly Plan, retro auto-fill, standup generator, automation rules, bidirectional app switcher. Zero test commits. For localStorage-based state and AI JSON parsing in particular, a quick regression can go unnoticed until a real user loses data.

### 11. `addAISuggestedTask()` inserts with hardcoded Eisenhower values — index.html:4053
**Commit:** `537b01a`
AI suggestions get `urgency:'high', importance:'high'` hardcoded regardless of what the AI said or what bucket they go into. Every AI-suggested task becomes Q1 in the Eisenhower view by default, defeating the prioritization system.

### 12. Weekly/monthly plan views have no empty-state loading indicators — index.html:4078, 4169
**Commit:** `537b01a`
`aiSuggestWeek()` and `aiSuggestMonth()` disable the button and change its text while waiting, but the result area doesn't show a spinner or placeholder — it just remains blank until the response arrives. On slow connections this looks broken.

### 13. EOD mid-flow reset guard may over-fire — index.html (commit `23d3020`)
**Commit:** `23d3020`
The "mid-flow reset guard" added this week resets EOD state on nav. The commit message calls this a fix, but if a user navigates away accidentally during EOD and comes back, they lose their progress. The guard should probably only reset when navigating *away from* EOD, not *to* it.
