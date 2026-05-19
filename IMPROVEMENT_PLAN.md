# Improvement Plan — Givelink Sprint Board & Task OS
_Generated 2026-05-19 | 20 items across 4 tiers_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. AI Sprint Planner silently fails for every user
**What:** Two compounding bugs make the AI Sprint Planner completely non-functional: it calls `claude-opus-4-5` (not a valid model ID — current IDs are `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-7`) AND its `getApiKey()` function only checks `taskos_profiles` + `taskos_api_key`, missing the `S.claudeKey` stored under `taskos` by the main app.

**Where:** `givelink.html:1075-1088` (`getApiKey`), `givelink.html:1131-1161` (direct fetch), `givelink.html:1140` (model name)

**Why it matters:** The AI Sprint Planner is a headline feature of the sprint board. Any user who clicks "✨ Generate" gets a raw API error response rendered in the modal — a bad first impression and no value delivered.

**Effort:** S

**Suggested fix:**
- Replace `'claude-opus-4-5'` on line 1140 with `'claude-haiku-4-5-20251001'` (consistent with rest of app).
- In `getApiKey()`, add a fallback: `try{const p=JSON.parse(localStorage.getItem('taskos')||'{}');k=p.claudeKey||'';}catch(e){}` after the profiles loop and before the `window.prompt()` — matching the pattern already used in `callClaudeGL()` (line 1259).
- Consider replacing the direct fetch block with a call to `callClaudeGL()` to avoid duplicating API logic.

---

### 2. "Sync to Task OS" always fails for every default user
**What:** `syncToTaskOS()` reads `taskos_profiles` from localStorage, but the main Task OS app (`index.html`) saves all state under a single `taskos` key. `taskos_profiles` never exists in a standard setup, so the function immediately toasts "No Task OS profile found" and exits without syncing anything.

**Where:** `givelink.html:1206-1250` (`syncToTaskOS`), specifically line 1208-1210

**Why it matters:** The "🔗 Sync to Task OS" button is prominently shown in the top bar on every view. Users who click it in good faith get a failure toast every time. The feature is completely broken.

**Effort:** S

**Suggested fix:**
- Change the sync target lookup: instead of reading `taskos_profiles`, read the main `taskos` key directly — `let tosData=JSON.parse(localStorage.getItem('taskos')||'{}')`.
- Then operate on `tosData.tasks` (which the main app uses). Write back with `localStorage.setItem('taskos', JSON.stringify(tosData))`.
- Remove the early-exit guard on `!profiles.length`.

---

### 3. `callClaudeGL` silently swallows all HTTP errors
**What:** `callClaudeGL()` calls `res.json()` without first checking `res.ok`. A 401 Unauthorized, 429 Rate Limited, or 5xx error response returns `null` with no user-facing message. The `catch` block only fires for network errors, never for HTTP errors.

**Where:** `givelink.html:1256-1272` (contrast with `index.html:3319-3334` which correctly handles 401/429)

**Why it matters:** Users with an expired or wrong API key see standup generations and outreach emails just vanish — "Could not generate. Check your API key." is the best they get, but only from the callers. The 429 rate-limit case gives no feedback at all, leaving users confused about whether the app is broken.

**Effort:** S

**Suggested fix:**
- After `const res=await fetch(...)`, add: `if(!res.ok){const err=await res.json().catch(()=>({}));const msg=res.status===429?'Rate limit — wait a moment':res.status===401?'Invalid API key — check Task OS Settings':\`AI error ${res.status}\`;toast(msg);return null;}`
- Mirror the error handling already in `callClaude()` in `index.html:3327-3330`.

---

### 4. Light mode: nav hover/active CSS has a typo breaking all light-mode users
**What:** Line 31 of `index.html` reads `.body.light .ni:hover,.body.light .ni.active{color:var(--accent);}`. The selector `.body.light` selects an element with both class `body` and class `light` — it never matches anything. The correct selector is `body.light` (tag + class).

**Where:** `index.html:31`

**Why it matters:** Every user running in light mode never sees their active nav item highlighted in the accent blue. The nav looks completely unresponsive in light mode — active state is invisible, making it impossible to know which section you're in.

