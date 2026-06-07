# Improvement Plan — Task OS / Givelink
_Generated 2026-06-07 | Scope: `index.html` (12 888 lines), `givelink.html` (1 756 lines), `sw.js`, `vercel.json`_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. API key stored in `localStorage` and sent directly from the browser
- **What**: The Anthropic API key lives in `localStorage` and is shipped raw in every client-side `fetch` header — visible to anyone who opens DevTools.
- **Where**: `index.html:4131-4135`, `givelink.html:1085-1087, 1266`
- **Why it matters**: A malicious page in another tab, any injected script, or a naive copy-paste of the DevTools Network tab leaks a live key. One leaked key means unexpected costs or account suspension.
- **Effort**: M
- **Suggested fix**:
  - Add a thin server-side proxy endpoint (`/api/claude`) that holds the key in an env var.
  - The client posts the prompt; the proxy calls Anthropic and returns the result.
  - Remove `claudeKey` from the `S` store and the `localStorage` write path entirely.

---

### 2. Silent `catch(e){}` blocks swallow critical data errors
- **What**: 11 empty catch blocks silently eat JSON-parse failures, storage errors, and sync exceptions — users lose data with no feedback.
- **Where**: `index.html:2430, 2498, 2874, 3227, 4513, 8619, 8652, 8670, 10049` · `givelink.html:1083, 1259`
- **Why it matters**: When `localStorage` parse fails on startup the app boots with blank state. The user sees nothing wrong and may wipe their data trying to "fix" it.
- **Effort**: S
- **Suggested fix**:
  - Replace every `catch(e){}` with at minimum `catch(e){ console.error('[TaskOS]', e); }`.
  - For user-facing operations (save, sync, import) also call `toast('⚠️ ' + e.message)`.
  - The four blocks in the data-persistence path (`2430`, `2498`, `2874`, `10049`) are highest priority.

---

### 3. Zero `localStorage` quota checks across 71 write calls
- **What**: Every `save()` writes unconditionally; when the browser's ~5 MB quota is full the write throws a `QuotaExceededError` that is either silently swallowed (see #2) or surfaces as an uncaught exception.
- **Where**: `index.html` — all `localStorage.setItem` call sites, primary entry point is the `save()` helper.
- **Why it matters**: Power users with years of tasks/journals will hit this ceiling; they will lose the most recent session silently.
- **Effort**: S
- **Suggested fix**:
  - Wrap the central `save()` function in a try/catch that catches `QuotaExceededError` specifically.
  - Show a persistent banner: _"Storage nearly full — export a backup or enable cloud sync."_
  - Optionally prune completed tasks older than 90 days automatically after user confirmation.

---

### 4. Inconsistent AI models between the two apps causes silent cost and quality divergence
- **What**: `index.html` calls `claude-haiku-4-5-20251001`; `givelink.html` calls `claude-opus-4-5` — different quality tiers, vastly different costs, with no visible indication to the user.
- **Where**: `index.html:4136` · `givelink.html:1140, 1256`
- **Why it matters**: Givelink's grant-writing prompts rack up Opus-level costs the user does not expect; Haiku tasks in the main app may under-deliver on complex AI workflows.
- **Effort**: S
- **Suggested fix**:
  - Define a single constant at the top of each file (or a shared `config.js`): `const AI_MODEL = 'claude-haiku-4-5-20251001';`.
  - Make `callClaude` / `callClaudeGL` accept the model as a parameter so callers can opt into a stronger model explicitly.
  - Document the choice in a comment so the next person knows it was intentional.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. AI failures return `null` silently — users see a frozen spinner or nothing
- **What**: `callClaude()` returns `null` on network error or API rejection; most callers do not check the return value, leaving the UI in whatever mid-generation state it was in.
- **Where**: `index.html:4143-4145` (error path), call sites at `4176`, `4159-4179`; `givelink.html:1102` (spinner shown but no error path)
- **Why it matters**: Users believe the AI "didn't work" or the app is broken; they churn rather than retry.
- **Effort**: S
- **Suggested fix**:
  - After every `await callClaude(…)` call, check `if (!result) { showError('AI request failed — check your API key or try again.'); return; }`.
  - Add a timeout (e.g., 30 s) via `AbortController` so the spinner never runs indefinitely.
  - In `givelink.html` the "⏳ Thinking…" at line 1102 needs a corresponding failure branch.

---

### 6. Touch targets are 22 px — mobile is effectively unusable
- **What**: Checkboxes and icon buttons are styled at 22 px; WCAG 2.5.5 and Apple HIG both require 44 px minimum.
- **Where**: `index.html:275` (checkbox size), sidebar toggle button `38 px` wide at `index.html:240`
- **Why it matters**: Any user on a phone mis-taps frequently, loses tasks, and gives up. This is likely the single biggest mobile retention killer.
- **Effort**: S
- **Suggested fix**:
  - Set `min-width: 44px; min-height: 44px` on all interactive elements.
  - Use the CSS trick `padding` (not `width/height`) to expand the tap area without shifting layout: add a transparent `::after` pseudo-element with `content:''; position:absolute; inset:-11px;`.

---

