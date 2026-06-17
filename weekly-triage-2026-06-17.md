# Weekly Triage — 2026-06-17

## 📊 Week at a glance

- **Commits this period:** 4 (all landed June 8 — 9 days ago; no commits in the strict last-7-day window)
- **Files changed:** 1 (`index.html` touched in all 4 commits)
- **Debt markers added:** 0 new TODOs / FIXMEs found in recently changed code
- **High-churn files:** `index.html` (4 commits in one day, all bug-fix passes — see below)
- **Feature commits without test commits:** All 4 — test coverage is zero across the codebase

> **Note on cadence:** The last burst of work was a 4-commit bug fix session on June 8. There has been no activity since (9 days). Either the project is intentionally pausing, or work is happening in a different branch/environment.

---

## 🚨 Needs immediate attention

### 1. `sw.js:38-39` — Push notifications reference non-existent icon path
**Introduced:** before tracked history; confirmed present in HEAD (`0b54845`)
**Code:** `icon:'./icons/icon-192.png', badge:'./icons/icon-192.png'`
**Why this matters:** The `icons/` directory does not exist in the repo. Any user who gets a push notification (reminders, ntfy) sees a broken icon or (on some iOS versions) a silently dropped notification. The Reminders feature added in recent sprints is non-functional from the user's perspective.

---

### 2. `vercel.json:14` — CSP blocks Google Fonts, app ships with system font fallback
**Introduced:** before tracked history; confirmed present in HEAD
**Code:** `"font-src 'self'"` (missing `fonts.gstatic.com`) and `"style-src 'self' 'unsafe-inline'"` (missing `fonts.googleapis.com`)
**Why this matters:** Inter is loaded from `fonts.googleapis.com` in `index.html:12-14`. The CSP actively blocks it. Every user on the Vercel deployment gets Arial/Helvetica, not Inter. The visual polish work from the last 15 commits is invisible in production.

---

### 3. `givelink.html:1147` — `runAiSprintPlanner` crashes on unexpected Claude response
**Introduced:** before tracked history; confirmed present in HEAD
**Code:** `const raw = data.content[0].text.trim();` — no null check or optional chaining
**Why this matters:** If Claude returns an error body (429 rate limit, 401 invalid key, partial stream), `data.content[0]` is undefined and the function throws. The modal freezes with no error shown to the user. This is the headline AI feature of the Givelink sprint board.

---

### 4. `givelink.html:437` — Default sprint expired 67 days ago
**Introduced:** before tracked history; confirmed present in HEAD
**Code:** `sprint:{name:'Sprint 1 — US Growth Push',start:'2026-03-28',end:'2026-04-11'}`
**Why this matters:** Any new device, incognito session, or first-time user hits a sprint that ended 67 days ago. Sprint metrics, days-left counter, and burndown chart are all stale/wrong. This is the first thing a new user sees when opening the Givelink board.

---

### 5. `index.html` — `body.modal-open` bug has been patched 3 times in one session — pattern not eliminated

**Introduced:** Patched in commits `eeb9b8f`, `70d4241`, `0b54845` all on June 8
**Pattern:** Three separate commits on the same day all fixed variants of the same bug: modal functions were not calling `openM()` / `closeM()` correctly, leaving `body.modal-open` in a stuck state, which blocked pull-to-refresh.
**Why this matters:** The root cause (manually calling `classList.remove('hidden')` instead of going through `closeM()`) still exists in dynamically-created modals (e.g., `_showNPModal` in `givelink.html:1361` — `m.classList.remove('hidden')` not `openM(m.id)`). The next modal added without using `openM()` will reproduce this exact bug.

**Immediate check:** Search for `classList.remove('hidden')` on `.mo` elements and ensure each also calls `openM()`:
```
grep -n "classList.remove('hidden')" index.html givelink.html | grep -v "//\|openM"
```
Result: `givelink.html:1400` — `m.classList.remove('hidden')` (np-modal) skips `openM()`, so body.modal-open is never set on the NP CRM edit modal.

---

## 🧹 Cleanup opportunities

