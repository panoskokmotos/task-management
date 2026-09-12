# Weekly Triage — 2026-09-12

## 📊 Week at a glance
- **Commits**: 2 | **Files changed**: 3 | **Debt markers added**: 0
- **High-churn files**: `givelink.html` (touched in PR #84 with 93-line diff), `index.html` (touched in PR #84 with 14-line diff), `.github/workflows/supabase-keepalive.yml` (new file, PR #85)
- **Net**: PR #84 fixed 10 bugs and added the "This Week" view. PR #85 added a keep-alive cron. Both merged same day (2026-09-12). No debt markers (TODO/FIXME/HACK) were found in changed files. Quiet week, but two residual issues surfaced in the new code.

---

## 🚨 Needs immediate attention

### 1. `load()` in givelink.html has no JSON.parse error handling
- **File:Line**: `givelink.html:453`
- **Commit**: `72e03fe` (Givelink bug fixes and This Week view)
- **Why this matters**: The save/load functions were touched in this PR. `save()` (line 452) calls `JSON.stringify(S)` — if the state object ever contains a circular reference or non-serializable value, it will throw and the partially-written string can corrupt localStorage. On the next page load, `JSON.parse(d)` (line 453) will throw a SyntaxError with no catch — the app goes blank for that user permanently. The PR fixed many things but didn't add recovery for this.

---

### 2. `callClaudeGL` doesn't check `res.ok` before parsing JSON
- **File:Line**: `givelink.html:1337–1339`
- **Commit**: `72e03fe` (this function was in the diff's context; the standup generator and outreach generator both call it)
- **Why this matters**: A 429 (rate-limited) or 401 (bad key) response body is a JSON error envelope from Anthropic, but if the network cuts out mid-response or returns a non-JSON error (e.g. Cloudflare 503), `res.json()` throws and the `catch` block shows a confusing `SyntaxError: Unexpected token` instead of "rate limit" or "check your API key". This regresses the standup generator and outreach generator fixed in this PR.

---

### 3. Supabase keep-alive workflow pings `/rest/v1/` but auth failures still auto-pause the project
- **File:Line**: `.github/workflows/supabase-keepalive.yml:25–27`
- **Commit**: `160f0d8` (new file)
- **Why this matters**: The ping hits the REST endpoint with the anon key, which keeps the *database* alive. However Supabase's pause mechanism is triggered by inactivity across *all* endpoints including auth. A REST ping alone may not reset the auth endpoint's activity timer depending on Supabase's internal accounting. The safer ping is to hit `/auth/v1/settings` (public endpoint, no credentials required) which is the endpoint that actually breaks when the project pauses. Worth verifying this works before relying on it.

---

### 4. `APP_CONFIG.aiProxy` is empty — all AI features in Task OS are dead for new users
- **File:Line**: `index.html:9959`
- **Commit**: `72e03fe` (index.html was touched; this pre-existing issue is now newly visible because the PR was testing AI features)
- **Why this matters**: The 14-line index.html diff in this commit touched the AI-related saving paths. The `aiProxy` field being `''` means every AI call requires users to paste their own Anthropic API key — the proxy (`api/claude.js`) exists on Vercel but is not wired up. This is a pre-existing issue but likely blocks new-user activation.

---

## 🧹 Cleanup opportunities

### 5. Hardcoded sprint start/end dates in default state
- **File:Line**: `givelink.html:442`
- **Commit**: `72e03fe` (state definition was in this file's diff)
- **Why this matters**: `start:'2026-03-28', end:'2026-04-11'` are 5 months stale. Any new user (or someone clearing their browser data) sees an expired sprint immediately. The This Week view added in this PR shows "—22 days left" on first load, making the new feature look broken.

---

### 6. Burndown snapshot not called in `saveTask()` — only in `toggleDone()`
- **File:Line**: `givelink.html:779` (saveTask), `givelink.html:806` (toggleDone has `_recordSnapshot()`)
- **Commit**: `72e03fe` (both functions were in this commit's diff)
- **Why this matters**: The PR fixed `completedAt` being clobbered when saving via the modal (one of 6 bugs fixed). But `_recordSnapshot()` was not added to `saveTask()` — so completing tasks via the edit modal doesn't update the burndown. Only checkbox clicks update it.

---

### 7. `renderWeekPlan()` mobile breakpoint is JS-only — no resize listener
- **File:Line**: `givelink.html:682–685`
- **Commit**: `72e03fe` (This Week view was added in this commit)
- **Why this matters**: The 7-column-to-2-column collapse on mobile checks `window.innerWidth` once at render time. Device rotation or browser resize leaves the grid stuck. This is new code from this commit, so it's a fresh rough edge in a just-shipped feature.

---

## 🤔 Worth a second look

### 8. `claude-opus-4-5` used for AI Sprint Planner (expensive model, no proxy)
- **File:Line**: `givelink.html:1209`
- **Commit**: `72e03fe` (AI Sprint Planner is in this file; model string visible in diff context)
- **Why this matters**: The AI Sprint Planner calls `claude-opus-4-5` with `max_tokens:1024` directly from the browser using the user's API key. Opus is ~15× more expensive than Haiku per token. Given the task is JSON generation from a list, `claude-haiku-4-5-20251001` (the model already used in `callClaudeGL` for standup/outreach) would be equally effective. If you later wire this to the proxy, every Sprint Planner call will cost from your server-side key at Opus rates.

---

### 9. `syncToTaskOS` title-matching could silently corrupt Task OS data
- **File:Line**: `givelink.html:1292`, `givelink.html:1303`
- **Commit**: `72e03fe` (sync function appears in this file's diff context)
- **Why this matters**: The sync button matches Givelink tasks to Task OS tasks using `title.toLowerCase()`. If a Task OS task has the same name as a Givelink task that was completed, it gets marked done — even if it's a different task. No ID-based tracking. This is an existing issue but becomes more likely to cause pain as the task list grows with the new backlog features.

---

### 10. Supabase anon key hardcoded in workflow YAML (intentional, but worth documenting)
- **File:Line**: `.github/workflows/supabase-keepalive.yml:27`
- **Commit**: `160f0d8` (new file)
- **Why this matters**: The key `sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M` is already embedded in `index.html`'s `APP_CONFIG` (shipped to every browser), so it's already public. The workflow comment correctly notes it's safe. Worth a quick RLS audit to confirm all tables restrict unauthenticated writes — if anyone sets up RLS incorrectly on a new table, this key is in git history permanently.

---

*Items kept: 10 / max 30. Quality filter: excluded 3 minor style issues found in unchanged context (pillar filter reset on nav, priority badge shows raw value not label in backlog view — `t.priority` instead of `PRI[t.priority]?.l` on `givelink.html:617`).*
