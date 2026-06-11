# Givelink / Task OS — Prioritized Improvement Plan

**Audit date:** 2026-06-11  
**Scope:** `index.html` (12 893 lines), `givelink.html` (1 755 lines), `sw.js` (109 lines), `supabase-setup.sql` (52 lines)  
**Dimensions:** Bugs & Broken Flows · UI/UX Friction · Code Health · Brand Consistency

---

## P0 — Fix Immediately (breaks core functionality)

---

### P0-1 · `givelink.html` `load()` has no error handling — corrupt data = blank app

**What:** `load()` calls `JSON.parse(localStorage.getItem('givelink_sprint'))` with no `try/catch`. Any corrupt or truncated value in `localStorage` throws an uncaught `SyntaxError`, leaving the Sprint Board completely blank with no recovery path.

**Where:** `givelink.html` lines 447–450

**Why it matters:** One bad write (storage quota mid-save, browser crash, manual edit) permanently bricks the Givelink board for the user with no error message and no way back except DevTools.

**Effort:** S

**Suggested fix:**
```js
function load() {
  try {
    const raw = localStorage.getItem('givelink_sprint');
    if (raw) Object.assign(S, JSON.parse(raw));
  } catch (e) {
    console.warn('givelink: corrupt localStorage, using defaults', e);
    // optionally toast a warning so the user knows data was reset
  }
}
```

---

### P0-2 · `window.prompt()` for API key is broken in iOS PWA standalone mode

**What:** `getApiKey()` in `givelink.html` falls back to `window.prompt()` when no key is stored; `callClaudeGL()` also calls `window.prompt()` directly. In iOS PWA standalone mode `window.prompt()` is silently swallowed — it returns `null` immediately, so the key is never collected and every AI call fails with no user-visible error.

**Where:** `givelink.html` lines 1075–1088, 1256–1258

**Why it matters:** AI Sprint Planner is a headline feature. It silently does nothing on the platform where PWA installs matter most.

**Effort:** S

**Suggested fix:** Replace `window.prompt()` with a small inline modal (one `<input>` + Save/Cancel buttons) that resolves a `Promise<string|null>`. A single 20-line helper reusable in both call sites:
```js
function promptModal(label) {
  return new Promise(resolve => {
    // inject a modal overlay, focus input, resolve on Save, null on Cancel
  });
}
```

---

### P0-3 · `confirm()` for sprint deletion is broken in iOS PWA standalone mode

**What:** `delCur()` uses `if (!confirm('Delete this sprint...'))` to gate deletion. Same iOS PWA restriction: `confirm()` returns `false` immediately, making it **impossible to delete any sprint** on iOS without going through a browser tab.

**Where:** `givelink.html` line 732

**Why it matters:** Irreversible data loss path is inaccessible on iOS; users who accidentally enter a sprint name can never clean it up.

**Effort:** S

**Suggested fix:** Same `promptModal` / inline confirm-dialog pattern as P0-2. A two-button modal (Confirm / Cancel) takes 10 lines of HTML+JS.

---

### P0-4 · Supabase connect failure leaves the Settings UI in an ambiguous broken state

**What:** `sbConnect()` shows a spinner, then on any error calls `toast(err.message)`. It does not reset the "Connect & Sync" button state, clear the spinner, or re-enable inputs. If the network call times out the button stays disabled indefinitely; the user has no way to retry without closing and reopening Settings.

**Where:** `index.html` lines 8567–8612

**Why it matters:** Cloud sync is a key differentiator. A failed first-time setup with no recovery UX kills trust immediately.

**Effort:** S

**Suggested fix:** In the `catch` block, restore button text, re-enable inputs, and show a retry affordance:
```js
catch(e) {
  toast('Sync failed: ' + e.message, 'error');
  btn.disabled = false;
  btn.textContent = 'Connect & Sync';
}
```

---

## P1 — Fix Soon (significant UX or correctness issues)

---

### P1-1 · Wrong brand palette throughout both apps

