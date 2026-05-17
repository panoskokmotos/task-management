# Givelink / Task OS — Improvement Plan

> Analysed: `index.html` (8 592 lines), `givelink.html` (1 755 lines), `sw.js`, `vercel.json`  
> Tech stack: vanilla JS + CSS, localStorage, Anthropic Claude API, Vercel static hosting  
> No backend, no TypeScript, no tests.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Hardcoded "Panos" in AI relationship-message prompt

**What:** The AI prompt for generating relationship outreach messages hard-codes the sender's name as "Panos" regardless of the user's profile name.  
**Where:** `index.html:7349`  
```
for Panos to send to ${p.name}, a ${p.type} ...
```
**Why it matters:** Every user whose name isn't Panos receives an AI draft that starts "Hey, it's Panos…" — an embarrassing CRM foot-gun that makes the feature unusable for anyone else.  
**Effort:** S  
**Suggested fix:**
- Replace the literal `Panos` with `${profileName}` (the variable already exists at `index.html:1709`).
- Audit the same function for the pronoun `"he"` on the same line; make it `"they"` or derive gender from a profile field.
- Search for all other occurrences of the string `Panos` in AI prompt strings and replace with `${profileName}`.

---

### 2. Hardcoded "Panos" in default reminder messages

**What:** `DEFAULT_REMINDERS` contains a hard-coded message `"Good morning Panos!"` that is written to `S.reminders` on first load and never updated when the user changes their name.  
**Where:** `index.html:6793`  
**Why it matters:** Any user who sets up the app fresh will permanently receive reminders addressed to the wrong person, and changing the name in Settings has no effect on the already-saved reminder text.  
**Effort:** S  
**Suggested fix:**
- Replace `'Good morning Panos!'` with `` `Good morning ${profileName}!` `` in the `DEFAULT_REMINDERS` constant (evaluated at runtime, not at parse time — move to a function).
- Add a migration in `initReminders()` that patches the `msg` field of the `r-morning` reminder if it still contains `"Panos"` and the stored name differs.

---

### 3. XSS via unescaped user content in `innerHTML` (multiple call sites)

**What:** Several render functions inject user-controlled strings directly into `innerHTML` without calling the app's own `esc()` helper. A task title or goal description containing `<img src=x onerror=alert(1)>` executes arbitrary JavaScript.  
**Where:** (all in `index.html`)
- `2336` — `${g.title}` in `goalCard()`
- `2337` — `${g.description}` in `goalCard()`
- `2341` — linked `${t.title}` in `goalCard()`
- `2450` — `${t.title}` in `tcHTML()`
- `2458` — `${gl.title.slice(0,20)}` in `tcHTML()`
- `2360`, `2367` — task titles in the weekly review wizard (`renderWizPanel()`)
- `2558` — `${t.title.slice(0,30)}` in the delete-undo toast

**Why it matters:** While the app is single-user, it accepts JSON imports from untrusted files and pulls content from Readwise/Notion. A malicious bookmark title in a Readwise import would fire on every dashboard render.  
**Effort:** S  
**Suggested fix:**
- Wrap every bare `${t.title}`, `${g.title}`, and `${g.description}` interpolation that lands in an `innerHTML` assignment with `esc()` (already defined at `index.html:7315`).
- `grep -n '\.title\b' index.html | grep '\${' | grep -v 'esc('` will find remaining gaps.
- Add a lint rule / pre-commit hook that flags `innerHTML` assignments containing `${` without `esc(`.

---

### 4. Onclick-attribute injection in EOD quick-pick

**What:** Task titles are injected raw into an `onclick` attribute string with only single-quote escaping. A title like `x'; eval('/*` breaks the handler and runs arbitrary code.  
**Where:** `index.html:7488`  
```js
onclick="document.getElementById('eod-mit').value='${t.title.replace(/'/g,"\'")}';"
```
**Why it matters:** This is the end-of-day planning flow — a daily touchpoint. A crafted task title (e.g. from a Notion or Readwise import) would execute code on every EOD review.  
**Effort:** S  
**Suggested fix:**
- Store the task ID as a `data-id` attribute instead of embedding the title in the handler.
- Use an event listener that reads the task by ID and sets the input value in JavaScript: `document.getElementById('eod-mit').value = S.tasks.find(t=>t.id===el.dataset.id)?.title ?? ''`.
- This is the correct pattern already used everywhere else in the app (e.g. `onclick="openEdit('${t.id}')"`) — apply it here.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Claude API key exported verbatim inside task-data backups

