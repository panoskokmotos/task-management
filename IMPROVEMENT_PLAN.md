# Givelink / Task OS — Improvement Plan

Generated: 2026-04-19

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. `callClaude()` silently swallows API errors

**What:** The Anthropic fetch in `index.html` never checks `res.ok`, so a 401 (bad key), 429 (rate limit), or 500 returns `null` with no explanation.

**Where:** `index.html` ~line 2290–2300 (`callClaude()`)

**Why it matters:** Every AI feature — coach, sprint planner, automations — fails invisibly. Users assume the feature is broken and give up; there is no path to self-service recovery.

**Effort:** S

**Suggested fix:**
- After `const res = await fetch(...)`, add: `if (!res.ok) { const err = await res.json().catch(() => null); toast('AI error ' + (err?.error?.message || res.status)); return null; }`
- Mirror the pattern already used correctly in `givelink.html` `runAiSprintPlanner()` (~line 1754).

---

### 2. `init()` crashes entire app on corrupted `localStorage`

**What:** The app's main data load does a bare `JSON.parse(localStorage.getItem('taskos'))` with no try/catch; any truncated or corrupted write leaves the app in a permanent broken state.

**Where:** `index.html` ~line 1100 (`init()`)

**Why it matters:** A mid-write page crash (browser kill, power loss, storage quota hit) corrupts the JSON and the app refuses to load on every subsequent visit — unrecoverable without DevTools.

**Effort:** S

**Suggested fix:**
- Wrap in `try { S = JSON.parse(raw); } catch(e) { console.error('State corrupted, resetting', e); localStorage.removeItem('taskos'); toast('Data error — app reset. Sorry for the loss.'); }`
- Show a non-blocking banner rather than crashing; consider writing to a backup key before each save.

---

### 3. `getApiKey()` falls back to blocking browser `prompt()`

**What:** When `givelink_api_key` is absent, `getApiKey()` calls `window.prompt()` — a synchronous, unstyleable browser dialog that is suppressed in iframes and unreliable on mobile.

**Where:** `givelink.html` ~lines 1667–1685 (`getApiKey()`)

**Why it matters:** Any new Givelink user who hasn't pre-set a key hits a browser dialog that looks like a phishing attempt; on some mobile browsers it is silently blocked and the app hangs.

**Effort:** S

**Suggested fix:**
- The Settings modal pattern already exists in `index.html`; replicate a minimal API-key entry modal in `givelink.html`.
- Gate the AI sprint planner button with an inline prompt inside the modal, not via `window.prompt()`.
- Remove the `prompt()` fallback entirely.

---

### 4. `renderView()` silently renders blank on any unknown view name

**What:** The view dispatch in both files uses `views[v]?.()` — an optional chain that quietly does nothing if `v` is unrecognised, leaving the user staring at blank content.

**Where:** `index.html` ~line 1223 (`renderView()`); `givelink.html` equivalent dispatch

**Why it matters:** A stale `localStorage` bookmark, a future rename, or any typo in a `nav()` call produces a blank screen with no toast, no console warning, and no recovery path.

**Effort:** S

**Suggested fix:**
- `if (!views[v]) { console.warn('Unknown view:', v); nav('dashboard'); return; }`
- Add a minimal `renderNotFound()` that shows "View not found — returning home" and auto-redirects after 2 s.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. Sidebar navigation is mouse-only (keyboard / screen reader inaccessible)

**What:** Every sidebar nav item is a `<div onclick="nav('...')">` — not a `<button>` or `<a>` — so keyboard Tab navigation and screen readers cannot reach them.

**Where:** `index.html` ~lines 291–320 (sidebar markup)

**Why it matters:** Keyboard-only users and screen reader users cannot navigate the app at all; this is a WCAG 2.1 Level A failure that would block any enterprise or accessibility-conscious adoption.

**Effort:** M

