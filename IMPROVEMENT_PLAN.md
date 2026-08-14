# Givelink Codebase Improvement Plan

_Generated: 2026-08-14_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `givelink.html` — `load()` crashes on corrupt localStorage
- **What**: `JSON.parse(d)` runs without try/catch; any corrupt storage entry silently crashes the entire Sprint Board on load.
- **Where**: `givelink.html:448`
- **Why it matters**: If a user's localStorage gets even slightly malformed (e.g. partial write, storage quota exceeded mid-save), the app becomes completely unusable with no error message.
- **Effort**: S
- **Suggested fix**:
  - Wrap the parse in try/catch and fall back to defaults, matching the pattern already in `index.html:2598`:
    ```js
    function load(){const d=localStorage.getItem('givelink_sprint');if(d)try{const p=JSON.parse(d);S={...S,...p};}catch(e){console.warn('Corrupt sprint data, using defaults',e);}}
    ```

---

### 2. `givelink.html` — Standup "Yesterday" window is off by 1 day
- **What**: `yesterday.setDate(now.getDate()-2)` sets the lookback window to 48 hours ago, skipping tasks completed yesterday entirely.
- **Where**: `givelink.html:1488`
- **Why it matters**: Every daily standup generated will show "Nothing completed yet" for yesterday even when tasks were completed, making the AI-generated standup useless.
- **Effort**: S
- **Suggested fix**:
  - Change `-2` to `-1`:
    ```js
    yesterday.setDate(now.getDate()-1);
    ```

---

### 3. `sw.js` — Push notification icon path is broken
- **What**: Push notifications reference `./icons/icon-192.png` (and `badge`) but no `icons/` subdirectory exists; the files are at `./icon-192.png`.
- **Where**: `sw.js:48-49`
- **Why it matters**: All push notifications (task reminders, standup nudges) render without an icon/badge on every platform.
- **Effort**: S
- **Suggested fix**:
  - Fix both paths:
    ```js
    icon: './icon-192.png',
    badge: './icon-192.png',
    ```

---

### 4. `givelink.html` — Nonprofit CRM modal Delete/Log/Advance buttons disappear
- **What**: The NP modal's inner HTML (including Delete, Log Activity, and Next Stage buttons) is generated once with the `editNpId` state baked in at creation time. If the modal was first opened in "Add" mode (`editNpId=null`), those buttons never appear in subsequent Edit sessions.
- **Where**: `givelink.html:1358–1387` (`_showNPModal`)
- **Why it matters**: Users who open "Add Org" before ever editing an org lose access to Delete, Log Activity, and Advance Stage permanently until page reload — breaking core CRM operations.
- **Effort**: M
- **Suggested fix**:
  - Move the footer button group into a separate element that's regenerated each call:
    ```js
    // After the `if(!m)` block, always update the footer:
    document.getElementById('npm-footer').innerHTML = editNpId
      ? `<button class="btn bd" onclick="deleteNP()">Delete</button>
         <button class="btn bg" onclick="logActivityNP()">📝 Log Activity</button>
         <button class="btn bg" onclick="advanceStageNP()">→ Next Stage</button>
         <button class="btn bp" onclick="saveNP()">Save</button>`
      : `<button class="btn bp" onclick="saveNP()">Save</button>`;
    ```
  - Or simply destroy and recreate the modal each call (simpler, avoids stale-state bugs entirely).

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. `givelink.html` — API key collected via `window.prompt()` and stored in plaintext localStorage
- **What**: `getApiKey()` calls `prompt('Enter your Anthropic API key:')` and saves it to `localStorage`. The `callClaudeGL()` utility also falls back to `window.prompt()`. The key is then visible in DevTools → Application → localStorage to anyone with a moment at the keyboard.
- **Where**: `givelink.html:1086` (`getApiKey`), `givelink.html:1261` (`callClaudeGL`)
- **Why it matters**: Native `prompt()` looks broken in PWA standalone mode on iOS/Android. Storing an API key in localStorage exposes it to any XSS or browser extension. The production proxy (`/api/claude`) already exists but is unused here.
- **Effort**: M
- **Suggested fix**:
  - Route all givelink AI calls through `/api/claude` (same as `index.html:5007–5033`).
  - If a proxy URL isn't configured, surface a settings panel (not `prompt()`) where users can paste their key.
  - Remove direct-browser calls with `anthropic-dangerous-direct-browser-access: true`.

---

### 6. `givelink.html` — AI Sprint Planner bypasses the existing server proxy
- **What**: `runAiSprintPlanner()` sends requests directly to `https://api.anthropic.com/v1/messages` with the user's API key exposed in the Authorization header, fully visible in DevTools Network.
- **Where**: `givelink.html:1131–1144`
- **Why it matters**: The proxy in `api/claude.js` was built precisely to avoid this. Any user with DevTools open can extract the API key during an AI Planner call. `index.html` correctly uses the proxy; `givelink.html` does not.
- **Effort**: M
- **Suggested fix**:
  - Replace the direct `fetch('https://api.anthropic.com/v1/messages', ...)` call with a call to `/api/claude`, passing the same `{ prompt, max_tokens }` body.
  - Reuse the `callClaudeGL()` utility (once it also routes through the proxy).

