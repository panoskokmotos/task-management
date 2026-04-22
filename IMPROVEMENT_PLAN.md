# Improvement Plan

## 🔥 P0 — Ship this week

### 1. XSS via unescaped task titles in `tcHTML`
- **What**: Task titles rendered as raw HTML in the task card renderer
- **Where**: `index.html` ~line 1521 — `` `${t.title}` `` inside innerHTML template literal
- **Why it matters**: Any task title containing `<script>` or `<img onerror=...>` executes arbitrary JS; givelink.html already uses `esc()` correctly, so this inconsistency is a clear oversight
- **Effort**: S
- **Suggested fix**: Replace every bare `${t.title}` and `${t.notes}` in `tcHTML` with `${esc(t.title)}` / `${esc(t.notes)}` — the `esc()` helper already exists in index.html

---

### 2. CSS typo breaks Quick Capture panel in Givelink
- **What**: Quick Capture container has `flex` instead of `display:flex` in its inline style
- **Where**: `givelink.html` line 336 — `style="...;flex;gap:8px;align-items:center;"`
- **Why it matters**: The entire Quick Capture row collapses; users cannot see the input + button side by side, making task entry visually broken on first load
- **Effort**: S
- **Suggested fix**: Change `flex;` to `display:flex;` in that inline style attribute

---

### 3. Invalid model ID causes all AI Sprint Planner calls to fail
- **What**: AI Sprint Planner sends `model: 'claude-opus-4-5'` which is not a valid Anthropic model ID
- **Where**: `givelink.html` line 1749
- **Why it matters**: Every sprint planning AI request returns a 400/404 API error; the feature is completely non-functional for all users
- **Effort**: S
- **Suggested fix**: Change to `'claude-haiku-4-5-20251001'` (matches Task OS) or `'claude-opus-4-7'` if budget allows; verify against current model list

---

### 4. `callClaude` swallows API errors silently
- **What**: `callClaude` calls `res.json()` without checking `res.ok`, so 401/429/500 responses are parsed as JSON and throw an opaque error with no user feedback
- **Where**: `index.html` ~line 2293 inside `callClaude`
- **Why it matters**: When the API key is wrong or rate-limited, the user sees nothing — no toast, no error state — and assumes the app is frozen; givelink.html already has the correct pattern
- **Effort**: S
- **Suggested fix**: Add `if (!res.ok) { const err = await res.text(); throw new Error(err); }` immediately after `const res = await fetch(...)`, then surface the error in the UI with a toast

---

### 5. `openAddTaskToWeek` / `openAddTaskToMonth` look up wrong element ID
- **What**: Both functions call `document.getElementById('ci')` but the capture input has id `capi`
- **Where**: `index.html` lines ~4046 (`openAddTaskToWeek`) and ~4149 (`openAddTaskToMonth`)
- **Why it matters**: Clicking "Add to Week" or "Add to Month" does nothing — `getElementById` returns `null`, the subsequent `.focus()` / `.value` assignment throws a TypeError, and the modal never populates
- **Effort**: S
- **Suggested fix**: Change `'ci'` to `'capi'` in both functions

---

## ⚡ P1 — High ROI

### 6. `syncToTaskOS` reads wrong localStorage key — sync always produces 0 tasks
- **What**: Sync function looks for `localStorage.getItem('taskos_data_' + profile.id)` but Task OS stores everything under the key `taskos`
- **Where**: `givelink.html` ~line 1902
- **Why it matters**: The "Sync to Task OS" feature is the primary integration between the two apps; it silently syncs zero tasks every time, making the cross-app workflow worthless
- **Effort**: S
- **Suggested fix**: Replace the key lookup with `localStorage.getItem('taskos')` and parse accordingly; verify the expected shape matches Task OS's data model

---

### 7. EOD quick-pick injects task titles into `onclick` attribute unsafely
- **What**: End-of-day MIT quick-pick builds `onclick="...value='${t.title.replace(/'/g,"\'")}';"` — backticks and `"` in titles still break the attribute
- **Where**: `index.html` ~line 4295
- **Why it matters**: A task titled e.g. `Fix "homepage" bug` breaks the onclick handler for every subsequent item in the list; titles with backticks can escape the string context
- **Effort**: S
- **Suggested fix**: Assign a `data-title` attribute and use an event listener: `el.dataset.title = t.title; el.addEventListener('click', () => { input.value = el.dataset.title; })`

---

### 8. No loading/error state during AI calls in Task OS
- **What**: AI features (daily plan, weekly review, task suggestions) show no spinner, disable no buttons, and display no error if the call fails
- **Where**: `index.html` — all callers of `callClaude` (~lines 2350, 2410, 2490)
- **Why it matters**: Users double-click, assume the app is broken, and navigate away mid-request; failed calls leave the UI in an indeterminate state
- **Effort**: M
- **Suggested fix**: Wrap each AI call site with a shared `withLoading(buttonEl, asyncFn)` helper that sets `button.disabled = true`, shows a spinner class, and always restores state in `finally`

---

### 9. Decision reminders scheduled but never fired
- **What**: Tasks with `decisionDate` set are stored correctly but no polling or notification mechanism actually checks them
- **Where**: `index.html` — no `setInterval` or Notification API call references the `decisionDate` field
- **Why it matters**: The decision-reminder feature is prominently in the UI; users set reminders expecting alerts that never come, eroding trust in the app
- **Effort**: M
- **Suggested fix**: Add a `setInterval` (every 60 s) on app load that filters tasks where `decisionDate <= Date.now()` and fires a `new Notification(...)` (request permission on first use)

