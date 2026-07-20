# Weekly Triage — 2026-07-20

## 📊 Week at a glance
- **Commits:** 12 | **Files changed:** 12 unique files | **Debt markers added:** 0 explicit (no TODO/FIXME)
- **Week summary:** Intense sprint — entire PLG stack shipped in 5 days: guest mode, onboarding tour, share-the-win cards, referral links, templates gallery, and a complete rebrand (Task OS → Arete)
- **High-churn files:**
  1. `index.html` — touched in all 12 commits (14 924 lines, single file = whole product)
  2. `sw.js` — touched in 9 commits (caching strategy changed repeatedly alongside PLG features)
  3. `landing.html` — touched in 3 commits (pitch page rebuilt twice in one week)

---

## 🚨 Needs immediate attention

### 1. Push notification icon is a 404 — introduced in rebrand commit
**File:** `sw.js:46–47`  
**Commit:** `0c1d32d` (Rebrand to Arete)  
**What:** During the rebrand, assets were reorganised but the push notification handler was left pointing to `'./icons/icon-192.png'` — a path that has never existed. The actual file is `'./icon-192.png'`.  
**Why this matters:** Every user who has enabled reminders receives push notifications with a broken icon. The reminder loop is a stated retention feature, and it silently looks broken on all platforms right now.

---

### 2. Social share card renders "Task OS" — introduced when the feature shipped, missed in rebrand
**File:** `index.html:10214–10215`  
**Commit:** `fb63461` (PLG Tier 2: shareable progress card) → missed in `72d9c68` (brand consistency sweep)  
**What:** `_drawStatsCard()` draws `fillText('Task', …)` + `fillText('OS', …)` directly onto the canvas. The commit `72d9c68` explicitly purged stray old-brand colours but didn't touch this function.  
**Why this matters:** Every user who taps "Share my progress" generates and shares an image that says "Task OS" — the old brand. This is the highest-visibility surface (it's promoted in the account menu). Already burned into PNGs that users have shared externally.

---

### 3. CSP blocks Google Fonts — Inter does not load in production
**File:** `vercel.json:15`  
**Commit:** `0c1d32d` (same rebrand commit that added the security headers)  
**What:** `style-src 'self' 'unsafe-inline'` and `font-src 'self'` were set without adding `fonts.googleapis.com` and `fonts.gstatic.com`. The browser enforces the CSP and blocks the Inter stylesheet + font files.  
**Why this matters:** The app's entire typography system uses Inter. In production, all text renders in the OS system font. The design intent — the Inter weight range from 400 to 800 — is invisible to every production user.

---

### 4. `importData()` introduced this week with no confirmation dialog
**File:** `index.html:2636–2638`  
**Commit:** `f883adf` (PLG Tier 1: templates gallery + import)  
**What:** The import feature was added with `Object.assign(S, d)` firing immediately on file selection — no "are you sure?", no auto-backup before overwrite. A misclick irreversibly destroys all tasks, goals, and habits.  
**Why this matters:** This was shipped alongside the templates gallery which drives users to "Restore from backup" in the sync menu. This is a new code path users will hit soon. One misclick = total data loss.

---

## 🧹 Cleanup opportunities

### 5. Export filenames still use old "taskos-" prefix
**File:** `index.html:2602, 2628, 2652, 2668, 10243, 10247`  
**Commit:** Pre-existing, not fixed in `72d9c68` brand-consistency sweep  
**What:** `exportData()`, `exportICS()`, `exportCSV()`, `exportMarkdown()` all download files named `taskos-backup-…`, `taskos-tasks-…`. The share card PNG is `'taskos-progress.png'`.  
**Why this matters:** Users see the old brand in their Downloads folder. Easy to fix in the brand consistency pass that's clearly already in progress.

---

### 6. `localStorage` guest key and main data key still use "taskos" prefix
**File:** `index.html:9963–9972, 2580, 2598, 10468`  
**Commit:** Guest mode introduced in `0e19b15` using `localStorage.setItem('taskos_guest', '1')`; data key `'taskos'` predates this week  
**What:** All `taskos_*` localStorage keys (auth tokens, guest flag, nav state, onboarding) and the main `'taskos'` data blob are not renamed.  
**Why this matters:** If these keys change in a future release without a migration shim, existing users silently lose their local state (app appears empty). Cheaper to rename now with a migration than later with 10x the users.

---

### 7. `arete_fr_done` key mixes naming conventions with `taskos_` keys
**File:** `index.html:10384, 10496`  
**Commit:** `0c1d32d` (first-run feature)  
**What:** The first-run completion flag uses `'arete_fr_done'` but all surrounding keys use `'taskos_'`. This inconsistency suggests the rename was partially started for new keys but not completed for existing ones.  
**Why this matters:** Not a bug now, but signals the partial-state of the key rename. Good candidate to clean up when doing item 6.

---

### 8. `_sbToken()` has no re-auth prompt when refresh token expires
**File:** `index.html:10022–10026`  
**Commit:** Pre-existing  
**What:** When the 7-day Supabase refresh token expires, `_sbToken()` throws and sync silently shows "⚠ Sync error — retry". Retrying a bad refresh token just loops the same error.  
**Why this matters:** Users who open the app after >7 days of inactivity will be silently logged out of sync with no actionable message. The sync pill says "Sync error" but gives no path to re-authenticate.

---

## 🤔 Worth a second look

### 9. `_startFirstRun()` can be triggered 4+ times by different code paths
**File:** `index.html:10138, 10384, 10433, 10465, 10477`  
**Commit:** `0c1d32d` + `0e19b15` + `f883adf` (multiple features added entry points)  
**What:** `_startFirstRun()` is called from: post-auth callback, boot for non-hosted empty state, `sbSyncNow` for new accounts, `_welcomeSeed()`, and `_enterGuest()`. There is a guard `if(el.style.display==='flex')return` but it relies on DOM state, not a persistent flag.  
**Why this matters:** If any of these paths fire out of order (e.g., rapid guest → signup → sync on slow connection), the first-run screen could appear multiple times in a session. Worth adding a module-level boolean flag as a more reliable guard.

---

### 10. AI proxy call in `callClaude()` sends no timeout — requests can hang indefinitely
**File:** `index.html:5014–5018`  
**Commit:** Pre-existing  
**What:** Both the proxy path and the direct Anthropic path use plain `fetch()` with no `AbortController` timeout. If the Anthropic API hangs or the network drops mid-request, the AI button stays in its spinner state forever.  
**Why this matters:** Several AI features (Plan Day, Inbox Triage) are prominent dashboard features. A hung request locks the button until the user reloads the tab. More visible now that `_aiBtn()` is the standard wrapper for all 20+ AI actions.

---

### 11. `_sbScheduleSync()` debounce timer but `sbPush()` called directly — race possible
**File:** `index.html:10606–10614`  
**Commit:** Pre-existing  
**What:** `_sbScheduleSync()` debounces pushes with a timer, but some call sites (e.g., `_afterAuth()` at line 10131, `sbConnect()` at line 10048) call `sbSyncNow(true)` directly, bypassing the debounce. If `save()` fires during an in-progress `sbPush()`, `_sbBusy` is still true and the schedule is silently skipped.  
**Why this matters:** Rare but possible to drop a sync on rapid save-then-auth sequences (e.g., user edits a task during onboarding and immediately hits Sign Up). Low probability but worth a defensive check.

---

*11 items. Ordered: P0s first, then cleanup, then suspicious patterns. All file:line references verified against current HEAD.*
