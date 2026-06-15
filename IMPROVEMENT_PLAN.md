# Task OS / Givelink OS — Improvement Plan
_Generated: 2026-06-15_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP blocks Google Fonts — Inter never loads on Vercel
- **What**: The `vercel.json` CSP forbids external stylesheets and fonts from Google, so Inter is silently blocked and the app falls back to system fonts in production.
- **Where**: `vercel.json:14`, `index.html:12-14`
- **Why it matters**: Every Vercel-hosted user sees the fallback system font stack, not the designed Inter typeface — a visible brand/polish degradation on every page load.
- **Effort**: S
- **Suggested fix**:
  - Add `https://fonts.googleapis.com` to `style-src` in vercel.json
  - Add `https://fonts.gstatic.com` to `font-src`
  - Resulting CSP fragment: `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;`

### 2. Claude API key included in plaintext JSON export
- **What**: `exportData()` serialises the entire `S` state object — including `S.claudeKey` — into the downloaded backup file.
- **Where**: `index.html:2108-2113`, state definition `index.html:2036`
- **Why it matters**: Any shared, emailed, or cloud-stored backup exposes the API key. One leaked file means an attacker can run arbitrary Claude calls on the owner's account.
- **Effort**: S
- **Suggested fix**:
  - Strip sensitive keys before export: `const {claudeKey, ntfy, ...safe} = S; blob = JSON.stringify(safe)`
  - Show a one-time warning if the user imports a file that _contains_ a `claudeKey` field, offering to ignore it

### 3. XSS: task/goal titles interpolated raw into `innerHTML`
- **What**: Three `innerHTML` assignments in the Weekly Review wizard insert `${t.title}` and `${g.title}` without calling the existing `esc()` helper. Additional unescaped render sites exist in capture and bucket views.
- **Where**: `index.html:2888`, `2895`, `2897` (weekly review wizard); `2630`, `2694`, `2744`, `2776` (task list renders); `esc()` defined at `9773`
- **Why it matters**: AI-extracted tasks (via `aiExtractTasksFromNotes` or `aiCategorizePaste`) can include HTML fragments returned by Claude. A title like `<img src=x onerror=fetch(…)>` gets stored in `S.tasks` and executes on the next render. Same risk from imported backup files.
- **Effort**: S
- **Suggested fix**:
  - Replace every `${t.title}` / `${g.title}` in innerHTML strings with `${esc(t.title)}` / `${esc(g.title)}`
  - Grep command to find all remaining sites: `grep -n '\${[a-z]\+\.title}' index.html | grep -v 'esc('`
  - Consider a lint rule or pre-commit hook to enforce esc() usage in innerHTML contexts

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Service worker cache key is a hardcoded date — deploy-and-forget breakage
- **What**: `sw.js` uses `const CACHE = 'task-os-20260530'` — a static string that must be manually bumped on every deploy or PWA users stay on stale cached content indefinitely.
- **Where**: `sw.js:1`
- **Why it matters**: If a deploy ships a bug fix but the cache key is not bumped, installed PWA users never receive the update. The developer has deployed 4 commits this week alone — one forgotten bump means stale bugs in production.
- **Effort**: S
- **Suggested fix**:
  - Replace the hardcoded date with a build-time injection: `const CACHE = 'task-os-__BUILD_HASH__'` and add a Vercel build step that substitutes the value
  - Simpler alternative: use a Vercel env var (`process.env.VERCEL_GIT_COMMIT_SHA`) as the cache buster via a build script that rewrites sw.js before deploy

