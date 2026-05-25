# Givelink / Task OS — Improvement Plan

_Generated: 2026-05-25_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. JSON.parse on startup crashes the whole app when localStorage is corrupted

**What**: `load()` in `givelink.html` calls `JSON.parse()` on raw localStorage data with no try/catch; corrupted or truncated data kills the page on load.

**Where**: `givelink.html:448`, `index.html:1877`

**Why it matters**: Any user who hits a write-interrupted save (tab crash, storage quota mid-write) is permanently locked out of their data until they manually clear storage. No recovery path exists.

**Effort**: S

**Suggested fix**:
- Wrap `JSON.parse(localStorage.getItem(...))` in try/catch in `load()` / the startup block
- On parse failure, log the raw string, show a toast ("Data restored from backup or reset"), and continue with defaults
- Add a data-export button to the settings panel so users can snapshot before any destructive reset

---

### 2. Unescaped user input injected into innerHTML — XSS

**What**: `p.name` and `p.why` (user-entered relationship data) are injected directly into template literals rendered via `innerHTML` without calling `esc()`.

**Where**: `index.html:3947`, `index.html:3977`

**Why it matters**: Any user who types `<img src=x onerror=alert(1)>` as a contact name triggers script execution. Worse, if this data syncs anywhere (Notion, export), the payload travels with it. Other fields (`p.category`, `p.company`) on the same render path are also unescaped.

**Effort**: S

**Suggested fix**:
- Replace `${p.name}` with `${esc(p.name)}` on lines 3947, 3977 and all adjacent template fields in the same render block
- Grep for other `innerHTML` assignments that use object fields without `esc()`: `git grep -n "innerHTML.*\${" index.html | grep -v "esc("`

---

### 3. Null dereference crashes on missing DOM elements

**What**: Multiple `getElementById()` results are used without a null check; if the element is absent (e.g., the user navigated away mid-render), the next property access throws and breaks the current view.

**Where**:
- `index.html:2049–2051` — `confirm-msg`, `confirm-icon`, `confirm-ok-btn` accessed unconditionally inside `openConfirm()`
- `index.html:3965` — `rel-list.innerHTML` set without guard
- `index.html:3974` — `p.name[0].toUpperCase()` called when `p.name` can be `undefined` or `""`
- `index.html:4129` — `dw-task-label.value` without null check

**Why it matters**: The confirm dialog is used for destructive actions (delete task, clear sprint). A crash here leaves users unable to confirm deletions without a page reload.

**Effort**: S

**Suggested fix**:
- Add `if(!el) return;` guards before each unchecked `getElementById` result
- For `p.name[0]`, use `(p.name||'?')[0].toUpperCase()`
- Extract a small `$id(id)` helper that throws a descriptive error in dev and returns null in prod, so failures surface during development

---

### 4. Unhandled promise rejections on Service Worker, install prompt, and notifications

**What**: Three async calls have no `.catch()`: `navigator.serviceWorker.register()`, `_installPrompt.userChoice`, and `Notification.requestPermission()`. Browsers log these as unhandled rejections; in some environments they also fire `window.onunhandledrejection` which can cascade.

**Where**: `index.html:7542`, `index.html:7606`, `index.html:8249`

**Why it matters**: SW registration failure means the PWA silently loses offline support. The install prompt rejection is low risk, but the Notification permission error can silently disable reminders — a core feature — with no user feedback.

**Effort**: S

**Suggested fix**:
- `navigator.serviceWorker.register('./sw.js').then(...).catch(e => console.error('SW registration failed', e))`
- `_installPrompt.userChoice.then(...).catch(() => { _installPrompt = null; })`
- `Notification.requestPermission().then(...).catch(() => toast('Notifications blocked by browser'))`

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. AI calls show no loading state — users think the app froze

**What**: At least 6 `callClaude()` invocations trigger async API calls (1–10 seconds) with no loading indicator: bucket suggestions, wishlist suggestions, project suggestions, content ideas, focus day plan, and deep work session plan.

**Where**: `index.html:66`, `index.html:171`, `index.html:269`, `index.html:451`, `index.html:3054`, `index.html:3682`

**Why it matters**: Users clicking an AI button with no spinner assume the click didn't register and click again, triggering duplicate API calls and burning quota. Worse, they abandon the feature thinking it's broken.

**Effort**: M

