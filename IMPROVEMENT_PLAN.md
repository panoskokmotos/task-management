# Givelink Improvement Plan

_Generated: 2026-05-16 | Codebase: 10,274 lines (index.html 8,410 · givelink.html 1,755 · sw.js 109)_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Readwise & ntfy integrations fail silently — users think sync worked when it didn't

- **What**: Three empty catch blocks swallow errors from Readwise highlights fetch, ntfy notification post, and ntfy subscription — no feedback to user on failure.
- **Where**: `index.html:6648` (`catch(e){}`), `index.html:6670` (`catch(_){}`), `index.html:6692` (`catch(_){}`)
- **Why it matters**: A user enables Readwise sync, gets no confirmation, and checks their highlights later to find nothing imported. They have no way to know the integration is broken — silent failures erode trust in the product.
- **Effort**: S
- **Suggested fix**:
  - Replace all three empty catches with a `showToast('Readwise sync failed: ' + e.message, 'error')` / `showToast('Notification failed', 'error')` call.
  - Log the error to the console (`console.warn`) so devs can diagnose in the field.
  - For ntfy subscription, surface the failure in the settings UI (e.g., red dot on the integration status indicator).

---

### 2. Notes/JSON import silently drops all data on parse error

- **What**: The notes import parser catches a JSON parse failure and does nothing — `catch(e){}` — leaving the user with no imported data and no explanation.
- **Where**: `index.html:6793`
- **Why it matters**: A user pastes a backup JSON to restore lost data. The import silently no-ops. They close the dialog assuming success. Data is gone.
- **Effort**: S
- **Suggested fix**:
  - Replace the empty catch with a user-facing error: `showToast('Import failed — invalid JSON: ' + e.message, 'error')`.
  - Validate the parsed structure (check for expected keys) before committing to state, and show a schema mismatch warning if fields are missing.
  - Consider wrapping in a try/catch at the UI layer and disabling the "Import" button until the paste parses cleanly.

---

### 3. `unsafe-inline` CSP + API keys in localStorage = XSS fully drains user credentials

- **What**: The Content-Security-Policy in `vercel.json` permits `'unsafe-inline'` for `script-src`, while Claude, Readwise, and Notion API keys are stored in `localStorage` — readable by any injected script.
- **Where**: `vercel.json` (CSP header), `index.html:1737` (`localStorage.getItem('taskos_api_key')`), lines referencing `taskos_readwise_key`, `taskos_notion_key`
- **Why it matters**: If any third-party content (e.g., a task title pasted from a malicious source) ever reaches unescaped innerHTML — even once — the permissive CSP means injected `<script>` runs freely and can exfiltrate all API keys. The app has 226 innerHTML assignments; the attack surface is large.
- **Effort**: M
- **Suggested fix**:
  - Remove `'unsafe-inline'` from `script-src`. Extract all inline `<script>` blocks to a separate `app.js` file served from the same origin.
  - Add a nonce-based CSP as a second phase if full extraction is too large a lift initially.
  - As a stopgap, move API keys from `localStorage` to `sessionStorage` (clears on tab close, slightly narrower window) and add a clear warning in the settings UI that keys are stored client-side.

---

### 4. localStorage quota exceeded causes silent data loss with no recovery path

- **What**: All task data, notes, highlights, and settings are stored as serialized JSON in `localStorage` (5–10 MB limit per origin). There is no quota check before writes and no error handling when storage fails.
- **Where**: Every `localStorage.setItem(...)` call throughout `index.html` — approximately 20+ distinct keys, no centralized write layer.
- **Why it matters**: A power user with 500+ tasks, AI briefing cache, and Readwise highlights can silently hit the quota. The next `setItem` throws a `QuotaExceededError`, the catch block does nothing, and the user loses the current session's changes — discovering it only after reload.
- **Effort**: M
- **Suggested fix**:
  - Wrap all `localStorage.setItem` calls in a single `safeWrite(key, value)` utility that catches `QuotaExceededError` and shows a persistent (non-dismissable) warning: "Storage full — export your data now."
  - Add a storage usage meter in Settings (estimate via `JSON.stringify(localStorage).length`).
  - Prioritize eviction: AI briefing cache (line 7021) should be the first key cleared to free space.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. App uses blue accent everywhere — brand palette (purple/pink) is entirely absent

