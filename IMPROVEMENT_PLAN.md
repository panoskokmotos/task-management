# Givelink Improvement Plan

Audited: 2026-06-09 | Files: `index.html` (12,893 lines), `givelink.html` (1,755 lines)

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. AI Sprint Planner crashes on unexpected API response
**What:** `callClaudeGL` accesses `data.content[0].text` without checking `data.content.length`, causing an uncaught TypeError if the API returns a non-standard response (rate limit, model error, empty content).  
**Where:** `givelink.html:1147`  
**Why it matters:** The entire AI Sprint Planning feature throws a hard crash for any user whose API key hits a rate limit or whose request gets an unexpected response format — a silent blank screen with no retry option.  
**Effort:** S  
**Suggested fix:**
- Replace `data.content[0].text` with `data.content?.[0]?.text`
- Add a guard: `if (!data.content?.length) throw new Error('Empty response from API')`
- The outer `catch` at line 1157 already renders an error div — just ensure it's reached

---

### 2. Wrong Claude model ID in Givelink — feature silently fails
**What:** `givelink.html` calls the API with `model:'claude-opus-4-5'`, a non-canonical model ID. `index.html` correctly uses `claude-haiku-4-5-20251001`. The Anthropic API rejects unknown model IDs with a 400, which hits the `if(!res.ok)` branch but shows a cryptic error message.  
**Where:** `givelink.html:1140`  
**Why it matters:** Every user who tries AI Sprint Planning sees "Error: …" with a raw API error body instead of suggestions — the feature is effectively broken.  
**Effort:** S  
**Suggested fix:**
- Change `model:'claude-opus-4-5'` to `model:'claude-opus-4-8'` (most capable) or `model:'claude-haiku-4-5-20251001'` (fastest/cheapest)
- Align with the model selection used in `index.html:4139` for consistency
- Verify the API key prompt flow in `getApiKey()` (line 1261) still works after fix

---

### 3. Cloud sync leaves UI stuck after swallowing refresh error
**What:** After applying remote state, `sbSyncNow` calls `refresh()` inside `try{refresh()}catch(e){}` — an empty catch. If `refresh()` throws (e.g., a `renderDash` crash), the UI is left showing stale data with no indication to the user, and `_sbApplying` stays false so the next sync skips pushing the now-stale local copy.  
**Where:** `index.html:8624`  
**Why it matters:** Users on multiple devices can silently lose their latest work after a sync if `refresh()` throws on the receiving end — they see old data and assume sync worked.  
**Effort:** S  
**Suggested fix:**
- At minimum: `catch(e){ console.error('refresh after sync failed:', e); toast('Sync applied but display error — reload to see latest'); }`
- Ensure `_sbApplying = false` is in a `finally` block so it always resets
- Consider wrapping the entire `sbSyncNow` body in `finally { _sbBusy = false; }` (currently only line 8632 does this)

---

### 4. NP Modal shows stale action buttons after reopen
**What:** `_showNPModal` creates the modal DOM once (`if(!m)`) but bakes the footer buttons (Delete, Log Activity, Next Stage) into the innerHTML at creation time using the current `editNpId`. Reopening the modal to add a new nonprofit still shows the Edit-mode delete/advance buttons — clicking Delete operates on the previously edited nonprofit.  
**Where:** `givelink.html:1358–1388`  
**Why it matters:** A user who edits nonprofit A, closes the modal, then opens it to add a new nonprofit could accidentally delete nonprofit A by clicking the residual Delete button.  
**Effort:** S  
**Suggested fix:**
- Move the footer button rendering out of the one-time `if(!m)` block
- After the modal exists, update the footer on every open: `document.getElementById('np-modal-footer').innerHTML = editNpId ? '...' : ''`
- Alternatively, always destroy and recreate the modal (simpler given its small size)

---

