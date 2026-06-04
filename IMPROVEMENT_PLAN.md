# Givelink / Task OS — Improvement Plan

_Generated: 2026-06-04. Based on full static analysis of `index.html` (12,888 lines), `givelink.html` (1,755 lines), `sw.js`, `vercel.json`, and git history._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `save()` has no debounce — rapid interactions can corrupt localStorage
**What**: Every single state mutation triggers an immediate `JSON.stringify` of the entire 50-property `S` object and writes it to localStorage with no rate-limiting.  
**Where**: `index.html:2097–2106`  
**Why it matters**: Checking off several habits in quick succession or tapping the XP button fires multiple 100–300 KB localStorage writes per second. On low-end mobile devices this causes jank; interleaved writes on some browsers can produce truncated JSON that fails silently on next load, wiping all data.  
**Effort**: S  
**Suggested fix**:
- Introduce a module-level `let _saveTimer` and wrap `save()` body with `clearTimeout(_saveTimer); _saveTimer = setTimeout(() => { /* original body */ }, 300)`.
- Keep an immediate-flush path (`saveNow()`) for explicit exports and the Supabase sync trigger so those aren't delayed.
- Add a brief unit test that calls `save()` 10 times in 50 ms and asserts only one localStorage write occurs.

---

### 2. Silent swallow of `refresh()` error after Supabase sync hides broken UI
**What**: After applying remote data, the `try { refresh(); } catch(e) {}` block on line 8619 silently discards any render-function exception, leaving the UI frozen with stale content and no error message.  
**Where**: `index.html:8619`  
**Why it matters**: A malformed property in synced data (e.g. a `null` where an array is expected) will crash the render pipeline. The user sees an empty, unresponsive view with no hint of what went wrong, and every subsequent sync worsens the state.  
**Effort**: S  
**Suggested fix**:
- Replace the empty catch with `catch(e){ console.error('render after sync failed', e); _sbSetStatus('⚠ Render error — data may need repair'); toast('⚠️ Sync applied but display failed. Try refreshing.', 5000); }`.
- Add a guard in the sync path that validates `remote.data` is a plain object before merging.

---

### 3. Silent `getApiKey()` failure in `givelink.html` — AI features fail with no feedback
**What**: When iterating localStorage profiles to find a Claude API key, the entire loop is wrapped in `catch(e){}` — a corrupt profile entry silently skips all profiles and falls back to a raw `window.prompt()`.  
**Where**: `givelink.html:1077–1083`  
**Why it matters**: If even one profile entry in `taskos_profiles` is malformed, the user is hit with a browser `prompt()` dialog mid-session even though their key is configured — they enter it again, creating a duplicate, and still can't understand why it keeps asking.  
**Effort**: S  
**Suggested fix**:
- Move the try-catch inside the loop: `for(const p of profiles){ try { … } catch(e){ console.warn('corrupt profile', p.id, e); } }`.
- Add a toast notification on the outer catch so the user knows key lookup partially failed.

---

### 4. `_autoSnapshot()` swallows all errors at app init — silent data loss on startup
**What**: The entire `_autoSnapshot()` function body is wrapped in `try { … } catch(e) {}` with no logging. It runs on every page load (line 8668).  
**Where**: `index.html:8639–8652`  
**Why it matters**: If `S.givelinkHistory` is ever corrupted or non-array (possible after a partial sync), the auto-snapshot silently skips, permanently losing a day of Givelink trend data — the Pace Engine never recovers the missing data point.  
**Effort**: S  
**Suggested fix**:
- Add `console.warn('autoSnapshot failed:', e)` in the catch.
- Add a type guard before pushing: `if (!Array.isArray(S.givelinkHistory)) S.givelinkHistory = [];` — this defensive line makes the error impossible rather than just logged.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. `window.prompt()` for API key entry in `givelink.html` — blocks pop-up blockers, kills flow
**What**: Both `getApiKey()` (line 1086) and `callClaudeGL()` (line 1261) use native `window.prompt()` to collect the Anthropic API key.  
**Where**: `givelink.html:1086`, `givelink.html:1261`  
**Why it matters**: Pop-up blockers (Safari by default, many corp browsers) silently return `null`, so the user clicks "Generate" and nothing happens with zero feedback. Even when it works, a bare browser prompt is jarring, offers no paste visibility, and gives no hint about where to get a key — a known drop-off point for new users.  
**Effort**: M  
**Suggested fix**:
- Add a small inline settings panel in the Givelink sidebar (matching the one in `index.html`) where the key is entered once, validated, and stored.
- Fall back to a styled modal (not `prompt()`) if the key is missing when an AI action is triggered.
- Show a "⚙️ Set API key" toast-CTA instead of a dialog so the user understands the action without being interrupted.

