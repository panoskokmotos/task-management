# Givelink Improvement Plan

> Scanned: `givelink.html` (1 756 lines), `index.html` (>256 KB), `sw.js`, `vercel.json`, `manifest-givelink.json`  
> Date: 2026-07-02

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Nonprofit CRM modal loses Delete / Advance Stage buttons permanently
**What**: `_showNPModal` creates the modal DOM once and never re-renders it; buttons rendered using the value of `editNpId` at first-open time are frozen for the lifetime of the page.  
**Where**: `givelink.html:1358–1389`  
**Why it matters**: If the user opens "Add Org" first, every subsequent "Edit" session has no Delete or Advance Stage button — blocking the entire CRM workflow without a page reload.  
**Effort**: S  
**Suggested fix**:
- In `_showNPModal`, always overwrite `m.innerHTML` (not just on first creation) so button visibility reflects the current `editNpId`.
- Or extract the footer into a separate `<div id="np-modal-footer">` and update only that on each open.
- Add `editNpId=null` to `closeM` so stale selection can't bleed across calls.

---

### 2. `load()` crashes on corrupted localStorage — no recovery path
**What**: `JSON.parse(localStorage.getItem('givelink_sprint'))` throws an uncaught exception if the stored value is malformed; the app renders a blank page and the user's data appears lost.  
**Where**: `givelink.html:448`  
**Why it matters**: Any interrupted save (browser crash, quota error, manual DevTools edit) permanently locks the user out of their sprint data.  
**Effort**: S  
**Suggested fix**:
- Wrap the parse in `try/catch`; on failure, `toast()` a warning and continue with the default empty state.
- Optionally copy the raw corrupted string to `givelink_sprint_backup` before clearing, so data can be recovered.

```js
function load(){
  const d = localStorage.getItem('givelink_sprint');
  if (!d) return;
  try { const p = JSON.parse(d); S = {...S, ...p}; }
  catch(e) { localStorage.setItem('givelink_sprint_backup', d); toast('⚠️ Sprint data corrupted — starting fresh. Backup saved.', 6000); }
}
```

---

### 3. CSP in `vercel.json` silently blocks Google Fonts on production
**What**: `font-src 'self'` and no `https://fonts.googleapis.com` in `style-src` means the Inter font stylesheet and font files are blocked by the browser's Content Security Policy on every production request.  
**Where**: `vercel.json:14`, `index.html:12–14`  
**Why it matters**: Task OS falls back to system-default fonts in production while looking correct locally (no CSP in dev). Inter is a core visual brand element; the degraded font makes the app look broken.  
**Effort**: S  
**Suggested fix**:
- Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` in the CSP header.
- Or self-host Inter (download WOFF2 files) and eliminate the external dependency entirely — recommended for performance and CSP simplicity.

---

### 4. `callClaudeGL()` swallows API errors — Standup and Outreach fail silently
**What**: The shared Claude helper at line 1264 calls `res.json()` without checking `res.ok`. A 401 (bad key), 429 (rate limit), or 529 (overloaded) returns `null` with no user feedback. Compare with `runAiSprintPlanner` (line 1145) which correctly throws on `!res.ok`.  
**Where**: `givelink.html:1264–1271`  
**Why it matters**: Users click "Generate Standup" or "Draft Email", see "⏳ Generating..." and then either blank content or "Could not generate. Check your API key." — with no indication whether the key is wrong, the model is busy, or they're rate-limited.  
**Effort**: S  
**Suggested fix**:
```js
const res = await fetch('https://api.anthropic.com/v1/messages', {...});
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error?.message || `HTTP ${res.status}`);
}
const data = await res.json();
```
Surface the error message in the modal body rather than the generic fallback string.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Task badge renders raw lowercase priority string instead of display label
**What**: `taskHTML` at line 666 uses `${t.priority||'medium'}` directly; `goalHTML` at line 635 correctly uses `${STATUS[t.status]?.l}`. Priority badges show `high`, `medium`, `low` in lowercase instead of `High`, `Medium`, `Low`.  
**Where**: `givelink.html:666`  
**Why it matters**: Inconsistency between task cards and goal cards looks unpolished; "high" in lowercase clashes with the styled badge surrounding it.  
**Effort**: XS  
**Suggested fix**: Replace `${t.priority||'medium'}` with `${PRI[t.priority]?.l||'Medium'}`.

---

### 6. Backlog filter tab highlight doesn't restore on return navigation
**What**: `setBLFilter` manually removes/adds `.active` class on tab click but `renderBacklog()` (called on `nav('backlog')`) never re-applies the active class based on `S.blFilter`. So navigating away and back resets the visual filter to "All" while the data stays filtered.  
**Where**: `givelink.html:593–619`  
**Why it matters**: Users set a filter ("Growth"), switch to another view, return — and think the filter was lost. They re-click it, which re-renders the already-filtered list. Confusing and suggests data loss.  
**Effort**: S  
**Suggested fix**: At the top of `renderBacklog()`, add:
```js
document.querySelectorAll('#bl-filters .ftab').forEach(x => x.classList.remove('active'));
const activeTab = document.querySelector(`#bl-filters .ftab[onclick*="${S.blFilter}"]`)
  || document.querySelector('#bl-filters .ftab');
