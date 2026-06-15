# Weekly Triage — 2026-06-15

## 📊 Week at a glance
- Commits: 4 | Files changed: 1 (`index.html`) | Debt markers added: 0
- High-churn files: `index.html` (touched 4× in one day — Jun 8)
- All 4 commits are bug fixes; same root cause (modal-open guard) patched 3 separate times
- No test files exist in this repo; no test commits possible

---

## 🚨 Needs immediate attention

### 1. ~30+ modals still bypass `openM()` — PTR bug not fully fixed
`index.html` — multiple lines (sample: 2402, 3054, 3316, 4153, 4227, 4340, 4355, 4402, 4604, 4828, 4874, 5005, 5023, 5043, 5111, 5467, 5541, 5692, 5844, 5863…)  
Introduced: pre-existing; context from commits `eeb9b8f`, `70d4241`, `7b27281`, `0b54845`

The week's fixes correctly routed `showConfirm`, `showPrompt`, `_showAiLoader`, `openGlobalSearch`, and `openGivelinkMetrics` through `openM()` (which sets `body.modal-open`). But dozens of other modals — health, finance, invest, AI Lab, relationships, habit settings, discomfort, frog, batch, tweet, digest, photo, quick-add, start-day, someday-review, task-modal, goal-modal, values-modal, and the ai-out-modal second open path at line 4153 — still call `classList.remove('hidden')` directly. Pull-to-refresh can still fire behind all of them. This is the same production bug fixed four times this week, still present in the majority of modals.

---

### 2. `w.title` used alone in 3 AI context prompts — feeds blank data to Claude
`index.html:10181` (`aiSuggestWins`), `index.html:11609` (`aiMaslow`), `index.html:11620` (`aiEudaimonia`)  
Introduced: pre-existing; bug exposed by `0b54845` which confirmed wins from EOD ritual and Daily Challenge store `.text` not `.title`

```js
// These three functions all do:
const wins = (S.wins||[]).slice(-5).map(w => w.title).join(', ');
// Should be:
const wins = (S.wins||[]).slice(-5).map(w => w.title||w.text).filter(Boolean).join(', ');
```

The fix landed this week for `renderWins` (line 10149) and `_maybeShowWeeklyWrapped` (line 6825), but the AI analysis functions weren't updated. Any user who primarily logs wins via EOD ritual or Daily Challenge will get Claude analysis built on an empty wins list — silently wrong, no error surfaced.

---

### 3. Escape key fallback skips `_releaseFocus()` on `.mo` modals
`index.html:3644`  
Introduced: `0b54845` (the fix added `body.modal-open` removal but left the forEach intact)

```js
// Current code:
document.querySelectorAll('.mo:not(.hidden)').forEach(m => {
  m.classList.add('hidden'); editT=null; editG=null;
});
document.body.classList.remove('modal-open');

// Should be:
document.querySelectorAll('.mo:not(.hidden)').forEach(m => closeM(m.id));
```

When Escape closes a `.mo` modal (non-`.modal-bg` path), the focus trap (`_releaseFocus`) is never called. On iOS PWA this can leave focus locked inside an element that is now hidden, trapping keyboard navigation until the next `openM()` call.

---

## 🧹 Cleanup opportunities

### 4. 8 silent empty `catch(e){}` blocks swallow errors invisibly
`index.html:2433`, `2501`, `2877`, `3230`, `4516`, `8624`, `8657`, `8675`, `10054`  
All pre-existing.

These include the nav-collapse localStorage handler (2433), the weekly review draft restore (2877), the `_haptic` function (3230), and the XP award calls (4516, 10054). When these fail — corrupt localStorage, vibration API mismatch, XP schema drift — the app silently continues with no indication. At minimum, `console.warn(e)` so errors surface in DevTools.

---

### 5. `setTimeout(_attachSwipes, 0)` duplicated at 3 call sites
`index.html:2687`, `2804`, `7550`  
Line 7550 added by commit `eeb9b8f` as the fix for missing swipe gestures on Givelink task cards.

The 0ms timeout forces swipe binding after the current render tick. This works but is fragile: if `_attachSwipes` throws, it silently fails post-render with no stack trace attached to the calling function. Worth adding a single wrapper `_safeAttachSwipes()` with a `try/catch console.warn` and using it at all 3 sites.

---

### 6. `ai-out-modal` opened two different ways
`index.html:2321` (via `_showAiLoader`, now sets `modal-open`) vs `index.html:4153` (direct `classList.remove('hidden')`, does NOT set `modal-open`)  
Line 4153 pre-existing; 2321 fixed by `70d4241`.

The same modal has two open paths — one fixed, one still broken. The direct open at 4153 is inside what appears to be a second AI output display path. PTR can still fire behind it.

---

## 🤔 Worth a second look

### 7. Four fix commits on the same day, same root cause — piecemeal pattern
Commits `eeb9b8f` → `70d4241` → `7b27281` → `0b54845`, all Jun 8 09:32–09:45

Each commit fixed 1-4 instances of the same modal-open guard bug. The commits were pushed 3–9 minutes apart, suggesting fixes were being discovered by clicking through the app rather than from a systematic audit. The underlying pattern (30+ modal opens bypassing `openM()`) was never addressed at the root. Risk: same bug will keep surfacing in untested modals.

---

### 8. `discomfortLogs` null guard added in `completeLadderWeek` but not in the delete path
`index.html:4888` — `S.discomfortLogs=(S.discomfortLogs||[]).filter(...)` — already guarded ✓  
`index.html:4880` — `if(!S.discomfortLogs)S.discomfortLogs=[];` — also guarded ✓  
`index.html:5640` — new guard added by `0b54845` ✓

All write paths are now guarded. This item is resolved — noting here because commit message implied it was new but the manual add path at 4880 already had it.

---

### 9. `monthsToTarget` clamped to `null` but display code likely renders `null` as empty string
`index.html:7517` — fix from `eeb9b8f`

```js
monthsToTarget = raw > 0 ? raw : null;
```

The null is set when the target is already exceeded (negative months) or data is missing. It's worth confirming the rendering code downstream handles `null` gracefully (renders "—" or hides the field) rather than showing "null months to target". Low risk but worth a visual check on the Givelink dashboard with a target already met.

---

*Triage by automated Monday routine — 2026-06-15*
