# Givelink Improvement Plan

Analyzed: `givelink.html` (1 756 lines), `index.html` (12 893 lines), `sw.js`, `vercel.json`, `supabase-setup.sql`.
No external dependencies — all logic lives in two monolithic single-file HTML apps.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `load()` crashes entire app on corrupted localStorage
- **What**: `JSON.parse()` in `load()` has no try/catch; a single bad byte in `givelink_sprint` storage silently kills the whole app on every load.
- **Where**: `givelink.html:448`
- **Why it matters**: Any user who hits a quota error, a partial write, or clears storage mid-session loses their entire sprint board permanently with no recovery path.
- **Effort**: S
- **Suggested fix**:
  - Wrap `JSON.parse(d)` in try/catch and fall back to the default `S` object on parse failure.
  - On failure, call `toast('Data error — starting fresh. Backup exported.')` and offer a raw-text export.
  - Mirror the same guard in `index.html` (identical pattern used throughout).

---

### 2. Nonprofit CRM modal: Delete / Log Activity / Advance Stage buttons permanently missing
- **What**: The `_showNPModal()` helper creates the modal HTML exactly once and bakes in `editNpId` via template literal at that moment. If the "Add Org" path (`openAddNP()`, which sets `editNpId = null`) runs before any edit, the three action buttons are never rendered into the DOM — and never will be, because the modal is cached.
- **Where**: `givelink.html:1358–1401` (`_showNPModal`, the `if(!m)` create block at ~1362)
- **Why it matters**: On a typical session the user opens "Add Org" before editing an existing nonprofit. From that point on, **Delete**, **Log Activity**, and **→ Next Stage** are permanently invisible. The CRM is effectively read-only.
- **Effort**: S
- **Suggested fix**:
  - After the `if(!m)` create block, always re-render the footer buttons section based on the current `editNpId`:
    ```js
    m.querySelector('.mf').innerHTML = `
      <div>${editNpId ? `<button class="btn bd" onclick="deleteNP()">Delete</button>` : ''}</div>
      <div style="display:flex;gap:8px;">
        ${editNpId ? `<button … onclick="logActivityNP()">📝 Log Activity</button>
        <button … onclick="advanceStageNP()">→ Next Stage</button>` : ''}
        <button class="btn bp" onclick="saveNP()">Save</button>
      </div>`;
    ```
  - This runs every time the modal is opened, not just at creation.

---

### 3. All AI features silently swallow HTTP errors
- **What**: `callClaudeGL()` (the shared AI utility) calls `await res.json()` without checking `res.ok` first. A 401 (bad API key), 429 (rate limit), or 529 (overloaded) response body is valid JSON from Anthropic but has no `content` field — so `data.content?.[0]?.text` returns `null` and the modal shows `"Could not generate. Check your API key."` with no indication of what went wrong.
- **Where**: `givelink.html:1263–1271` (`callClaudeGL`), also `runAiSprintPlanner` at line 1145 (has its own `res.ok` check, but the shared utility does not).
- **Why it matters**: Users with rate-limit errors get the same message as users with wrong keys. No retry UX, no error code shown. Standup generator and outreach drafts fail silently.
- **Effort**: S
- **Suggested fix**:
  - Add `if(!res.ok){ const err=await res.json().catch(()=>({error:{message:res.statusText}})); throw new Error(err?.error?.message||'HTTP '+res.status); }` before parsing.
  - Surface the status code in the toast: `toast('AI error ('+status+'): '+message)`.
  - For 429, show: `"Rate limited — wait 60s and try again."`.

---

### 4. Push notification icon is a 404
- **What**: `sw.js` references `'./icons/icon-192.png'` for both the notification icon and badge. That directory and file do not exist in the repository.
- **Where**: `sw.js:39–40`
- **Why it matters**: On browsers that show push notifications (Chrome Android, Chrome desktop), the notification silently fails to show an icon, which can cause the notification itself to be suppressed or look broken.
- **Effort**: S
- **Suggested fix**:
  - Either add an `icons/` directory with a 192×192 PNG export of `icon-gl.svg`, or point both fields at the existing `'./icon-gl.svg'` (SVG is supported as a notification icon in modern browsers).
  - Update `manifest-givelink.json` to list the same icon so the PWA and SW are consistent.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Entire Givelink UI uses blue — brand palette is purple/pink
- **What**: The CSS root defines `--accent:#3b82f6` (Tailwind blue-500) and `--theme-color` meta is `#3b82f6`. The brief specifies brand purple `#6B3FA0`/`#5718CA` and brand pink `#C2185B`/`#E353B6`.
- **Where**: `givelink.html:17–18`, `givelink.html:6` (meta theme-color)
- **Why it matters**: Every CTA button, active state, progress bar, and focus ring is off-brand. During the rebranding sprint this directly undermines the "Complete & Announce Rebranding" sprint goal.
- **Effort**: S
- **Suggested fix**:
  - Change `--accent` to `#5718CA` (primary purple).
  - Add `--accent2:#E353B6` (pink) for secondary accents (progress fills, pillar health chips).
  - Enforce the no-pink-on-purple rule: never use `--accent2` as text on a `--accent` background.
  - Update `<meta name="theme-color">` to `#5718CA`.

