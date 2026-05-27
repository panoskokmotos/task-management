# Givelink Improvement Plan

> Generated: 2026-05-27 | Scope: `givelink.html` (1 756 lines) + `index.html` Givelink sections
> Stack: Vanilla HTML/CSS/JS · localStorage · Anthropic API · Vercel PWA

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Burndown chart poisons new sprints with old data

**What**: `confirmNewSprint()` archives the old sprint but never clears `S.snapshots`, so the new sprint's burndown chart immediately renders stale task-completion data from the previous sprint.

**Where**: `givelink.html:820-847` (`confirmNewSprint`) · `givelink.html:754-775` (`renderBurndown`)

**Why it matters**: Every founder who closes Sprint 1 and starts Sprint 2 sees a burndown that looks like tasks are already done — destroying trust in the only chart that shows sprint health.

**Effort**: S

**Suggested fix**:
- Add `S.snapshots = [];` at line 845, immediately before `S.sprint = {name, start, end};`
- Optionally snapshot the new sprint start state right away: call `_recordSnapshot()` after saving so the burndown has a baseline from Day 1

---

### 2. Sprint created with empty dates — all time-based features silently break

**What**: Sprint date fields are not required. If a user clears the dates and saves, `start` and `end` are empty strings; `new Date('')` is `Invalid Date`, which propagates to burndown SVG, velocity calculator, and sidebar days-remaining counter — all show "NaN" or render nothing.

**Where**: `givelink.html:784-793` (`saveSprint`) · `givelink.html:820-825` (`confirmNewSprint`) · `givelink.html:1529-1534` (`calcSprintVelocity`)

**Why it matters**: A single accidental backspace in the date field corrupts the entire sprint metrics system with no error shown to the user.

**Effort**: S

**Suggested fix**:
- Add explicit required-field guards in both `saveSprint()` and `confirmNewSprint()`:
  ```js
  if(!start || !end){ toast('Start and end dates are required.'); return; }
  ```
- Add `min` attribute to date inputs so browsers enforce non-empty values at the HTML level

---

### 3. `callClaudeGL` swallows API error details — wrong error surfaced to user

**What**: `callClaudeGL()` calls `res.json()` unconditionally without checking `res.ok`. When the API returns a 401 (bad key) or 429 (rate limit), the function still parses the JSON body, but `data.content` is undefined, so the function silently returns `null`. The caller shows "Could not generate. Check your API key." even for rate-limit errors, giving the user no actionable information.

**Where**: `givelink.html:1263-1271` (`callClaudeGL`)

**Why it matters**: Users with valid keys who hit rate limits will revoke and re-enter their API key trying to fix a non-existent problem. Real 401s and 429s need distinct messages.

**Effort**: S

**Suggested fix**:
- Check `res.ok` before parsing, and throw with the status:
  ```js
  if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error(e.error?.message||`HTTP ${res.status}`); }
  ```
- Propagate the thrown message in the `catch` block's `toast()` call so the user sees the real reason

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Brand color palette — entire app uses blue, not Givelink's purple/pink

**What**: `givelink.html` declares `--accent: #3b82f6` (blue) as its primary brand colour. The Givelink brand palette is purple (`#6B3FA0` / `#5718CA`) and pink (`#C2185B` / `#E353B6`). No purple or pink tokens appear anywhere in the file. The update banner also uses `#22c55e` (green), compounding the inconsistency.

**Where**: `givelink.html:17-19` (`:root` tokens) · `givelink.html:1738` (update banner) · `givelink.html:422-426` (PILLARS hex values reference `var(--gr)`, `var(--np)` etc.)

**Why it matters**: Every investor demo, nonprofit partner meeting, and tweet with a screenshot reinforces off-brand blue. The disconnect between the index.html brand hero and givelink.html erodes perceived quality.

**Effort**: M

**Suggested fix**:
- Remap CSS tokens: `--accent: #5718CA`, introduce `--accent-light: #6B3FA0`, `--pink: #E353B6`, `--pink-dark: #C2185B`
- Update `--prog` and sidebar active indicator to use `--accent`
- Replace update banner `background: #22c55e` with `background: var(--accent)` and text to `color: #fff`
- Do NOT place `--pink` text on `--accent` backgrounds — failing contrast (no pink-on-purple)