**What:** Both files use Task OS blue (`--brand: #58a6ff`, `--brand2: #bc8cff`, accent `#3b82f6`) instead of the Givelink brand palette (primary purple `#6B3FA0 / #5718CA`, accent pink `#C2185B / #E353B6`). The `theme-color` meta tag in `index.html` is `#58a6ff` and in `givelink.html` is `#3b82f6`.

**Where:**  
- `index.html` line 6 (meta theme-color), lines 19–26 (`:root` CSS vars)  
- `givelink.html` line 3 (meta theme-color), lines 14–50 (CSS palette vars)

**Why it matters:** Every button, link highlight, focus ring, and PWA chrome tile shows the wrong brand. First impression for any new user is a mismatched identity.

**Effort:** S

**Suggested fix:**
```css
/* index.html :root */
--brand: #6B3FA0;
--brand2: #E353B6;
--accent: #5718CA;

/* givelink.html */
--accent: #6B3FA0;
--pr: #E353B6;   /* pink accent */
```
Update both `<meta name="theme-color">` tags to `#6B3FA0`.

---

### P1-2 · Hardcoded personal name "Panos" surfaces in title and default state

**What:** `<title>Task OS — Panos</title>` and `localStorage.getItem('taskos_name') || 'Panos'` bake a personal name into the shipped code. Any new user sees "Panos" as the default until they change Settings.

**Where:** `index.html` line 15 (title), line 2038 (JS default)

**Why it matters:** Immediately signals the app is someone's personal project rather than a product. Low trust for new users.

**Effort:** S

**Suggested fix:** Change title to `Task OS` and default name to `'Me'` or `''` (triggering a first-run name prompt).

---

### P1-3 · Dashboard header has 15+ action buttons — severe cognitive overload

**What:** `renderDash()` renders a header row with 11 always-visible buttons plus several more inside `.dash-extra` revealed by a toggle. Most users need 2–3 of these daily.

**Where:** `index.html` lines 607–631 (HTML), lines 2460–2510 (renderDash JS)

**Why it matters:** The first screen a user sees presents a wall of unlabeled icon buttons. New users cannot orient; power users waste time scanning. Nielsen's "Recognition over recall" is violated throughout.

**Effort:** M

**Suggested fix:** Surface only 4–5 primary actions (Add Task, Focus, Review, Today). Move the rest behind a `•••` overflow menu that opens a small popover. Use visible labels on ≥480 px viewports (icon + text, not icon only).

---

### P1-4 · `importData()` blindly merges any JSON without validation

**What:** `importData()` does `Object.assign(S, d)` after only checking that `d.tasks` is truthy. A malformed or attacker-crafted JSON file can inject arbitrary keys into the global state object `S`, overwrite XP/streak data, or corrupt the Supabase sync payload.

**Where:** `index.html` lines 2115–2127

**Why it matters:** Data import is irreversible (it immediately calls `save()`). A corrupted import has the same silent failure mode as `load()` catching QuotaExceededError — the user only notices something is wrong later.

**Effort:** M

**Suggested fix:** Validate expected top-level keys and types before merging; show a diff/preview modal listing what will change (task count, goal count, settings) and require explicit confirmation.

---

### P1-5 · AI output areas have no loading skeleton or error state

**What:** Every `_aiBtn()` call in the app shows a spinner on the button but renders the response directly into an `innerHTML` target with no placeholder. If the Claude API returns an error object the raw JSON error string is dumped into the UI.

**Where:** `index.html` lines 2258–2270 (`_aiBtn`), lines 4133–4190 (`callClaude`), `givelink.html` lines 1097–1161 (`runAiSprintPlanner`)

**Why it matters:** Error cases (rate limit, expired key, network drop) produce ugly raw JSON or a blank panel. Users don't know whether to wait or act.

**Effort:** M

**Suggested fix:** Add a consistent `renderAiError(container, err)` helper that shows a human-readable message + "Retry" button. Show a shimmer placeholder while loading so the layout doesn't jump.

---

## P2 — Address in the Next Iteration (code health / maintainability)