---

### 10. Weekly plan table overflows on mobile
- **What**: The 7-column weekly grid has no horizontal scroll wrapper and columns use fixed pixel widths
- **Where**: `index.html` ~line 4007 — `.week-grid` CSS block
- **Why it matters**: On screens < 768 px the rightmost columns are clipped with no scroll affordance; users on phones cannot see or interact with the weekend columns
- **Effort**: S
- **Suggested fix**: Wrap the grid in `overflow-x: auto` and switch column widths from `px` to `minmax(120px, 1fr)` in the CSS grid template

---

## 🛠 P2 — Code health

### 11. Personal seed data with real names and financial figures shipped in production
- **What**: `seed()` contains 300+ hardcoded tasks with Greek text, real-sounding personal names, and monetary amounts
- **Where**: `index.html` lines 1810–2200
- **Why it matters**: Shipped to all users; any new install gets pre-populated with someone's personal data as placeholder content, which is confusing and potentially a privacy concern if the data is real
- **Effort**: M
- **Suggested fix**: Replace with 5–10 generic English demo tasks (`'Write project proposal'`, `'Review pull requests'`, etc.) or gate seed behind a `?demo=1` query param

---

### 12. localStorage writes have no quota guard — silent data loss on full storage
- **What**: Every `save()` call does `localStorage.setItem(key, JSON.stringify(data))` with no try/catch around `QuotaExceededError`
- **Where**: `index.html` ~line 1240 (`save()`); `givelink.html` ~line 1620 (`saveSprint()`)
- **Why it matters**: Browsers enforce a 5–10 MB localStorage quota; heavy users hit it silently — the write fails, the last save is lost, and the user has no idea until they notice missing tasks
- **Effort**: S
- **Suggested fix**: Wrap both save functions in `try { localStorage.setItem(...) } catch(e) { if (e.name === 'QuotaExceededError') showToast('Storage full — export your data'); }`

---

### 13. Service worker cache version is hardcoded — stale HTML served after deploys
- **What**: `CACHE = 'task-os-20260413-174350'` is a static string; it only changes when a developer manually edits `sw.js`
- **Where**: `sw.js` line 1
- **Why it matters**: After a Vercel deploy, returning users continue to be served the old cached HTML (network-first only re-fetches if the SW file itself changes); bugs fixed in a deploy are invisible to existing users until they manually clear cache
- **Effort**: S
- **Suggested fix**: Inject the cache key at build/deploy time (e.g., a `sed` step in `vercel.json` build command: `sed -i "s/CACHE_VERSION/$(date +%s)/" sw.js`) or derive it from a build hash

---

### 14. 175+ functions in global scope — collision and maintenance risk
- **What**: Every function in both HTML files is declared at top level (`function foo() {}`), sharing a single global namespace
- **Where**: `index.html` entire `<script>` block; `givelink.html` entire `<script>` block
- **Why it matters**: Any name collision (e.g., both files defining `getApiKey`, `render`, `save`) causes silent overwrites if both apps ever share a common script; autocomplete is useless and grep returns false positives
- **Effort**: L
- **Suggested fix**: Wrap each file's script in an IIFE `(function() { ... })()` as a zero-risk first step; longer term, extract into ES modules with `<script type="module">`

---

### 15. `uid()` has non-negligible collision probability at scale
- **What**: `uid()` = `Date.now().toString(36) + Math.random().toString(36).slice(2)` — two tasks created in the same millisecond share the same timestamp prefix, leaving only ~10 bits of random entropy to distinguish them
- **Where**: `index.html` line ~1201
- **Why it matters**: Bulk imports or rapid task creation (e.g., from the seed function or AI plan import) can produce duplicate IDs, causing tasks to silently overwrite each other in the Map/object store
- **Effort**: S
- **Suggested fix**: Use `crypto.randomUUID()` (available in all modern browsers and PWA contexts) — one line change, guaranteed uniqueness

---

## 💡 P3 — Nice to have

### 16. Duplicate 🧠 emoji in section headers creates visual stutter
- **What**: Two adjacent section headings both use 🧠 as their icon
- **Where**: `index.html` — Focus Mode and AI Insights section headers
- **Why it matters**: Minor visual polish; distinct icons help users scan the UI faster
- **Effort**: S
- **Suggested fix**: Change one to a contextually appropriate alternative (e.g., 🎯 for Focus Mode)

---

### 17. Stale model ID comment in Task OS references deprecated model name
- **What**: A comment near `callClaude` references `claude-haiku-3` (old naming convention) even though the actual call uses `claude-haiku-4-5-20251001`
- **Where**: `index.html` ~line 2285
- **Why it matters**: Misleads future developers about which model is in use; trivial to fix
- **Effort**: S
- **Suggested fix**: Update or delete the comment

---

### 18. Blue accent color inconsistency between Task OS and Givelink
- **What**: Task OS uses `#58a6ff` (GitHub blue) for links/accents; Givelink uses `#3b82f6` (Tailwind blue-500) — neither matches the documented purple/pink brand palette
- **Where**: `index.html` CSS variables block; `givelink.html` CSS variables block
- **Why it matters**: Both apps are from the same product family but feel visually disconnected; aligning accents to the brand purple (`#6B3FA0`) would improve cohesion
- **Effort**: M
- **Suggested fix**: Define shared CSS custom properties (`--color-primary: #6B3FA0; --color-accent: #5718CA`) in both files and replace the ad-hoc blue values; low risk since it's purely visual