---

### 6. API key stored in `localStorage` and exposed via `window.prompt`
- **What**: `getApiKey()` prompts the user with `window.prompt('Enter your Anthropic API key:')` and stores the result in `localStorage('taskos_api_key')`. The key is then sent in request headers directly from the browser with `'anthropic-dangerous-direct-browser-access':'true'`.
- **Where**: `givelink.html:1075–1088`, `givelink.html:1131–1137`
- **Why it matters**: `localStorage` is accessible to any XSS payload. `window.prompt` is visually alarming to non-technical users and can be spoofed. Anthropic explicitly warns that browser-direct access should only be used in controlled/personal tools — leaking an Opus key would be costly.
- **Effort**: M
- **Suggested fix**:
  - Move the key entry to a proper settings modal with a masked `<input type="password">` field instead of `window.prompt`.
  - Consider using `sessionStorage` (cleared on tab close) rather than `localStorage` for the key.
  - Add a visible warning in the settings modal: "This key is stored locally and used only for AI features on this device."

---

### 7. Mobile bottom nav is missing 4 sections
- **What**: The 5-item bottom nav exposes Overview, Growth, Product, Execution, Backlog. The CRM, Nonprofits, Ops, and Past Sprints views have no mobile entry point other than the hamburger sidebar.
- **Where**: `givelink.html:306–312` (`.bnav`)
- **Why it matters**: On mobile, CRM is the second most important view after Overview for the nonprofit sales workflow. Requiring two taps (hamburger → nav item) adds friction to the highest-frequency daily action.
- **Effort**: M
- **Suggested fix**:
  - Replace the 5-item flat bar with a scrollable/swipeable bar or a "More" overflow item that opens a sheet with the remaining views.
  - Alternatively, swap Execution out of the bottom bar (lower daily frequency) for CRM.

---

### 8. Task cards and nav items are `<div>` elements — not keyboard accessible
- **What**: Every task card (`.tc2`), goal card (`.gc2`), pillar nav item (`.ni`), and filter tab (`.ftab`) uses `div onclick` or `span onclick` with no `role`, `tabindex`, or keyboard handler.
- **Where**: `givelink.html:33–36` (`.ni`), `givelink.html:61` (`.gc2`), `givelink.html:77` (`.tc2`), `givelink.html:568–572` (filter tabs)
- **Why it matters**: The app is completely keyboard-inaccessible. Tab navigation skips all task cards and nav items. Screen readers announce nothing useful. This is an ADA/WCAG 2.1 AA failure on the most core interactions.
- **Effort**: M
- **Suggested fix**:
  - Add `role="button" tabindex="0"` to `.ni`, `.gc2`, `.tc2` elements.
  - Add `onkeydown="if(e.key==='Enter'||e.key===' ')this.click()"` (or delegate via JS).
  - Use `<button>` elements for filter tabs — they already have the right semantics.

---

### 9. AI Sprint Planner uses unrecognized model ID `claude-opus-4-5`
- **What**: `runAiSprintPlanner()` hardcodes `model:'claude-opus-4-5'`. This model ID does not match any currently documented Anthropic model (`claude-opus-4-8`, `claude-opus-4-7`, etc.). API calls to invalid model IDs return a 400 error.
- **Where**: `givelink.html:1141`
- **Why it matters**: The AI Sprint Planner feature is completely broken for all users. The error surface goes to the catch block which shows a generic error message.
- **Effort**: S
- **Suggested fix**:
  - Change to `'claude-sonnet-4-6'` (current mid-tier) or `'claude-haiku-4-5-20251001'` (fastest, same as the shared utility).
  - Extract the model name to a `const CLAUDE_MODEL` at the top of the script so it only needs updating in one place.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `givelink.html` is a 1 756-line monolithic file
- **What**: All HTML structure, 200+ lines of CSS, and ~1 300 lines of JS live in a single file with no module system.
- **Where**: `givelink.html` (entire file)
- **Why it matters**: Adding a new feature requires scrolling through hundreds of unrelated lines to find the right function. Merge conflicts on concurrent edits touch the same file. No caching benefit — one CSS character change busts the entire JS cache.
- **Effort**: L
- **Suggested fix**:
  - Extract CSS to `givelink.css`, JS to `givelink.js`.
  - Split JS into logical modules: `data.js` (S object + persist), `crm.js`, `sprint.js`, `ai.js`.
  - This is a refactor, not a rewrite — the logic stays the same.

---