if (activeTab) activeTab.classList.add('active');
```

---

### 7. CRM "Draft" button is 9px/2px — impossible to tap on mobile
**What**: The outreach draft button in each CRM kanban card uses `font-size:9px; padding:2px 6px` — far below the 44×44px minimum touch target recommended by WCAG 2.5.5 and Apple HIG.  
**Where**: `givelink.html:1332`  
**Why it matters**: The CRM is a key sales workflow. On mobile (where most async follow-up happens), the most important action button is untappable without precise stylus input.  
**Effort**: S  
**Suggested fix**: Replace the inline style with `class="btn bg sm"` (existing 11px/3px 8px button class) and ensure a minimum `min-height: 32px`. Or add `min-height:32px; padding:4px 10px; font-size:11px;`.

---

### 8. Escape key doesn't close modal when a form field has focus
**What**: The global keydown listener at line 877 returns early if `e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'`, so pressing Escape while typing in the task title field does nothing — violating standard browser/OS UX expectations.  
**Where**: `givelink.html:877`  
**Why it matters**: Every modern modal and form (Gmail, Notion, Linear) closes on Escape regardless of input focus. Users who type a task title and hit Escape to cancel are instead stuck with an open modal.  
**Effort**: S  
**Suggested fix**: Check for Escape before the input guard, so Escape always closes modals:
```js
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.mo:not(.hidden)').forEach(m => m.classList.add('hidden'));
    editId = null;
    return;
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'n') openAdd();
});
```

---

### 9. Push notification icon path `./icons/icon-192.png` doesn't exist
**What**: The service worker's push event handler at sw.js:38-39 references `./icons/icon-192.png` for both `icon` and `badge`. This directory and file don't exist in the repository.  
**Where**: `sw.js:38–39`, manifest only has `icon-gl.svg`  
**Why it matters**: Push notifications from reminders will show with a broken/missing icon — or fail entirely on Android where icon is required. Degrades the PWA install experience.  
**Effort**: S  
**Suggested fix**: Either generate a 192×192 PNG from `icon-gl.svg` and commit it to `icons/icon-192.png`, or point to the existing SVG: `icon: './icon-gl.svg'`. Also update the manifest `icons` array accordingly.

---