### 5. Unescaped task title injected into `<option>` HTML
**What:** `fillBlockerDrop` concatenates raw `t.title` into an HTML string without `esc()`. Every other task-rendering call in the file uses `esc()`. A task title containing `<`, `>`, or `"` breaks the dropdown rendering and creates a minor XSS vector.  
**Where:** `index.html:2062`  
**Why it matters:** A task titled `Fix <button> styling` causes the blocker dropdown to render broken HTML, hiding all tasks below it. Inconsistent with the rest of the codebase.  
**Effort:** S  
**Suggested fix:**
- Change `'>'+t.title.slice(0,45)+'</option>'` to `'>'+esc(t.title.slice(0,45))+'</option>'`
- The `esc()` helper is already defined and used consistently elsewhere

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 6. AI spinner hangs forever on network timeout — no recovery path
**What:** All `fetch()` calls to the Anthropic API have no `AbortController` or timeout. If the network stalls, the "⏳ Thinking…" / "⏳ Generating…" state never resolves. The button stays disabled; the only escape is a page reload.  
**Where:** `givelink.html:1131`, `index.html:4136`  
**Why it matters:** On mobile or slow connections this happens routinely — the user assumes the app is broken, reloads, and loses whatever they were doing.  
**Effort:** S  
**Suggested fix:**
- Wrap each `fetch` in an `AbortController` with a 30-second timeout: `const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 30000); fetch(url, { ..., signal: ctrl.signal })`
- On `AbortError`, surface: "Request timed out — check your connection and try again"
- Re-enable the trigger button unconditionally in a `finally` block

---

### 7. Sprint end date allows already-expired dates
**What:** Sprint date validation checks `end > start` but not `end >= today`. A team can save a sprint that ends yesterday, causing the burndown chart and velocity tracker to immediately show 100% overdue with no "sprint hasn't started" fallback state.  
**Where:** `givelink.html:789`  
**Why it matters:** New users setting up their first sprint may pick the wrong year (e.g., 2025 instead of 2026) and see a fully-red burndown chart with no explanation, making the tool look broken.  
**Effort:** S  
**Suggested fix:**
- Add: `if (new Date(end) < new Date().setHours(0,0,0,0)) { toast('Sprint end date must be today or in the future'); return; }`
- Consider showing a warning (not a block) if end date is within 2 days

---

### 8. No loading state or error recovery on `syncToTaskOS`
**What:** The "Sync to TaskOS" button in Givelink triggers a localStorage write but shows no visual feedback — no spinner, no disabled state, no success confirmation. On slow devices the user can click multiple times.  
**Where:** `givelink.html:254` (button), corresponding handler  
**Why it matters:** Users who share the device see duplicate data entries after rapid double-clicks; there is no "sync succeeded" confirmation so users don't know if the action worked.  
**Effort:** S  
**Suggested fix:**
- Disable the button during execution and show "Syncing…" text
- Show a toast on success: "✅ Synced to TaskOS"
- Show a toast on failure with a specific message (e.g., "TaskOS data not found — open TaskOS first")

---

### 9. Supabase sbPull error response silently merges as valid data
**What:** `sbPull` checks `if(!r.ok) throw` correctly. But `sbSyncNow` catches that throw and falls through to `sbPush` only if `remote` is null — if `sbPull` rejects, the catch at line 8632 calls `_sbSetStatus('Sync error')` but the local `S` state has already had `_sbApplying=true` set. A 401 token-expired response means the user's next `save()` call will push stale data and overwrite the remote.  
**Where:** `index.html:8612–8632`  
**Why it matters:** Token expiry (common after ~1 hour) can silently cause the local stale copy to overwrite fresh remote data — a data-loss scenario for users who work across devices.  
**Effort:** M  
**Suggested fix:**
- Set `_sbApplying = false` in a `finally` block, not inline
- On a 401 from `sbPull`, call `_sbRefreshToken()` before retrying once, then surface the error
- Add a clear "Session expired — reconnect cloud sync" toast with a Settings deep-link

---

