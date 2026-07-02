# Weekly Triage — 2026-07-02

## 📊 Week at a glance
- **Commits this week**: 0 (last commit: `0b54845` on 2026-06-08)
- **Files changed**: 0
- **Debt markers added this week**: N/A — no activity
- **High-churn files (last month)**: `index.html` (committed in every PR #50–54), `sw.js` (unchanged since #50)

> No code was pushed in the last 7 days. Triage below is a static analysis of the current codebase — issues that exist now, not newly introduced this week.

---

## 🚨 Needs immediate attention

### 1. `load()` can crash the entire app — no error recovery
**File**: `givelink.html:448`  
**Introduced by**: core data layer (pre-history of this repo)  
**Why it matters**: `JSON.parse` on corrupted localStorage throws an unhandled exception. The sprint board renders blank with no way to recover short of clearing all data. Any interrupted save (quota exceeded, browser force-quit) leaves users locked out permanently.

```js
// current — will throw and kill the app:
function load(){ const d=localStorage.getItem('givelink_sprint'); if(d){ const p=JSON.parse(d); S={...S,...p}; } }
```

---

### 2. `callClaudeGL` doesn't check `res.ok` before parsing response
**File**: `givelink.html:1264–1271`  
**Introduced by**: `1d3ea98` (North Star / AI Workflows, 2026-05-29)  
**Why it matters**: The Standup Generator and Outreach Email features both use this helper. A 401 (bad key) or 429 (rate limit) returns `null` silently — the modal shows the loading state then blanks out, with no actionable error for the user. The Sprint Planner (added earlier) does the right thing at line 1145 with `if(!res.ok) throw`.

---

### 3. NP CRM modal DOM created once — buttons freeze in wrong state
**File**: `givelink.html:1358–1389`  
**Introduced by**: `67de902` (Supabase + features, 2026-05-29)  
**Why it matters**: If the "Add Org" modal is opened first, the Delete / Log Activity / Advance Stage buttons are never rendered. Every subsequent Edit session is missing its primary actions. User must reload the page to restore CRM edit capabilities.

---

### 4. Anthropic API key visible in plain localStorage
**File**: `givelink.html:1075–1088`, `givelink.html:1257–1261`  
**Introduced by**: `1d3ea98` (2026-05-29)  
**Why it matters**: `localStorage.getItem('taskos_api_key')` is readable by any browser extension or script running on the same origin. `window.prompt()` input is also logged in some browser password managers and dev tool histories. The key has active billing implications.

---

## 🧹 Cleanup opportunities

### 5. Two Claude API call patterns — neither complete
**File**: `givelink.html:1131–1160` (sprint planner), `givelink.html:1256–1272` (shared utility)  
**Commit**: `1d3ea98`  
**Why it matters**: The shared `callClaudeGL` was added as a utility but omits the error guards the sprint planner already had. New AI features will reach for the utility and silently inherit broken error handling. One pattern should be canonical.

---

### 6. `closeM()` clears task `editId` but not NP `editNpId`
**File**: `givelink.html:874`  
**Commit**: pre-`67de902` (closeM predates CRM addition)  
**Why it matters**: When CRM modals are dismissed via backdrop or Escape, `editNpId` retains the previously edited org's ID. `saveNP()` / `deleteNP()` then operate on the stale selection. Low-probability but: wrong org gets deleted.

---

### 7. Burndown snapshot not captured on task addition
**File**: `givelink.html:737–743`  
**Commit**: `67de902` (auto-snapshots feature)  
**Why it matters**: `_recordSnapshot()` only fires on `toggleDone`. Tasks added mid-sprint don't update `total` in existing snapshots, so the burndown ideal line starts from the wrong baseline.

---

### 8. Sprint Settings allows saving with empty date fields
**File**: `givelink.html:787–793`  
**Commit**: core data layer  
**Why it matters**: `saveSprint()` only validates date order when *both* fields are non-empty. Saving a blank end date produces `NaN days left` and a broken burndown chart.

---

### 9. Push notification icon `./icons/icon-192.png` doesn't exist in repo
**File**: `sw.js:38–39`  
**Commit**: `67de902`  
**Why it matters**: Any push notification attempt will silently fail to display the icon — or reject entirely on Android where icon is required. The manifest only registers `icon-gl.svg`.

---

### 10. Backlog filter tab visual state not restored on navigation return
**File**: `givelink.html:593–619`  
**Commit**: early sprint (`renderBacklog` was always this way)  
**Why it matters**: `S.blFilter` persists correctly, but `renderBacklog()` never re-applies the `.active` class to the matching tab. Users think their filter reset; click it again; which is a no-op — but erodes trust in the UI.

---

## 🤔 Worth a second look

### 11. `claude-opus-4-5` model ID in sprint planner may be stale
**File**: `givelink.html:1141`  
**Introduced by**: `1d3ea98`  
**Pattern**: The sprint planner uses `model:'claude-opus-4-5'` while the standup/outreach generator uses `'claude-haiku-4-5-20251001'`. Current model IDs per docs are `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`. If `claude-opus-4-5` is deprecated, the sprint planner silently returns an error that `runAiSprintPlanner`'s catch block surfaces as "Error: [model not found]".

---

### 12. Service worker cache key `task-os-20260530` is nearly 5 weeks stale
**File**: `sw.js:1`  
**Introduced by**: `67de902`  
**Pattern**: Four bug-fix commits (#51–54) landed on 2026-06-08 but the SW cache key was never bumped. Installed PWA users received bug fixes only after the browser's background SW update cycle (up to 24h). This is an intentional pattern or an oversight — document which.

---

### 13. `syncToTaskOS` pushes backlog tasks of any status, including `in-progress`
**File**: `givelink.html:1232–1247`  
**Introduced by**: `67de902`  
**Pattern**: `blTasks()` returns all tasks with `sprint==='backlog'` regardless of status. Tasks marked `in-progress` in the backlog (possible via edit) will be pushed to Task OS inbox with `status:'todo'`, resetting their state. Likely intentional but worth confirming with Panos.

---

### 14. `supabase-setup.sql` exists but Supabase sync appears incomplete
**File**: `supabase-setup.sql`, `index.html` (cloud sync implementation)  
**Introduced by**: `67de902`  
**Pattern**: The Supabase setup SQL was committed alongside the cloud-sync feature, but the feature is guarded behind a settings toggle and uses localStorage as the primary store. If the Supabase tables were never provisioned in production, any user who enables cloud sync will silently fail. No error state visible in the UI.
