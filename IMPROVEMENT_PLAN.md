# Givelink / Task OS — Improvement Plan

_Generated: 2026-05-06_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. API key sent from the browser in plaintext

**What:** The Anthropic API key is read from localStorage and attached as an `x-api-key` header directly in the browser fetch call, exposing it in DevTools / network logs.

**Where:** `index.html:2218`, `givelink.html:1227`

```js
headers: { 'x-api-key': S.claudeKey, ... }
```

**Why it matters:** Any user who opens DevTools — or any XSS payload — can steal the key and rack up charges on the user's account. A single compromised session can drain hundreds of dollars.

**Effort:** M

**Suggested fix:**
- Deploy a thin serverless proxy (Vercel Edge Function or Next.js API route) that holds the key server-side and forwards requests to Anthropic.
- The browser sends requests to `/api/claude` (same origin), never touching the key.
- Remove all references to `S.claudeKey` / localStorage API key storage.

---

### 2. Silent JSON parse failures cause invisible data loss

**What:** Three `try/catch` blocks around `JSON.parse()` swallow parse errors with empty catch bodies — if localStorage data is corrupted the app silently continues with default (empty) state, losing all user data.

**Where:** `index.html:4065`, `index.html:4151`, `givelink.html:1220`

```js
try { JSON.parse(cached) } catch(e) {}   // ← no warning, no recovery
```

**Why it matters:** A partial write (browser crash, storage quota hit) silently nukes every task, goal, and journal entry a user has. They see a blank app with no explanation.

**Effort:** S

**Suggested fix:**
- Show a blocking error modal if parse fails: "Your data may be corrupted. Here's your raw backup — [copy button]."
- Keep a rolling `taskos_backup` key in localStorage written on every successful save so there's always one good snapshot to fall back to.
- Log parse errors to the console with the raw string so issues can be debugged.

---

### 3. XSS via unescaped user input in `innerHTML` assignments

**What:** The `esc()` sanitiser exists but is applied inconsistently — task titles, goal names, and note bodies are interpolated directly into template literals that land in `innerHTML`.

**Where:** `index.html:1326` (values map), `index.html:1509` (task push renders immediately), ~150 other `innerHTML` assignments across both files.

**Why it matters:** A user who pastes `<img src=x onerror=alert(1)>` into a task title gets script execution. If Anthropic ever returns a malicious string via a prompt-injection attack, it runs in the same origin as localStorage (where the API key lives).

**Effort:** M

**Suggested fix:**
- Grep for every template literal inside an `innerHTML =` assignment and wrap every interpolated user-supplied value with `esc()`.
- Add a lint rule (even a simple pre-commit `grep` check) to catch regressions.
- Long-term: move to `textContent` for leaf nodes so escaping is automatic.

---

### 4. Service worker serves stale HTML indefinitely

**What:** `sw.js` uses `stale-while-revalidate` for the main HTML documents, meaning a user can be served a week-old version of the app while the new one fetches in the background — with no reload prompt until the *next* visit.

**Where:** `sw.js` (cache strategy), `index.html` (auto-update banner logic, ~line 50)

**Why it matters:** Bug fixes and security patches don't reach users promptly. The auto-update banner helps but only fires after the new SW activates, which can be one full session behind.

**Effort:** S

**Suggested fix:**
- Change the HTML document cache strategy to `network-first` with a short timeout (3 s), falling back to cache for offline support.
- Keep `stale-while-revalidate` only for static assets (CSS, icons, fonts) where stale content is harmless.
- The existing update banner can stay as a UX nicety for when network is slow.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. Claude API errors give no actionable guidance

**What:** All AI features show a generic toast (`"AI error: " + e.message`) on any failure — whether the key is wrong, the network is down, the quota is hit, or the request timed out. Users have no idea what to fix.

**Where:** `index.html:2213–2223` (`callClaude` function), mirrored in `givelink.html:1227`

**Why it matters:** AI features are the primary differentiator. Silent/cryptic failures make users think the product is broken and stop trying.

**Effort:** S

**Suggested fix:**
- Parse the HTTP status code and Anthropic error body: 401 → "Check your API key in Settings", 429 → "Rate limit hit — try again in 60 s", 5xx → "Anthropic is having issues — try again shortly."
- Add a 15-second `AbortController` timeout and surface it distinctly: "Request timed out."
- Show errors inline below the AI result area, not just as a dismissible toast.

---

### 6. Destructive deletes have no undo

**What:** Deleting a task, goal, habit, or contact immediately mutates state and writes to localStorage. The only guard is a browser `confirm()` dialog. There is no undo.

**Where:** Throughout `index.html` and `givelink.html` — every `S.tasks.splice(...)` / `G.backlog.splice(...)` call followed immediately by `save()`.

**Why it matters:** Accidental deletes are unrecoverable. For a productivity app where users track months of journal entries and goals, permanent data loss is a churn trigger.