**Suggested fix:**
- Replace `<div class="ni" onclick="nav('...')">` with `<button class="ni" onclick="nav('...')">`.
- Wrap the list in `<nav aria-label="Main navigation">`.
- Add `:focus-visible` styles to `.ni` (the dark theme already has adequate contrast for focus rings).

---

### 6. `alert()` used for form validation feedback

**What:** `saveTask()` and `saveGoal()` call `alert()` for empty-title validation rather than the `toast()` system already present in the codebase.

**Where:** `index.html` ~line 1579 (`saveTask()`), ~line 1645 (`saveGoal()`)

**Why it matters:** `alert()` freezes the page, cannot be dismissed with keyboard-friendly UI, looks broken on mobile, and is jarring — users reflexively distrust apps that throw native dialogs.

**Effort:** S

**Suggested fix:**
- Replace with `toast('Task title is required.')` and return early.
- For the title fields specifically, add a red `border-color` flash on the input using a CSS class toggled for 1 s — purely CSS, no new infrastructure needed.

---

### 7. Inline task creation and commitment review use `window.prompt()`

**What:** `openAddTaskDay()` and `reviewCommit()` capture user text via `window.prompt()` instead of in-app modals.

**Where:** `index.html` ~line 4048 (`openAddTaskDay()`), ~line 3541 (`reviewCommit()`)

**Why it matters:** These are high-frequency flows in the daily review ritual — hitting a native browser dialog on every "add task to day" breaks immersion and is unreliable on mobile Safari.

**Effort:** M

**Suggested fix:**
- Reuse the existing task modal (`#tm`) for `openAddTaskDay()`, pre-filling the due date.
- For `reviewCommit()`, add a small inline textarea inside the commitment card that saves on blur/Enter rather than opening any dialog.

---

### 8. Custom div checkboxes are invisible to screen readers

**What:** Task checkboxes are styled `<div>` elements with no `role`, no `aria-checked`, and no keyboard handler — they respond only to mouse click.

**Where:** `index.html` CSS ~line 58 (`.ck` rule); all `renderTask()` call sites throughout the file

**Why it matters:** Screen reader users cannot mark tasks complete; keyboard users cannot complete tasks; this is a WCAG 2.1 Level A failure.

**Effort:** M

**Suggested fix:**
- Replace rendered `<div class="ck">` with `<input type="checkbox" class="ck" aria-label="Complete task">` and style with `appearance: none` to preserve the current look.
- Alternatively add `role="checkbox"`, `aria-checked="${t.done}"`, `tabindex="0"`, and a `keydown` handler for Space/Enter if the visual design must stay exactly as-is.

---

### 9. No `res.ok` + `aria-live` on AI loading states — double-click fires concurrent requests

**What:** `callClaude()` does not disable its trigger button during the fetch, and the result container has no `aria-live` announcement when content loads.

**Where:** `index.html` ~line 2285 (`callClaude()`); all buttons that call it (AI Coach, AI Lab, review prompts)

**Why it matters:** Double-clicking an AI button fires two concurrent Anthropic API calls, doubling token cost and producing a race condition; screen reader users never hear the result arrive.

**Effort:** S

**Suggested fix:**
- Set `btn.disabled = true` before the fetch; restore in `finally`.
- Add `aria-live="polite"` to the element that receives the AI response text.

---

### 10. PWA manifest shortcuts navigate to broken hash routes

**What:** `manifest.json` shortcut URLs use `#quick-add`, `#journal`, etc., but the app uses a `nav()` function with named view IDs — there is no hash router, so all shortcuts land on the default dashboard view.

**Where:** `/home/user/task-management/manifest.json` (all `url` fields in `shortcuts` array)

**Why it matters:** Users who pin the app to their home screen and use shortcuts get silently dropped on the dashboard — the shortcuts that surface in the OS long-press menu do nothing they advertise.

**Effort:** S

**Suggested fix:**
- Change shortcut URLs to `/?view=quick-add`, `/?view=journal`, etc.
- In `init()`, read `new URLSearchParams(location.search).get('view')` and call `nav()` with it if present.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `syncToTaskOS()` matches tasks by title string — causes duplicates on rename