**What:** `exportData()` serialises the entire `S` state object — including `S.claudeKey` — to a downloadable JSON file.  
**Where:** `index.html:1764`, API key stored at `index.html:6190` (`S.claudeKey = k`)  
**Why it matters:** A user who shares their backup with another device, stores it in Dropbox, or pastes it to get help on a forum silently leaks their Anthropic API key. The key has billing and rate-limit consequences.  
**Effort:** S  
**Suggested fix:**
- Exclude API keys from the export: `const {claudeKey, ...exportable} = S; JSON.stringify(exportable, …)`.
- Move `claudeKey` (and `readwiseKey`, `notionKey`) to a separate `localStorage` entry (e.g. `taskos_keys`) so they are structurally separated from the data blob.
- Show a one-time warning toast when the export is triggered: "API keys are not included in backups."

---

### 6. Dead duplicate `aiDailyPicks` function — dead code silently overrides better version

**What:** `aiDailyPicks` is declared twice: once at line 2118 (weaker prompt, 400-token budget) and again at line 5269 (richer prompt, 350-token budget). JavaScript's hoisting means the second declaration silently wins; the first is unreachable dead code that confuses maintainers.  
**Where:** `index.html:2118` (dead), `index.html:5269` (live)  
**Why it matters:** The dead version at 2118 has a different prompt shape. If anyone edits "the daily picks function" and happens to find the first one, their changes have zero effect — a hard-to-diagnose silent failure.  
**Effort:** S  
**Suggested fix:**
- Delete the entire function block at lines 2118–2137.
- Verify the surviving version at 5269 handles the `!res` null return case (it does: `if(!text)return`).

---

### 7. Native `alert()` used for form validation errors

**What:** `saveTask()` and `saveGoal()` use the browser's synchronous `alert()` dialog for validation failures, which blocks the main thread and looks inconsistent with the app's polished toast/confirm system.  
**Where:** `index.html:2533` (`alert('Enter a task title.')`), `index.html:2732` (`alert('Enter a goal title.')`)  
**Why it matters:** `alert()` freezes the page, cannot be styled, and cannot be dismissed with Escape in the same flow as the rest of the UI. It breaks immersion in what is otherwise a well-designed modal experience.  
**Effort:** S  
**Suggested fix:**
- Replace both `alert(…)` calls with `toast(…)` (already available and themed).
- Add a CSS `shake` animation class to the empty input field to provide visual feedback in-place.
- Use the same pattern as the finance/health forms (`return toast('Date and value required')` at `index.html:3501`).

---

### 8. Notion "Pull from Notion" button always fails (CORS) with no real resolution path

**What:** The Notion API call at `index.html:6470` always hits a CORS error in the browser because Notion blocks cross-origin requests. The error handler at line 6483 displays a workaround (manually export to Markdown) that defeats the purpose of the one-click pull UX.  
**Where:** `index.html:6470–6497`  
**Why it matters:** Users who set up a Notion integration token, configure the page URL, and hit "Pull" are met with a dead-end error. The call-to-action text implies the feature works; it never does.  
**Effort:** M  
**Suggested fix:**
- Remove the "Pull" button or replace it with a clearly-labelled "Paste Markdown from Notion" textarea that skips the API call.
- Alternatively, route the request through a lightweight Vercel serverless function (`/api/notion?pageId=…`) that holds the token server-side and proxies the Notion API — this properly solves CORS.
- Update the Settings UI to remove the Notion token field if the proxy route is not added, to avoid misleading users.

---

### 9. App is keyboard-inaccessible — interactive elements are non-focusable `<div>`s

**What:** Every task card, goal card, and interactive list item uses a `<div onclick=…>` without `role`, `tabindex`, or keyboard event handling. The app has exactly 1 `aria-label` in 8 592 lines and zero `role` attributes.  
**Where:** `index.html:2447` (`tcHTML()`), `index.html:2334` (`goalCard()`), plus ~200 other interactive `<div>` cards  
**Why it matters:** The app is unusable with a keyboard alone, fails basic WCAG 2.1 AA (SC 2.1.1), and is inaccessible to screen-reader users. PWAs are frequently used on desktop; keyboard nav is expected.  
**Effort:** M  
**Suggested fix:**
- In `tcHTML()` and `goalCard()`, add `tabindex="0" role="button"` and `onkeydown="if(event.key==='Enter'||event.key===' ')openEdit('${t.id}')"` to the top-level wrapper.
- Add `aria-label` to icon-only buttons (🗑, ✏️, ⭐) throughout the app.
- Add `role="dialog"` and `aria-modal="true"` to each `.mo` modal element — the focus trap is already implemented at `index.html:2763`, just not announced to AT.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `importData` merges untrusted JSON directly onto global state without validation

