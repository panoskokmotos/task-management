# Givelink / Task OS — Improvement Plan

_Generated: 2026-05-28. Based on static analysis of `index.html` (11,595 lines), `givelink.html` (1,755 lines), `sw.js`, and `vercel.json`._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. XSS via unescaped user data injected into innerHTML
**What:** User-controlled task titles, notes, and checklist items are concatenated raw into `innerHTML`, making stored-XSS trivially exploitable.  
**Where:** `index.html` lines 1832, 2040, 2209, 2247, 2540, 2552, 2588, 3122, 3707 (and ~20 more); `givelink.html` lines 1175–1178  
**Why it matters:** Any task title containing `<script>` or `"><img onerror=...>` runs arbitrary JavaScript in the user's session, leaking all localStorage data including API keys.  
**Effort:** M  
**Suggested fix:**
- Audit every `innerHTML` assignment; replace with `textContent` wherever the value is plain text.
- For the handful of cases that need HTML (checklist bullets, rich notes), pipe through the existing `esc()` helper (defined around line 8610) consistently — it is already present but not used in most template literals.
- Add a short test: `document.querySelector('#task-title').innerHTML = '<img src=x onerror=alert(1)>'` should not fire after fix.

---

### 2. Backup import blindly overwrites all app state with no schema validation
**What:** `Object.assign(S, d)` merges an untrusted JSON file onto the global state object without checking field types or allowed keys.  
**Where:** `index.html` lines 1890–1892  
**Why it matters:** A malformed or malicious backup file silently corrupts or replaces the entire task database. One bad import = data loss with no recovery path.  
**Effort:** S  
**Suggested fix:**
- Validate the imported object against an explicit allowlist of fields and their expected types before merging.
- Only assign known keys: `const ALLOWED = ['tasks', 'goals', 'categories', ...]; ALLOWED.forEach(k => { if (d[k] !== undefined) S[k] = d[k]; });`
- Show a diff summary ("Importing 47 tasks — this will replace your current 31 tasks. Confirm?") before committing.

---

### 3. AI buttons can hang forever — no timeout on Claude API fetch calls
**What:** All `fetch()` calls to `api.anthropic.com` have no `AbortController` timeout; if the network stalls the button shows `⏳` indefinitely and never re-enables.  
**Where:** `index.html` line 2028 (`_aiBtn`), lines 4448–4455 (tweet generator), line 3637 (base AI call); `givelink.html` line 1140  
**Why it matters:** Users are left with frozen UI and no way to recover except a page reload, causing lost work if they had unsaved state.  
**Effort:** S  
**Suggested fix:**
- Wrap every AI fetch in an `AbortController` with a 30-second timeout: `const ac = new AbortController(); setTimeout(() => ac.abort(), 30000); fetch(url, { signal: ac.signal, ... })`.
- In the catch block for `AbortError`, show "Request timed out — try again" and re-enable the button.
- Add a global `_aiRunning` guard reset in all catch paths to prevent permanently stuck buttons.

---

### 4. Silent catch blocks swallow errors in user-facing flows
**What:** Eight or more `catch(e){}` and `catch(_){}` blocks silently discard failures in data loading, notification posting, and localStorage parsing.  
**Where:** `givelink.html` lines 1083, 1209, 1214; `index.html` lines 8035, 8169; `sw.js` line 32  
**Why it matters:** When these fail, the user sees a blank panel or stale data with no indication that something went wrong — debugging is impossible without DevTools.  
**Effort:** S  
**Suggested fix:**
- At minimum, log to `console.error(e)` in every catch block so failures surface in DevTools.
- For user-visible flows (profile load at line 1209, ToS data at 1214), show a non-blocking toast: "Couldn't load saved data — starting fresh."
- For the service worker (sw.js line 32), use `console.warn` since `console.error` is visible in the SW inspector.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. localStorage quota errors only caught in one place — data loss on full storage
**What:** `QuotaExceededError` from `localStorage.setItem` is only caught at line 1871; all other `save()` calls (including the main state serializer) are unguarded.  
**Where:** `index.html` — `save()` function and all call sites; only line 1871 catches the error  
**Why it matters:** When a user's localStorage fills up (common on mobile), the app silently fails to persist changes. Tasks created after that point vanish on reload with no warning.  
**Effort:** S  
**Suggested fix:**
- Wrap the `save()` function's `localStorage.setItem` in a try/catch for `QuotaExceededError`.
- Show a persistent banner: "Storage full — export a backup and clear old data to continue saving."
- Prune the history log (lines 2616–2618) to a rolling max of 500 entries on every save.