- **What**: The entire UI uses `--accent:#58a6ff` (dark mode) / `#2563eb` (light mode) — blue. The Givelink brand palette (purple `#6B3FA0`/`#5718CA`, pink `#C2185B`/`#E353B6`) appears zero times in the codebase.
- **Where**: `index.html` CSS variables at top of `<style>` block; `givelink.html` uses `--accent:#3b82f6` (also blue).
- **Why it matters**: The Givelink product variant (`givelink.html`) has its own manifest and icon but shares the generic blue palette with the task manager — it will not be recognizable as a Givelink-branded product. Any marketing screenshots, App Store listings, or user documentation showing brand colors will not match the actual UI.
- **Effort**: S
- **Suggested fix**:
  - In `givelink.html`, set `--accent:#5718CA` (primary purple) and `--accent-secondary:#E353B6` (pink) in the CSS `:root`.
  - Apply the "no pink on purple" rule: never use `#E353B6`/`#C2185B` text on a `#6B3FA0`/`#5718CA` background (insufficient contrast). Use white text on purple backgrounds instead.
  - In `index.html`, decide if the task manager is also Givelink-branded or a separate product — if branded, apply the same palette; if separate, document the intentional blue.

---

### 6. 30+ modal dialogs have no focus trap — keyboard users are locked out

- **What**: All modal dialogs (`<div class="modal">` / overlay patterns) render without capturing focus or preventing Tab from cycling into the obscured background content.
- **Where**: `index.html` — 30+ modal instantiation sites. The single `aria-label` in the entire file is on the hamburger menu (line 365). No `role="dialog"`, no `aria-modal="true"`, no focus management code.
- **Why it matters**: A keyboard-only user opens a modal, presses Tab, and focus immediately escapes to background buttons. They cannot complete the action (e.g., adding a task). This also fails WCAG 2.1 SC 2.1.2 (No Keyboard Trap — in reverse).
- **Effort**: M
- **Suggested fix**:
  - Write a single `trapFocus(modalEl)` utility that: (1) finds all focusable children, (2) focuses the first one on open, (3) intercepts Tab/Shift-Tab to cycle within the modal, (4) closes on Escape.
  - Call it from the modal-open path and call `releaseFocus()` on close.
  - Add `role="dialog"` and `aria-modal="true"` to each modal container, plus `aria-labelledby` pointing to the modal's heading.

---

### 7. Dynamic content (AI responses, task updates, toasts) is invisible to screen readers

- **What**: There are zero `aria-live` regions in the codebase. All dynamic content updates — AI briefings, task completion confirmations, import success/failure messages, toast notifications — are injected into the DOM without any live region announcement.
- **Where**: `index.html` — toast system (~line 2500+), AI briefing render (~line 7021), task status updates throughout.
- **Why it matters**: Screen reader users perform an action (complete a task, trigger AI briefing) and hear nothing. They cannot tell if the action succeeded, failed, or is still loading.
- **Effort**: S
- **Suggested fix**:
  - Add a visually-hidden `<div id="sr-announcer" aria-live="polite" aria-atomic="true"></div>` to the page.
  - When showing a toast, also set `document.getElementById('sr-announcer').textContent = message`.
  - For destructive/urgent events (data loss, auth errors) use `aria-live="assertive"`.

---

### 8. AI briefing cache write failure is silent — users see stale content with no indication

- **What**: The AI briefing caches its result to localStorage. If the write fails (quota, parse error), the app catches it silently (`catch(e){}`) and shows cached or re-fetched content with no staleness indicator.
- **Where**: `index.html:7021`
- **Why it matters**: A user opens the daily briefing, sees yesterday's content, assumes AI is working. They make planning decisions based on stale data. No timestamp, no "last updated" label, no refresh button visible.
- **Effort**: S
- **Suggested fix**:
  - Show a "Last updated: X minutes ago" timestamp below the AI briefing — always visible.
  - If the cache write fails, log a console warning and show "Briefing may be outdated — tap to refresh."
  - Add a visible manual-refresh button so users can force-regenerate without knowing the internals.

---

### 9. No error recovery UI for API failures — transient toast is the only signal

- **What**: When Claude, Readwise, or Notion API calls fail (line 3295, 6168, 6289), the only user feedback is a toast that auto-dismisses. There is no persistent error state, no retry button, and no guidance on how to fix auth/network issues.
- **Where**: `index.html:3295` (Claude fetch), `index.html:6168` (Readwise), `index.html:6289` (Notion)
- **Why it matters**: An API key expires or a network blip occurs. The toast appears and vanishes. The user submits again and sees the same dismissing toast. They have no way to know the key is invalid vs. the network is down vs. the service is degraded — and no path to fix it.
- **Effort**: M
- **Suggested fix**:
  - For auth errors (401/403): show a persistent banner with a direct link to the relevant settings field ("Your Claude API key appears invalid — update it in Settings").
  - For network/5xx errors: show a retry button inline with the failed action.
  - Distinguish error types in the catch: check `response.status` before showing generic "failed" messages.