---

### 7. `api/claude.js` — No rate limiting; single user can exhaust the API budget
- **What**: The proxy has a comment ("For production add per-user rate limiting (e.g. Upstash)") but no implementation. There is no per-user throttle, request count check, or spend cap.
- **Where**: `api/claude.js:12–13`
- **Why it matters**: A single user (or a misconfigured loop) can drain the Anthropic API quota/budget. At scale, this is a financial risk, not a theoretical one.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (free tier): one `@upstash/ratelimit` check on the Supabase user ID before proxying.
  - Alternatively, cap with a simple in-memory counter per cold-start (sufficient for low-traffic).
  - Set a `max_tokens` guard at the proxy level (already done at 2000, but model-specific caps should be checked).

---

### 8. `givelink.html` — Delete confirmation uses native `confirm()` (broken in PWA)
- **What**: `delCur()` uses `confirm('Delete?')` to gate task deletion; `deleteNP()` uses `confirm('Delete this org?')`.
- **Where**: `givelink.html:732`, `givelink.html:1424`
- **Why it matters**: `window.confirm()` is suppressed or styled-away in PWA standalone mode on Android, meaning the delete confirmation either silently never fires or fires without the user seeing a prompt. `index.html` already has a `showConfirm()` helper.
- **Effort**: S
- **Suggested fix**:
  - Copy `showConfirm()` from `index.html` (or import a shared utility) and replace both `confirm()` calls with it.

---

### 9. `givelink.html` — `logActivityNP()` uses `window.prompt()` for free-text input
- **What**: Logging a CRM activity calls `window.prompt('Log activity (what happened?):')` — same PWA / UX issues as `confirm()`.
- **Where**: `givelink.html:1431`
- **Why it matters**: On iOS PWA, `prompt()` shows but the keyboard and overlay interact poorly. This is the primary CRM data-entry path.
- **Effort**: S
- **Suggested fix**:
  - Add a small inline text field inside the NP modal for activity notes, with a "Log" button — no separate popup needed.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `givelink.html` — Shallow state merge loses nested defaults on upgrade
- **What**: `S={...S,...p}` in `load()` is a shallow merge — if a new key is added to the default `S` but a user's saved data doesn't include it, it's lost after load because the spread overwrites nested objects.
- **Where**: `givelink.html:448`
- **Why it matters**: Every time a new feature adds a field to the default state (e.g. `snapshots`, `nonprofits`), existing users will have `undefined` there until a page reload without cached data. Already partially defended by `if(!S.nonprofits)S.nonprofits=[];` sprinkled around the code, but fragile.
- **Effort**: S
- **Suggested fix**:
  - Use a explicit migration/defaults pattern:
    ```js
    const parsed = JSON.parse(d);
    S = { ...S, ...parsed, snapshots: parsed.snapshots || [], nonprofits: parsed.nonprofits || [] };
    ```

---

### 11. `givelink.html` — Pillar view filter state lost on every nav click
- **What**: `renderPillar(p)` rebuilds the entire view HTML (including filter tabs) from scratch on every navigation. Any active filter the user selected is silently reset.
- **Where**: `givelink.html:550–577`
- **Why it matters**: A user filtering "In Progress" tasks in the Nonprofits pillar, clicking away, and coming back loses their filter with no indication it was reset.
- **Effort**: M
- **Suggested fix**:
  - Store active filter per pillar in the state: `S.pillarFilters = {}` and read it when rendering the active tab.

---

### 12. `givelink.html` — Task list shows raw priority key instead of label
- **What**: `taskHTML` (line 666) renders `${t.priority||'medium'}` (lowercase raw value: "high", "medium", "low"), while `goalHTML` (line 636) correctly uses `STATUS[t.status]?.l` pattern.
- **Where**: `givelink.html:666`
- **Why it matters**: Task list badges show lowercase "high"/"medium"/"low" while goal badges show capitalized "High"/"Medium"/"Low" — inconsistency is noticeable.
- **Effort**: S
- **Suggested fix**:
  - Change to `PRI[t.priority]?.l||'Medium'` to match the existing `PRI` map.

---

### 13. `givelink.html` — Dynamically created modals not covered by Escape-key handler
- **What**: The `keydown` handler (line 876) runs `document.querySelectorAll('.mo:not(.hidden)')` at load time, but the NP modal, Standup modal, and Outreach modal are created dynamically with `document.createElement`. They're appended to `<body>` after the handler is registered, but the handler's selector will still work at event time since it's re-queried on each keypress. However, the `closeM()` call also resets `editId=null` but not `editNpId=null`, leaving stale CRM state after Escape.
- **Where**: `givelink.html:874–879`
- **Why it matters**: After pressing Escape to close the NP modal, `editNpId` still holds the old org ID, so reopening "Add Org" may accidentally populate the wrong org's data.
- **Effort**: S
- **Suggested fix**:
  - In `closeM()`, reset both `editId=null` and `editNpId=null`.
  - Or give each modal's close button `onclick="closeM('np-modal');editNpId=null;"`.