**Suggested fix**:
- Before each `await callClaude(...)`, set `btn.disabled = true` and replace button text with `⏳ Thinking…`
- Restore in a `finally` block: `btn.disabled = false; btn.textContent = originalLabel`
- The existing `_aiBtn(btn, fn)` wrapper already implements this pattern (line ~2028) — migrate all uncovered AI buttons to use it

---

### 6. Givelink sprint board ignores brand palette entirely

**What**: `givelink.html` uses `#3b82f6` (Tailwind blue) as its primary accent throughout — cards, buttons, stat badges, burndown chart, update banner. The brand palette (purple `#6B3FA0`/`#5718CA`, pink `#C2185B`/`#E353B6`) appears nowhere.

**Where**: `givelink.html:6`, `givelink.html:17`, `givelink.html:110`, `givelink.html:521`, `givelink.html:1279`, `givelink.html:1311–1314`, `givelink.html:1738`

**Why it matters**: The sprint board is used in investor and customer demos. Visual inconsistency signals an unfinished product and undermines trust in the brand.

**Effort**: M

**Suggested fix**:
- Swap `#3b82f6` → `#5718CA` (primary purple) for interactive elements and `#6B3FA0` for secondary/hover states
- Swap `#60a5fa` → `#a78bfa` as the light-purple token for the Nonprofits pillar
- Add `--brand-primary: #5718CA; --brand-secondary: #6B3FA0; --brand-pink: #E353B6;` as CSS variables at the top of `givelink.html` and replace all hardcoded hex values referencing blue

---

### 7. Empty `catch` blocks silently swallow errors in critical paths

**What**: `getApiKey()` has `catch(e){}` (no body) when parsing profiles, and `postToNtfy()` has `catch(_){}` when sending reminder notifications. Errors vanish with no user feedback.

**Where**: `index.html:1083` (getApiKey catch), `index.html:8169` (ntfy catch)

**Why it matters**: When `getApiKey()` fails silently, the next line falls through to `prompt()` — the user sees an unexpected popup with no explanation. When ntfy fails silently, reminders stop working and users don't know why.

**Effort**: S

**Suggested fix**:
- `catch(e) { console.warn('Profile parse failed, using fallback:', e); }` — at minimum log
- For ntfy: `catch(e) { toast('Reminder delivery failed — check ntfy settings'); }` so users know
- Audit for all other empty `catch` blocks: `grep -n "catch(_\|e)[ ]*{}" index.html`

---

### 8. 40+ icon buttons have no accessible name

**What**: Edit (✏️), delete (🗑), close (×), and action buttons throughout both files use emoji or symbols with no `aria-label`. Screen readers announce them as "button" with no action context.

**Where**: `givelink.html:218` has 1 aria-label; `index.html` bucket/wishlist/project edit-delete buttons starting at line 14 of the last section, all modal close buttons in givelink.html

**Why it matters**: Users with screen readers cannot operate the app. This is also a WCAG 2.1 AA failure (Success Criterion 4.1.2) — a legal accessibility requirement in many markets.

**Effort**: M

**Suggested fix**:
- Add `aria-label="Edit"` / `aria-label="Delete"` / `aria-label="Close"` to all icon-only buttons
- For dynamically generated buttons: `<button aria-label="Edit ${esc(item.name)}" ...>`
- Add a CSS rule `.btn[aria-label]` as a dev-mode reminder to catch regressions

---

### 9. Calendar view breaks on mobile — hardcoded `min-width: 480px`

**What**: The calendar grid has `min-width:480px` with no media query override, creating horizontal scrolling on phones.

**Where**: `index.html` (last section) `:1105` of that section's relative lines

**Why it matters**: Mobile usage of productivity apps peaks on phones (commute, morning review). A horizontal-scrolling calendar is unusable on anything narrower than an iPad.

**Effort**: S

**Suggested fix**:
- Add `@media (max-width: 520px) { .cal-grid { min-width: unset; grid-template-columns: repeat(7, 1fr); } }`
- Reduce day-cell font size and padding on mobile: `font-size: 10px; padding: 2px;`
- Also fix `givelink.html:768` burndown SVG — replace hardcoded `W=280,H=100` with dynamic `el.getBoundingClientRect().width`

---

### 10. API key prompt appears with no explanation after silent parse failure

**What**: When profile data fails to parse, `getApiKey()` immediately calls `prompt('Enter your Anthropic API key:')` — a bare browser dialog with no context about why it's appearing.

**Where**: `index.html:1085–1087`

**Why it matters**: New users see an unstyled browser prompt before they understand the app. Returning users who haven't seen this before will likely close it and think the app is broken. On mobile, `prompt()` is blocked in some browsers entirely.