**Effort:** M

**Suggested fix:**
- Replace immediate `splice + save()` with a soft-delete pattern: set `t.deleted = Date.now()`, filter deleted items out of all renders, and run a cleanup after 30 days.
- Show a 5-second "Undo" snackbar after every delete before the item is actually removed from the save.
- As a quick interim: store the last-deleted item in memory and offer undo via the toast.

---

### 7. No loading state during AI generation

**What:** When any AI feature fires, the button stays active and the output area shows nothing until the response arrives (or fails). There is no spinner, skeleton, or disabled state.

**Where:** All AI trigger buttons across `index.html` and `givelink.html` — ~20 call sites.

**Why it matters:** Users click the button twice (double-request), navigate away thinking it's broken, or can't tell whether the feature is working. Perceived quality drops.

**Effort:** S

**Suggested fix:**
- Disable the triggering button and show a spinner `<span class="spin">⏳</span>` in the output area at the start of every `callClaude` call.
- Re-enable the button and clear the spinner in both the success path and the catch block.
- A shared `setAILoading(el, true/false)` helper prevents the pattern from diverging across 20 call sites.

---

### 8. Empty states are inconsistent and sometimes missing entirely

**What:** Some views show a friendly empty state (`"Inbox empty! 🎉"`), others render an empty container with no message, and some views never account for the empty case at all.

**Where:** `index.html:1214` (inbox — good example), `index.html:1298` (all-list — no empty state), various bucket/goal/habit views.

**Why it matters:** New users land on blank screens with no guidance on what to do next, increasing bounce and abandonment.

**Effort:** S

**Suggested fix:**
- Audit every `innerHTML` render function: if the filtered array is empty, return a consistent empty-state template with a CTA (e.g. "No tasks yet — capture one above").
- Create a single `emptyState(icon, message, ctaText, ctaAction)` helper so the treatment is uniform.

---

### 9. `parseInt()` calls without radix risk silent NaN bugs

**What:** Several `parseInt()` calls omit the radix argument, meaning strings starting with `0` could be parsed as octal in older engines, and bad input silently returns `NaN` which propagates into task durations and finance values.

**Where:** `index.html:1495` and ~8 other call sites.

**Why it matters:** Finance and health tracking features depend on numeric inputs being correct. A corrupted value in a goal target or budget figure produces wrong UI with no error shown.

**Effort:** S

**Suggested fix:**
- Replace all `parseInt(x)` with `parseInt(x, 10)` or `Number(x)`.
- Add a guard: `if (isNaN(val)) { toast('Please enter a valid number'); return; }` before mutating state.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 10. God-object state with UI mutations scattered everywhere

**What:** All app state lives in a single `S` / `G` object. UI event handlers mutate it directly — `S.tasks.push({...})`, `S.goals.splice(...)` — with no separation between business logic and presentation.

**Where:** `index.html` (386 functions, ~4 400 lines); `givelink.html` (~1 700 lines).

**Why it matters:** Any change to data shape requires hunting through hundreds of render functions. New features are slow to add and easy to break because there's no contract between layers.

**Effort:** L

**Suggested fix:**
- Extract pure data-mutation functions (`addTask`, `completeTask`, `deleteGoal`) that only touch `S` and call `save()` — no DOM touches.
- Render functions receive data as arguments rather than reading `S` directly, making them testable.
- This doesn't require a framework: a simple module pattern (`const TaskStore = { add, remove, complete }`) is enough.

---

### 11. Repeated filter operations with no memoization

**What:** `S.tasks.filter(t => t.status !== 'done')` and similar expressions are recomputed on every render call. `renderDash()` alone runs 6–8 independent filter passes over the full task array.

**Where:** `index.html` — `renderDash()`, `renderBuckets()`, `renderAll()`, and dozens of helper functions.

**Why it matters:** On a device with 500+ tasks, every keypress that triggers a re-render blocks the main thread. Tab switches feel sluggish.

**Effort:** S

**Suggested fix:**
- Compute derived slices once after every `save()`: `const activeTasks = S.tasks.filter(...)` stored in a module-level cache object, cleared on mutation.
- Alternatively, wrap the most-used filters in simple getter functions that cache their result until the next `save()`.

---

### 12. Unthrottled `localStorage.setItem` on every action

**What:** `save()` calls `localStorage.setItem('taskos', JSON.stringify(S))` synchronously after every single user interaction — including rapid actions like toggling multiple habits or dragging a card.

**Where:** `index.html` — `save()` function, called at ~80 call sites.

**Why it matters:** `JSON.stringify` on the full S object (potentially hundreds of KB) + a synchronous storage write blocks the main thread. On mobile or slow devices this causes frame drops and input lag.

**Effort:** S

**Suggested fix:**
- Wrap `save()` in a `debounce(save, 300)` so rapid successive actions batch into one write.
- Keep a `forceSave()` (no debounce) for critical moments: app close / visibility change / explicit user action.