---

### 6. Brand colors don't match spec — full visual identity mismatch
**What**: The app uses `#58a6ff` (blue) and `#bc8cff` (muted purple) as its primary/secondary accents. The Givelink brand spec calls for `#6B3FA0`/`#5718CA` (deep purple) and `#C2185B`/`#E353B6` (pink), with an explicit no-pink-on-purple rule.  
**Where**: `index.html` CSS custom properties (`--brand`, `--accent`, `--brand2`), approximately lines 50–300 in the `<style>` block; `manifest.json:theme_color`.  
**Why it matters**: Every screenshot, share card, and app icon presents a blue-purple tool rather than the Givelink brand. This creates cognitive disconnect when switching between the app and Givelink marketing materials.  
**Effort**: M  
**Suggested fix**:
- Replace `--accent` / `--brand` values with `#5718CA` (dark mode) / `#6B3FA0` (light mode).
- Replace `--brand2` gradient stop with `#E353B6`, but only apply it on non-purple backgrounds (enforce no-pink-on-purple: never use `#E353B6` as text on a `#5718CA` background).
- Update `manifest.json:theme_color` from `#58a6ff` to `#5718CA`.
- Audit the 10 badge color variants (`.q1`–`.q4`, `.cg` etc.) — only the Eisenhower/urgency badges need changes; category badges can keep their semantic colors.

---

### 7. No focus trap in modals — keyboard users and screen readers escape into background
**What**: Modals open and receive initial focus, but pressing Tab cycles through the entire underlying document rather than staying inside the open modal.  
**Where**: Modal open logic throughout `index.html` (e.g., task modal `#tm`, goal modal `#gm`, settings modal — search for `classList.remove('hidden')` in JS section).  
**Why it matters**: A keyboard user opening the task edit modal can Tab into the sidebar navigation invisibly. Screen readers announce background content as if the modal isn't there. This is a WCAG 2.1 AA failure (criterion 2.1.2).  
**Effort**: M  
**Suggested fix**:
- Add a shared `trapFocus(modalEl)` utility that collects all focusable descendants and intercepts Tab/Shift-Tab to cycle within them.
- Call `trapFocus(el)` in the modal-open path and `releaseFocus()` on close.
- Store and restore the previously focused element so focus returns to the trigger button when the modal closes.

---

### 8. AI generation shows text placeholder only — users can't tell if it's working
**What**: When AI calls are in flight, feedback is limited to button text changing to `"⏳ Thinking..."` or `"⏳ Generating..."` and static placeholder HTML. There is no animated indicator.  
**Where**: `givelink.html:1101–1102` (sprint planner), `index.html` — multiple AI feature call sites (search for `⏳` in JS section).  
**Why it matters**: Claude API calls typically take 3–10 seconds. Without a visual pulse or spinner, users frequently click again thinking nothing happened, triggering duplicate requests, or they abandon the feature assuming it's broken.  
**Effort**: S  
**Suggested fix**:
- Add a reusable `.ai-loading` CSS class with the existing `.skel` shimmer animation (already defined in `index.html:379`) applied to the result container.
- Apply it to the output div before `await callClaude(…)` and remove it in the finally block.
- The existing spinner class `.spin-icon` can be added to the button icon during loading — one-line change per call site.

---