**What:** `importData()` calls `Object.assign(S, d)` on a user-supplied JSON file with only a `d.tasks` array-check. Any key in the file — including `claudeKey`, `ntfy`, arbitrary prototype properties — is merged unconditionally.  
**Where:** `index.html:1777`  
**Why it matters:** A shared or malicious backup file could overwrite API credentials, disable features, or inject unexpected state that causes silent data loss.  
**Effort:** S  
**Suggested fix:**
- Add an allowlist of mergeable keys: only merge known `S` properties (tasks, goals, reviews, habits, etc.) and skip `claudeKey`, `readwiseKey`, `notionKey`.
- Validate array fields: `if(!Array.isArray(d.tasks))` check already exists; apply similar guards to `goals`, `people`, `books`, etc.

---

### 11. Three silent empty catch blocks swallow runtime errors

**What:** Three `catch(e){}` blocks discard exceptions without any logging or user feedback.  
**Where:**
- `index.html:6830` — `new Notification(…)` in the reminder tick (silent if permission is revoked)
- `index.html:6975` — AI JSON parsing in a feature briefing (silently shows nothing)
- `index.html:7203` — AI briefing cache read (silently shows stale/no data)
**Why it matters:** When these fail in production there is no signal — not even a console message. The `6975` case means an AI feature silently shows a blank panel with no indication of the parse error.  
**Effort:** S  
**Suggested fix:**
- `6830`: Add `console.warn('Notification failed', e)` at minimum; optionally fall back to ntfy.
- `6975`/`7203`: Add `console.error(…)` and surface a toast or `"AI response could not be parsed"` message to the user.

---

### 12. `t.title` and `g.title` unescaped in `<option>` value text and secondary card elements

**What:** The "blocked by" dependency select (`index.html:1733`) injects `t.title.slice(0,45)` into `<option>` inner text without `esc()`. The goal-linked task list (`index.html:2341`) also skips escaping for listed task titles.  
**Where:** `index.html:1733`, `index.html:2341`  
**Why it matters:** `<option>` elements don't execute `onerror` handlers, but an unescaped `<` can break the enclosing `<select>` rendering and cause the dropdown to stop working. Consistent escaping is also a maintenance habit.  
**Effort:** S  
**Suggested fix:**
- `1733`: `'>'+t.title.slice(0,45)+'</option>'` → `'>'+esc(t.title.slice(0,45))+'</option>'`.
- `2341`: Wrap `${t.title}` with `${esc(t.title)}`.
- Run a one-pass grep across all remaining `innerHTML` assignments and apply `esc()` anywhere a user-supplied string field appears.

---

### 13. Service worker cache key is a hard-coded future date — updates will be stale

**What:** The service worker cache name is `'task-os-20260516'` — a specific hard-coded date string. When the app is updated, old clients continue serving the cached version until someone manually changes this string in a commit.  
**Where:** `sw.js` (line 1, `const CACHE = 'task-os-20260516'`)  
**Why it matters:** A bug fix deployed to Vercel will not reach users who have the PWA installed until the cache key is bumped in a separate commit — a workflow that is easy to forget.  
**Effort:** S  
**Suggested fix:**
- Inject the cache key at build / deploy time using an environment variable or a git commit hash: `const CACHE = 'task-os-%%BUILD_HASH%%'` and substitute via a Vercel build step.
- Or use a simpler convention: set `CACHE` to `'task-os-' + Date.now()` inside a `self.addEventListener('install', …)` to always bust on new SW deployment.

---

### 14. 8 592-line monolithic `index.html` — no module boundaries

**What:** All CSS (≈350 lines), HTML (≈600 lines), and JavaScript (≈7 600 lines) live in a single file with no imports, no module system, and no clear section boundaries beyond comment dividers.  
**Where:** `index.html` (entire file)  
**Why it matters:** Finding a specific function requires full-file search. Making a change to the task-card renderer risks introducing a regression in the Wheel of Life renderer on the same scroll. Any linting, type-checking, or bundling tooling cannot be applied without refactoring first.  
**Effort:** L  
**Suggested fix:**
- **Do not attempt a single big rewrite.** Instead, extract files opportunistically as features are touched:
  - First pass: move the `<style>` block to `style.css` and the `<script>` to `app.js` — zero logic change, immediate tooling gain.
  - Second pass: extract each major view (Health, Finance, Goals, etc.) into a `views/` folder as ES modules.
- Add `type="module"` to the script tag once the first extraction is complete.

---

## 💡 P3 — Nice to have

### 15. No error observability in production — failures are invisible

