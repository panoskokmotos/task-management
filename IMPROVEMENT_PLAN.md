# Givelink / Task OS — Improvement Plan

Reviewed: 2026-05-05  
Scope: `index.html` (4,685 lines), `givelink.html` (1,716 lines), `sw.js`, manifests  
Stack: Vanilla JS/HTML/CSS, localStorage persistence, Anthropic API (direct browser call)

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. XSS via task title injected raw into `onclick` attribute — EOD ritual

**What:** A task title containing a double-quote or `</div>` breaks out of the `onclick` string and executes arbitrary JS.

**Where:** `index.html:4344`
```js
// VULNERABLE — title only has ' escaped, not "
onclick="document.getElementById('eod-mit').value='${t.title.replace(/'/g,"\'")}';"
```

**Why it matters:** Any task the user has ever saved can contain a payload (e.g. entered via quick-capture). Triggers during the nightly End-of-Day ritual — one of the most-used flows. No external attacker needed; self-XSS via stored task data is the risk.

**Effort:** S

**Suggested fix:**
- Replace the inline `onclick` pattern with a `data-id` attribute and a delegated event listener that reads the title from `S.tasks` by ID — never interpolates user text into JS strings.
- Alternatively, use `element.addEventListener('click', () => input.value = t.title)` created imperatively instead of via `innerHTML`.

---

### 2. XSS in core task/goal render functions — titles and descriptions unescaped

**What:** `tcHTML()`, `inboxHTML()`, `goalHTML()`, and the weekly review wizard all interpolate `t.title`, `g.title`, `g.description`, and linked task titles directly into `innerHTML` without calling `esc()`.

**Where:**
- `index.html:1222` — `inboxHTML`: `<div class="tt">${t.title}</div>`
- `index.html:1451` — `tcHTML`: `<div class="tt">${t.title}</div>`
- `index.html:1363` — `goalHTML`: `${g.title}`, `${g.description}`, `${t.title}` (linked tasks)
- `index.html:1380,1387,1389` — weekly review wizard steps 0/2/3

**Why it matters:** Every task list, bucket view, Eisenhower matrix, and weekly review renders unescaped HTML. `esc()` already exists (`index.html:4174`) and is used in a handful of newer components (`givelink.html:taskHTML` uses it correctly). This is a systemic gap — 105 `innerHTML` assignments versus 5 `esc()` calls.

**Effort:** M

**Suggested fix:**
- Apply `esc()` to every `t.title`, `t.notes`, `g.title`, `g.description`, `p.name`, and any other user-supplied string interpolated into `innerHTML` templates.
- Add a lint rule / grep check to CI: `innerHTML.*\${(?!esc\()` to catch regressions.

---

### 3. Claude API key stored inside the main state blob in localStorage

**What:** `S.claudeKey` is serialized as part of the entire state JSON on every `save()` call, meaning the API key is readable as a plain string inside `localStorage['taskos']` — visible to any browser extension, XSS payload, or shared browser session.

**Where:**
- `index.html:1119` — `claudeKey:''` defined inside `S`
- `index.html:1124` — `save()` serializes all of `S` including the key
- `index.html:3906` — `S.claudeKey = k; save();`

**Why it matters:** API key exposure leads to quota abuse and unexpected billing charges. The key should never ride alongside user data.

**Effort:** S

**Suggested fix:**
- Move the key out of `S`; read/write it exclusively via a dedicated `localStorage.getItem('taskos_claude_key')` call (separate from the main state blob).
- In `callClaude()` (`index.html:2218`), read the key at call time: `const key = localStorage.getItem('taskos_claude_key');`.
- Strip `claudeKey` from `S` and add a one-time migration in `load()` to move any existing value across.

---

### 4. Silent `catch(e){}` in AI briefing drops corrupt cache — widget goes blank

**What:** If the cached briefing JSON is malformed, the empty catch block swallows the error and returns without clearing the cache or showing any feedback. The briefing widget stays blank all day with no retry.

**Where:** `index.html:4065`
```js
try{const d=JSON.parse(cached);_renderAIBriefing(d,el);}catch(e){}
```

**Why it matters:** Corrupt localStorage (e.g. partial write, storage quota eviction) means the morning briefing — the first screen users see — silently fails. The user has no indication anything is wrong and no way to recover without opening DevTools.

**Effort:** S

**Suggested fix:**
- In the catch block: `localStorage.removeItem(cacheKey); _fetchAIBriefing(ctx, el, cacheKey);` — clear bad cache and re-fetch.
- Add `console.warn('Briefing cache corrupt, re-fetching', e)` so debugging is possible.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. "Panos" hardcoded as default name AND baked into AI prompts