---

### 14. `api/claude.js` — Proxy `max_tokens` hard cap at 2000 truncates longer AI responses
- **What**: `Math.min(parseInt(body.max_tokens) || 1000, 2000)` — callers requesting more than 2000 tokens are silently capped.
- **Where**: `api/claude.js:35`
- **Why it matters**: Claude Haiku 4.5 supports up to 8192 output tokens. AI Sprint Planner responses or standup generation with large backlogs may get cut off, returning incomplete JSON that breaks parsing.
- **Effort**: S
- **Suggested fix**:
  - Raise to match the model's limit: `Math.min(parseInt(body.max_tokens) || 1000, 8192)`.
  - Log a warning when a caller asks for more than the cap.

---

## 💡 P3 — Nice to have

### 15. Brand palette mismatch across files
- **What**: `givelink.html` uses `--accent: #3b82f6` (blue); `landing.html` and `index.html` use `#5a49e0`/`#8272f2` (purple-indigo). Neither matches the documented brand palette (purple #6B3FA0/#5718CA, pink #C2185B/#E353B6).
- **Where**: `givelink.html:17`, `landing.html:49`, `index.html:47`
- **Why it matters**: The Sprint Board reads as a completely different product from the Givelink landing page/main app. Inconsistent accent colors undermine trust in a B2B context.
- **Effort**: M
- **Suggested fix**:
  - Decide on one accent token, update `:root` in each file. Consider `--accent: #5718CA` for all files.
  - The pink (`#C2185B`/`#E353B6`) should only appear for accents on non-purple backgrounds per the no-pink-on-purple rule.

---

### 16. `sw.js` — Service Worker cache is keyed to a hardcoded date
- **What**: `const CACHE = 'arete-20260723'` must be manually bumped on every deploy to invalidate stale HTML. There's no automated version tie-in.
- **Where**: `sw.js:1`
- **Why it matters**: If the cache name isn't updated, returning PWA users will serve stale HTML after deploys.
- **Effort**: S
- **Suggested fix**:
  - Replace with a build-time injected hash (e.g. via Vercel build step), or add a deploy hook that bumps the date in `sw.js` automatically.

---

### 17. `index.html` — `aiProxy` left empty; AI features silently fail for new users
- **What**: `APP_CONFIG.aiProxy` is set to `''` in the production config. Users without a Claude API key get a toast error with no actionable path to resolution.
- **Where**: `index.html:9959`
- **Why it matters**: New users who click any AI feature (day planning, inbox triage, AI commands) hit a dead end. First impressions are disproportionately important for trial conversion.
- **Effort**: M
- **Suggested fix**:
  - Populate `aiProxy` with the deployed `/api/claude` URL, or add a Settings onboarding step that walks new users through getting an API key.
  - Show a distinct "Set up AI →" CTA instead of a generic toast when the key/proxy is missing.

---

### 18. `givelink.html` — Burndown chart uses fixed pixel coordinates in SVG
- **What**: The SVG `width="280"` is hardcoded but `style="width:100%"` is applied, creating a mismatch between the coordinate space and display size on larger screens.
- **Where**: `givelink.html:763–774`
- **Why it matters**: On desktop-wide content areas the chart looks correct but on very wide screens the polyline points are compressed into the left portion.
- **Effort**: S
- **Suggested fix**:
  - Add a `viewBox="0 0 280 100"` attribute to the SVG so it scales correctly regardless of container width.

---

### 19. `givelink.html` — `renderVelocityStats()` appends to stats element instead of replacing
- **What**: `el.innerHTML +=` appends new velocity stat cards each time; `renderOverview()` pre-populates the element before calling `renderVelocityStats()`. If anything calls `renderVelocityStats()` independently, cards duplicate.
- **Where**: `givelink.html:1551`
- **Why it matters**: Any future refactor that calls `renderVelocityStats()` independently (e.g. a refresh button) will double the stat cards. Low risk now but a latent bug.
- **Effort**: S
- **Suggested fix**:
  - Append into a dedicated sub-container: `<div id="ov-velocity"></div>` placed inside `ov-stats`, so velocity stats have their own clear target.

---

### 20. `givelink.html` — Seed data (100+ tasks) ships in production code
- **What**: The `seed()` function hardcodes ~100 Givelink-specific tasks and 6 CRM nonprofits. This is a personal productivity tool so the seed makes onboarding instant, but the full org/person names, contact notes ("Meet w/ immigration specialist"), and deal details are visible in the source.
- **Where**: `givelink.html:883–1072`, `givelink.html:1281–1291`
- **Why it matters**: If givelink.html is ever public-facing (published to the Vercel deployment), company operational data is in the HTML source.
- **Effort**: M
- **Suggested fix**:
  - Strip personally identifying details from the seed (keep structure, anonymize names/notes).
  - Move seed data to a separate JSON file that's gitignored and loaded at runtime, or gate it behind a `?dev` query param.