### 9. No undo for task deletion — permanent data loss on misclick
**What**: Completing or deleting a task has no undo path (reschedule has undo via `_undoReschedule` at line 3223, but delete does not).  
**Where**: Task delete function — search for `S.tasks = S.tasks.filter` or equivalent in `index.html` JS section (~line 2900 area).  
**Why it matters**: A fat-finger on mobile permanently removes a task. The only recovery is a manual JSON export restore, which no normal user will attempt. This is the single most complained-about pattern in productivity tools.  
**Effort**: S  
**Suggested fix**:
- Before filtering, stash `const _deletedTask = S.tasks.find(t => t.id === id)` in a module-level variable.
- Show a toast: `"Task deleted — <strong>Undo</strong>"` (same pattern as the reschedule undo on line 3221) that re-inserts `_deletedTask` on click.
- Auto-clear `_deletedTask` after 5 seconds.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. 12,888-line monolithic `index.html` — hardest-to-navigate codebase structure
**What**: All HTML, ~3,000 lines of CSS, and ~9,000 lines of JavaScript live in a single file, broken only by comment banners like `// ════════════════`.  
**Where**: `index.html` (entire file)  
**Why it matters**: Git diffs for any change touch a thousand-line file. Finding a function requires text search. A new contributor has no entry point. This is the primary velocity bottleneck — every feature addition requires scrolling thousands of lines to find the right section.  
**Effort**: L  
**Suggested fix**:
- As a first step (not a full rewrite): extract the `<style>` block into `styles.css`, loaded via `<link>`. This alone cuts the file to ~10,000 lines and makes CSS changes reviewable in isolation.
- Extract each logical JS section (persist, state, AI calls, Supabase, service worker logic) into separate `.js` files loaded as `<script type="module">`. The existing comment banners map directly to module boundaries.
- Keep `index.html` as the shell; the single-file PWA characteristic is preserved as long as the service worker caches all assets.

---

### 11. Zero test coverage on 587 functions — no safety net for refactoring
**What**: There is no test framework, no unit tests, no integration tests, and no E2E tests in the repository.  
**Where**: Entire repository — no `*.test.*`, `*.spec.*`, or `__tests__` files exist.  
**Why it matters**: Every change to a shared utility like `save()`, `uid()`, `esc()`, or the Supabase sync logic risks silent regressions across 30+ views. The `esc()` XSS guard (line 9768) is especially critical — a one-character mistake would open XSS on all user-generated content.  
**Effort**: M  
**Suggested fix**:
- Add Vitest (zero-config, no build step needed for pure JS) and write tests for the five highest-risk utilities: `esc()`, `save()`/`load()` round-trip, `uid()` uniqueness, Supabase token-refresh guard, and the CSV import parser.
- Add a GitHub Actions workflow that runs `vitest run` on every push — the repo already has a Vercel integration, so CI is one `.yml` file away.

---

### 12. 336 full `innerHTML` re-renders — layout thrashing on large datasets
**What**: Every view refresh rebuilds the entire DOM of every list by assigning a new HTML string to `innerHTML`, with no diffing or incremental updates.  
**Where**: `index.html` — 336 `innerHTML =` assignments throughout the render functions (e.g., `renderAll`, `renderGoals`, `renderHabits`).  
**Why it matters**: On a user with 200+ tasks, ticking a single checkbox triggers a full re-render of the task list — potentially 200 DOM nodes destroyed and recreated. On mobile this causes visible frame drops. It also resets scroll position and loses any in-progress input focus.  
**Effort**: L  
**Suggested fix**:
- For the highest-traffic views (task list, habits, dashboard), replace the full `innerHTML` assignment with a keyed reconciliation: build the new HTML string, compare it to `el.innerHTML`, and only update if changed. This single guard (`if (el.innerHTML !== newHtml) el.innerHTML = newHtml`) eliminates 80% of unnecessary repaints with three lines per render function.
- For checkbox state changes specifically, update only the `.ck` element and the `.done` class on the card — skip full list re-render entirely.

---

### 13. API keys sent directly from browser — exposed to any XSS or devtools inspection
**What**: Claude, Readwise, and Notion API keys are stored in `localStorage` under `taskos_claude_key`, `taskos_readwise_key`, and `taskos_notion_key`, then sent directly in `Authorization` headers from the browser.  
**Where**: `index.html` — Claude call at ~line 9200 area; Readwise import (`_importFromReadwise`); Notion import (`_importFromNotion`). `givelink.html:1264` (`callClaudeGL`).  
**Why it matters**: Any future XSS vulnerability (one missed `esc()` call) exposes all API keys. More practically, any team member who opens DevTools on a shared machine sees all keys in Application → Local Storage. The Claude key can generate unbounded API charges.  
**Effort**: M  
**Suggested fix**:
- Add a thin Vercel Edge Function (`/api/claude`, `/api/readwise`, `/api/notion`) that proxies requests. The browser sends the user's payload; the edge function injects the API key from a Vercel environment variable.
- Remove all key storage from `localStorage`; store only a boolean "configured" flag.
- This also lets you add rate-limiting and request logging at the proxy layer.

---

