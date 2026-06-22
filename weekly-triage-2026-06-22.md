# Weekly Triage — 2026-06-22

## 📊 Week at a glance
- **Commits this week**: 0 (last commit was `0b54845` on 2026-06-08, 14 days ago)
- **Files changed**: 0
- **Debt markers added this week**: N/A — no changes to scan
- **High-churn files**: None this week

> No commits landed in the 7-day window (2026-06-15 → 2026-06-22). The sections below cover a static scan of the current HEAD instead, focused on the debt that exists in the codebase regardless of when it was introduced.

---

## 🚨 Needs immediate attention

### 1. `load()` — bare `JSON.parse` with no error handling
- **File**: `givelink.html:448`
- **Introduced**: `0b54845` (2026-06-08) — "Fix 4 bugs: backdrop close, ladder crash, wins blank title"
- **Why this matters**: `JSON.parse(localStorage.getItem('givelink_sprint'))` is called unconditionally on every page load. Any write that was interrupted mid-way (quota exceeded, tab crash) leaves malformed JSON and crashes the app entirely on next load. The identical pattern exists in `index.html`. Users have no recovery path.

### 2. NP Modal action buttons are baked into a one-time template string
- **File**: `givelink.html:1362–1387`
- **Introduced**: `eeb9b8f` (2026-06-08) — "Fix three bugs in Givelink dashboard"
- **Why this matters**: The CRM modal is created once and reused. The Delete / Log Activity / Advance Stage buttons are rendered via template literal that captures `editNpId` at creation time. On a typical session, "Add Org" is clicked first (`editNpId = null`), which permanently omits these buttons from the DOM for the rest of the session. CRM is effectively read-only until hard reload.

### 3. AI Sprint Planner sends requests to `claude-opus-4-5` — unrecognized model ID
- **File**: `givelink.html:1141`
- **Introduced**: `1d3ea98` (2026-05-29) — "North Star Cockpit + Pace Engine, and AI Workflows Hub"
- **Why this matters**: `claude-opus-4-5` is not a documented current Anthropic model. The API returns a 400 error which is caught and shown as a generic error message. The AI Sprint Planner feature is non-functional for all users.

### 4. `callClaudeGL()` doesn't check `res.ok` before calling `res.json()`
- **File**: `givelink.html:1263–1270`
- **Introduced**: `1d3ea98` (2026-05-29)
- **Why this matters**: A 401 (invalid key), 429 (rate limit), or 529 (overload) response from Anthropic is valid JSON but has no `content` field. The function returns `null` silently. The Standup Generator and Outreach Email features both depend on this utility and fail with an unhelpful "Could not generate" message. Users can't distinguish a wrong API key from a rate limit.

### 5. Service worker push notification references non-existent icon
- **File**: `sw.js:39–40`
- **Introduced**: `67de902` (2026-05-29) — "Optional offline-first Supabase cloud sync"
- **Why this matters**: `'./icons/icon-192.png'` does not exist in the repository. Push notifications are rendered without an icon (or suppressed on some platforms). The missing file also causes a console 404 on every service worker activation.

---

## 🧹 Cleanup opportunities

### 6. Magic sentinel `999` in `daysSinceCRM()`
- **File**: `givelink.html:1295`
- **Commit**: `eeb9b8f` (2026-06-08)
- **What they likely meant**: Return a value that would be treated as "very old" so the org shows up in the overdue bucket. But `999 > 7` is immediately true, meaning any org without a `lastActivityAt` field (i.e., freshly added ones) instantly appears in red as overdue.
- **Fix**: Return `null` and handle it explicitly, or use `createdAt` as the fallback timestamp.

### 7. `esc()` used inconsistently — notes field rendered without escaping in one location
- **File**: `givelink.html:638`
- **Commit**: `eeb9b8f` (2026-06-08)
- **What they likely meant**: Display the task notes below the title. `esc(t.notes)` is correctly used for the title and assignee, but the notes field in `goalHTML` at line 638 uses `${esc(t.notes)}` — consistent. However, `taskHTML` at line 668 uses `${t.pillar||'medium'}` without `esc()` for the priority badge text. Low risk (priority is a controlled enum) but worth auditing all template slots.

### 8. Commented-out `console.log` residue in shared AI utility pattern
- **File**: `givelink.html:1258–1260`
- **Commit**: `1d3ea98` (2026-05-29)
- **What they likely meant**: The `callClaudeGL` function has dead-end fallback key lookups: first tries `taskos_profiles`, then `taskos` (old key), then prompts. The `taskos` fallback (`p.claudeKey`) looks like an old storage schema that was replaced. Safe to remove; it also reveals the old storage key name which is unnecessary information in the browser source.

### 9. `_aiSuggestions` global never reset between planner sessions
- **File**: `givelink.html:1163`
- **Commit**: `1d3ea98` (2026-05-29)
- **What they likely meant**: Stash AI suggestions so `addSuggestedSprintTasks()` can read them. But if the modal is closed and reopened without re-generating, `_aiSuggestions` still holds the previous session's suggestions. If the user clicks "Add Selected" after cancelling, the old tasks are added. Should reset to `[]` on `openAiSprintPlanner()`.

### 10. `window.prompt()` used for activity logging and API key entry
- **Files**: `givelink.html:1086`, `givelink.html:1262`, `givelink.html:1431`
- **Commits**: Multiple (first appeared in `1d3ea98`)
- **What they likely meant**: Quick input without building a modal. Three separate `window.prompt` calls remain in the codebase. They're blocked on iOS PWA standalone mode and can't be styled or keyboard-trapped.

---

## 🤔 Worth a second look

### 11. `syncToTaskOS()` matches tasks by title string — case-insensitive
- **File**: `givelink.html:1224`, `1235`
- **Commit**: `1d3ea98` (2026-05-29)
- **Why it looks suspicious**: `tt.title.toLowerCase() === gt.title.toLowerCase()` is the dedup key. Two tasks with the same title but different pillars/sprint would be considered the same task. This could silently drop tasks from Task OS or mark wrong tasks as done. Looks intentional (titles are meant to be unique), but worth verifying with a real duplicate test case.

### 12. Sprint bar progress percent calculates from `new Date()` relative to sprint dates — not clamped correctly
- **File**: `givelink.html:455`
- **Commit**: `eeb9b8f` (2026-06-08)
- **Why it looks suspicious**: `sprintPct()` uses `Math.max(0, elapsed/total)` but doesn't clamp the upper end. If today > sprint end, `elapsed > total`, so `pct > 100`. The sprint bar fill would overflow. The `Math.max(0,...)` protects the lower bound but not the upper. Should be `Math.min(100, Math.max(0, ...))`.

### 13. `openCloseSprint()` pre-fills new sprint end date as `today + 15 days`
- **File**: `givelink.html:814–817`
- **Commit**: `0b54845` (2026-06-08)
- **Why it looks suspicious**: The default sprint length is hardcoded to 15 days. If the team uses 2-week sprints (14 days) this is fine, but if sprint length varies, every close-sprint flow requires a manual correction. Could read the length from the previous sprint for a smarter default.

### 14. Service worker serves `index.html` to `notificationclick` regardless of which app triggered the push
- **File**: `sw.js:47–54`
- **Commit**: `67de902` (2026-05-29)
- **Why it looks suspicious**: `data.url` is set to `self.location.origin + '/index.html'` for all push notifications. If a future push comes from a Givelink-specific event (sprint deadline, overdue CRM), it would open Task OS instead of `givelink.html`. The `data.url` in the push payload should be respected instead of hardcoded.