---

### 5. AI loading states: no controls disabled → stale content is copyable mid-generation

**What**: `generateStandup()` and `generateOutreach()` set body text to "⏳ Generating…" but leave the Copy and Close buttons fully active. A user who clicks Copy in the first second will copy the placeholder string. Neither function disables the copy button, and neither `generateOutreach()` wraps `callClaudeGL` in its own try/catch — if the modal DOM is closed while awaiting, the `body.textContent =` assignment throws an unhandled error.

**Where**: `givelink.html:1484-1523` (`generateStandup` / `copyStandup`) · `givelink.html:1632-1667` (`generateOutreach`) · `givelink.html:1597-1631` (`openOutreach`)

**Why it matters**: Founders copy "⏳ Generating…" into Slack standups. The unhandled promise rejection also surfaces in the browser console, which looks unprofessional during demos.

**Effort**: S

**Suggested fix**:
- Disable Copy button at generation start; re-enable in the `if(text)` branch
- Wrap `generateOutreach()` body in a try/catch that sets `body.textContent = 'Error: ' + e.message` on failure, matching the pattern in `runAiSprintPlanner()`
- Guard against detached DOM: check `document.contains(body)` before setting `body.textContent` in the finally block

---

### 6. `S.blFilter` not persisted — backlog filter resets on every page refresh

**What**: `setBLFilter()` sets `S.blFilter` in memory but the call to `save()` happens inside `renderBacklog()` only when tasks change, not when the filter changes. The initial `S.blFilter:'all'` in the default state overrides whatever was selected on the previous session.

**Where**: `givelink.html:587-591` (`setBLFilter`) · `givelink.html:436-443` (state initialization)

**Why it matters**: If a user habitually filters backlog to "nonprofits", every page load forces them back to "all" — a small but daily friction point that adds up.

**Effort**: S

**Suggested fix**:
- Call `save()` at the end of `setBLFilter()` after `renderBacklog()`, or persist just the filter with `localStorage.setItem('gl_blFilter', f)` and restore it in `load()`

---

### 7. MRR / ARR stored as integers — decimal revenue truncated silently

**What**: `saveGivelinkMetrics()` in `index.html` uses `parseInt()` for MRR and ARR fields. Entering `1500.50` saves as `1500`, silently losing the decimal. Financial dashboards need decimal precision.

**Where**: `index.html:6758-6759`

**Why it matters**: MRR and ARR are the two most-watched startup metrics. Truncation is a credibility issue if the value is shared in investor updates or board decks exported from the app.

**Effort**: S

**Suggested fix**:
- Replace `parseInt(...)` with `parseFloat(...)` for `gl-mrr` and `gl-arr` fields
- Consider `Math.round(parseFloat(...) * 100) / 100` to limit to 2 decimal places

---

### 8. AI Sprint Planner crashes if Claude returns malformed JSON

**What**: `renderAiSuggestions(suggestions)` at line 1164 calls `suggestions.map(...)` directly. If Claude returns valid JSON that isn't an array (e.g. `{"tasks": [...]}` or a string), this throws `TypeError: suggestions.map is not a function`, which is uncaught at this level — the modal shows nothing and the user sees no error.

**Where**: `givelink.html:1156` (`renderAiSuggestions` call) · `givelink.html:1164-1180` (`renderAiSuggestions`)

**Why it matters**: Claude occasionally wraps arrays in an object when the temperature is slightly off. This crash leaves the AI modal in a broken state with no user-visible feedback.

**Effort**: S

**Suggested fix**:
- In the try block after `suggestions = JSON.parse(...)`, add: `if(!Array.isArray(suggestions)) throw new Error('Expected an array of tasks')`
- Add a catch-all at the top of `renderAiSuggestions` that shows an inline error if `!Array.isArray(suggestions)`

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. Clipboard fallback logic copy-pasted in two places

**What**: The `navigator.clipboard` + `execCommand` fallback pattern is duplicated identically in `copyStandup()` (lines 1517–1523) and `copyOutreach()` (line 1620–1621).

**Where**: `givelink.html:1517-1523` · `givelink.html:1619-1621`

**Why it matters**: Any fix to the clipboard fallback (e.g., `document.execCommand` is deprecated) must be applied in two places, and the second copy is easy to miss.