**What:** The default profile name falls back to the literal string `'Panos'` instead of a generic placeholder. Worse, two AI prompt strings hardcode the name rather than using `profileName`.

**Where:**
- `index.html:1121` — `let profileName = localStorage.getItem('taskos_name') || 'Panos';`
- `index.html:4080` — AI briefing prompt: `"personal chief-of-staff for Panos, founder of Givelink"`
- `index.html:4208` — Relationship nudge: `"for Panos to send to ${p.name}"`

**Why it matters:** Any new user who skips name setup sees "Good morning, Panos 👋" everywhere and receives AI messages written for someone named Panos. This is a first-session trust-breaker and signals the app isn't ready for anyone else.

**Effort:** S

**Suggested fix:**
- Change fallback to `'there'` or `''` with a conditional: `Good morning${profileName ? ', ' + profileName : ''}`.
- Replace both hardcoded AI prompt strings with template interpolation of `profileName`.
- Show a name-setup prompt on first launch if `localStorage.getItem('taskos_name')` is null.

---

### 6. Near-zero accessibility — screen reader and keyboard users are blocked

**What:** The entire `index.html` has exactly one `aria-label` (the hamburger button at line 262). No modals have `role="dialog"` or `aria-modal`. No interactive icon-only buttons have labels. No focus is managed when modals open or close.

**Where:** `index.html:262` (only aria-label found), all modal divs (lines ~594, ~1474, ~1530, etc.), all icon-only buttons

**Why it matters:** WCAG 2.1 AA compliance is increasingly a legal requirement. Keyboard-only users (power users, accessibility needs) cannot use the app at all — Tab order is arbitrary, modal focus is not trapped, and Escape does not close modals.

**Effort:** M

**Suggested fix:**
- Add `role="dialog" aria-modal="true" aria-labelledby="..."` to every modal overlay.
- Add `aria-label` to every icon-only button (checkboxes, ✏️ edit, 🗑 delete, ✓ done).
- Implement focus trap in `openModal` / `closeModal`: on open, move focus to the first interactive element; on close, return focus to the trigger; wire `Escape` to close.

---

### 7. No loading state on first AI briefing fetch — widget appears broken

**What:** When the daily briefing fetches for the first time (no cache), the widget's body shows the static line summary but the AI section shows nothing and gives no indication it is working.

**Where:** `index.html:4063–4095` — `renderAIBriefing()` and `_fetchAIBriefing()`

**Why it matters:** Users see a blank card and assume the feature is broken. The AI features are a key differentiator; a silent load state undercuts trust in them.

**Effort:** S

**Suggested fix:**
- In `renderAIBriefing()`, before calling `_fetchAIBriefing()`, set a visible spinner: `el.innerHTML = '<div style="color:var(--muted);font-size:12px;">✨ Generating briefing…</div>';`
- On fetch failure (`!text` at line 4097), show: `el.innerHTML = '<div style="color:var(--muted);font-size:12px;">Briefing unavailable — check API key in Settings.</div>';`

---

### 8. State loaded with no schema validation — corrupt data crashes the whole app

**What:** `load()` does a raw spread merge: `S = {...S, ...JSON.parse(d)}`. If any stored field has the wrong type (e.g. `tasks` is a string instead of array from a partial write), every downstream `filter`/`map` call throws and the app is unrecoverable without clearing storage.

**Where:** `index.html:1125`

**Why it matters:** A storage quota error mid-write or a bug in any serialization path can corrupt the state file and permanently lock the user out of their data.

**Effort:** S

**Suggested fix:**
- After the spread, validate array fields: `['tasks','goals','healthLogs','financeEntries','habits',...].forEach(k => { if (!Array.isArray(S[k])) S[k] = []; });`
- Wrap the entire `load()` body in a try/catch that, on failure, shows a recoverable error UI (export raw JSON + reset button) rather than a blank screen.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. `claudeKey` field and three dead state fields bloat every save/load cycle

**What:** `S.claudeKey` (moved to P0 for security), plus `seededGoalsV3`, `photoLogs`, and `contextLog` are defined in state (`index.html:1119`) but unused in any render or logic path. They are serialized and deserialized on every save.

**Where:** `index.html:1119`

**Why it matters:** Unused fields grow localStorage footprint, confuse contributors reading the state shape, and can mask real bugs when grepping for their names.

**Effort:** S

**Suggested fix:**
- Remove `seededGoalsV3`, `photoLogs`, and `contextLog` from `S` after confirming no references exist (grep confirms zero usage).
- Add a `load()` migration to delete them from any existing stored blobs so they don't persist.