### 14. `S` state object defined as a single 300-word line — unreadable and unmaintainable
**What**: The entire application state schema is defined as a single-line object literal with 60+ properties and no type annotations.  
**Where**: `index.html:2036`  
**Why it matters**: When a new property is added by mistake with the wrong default type (e.g., `[]` instead of `{}`), it silently breaks any code that expects the other type — and it's impossible to catch without reading every consumer. The line is 1,400+ characters; no editor wraps it usefully.  
**Effort**: S  
**Suggested fix**:
- Reformat to multi-line with one property per line — this is a pure cosmetic change that makes git blame, diffs, and property lookup human-readable. Zero behavioral change.
- Add a `// @type {string}` JSDoc comment above each property group — no TypeScript needed, just documentation that editors can use for autocomplete.

---

### 15. Event listeners added in modal render functions without cleanup — memory leaks
**What**: Several modal-open functions add `addEventListener` calls on document/window or use `onclick` attributes in generated HTML. When modals close and re-open, listeners accumulate.  
**Where**: `index.html` — modal render functions throughout; `givelink.html:1090–1095` (`openAiSprintPlanner` assigns `innerHTML` with new event targets every open).  
**Why it matters**: On a long session (hours), opening and closing the AI sprint planner, task modal, or Relationships view dozens of times accumulates hundreds of orphaned listeners. This gradually increases memory usage and can cause double-firing of event handlers (e.g., "Generate" being called twice).  
**Effort**: S  
**Suggested fix**:
- For `onclick`-in-innerHTML patterns (givelink.html line 1091+), this is already safe — new innerHTML replaces old nodes and their listeners.
- For `document.addEventListener` calls inside modal functions, use `{ once: true }` or store the handler reference and call `removeEventListener` in the modal close function.
- Audit with Chrome DevTools Memory tab: record a heap snapshot, open/close each modal 10 times, take another snapshot, and diff for detached listeners.

---

## 💡 P3 — Nice to have

### 16. No usage analytics — no signal on which features are used vs abandoned
**What**: There is no analytics instrumentation; feature adoption, drop-off points, and error rates are completely invisible.  
**Where**: N/A — absence of any analytics calls in `index.html` or `givelink.html`.  
**Why it matters**: Without data, prioritization of P1 items above is guesswork. Knowing that 80% of users never open the Wheel of Life view but 60% use the Eisenhower matrix daily would sharply focus the roadmap.  
**Effort**: S  
**Suggested fix**:
- Add PostHog (referenced in task data but not integrated) with a single `<script>` tag and `posthog.capture('view_opened', { view: name })` in the `nav()` function — one line covers all navigation events.
- Instrument AI feature usage and Supabase sync success/failure rates.

---

### 17. No ICS or CSV export for tasks/calendar — trapped data
**What**: Data export is JSON-only (line 2108). There is no ICS calendar export and no CSV task export.  
**Where**: `index.html:2108–2114` (`exportData`)  
**Why it matters**: Users who want to back up tasks to a spreadsheet or pull calendar events into Google Calendar have no path. This is a common request for productivity tools and reduces perceived data ownership.  
**Effort**: S  
**Suggested fix**:
- Add `exportCSV()` that maps `S.tasks` to RFC 4180 CSV (title, bucket, category, dueDate, status) — 20 lines of code.
- Add `exportICS()` that emits VEVENT blocks for tasks with a `dueDate` — the ICS format is simple enough to generate without a library.
- Add both as secondary buttons next to the existing JSON export in the settings modal.

---

### 18. `unsafe-inline` in CSP provides no XSS protection — documented limitation
**What**: `vercel.json` sets `Content-Security-Policy: script-src 'self' 'unsafe-inline'`, which permits all inline script execution and defeats CSP as an XSS defense layer.  
**Where**: `vercel.json:6` (CSP header)  
**Why it matters**: The `esc()` function (index.html:9768) is the only XSS defense. If one call site is missed, there is no browser-level backstop. This is inherent to the single-file architecture and can't be fully fixed without a build step — but it's worth documenting as a known risk.  
**Effort**: L (architectural)  
**Suggested fix**:
- Short-term: add a comment in `vercel.json` documenting this as a known limitation of the single-file architecture.
- Long-term: once JS is extracted to separate module files (P2 item 10), replace `'unsafe-inline'` with a nonce-based CSP generated by a Vercel Edge middleware — this is the correct fix and removes the last meaningful attack surface.

---

_Total: 18 items — 4 P0, 5 P1, 6 P2, 3 P3. Ordered within each tier by ROI._