**Effort**: S

**Suggested fix**:
- Extract to `function copyText(text){ navigator.clipboard.writeText(text).then(()=>toast('📋 Copied!')).catch(()=>{...fallback...}); }`
- Replace both callsites with `copyText(body._text || body.textContent)`

---

### 10. DOM node used as data store (`body._text`)

**What**: Generated AI text is stored on the DOM element itself via `body._text = text` at three locations. This is an unofficial property, invisible to code search, and breaks if the element is replaced (e.g., when the modal is closed and reopened).

**Where**: `givelink.html:1512` · `givelink.html:1627` · `givelink.html:1663`

**Why it matters**: If `openStandup()` is called a second time while a previous generation is in flight, the modal is reused but `body._text` may hold stale content — `copyStandup()` could copy the old text.

**Effort**: S

**Suggested fix**:
- Replace with a module-level variable: `let _lastStandup = '';` and `let _lastOutreach = '';`
- Set them when generation completes; clear them in `openStandup()` / `openOutreach()`

---

### 11. Empty `catch(e){}` silently swallows API key lookup errors

**What**: `getApiKey()` has a bare `catch(e){}` at line 1083 with no logging or user feedback. If `localStorage.getItem('taskos_data_...')` returns corrupted JSON, the profile loop exits silently and falls through to prompt the user for a key they've already entered.

**Where**: `givelink.html:1078-1088` (`getApiKey`)

**Why it matters**: A first-time user whose Task OS data is slightly malformed will see an unexpected API key prompt on every AI action, even though they already configured their key in Task OS.

**Effort**: S

**Suggested fix**:
- Change to `catch(e){ console.warn('Could not read profile API key:', e); }` so the failure is visible in DevTools
- This costs one line and turns a mystery into a debuggable event

---

### 12. Service worker registration has no `.catch()` handler

**What**: `navigator.serviceWorker.register('./sw.js')` at line 1721 has no error handler. If the SW fails to register (e.g., HTTPS not available on the deployment URL, or `sw.js` 404s), the failure is completely silent.

**Where**: `givelink.html:1720-1728`

**Why it matters**: The app depends on the SW for offline caching. Silent SW failures mean users think they have offline support when they don't — data loss risk on flaky connections.

**Effort**: S

**Suggested fix**:
- Add `.catch(err => console.error('SW registration failed:', err))` to the `register()` chain
- Optionally show a non-intrusive toast if `process.env !== 'development'`

---

### 13. `_aiSuggestions` is a mutable global — concurrent AI calls corrupt selection

**What**: `_aiSuggestions` (line 1163) is a module-level array written by `renderAiSuggestions()` and read by `addSuggestedSprintTasks()`. If a user clicks "Regenerate" while the previous suggestions are being reviewed, the array is overwritten before `addSuggestedSprintTasks()` reads it.

**Where**: `givelink.html:1163-1200`

**Why it matters**: Low probability but real: rapid double-clicks on Regenerate replace the suggestions list the user was reading, then Add Selected adds the new list instead of the checked ones.

**Effort**: S

**Suggested fix**:
- Capture suggestions in a local closure: pass `suggestions` directly to `addSuggestedSprintTasks(suggestions)` rather than relying on the global, or use a WeakMap keyed by the modal element

---

### 14. Magic number `86400000` used three times without a named constant

**What**: The milliseconds-per-day value `86400000` appears at lines 1532, 1533, 1534 (all in `calcSprintVelocity`). The identical literal appears in `renderBurndown()` (line 761) and in the CRM seed data (line 1284, `Date.now()-3*86400000`).

**Where**: `givelink.html:761` · `givelink.html:1532-1534` · `givelink.html:1284-1289`

**Why it matters**: Searching for `86400000` to understand time math is harder than reading `MS_PER_DAY`. Off-by-one errors in date math are the #1 source of subtle sprint-date bugs.

**Effort**: S

**Suggested fix**:
- Add `const MS_PER_DAY = 86_400_000;` near the top of the script block and replace all occurrences

---

### 15. Update banner uses off-brand green with hard-coded black text

**What**: The PWA update banner (line 1738) uses `background: #22c55e; color: #000` — neither of these is in the Givelink brand palette, and the green clashes with the dark app chrome.

**Where**: `givelink.html:1738-1741`

