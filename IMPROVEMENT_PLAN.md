# Givelink / Task OS — Improvement Plan
_Generated: 2026-06-27_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `findIndex()` result unchecked — silent task & goal edit discard

**What:** `saveTask()` and `saveGoal()` call `findIndex()` and immediately index into the array without checking for `-1`, silently discarding the user's edit with no error shown.

**Where:** `index.html:3115`, `index.html:3358`

```js
// line 3115 — task save
if(editT){const i=S.tasks.findIndex(t=>t.id===editT);S.tasks[i]={...S.tasks[i],...d};}
// line 3358 — goal save
if(editG){const i=S.goals.findIndex(g=>g.id===editG);S.goals[i]={...S.goals[i],...d};}
```

**Why it matters:** When Supabase background sync fires (`_sbScheduleSync` at line 8633) while a task modal is open, the remote payload at line 8620 (`S={...S,...remote.data}`) replaces the full `S.tasks` array. If the remote was pulled from another session that deleted that task, the subsequent `findIndex()` returns `-1`. In JavaScript `arr[-1] = x` creates a non-element property that `JSON.stringify` silently drops — the user's edit vanishes with no feedback.

**Effort:** S

**Suggested fix:**
- Add an `if(i < 0)` guard in both functions; show a toast and return early
- Example: `if(i < 0){toast('⚠ Task was modified elsewhere — please re-open and re-save');closeM('tm');return;}`
- Apply the same pattern anywhere else `findIndex()` feeds a direct array assignment (also `softDelete` at line 2259 uses `splice(idx,1)` which is already guarded with `if(idx<0)return` ✓)

---

### 2. Supabase sync failure is invisible outside Settings

**What:** Background auto-sync failures (network errors, token expiry) only update a status label inside the Settings panel — no toast shown, no badge on the sync button, so users never know their data wasn't persisted to the cloud.

**Where:** `index.html:8633-8638` (`_sbScheduleSync`), `index.html:8630` (`sbSyncNow` catch)

```js
// background timer — catch only updates hidden status label
sbPush().then(()=>_sbSetStatus('Synced ⬆ …')).catch(e=>_sbSetStatus('⚠ '+e.message));
```

**Why it matters:** If a session ends while sync is failing silently, the latest writes exist only in localStorage. A user who relies on cloud sync for cross-device access will open the app on their phone and see stale data — possibly hours stale — without knowing why.

**Effort:** S

**Suggested fix:**
- In `_sbScheduleSync`'s `.catch`, call `toast('☁️ Sync error — changes saved locally only',4000)` in addition to `_sbSetStatus`
- Track consecutive failures; after 3 in a row, show a persistent warning banner
- Add a visual indicator (dot or icon) on the sidebar sync button when status starts with `⚠`

---

## ⚡ P1 — High ROI (UX friction blocking engagement)

### 3. No loading state during AI calls — app appears frozen

**What:** Every AI-powered modal (`openBatchSuggestions`, `aiWheelInsight`, `openAiDigest`, `_aiWorkflowRun`, etc.) relies on the caller rendering a `⏳ Analyzing…` string inside the result container, but the calling button doesn't enter a disabled/loading state until `_aiBtn` processes it — creating a window where the user can click again or think nothing happened.

**Where:** `index.html:2258` (`_aiBtn` wrapper), ~line 5021 (`showBatchSuggestions`), ~line 6020 (Wheel modal)

**Why it matters:** On slow connections or during multi-step AI calls, the UI stalls for 3-8 seconds with no spinner on the triggering button. Users re-tap, fire duplicate requests, and sometimes see overlapping modal content.

**Effort:** M

**Suggested fix:**
- `_aiBtn` already disables the button and shows `⏳` — audit all AI-triggering buttons to ensure they use `_aiBtn` rather than calling `callClaude()` directly
- Add a `min-height` + skeleton pulse on AI result containers so the space is reserved before the response arrives
- Add a global `AbortController` in `callClaude()` with a 30-second timeout to prevent indefinitely-pending requests

---

### 4. `givelink.html` navigation is completely keyboard-inaccessible

**What:** Every nav item in the Givelink sidebar is a `<div onclick=...>` — not a `<button>` or `<a>` — and there are no `:focus-visible` styles defined anywhere in `givelink.html`. Tab key moves to the browser chrome; the sprint board cannot be operated without a mouse.