**Effort:** S (one character fix)

**Suggested fix:**
- Change `.body.light .ni:hover,.body.light .ni.active` → `body.light .ni:hover,body.light .ni.active`.
- While there, verify the surrounding `body.light .bp{color:#fff;}` on line 29 also renders correctly (it does — no issue there).

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Standup generator shows the wrong day's completed tasks
**What:** `generateStandup()` computes "yesterday" as `now.getDate()-2` (two days ago), not `now.getDate()-1` (yesterday). The standup prompt's "YESTERDAY COMPLETED" section pulls tasks completed 48+ hours ago.

**Where:** `givelink.html:1488`

**Why it matters:** The daily standup is a trust-building tool used with the team. When it consistently reports stale work as "yesterday", it undermines credibility. The founder is reviewing a tool that silently lies about recent progress.

**Effort:** S

**Suggested fix:**
- Change `yesterday.setDate(now.getDate()-2)` → `yesterday.setDate(now.getDate()-1)`.
- Set hours to `0,0,0,0` (already done on line 1488) to capture all tasks done from yesterday's midnight onward.

---

### 6. CRM activity log uses `window.prompt()` — blocked in many browsers
**What:** `logActivityNP()` uses `window.prompt('Log activity (what happened?):')` to collect the activity note. Modern browsers block `window.prompt()` when called from within event handlers inside nested modal contexts, and mobile browsers block it entirely in standalone PWA mode.

**Where:** `givelink.html:1431-1439` (`logActivityNP`)

**Why it matters:** CRM activity logging is the core workflow for tracking nonprofit outreach. When this is blocked, the user gets no feedback (the prompt silently fails), and the log entry is never created. Critical sales data is lost.

**Effort:** S

**Suggested fix:**
- Replace `window.prompt()` with an inline form appended to the NP modal: add a collapsed `<div id="np-log-form">` with an input + confirm button inside `_showNPModal`.
- Show/hide it on "📝 Log Activity" click. On confirm, run the same save/toast logic from `logActivityNP`.

---

### 7. API key prompt uses `window.prompt()` — blocked as PWA and on mobile
**What:** `getApiKey()` falls back to `window.prompt('Enter your Anthropic API key:')` as its last resort. Like the CRM logger above, this is blocked in PWA standalone mode and many mobile browsers. A user without `taskos_api_key` set who opens the AI Sprint Planner on their phone gets a silent failure.

**Where:** `givelink.html:1086-1087`

**Why it matters:** This is the entry gate to all AI features in the sprint board. A blocked `window.prompt()` means the user can never enter their key from givelink.html, and AI features stay permanently broken for them unless they open Task OS and set the key there first.

**Effort:** S

**Suggested fix:**
- Remove the `window.prompt()` fallback entirely — `callClaudeGL` already handles the key fallback correctly (reads from `taskos.claudeKey`). Once fix #1 is applied, `getApiKey()` can be replaced with the same pattern as `callClaudeGL` lines 1257-1261.
- If no key is found, show a toast: `'Add your Anthropic API key in Task OS → Settings'` with a link or nav trigger.

---

### 8. CRM kanban is unusable on mobile (minimum 960px wide)
**What:** The CRM kanban renders 6 fixed columns with `grid-template-columns:repeat(6,1fr)` and each column has `min-width:160px` (6 × 160 = 960px minimum). The `.crm-kanban` has `overflow-x:auto` but there's no scroll hint, snap behavior, or mobile-adapted layout.

**Where:** `givelink.html:197-199` (CSS), `givelink.html:1317-1337` (render)

**Why it matters:** The CRM is where the Givelink sales pipeline lives — the most business-critical view. A founder checking nonprofit follow-ups on their phone (the primary use case for quick CRM checks) sees a squished, unusable 6-column grid with no clear scroll affordance.

**Effort:** M

**Suggested fix:**
- Add a mobile breakpoint: `@media(max-width:768px){.crm-kanban{grid-template-columns:1fr;overflow-x:unset;}}` and render each stage as a collapsible vertical list.
- Alternatively, on mobile, switch to a horizontal card-swipe pattern with stage tabs (matching the pillar filter tab pattern already in the backlog view).
- Add a faint gradient fade on the right edge of the kanban to indicate horizontal scroll.