**What:** There is no error tracking integration (Sentry, Rollbar, or similar). Silent failures in AI calls, CSV imports, and Notion pulls produce no production signal.  
**Where:** Throughout `index.html`, especially `callClaude()` at `:3396`  
**Why it matters:** When a feature silently breaks for users, there is no way to know until someone reports it manually.  
**Effort:** S  
**Suggested fix:**
- Add Sentry's CDN snippet (free tier, ~5KB) to `<head>`. All uncaught exceptions and unhandled promise rejections will be captured automatically.
- Add `Sentry.captureException(e)` to the catch block in `callClaude()` and other high-value error handlers.

---

### 16. Data loss risk: localStorage-only persistence with no cloud backup prompt

**What:** All user data lives exclusively in localStorage. Clearing site data, switching browsers, or a device failure results in total, silent data loss with no recovery path.  
**Where:** `index.html:1755` (`save()` function)  
**Why it matters:** Months of task history, goals, and reviews are one `localStorage.clear()` away from permanent deletion. The export feature exists but requires manual action.  
**Effort:** M  
**Suggested fix:**
- On first load (or weekly), prompt the user to download a backup: "You haven't exported in X days — protect your data."
- Track `S.lastExportAt` and surface a banner if it's been > 14 days.
- Longer-term: add optional sync via a free-tier KV store (Vercel KV, Cloudflare Workers KV) behind a user-supplied key.

---

### 17. AI prompts silently send full personal context to Anthropic with no disclosure

**What:** AI prompts include task titles, goal descriptions, personal values, health notes, and relationship notes — all sent to `api.anthropic.com` without any in-app notice that this data leaves the device.  
**Where:** `index.html:3396–3412` (`callClaude()`), and every AI feature call site  
**Why it matters:** Users may not realise their personal life data is being transmitted to a third-party API. This is a trust and (in some jurisdictions) a GDPR/privacy-notice issue.  
**Effort:** S  
**Suggested fix:**
- Add a one-time modal (dismissed to localStorage) when the Claude API key is first saved: "AI features send relevant task and goal data to Anthropic to generate responses. Data is not stored by Anthropic beyond the request."
- Link to Anthropic's privacy policy.

---

### 18. CSV import parser has no row-level error reporting

**What:** The CSV import at `index.html:6502+` silently skips malformed rows with no feedback. Users who import a 50-row CSV with 3 bad rows get "48 tasks imported" with no indication that rows were dropped.  
**Where:** `index.html:6502–6600` (approximate; `previewCSV()` function)  
**Why it matters:** Silent data loss during import erodes trust; users may not notice tasks were dropped until they've already closed the import modal.  
**Effort:** S  
**Suggested fix:**
- Collect parse errors per row and display them in the preview panel: "3 rows skipped — columns missing: [row 12], [row 31], [row 44]."
- Add a "Download problem rows" link so users can fix and re-import.

---

### 19. `profileName` stored in a separate `localStorage` key, inconsistent with rest of settings

**What:** `profileName` is kept in `localStorage.getItem('taskos_name')` separately from the main `S` object, while `claudeKey`, `ntfy`, and all other settings live inside `S`. This inconsistency means the profile name is excluded from backups and imports.  
**Where:** `index.html:1709`, `index.html:6188`  
**Why it matters:** When a user restores from a backup, their name reverts to "Panos" (the default) because `profileName` was never exported. This is the same root cause as issues #1 and #2.  
**Effort:** S  
**Suggested fix:**
- Move `profileName` into `S.profileName`, initialising from the legacy key for backward compatibility.
- Include it in export/import naturally (once API keys are excluded per item #5).
- Update `DEFAULT_REMINDERS` to reference `S.profileName` at render time.

---

### 20. `givelink.html` duplicates architecture and accumulates parallel tech debt

**What:** The Givelink Sprint Board (`givelink.html`, 1 755 lines) is a fully separate monolithic HTML app with its own state object, CSS, and render logic — a copy-paste fork that shares no code with `index.html`.  
**Where:** `givelink.html` (entire file)  
**Why it matters:** Bug fixes and improvements applied to `index.html` (including all items above) must be manually replicated to `givelink.html`. The two apps will diverge in quality over time.  
**Effort:** L  
**Suggested fix:**
- Extract shared utilities (`uid()`, `esc()`, `save()`/`load()` wrappers, toast queue, modal helpers) into a `shared.js` ES module loaded by both apps.
- This is the smallest-ROI step that breaks the duplication without requiring a full rewrite.
- Do not attempt to merge the apps — they serve different UX purposes; shared utilities is sufficient.

---

*Generated from static analysis of the repository at HEAD. No PostHog data was available — conversion funnel items (e.g. Stripe onboarding friction) are out of scope for this codebase as it has no payment flow.*