---

### 13. Service worker cache is never pruned

**What:** Each deploy creates a new versioned cache (`task-os-20260419-190847`). The old caches are never deleted, so they accumulate indefinitely in the user's browser storage.

**Where:** `sw.js` — `install` and `activate` event handlers.

**Why it matters:** Users on mobile with constrained storage quotas will hit the storage limit, causing `localStorage.setItem` to throw and triggering the silent-failure bug in P0-2.

**Effort:** S

**Suggested fix:**
- In the SW `activate` handler, delete all cache keys that don't match the current `CACHE` constant — the standard pattern for SW cache cleanup.
- Add a storage quota check on startup: `navigator.storage.estimate()` and warn if `usage / quota > 0.8`.

---

### 14. Zero test coverage on critical data paths

**What:** There are no test files, no test framework, and no CI checks. The entire task/goal/habit CRUD and the localStorage serialisation round-trip are untested.

**Where:** Entire repository — no `*.test.js`, no `vitest.config`, no `jest.config`.

**Why it matters:** Every refactor risks silently breaking the load → mutate → save cycle. The bug-fix commit pattern in git history (`fix: bugs + add automation`) suggests regressions are already happening.

**Effort:** M

**Suggested fix:**
- Add Vitest (zero-config, no bundler needed for vanilla JS).
- Start with 5 unit tests covering the highest-risk paths: `load()` round-trip, `addTask()`, `deleteGoal()`, `callClaude()` error path, and the JSON parse recovery path.
- Wire a `npm test` script to a pre-push hook so broken pushes are caught locally.

---

## 💡 P3 — Nice to have

---

### 15. No data export or backup

**What:** Users have no way to export their tasks, goals, or journal entries. If localStorage is cleared, or they switch browsers/devices, all data is gone with no recovery path.

**Where:** Settings panel in `index.html` — no export button exists.

**Why it matters:** Power users who accumulate months of data will eventually want a backup or migration path. Absence of export is also a trust signal issue.

**Effort:** S

**Suggested fix:**
- Add "Export data (JSON)" and "Import data" buttons to Settings.
- Export: `URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], {type:'application/json'}))`.
- Import: File input → parse → validate schema → merge or replace with confirmation dialog.

---

### 16. Brand palette not implemented in the app UI

**What:** The brand guide specifies purple (`#6B3FA0` / `#5718CA`) and pink (`#C2185B` / `#E353B6`) with a no-pink-on-purple rule. The actual app uses GitHub-dark blue (`#58a6ff` / `#3b82f6`) with no purple or pink anywhere.

**Where:** `:root` CSS variables in `index.html` (`--accent: #58a6ff`) and `givelink.html` (`--accent: #3b82f6`).

**Why it matters:** Givelink has its own brand identity. If the app ever goes to market or appears in demos, the visual mismatch with any brand materials (landing page, pitch deck) creates confusion.

**Effort:** S

**Suggested fix:**
- Replace `--accent` in `givelink.html` with `#5718CA` (primary purple).
- Introduce `--accent-secondary: #E353B6` (pink) for secondary CTAs only — never on a purple background.
- Audit all button / badge / highlight usages and apply the palette consistently.

---

### 17. No keyboard navigation for modal dialogs

**What:** Modals don't trap focus — keyboard users can tab past the modal into the (visually hidden) background content. There's also no `Escape` handler on most modals.

**Where:** `closeM()` in `index.html`, all `open*Modal()` functions across both files.

**Why it matters:** Accessibility (WCAG 2.1 AA requires focus management in dialogs). Also affects power users who prefer keyboard-first workflows.

**Effort:** M

**Suggested fix:**
- On modal open: store `document.activeElement`, then call `modal.querySelector('[autofocus]').focus()`.
- Add a focus-trap loop: intercept `Tab` / `Shift+Tab` inside the modal container.
- Add `document.addEventListener('keydown', e => e.key==='Escape' && closeM())`.
- Set `aria-modal="true"` and `role="dialog"` on modal containers.

---

### 18. Virtual scrolling absent on long lists

**What:** The "All Tasks" view, backlog, and CRM pipeline render every item into the DOM at once. A user with 300+ tasks generates thousands of DOM nodes on every re-render.

**Where:** `index.html` — `renderAll()`, `renderBuckets()`; `givelink.html` — backlog and CRM views.

**Why it matters:** On mid-range mobile devices with large datasets, these views visibly jank. This is a future concern, not a current P0, but worth noting before the lists grow further.

**Effort:** L

**Suggested fix:**
- Introduce a simple windowed list: render only items in the visible viewport ± one screen of buffer.
- A lightweight implementation (~60 lines of vanilla JS) can handle this without a library.
- Alternatively, add pagination (50 items per page) as a quick interim fix.