---

### 9. `importData()` merges all JSON properties without sanitization
**What:** `importData()` does `Object.assign(S, d)` after only checking that `d.tasks` is an array. A crafted JSON backup file can overwrite `S.claudeKey`, `S.ntfy.topic`, `S.reminders`, `S.goals` — all sensitive or behavioral state.

**Where:** `index.html:1771-1783` (`importData`)

**Why it matters:** If the user ever imports a JSON file from an untrusted source (a shared template, a "starter pack"), or if a malicious file is saved to their downloads, it can silently exfiltrate their API key by replacing it with an attacker-controlled one.

**Effort:** S

**Suggested fix:**
- Whitelist the importable keys: only copy `tasks`, `goals`, `habits`, `habitLogs`, `healthLogs`, `financeEntries`, `people`, `books`, `wins`, `bucketlist`, `wishlist`, `projects`, `values` from the imported object.
- Explicitly skip `claudeKey`, `readwiseKey`, `notionKey`, `ntfy`, and `reminders` during import with a clear comment.

---

### 10. Push notification icon references a file that doesn't exist
**What:** `sw.js` line 39 specifies `icon:'./icons/icon-192.png'` and line 41 `badge:'./icons/icon-192.png'` for browser push notifications. The repository contains `icon.svg` and `icon-gl.svg` at the root, but no `icons/` directory and no `.png` files. The `STATIC` cache list also doesn't include this path.

**Where:** `sw.js:39,41`, and the same path appears in `manifest.json` if it references icons

**Why it matters:** Every browser push notification fires without an icon (the browser uses a fallback generic icon). On Android PWAs this shows as an unbranded notification, reducing recognition and click-through. Also, the missing file generates a 404 on each notification event.

**Effort:** S

**Suggested fix:**
- Either add a proper `icons/icon-192.png` to the repo and `STATIC` cache array.
- Or change the icon path to use the existing SVG: `icon:'./icon.svg'` (most modern browsers support SVG notification icons) or `icon:'./icon-gl.svg'` for Givelink.
- Update both `sw.js` and the PWA manifest files to point to the same valid icon path.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Burndown chart SVG: ternary without `else` produces `"undefined"` in markup
**What:** Line 771 uses the pattern `string + (condition ? 'someHTML') + string` with no `else` clause. When the condition is false, JavaScript evaluates to `undefined`, which string concatenation converts to the literal text `"undefined"` inside the SVG. Currently unreachable due to the `snapshots.length<2` guard, but a ticking time bomb if that guard is ever relaxed.

**Where:** `givelink.html:768-774` (`renderBurndown`)

**Why it matters:** If someone adds a scenario where `actualPts` is empty (e.g., all-day-one data), the rendered SVG contains the literal text "undefined" and the chart breaks visually.

**Effort:** S

**Suggested fix:**
- Change `(actualPts.length?'<circle .../>') +` → `(actualPts.length ? '<circle .../>' : '') +`.
- While here, consider extracting the SVG generation to a separate function for readability.

---

### 12. Service worker cache version is a hardcoded date — deploy risk
**What:** `sw.js:1` has `const CACHE = 'task-os-20260519'`. Every deployment that doesn't manually bump this string will serve stale HTML and assets from cache until the user manually clears their browser.

**Where:** `sw.js:1`

**Why it matters:** A deploy that adds a bug fix or new feature won't reach users who have the PWA installed. The founder and team will see the updated version, but users on older installs won't — leading to confusing support issues.

**Effort:** S

**Suggested fix:**
- Inject the cache version at build/deploy time: set an env var `CACHE_VERSION` in Vercel and replace the constant with it.
- Alternatively, use a hash-based version: read the current timestamp at deploy via a build script that rewrites `sw.js` with the deploy date automatically.
- At minimum, add a comment `// BUMP THIS ON EVERY DEPLOY` directly on line 1.

---