### 10. Sprint form allows saving with empty Start/End dates
**What**: `saveSprint()` and `confirmNewSprint()` only validate `if(start && end && new Date(end) <= new Date(start))` — skipping validation entirely when either field is blank. A sprint with no dates produces `NaN` in `daysLeft()`, `sprintPct()`, and the burndown chart.  
**Where**: `givelink.html:787–793`, `givelink.html:825`  
**Why it matters**: Saving a sprint with blank dates corrupts the sprint bar ("NaN days left") and burndown chart until the user goes back to Sprint Settings to fix it.  
**Effort**: S  
**Suggested fix**: Add explicit blank checks before the date-order validation:
```js
if (!start || !end) { toast('Enter both start and end dates.'); return; }
```

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Two separate Claude API call patterns with divergent error handling
**What**: `runAiSprintPlanner` (line 1131) makes a direct `fetch` with proper `res.ok` guards and JSON fallback extraction; `callClaudeGL` (line 1264) is the shared utility without those guards. Future features will reach for `callClaudeGL` and silently inherit broken error handling.  
**Where**: `givelink.html:1097–1160` vs `1256–1272`  
**Why it matters**: Every new AI feature either duplicates the sprint-planner fetch boilerplate or uses `callClaudeGL` and silently swallows errors. Doubles the surface for API-related bugs.  
**Effort**: M  
**Suggested fix**: Consolidate into a single `callClaudeGL(prompt, opts)` that handles `res.ok` checks, rate-limit retries, and surfaces typed errors. Migrate `runAiSprintPlanner` to use it.

---

### 12. Burndown snapshot only records on task toggle — misses task additions
**What**: `_recordSnapshot()` is only called from `toggleDone()` (line 737). If tasks are added or moved to the current sprint after the first toggle, the `total` count in earlier snapshots is stale. The burndown chart then shows incorrect ideal-vs-actual lines.  
**Where**: `givelink.html:743–752`, called from `givelink.html:737`  
**Why it matters**: Sprint planning typically adds tasks over the first few days. The burndown will always look artificially ahead of pace until the first task completion.  
**Effort**: S  
**Suggested fix**: Also call `_recordSnapshot()` from `saveTask()` and `moveSprint()`. Optionally update only the `total` field without changing `done` when no completion occurred.

---

### 13. Anthropic API key stored in plain localStorage, prompted via `window.prompt()`
**What**: `getApiKey()` at line 1075 retrieves the key from `localStorage.getItem('taskos_api_key')`. `callClaudeGL` at line 1261 falls back to `window.prompt()`. Both methods expose the key in browser DevTools Storage tab and browser history.  
**Where**: `givelink.html:1075–1088`, `givelink.html:1257–1261`  
**Why it matters**: Any browser extension, injected script, or person with DevTools access can read the API key. `sk-ant-` keys have billing implications; compromise means unexpected charges.  
**Effort**: M  
**Suggested fix**:
- Use `sessionStorage` instead of `localStorage` so the key doesn't persist across sessions.
- Or implement a lightweight settings modal with a password-type `<input>` instead of `window.prompt()`.
- Long-term: proxy API calls through a backend or Vercel Edge Function that holds the key server-side.

---

### 14. Task OS sync uses fragile case-insensitive title matching
**What**: `syncToTaskOS()` at line 1224 matches tasks between apps using `tt.title.toLowerCase() === gt.title.toLowerCase()`. Any title edit in either app silently breaks the link and duplicates the task.  
**Where**: `givelink.html:1224–1229`  
**Why it matters**: Sync reliability degrades over time as tasks get refined. Users discover duplicates in Task OS inbox and lose confidence in the sync feature.  
**Effort**: M  
**Suggested fix**: Add a `tosId` field to Givelink tasks when they're first synced to Task OS (storing the Task OS task ID). Use ID-based matching on subsequent syncs, falling back to title matching only for tasks without a `tosId`.

---

### 15. `closeM()` clears `editId` but not `editNpId` — stale CRM selection
**What**: `closeM(id)` at line 874 sets `editId = null` (for task edits) but never clears `editNpId`. If a CRM modal is closed via backdrop or Escape, `editNpId` retains the last-edited org's ID, causing `saveNP()`, `deleteNP()`, and `logActivityNP()` to operate on the wrong record.  
**Where**: `givelink.html:874`  
**Why it matters**: Low-probability but high-impact: a user could accidentally delete or overwrite the wrong nonprofit record.  
**Effort**: XS  
**Suggested fix**: `function closeM(id){document.getElementById(id).classList.add('hidden'); editId=null; editNpId=null;}`

---