---

### P2-1 · Entire app in one 12 893-line HTML file

**What:** `index.html` contains all CSS (~518 lines), all HTML (~1 500 lines), and all JavaScript (~10 800 lines) with no module boundaries, no bundler, and no build step.

**Where:** `index.html` lines 1–12893

**Why it matters:** Any change to any area requires navigating ~10k lines of JS. Impossible to tree-shake, hard to test, risky to refactor. IDE tooling (autocomplete, type-checking) is degraded because the file is not `.js`.

**Effort:** L

**Suggested fix:** Incrementally extract: (1) move CSS to `styles.css`; (2) extract the 5–6 largest render functions into separate `<script src="...">` modules; (3) adopt ES modules with `type="module"` to enable named imports between files. No bundler needed to start.

---

### P2-2 · Magic number `86400000` (one day in ms) repeated throughout

**What:** The literal `86400000` appears more than 20 times across `index.html` for date arithmetic (streaks, deadlines, review windows). There is no named constant.

**Where:** `index.html` — representative instances at lines ~2350, ~3150, ~5100, ~6200, ~7800 (grep: `86400000`)

**Why it matters:** One wrong `86400000` is invisible in review and can create an off-by-one-day bug in streak or deadline calculations that's almost impossible to bisect.

**Effort:** S

**Suggested fix:**
```js
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;
```
Replace all literals via a single find-and-replace.

---

### P2-3 · `renderDash()` is ~160 lines; similar God-functions throughout

**What:** `renderDash()` builds 10+ sub-components — streak bar, XP ring, quick-add, habit summary, goal cards, challenge widget — all inline. Similarly, `saveTask()`, `toggleDone()`, and `openSettings()` each exceed 60–80 lines.

**Where:** `index.html` lines 2460–2620 (`renderDash`), lines 3101–3189 (`saveTask`/`toggleDone`)

**Why it matters:** A bug in the XP ring requires reading 160 lines to find it. Long functions resist unit testing and make PR reviews superficial.

**Effort:** M

**Suggested fix:** Extract sub-renderers: `renderStreakBar()`, `renderXpRing()`, `renderHabitSummary()`, `renderGoalCards()`. Each should be < 30 lines. `renderDash` becomes an orchestrator that calls them in sequence.

---

### P2-4 · `document.execCommand('copy')` deprecated fallback

**What:** The clipboard copy helper falls back to `document.execCommand('copy')` which is deprecated and removed in some browser versions. The modern `navigator.clipboard.writeText()` API has been broadly available since 2018.

**Where:** `index.html` lines ~2290–2310 (clipboard utility)

**Why it matters:** Deprecated API will eventually break silently in a future browser update; already produces console warnings in Chromium.

**Effort:** S

**Suggested fix:**
```js
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // legacy fallback only for very old browsers
    const el = document.createElement('textarea');
    el.value = text; document.body.appendChild(el);
    el.select(); document.execCommand('copy');
    document.body.removeChild(el);
  }
}
```

---

### P2-5 · Service worker cache writes are fire-and-forget with no error handling

**What:** Inside the `fetch` event handler, `caches.open(CACHE).then(c => c.put(...))` is called without `.catch()`. A storage quota error during a cache write is silently swallowed; the browser does not surface it.

**Where:** `sw.js` lines 64–70, 79–83, 100–103

**Why it matters:** On low-storage devices the SW silently fails to update the offline cache. The user installs updates thinking the app is offline-capable, then gets stale content with no indication.

**Effort:** S

**Suggested fix:** Add `.catch(err => console.warn('SW cache write failed:', err))` to every `caches.open(...).then(c => c.put(...))` chain.

---

### P2-6 · `givelink.html` `save()` has no quota-exceeded guard

**What:** `save()` calls `localStorage.setItem('givelink_sprint', JSON.stringify(S))` with no `try/catch`. On a full storage partition this throws `QuotaExceededError` and the sprint data is silently lost.

**Where:** `givelink.html` lines 447–448

