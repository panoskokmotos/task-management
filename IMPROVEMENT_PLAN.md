# Givelink Improvement Plan
_Generated: 2026-06-20_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP blocks Google Fonts — Inter never loads in production
- **What**: `vercel.json` CSP omits `fonts.googleapis.com` from `style-src` and `fonts.gstatic.com` from `font-src`, so the Inter stylesheet and font files are blocked.
- **Where**: `vercel.json:14`, `index.html:12-14`
- **Why it matters**: Every Task OS user on production sees system fonts (San Francisco / Segoe UI) instead of Inter. The entire typographic hierarchy is different from what's designed.
- **Effort**: S
- **Suggested fix**:
  - In `vercel.json:14`, change `style-src 'self' 'unsafe-inline'` → `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  - Add `https://fonts.gstatic.com` to `font-src`
  - Alternative: self-host Inter and remove the Google Fonts dependency entirely

---

### 2. CSP blocks Supabase — cloud sync completely broken in production
- **What**: The Supabase REST and Auth endpoints (`https://<project>.supabase.co/...`) are absent from `connect-src` in `vercel.json`. Every `fetch()` call to the user's Supabase project is rejected by the browser.
- **Where**: `vercel.json:14`, `index.html:8551, 8579, 8598, 8609`
- **Why it matters**: Users who follow the setup guide in `supabase-setup.sql` and enter their credentials in Settings get a silent CORS/CSP block. The "Connect & Sync" button appears to fail with no useful error.
- **Effort**: S
- **Suggested fix**:
  - Add `https://*.supabase.co` to `connect-src` in `vercel.json:14` (the wildcard is needed because each project has a unique subdomain)
  - Also add `https://*.supabase.co` to allow WebSocket if real-time is ever used

---