### 13. `active()` is called 20+ times in each render cycle — O(n) repeated filter
**What:** The `active()` function (`index.html:1824`) does `S.tasks.filter(t=>t.status!=='done')` on the full task array. Render functions like `renderCapture`, `renderBuckets`, and `renderDashboard` each call `active()` 4-6 times independently, resulting in repeated full-array scans.

**Where:** `index.html:1824`, called at lines 2113, 2147, 2173, 2285, 2288, 2289, 2350, 2770, 2801, 2833, 3912, 3947, 3974, etc.

**Why it matters:** With hundreds of tasks, each page render scans the full array 20+ times unnecessarily. On lower-end mobile devices this creates noticeable jank when navigating between sections.

**Effort:** S

**Suggested fix:**
- At the top of each major render function, cache the result: `const a = active();` and pass it down, or use it for all sub-queries.
- Optionally add a lightweight cached getter that invalidates on `save()`: `let _activeCache=null; function active(){return _activeCache??(_activeCache=S.tasks.filter(t=>t.status!=='done'));}`

---

### 14. Global `window._notesSynthResult` and `window._highlightTasks` cause state leakage
**What:** Two AI result buffers are stored as `window._notesSynthResult` (index.html:6900) and `window._highlightTasks` (index.html:7014) on the global `window` object. They're never cleared after use. If a user triggers two AI flows in quick succession, the second one can overwrite the first's results mid-flow.

**Where:** `index.html:6900` (notes synthesis), `index.html:7014` (highlight tasks)

**Why it matters:** The edge case where a user opens the highlights modal, starts generation, then opens notes synthesis, the `_notesSynthResult` could get stale data applied to the review form. Rare but produces silent data corruption.

**Effort:** S

**Suggested fix:**
- Replace both with module-level `let` variables scoped to their feature block, clearing them in `closeM()` and at the start of each generation: `let _notesSynthResult = null;` and `let _highlightTasks = [];`.

---

### 15. Dynamic modal DOM nodes accumulate and are never cleaned up
**What:** Several features in givelink.html (`_showNPModal`, `openStandup`, `openOutreachGenerator`) dynamically create modal DOM nodes and append them to `document.body`. They check for existing elements with `document.getElementById` before appending, so they don't duplicate, but the first creation is triggered inside event handlers without any cleanup path.

**Where:** `givelink.html:1359-1388`, `givelink.html:1469-1480`, `givelink.html:1603-1614`

**Why it matters:** While currently safe from duplication, the inline HTML template generation inside event handlers is fragile — e.g., the delete button in the NP modal (line 1380) embeds `editNpId` into the template HTML via `${editNpId?...}` at render time, not call time, which means the conditional is evaluated once and baked in. It works correctly now only because `editNpId` is set before `_showNPModal` is called.

**Effort:** M

**Suggested fix:**
- Declare all modals as static HTML (like the existing `#tm`, `#sm`, `#nsm` modals) so they're always in the DOM and just toggled visible.
- This also eliminates the fragile `editNpId`-in-template pattern — modal buttons can always read `editNpId` from scope at click time.

---

### 16. `_recordSnapshot()` is called on every single task toggle — unnecessary write spam
**What:** `toggleDone()` in givelink.html calls `_recordSnapshot()` on every task completion toggle. `_recordSnapshot()` serializes the entire state and writes to localStorage. On a sprint with 100+ tasks, if a user batch-marks multiple tasks done quickly, this fires synchronously for each click.

**Where:** `givelink.html:733-738` (`toggleDone`), `givelink.html:743-753` (`_recordSnapshot`)

**Why it matters:** localStorage writes are synchronous and can block the main thread. On mobile or slower devices, rapidly completing multiple tasks can cause UI jank or missed state updates if writes are slow.

**Effort:** S

**Suggested fix:**
- Debounce `_recordSnapshot`: `let _snapDebounce=null; function _recordSnapshot(){clearTimeout(_snapDebounce);_snapDebounce=setTimeout(()=>{/* existing logic */},500);}`.
- The burndown only needs one snapshot per day, so a 500ms debounce loses no granularity.

---

## 💡 P3 — Nice to have