**What:** The Givelink → Task OS sync function identifies existing tasks by exact `t.title === gl_task.title` comparison, so any edit to a task title creates a duplicate instead of updating.

**Where:** `givelink.html` ~line 1902 (`syncToTaskOS()`)

**Why it matters:** Users who rename a Givelink task during a sprint end up with two copies in Task OS — one stale, one current — with no way to know which is canonical short of manual deletion.

**Effort:** S

**Suggested fix:**
- Add a `glId` field to synced tasks on first creation and match by `t.glId` in subsequent syncs.
- Fall back to title match only when `glId` is absent (backwards compat for existing tasks).

---

### 12. `catB()` derives CSS class from first character of category name

**What:** The category badge renderer uses `c[0]` (first char of the category key) as a CSS class suffix, meaning any two categories starting with the same letter share a style and a rename silently breaks theming.

**Where:** `index.html` ~line 1206 (`catB()`)

**Why it matters:** Adding a new category or renaming one will either inherit the wrong color or render unstyled, and the bug won't be visible until a user opens a task with that category.

**Effort:** S

**Suggested fix:**
- Use a stable lookup map: `const CAT_CLASS = { work: 'cw', personal: 'cp', health: 'ch', ... }` and reference `CAT_CLASS[c] || 'co'`.
- This decouples display names from CSS class names.

---

### 13. Duplicate `.gc` CSS class definition

**What:** The `.gc` class is defined twice in `index.html`'s `<style>` block — once at ~line 129 and again at ~line 184 (the second adds `border-left: 3px solid gold`). The first definition is silently overridden.

**Where:** `index.html` ~lines 129 and 184

**Why it matters:** Any developer editing the first definition will see no effect, creating a confusing debugging session; `gold` is also a literal CSS keyword rather than a variable, breaking palette consistency.

**Effort:** S

**Suggested fix:**
- Merge the two rules into one, replacing `gold` with the appropriate CSS variable (e.g., `var(--bm)` or a new `--top` variable).
- Run a global search for duplicate class selectors before any future CSS refactor.

---

### 14. Hardcoded hex colours in inline styles throughout both files

**What:** Progress bars, status badges, priority indicators, and row highlights use hardcoded hex values (`#fbbf24`, `#ef4444`, `#22c55e`, `#60a5fa`, etc.) in inline `style=` attributes instead of the CSS variables already defined in `:root`.

**Where:** `index.html` — dozens of inline style attributes across all render functions; `givelink.html` — progress bar fills ~line 1420, velocity meter ~line 1510, blocked task rows ~line 1380

**Why it matters:** A brand palette update or dark-mode variant requires a grep-and-replace across hundreds of inline strings; the variables exist precisely to avoid this, but they're underused.

**Effort:** M

**Suggested fix:**
- Define semantic variables for the missing cases: `--color-warning`, `--color-danger`, `--color-success`, `--color-info` in `:root`.
- Replace all matching inline hex values with `var(--color-*)`.
- Add a CSS lint rule (even a grep-based pre-commit check) to catch new inline hex values.

---

### 15. Service worker cache key is a hardcoded timestamp requiring manual edits

**What:** `sw.js` line 1 has `const CACHE = 'task-os-20260413-174350'` — a literal timestamp that must be manually incremented to bust the cache after any deployment.

**Where:** `sw.js` line 1

**Why it matters:** Forgetting to update this string means users receive stale cached assets after a deployment, seeing old UI indefinitely until they manually clear their browser cache.

**Effort:** S

**Suggested fix:**
- Inject the cache key at deploy time via a Vercel build step or a simple pre-deploy script: `sed -i "s/CACHE = 'task-os-[^']*'/CACHE = 'task-os-$(date +%Y%m%d%H%M%S)'/" sw.js`.
- Alternatively, derive the key from a version constant defined once at the top of `index.html` and read by the SW via `postMessage` on install.