---

### 10. Escape key handling is inconsistent across 30+ modals — 10 onkeydown handlers, no unified system

- **What**: Escape key closes some modals (10 `onkeydown` handlers exist) but not others. Users who learn to press Escape will hit modals that don't respond — requiring them to find and click the close button.
- **Where**: `index.html` — 10 `onkeydown` handlers scattered through the file, no centralized modal manager.
- **Why it matters**: Inconsistent behavior trains users that the app is unreliable. Power users relying on keyboard shortcuts will hit friction constantly.
- **Effort**: S
- **Suggested fix**:
  - Create a `ModalStack` singleton that tracks open modals. Add a single `document.addEventListener('keydown', e => { if (e.key === 'Escape') ModalStack.closeTop(); })`.
  - Remove the 10 scattered `onkeydown` handlers and register/deregister modals with the stack on open/close.
  - This also enables the focus trap from item #6 to be integrated in one place.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `index.html` is 8,410 lines — a single monolithic file with 333+ functions and all CSS/JS inlined

- **What**: The entire application — HTML structure, CSS (full dark/light theme), and 333+ JavaScript functions — lives in one file. There is no module system, no build step, and no separation of concerns.
- **Where**: `/home/user/task-management/index.html` (entire file)
- **Why it matters**: Every change risks unintended regressions elsewhere in the file. Merge conflicts are unresolvable. New features cannot be developed and tested in isolation. The file is too large for most editors to navigate efficiently.
- **Effort**: L
- **Suggested fix**:
  - As a first step (low risk): extract CSS into `styles.css` and load via `<link>` — this alone removes ~1,500 lines.
  - Extract the JS into `app.js` (prerequisite: fix the CSP `unsafe-inline` issue from P0 item #3).
  - Long-term: group functions into logical modules (`tasks.js`, `ai.js`, `integrations.js`, `ui.js`) using ES modules with `<script type="module">`.

---

### 12. `seed()` function is 394 lines (no tests, no isolation)

- **What**: The demo data initialization function (`seed()`) runs 394 lines of imperative state mutation with hardcoded strings, dates, and nested structures — all in one function.
- **Where**: `index.html:2818–3212`
- **Why it matters**: Demo data quality matters for first-run UX. A bug in `seed()` breaks the onboarding experience for every new user, and there's no way to test it in isolation. Its length also makes it a common source of merge conflicts.
- **Effort**: S
- **Suggested fix**:
  - Extract demo data into a `seed-data.json` file and load it via `fetch('./seed-data.json')` in the `seed()` function body — reduces function to ~10 lines.
  - This also allows product/design to iterate on demo content without touching JavaScript.

---

### 13. 20+ unversioned `localStorage` keys with no schema migration strategy

- **What**: The app reads and writes 20+ distinct `localStorage` keys (`taskos_*`, direct keys) without any schema version tracking. There is no migration path if a key's structure changes.
- **Where**: Throughout `index.html` — keys include `taskos_api_key`, `taskos_readwise_key`, `taskos_notion_key`, `taskos_notion_page`, plus task/settings data.
- **Why it matters**: Shipping a data structure change (e.g., adding a required field to a task object) silently breaks existing users' data. This has already caused bugs in apps of this type — stale structures cause JS errors that crash the entire app on load.
- **Effort**: M
- **Suggested fix**:
  - Add a `taskos_schema_version` key. On startup, read the version and run any pending migrations before loading the rest of the data.
  - Write a `migrateSchema(fromVersion, data)` function that handles structural transforms (e.g., `v1 → v2: add task.priority field defaulting to 'medium'`).
  - Increment the version in code whenever a breaking schema change ships.

---

### 14. No production error monitoring — zero visibility into user-facing failures

- **What**: There is no error tracking (Sentry, PostHog, or even a simple `window.onerror` handler). Production failures are invisible until a user reports them.
- **Where**: `index.html` — no `window.onerror`, no `window.addEventListener('unhandledrejection')`, no analytics.
- **Why it matters**: The empty catch blocks (P0 items #1–2) and localStorage failures (P0 item #4) are already happening in production. Without monitoring, there is no way to know how frequently or which users are affected.
- **Effort**: S
- **Suggested fix**:
  - Add a `window.onerror` and `window.addEventListener('unhandledrejection')` handler that POSTs to a lightweight endpoint or sends to a free tier of Sentry/LogRocket.
  - At minimum, log errors to `console.error` consistently (replace all empty catches) so users can self-diagnose from DevTools.
  - If PostHog is already on the roadmap, add basic error capture events there.

---

### 15. `givelink.html` (1,755 lines) duplicates structure and likely CSS from `index.html`

- **What**: `givelink.html` is a separate 1,755-line file that appears to be a Givelink-branded variant of the main app. There is no shared component or stylesheet — any UI fix must be applied twice.
- **Where**: `/home/user/task-management/givelink.html` (entire file)
- **Why it matters**: Bug fixes applied to `index.html` are silently not applied to `givelink.html`. Brand updates (e.g., implementing the purple/pink palette from P1 item #5) require duplicate work. This will worsen as both files diverge.
- **Effort**: M
- **Suggested fix**:
  - Extract the shared CSS into a `base.css` file and the shared JS into `app.js`.
  - Let `index.html` and `givelink.html` each include these shared assets and only define their variant-specific overrides (palette, branding, feature flags).
  - This is a prerequisite for item #11 anyway — tackle them together.

---

### 16. `catch(()=>({}))` silently converts API error responses to empty objects

- **What**: At line 3301, a `.catch(()=>({}))` on the JSON response parse means a non-JSON error body (e.g., a rate-limit HTML page from Claude's API) silently becomes an empty object `{}`, causing the calling code to fail with a confusing downstream error.
- **Where**: `index.html:3301`
- **Why it matters**: When Claude's API returns a 429 or 503 with an HTML body, the app sees `{}`, tries to access `{}.content[0].text`, throws a TypeError, and the user sees "AI failed" with no actionable detail (rate limit? wrong key? service down?).
- **Effort**: S
- **Suggested fix**:
  - Replace `.catch(()=>({}))` with `.catch(e => { throw new Error('Response parse failed: ' + e.message); })`.
  - In the outer catch at line 3295, check `response.status` before attempting `.json()` and throw meaningful errors: `if (response.status === 429) throw new Error('Rate limit reached — try again in a moment')`.

---

## 💡 P3 — Nice to have

### 17. No retry logic for transient API failures (Claude, Readwise, Notion)

- **What**: All four API fetch calls make a single attempt with no retry on transient failures (network blip, 429, 503).
- **Where**: `index.html:3295, 6168, 6289, 6661`
- **Why it matters**: Mobile users on flaky connections will see avoidable failures. Claude's API frequently returns 529 (overloaded) during peak hours.
- **Effort**: S
- **Suggested fix**: Write a `fetchWithRetry(url, options, maxRetries=2)` wrapper with exponential backoff. Use it for all four fetch calls.

---

### 18. Service worker cache is not versioned — stale assets silently served after deploy

- **What**: `sw.js` implements caching but the cache name appears static — no version bump mechanism tied to deployments.
- **Where**: `sw.js` (all 109 lines)
- **Why it matters**: After a deploy, returning users may receive cached JS/HTML from the previous version, mixing old and new behavior — a source of hard-to-reproduce bugs.
- **Effort**: S
- **Suggested fix**: Inject a build hash or timestamp into the service worker cache name at deploy time (e.g., via a Vercel build step that replaces `CACHE_VERSION` placeholder). On activate, delete all caches that don't match the current version string.

---

### 19. JSON parse/stringify repeated on every state read/write — no memoization layer

- **What**: Task data is serialized and deserialized from localStorage on every operation. With 500+ tasks and frequent auto-saves, this creates measurable jank on lower-end devices.
- **Where**: Every `JSON.parse(localStorage.getItem(...))` and `localStorage.setItem(..., JSON.stringify(...))` call throughout `index.html`.
- **Why it matters**: Users with large datasets (many tasks + Readwise highlights + AI cache) will experience noticeable lag on task interactions.
- **Effort**: M
- **Suggested fix**: Keep an in-memory cache of the parsed state object (`S`). Read from `localStorage` only on startup. Write to `localStorage` in a debounced `save()` function (e.g., 500ms debounce) rather than on every mutation.

---

### 20. No iCal/calendar export despite the app being heavily date-driven

- **What**: The app exports JSON, CSV, and Markdown but not iCal (`.ics`) — the format needed to import tasks/deadlines into Google Calendar, Apple Calendar, or Outlook.
- **Where**: `index.html:1758–1787` (existing export functions)
- **Why it matters**: Users who want to see their Givelink deadlines alongside meetings must manually re-enter them in their calendar. This is a conversion-relevant feature for productivity-focused users.
- **Effort**: S
- **Suggested fix**: Add an `exportIcal()` function alongside the existing export functions. Each task with a due date becomes a `VEVENT`. Use the RFC 5545 format — no library needed, it's plain text. Add an "Export to Calendar" button in the export menu.