### 7. No keyboard navigation or ARIA on custom modals, FAB, and sidebar
- **What**: All custom modals, the floating action button, and the sidebar have no `role`, `aria-label`, focus trapping, or `Escape` key handler.
- **Where**: `index.html` modals (multiple, e.g., around line 302), FAB at ~line 522; `givelink.html` modals
- **Why it matters**: Keyboard-only users and screen-reader users cannot operate the core UI. Also a legal accessibility risk in many jurisdictions.
- **Effort**: M
- **Suggested fix**:
  - Add `role="dialog"` `aria-modal="true"` `aria-labelledby` to every modal's root div.
  - On modal open: `document.addEventListener('keydown', trapFocus)` that cycles focus within the modal and closes on `Escape`.
  - Add `role="button"` `tabindex="0"` and a `keydown` handler (Enter/Space) to every clickable `<div>`.

---

### 8. Destructive delete uses `window.prompt()` — jarring and inconsistent
- **What**: Deleting a sprint or org uses a native browser `window.prompt()` confirmation, which looks broken compared to the rest of the UI and is easily dismissed accidentally.
- **Where**: `givelink.html:1425`
- **Why it matters**: Users accidentally delete sprints they meant to keep; the jarring native dialog breaks immersion and signals low production quality.
- **Effort**: S
- **Suggested fix**:
  - Build a small reusable `confirmModal(message, onConfirm)` function that renders a styled modal with Cancel / Confirm buttons (the modal infrastructure already exists).
  - Replace the `window.prompt()` call with `confirmModal('Delete this sprint? This cannot be undone.', () => { /* delete logic */ })`.

---

### 9. No visual feedback during Supabase cloud sync
- **What**: The `sbSyncNow()` flow runs silently — success and failure are both invisible unless the user happens to check the console.
- **Where**: `index.html:8609-8625`
- **Why it matters**: Users don't know if their data was saved to the cloud. They close the tab and lose work, or disable cloud sync thinking it's broken.
- **Effort**: S
- **Suggested fix**:
  - At sync start set a `data-syncing` attribute on the sync icon to show a spinner animation.
  - On success call `toast('✅ Synced')` with a 2 s auto-dismiss.
  - On failure call `toast('❌ Sync failed — ' + e.message, 5000)` with a "Retry" button.

---

### 10. AI rate-limiting function exists but is never enforced
- **What**: `_aiLock()` at `index.html:4156` appears to be the start of a concurrency guard but the mechanism is incomplete — multiple simultaneous AI calls are possible.
- **Where**: `index.html:4156` and all `callClaude()` call sites
- **Why it matters**: A double-click or rapid navigation can fire 2–3 Anthropic API calls in parallel, each billed at full cost. Power users will notice unexplained API spend.
- **Effort**: S
- **Suggested fix**:
  - Implement a simple module-level flag: `let _aiInFlight = false;`.
  - At the top of `callClaude`: `if (_aiInFlight) return null;  _aiInFlight = true;`.
  - In the `finally` block: `_aiInFlight = false;`.
  - Disable AI trigger buttons while `_aiInFlight` is true.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `index.html` is a 12 888-line monolith
- **What**: The entire application — routing, rendering, data layer, AI integration, cloud sync — lives in one file, making every change a diff across thousands of lines.
- **Where**: `index.html` (whole file)
- **Why it matters**: Any contributor has to load the full 12 K-line file to fix a single bug; merge conflicts are catastrophic; grepping for a function name returns dozens of false positives.
- **Effort**: L
- **Suggested fix**:
  - Extract as ES modules (no build step needed with `<script type="module">`): `tasks.js`, `ai.js`, `sync.js`, `utils.js`, `render.js`.
  - Start with `utils.js` (pure functions, zero side-effects) — that alone removes ~500 lines.
  - Extract `ai.js` next since it's the highest-churn area right now.

---

### 12. Utility functions (`esc`, `uid`, `toast`) duplicated in both files
- **What**: `esc()`, `uid()`, `toast()`, and the Claude API wrapper are copy-pasted between `index.html` and `givelink.html` with slight variations.
- **Where**: `givelink.html:451-453` mirrors `index.html` equivalents; `callClaude` vs `callClaudeGL`
- **Why it matters**: A bug fix in one copy is never applied to the other. Both files have diverged already (`callClaudeGL` uses Opus; `callClaude` uses Haiku).
- **Effort**: S
- **Suggested fix**:
  - Create `common.js` with the shared utilities and `<script src="common.js">` in both HTML files.
  - Parameterise `callClaude(prompt, { model, maxTokens })` so both files share one implementation.

---

### 13. Mixed async patterns make the sync code hard to audit
- **What**: `sbConnect()` and surrounding Supabase code mixes `.then().catch()` chains and `async/await` blocks within the same flow, obscuring the error-handling path.
- **Where**: `index.html:8562-8586`
- **Why it matters**: When sync breaks in production it's very hard to trace which branch threw. New contributors can't reason about the control flow.
- **Effort**: S
- **Suggested fix**:
  - Rewrite the Supabase block as a single `async` function using `await` throughout.
  - One top-level `try/catch` with specific error branches for auth failure vs network failure vs quota error.

