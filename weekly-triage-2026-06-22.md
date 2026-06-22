# Weekly Triage — 2026-06-22

> **Note:** No commits landed in the last 7 days (Jun 15–22). The most recent activity was a burst of 4 bug-fix commits on Jun 8. This report covers that activity window.

## 📊 Week at a glance
- Commits: 4 (all bug fixes, Jun 8) | Files changed: 1 | Debt markers: 0 new TODOs/FIXMEs
- High-churn file: **index.html** (touched in every commit this cycle — and every prior cycle)
- Architecture note: the entire app is a single **12,893-line, 870 KB HTML file**. Every fix is a surgery on a monolith.

---

## 🚨 Needs immediate attention

### 1. `openAddWin()` / `openAddBucketList()` / `openAddProject()` / `openAddWishlist()` bypass `openM()`
**index.html:10169, 10268, 10373, 10470** — introduced progressively across many commits

These four modal-openers use `element.classList.remove('hidden')` directly instead of `openM()`, so `body.modal-open` is never set. On mobile, pull-to-refresh can fire while the modal is open. Commits 70d4241 and 0b54845 fixed the backdrop-click and Escape-key paths that had the same root cause — these four open-paths are the next instances of the same bug. Fix: replace with `openM('win-modal')`, etc.

### 2. `closeModal()` (line 10584) is an incomplete `closeM()` — two close functions, one broken
**index.html:10584** — exists since before this cycle; silently perpetuates the `body.modal-open` bug

```js
function closeModal(id){document.getElementById(id)?.classList.add('hidden');}
```

`closeModal` doesn't call `_releaseFocus`, doesn't check for remaining open modals, and doesn't remove `body.modal-open`. It's used for win, bl, wish, proj, paste-import, and optionality modals. If any of these are ever opened via `openM()` (or if someone adds an `openM` call to fix item #1), their close path will leave the page locked. Fix: alias `closeModal = closeM` or delete it.

### 3. Claude API key stored inside the synced state blob `S`
**index.html:2036, 8506** — introduced in earlier commits; not changed this cycle

`S.claudeKey` is part of the main `S` object that is serialized and synced to Supabase via `sbPush()`. If cloud sync is enabled, the API key is transmitted to and stored on the Supabase backend. All other secrets (Readwise token, Notion token, Supabase credentials) are stored separately in localStorage and excluded from sync. Fix: move `claudeKey` out of `S` and into `localStorage.setItem('taskos_claude_key', k)` like the other keys.

### 4. `anthropic-dangerous-direct-browser-access` header — API key exposed to browser network tab
**index.html:4138** — pre-existing

The header is required for browser-direct calls but is an intentional security override. The API key is visible in DevTools network tab and in any browser extension with network access. For a PWA used by one person this is low severity, but worth acknowledging if shared or deployed publicly.

---

## 🧹 Cleanup opportunities

### 5. 9 empty `catch(e){}` blocks — silent error swallowing
- **index.html:2501** (`eeb9b8f`) — Weekly Review draft banner parse failure, hidden silently
- **index.html:2877** (`eeb9b8f`) — Wizard draft restore; a corrupt draft will silently do nothing
- **index.html:8624** — `refresh()` inside Supabase sync swallowed, no feedback
- **index.html:8657** — **`_sbAutosnap` entire body caught** — if daily auto-snapshot fails, data is silently not backed up; no alert, no status update
- **index.html:4516, 10054** — `awardXP` failures swallowed (acceptable)
- **index.html:2433, 3230, 8675** — nav-collapse state, haptics, nav init (acceptable)

The `_sbAutosnap` empty catch (8657) is the most dangerous: it's the entire function body, introduced in commit `67de902` (Supabase feature). A single exception (e.g. auth token expiry) means no snapshot is taken that day with no indication.

### 6. Hardcoded `claude-haiku-4-5-20251001` model string
**index.html:4139** — pre-existing

The model is baked into `callClaude()`. Every AI feature in the app uses it. Changing the model requires a code deploy. Consider making it a Settings field (already has a settings UI for the API key). Also: `anthropic-version: 2023-06-01` at the same line is the oldest available version — updating to a newer one costs nothing.

### 7. `seed()` is a 394-line function
**index.html:3659** — pre-existing, but touched in churn

Not a bug, but it's the second-most-risky function given its size and the amount of schema it assumes. A field rename (like the one fixed in `0b54845` for discomfortLogs) can silently produce wrong seed data.

### 8. `renderDash()` is 162 lines — highest churn target
**index.html:2460** — touched in every cycle

The single most-modified function across all recent commits. At 162 lines it's hard to reason about and the most likely location for the next bug. Worth extracting the widget-row rendering into sub-functions when there's capacity.

---

## 🤔 Worth a second look

### 9. Notion API called directly from browser — feature is permanently broken
**index.html:8929** (`67de902`)

The Notion API doesn't allow browser-origin requests (no CORS headers). The code handles this gracefully with a helpful fallback message, but the feature will never work as implemented. If Notion integration is a priority, it needs a thin proxy or a Supabase Edge Function.

### 10. Wins data model has two title fields: `.title` and `.text`
**index.html:10153, 6822** — fixed in `0b54845` but source of confusion persists

Wins from `saveWin()` set `.title`; wins from EOD ritual and Daily Challenge set `.text`. Both render sites now use `w.title||w.text` after the fix, but `saveWin()` at line 10174 still writes only `.title` and never `.text`. Any downstream code that uses only `.text` will show blank. Consider normalising on one field.

### 11. `_haptic()` catches and silently swallows all vibration errors
**index.html:3230** — pre-existing

`catch(e){}` on the vibration API is fine, but the function also runs during app-critical flows (task completion, XP awards). If a future caller wraps the return value, silent failure could be misleading.

### 12. `openGivelinkMetrics()` and `openM()` coupling
**index.html:7443** — fixed in `eeb9b8f`

The fix switched to `openM()` but `renderGivelinkDash()` added `setTimeout(_attachSwipes, 0)` as a separate fix in the same commit. If `renderGivelinkDash()` is called outside the normal nav flow (e.g. after sync), swipes might still not attach in time. Low risk, but worth a smoke test on mobile after sync completes.