### 17. Givelink sprint board uses generic Tailwind blue instead of brand purple
**What:** `givelink.html` sets `--accent:#3b82f6` (Tailwind blue-500) across all interactive elements — buttons, active states, links, progress bars, and the sprint bar. The Givelink brand palette is purple (#5718CA primary, #6B3FA0 secondary). No brand purple appears anywhere in the sprint board.

**Where:** `givelink.html:17` (`:root` CSS variables), all `var(--accent)` usages throughout

**Why it matters:** The sprint board is used daily as a representation of the Givelink company's progress. Using generic blue instead of brand purple means the founder is context-switching into a tool that doesn't feel like "their" company. Small but meaningful for founder morale and brand muscle memory.

**Effort:** S

**Suggested fix:**
- Change `--accent:#3b82f6` → `--accent:#5718CA` in `:root`.
- Adjust the FAB shadow from `rgba(59,130,246,.4)` → `rgba(87,24,202,.4)` to match.
- Verify contrast ratios on dark background `#070d1a`: #5718CA on #070d1a is ~4.8:1 (passes AA for large text, borderline for small). Consider `#7C3AED` (slightly lighter purple) if contrast is needed.

---

### 18. CRM kanban has no empty-state CTA in each stage column
**What:** When a CRM stage (Lead, Contacted, etc.) has zero nonprofits, the column renders an empty `<div class="crm-col">` with just the column header. There's no affordance — no "Add Org" button, no placeholder text, no visual hint.

**Where:** `givelink.html:1317-1337` (`renderCRM` kanban section)

**Why it matters:** When starting a new sales cycle and building the pipeline from scratch, each empty column is a dead end. Users have to know to click "+ Add Org" at the top of the page and then select the stage — there's no spatial shortcut to "drop" an org directly into Lead or Proposal.

**Effort:** S

**Suggested fix:**
- In the kanban card rendering loop, after `cards.map(...)`, add: `${!cards.length ? '<div style="text-align:center;padding:12px;color:var(--muted);font-size:11px;cursor:pointer;" onclick="openAddNP()">+ Add</div>' : ''}`.

---

### 19. Keyboard shortcuts are undiscoverable — no help overlay or tooltip
**What:** Both apps have keyboard shortcuts (`n` to add task, `Escape` to close modals in givelink.html; similar patterns in index.html) but no UI surface exposes them. Power users who discover them stumble on them accidentally.

**Where:** `givelink.html:876-880` (keyboard listener), `index.html` (similar pattern)

**Why it matters:** The founder uses this app daily. Even one discovered shortcut (`n` to quickly add a task without reaching for the mouse) saves 5+ seconds per use — 50+ uses/day = 250 seconds/day. Discoverable shortcuts convert casual users to power users.

**Effort:** S

**Suggested fix:**
- Add a `?` keyboard listener that opens a small tooltip/modal listing shortcuts.
- Or add a `title="Press N"` attribute to the "+ Add Task" button so hovering reveals the shortcut.

---

### 20. API keys stored as plaintext in localStorage — no encryption or expiry
**What:** `S.claudeKey`, `taskos_readwise_key`, `taskos_notion_key`, and `taskos_api_key` are all stored as plaintext JSON in localStorage. Any browser extension with `storage` permission, any XSS vulnerability, or any person with physical device access can read all API keys from DevTools.

**Where:** `index.html:3319-3335` (key usage), `givelink.html:1256-1272` (key usage), settings form (saves `S.claudeKey`)

**Why it matters:** These keys have billing implications (Claude API costs money per call). A leaked key can be used by others to run up charges. Readwise and Notion keys grant read access to personal data. The risk is low for a personal tool but grows with any sharing or collaboration.

**Effort:** M

**Suggested fix:**
- Use `sessionStorage` for the active session's API key lookup, only reading from `localStorage` on app load and clearing from session on close.
- Alternatively, use the Web Crypto API to encrypt keys at rest with a user-supplied passphrase: `crypto.subtle.encrypt(...)` with AES-GCM. The passphrase doesn't need to be stored — just prompted on first load.
- At minimum, add a warning in the Settings UI: "Your API key is stored locally in this browser. Don't use this on a shared computer."

---

_Total: 4 P0 · 6 P1 · 6 P2 · 4 P3_