---

### 6. Greedy regex extracts wrong JSON from AI responses
**What:** The pattern `/\[[\s\S]*\]/` (and `/{[\s\S]*}/`) is maximally greedy — when Claude returns text containing multiple JSON arrays or objects, it captures from the first `[` to the very last `]`, producing invalid JSON or the wrong payload.  
**Where:** `index.html` lines 8292, 9068, 9173, 9271  
**Why it matters:** AI-generated task suggestions, weekly plans, and focus modes silently fail to parse, falling back to raw text display. Users see "AI Suggestions" dialogs with raw JSON blobs instead of structured output.  
**Effort:** S  
**Suggested fix:**
- Switch to a JSON streaming parser or use a conservative extraction: find the first `[` and track bracket depth to find its matching `]` rather than using greedy regex.
- Alternatively, instruct Claude in the system prompt to respond with only JSON (no prose wrapping), then `JSON.parse(text.trim())` directly with a fallback to regex on error.

---

### 7. Two different Claude model versions hardcoded across files — fragile versioning
**What:** `index.html` uses `claude-haiku-4-5-20251001` (line 3642) while `givelink.html` uses `claude-opus-4-5` (line 1140) — different capabilities, different costs, hardcoded strings that break when a model is retired.  
**Where:** `index.html` line 3642; `givelink.html` line 1140  
**Why it matters:** When Anthropic retires either model ID, all AI features in that file silently fail or return API errors. Users see "AI error: 404" with no guidance.  
**Effort:** S  
**Suggested fix:**
- Define a single `const AI_MODEL = 'claude-haiku-4-5-20251001'` constant near the top of each file (or in a shared config block).
- Align both files on the same model unless the cost/capability difference is intentional and documented.
- Add a settings toggle for "AI quality" (fast/cheap vs slow/powerful) that maps to model IDs, making future upgrades a one-line change.

---

