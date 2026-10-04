# Weekly Triage — 2026-10-04

## 📊 Week at a glance
- **Commits this week**: 0 (last commit was 2026-09-12, 22 days ago)
- **Files changed this week**: 0
- **Debt markers added this week**: N/A — no commits

High-churn files (last 30 days):
1. `index.html` — touched in both recent commits (#84, #85)
2. `givelink.html` — touched in #84 ("Givelink bug fixes and This Week view")
3. `.github/workflows/supabase-keepalive.yml` — added in #85

> There is no code activity to triage this week. The items below are residue from the most recent commits (#84 / #85, 2026-09-12) that warrant follow-up.

---

## 🚨 Needs immediate attention

### 1. Personal seed data shipped in production (`index.html:4532–4922`)
- **Commit**: `72e03fe` — "Givelink bug fixes and This Week view"
- **Lines**: `index.html:4532` (`seed()`), `index.html:4925` (`seedGoals()`)
- **Why this matters**: Self-hosted users get the owner's personal tasks (Greek health appointments, Givelink-specific sales tasks, private goals). This is a P0 trust-destroyer for any new user who isn't on the hosted version. The call site at line 10660 only guards against hosted mode, leaving self-hosted exposed. See full analysis in `IMPROVEMENT_PLAN.md` item #1.

### 2. `profileName` falls back to "Panos" for all guests (`index.html:2519`)
- **Commit**: Persists across recent commits; introduced long ago, not fixed in #84.
- **Lines**: `index.html:1070`, `index.html:2519`
- **Why this matters**: Guest users and self-hosted first-timers see "Good morning, Panos 👋" — immediately signals the app is personalized for someone else. The hosted path fixes this (email prefix extraction at line 10459), but the fallback is still wrong.

### 3. `callClaudeGL()` in Givelink doesn't check `res.ok` before parsing (`givelink.html:1338`)
- **Commit**: `72e03fe` — introduced during the Givelink bug-fix pass
- **Lines**: `givelink.html:1332–1341`
- **Why this matters**: Rate-limit (429) and auth errors (401) from the Anthropic API return JSON bodies that parse successfully but contain no `content[0].text`. The function returns `null` silently; downstream callers show no error to the user. This is a regression compared to `runAiSprintPlanner()` at line 1199 which correctly checks `!res.ok`.

### 4. `window.prompt()` used in Givelink for API key collection (`givelink.html:1155, 1330`)
- **Commit**: Pre-dates #84 but was NOT fixed during the Givelink bug-fix pass.
- **Lines**: `givelink.html:1155`, `givelink.html:1330`, `givelink.html:1504`
- **Why this matters**: iOS PWA blocks `window.prompt()`. The commit message for #84 is "Givelink bug fixes" — this is a known Givelink bug that was missed. Givelink AI features are completely unreachable on iPhone home screen.

---

## 🧹 Cleanup opportunities

### 5. `confirm('Delete?')` pattern across Givelink (`givelink.html:801, 1498`)
- **Commit**: Present before #84, not addressed.
- **Lines**: `givelink.html:801`, `givelink.html:1498`
- **What they likely meant**: Quick guard against accidental deletion. Works on desktop, broken on iOS PWA.
- **Fix**: Two-tap confirm or a small inline warning banner before delete. Low effort.

### 6. `console.warn('seed', e)` suppresses seed errors silently (`index.html:10660`)
- **Commit**: `72e03fe` (call site unchanged)
- **Lines**: `index.html:10660` — `try{if(!_hostedMode()){seed();seedGoals();}}catch(e){console.warn('seed',e);}`
- **What it likely meant**: Guard against parse errors in the seed functions. In practice, any bug in the 400-line seed block is invisibly swallowed. Once the seed is replaced with generic data (P0 fix), this try/catch can go away or rethrow.

### 7. `sw.js` cache key is a hardcoded date (`sw.js:1`)
- **Commit**: `72e03fe` (sw.js updated to `'arete-20260723'`)
- **Lines**: `sw.js:1`
- **What it likely meant**: Manual version bump on each deploy. Risky because forgetting to bump it means users get stale cached HTML. Should be automated via a build step.

### 8. `syncToTaskOS()` reads `taskos_profiles` which no longer exists (`givelink.html:1275`)
- **Commit**: Introduced before #73 (d635c06, "Remove Givelink from Task OS"). Never cleaned up.
- **Lines**: `givelink.html:1275–1319`
- **What it likely meant**: Bidirectional sync between the two apps when they were co-located. Now the main app writes only `taskos` (the single state key), so this function is a dead code path that shows a confusing error to users.

---

## 🤔 Worth a second look

### 9. `_sbToken()` used inside an async `callClaude()` without propagating token-refresh failures (`index.html:5013`)
- **Lines**: `index.html:5013` — `const tok = _sbEnabled() ? await _sbToken().catch(()=>'') : '';`
- **Why it looks suspicious**: The `.catch(()=>'')` silently swallows token-refresh failures and sends an empty Bearer header to the AI proxy. The proxy (api/claude.js line 23-30) returns 401 in this case, which is handled by the toast at line 5028. But the user gets a cryptic "Please sign in again" message instead of a proper re-auth flow. Worth adding a proper re-auth redirect on token expiry.

### 10. `setInterval` streak-saver at line 10712 fires every 60 seconds all day
- **Lines**: `index.html:10712–10723`
- **Why it looks suspicious**: The interval runs every 60 seconds but the inner guard (`if(hr<21)return`) means it does meaningful work only after 9pm. Keeping a 60s interval alive all day for an evening-only feature wastes battery on mobile. Consider using a single `setTimeout` calculated to the next 9pm instead.

### 11. Supabase keep-alive workflow pings every 3 days — verify schedule is right for the plan
- **File**: `.github/workflows/supabase-keepalive.yml` (added in `160f0d8`)
- **Why it looks suspicious**: Supabase pauses free projects after 7 days of inactivity. A 3-day ping interval is safe, but if the project is upgraded to a paid plan, the workflow becomes unnecessary noise. Worth adding a comment explaining the rationale and the plan tier it's guarding against.