---

### 14. No input validation before writing user data to `localStorage`
- **What**: User-supplied text (task titles, journal entries, org names) is stored and re-rendered without sanitisation; the existing `esc()` helper is not applied consistently.
- **Where**: `givelink.html:1631` (org name rendered with `.textContent` — safe), but many places in `index.html` use template literals with raw user data inside `.innerHTML`.
- **Why it matters**: A user pasting HTML-containing text can break their own layout (stored-XSS against themselves). Also, malformed data can crash `JSON.parse` on the next load (see #2).
- **Effort**: M
- **Suggested fix**:
  - Audit every `innerHTML` assignment for user-controlled strings; replace with `esc()` wrapping or switch to `.textContent`.
  - Add a `validateTask(obj)` guard before every `save()` call that checks required fields are strings and within length limits.

---

### 15. Service worker has no error handling for cache failures
- **What**: `sw.js` `fetch` event handler falls through to the network but does not handle cache-put errors or version-mismatch scenarios.
- **Where**: `sw.js` (entire file — short but missing error branches)
- **Why it matters**: On a quota-exceeded cache write the SW silently stops caching; the user thinks the app is offline-capable but it isn't. Debugging is very hard because SW errors are invisible.
- **Effort**: S
- **Suggested fix**:
  - Wrap `cache.put()` in a try/catch and log failures: `cache.put(req, res).catch(e => console.warn('[SW] cache.put failed', e))`.
  - On SW `activate` delete old caches by version name rather than unconditionally to avoid breaking a currently-open tab.

---

### 16. `vercel.json` CSP still allows direct browser→Anthropic calls after a proxy is added
- **What**: The `Content-Security-Policy` in `vercel.json:14` explicitly whitelists `https://api.anthropic.com` as a `connect-src`. Once a server-side proxy is in place this entry must be removed or it defeats the purpose.
- **Where**: `vercel.json:14`
- **Why it matters**: Leaving `api.anthropic.com` in the CSP after moving to a proxy means a compromised client script can still call Anthropic directly with a stolen key.
- **Effort**: S
- **Suggested fix**:
  - Remove `https://api.anthropic.com` from `connect-src` in the same PR that adds the backend proxy.
  - Add the proxy endpoint's own path (`/api/*`) to `connect-src` instead.

---

## 💡 P3 — Nice to have

### 17. AI configuration scattered — model IDs, token limits, API version are magic strings
- **What**: `'claude-haiku-4-5-20251001'`, `'2023-06-01'`, and token values `1000 / 1024 / 600 / 350 / 800` are hardcoded at their use-sites.
- **Where**: `index.html:4135-4136`; `givelink.html:1140, 1256`
- **Why it matters**: Upgrading to a new Claude model requires a grep-and-replace across two files. A stale model ID after Anthropic deprecates a version causes silent API errors.
- **Effort**: S
- **Suggested fix**:
  - Add a top-of-file constants block: `const AI = { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, apiVersion: '2023-06-01' };`.
  - Reference `AI.model` everywhere; upgrading the model becomes a one-line change.

---

### 18. Missing empty states in daily picks, weekly review, and finance views
- **What**: Several list views render an empty container with no guidance when there is no data, leaving a blank white box.
- **Where**: `index.html` — daily-picks section, weekly-review checklist, finance tracker (exact lines vary; givelink already has good empty states at `givelink.html:543, 597`)
- **Why it matters**: New users see blank panels and don't know if the feature failed or if they need to add data. Empty states double as onboarding prompts.
- **Effort**: S
- **Suggested fix**:
  - Return a consistent `<div class="empty">…</div>` block from every list render function when the data array is empty, matching the pattern already used in `givelink.html`.

---

### 19. Automatic backup UI is invisible despite Supabase integration existing
- **What**: The data-export function (`JSON.stringify(S,null,2)` at `index.html:2109`) exists but there is no "last backed up" timestamp or one-click restore flow visible to users.
- **Where**: `index.html:2109`; Supabase sync at `index.html:8540-8586`
- **Why it matters**: Users who lose local data don't know a cloud copy exists; they churn. Visible backups are also a trust signal for first-time users deciding whether to invest time in the app.
- **Effort**: M
- **Suggested fix**:
  - Show "Last synced: 3 min ago" next to the sync button, updated on every successful `sbSyncNow()` call.
  - Add a "Restore from cloud" button in settings that fetches the Supabase snapshot and calls `load()`.

---

### 20. `README.md` is 66 lines with no developer setup or architecture guide
- **What**: The README covers user features but has no instructions for running the app locally, no description of the data model, and no guidance on adding a Supabase project or API key.
- **Where**: `README.md`
- **Why it matters**: Any new contributor or the project owner returning after a few months spends 30+ minutes reverse-engineering the setup instead of shipping.
- **Effort**: S
- **Suggested fix**:
  - Add a **Developer setup** section: clone → open `index.html` in browser OR use a local static server.
  - Document the `S` (state) object's top-level keys and their purposes.
  - Add a one-paragraph description of the Supabase sync table schema so someone can recreate it.