### 5. Brand identity: Givelink colors not applied to the Givelink dashboard
- **What**: `givelink.html` uses `--accent:#3b82f6` (Tailwind blue) and `index.html` uses `--accent:#58a6ff` (GitHub blue). The Givelink brand palette (purple `#6B3FA0`/`#5718CA`, pink `#C2185B`/`#E353B6`) is not applied anywhere. The pink `--pr:#f472b6` in `givelink.html:18` is a different, unspecified pink.
- **Where**: `givelink.html:15-20`, `index.html:21-22`
- **Why it matters**: The Givelink dashboard looks like a generic dev tool, not a product being built for nonprofits. Every demo or screenshot to investors/partners shows the wrong brand. The no-pink-on-purple rule is also unenforced because purple isn't used as a background anywhere.
- **Effort**: M
- **Suggested fix**:
  - In `givelink.html`: change `--accent` to `#5718CA` (brand purple), `--gr` to the appropriate success green, and add `--brand-pink:#E353B6` for accent highlights
  - In the main `index.html` givelink section (the "Givelink OS" view), apply the same brand vars to Givelink-specific cards and the category badge (`--cg:#cc5de8` is close but off-brand)
  - Enforce the no-pink-on-purple rule: never place `#E353B6`/`#C2185B` text directly on `#5718CA`/`#6B3FA0` backgrounds