## 💡 P3 — Nice to have

### 16. Brand palette not applied — app uses blue, documented brand is purple/pink
**What**: Both apps use `--accent:#3b82f6` (givelink) / `#58a6ff` (Task OS) and a blue-based palette. The documented brand palette is purple `#6B3FA0`/`#5718CA` and pink `#C2185B`/`#E353B6`. Neither brand color appears anywhere in either file.  
**Where**: `givelink.html:15–20`, `index.html:19–26`  
**Why it matters**: Disconnect between brand identity docs and product creates inconsistency in marketing vs. product screenshots. The blue scheme is aesthetically coherent but diverges from the stated brand direction.  
**Effort**: L  
**Suggested fix**: Update `--accent` and `--brand-gradient` in both apps to match the brand palette. Start with `givelink.html` since it's smaller. The no-pink-on-purple rule should be codified as a CSS comment near the `--pr` (Product pillar, currently `#f472b6`) variable.

---

### 17. No list virtualization — 100+ sprint tasks block the main thread
**What**: `renderOverview()`, `renderPillar()`, and `renderBacklog()` call `.join('')` on full task arrays and `innerHTML` the result synchronously. The seed data alone generates 100+ current-sprint tasks.  
**Where**: `givelink.html:523–547`, `givelink.html:556–577`, `givelink.html:593–619`  
**Why it matters**: On mid-range phones, rendering 100+ cards takes 40–80ms, causing visible jank on every navigation. Grows worse as sprints accumulate tasks.  
**Effort**: M  
**Suggested fix**: Limit initial render to first 50 tasks with a "Show more" button, or use `requestAnimationFrame` batching. Full virtualization (IntersectionObserver sentinel) is overkill for this scale.

---

### 18. Service worker cache key `task-os-20260530` is hardcoded — stale cache risk
**What**: `sw.js:1` sets `const CACHE = 'task-os-20260530'`. When HTML files are updated and deployed, users with the old SW continue serving the June 30 cache until the browser's SW update cycle runs.  
**Where**: `sw.js:1`  
**Why it matters**: Bug fixes and UI updates don't reach installed PWA users for up to 24 hours (SW update interval). The June 8 commit's 4-bug fix was only delivered once the cache key was stale enough.  
**Effort**: S  
**Suggested fix**: Automate the cache key using a build step (`CACHE = 'task-os-' + BUILD_HASH`) or include it as a comment-driven variable that's bumped with each deployment. At minimum, document "bump CACHE version in sw.js on every release."

---

### 19. Emoji-only buttons lack accessible labels
**What**: The hamburger button at line 218 has `aria-label="Menu"` (good) but the modal close buttons (`×` character) at lines 317, 373, 395 have no `aria-label`. The CRM "✉️ Draft" button (line 1332) and FAB `+` (line 303) also have no screen reader text.  
**Where**: `givelink.html:218`, `317`, `373`, `395`, `303`, `1332`  
**Why it matters**: Screen reader users hear "button" with no context for close, add, and draft actions. Fails WCAG 2.1 SC 1.1.1 (Non-text Content).  
**Effort**: S  
**Suggested fix**: Add `aria-label="Close"` to all `<button class="mc">` elements and `aria-label="Add task"` to the FAB. The `×` can stay as visible text with `aria-hidden="true"` alongside a `<span class="sr-only">Close</span>`.

---

### 20. PWA manifest locks portrait — breaks landscape on iPad
**What**: `manifest-givelink.json:9` sets `"orientation": "portrait-primary"`. The sprint board's multi-column kanban layout (CRM: 6 columns, pillar overview: 5 cards) is significantly better in landscape, especially on iPad where the app is likely used for planning sessions.  
**Where**: `manifest-givelink.json:9`  
**Why it matters**: Locking portrait forces iPads to show the mobile single-column layout in what should be a desktop-like mode. The CRM kanban loses 5 of 6 visible columns.  
**Effort**: XS  
**Suggested fix**: Change to `"orientation": "any"` or remove the `orientation` key entirely (defaults to `any`).
