# Weekly Triage — 2026-06-27

## 📊 Week at a glance
- **Commits this week:** 0 — last commit was 2026-06-08 (19 days ago), commit `0b54845`
- **Files changed:** 0
- **Debt markers added:** 0 (no TODO/FIXME/HACK/console.debug in codebase)
- **High-churn files this period:** `index.html` (4 commits on 2026-06-08), `givelink.html` (2 commits on 2026-06-08)

No code was merged this week. The findings below are residue from the June 8 burst (4 commits in ~13 minutes) and the May 29 feature sprint.

---

## 🚨 Needs immediate attention

### 1. `findIndex(-1)` silently discards task/goal edits — `index.html:3115`, `3358`
**Commit introduced:** `0b54845` (the task/goal save path wasn't touched in that commit, but the Supabase sync at `67de902` created the race condition that makes this dangerous)
**Why this matters:** When `_sbScheduleSync` fires during an open edit modal, the remote-wins merge at line 8620 (`S={...S,...remote.data}`) replaces `S.tasks`. If the task was deleted on another device, the subsequent `saveTask()` calls `findIndex()` → `-1`, then assigns to `S.tasks[-1]` — a non-element property that `JSON.stringify` silently drops. The user's edit is discarded with no error shown.
```js
// index.html:3115
if(editT){const i=S.tasks.findIndex(t=>t.id===editT);S.tasks[i]={...S.tasks[i],...d};}
//                                                    ^^^^^^^^^ i could be -1
```
**Fix:** `if(i < 0){toast('⚠ Task no longer exists — edit not saved');closeM('tm');return;}`

### 2. Supabase sync failure invisible outside Settings panel — `index.html:8633-8638`
**Commit introduced:** `67de902`
**Why this matters:** The background auto-sync timer's `.catch` only calls `_sbSetStatus('⚠ ...')`, which renders inside Settings. A network drop or expired token silently fails — the user believes their cloud backup is current when it isn't. Next time they open the app on another device, they'll see stale data.
```js
// index.html:8637
sbPush().then(()=>_sbSetStatus('Synced ⬆ …')).catch(e=>_sbSetStatus('⚠ '+e.message));
// missing: toast('☁️ Sync failed — saved locally only', 4000)
```

### 3. Push notification icon path is broken — `sw.js:39-40`
**Commit introduced:** `67de902` (SW was added/updated in this commit)
**Why this matters:** `./icons/icon-192.png` does not exist in the repository. Push notifications render with a broken icon fallback. Verifiable: `ls /home/user/task-management/icons/` → directory does not exist.
```js
icon:'./icons/icon-192.png',   // 404 — no icons/ directory
badge:'./icons/icon-192.png',  // 404
```

---

## 🧹 Cleanup opportunities

### 4. Service worker cache key is 28 days stale — `sw.js:1`
**Commit introduced:** `67de902`
**Why this matters:** `const CACHE = 'task-os-20260530'` has not been bumped since the initial SW commit. Static assets (manifests, icons) use cache-first strategy — next time these files change, users with the current SW won't receive updates until the key is bumped manually. This is a process gap that will silently bite on the next deploy.

### 5. Supabase sync clobbers all local state without conflict resolution — `index.html:8618-8623`
**Commit introduced:** `67de902`
**Why this matters:** `S={...S,...remote.data}` performs a shallow merge where remote wins on every key. In a two-device scenario (edit on mobile → open on desktop before mobile sync completes), the mobile edits will be overwritten. A pre-merge snapshot (`localStorage.setItem('taskos_pre_sync_snapshot',...)`) would give a manual recovery path at near-zero cost.

### 6. `renderDash()` is 160+ lines; `seed()` is 391 lines mixing personal data with init logic
**Commit introduced:** `3a32d45` (dashboard nav rewrite) and earlier
**Why this matters:** The June 8 fixes required touching multiple unrelated sections of `renderDash()` in a single commit. At 160 lines per function, reviewability and future bug isolation is poor. `seed()` contains Greek task titles and personal health data hardcoded alongside app initialization — the two concerns should be separated.

---

## 🤔 Worth a second look

### 7. Four bug-fix commits shipped in 13 minutes on 2026-06-08
Commits `0b54845`, `7b27281`, `70d4241`, `eeb9b8f` were all pushed between 09:32 and 09:45 on June 8. Rapid-fire fixes like this sometimes introduce new bugs while fixing old ones, and the tight window suggests minimal testing between pushes.
- `70d4241` — modal-open guard to prevent PTR behind dialogs: check that the guard doesn't block legitimate modal interactions on iOS Safari
- `0b54845` — "fix backdrop close, ladder crash, wins blank title": the backdrop close fix added event logic; verify it was properly cleaned up and isn't leaking handlers

### 8. `_sbApplying` flag in `sbSyncNow` not reset on early-return paths — `index.html:8619-8623`
If `refresh()` throws inside the try block (line 8624 is wrapped in its own try/catch, ✓), `_sbApplying` is correctly reset. But if the outer try throws before reaching `_sbApplying=false` (line 8623), the flag stays true permanently, causing `_sbScheduleSync` to skip all future syncs (line 8634 checks `if(!_sbEnabled()||_sbApplying)return`). This is a variant of the classic "flag not reset in finally" pattern.
```js
// index.html:8619-8623
_sbApplying=true;
S={...S,...remote.data};
S._updatedAt=remote.ms;
save();                        // if save() throws, _sbApplying stays true
_sbApplying=false;             // should be in a finally block
```

### 9. No timeout on `callClaude()` — hung requests block AI buttons indefinitely
`_aiBtn` at line 2258 uses a `finally` block to reset the button state, which handles most cases. But `callClaude()` itself has no `AbortController` timeout. If the Claude API is slow or the network stalls (common on mobile), the button stays in the `⏳` state for the full TCP timeout (~120s), with no way for the user to cancel and retry.
```js
// index.html:4138 — no AbortSignal passed to fetch
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method:'POST', headers:{...}, body:JSON.stringify({...})
  // missing: signal: AbortSignal.timeout(30000)
});
```