**Where:** `givelink.html:233-244` (nav items), `givelink.html` CSS section (missing focus styles)

```html
<div class="ni active" onclick="nav('overview')">📊 Overview</div>
```

**Why it matters:** Keyboard-only users and screen-reader users are locked out of the sprint board entirely. This is a WCAG 2.1 Level A failure (1.3.1 Info and Relationships, 2.1.1 Keyboard).

**Effort:** S

**Suggested fix:**
- Replace all `<div class="ni" onclick="...">` with `<button class="ni" onclick="...">` and remove `cursor:pointer` (browsers provide it for buttons)
- Add `button.ni:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` to the CSS
- Apply the same fix to the overlay `<div class="sb-ov" onclick="...">` at line 219

---

### 5. `--muted` text contrast fails WCAG AA in `givelink.html`

**What:** `--muted: #4e6180` on `--bg: #070d1a` yields a contrast ratio of approximately 2.9:1 — well below the 4.5:1 minimum for normal text (WCAG 2.1 AA). Affected elements include progress labels, sprint meta, badge counts, and navigation section headers.

**Where:** `givelink.html:17` (variable definition), lines 29-32 (sprint meta, `.ns`, `.logo-sub`), lines 71/75 (`.prog-label`, `.prog-pct`)

**Why it matters:** Text that team members can't comfortably read in dark environments (offices, evening standups) creates friction at exactly the moment the board is most needed. May also fail automated a11y scans if ever embedded in a product.

**Effort:** S

**Suggested fix:**
- Increase `--muted` to `#7a90ab` (ratio ~4.6:1 on `#070d1a`)
- Verify the change doesn't destroy the visual hierarchy — demote section labels like `.ns` to uppercase + letter-spacing to maintain hierarchy without relying on darkness alone

---

### 6. Touch targets on checkboxes are 16–20 px — far below the 44 px minimum

**What:** Task checkboxes (`.ck2`) in `givelink.html` are 16×16 px and goal checkboxes (`.gcheck`) are 20×20 px. In `index.html` the main checkbox `.ck` is 18×18 px. These are the single most-tapped element in any task app.

**Where:** `givelink.html:81` (`.ck2`), `givelink.html:65` (`.gcheck`), `index.html:~2047` (`.ck`)

**Why it matters:** Missed taps on task completion are the single highest-friction moment for mobile users. Increasing the tap target has near-zero visual cost and direct conversion impact.

**Effort:** S

**Suggested fix:**
- Use a CSS pseudo-element hit-area trick: `position:relative; &::after { content:''; position:absolute; inset:-12px; }` — expands tap zone to 40×40 px without changing layout
- Or simply increase to `width:22px; height:22px` (still compact, usable on mobile)
- Align with index.html's `.ck` which is 26×26 px after the v45 mobile pass

---

### 7. Supabase sync blindly clobbers local state without a conflict diff

**What:** When remote data is newer than local, `sbSyncNow` does `S={...S,...remote.data}` which overwrites all local keys with remote values, including state the user may have just modified in the same session.

**Where:** `index.html:8618-8623`

```js
S={...S,...remote.data};   // no field-level merge, no conflict resolution
```

**Why it matters:** A user edits tasks on mobile (local write, sync timer not yet fired), then opens the laptop (where a sync fires immediately on load), and the mobile edits are overwritten. Data loss is guaranteed in any concurrent session scenario.

**Effort:** M

**Suggested fix:**
- Implement field-level last-write-wins: compare `S.tasks._updatedAt` vs `remote.data.tasks._updatedAt` per collection, not the whole blob
- Alternatively, keep the current coarse merge but prompt with a toast: "Newer data found on cloud — merge applied. [Undo]" with a 10-second undo window backed by a snapshot
- At minimum: take a `localStorage.setItem('taskos_pre_sync_snapshot', JSON.stringify(S))` before every remote-wins merge so the user can manually recover

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 8. Service worker cache key is a hardcoded date — stale after every deploy

**What:** `const CACHE = 'task-os-20260530'` in `sw.js` was last updated on May 30. Static assets (manifests, icons) are cached under this key using cache-first strategy. When the next deploy happens, these files will NOT update for users who already have the SW installed, unless the cache key is manually bumped.