### 6. No AI response streaming — users wait 5–10 s staring at blank output
- **What**: `callClaude()` waits for the full response before rendering. Several calls request up to 1,500 tokens — at Haiku speeds that's a 6–10 second blank modal with only a spinner.
- **Where**: `index.html:4133-4149` (`callClaude`), longest waits at `6755` (1500 tokens), `9430` (800 tokens), `9527` (900 tokens)
- **Why it matters**: Users click AI buttons repeatedly thinking nothing happened (the `_aiLock` guards this but doesn't make the wait feel shorter). Streaming would show the first words in under a second.
- **Effort**: M
- **Suggested fix**:
  - Add a streaming variant `callClaudeStream(prompt, maxTokens, onChunk)` using the `stream: true` flag and `ReadableStream` parsing
  - Wire it to the `showAiOut` modal to append text as chunks arrive
  - Start with the highest-latency calls: `aiSuggestDecisions` (1500 tokens) and the AI Workflows runner

### 7. Default profile name is hardcoded to "Panos" — first-run UX breaks for every new user
- **What**: `let profileName = localStorage.getItem('taskos_name') || 'Panos'` means first-time users see "Good morning, Panos 👋" on the dashboard.
- **Where**: `index.html:2038`, greeting render at `2480`
- **Why it matters**: Instantly signals to anyone who isn't Panos that this is a personal fork, not a shareable tool — blocks any demo or onboarding flow.
- **Effort**: S
- **Suggested fix**:
  - Add a one-time name prompt in the existing onboarding flow (already seeded: `seededV2`, `seededGoalsV3` flags exist)
  - If no name is stored, show "Good morning 👋" without a name and prompt once: "What should we call you?"

### 8. `importData()` merges blindly — corrupted or crafted file overwrites sensitive config
- **What**: `importData()` validates only that `d.tasks` is an array, then does `Object.assign(S, d)` — overwriting `claudeKey`, `ntfy.topic`, and Supabase config without any field-level validation.
- **Where**: `index.html:2115-2126`
- **Why it matters**: An import from a shared backup or a malformed file could silently replace the Claude API key or push notification config. The user would only notice later when AI features or notifications stop working.
- **Effort**: S
- **Suggested fix**:
  - Preserve sensitive in-memory values during import: `const {claudeKey, ntfy, ...incoming} = d; Object.assign(S, incoming);`
  - Add a basic schema check: verify `d.goals` is array, `d.reviews` is array — reject and toast on failure rather than partial merge

### 9. Silent swallowed errors after Supabase sync leave UI stale
- **What**: After pulling remote state, `try{refresh();}catch(e){}` silently ignores any render failure, leaving the UI showing pre-sync data with no feedback.
- **Where**: `index.html:8624`
- **Why it matters**: If `refresh()` throws (e.g. after a schema migration adds a new field that a render function doesn't handle), the data is in localStorage but the UI shows the wrong state. The user has no indication anything went wrong.
- **Effort**: S
- **Suggested fix**:
  - Change to: `try{refresh();}catch(e){toast('⚠️ Sync applied but UI refresh failed — reload to see changes');console.warn('post-sync refresh failed',e);}`

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. One-file, 12,893-line monolith — high regression risk on every edit
- **What**: The entire application — HTML, CSS (≈900 lines), and JS (≈11,500 lines) — lives in `index.html`. Every commit touches the same file; 4 bug-fix commits this week all modified `index.html`.
- **Where**: `index.html` (entire file)
- **Why it matters**: Any edit in an unrelated section can break existing features. Recent pattern: commits titled "Fix 4 bugs" and "Fix 3 bugs in Givelink dashboard" suggest regression churn. The file is too large for any linter, formatter, or tree-shake to operate on.
- **Effort**: L
- **Suggested fix**:
  - Phase 1 (quick win): Extract CSS into `style.css` and `<link>` it — reduces HTML by ~1,000 lines
  - Phase 2: Extract JS into `app.js` with a `<script src="app.js">` — enables ESLint, Prettier, and bundlers
  - Phase 3: Break JS into ES modules (`tasks.js`, `claude.js`, `sync.js`, etc.) with Vite as the build tool

### 11. Hardcoded model version will break all AI features on model deprecation
- **What**: `callClaude()` hardcodes `'claude-haiku-4-5-20251001'` — a specific dated version alias.
- **Where**: `index.html:4139`
- **Why it matters**: When Anthropic deprecates this model alias, every AI feature in the app returns a 404/model-not-found error. The user will see broken AI with no explanation until the code is updated.
- **Effort**: S
- **Suggested fix**:
  - Replace with the evergreen alias `'claude-haiku-4-5'` which tracks the latest Haiku patch
  - Or add a model selector in Settings so the user can upgrade to Sonnet/Opus for higher-quality outputs on complex prompts

### 12. Some AI functions bypass the `_aiLock` / `_aiBtn` guard, risking concurrent calls
- **What**: Two render sites use manual `btn.disabled = true` / `btn.textContent = '⏳'` patterns instead of the standard `_aiBtn(this, fn)` wrapper, bypassing the global `_aiInFlight` Set.
- **Where**: `index.html:5051-5058` (tweet generator), also inline onclick handlers that call `callClaude()` directly
- **Why it matters**: If a user clicks one of these unguarded buttons twice quickly, two concurrent Claude calls fire — doubling token cost and potentially rendering conflicting results.
- **Effort**: S
- **Suggested fix**:
  - Convert the manual patterns at 5051-5058 to use `_aiBtn(this, fn)`
  - Grep for remaining raw `callClaude(` calls in onclick attributes: `grep -n 'onclick.*callClaude' index.html`

### 13. `anthropic-dangerous-direct-browser-access` exposes API key in DevTools
- **What**: `callClaude()` uses `'anthropic-dangerous-direct-browser-access':'true'` to bypass the CORS restriction on direct browser-to-Anthropic calls — which is by design for a personal tool — but the API key is visible in plain text in any browser's Network tab.
- **Where**: `index.html:4138`
- **Why it matters**: On a shared computer or during a screen share / demo, the API key is one "open DevTools" away from being seen. Combined with the export bug (P0 item 2), key exposure is a consistent risk.
- **Effort**: M
- **Suggested fix**:
  - For a personal tool: document the risk in a visible Settings note ("Your Claude key is stored in browser localStorage — do not use on shared devices")
  - Longer term: route Claude calls through a minimal Vercel Edge Function that reads the key from a server-side env var, removing the key from the browser entirely

### 14. Morning briefing rendered via `innerHTML` with AI-generated content
- **What**: The morning briefing fetches from Claude and inserts the result into `innerHTML` of `#briefing-body`, bypassing `textContent` safety.
- **Where**: `index.html:9527` (callClaude call), `~9430` (synthesis path), display at `9661`
- **Why it matters**: If the Claude model is prompted to include HTML (unlikely but possible with jailbreaks or crafted input), it executes in the page. More practically, Markdown from Claude (bold `**`, lists) isn't rendered and clutters the UI.
- **Effort**: S
- **Suggested fix**:
  - Replace `innerHTML` assignment with `textContent` for the raw AI text, or add a minimal Markdown-to-safe-HTML renderer (just `**bold**` → `<strong>`)

---

## 💡 P3 — Nice to have

### 15. No caching for repeated AI calls — daily picks and briefing re-fetch every reload
- **What**: `aiDailyPicks` and the morning briefing re-call Claude every time the dashboard loads, even if the data hasn't changed since the last call.
- **Where**: `index.html:6460` (`aiDailyPicks`), `9527` (morning briefing); cache check at `9661` exists for briefing only
- **Why it matters**: Wastes tokens and adds latency on every dashboard refresh. The briefing already has a date-keyed localStorage cache — daily picks should too.
- **Effort**: S
- **Suggested fix**:
  - Extend the existing briefing cache pattern to `aiDailyPicks`: store result keyed by `taskos_picks_YYYY-MM-DD` and skip the API call if today's cache exists

### 16. Supabase auto-snapshot fires on every device, creating duplicate history points
- **What**: `_autoSnapshot()` runs on every page load from every device, so a user who opens the app on two devices on the same day creates duplicate `givelinkHistory` entries.
- **Where**: `index.html:8643-8657`
- **Why it matters**: The Givelink Pace Engine reads `givelinkHistory` to calculate trends — duplicate daily snapshots skew the `MRR`, `pipeline`, and `arr` trend lines shown in the dashboard.
- **Effort**: S
- **Suggested fix**:
  - Check `localStorage.getItem('taskos_autosnap') === today` already exists (it does at line 8646) but the key is local-only — after a sync pull, another device won't know the first device already snapshotted
  - Fix: store the snapshot date in `S` (synced state) instead of localStorage: `if(S.lastAutoSnap === today) return;`

### 17. Supabase sync is push-only after the initial pull — multi-tab conflicts silently overwrite
- **What**: After initial `sbSyncNow()`, subsequent saves use `_sbScheduleSync()` which calls `sbPush()` only. A second browser tab pulling the same data can overwrite changes from the first tab.
- **Where**: `index.html:8633-8640`
- **Why it matters**: Using the app in two tabs (desktop + mobile Vercel PWA) is a common pattern. Last-write-wins with a 2.5-second debounce means rapid edits on one device are silently lost when the other device pushes.
- **Effort**: M
- **Suggested fix**:
  - Add a `BroadcastChannel` between tabs to coordinate writes, or use Supabase Realtime subscriptions to detect remote changes

### 18. No empty state for the "Work" → Givelink OS view on fresh install
- **What**: `renderGivelinkDash()` renders metrics and sprint board reading from `S.givelinkMetrics` (all zeros) and `S.goals` (empty). A fresh-install user sees a dashboard full of "0" and empty boards with no guidance.
- **Where**: `index.html` — `renderGivelinkDash` function (search by name; around line 8700+)
- **Why it matters**: First impression of the Givelink OS feature is a blank zero-state with no call to action.
- **Effort**: S
- **Suggested fix**:
  - Add a conditional: if all metrics are 0 and no goals exist, show a "Set up your Givelink OS" card with prompts to add the North Star goal and first sprint

### 19. `sw.js` icon references point to non-existent PNG paths
- **What**: Push notification handler at `sw.js:42` sets `icon: './icons/icon-192.png'` but the repo only has `icon.svg` and `icon-gl.svg` — no `/icons/` directory.
- **Where**: `sw.js:42`, `manifest.json` (icons reference only SVG)
- **Why it matters**: Push notifications on Android will show a blank/broken icon instead of the Task OS logo.
- **Effort**: S
- **Suggested fix**:
  - Either generate `icons/icon-192.png` and `icons/icon-512.png` from `icon.svg` and add them to the repo
  - Or update the `icon` path in `sw.js` to `'./icon.svg'` (SVG icons work in most modern notification implementations)

### 20. Hardcoded "Panos" in seeded task data surfaces in shared/demo installs
- **What**: Seed function includes personalized content like `'Smoothie morning recipe — optimize ingredients'` and other owner-specific tasks added via `rmk()`.
- **Where**: `index.html:4123` and surrounding seed block (around line 4060-4130)
- **Why it matters**: Low priority for a personal tool; becomes a problem if the codebase is ever open-sourced or shared as a template.
- **Effort**: S
- **Suggested fix**:
  - Genericize seed data or remove personal entries; make the seed data a template that references `profileName` instead of hardcoded names