**Effort**: S

**Suggested fix**:
- Replace `prompt()` with opening the existing settings/API key modal: `openSettings('api-key-tab')`
- Show a toast first: `toast('Add your Claude API key in Settings to use AI features')`
- Never use `prompt()` — it's blocked in iframes, WebViews, and some mobile browsers

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `seed()` function is 389 lines of hardcoded task data

**What**: The `seed()` function (which populates demo data) spans ~389 lines of hardcoded task objects with no extraction or organization.

**Where**: `index.html:3162–3550`

**Why it matters**: Any change to the task data model (adding a field, renaming a property) requires manually updating dozens of seed objects. It also makes the function untestable.

**Effort**: M

**Suggested fix**:
- Extract seed data into a `const SEED_DATA = { tasks: [...], goals: [...], habits: [...] }` object placed just before `seed()`
- `seed()` becomes a 10-line function that iterates over `SEED_DATA` keys and assigns them to `S`
- Consider moving seed data to a separate `<script id="seed-data" type="application/json">` block to make it inspectable without parsing JS

---

### 12. Duplicated API fetch/error-handling pattern across 6+ callers

**What**: The pattern of `fetch → check res.ok → try res.json().catch → map status codes to toast messages` is copy-pasted into at least 6 API call sites with subtle variations (some check `.catch()`, some don't; some map 429/401, some don't).

**Where**: `index.html:3639–3651`, `index.html:7667–7671`, `index.html:7705–7709`, `index.html:7737–7739`, `index.html:8160–8164`, `givelink.html:1097–1161`

**Why it matters**: When the API changes (e.g., new rate-limit format), every call site needs the same fix. The inconsistency means some errors surface to users and some don't.

**Effort**: M

**Suggested fix**:
- Extract `async function apiFetch(url, options, { errorMap } = {})` that handles `!res.ok`, JSON parse errors, and default error messages
- Each caller passes a `{ 401: 'Invalid API key', 429: 'Rate limit hit' }` map for custom messages
- All existing callers become 3-line replacements

---

### 13. Magic color objects duplicated throughout — 50+ hardcoded hex values

**What**: `bucketColors`, `catColors`, `areaColors`, category color maps in wishlists/skills/portfolios all hardcode hex values (`#58a6ff`, `#fbbf24`, `#ef4444`, `#22c55e`, etc.) instead of CSS variables.

**Where**: `index.html` last section lines 78–79, 477, 994, 1103; also `givelink.html:521`

**Why it matters**: Switching to dark mode, changing a brand color, or fixing a contrast violation requires finding and updating 50+ scattered hex values. One missed instance breaks visual consistency.

**Effort**: M

**Suggested fix**:
- Add semantic CSS variables: `--color-urgent: #ef4444; --color-warning: #fbbf24; --color-success: #22c55e; --color-info: #58a6ff;` to the `:root` block
- Replace all inline hardcoded hex values with `var(--color-*)` references
- For the JS color maps, reference CSS variable values via `getComputedStyle(document.documentElement).getPropertyValue('--color-urgent')`

---

### 14. Service Worker `cache.put` has no error handling — silent cache failures

**What**: In `sw.js`, two `caches.open(CACHE).then(c => c.put(...))` calls have no `.catch()`. If the cache storage is full or the request is not cacheable, the error is silently discarded.

**Where**: `sw.js:67`, `sw.js:81`

**Why it matters**: PWA offline functionality degrades silently. Users assume the app works offline but get blank screens. Storage-full errors on mobile are not uncommon.

**Effort**: S

**Suggested fix**:
- `caches.open(CACHE).then(c => c.put(e.request, clone)).catch(err => console.warn('[SW] Cache put failed:', err))`
- On line 104, guard the return: `.catch(() => cached || new Response('Offline', { status: 503 }))`

---

### 15. AI model names hardcoded in two places with different values

**What**: One `callClaude()` call uses `'claude-opus-4-5'` and another uses `'claude-haiku-4-5-20251001'` — hardcoded inline with no named constant.

**Where**: `givelink.html:1140`, `givelink.html:1256`

**Why it matters**: claude-opus-4-5 is a retired model ID — API calls using it will begin failing when the model is fully deprecated. Updating requires hunting for every hardcoded string.

**Effort**: S