### 10. Givelink outreach email generator button doesn't disable during generation
**What:** The "Generate Email" button in the outreach modal fires `generateOutreach()` but is not disabled during the async call. Rapid clicks queue multiple API requests, which can result in the modal being populated with the last response to return (not necessarily the last sent).  
**Where:** `givelink.html:1632` (function start), `givelink.html:1603–1614` (modal)  
**Why it matters:** A sales user quickly clicking through multiple nonprofits can accidentally send an AI-generated email meant for one nonprofit to a different one.  
**Effort:** S  
**Suggested fix:**
- Set `btn.disabled = true; btn.textContent = '⏳ Generating…'` at function start
- Re-enable in a `finally` block
- Scope the button reference from the modal element, not a global querySelector

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `renderDash()` is 160 lines of concatenated HTML strings
**What:** The entire dashboard is built in one 160-line function (`index.html:2460–2620`) that concatenates HTML strings for every widget — life score, top-3 goals, habits ring, weekly digest, etc.  
**Where:** `index.html:2460–2620`  
**Why it matters:** Any change to a single widget requires scanning the whole function; a missing backtick or quote breaks every widget below it. Three dashboard bugs in the last commit (`backdrop close`, `ladder crash`, `wins blank title`) all trace back to this function.  
**Effort:** M  
**Suggested fix:**
- Extract each widget into its own `renderDashXxx()` function (e.g., `renderDashLifeScore()`, `renderDashTop3()`)
- `renderDash()` becomes an orchestrator: `el.innerHTML = [renderDashLifeScore(), renderDashTop3(), ...].join('')`
- Start with the most-changed widgets; no need to refactor all at once

---

### 12. 9 empty `catch(e){}` blocks make debugging impossible
**What:** Nine catch blocks across `index.html` swallow errors completely with no logging, no user feedback, and no state cleanup.  
**Where:** `index.html:2433, 2877, 3230, 4516, 8624, 8657, 8675, 9310, 10054`  
**Why it matters:** When users report "the app stopped working", there is no signal in the console to diagnose. The sync-related empty catches (8624, 8657) are especially dangerous.  
**Effort:** S  
**Suggested fix:**
- For UI errors: `catch(e){ console.warn('[context]', e); }` at minimum
- For data-path errors (localStorage, sync): `catch(e){ console.error('[context]', e); toast('Something went wrong — try reloading'); }`
- The haptic catch at 3230 is the only genuinely safe one to leave empty

---

### 13. 10+ `.slice(-1)[0]` calls with no null guard
**What:** The pattern `(S.someArray||[]).slice(-1)[0]` is used in 10+ places to get the latest log entry. If the array is empty, this returns `undefined`, and the next line typically accesses a property on it, crashing with "Cannot read properties of undefined".  
**Where:** `index.html:2199, 2211, 2551, 2577, 4456, 6021, 6463, 10937, 10971, 11026`  
**Why it matters:** New users with empty logs (first day of use) hit these crashes immediately on the dashboard and review pages.  
**Effort:** S  
**Suggested fix:**
- Change every instance to `(S.someArray||[]).at(-1)` (returns `undefined` safely) and add a null guard on the next access
- Example: `const last = (S.wheelAssessments||[]).at(-1); if (!last) { /* render empty state */ return; }`
- Add a helper: `const last = arr => (arr||[]).at(-1)`

---

### 14. 32 `localStorage.setItem` calls with no `QuotaExceededError` handling
**What:** Only the main `save()` function at `index.html:2099` has a try/catch for `localStorage.setItem`. The other 31 calls (settings writes, sync credential writes, nav state writes) throw uncaught `QuotaExceededError` when storage is full.  
**Where:** `index.html:2433, 8556, 8557, 8558, 8559, 8573` and 26 others  
**Why it matters:** Users with many tasks (or other sites sharing the 5–10MB quota) can suddenly lose the ability to save any changes with no explanation.  
**Effort:** S  
**Suggested fix:**
- Extract a `safeSet(key, value)` helper that wraps `setItem` in try/catch and calls `toast('Storage full — export your data to free space')` on failure
- Replace all raw `localStorage.setItem` calls outside `save()` with `safeSet()`

---

### 15. Hardcoded hex colors bypass the CSS variable system
**What:** Several inline styles hardcode color values (`#ef4444`, `#58a6ff`, `#bc8cff`) instead of using the CSS custom properties already defined for them (`--error`, `--accent`, `--brand2`).  
**Where:** `index.html:524` (`#ef4444` on offline pill), `index.html:2069` (`#58a6ff` in theme toggle), `index.html:532–533` (workspace switcher uses both raw hex and vars), `givelink.html:1158` (`#ef4444` in AI error div)  
**Why it matters:** Light-mode support is already wired — but these hardcoded values ignore the theme toggle, so the offline pill and AI errors stay dark-red in light mode, breaking the theme.  
**Effort:** S  
**Suggested fix:**
- `#ef4444` → `var(--error)` or define `--error: #ef4444` in `:root` if not already present
- `#58a6ff` → `var(--accent)`
- `#bc8cff` → `var(--brand2)`
- Run a one-time grep for `style=".*#[0-9a-fA-F]{6}` to catch all remaining instances