### 3. Push notification icon 404 — sw.js references missing file
- **What**: The service worker's `push` event handler at `sw.js:39` sets `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'`, but the `icons/` directory does not exist in the repo.
- **Where**: `sw.js:39-40`
- **Why it matters**: Any push notification sent to a PWA user will either show a broken icon or fail to display on strict platforms (Android). iOS ignores the icon, but the 404 logged in the SW console adds noise and can cause `showNotification()` to reject on some Android versions.
- **Effort**: S
- **Suggested fix**:
  - Replace `./icons/icon-192.png` with `./icon.svg` (which exists) for both `icon` and `badge`
  - Or add a proper 192×192 PNG to the repo and update the path

---

### 4. CRM nonprofit modal renders stale footer buttons
- **What**: `_showNPModal()` in `givelink.html` creates the modal DOM exactly once (`if(!m){…}`). The footer — which conditionally includes "Delete", "Log Activity", and "Next Stage" buttons based on `editNpId` — is baked into that first render and never updated.
- **Where**: `givelink.html:1358-1401` (especially lines 1379-1386)
- **Why it matters**: If the first call is `openAddNP()` (`editNpId=null`), the modal is created without action buttons — they never appear even when editing existing orgs. If the first call is `openEditNP()`, delete/action buttons always appear even on the "Add" flow, potentially triggering deletes on unsaved entries.
- **Effort**: S
- **Suggested fix**:
  - Move the footer out of the static `m.innerHTML` template
  - After setting field values (at the end of `_showNPModal`), also update the footer element: `m.querySelector('.np-footer-actions').innerHTML = editNpId ? '…buttons…' : ''`
  - Or: always include the buttons but toggle `style.display` based on `editNpId`

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. `callClaudeGL` silently swallows all API errors
- **What**: The shared AI helper `callClaudeGL()` never checks `res.ok` before parsing JSON. A 401 (bad key), 429 (rate limit), or 500 response causes a silent `null` return, displaying only the generic toast "AI error: …" with the raw low-level exception — or worse, no message at all.
- **Where**: `givelink.html:1264-1271` (contrast with `runAiSprintPlanner` which checks `res.ok` at line 1145)
- **Why it matters**: Standup generation and outreach email drafting both go through `callClaudeGL`. When they fail (e.g., expired key, rate limit), the user sees "Could not generate. Check your API key." with no actionable detail on what actually went wrong.
- **Effort**: S
- **Suggested fix**:
  - Add `if(!res.ok){const err=await res.text();throw new Error(err);}` after `const data=await res.json()` in `callClaudeGL`
  - Parse the Anthropic error JSON to surface `error.message` in the toast: `JSON.parse(err)?.error?.message`

---

### 6. `window.prompt()` for API key is blocked and jarring
- **What**: `getApiKey()` at `givelink.html:1086` and `callClaudeGL` at line 1261 call `window.prompt()` when no API key is found. Prompts are suppressed in iframes, PWA standalone mode on iOS, and in many corporate browser policies.
- **Where**: `givelink.html:1086`, `givelink.html:1261`
- **Why it matters**: Clicking "AI Sprint Planner", "Standup", or "Draft Email" silently does nothing in PWA standalone mode on iOS, giving the impression the feature is broken.
- **Effort**: S
- **Suggested fix**:
  - Replace the `prompt()` calls with a small inline modal that has a password input and a "Save" button
  - Store the key under `taskos_api_key` in localStorage (consistent with the existing fallback read)
  - Show the modal with a deep-link instruction: "Add key in Task OS → Settings → AI"

---

### 7. New-user first experience shows an expired sprint
- **What**: The initial state in `givelink.html` hard-codes `start:'2026-03-28', end:'2026-04-11'`. Any new user who opens the app for the first time (no localStorage) sees a sprint that ended 2+ months ago with 0 days left and a 100%-elapsed progress bar.
- **Where**: `givelink.html:437-438` (inside `let S = {sprint:{…}}`)
- **Why it matters**: The first impression is a dashboard showing "0 days left" and an overdue sprint — users who aren't Panos will be confused and may bounce.
- **Effort**: S
- **Suggested fix**:
  - Make the default sprint dates dynamic: compute `start = today`, `end = today + 14` using `new Date()` when `S` is initialized
  - Or: detect on `load()` that the end date is in the past and prompt "Your sprint has ended — start a new one?" before rendering

---

### 8. Standup generator "yesterday" filter is off by 1 day
- **What**: `generateStandup()` at `givelink.html:1488` sets `yesterday.setDate(now.getDate()-2)`, which is 2 days ago, not 1. The cutoff is then `yesterday.setHours(6,0,0,0)`, so it includes tasks completed from 6 AM two days ago. Tasks completed yesterday afternoon are included but tasks completed early this morning are excluded.
- **Where**: `givelink.html:1488`
- **Why it matters**: The standup's "Yesterday" section may omit tasks completed this morning or include tasks from the day before yesterday, producing an inaccurate summary.
- **Effort**: S
- **Suggested fix**:
  - Change `setDate(now.getDate()-2)` → `setDate(now.getDate()-1)` to look back exactly 1 calendar day
  - Consider using `startOfDay(yesterday)` (midnight) rather than 6 AM to capture all completions from the prior day

---

### 9. "Burndown chart" is actually a burn-up chart
- **What**: `renderBurndown()` at `givelink.html:754-775` plots tasks *done* (increasing Y axis) against time, not tasks *remaining* (decreasing). The ideal line goes from bottom-left to top-right. A burndown chart should show remaining work approaching zero.
- **Where**: `givelink.html:754-775` (especially `doneToY` at line 765 and ideal points at line 766)
- **Why it matters**: Sprint burn-down is the standard agile metric for detecting if the team will finish on time. The current visualization makes it impossible to see at a glance whether the sprint is at risk — you have to mentally invert the chart.
- **Effort**: S
- **Suggested fix**:
  - Rename to "Burn-Up Chart" (accurate as-is), or
  - Invert: track `remaining = total - done` instead of `done`, make `remaining → Y` map from top (start) to bottom (end), and update ideal line to go from `[pad, pad]` (total, start) to `[W-pad, H-pad]` (zero, end)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. Anthropic API key stored inside main app state object — synced to Supabase
- **What**: `S.claudeKey` is part of the core state object `S` (`index.html:8505-8506`). When Supabase sync runs, the entire `S` is serialised to the `data` column, including the API key. A future feature or accidental DB export leaks the key.
- **Where**: `index.html:8505-8506`, `index.html:8609` (upsert to Supabase)
- **Why it matters**: A secret key ending up in a cloud database row — even one protected by RLS — violates the principle of least privilege. Supabase service-role access or a future admin query can read it.
- **Effort**: M
- **Suggested fix**:
  - Store `claudeKey`, `readwiseKey`, and `notionKey` in a separate `localStorage` key (`taskos_credentials`) that is explicitly excluded from the Supabase sync payload
  - In the save-to-Supabase path, strip credential fields before serialising: `const payload = {...S}; delete payload.claudeKey; delete payload.readwiseKey;`

---

### 11. Two independent Anthropic fetch wrappers with divergent error handling
- **What**: `runAiSprintPlanner()` (`givelink.html:1131-1145`) implements its own full `fetch` against the Anthropic API with a `res.ok` check. `callClaudeGL()` at line 1256 does the same thing without the `res.ok` check. These will drift further apart over time.
- **Where**: `givelink.html:1097-1161` and `givelink.html:1256-1272`
- **Why it matters**: Bug fixes to one wrapper (like fixing P1 item #5 above) must be applied twice. The two wrappers also use different model defaults and key-lookup logic.
- **Effort**: S
- **Suggested fix**:
  - Refactor `runAiSprintPlanner` to call `callClaudeGL` (after fixing error handling in it)
  - Add a `model` parameter to `callClaudeGL` so callers can override; the sprint planner needs `claude-opus-4-5` while standup uses `claude-haiku-4-5-20251001`

---

### 12. `editNpId` not cleared when Escape closes CRM modal
- **What**: The `keydown` Escape handler at `givelink.html:879` sets `editId=null` but does not set `editNpId=null`. After using Escape to dismiss the CRM modal, `editNpId` retains the last edited nonprofit's ID. The next "Add Org" action opens the form with `editNpId` still set, and a Save will overwrite the old org instead of creating a new one.
- **Where**: `givelink.html:879`
- **Why it matters**: Silent data corruption: user clicks "Add Org", fills in details, hits Save, and the system updates an existing nonprofit record instead of creating a new one.
- **Effort**: S
- **Suggested fix**:
  - Add `editNpId=null;` to the Escape handler alongside `editId=null`
  - Also add it to `closeM()` if `id==='np-modal'`

---

### 13. Burndown snapshots only recorded on checkbox toggle, not on modal save
- **What**: `_recordSnapshot()` is called only from `toggleDone()` at `givelink.html:738`. Changing a task's status via the edit modal (Save button → `saveTask()`) does not call `_recordSnapshot()`.
- **Where**: `givelink.html:730` (`saveTask`), `givelink.html:738` (`toggleDone`)
- **Why it matters**: The burndown chart has gaps on days when tasks are completed via the modal (e.g., bulk status updates), making the chart artificially flat and misleading for sprint retrospectives.
- **Effort**: S
- **Suggested fix**:
  - Call `_recordSnapshot()` at the end of `saveTask()`, just before `save(); closeM('tm'); refresh()`

---

### 14. `index.html` is a single 872 KB file (~18 000 lines)
- **What**: The entire Task OS application — CSS, HTML structure, and all JavaScript for 20+ features — lives in one file. No build step, no modules, no separation of concerns.
- **Where**: `index.html` (whole file)
- **Why it matters**: A change to the CRM section requires shipping the full 872 KB file. Hot-reload is impossible. Merge conflicts on concurrent edits affect the entire codebase. The browser must parse the full file even on first load, adding ~300ms to time-to-interactive on mobile.
- **Effort**: L
- **Suggested fix**:
  - Introduce a minimal build step (e.g., Vite + vanilla JS modules) to split feature JS into `src/features/*.js` files that are bundled at deploy time
  - As a lighter first step: extract the `<style>` block to `style.css` (saves ~50 KB from the main parse path) and link it with `<link rel="stylesheet">`

---

## 💡 P3 — Nice to have

### 15. App color scheme (blue) doesn't match brand palette (purple/pink)
- **What**: Both apps use a blue accent (`#3b82f6` in givelink.html, `#58a6ff` in index.html). The Givelink brand palette is purple (`#6B3FA0` / `#5718CA`) and pink (`#C2185B` / `#E353B6`). No brand colors appear in any CSS.
- **Where**: `givelink.html:17` (`--accent:#3b82f6`), `index.html:22` (`--accent:#58a6ff`)
- **Why it matters**: Internal tools can deviate from brand, but if shared with nonprofits or investors as a demo, the product looks inconsistent with marketing materials. The no-pink-on-purple rule can't be validated because neither color is used.
- **Effort**: M
- **Suggested fix**:
  - Update `--accent` in `givelink.html` to `#5718CA` (brand purple) and replace the `#3b82f6` references in progress bars, pillar colors, and badges
  - Audit for any instances where pink badges appear on purple backgrounds (e.g., `--pr:#f472b6` pillar color used on top of purple cards)

---

### 16. `execCommand('copy')` deprecated clipboard fallback
- **What**: `givelink.html:1521` and `index.html:9830` use `document.execCommand('copy')` as a clipboard fallback when `navigator.clipboard` fails. `execCommand` is deprecated and will be removed in future browser versions.
- **Where**: `givelink.html:1521`, `index.html:9830`
- **Why it matters**: Low risk today, but future Chrome/Firefox versions may break the copy fallback silently, with no error visible to users.
- **Effort**: S
- **Suggested fix**:
  - Replace the `execCommand` fallback with a visible "Copy failed — select text manually" message, since `navigator.clipboard` is now supported in all modern browsers
  - The main `navigator.clipboard.writeText()` call already exists; the fallback only triggers in non-secure contexts (which shouldn't happen on a deployed HTTPS site)

---

### 17. Service worker cache key is a hardcoded date string
- **What**: `sw.js:1` sets `const CACHE = 'task-os-20260530'`. Cache busting requires manually updating this string before every deploy.
- **Where**: `sw.js:1`
- **Why it matters**: If the cache key is not bumped when assets change, users may serve stale HTML/JS from cache while the server has a new version. The update banner mitigates this but relies on the SW detecting a change — which won't happen if the SW file itself is cached with the old name.
- **Effort**: S
- **Suggested fix**:
  - Inject the cache key at build/deploy time (e.g., using a Vercel build command that `sed`s the date into `sw.js`)
  - Or use a hash of the files rather than a date: `const CACHE = 'task-os-' + BUILD_HASH`
  - Minimal fix: add a comment above the constant flagging it must be bumped manually on deploy

---

_Total: 17 items across 4 tiers. Items within each tier are ordered by ROI (highest first)._