### 6. `index.html:8657` — `_autoSnapshot()` has a completely silent `catch(e) {}`
**Introduced:** `67de902` (May 29 — Supabase sync + auto-snapshots)
**Code:** `} catch(e) {}` — empty block with no logging
**Why this matters:** The auto-snapshot feeds the Pace Engine / North Star Cockpit trend data. If it fails (localStorage full, JSON serialization error), charts go stale silently. At minimum, `console.warn('[autoSnapshot]', e)` should be here so failures show up in DevTools.

---

### 7. `index.html:2036` — State object `S` has 70+ top-level keys and a shallow merge strategy
**Introduced:** Grown incrementally across many commits
**Code:** `let S = { tasks:[], goals:[], ..., securityAuditLog:[] }` — 70+ keys; `load()` uses `{...S, ...JSON.parse(d)}`
**Why this matters:** Every new feature added a key to `S`. The shallow merge means any key in a user's old saved state that doesn't exist in the new defaults is preserved unchanged (fine), but any new key added to defaults is silently dropped for existing users unless it was already in their save (fine). However, field renames break silently — this is likely what caused the `wins.text` vs `wins.title` field mismatch fixed in commit `0b54845`.

**Action:** Before adding any new fields to `S`, document the schema version. Consider a migration pattern.

---

### 8. `givelink.html:1085-1086` — API key stored via `localStorage.setItem` with no try/catch
**Introduced:** before tracked history
**Code:** `if(k) localStorage.setItem('taskos_api_key', k);`
**Why this matters:** On devices where localStorage is full, this silently throws `QuotaExceededError`. The key is not saved, and every subsequent AI feature call prompts again. Low risk but annoying.

---

### 9. `givelink.html:1431` — `window.prompt()` used for activity logging
**Introduced:** before tracked history
**Code:** `const note = window.prompt('Log activity (what happened?):');`
**Why this matters:** iOS PWA mode blocks `window.prompt()` in some versions (returns null immediately). Users on installed Givelink PWA cannot log CRM activity without realising why it silently fails. This is a PWA-first product — `window.prompt()` is a dead end.

---

## 🤔 Worth a second look

### 10. `index.html:8638` — Supabase push queued with `setTimeout(2500ms)` after every `save()`
**Introduced:** `67de902` (May 29)
**Code:** `_sbTimer = setTimeout(() => { sbPush()... }, 2500);`
**Pattern:** Every save debounces a cloud push 2.5 seconds out. If the user saves repeatedly (typing task title, hitting Enter), the timer resets each time. On a slow connection, a push that takes >2.5s could overlap with the next scheduled push.
**Intent is clear** (debounce to avoid spamming Supabase), but there's no `_sbBusy` check inside the `setTimeout` callback — only before `sbSyncNow`. The `sbPush().then().catch()` chain at line 8638 runs even if `_sbBusy` is true.
**Suggested check:** Add `if (_sbBusy) return;` at the top of the `setTimeout` callback.

---

### 11. `givelink.html:1380` — Delete button in NP modal uses `editNpId` closure variable, not a passed `id`

**Code:**
```js
<div>${editNpId ? `<button class="btn bd" onclick="deleteNP()">Delete</button>` : ''}</div>
```
`deleteNP()` reads `editNpId` from the outer scope. The modal HTML is created once and reused — the delete button is only rendered on first `openEditNP()` if `editNpId` was already set when the template was generated. On second open, the HTML is not re-generated (modal exists), so the delete button's presence/absence is stale.

**Suggested check:** Open a nonprofit → close → open a different nonprofit → verify Delete button appears correctly both times.

---

### 12. `index.html:9301` — ntfy push notification sends to `https://ntfy.sh` without a topic guard
**Introduced:** before tracked history
**Code:** `return fetch('https://ntfy.sh', {...})` — but ntfy requires a topic in the URL path (`https://ntfy.sh/{topic}`)
**Why:** If `S.ntfy.topic` is empty string, the request goes to `https://ntfy.sh/` — the ntfy homepage, not a notification channel. The response is HTML (200 OK), not a push event. The `catch` won't fire. No error is surfaced.

**Suggested check:** Verify `S.ntfy.topic` is non-empty before constructing the URL; toast an error if it is.