---

### 10. Magic number business targets baked into `goalHTML` render function

**What:** Income and body-fat targets are hardcoded constants inside the view layer: `{income: 25000, passive: 3600}` and `{bodyfat: 12, sleep: 85}`.

**Where:**
- `index.html:1348` — `const targets = {bodyfat: 12, sleep: 85};`
- `index.html:1367` — `const targets = {income: 25000, passive: 3600};`

**Why it matters:** These numbers are wrong for any user who isn't the original developer. Goals linked to health or finance metrics will show misleading progress bars (e.g. a €50,000 target user sees 200% complete when they hit €25k). Changing them requires knowing to look inside a render function.

**Effort:** S

**Suggested fix:**
- Store targets on the goal object itself (`g.targetValue`) so users can set their own via the goal edit modal.
- Fall back to the current hardcoded values only if `g.targetValue` is not set, and display a "Set target" prompt when no value exists.

---

### 11. No debounce on `renderAll` causes jank on large task lists

**What:** The "all tasks" search input calls `renderAll()` on every `oninput` event with no debounce. Every keypress triggers a full synchronous re-render of all tasks via string concatenation and `innerHTML` assignment.

**Where:** `index.html` — search input `oninput` handler feeding into `renderAll()` at line 1290

**Why it matters:** With 50+ tasks the input lags visibly. At 200+ tasks (the GTD backlog use case) it's perceptibly slow. This undermines the quick-capture promise.

**Effort:** S

**Suggested fix:**
- Wrap the `oninput` callback in a debounce: `let _st; input.oninput = () => { clearTimeout(_st); _st = setTimeout(renderAll, 150); };`
- No library needed — a one-liner inline debounce is sufficient.

---

### 12. Givelink and Task OS use different accent colors with no shared token

**What:** `index.html` uses `--accent: #58a6ff` (GitHub blue). `givelink.html` uses `--accent: #3b82f6` (Tailwind blue). Neither uses the specified brand purple (`#6B3FA0` / `#5718CA`) or pink (`#C2185B` / `#E353B6`). The two apps look like they are from different products.

**Where:**
- `index.html:18` — `--accent: #58a6ff;`
- `givelink.html:17` — `--accent: #3b82f6;`

**Why it matters:** Brand inconsistency erodes trust and makes the product feel like a prototype. If the purple/pink palette is intentional, it needs to be applied. If the blue palette is correct, at least both apps should share the same hex value.

**Effort:** S

**Suggested fix:**
- Decide on one brand accent and update both files to use the same hex value.
- If adopting the specified purple palette: replace `#58a6ff` / `#3b82f6` with `#6B3FA0` in both files. Verify contrast ratio ≥ 4.5:1 against the dark backgrounds.
- Note: do not place pink (`#E353B6`) text directly on purple (`#5718CA`) backgrounds — insufficient contrast.

---

## 💡 P3 — Nice to have

### 13. No data export or backup — all user data lost if localStorage is cleared

**What:** There is no way to export tasks, goals, health logs, or finance entries. Clearing browser data, switching devices, or a browser privacy-mode session permanently destroys all data.

**Where:** Settings panel `index.html:750–760` — only "Reset Data" exists, no export button

**Why it matters:** Power users with months of data have a single point of failure. A single accidental "Clear site data" is unrecoverable. This is the most common reason users stop trusting productivity apps.

**Effort:** M

**Suggested fix:**
- Add an "Export JSON" button in Settings that calls `JSON.stringify(S, null, 2)` and triggers a file download via a Blob URL.
- Add a corresponding "Import JSON" file input that parses and merges/replaces state with a confirmation dialog.
- Consider a daily auto-export reminder if the user has not exported in 30 days.

---

### 14. No undo for destructive operations — delTask, delGoal are permanent

**What:** Clicking 🗑 on a task or goal immediately removes it with no undo path. The only confirmation is a `window.confirm()` dialog for "Reset ALL data" — individual deletions have no safety net.

**Where:** `index.html:1230` — `delTask()`, called from delete buttons throughout all views

**Why it matters:** Accidental deletes of important tasks or goals — especially during the weekly review triage — destroy data permanently. This creates anxiety that slows engagement with the cleanup flows.

**Effort:** M

**Suggested fix:**
- Implement a soft-delete: add `deletedAt` timestamp to tasks/goals instead of splicing the array. Filter `deletedAt` items out of all views.
- Show a "Undo" toast (2-second window) after any delete that, if clicked, clears the `deletedAt` field.
- Permanently purge items older than 30 days in `load()` or on a save cycle.