**Where:** `sw.js:1`

**Why it matters:** Next time `manifest.json` or an icon changes, existing users will see the old version indefinitely. Also a process tax — easy to forget to bump before shipping.

**Effort:** S

**Suggested fix:**
- Replace with a comment-driven version string that's bumped with each deploy: `const CACHE = 'task-os-v55';` (matches commit number)
- Or add a deploy script / pre-commit hook that injects the current date automatically
- Add the cache bump to the PR checklist / deploy runbook

---

### 9. Event listeners added without corresponding cleanup — memory leak in long sessions

**What:** Global event listeners (keydown, scroll, touchstart, pointermove) are added throughout the app but there is only one `removeEventListener` call in the entire 12,893-line file. Modal-specific handlers added in `openM()` accumulate on every modal open.

**Where:** `index.html:8661` (keyboard listener), `index.html:3659+` (touch handlers for drag), `index.html:2258` (`_aiBtn`)

**Why it matters:** Task OS is used for hours daily as a PWA. Over a long session, duplicate keydown handlers trigger commands multiple times; in extreme cases this causes the CPU fan to spin up and gestures to fire unexpectedly.

**Effort:** M

**Suggested fix:**
- For modal-scoped listeners, create an `_modalListeners = []` array, push each `{el, type, fn}`, and clean up in `closeM()` via `removeEventListener`
- For global singleton listeners (keyboard shortcuts), use `{ once: true }` where appropriate or hoist to top-level init and never re-register
- Audit the drag-and-drop touchstart/touchmove/touchend chain (around line 3659) — these should be registered on the list container, not on individual items

---

### 10. `renderDash()` is 160+ lines; `seed()` is 391 lines of personal data

**What:** The dashboard render function handles stats, widget rendering, XP bars, weekly goals, theme, banners, and top-3 tasks — making any single dashboard change risky. `seed()` is a 391-line function containing hardcoded personal Greek/English tasks interspersed with initialization logic.

**Where:** `index.html` around line 2460 (`renderDash`), line 3659 (`seed`)

**Why it matters:** Every dashboard feature change requires reading 160 lines to understand side effects. `seed()` cannot safely be removed without extracting the app-init logic that's embedded within it.

**Effort:** M

**Suggested fix:**
- Extract `renderDash` into `_renderDashStats()`, `_renderDashTop3()`, `_renderDashWidgets()`, `_renderDashBanners()` — each under 40 lines
- Move seed task data to an inline JSON constant at the top of `seed()`, separated from the init logic
- Mark `seed()` as a dev-only function (it already checks `if(S.tasks.length)return` — this is fine, just needs documentation)

---

### 11. Three parallel modal systems cause inconsistent behavior

**What:** Modals are opened/closed using three different patterns: (a) `openM(id)` / `closeM(id)` functions, (b) direct `classList.remove('hidden')` at call sites (~15 locations), and (c) a separate `closeModal()` function at line 10584 that duplicates `closeM()`.

**Where:** `index.html:3391` (`openM`), `index.html:10584` (`closeModal`), scattered `classList.remove('hidden')` calls

**Why it matters:** Modals opened via pattern (b) bypass the backdrop registration and keyboard-trap logic in `openM()`, meaning Escape key doesn't close them and screen readers lose focus context.

**Effort:** M

**Suggested fix:**
- Audit all `classList.remove('hidden')` modal opens; replace with `openM(id)`
- Delete `closeModal()` and replace its 3 call sites with `closeM()`
- Add an assertion in dev mode: `if(!id in _modalStack) console.warn('Modal opened without openM:', id)`

---

### 12. `localStorage` writes not protected from `QuotaExceededError`

**What:** The primary `save()` function at line 2099 (`localStorage.setItem('taskos', JSON.stringify(S))`) is wrapped in try/catch, but ~15 other `setItem` calls (theme, navigation state, API keys, frog flags) are bare — they will throw uncaught exceptions when storage is full.

**Where:** `index.html:2077` (`taskos_theme`), `index.html:8556-8558` (Supabase tokens), `index.html:5006` (frog flag), and ~12 more locations