### 8. API keys stored unencrypted in localStorage — visible to any injected script
**What:** The Claude API key, Readwise token, and Notion integration token are all stored as plaintext in `localStorage` and transmitted in request headers visible in browser DevTools.  
**Where:** `index.html` lines 3641, 7507, 7513–7516  
**Why it matters:** Any XSS (see item #1) immediately exfiltrates all credentials. On shared computers, tokens persist until manually cleared.  
**Effort:** M  
**Suggested fix:**
- This cannot be fully fixed client-side without a backend proxy. The immediate win: add a "Clear saved keys" button and warn users not to use the app on shared devices.
- For the Claude key specifically, consider routing requests through a Vercel Edge Function that holds the key server-side, so it never touches the browser.
- Display a one-time notice on first key entry: "Your API key is stored locally in this browser. Never use on a shared or public device."

---

### 9. Divs used as interactive buttons — keyboard and screen-reader inaccessible
**What:** Twenty-eight or more navigation items use `<div onclick="nav(...)">` instead of `<button>`, making them unreachable via keyboard Tab and invisible to screen readers.  
**Where:** `index.html` — `<div class="ni" onclick="nav(...)">` pattern throughout the sidebar navigation (lines ~380–460)  
**Why it matters:** Any keyboard-only or assistive-technology user cannot navigate the app at all. This is a WCAG 2.1 Level A failure.  
**Effort:** M  
**Suggested fix:**
- Replace `<div class="ni" onclick="...">` with `<button class="ni" onclick="...">` and add `type="button"`.
- Add CSS reset for button appearance: `button.ni { background: none; border: none; cursor: pointer; width: 100%; text-align: left; }`.
- Add `role="navigation"` and `aria-label="Main navigation"` to the sidebar container.

---

### 10. Modal dialogs do not trap focus — keyboard users tab out into background content
**What:** When modals open, keyboard focus is not moved into the modal, and Tab freely cycles to elements behind the overlay.  
**Where:** `index.html` lines 105–110 (modal container definitions); every `showModal()` call  
**Why it matters:** Keyboard users lose their place and can interact with disabled/blurred background controls, causing confusing state bugs.  
**Effort:** M  
**Suggested fix:**
- On modal open, use `modal.querySelector('[autofocus], button, [tabindex]')?.focus()` to move focus in.
- Add a focus-trap: capture `keydown` for Tab/Shift-Tab inside the modal and cycle within the modal's focusable elements.
- On modal close, return focus to the element that opened it (store a reference before opening).

---

### 11. Inconsistent accent colors between Task OS and Givelink — broken brand
**What:** Task OS uses `--accent: #58a6ff` (dark) / `#2563eb` (light) while Givelink uses `--accent: #3b82f6` — visually inconsistent across the same product.  
**Where:** `index.html` CSS custom properties (dark/light theme blocks); `givelink.html` CSS custom properties  
**Why it matters:** Users switching between Task OS and Givelink perceive them as different, unrelated products. Undermines brand trust and makes cross-selling harder.  
**Effort:** S  
**Suggested fix:**
- Align both files on the same accent color tokens: `#5718CA` (primary purple) and `#3b82f6` (interactive blue) as documented in the brand palette.
- Extract shared CSS variables into a `<link>`-ed stylesheet or a copy-paste comment block labelled `/* SHARED BRAND TOKENS — keep in sync */`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 12. Single 11,595-line HTML file mixes CSS, markup, and JavaScript — unmaintainable
**What:** `index.html` contains ~4,400 lines of inline CSS, ~1,200 lines of HTML, and ~10,000 lines of JavaScript in one file with no module boundaries.  
**Where:** `index.html` (entire file)  
**Why it matters:** Developers cannot search, diff, or review changes without scrolling through thousands of unrelated lines. Every PR touches the same file, causing constant merge conflicts.  
**Effort:** L  
**Suggested fix:**
- Extract CSS into `app.css`, JavaScript into `app.js` (or ES modules), and keep `index.html` as a thin shell — no build system required, just `<link>` and `<script src>`.
- Start with the largest self-contained JS sections (AI helpers, Readwise integration, export/import) as independent modules.
- Consider adopting a lightweight bundler (Vite) to enable hot reload and code splitting without requiring a full framework rewrite.

---

### 13. No rate limiting on Claude API calls — users can exhaust quota instantly
**What:** Multiple AI features can be triggered simultaneously; there is no debounce, queue, or per-minute cap on outbound Claude API requests.  
**Where:** `index.html` `_aiBtn` wrapper (line 2028) and all direct `callClaude()` invocations  
**Why it matters:** Power users hitting AI features rapidly receive opaque 429 errors; the app shows "AI error: 429" with no backoff or retry guidance.  
**Effort:** S  
**Suggested fix:**
- Add a request queue with a max concurrency of 1 (sequential) or 2 (parallel) using a simple semaphore counter.
- On 429 response, parse the `retry-after` header (if present) and show "Rate limited — retrying in Xs" with a progress indicator.
- The existing `_aiLock` global (line ~2028) is a partial start — extend it to a proper queue rather than a binary lock.

---

### 14. No input length limits on any form field — localStorage can be exhausted by long inputs
**What:** Task titles, notes, goal descriptions, and all other text inputs have no `maxlength` attribute or JavaScript length validation.  
**Where:** `index.html` all `<input>` and `<textarea>` elements for task creation and editing (lines 2324, 2735, 2999, 3167)  
**Why it matters:** A user pasting a large document into a notes field can exhaust localStorage in one action, blocking all future saves silently (see item #5).  
**Effort:** S  
**Suggested fix:**
- Add `maxlength="500"` to title fields and `maxlength="10000"` to notes/description fields.
- Show a character counter near textarea fields (`characters remaining: 9,847`).
- Enforce the limit in the JS save path as a secondary guard: `if (task.notes.length > 10000) task.notes = task.notes.slice(0, 10000);`

---

### 15. Uncleaned event listeners on every modal re-render — memory leak
**What:** Keyboard event listeners (e.g., `keydown` handlers for Escape/Enter) are added on every modal open but never removed, accumulating with each open/close cycle.  
**Where:** `index.html` lines 7525–7542 (global keydown), modal open handlers throughout  
**Why it matters:** Long-running sessions (the app targets daily users) accumulate hundreds of duplicate listeners, degrading performance and causing duplicate action bugs (e.g., pressing Escape triggers the handler N times).  
**Effort:** M  
**Suggested fix:**
- Store references to modal-scoped handlers and remove them on close: `modal.addEventListener('keydown', handler); /* on close */ modal.removeEventListener('keydown', handler);`
- For globally-scoped handlers, use `{ once: true }` where the handler should fire exactly once.
- Audit with DevTools → Memory → Event Listeners before and after implementing the fix.

---

### 16. Service Worker push notification parsing fails silently on malformed payloads
**What:** `sw.js` line 32 uses a bare `try/catch(_){}` to parse push notification data; on failure it falls back to an empty object, meaning notifications show blank titles and no URL to navigate to.  
**Where:** `sw.js` lines 28–35  
**Why it matters:** If the notification payload format changes (e.g., after an ntfy.sh API update), all push notifications silently show empty toasts — a broken feature with no diagnostic path.  
**Effort:** S  
**Suggested fix:**
- Log the parse error: `catch(e) { console.warn('[SW] Push parse error:', e, e.data); data = {}; }`
- Add explicit fallbacks: `title = data.title ?? 'Givelink notification'; url = data.url ?? '/';`
- Validate `e.notification.data?.url` existence before calling `clients.openWindow()` at line 48.

---

## 💡 P3 — Nice to have

### 17. No offline-to-online sync — edits made offline are never reconciled
**What:** The Service Worker caches the app shell for offline use, but changes made offline are not queued or synced when connectivity returns.  
**Where:** `sw.js` (no background sync logic); `index.html` save() function  
**Why it matters:** Users working on a flight or in spotty signal lose all edits made while offline without realizing it until they reload.  
**Effort:** L  
**Suggested fix:**
- Implement the [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Sync_API): queue failed saves in IndexedDB and replay them when `navigator.onLine` becomes true.
- Show an offline banner ("You're offline — changes will sync when reconnected") using `window.addEventListener('offline', ...)`.
- As a simpler interim: prompt users to export before closing if `navigator.onLine === false`.

---

### 18. Hardcoded sprint dates in givelink.html default template
**What:** The default sprint template uses `start: '2026-03-28', end: '2026-04-11'` as hardcoded initial values.  
**Where:** `givelink.html` line 437  
**Why it matters:** Every new user who opens Givelink sees a sprint that ended months ago as the default — confusing and unprofessional.  
**Effort:** S  
**Suggested fix:**
- Compute defaults dynamically: `start: new Date().toISOString().slice(0,10)`, `end: new Date(Date.now() + 14*86400000).toISOString().slice(0,10)`.
- Round start to the nearest Monday for sprint-hygiene UX.

---

### 19. CSP allows `unsafe-inline` scripts — weakens XSS mitigation at the infrastructure level
**What:** `vercel.json` sets `script-src 'self' 'unsafe-inline'`, which allows any inline `<script>` including those injected by XSS.  
**Where:** `vercel.json` line 14 (Content-Security-Policy header)  
**Why it matters:** Even after fixing item #1, `unsafe-inline` means a future XSS regression has no infrastructure-level backstop.  
**Effort:** M  
**Suggested fix:**
- Move all inline JavaScript to an external `app.js` file (which also addresses item #12), then remove `'unsafe-inline'` from the CSP.
- Use `'nonce-{random}'` as a transitional approach if full extraction is not immediate.
- Enable `upgrade-insecure-requests` and add `require-trusted-types-for 'script'` once inline scripts are gone.

---

### 20. History log grows unbounded — no pruning strategy
**What:** The task history log stored in localStorage (lines 2616–2618) appends every action with no maximum size or expiry.  
**Where:** `index.html` lines 2616–2618 and all `addHistory()` call sites  
**Why it matters:** After months of daily use, the history log alone can consume enough localStorage to trigger the quota error from item #5, and it is never visible to users anyway.  
**Effort:** S  
**Suggested fix:**
- Prune to the 200 most recent entries on every `addHistory()` call: `S.history = [...S.history, entry].slice(-200);`
- Add a "Clear history" option in Settings for users who want to recover storage space.
- Consider making history opt-in rather than always-on.

---

_Total items: 20 · P0: 4 · P1: 7 · P2: 5 · P3: 4_