---

### 16. Deprecated `document.execCommand('copy')` clipboard fallback
**What:** The standup copy button uses `navigator.clipboard.writeText()` with a fallback to `document.execCommand('copy')`, which is removed in all modern browsers (Chrome 126+, Firefox 116+).  
**Where:** `givelink.html:1521`  
**Why it matters:** The fallback is dead code that silently fails — users on unsupported contexts (e.g., HTTP, cross-origin iframe) see no copy and no error, and may think the standup text is lost.  
**Effort:** S  
**Suggested fix:**
- Remove the `execCommand` fallback entirely
- In the `.catch()`, show a toast with instructions: `toast('Copy failed — select the text manually (Ctrl+A, Ctrl+C)')`
- Or render the text in a `<textarea>` that auto-selects on click as the fallback

---

## 💡 P3 — Nice to have

---

### 17. Interactive `<div>` elements used instead of `<button>` in Givelink nav
**What:** Navigation items in Givelink are `<div class="ni" onclick=...>` elements with no `role`, `tabindex`, or ARIA attributes.  
**Where:** `givelink.html:233–244`  
**Why it matters:** Keyboard users cannot tab to navigation items; screen readers announce them as generic content, not controls. Low complexity to fix.  
**Effort:** S  
**Suggested fix:**
- Add `role="button" tabindex="0"` to each nav `<div>`, or change to `<button>` elements
- Add `onkeydown="if(e.key==='Enter'||e.key===' ')this.click()"` for keyboard activation

---

### 18. API keys stored in `localStorage` with no expiry or isolation
**What:** Anthropic API keys, Supabase tokens, Readwise tokens, and Notion tokens are all stored in `localStorage` as plaintext, accessible to any JS on the same origin and visible indefinitely in browser DevTools.  
**Where:** `index.html:8556–8559, 8573`, `givelink.html:1261`  
**Why it matters:** A single XSS on any same-origin page (including future features) exfiltrates all keys. Runtime keys (session-only) are better held in `sessionStorage`, which clears on tab close.  
**Effort:** M  
**Suggested fix:**
- Move `taskos_api_key`, `taskos_sb_access`, `taskos_sb_refresh` to `sessionStorage` — users re-enter on each session, consistent with the security model of a personal app
- Keep config values (URL, anon key) in `localStorage` since they're non-secret
- Add a "Remember API key" checkbox to opt into `localStorage` persistence

---

### 19. Service worker registration has no error handler
**What:** The service worker registration in `givelink.html` calls `.then()` with a success handler but no `.catch()`. A registration failure (e.g., HTTPS not available, browser policy) is silently swallowed.  
**Where:** `givelink.html:1721`  
**Why it matters:** Offline support silently breaks without any developer or user notification. In a PWA context this is a critical invisible failure.  
**Effort:** S  
**Suggested fix:**
- Add `.catch(err => console.warn('Service worker registration failed:', err))`
- Match the pattern used in `index.html`'s SW registration if it has better error handling

---

### 20. Givelink PWA manifest uses dark blue — off-brand on install
**What:** `manifest-givelink.json` sets `theme_color` and `background_color` to `#070d1a` (dark navy), while the stated brand palette uses purple (`#6B3FA0`) and pink (`#C2185B`). The PWA install splash screen and Android task switcher show dark navy instead of the brand purple.  
**Where:** `manifest-givelink.json` (entire file)  
**Why it matters:** First install impression — the splash screen color is the first branded moment in a PWA install flow, and it's currently off-brand. Low effort to fix.  
**Effort:** S  
**Suggested fix:**
- Change `theme_color` to `#6B3FA0` (brand purple)
- Change `background_color` to `#0d0a1a` (dark purple, stays dark but on-brand)
- Verify the icon `icon-gl.svg` has sufficient contrast against the new background color