### 11. `seed()` function is 180+ lines of hardcoded task data
- **What**: `seed()` at line 882 contains ~180 lines of `mk()` call arguments — the initial sprint and backlog tasks, with real business details (contact names, email subjects, notes).
- **Where**: `givelink.html:882–1072`
- **Why it matters**: Business-sensitive info (email addresses, supplier names, grant deadlines) is committed to a public repo. The seed data is stale as soon as the sprint progresses. New developers must read 180 lines of data to understand app structure.
- **Effort**: M
- **Suggested fix**:
  - Move seed data to `seed-data.json` (or remove it entirely — after first run it's never called again due to the `S.seeded` guard).
  - At minimum, strip PII from the committed seed: remove real email addresses, supplier names, and grant URLs.

---

### 12. Content Security Policy allows `unsafe-inline` scripts and styles
- **What**: `vercel.json` sets `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'`. This defeats the XSS protection CSP is meant to provide.
- **Where**: `vercel.json:14`
- **Why it matters**: Any XSS vector (e.g., an unsanitized `esc()` bypass or a future template injection) can execute arbitrary scripts. The CSP header currently provides no meaningful protection.
- **Effort**: M
- **Suggested fix**:
  - Move all inline `<style>` blocks to `givelink.css` (enables `style-src 'self'` without `'unsafe-inline'`).
  - Move all inline `<script>` blocks to `givelink.js` (enables `script-src 'self'` without `'unsafe-inline'`).
  - Use a nonce-based CSP as an interim if full extraction is too slow: `script-src 'self' 'nonce-{random}'`.

---

### 13. CRM `daysSinceCRM()` returns `999` for orgs with no activity — treated as "overdue"
- **What**: `daysSinceCRM()` returns `999` when `lastActivityAt` is missing. The overdue filter is `d > 7`, so newly added orgs with no logged activity immediately appear overdue (red border, counted in the "Need Follow-up" stat).
- **Where**: `givelink.html:1294–1297`, used at `1306` and `1324`
- **Why it matters**: A freshly added nonprofit immediately looks overdue, creating false urgency and cluttering the "need follow-up" count.
- **Effort**: S
- **Suggested fix**:
  - Return `0` (not `999`) when `lastActivityAt` is missing, or use `createdAt` as the fallback activity timestamp.
  - The sentinel value `999` is a magic number — replace with `null` and handle the null case explicitly in the overdue check.

---

### 14. `renderBurndown()` generates invalid SVG when sprint has no snapshots history
- **What**: The ternary on line 771 — `(actualPts.length ? '<circle…/>' )` — has no `:else` branch. In JavaScript, a one-arm ternary evaluates to `undefined` on the false path. When concatenated into the SVG string, this injects the literal text `"undefined"` into the SVG markup.
- **Where**: `givelink.html:771`
- **Why it matters**: While the `snapshots.length < 2` early-return guard means this is only reachable with ≥ 2 snapshots, `actualPts` could still be empty if all snapshot dates pre-date the sprint start. The SVG then renders with `"undefined"` text visible in the chart area.
- **Effort**: S
- **Suggested fix**:
  - Change to a proper ternary: `(actualPts.length ? '<circle…/>' : '')`.

---

## 💡 P3 — Nice to have

### 15. SW update notification fires on `activated` state, not `installed`
- **What**: The service worker `updatefound` listener calls `showUpdateBanner()` when the new SW reaches `'activated'` state. By that point the new SW has already taken control — the banner is delayed or sometimes missed entirely.
- **Where**: `givelink.html:1722–1726`
- **Why it matters**: Users may not see the update notification, missing new features or bug fixes.
- **Effort**: S
- **Suggested fix**: Fire `showUpdateBanner()` on `'installed'` state and prompt the user to reload at that point (standard PWA update pattern).

---

### 16. "Close Sprint → New Sprint" has no confirmation and is irreversible
- **What**: `confirmNewSprint()` immediately archives the current sprint and moves all incomplete tasks to backlog with no undo path. A mis-click on "Start New Sprint →" loses sprint progress context permanently.
- **Where**: `givelink.html:820–848`
- **Why it matters**: Sprint closing is a rare but high-stakes action. The data loss is permanent (no recycle bin).
- **Effort**: S
- **Suggested fix**:
  - Add a second confirmation step: `confirm('Archive "${archive.name}" and start a new sprint? This cannot be undone.')`.
  - Or show a 5-second countdown in the modal footer before enabling the "Confirm" button.

---

### 17. README describes a different project structure than the actual repo
- **What**: `README.md` lists `style.css` and `script.js` in the project structure. Neither file exists; the actual code is in `givelink.html` and `index.html`.
- **Where**: `README.md:43–49`
- **Why it matters**: Misleading for any collaborator or new contributor trying to find the CSS or JS.
- **Effort**: S
- **Suggested fix**: Update the README tree to reflect: `index.html`, `givelink.html`, `sw.js`, `manifest.json`, `manifest-givelink.json`, `vercel.json`, `supabase-setup.sql`.

---

### 18. `window.prompt` used for activity logging in CRM
- **What**: `logActivityNP()` uses `window.prompt('Log activity (what happened?):')` for input, which is unstyled, can't be dismissed with the app's Escape handler, and is blocked on some mobile browsers.
- **Where**: `givelink.html:1431`
- **Why it matters**: Breaks keyboard flow; looks unprofessional; fails silently on iOS when the page is in a PWA standalone window with some browser security policies.
- **Effort**: S
- **Suggested fix**: Replace with a small inline text field that appears in the NP modal's footer when "Log Activity" is clicked, pre-focused, with a "Save Note" button.