**Suggested fix**:
- Define `const CLAUDE_FAST = 'claude-haiku-4-5-20251001'; const CLAUDE_SMART = 'claude-sonnet-4-6';` at the top of each file
- Replace all inline model strings with these constants
- Use `CLAUDE_FAST` for bulk/low-stakes operations (sprint planner, outreach), `CLAUDE_SMART` for high-stakes AI features

---

### 16. Production `console.warn` debug statements leak internal errors to users

**What**: Five `catch` blocks use `console.warn` to log internal errors (corrupt localStorage, failed morning briefing cache, notes synthesis parse failure) — visible to any user who opens DevTools.

**Where**: `index.html:1877`, `index.html:8147`, `index.html:8191`, `index.html:8292`, `index.html:8520`

**Why it matters**: Leaks internal implementation details (storage keys, API endpoint names, data structures). Also trains the team to ignore the console, masking real bugs.

**Effort**: S

**Suggested fix**:
- Replace with a single `log(level, msg, data)` utility that writes to `console` only when `localStorage.getItem('debug') === '1'`
- For errors that affect users (corrupt data, failed notifications), also call `toast(...)` so users know something went wrong
- Remove or comment out all other `console.log` / `console.debug` calls that are clearly leftover debug output

---

## 💡 P3 — Nice to have

### 17. Anthropic API key stored in `localStorage` — visible in DevTools

**What**: The Claude API key is stored in plaintext in `localStorage` under `taskos_claude_key` / `taskos_api_key` and sent directly from the browser to `api.anthropic.com`.

**Where**: `index.html:1085–1087`, `givelink.html:1085–1087`, header sent at `index.html:3643`

**Why it matters**: Any browser extension, XSS payload, or malicious script on the same origin can read the key. Anyone with physical access to the machine and DevTools can copy it. For a personal-use tool this is acceptable; for a multi-user SaaS it's a blocker.

**Effort**: L

**Suggested fix**:
- Short-term: add a warning in the settings UI: "Your API key is stored locally. Don't use this on a shared machine."
- Medium-term: route AI calls through a Vercel Edge Function that reads the key from an env variable — the browser never sees the raw key
- Long-term: implement proper auth (Clerk/Auth.js) and per-user key storage server-side

---

### 18. No retry logic on API calls — transient network errors fail permanently

**What**: All `fetch()` calls to Anthropic, Readwise, Notion, and ntfy fail immediately on any network error with no retry.

**Where**: All `fetch(` calls in `index.html:3639`, `7667`, `7788`, `8160`

**Why it matters**: Mobile users on spotty connections frequently see unnecessary errors that would have resolved with a single retry.

**Effort**: M

**Suggested fix**:
- Implement exponential backoff in `apiFetch()` (from item 12): retry up to 2 times on `503` / network errors, with 1s and 2s delays
- Do not retry `401` or `429` — those require user action

---

### 19. No empty-state illustrations on zero-data views

**What**: Several views (Goals, Habits, Decisions) render an empty list with only a plain text message; there is no CTA or illustration guiding the user to add their first item.

**Where**: Various render functions in `index.html` — Goals view (`v-goals`), Decisions view (`v-decisions`), Habits view (`v-habits`)

**Why it matters**: First-time users who land on an empty view don't know what to do next. Zero-state conversion is a critical activation moment.

**Effort**: M

**Suggested fix**:
- Add an empty-state template: icon + headline + sub-copy + primary CTA button
- Example: `<div class="empty-state"><div class="es-icon">🎯</div><h3>No goals yet</h3><p>Set your first goal to start tracking progress</p><button onclick="openGoalModal()">Add Goal</button></div>`
- Reuse the same template pattern across all views for consistency

---

### 20. Monolithic 11,595-line HTML file makes parallel development impossible

**What**: All HTML, CSS (~1,500 lines), and JavaScript (~9,000 lines) live in a single `index.html`. There is no build process, no module system, and no separation of concerns.

**Where**: `index.html` (entire file)

**Why it matters**: Any two people editing the file simultaneously produce merge conflicts on nearly every change. Finding a specific function requires text search; there is no import graph. The file exceeds IDE performance thresholds in some editors.

**Effort**: L

**Suggested fix**:
- No immediate rewrite needed — but establish a boundary: extract all CSS into `styles.css` (linked via `<link>`) as a first step; this can be done incrementally with zero risk
- Next, extract utility functions (`esc`, `toast`, `callClaude`, `apiFetch`, `save`, `load`) into a `<script src="utils.js">` loaded before the main script
- Defer full modularization until there's a build pipeline (Vite + vanilla-ts is a natural fit given the existing vanilla JS style)