---

### 16. Dead `connect-src` entry for Slack in CSP headers

**What:** `vercel.json` includes `https://hooks.slack.com` in the `Content-Security-Policy` `connect-src` directive, but neither `index.html` nor `givelink.html` contains any Slack webhook code.

**Where:** `vercel.json` ~line 14 (`connect-src` value)

**Why it matters:** Stale CSP entries expand the app's attack surface without providing any benefit — if a future XSS vulnerability were introduced, an attacker could exfiltrate data to Slack without tripping any allowlist alerts.

**Effort:** S

**Suggested fix:**
- Remove `https://hooks.slack.com` from `connect-src`.
- If Slack integration is planned, re-add it in the commit that introduces the webhook code so the CSP change is reviewable alongside the feature.

---

## 💡 P3 — Nice to have

---

### 17. Anthropic API key stored in `localStorage` (persists after session)

**What:** Both apps store the Anthropic API key in `localStorage`, which persists indefinitely and is accessible to any JavaScript running on the same origin.

**Where:** `index.html` ~line 2290 (read/write of `S.claudeKey`); `givelink.html` ~lines 1670–1682 (`getApiKey()`)

**Why it matters:** For a personal-use app this is acceptable, but `localStorage` survives session end and is visible to browser extensions — a low bar for a key that has per-token billing implications.

**Effort:** M

**Suggested fix:**
- Move to `sessionStorage` as a minimum — key is cleared when the tab closes.
- Ideal: proxy calls through a Vercel Edge Function so the key never reaches the browser at all; the function reads it from an environment variable.

---

### 18. Seed data contains what appears to be real personal data

**What:** `seed()` and `seedGoals()` pre-populate tasks, goals, and finance entries with Greek-language text, specific monetary values, and personal names that appear to be real data rather than generic demo content.

**Where:** `index.html` — `seed()` and `seedGoals()` functions (search `function seed`)

**Why it matters:** Any new user loading the app on a fresh browser receives this personal data as their own; sharing the app URL or deploying it publicly would expose the data to anyone who opens it in a new browser.

**Effort:** S

**Suggested fix:**
- Replace all seed data with clearly fictional demo content (generic English-language tasks, round-number finances, placeholder names).
- Gate seeding behind a "Load demo data" button in Settings rather than running automatically on first load.

---

### 19. `uid()` uses `Math.random()` for task IDs

**What:** Task and goal IDs are generated with `Math.random().toString(36).slice(2) + Date.now().toString(36)` — not cryptographically random, with non-zero collision probability on rapid bulk imports.

**Where:** `index.html` — `uid()` function (search `function uid`)

**Why it matters:** For a single-user local app the collision risk is negligible, but the `syncToTaskOS()` function in `givelink.html` relies on IDs for deduplication — a collision there creates a silent data merge.

**Effort:** S

**Suggested fix:**
- Replace with `crypto.randomUUID()` — available in all modern browsers and already used by the Web Crypto API that the app's CSP permits.

---

### 20. `unsafe-inline` CSP required by monolithic inline script/style architecture

**What:** The `Content-Security-Policy` in `vercel.json` must include `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` because all JavaScript and CSS lives inline in the HTML files.

**Where:** `vercel.json` ~line 14; root cause is the single-file architecture of `index.html` and `givelink.html`

**Why it matters:** `unsafe-inline` defeats most XSS mitigations — a successful injection can run arbitrary scripts. This is the root architectural constraint behind several other items in this plan.

**Effort:** L

**Suggested fix:**
- Extract JavaScript into separate `.js` files (start with the `callClaude` / API layer as a standalone module).
- Extract CSS into a separate `.css` file.
- Once all inline code is removed, replace `'unsafe-inline'` with a nonce or hash-based CSP.
- This is an L effort but unblocks the strictest CSP, enables code splitting, and makes all other refactors easier.