**Why it matters:** `index.html` already handles this with a toast. `givelink.html` does not, creating an inconsistent and dangerous silent failure.

**Effort:** S

**Suggested fix:**
```js
function save() {
  try {
    localStorage.setItem('givelink_sprint', JSON.stringify(S));
  } catch (e) {
    if (e.name === 'QuotaExceededError') alert('Storage full — data not saved.');
    else throw e;
  }
}
```

---

## P3 — Nice to Have (polish and future-proofing)

---

### P3-1 · Inline `onclick` handlers throughout prevent any Content Security Policy

**What:** Nearly every interactive element uses `onclick="functionName()"` inline strings (e.g., `onclick="openAdd('inbox')"`). This requires `'unsafe-inline'` in any `script-src` CSP directive, making it impossible to add a meaningful CSP header.

**Where:** `index.html` lines 532, 607–631, 1311–2028 (modal buttons) — pervasive throughout

**Why it matters:** CSP is the last line of defence against XSS. Even though `esc()` is used consistently, removing inline handlers would allow a proper CSP to be deployed, eliminating the residual XSS surface.

**Effort:** L

**Suggested fix:** Replace inline handlers with `data-action` attributes and a single delegated listener at `document.body`:
```js
document.body.addEventListener('click', e => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action) ACTION_MAP[action]?.(e);
});
```

---

### P3-2 · Navigation items are `<div>` elements, not `<button>` or `<a>` — accessibility failure

**What:** All sidebar/bottom-nav items use `<div class="ni" onclick="...">` instead of `<button>`. They are not keyboard-focusable, not announced as interactive by screen readers, and have no visible focus ring.

**Where:** `index.html` lines ~700–750 (nav HTML), `givelink.html` lines ~250–280

**Why it matters:** WCAG 2.1 SC 4.1.2. Any keyboard-only or screen-reader user cannot navigate the app at all.

**Effort:** M

**Suggested fix:** Change `<div class="ni">` to `<button class="ni" type="button">`. Add `cursor: pointer; background: none; border: none;` to the `.ni` CSS rule. All existing `onclick` handlers continue to work unchanged.

---

### P3-3 · No debounce on Supabase sync — rapid edits hammer the API

**What:** `save()` calls `_sbScheduleSync()` on every keystroke / state change. `_sbScheduleSync` debounces with a short timeout but looking at the call pattern in rapid task editing (checklist toggles, drag-and-drop reorders) multiple sync calls can fire within a second.

**Where:** `index.html` lines 2096–2106 (`save`), lines 8600–8612 (`_sbScheduleSync`)

**Why it matters:** Supabase free tier has rate limits. Rapid sync hammering can exhaust the request budget during a heavy session and lock out cloud sync for the rest of the day.

**Effort:** S

**Suggested fix:** Ensure `_sbScheduleSync` uses a minimum 2-second debounce. Add an exponential back-off on 429 responses in `sbSyncNow()`.

---

### P3-4 · Hardcoded real nonprofit names and addresses in `seedNonprofits()`

**What:** `seedNonprofits()` seeds production-looking data (St. Anthony Foundation, SF Safehouse with a real San Francisco address) directly into a new user's board. These are real organizations used as placeholder data.

**Where:** `givelink.html` lines 1281–1292

**Why it matters:** Seeding real organizations as dummy data could mislead users into thinking these are partner integrations, and creates confusion if those organizations ever need to update their information or object to their name being used.

**Effort:** S

**Suggested fix:** Replace with clearly fictional placeholder names (e.g., "Community Kitchen Alpha", "City Shelter Beta") or derive seeds from a `DEMO_NONPROFITS` constant that is clearly marked as example data.

---

## Summary

| Priority | Count | Theme |
|----------|-------|-------|
| P0 | 4 | Broken on iOS PWA, data loss risks |
| P1 | 5 | Brand, trust, and core UX |
| P2 | 6 | Code health and silent failures |
| P3 | 4 | Accessibility, security posture, polish |
| **Total** | **19** | |