**Why it matters**: This banner appears on every app update — i.e., after every deploy. It's one of the highest-frequency brand touchpoints and currently reads like a default template.

**Effort**: S

**Suggested fix**:
- Change to `background: var(--accent); color: #fff`
- Update the Reload button to use `background: rgba(255,255,255,.15); color: #fff; border: 1px solid rgba(255,255,255,.3)`

---

## 💡 P3 — Nice to have

### 16. Duplicate impact stories can be saved without deduplication

**What**: `saveGivelinkMetrics()` in `index.html` pushes any non-empty story string to `S.givelinkMetrics.impactStories` without checking for duplicates. Clicking Save twice with the same text adds the story twice to the dashboard.

**Where**: `index.html:6761-6762`

**Why it matters**: The impact stories section on the dashboard looks unprofessional with repeated entries; cleaning it up requires manual JSON editing of localStorage.

**Effort**: S

**Suggested fix**:
- Before pushing: `if(!S.givelinkMetrics.impactStories.includes(story))` — one line

---

### 17. CRM stage colours defined separately from stage labels — sync risk

**What**: `CRM_STAGES`, `CRM_STAGE_LABEL`, and `CRM_STAGE_COLOR` are three separate parallel data structures (lines 1277–1279). Adding a new stage requires editing three different objects; missing one causes a silent `undefined` rendering.

**Where**: `givelink.html:1277-1279`

**Why it matters**: The next developer (or future-you) adding a "demo" stage will almost certainly update `CRM_STAGES` and `CRM_STAGE_LABEL` but forget `CRM_STAGE_COLOR`, which renders as `undefined` in CSS.

**Effort**: S

**Suggested fix**:
- Merge into one object: `const CRM_STAGES = { lead: {label:'Lead', color:'#64748b'}, ... }` and derive the array with `Object.keys(CRM_STAGES)` where needed

---

### 18. Keyboard Escape doesn't close modals when focus is in a form field

**What**: The keydown handler (lines 876–880) excludes INPUT and TEXTAREA from Escape handling. This means a user who is typing a task title and hits Escape — the intuitive "cancel" action — is not served; they must click the Cancel button.

**Where**: `givelink.html:876-880`

**Why it matters**: Standard web UX convention is that Escape always dismisses the topmost modal, regardless of focus. This trips up power users who use keyboard-first workflows.

**Effort**: S

**Suggested fix**:
- Change the guard from `if(INPUT/TEXTAREA)return` to only suppress alphanumeric shortcuts (n, etc.) — let Escape propagate through to `closeM()` unconditionally

---

### 19. `syncToTaskOS()` silently succeeds even when no Task OS data exists

**What**: `syncToTaskOS()` (line 1206) creates a new empty Task OS data structure if none is found (`tosData = {tasks: []}`) and writes sprint tasks into it. But this new data is written to `taskos_data_<profileId>` in localStorage — if the user hasn't opened Task OS on the same browser, `profile.id` is also fabricated from potentially stale profile data. The sync toast says "Synced!" regardless of whether data was actually written to a real Task OS session.

**Where**: `givelink.html:1206-1255`

**Why it matters**: Users trust the 🔗 Sync button to keep Task OS up to date. A false "Synced!" confirmation when no real Task OS session exists erodes that trust.

**Effort**: M

**Suggested fix**:
- Check that `tosData` came from a real localStorage read (not the `{tasks:[]}` fallback) before writing; if it's the fallback, show: `toast('No active Task OS session found. Open Task OS first.')`
- Report actual counts: `toast(\`Synced: ${synced} tasks updated, ${added} added\`)`

---

### 20. No `aria-label` on FAB and install CTA buttons

**What**: The floating action button (line 303) and the PWA install button (line 1751) have no `aria-label`. Screen readers announce them as generic "button" elements.

**Where**: `givelink.html:303` · `givelink.html:1751`

**Why it matters**: Nonprofit clients and partners are statistically more likely than average to use assistive technology. The app's own target audience has a higher accessibility bar.

**Effort**: S

**Suggested fix**:
- Add `aria-label="Add task"` to the FAB button
- Add `aria-label="Install Givelink as app"` to the install button
- Add `role="dialog"` and `aria-modal="true"` to modal containers for full screen-reader support