**Why it matters:** Mobile browsers (especially Safari) impose strict per-origin localStorage quotas. A user who has accumulated months of task data plus Supabase tokens can hit the limit mid-session, causing silent failures on unprotected writes and potentially corrupting the token store.

**Effort:** S

**Suggested fix:**
- Create a `lsSet(key, val)` wrapper: `try{localStorage.setItem(key,val);}catch(e){if(e.name==='QuotaExceededError')toast('⚠ Storage full — old snapshots may need to be cleared');}` 
- Replace all bare `localStorage.setItem` calls with `lsSet`
- Add a Settings button to clear old snapshots and review storage usage: `navigator.storage?.estimate()` gives remaining quota on supported browsers

---

## 💡 P3 — Nice to have

### 13. `esc()` sanitizer not applied consistently — potential XSS from task titles

**What:** The `esc()` HTML-escaping helper exists and is used in some `innerHTML` string templates (e.g., Readwise book titles at line 8837), but a scan of the ~336 `.innerHTML =` assignments shows many task title, goal title, and note insertions that bypass it and insert raw user-controlled strings.

**Where:** `index.html` — multiple render functions including task cards, goal cards, journal entries

**Why it matters:** For a single-user personal app the XSS risk is low (you'd be attacking yourself). But if the app is ever shared or exported to HTML (Notion export, public Givelink view), untrusted task titles could execute scripts.

**Effort:** M

**Suggested fix:**
- Audit all `.innerHTML` assignments that include `task.title`, `goal.title`, `note.text` — apply `esc()` to each
- Consider a linter rule or grep pre-commit hook: `git diff HEAD | grep '\.innerHTML.*S\.' | grep -v 'esc('` to catch future regressions

---

### 14. Design tokens are inconsistent between `index.html` and `givelink.html`

**What:** The two files define completely separate CSS variable sets with different names and values — `index.html` uses `--bg`, `--surface`, `--surface2`, `--border`, `--accent: #58a6ff` while `givelink.html` uses `--bg`, `--sf`, `--s2`, `--border`, `--accent: #3b82f6`. A component copy-pasted between files will look different.

**Where:** `index.html:14-32` (`:root`), `givelink.html:15-20` (`:root`)

**Why it matters:** Any future shared component (e.g., a task card shared between both boards) requires manual token translation. Navigation consistency between apps suffers.

**Effort:** L

**Suggested fix:**
- Create a shared `tokens.css` file (or a `<style>` block injected via a build step) with canonical variable names
- This is the right precursor to a proper design system — skip if there's no intent to scale beyond two files

---

### 15. Missing `alt` text and `aria-label` on SVG icons throughout both apps

**What:** Neither `index.html` nor `givelink.html` has any `alt=""` attributes on images or `aria-label` / `role="img"` on meaningful SVG elements and icon-only buttons.

**Where:** `index.html:~523, ~527` (logo SVGs), icon-only buttons throughout both files

**Why it matters:** Screen readers announce icon-only buttons as "button" with no context. While the primary user is sighted, this blocks future team usage of Givelink and is a quick win against any a11y audit.

**Effort:** S

**Suggested fix:**
- Add `aria-label="Task OS logo"` to the main logo SVG
- Add `aria-label="[action name]"` to every button that contains only an emoji or icon (search for `btn` elements with no text children)
- Visually-decorative icons: `aria-hidden="true"`

---

### 16. `sw.js` push notification icon path references non-existent file

**What:** `sw.js:39` uses `./icons/icon-192.png` for push notification badges and icons, but the repository contains only `icon.svg` and `icon-gl.svg` — no `icons/` directory, no PNG files.

**Where:** `sw.js:39-40`

```js
icon:'./icons/icon-192.png',
badge:'./icons/icon-192.png',
```

**Why it matters:** Push notifications that fire while the app is in the background will display with a broken/default icon rather than the Task OS brand icon. Not user-blocking but visually unprofessional.

**Effort:** S

**Suggested fix:**
- Generate `icons/icon-192.png` and `icons/icon-512.png` from `icon.svg` (e.g., `npx sharp-cli --input icon.svg --output icons/icon-192.png --resize 192`)
- Update `manifest.json`'s `icons` array to reference these PNGs (PWA icon requirements also call for PNG)
- Or update `sw.js:39-40` to use the SVG path as a temporary workaround: `icon:'./icon.svg'`
