# Givelink Improvement Plan
> Generated 2026-08-28 | 20 items across 4 tiers

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. API key stored & prompted insecurely
- **What**: Anthropic API key is stored in `localStorage` as plaintext and collected via `window.prompt()` with the `anthropic-dangerous-direct-browser-access` header enabled for direct browser-to-API calls.
- **Where**: `givelink.html:1075–1087` (`getApiKey`), `givelink.html:1131–1138` (`runAiSprintPlanner`), `givelink.html:1257–1264` (`callClaudeGL`)
- **Why it matters**: Any script on the page (ads, injected third-party, XSS) can read `localStorage.taskos_api_key`. On iOS/mobile, `window.prompt()` is unreliable and freezes the UI. A single exfiltrated key runs up the Anthropic bill and exposes all AI features to abuse.
- **Effort**: M
- **Suggested fix**:
  - Route all AI calls through `/api/claude` (already deployed at `api/claude.js`) instead of calling `api.anthropic.com` directly from the browser — remove the `anthropic-dangerous-direct-browser-access` header entirely.
  - Replace `window.prompt()` key entry with the settings modal input that already exists in `index.html:2029`.
  - Stop storing the raw key in `localStorage`; store a session token from the proxy instead.

### 2. `callClaudeGL` silently swallows HTTP errors
- **What**: The shared AI helper function doesn't check `res.ok`, so 401/429/500 responses from Anthropic return `null` with no user feedback.
- **Where**: `givelink.html:1264–1271` (`callClaudeGL`)
- **Why it matters**: When the API key is invalid or rate-limited, standup generation and outreach drafting silently fail — the loading indicator disappears and nothing happens. Users think the feature is broken, not that auth failed.
- **Effort**: S
- **Suggested fix**:
  - Add `if(!res.ok){const e=await res.json().catch(()=>({}));toast('AI error: '+(e.error?.message||res.status));return null;}` after `const res=await fetch(...)`.
  - Mirror the pattern already used in `runAiSprintPlanner` (line 1145).

### 3. `load()` in Givelink has no try/catch around `JSON.parse`
- **What**: If `givelink_sprint` in localStorage is corrupted (truncated save, manual edit), the app crashes on load with an uncaught `SyntaxError`.
- **Where**: `givelink.html:448`
- **Why it matters**: A crash on startup means the app is completely unusable — all sprint data appears lost. The index.html version of `load()` already has this guard (line 2598).
- **Effort**: S
- **Suggested fix**:
  - Wrap parse in `try/catch`: `function load(){const d=localStorage.getItem('givelink_sprint');if(d)try{const p=JSON.parse(d);S={...S,...p};}catch(e){console.warn('Corrupt sprint data, resetting',e);}}`

### 4. Standup generator "yesterday" cutoff is 2 days ago, not 1
- **What**: `yesterday.setDate(now.getDate()-2)` means tasks completed yesterday (1 day ago) are excluded from the "Yesterday" block.
- **Where**: `givelink.html:1488`
- **Why it matters**: The standup will always report nothing completed yesterday even when work was done, making the AI output consistently wrong and undermining trust in the feature.
- **Effort**: S
- **Suggested fix**:
  - Change `now.getDate()-2` to `now.getDate()-1`.
  - Also set hours to `0,0,0,0` only on the yesterday cutoff (already done) — the intent is midnight yesterday, so `-1` gives the correct start-of-yesterday boundary.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. `window.prompt()` for API key breaks mobile UX
- **What**: `callClaudeGL` (and `getApiKey`) falls back to `window.prompt()` to collect the API key if not found in storage.
- **Where**: `givelink.html:1086`, `givelink.html:1261`
- **Why it matters**: `window.prompt()` is blocked by default in cross-origin iframes, unreliable on iOS Safari in standalone mode, and jarring in a polished UI — it breaks the "feels like a real app" perception at the exact moment a user tries their first AI feature.
- **Effort**: S
- **Suggested fix**:
  - If key not found, show a toast with a link to settings: `toast('Set your API key in Settings to use AI features.')` and bail early — don't prompt.
  - The settings input (`index.html:2029`) already handles key entry; add an equivalent in Givelink's Sprint Settings modal.

### 6. AI Sprint Planner "Generate" button stays disabled on error
- **What**: After an API error in `runAiSprintPlanner`, `genBtn.disabled=false` runs correctly but `genBtn.textContent` changes to "✨ Regenerate" — however the button is only re-enabled on the `finally` path that doesn't exist; the code runs this after both success and error, so this is actually okay. But the error state renders inline with no retry affordance in the button row.
- **Where**: `givelink.html:1157–1160`
- **Why it matters**: After a network hiccup, users see a red error message but the "Generate" button label changes to "Regenerate" — the intent is unclear and the error message is clipped in the modal body with no contrast against the dark background.
- **Effort**: S
- **Suggested fix**:
  - Wrap the error in a styled card: `background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:8px;padding:12px;`.
  - Add a "Retry" button inside the error block rather than relying on the header button rename.

### 7. Givelink accent color is blue (#3b82f6), not brand purple
- **What**: Givelink's entire UI uses `--accent:#3b82f6` (blue) while the brand palette is purple (`#6B3FA0`/`#5718CA`).
- **Where**: `givelink.html:17` (CSS root vars), `givelink.html:6` (theme-color meta tag)
- **Why it matters**: Givelink and Task OS/Arete look like different products from different companies. Brand coherence builds trust, especially when sharing links or showing to nonprofit partners.
- **Effort**: M
- **Suggested fix**:
  - Replace `--accent:#3b82f6` with `--accent:#5718CA` and `--accent-dim:rgba(87,24,202,.15)`.
  - Update `meta name="theme-color"` to `#5718CA`.
  - Update `--prog:#3b82f6` (in-progress status color) to `#5718CA` or keep it semantically distinct as `#6366f1`.

### 8. Backlog filter state / active tab mismatch on return navigation
- **What**: `S.blFilter` persists across navigations, but the active CSS class on filter tabs is set statically on initial HTML render (`class="ftab active"` on "All"), so returning to Backlog shows the wrong tab as active when a non-"all" filter was previously set.
- **Where**: `givelink.html:289–295` (static HTML), `givelink.html:587–592` (`setBLFilter`)
- **Why it matters**: Users see tasks filtered one way but the "All" tab appears highlighted — confusing, especially when they notice missing tasks.
- **Effort**: S
- **Suggested fix**:
  - In `renderBacklog()`, sync the active tab to `S.blFilter`: after rendering, call `document.querySelectorAll('#bl-filters .ftab').forEach(t=>t.classList.toggle('active',t.textContent.toLowerCase().includes(S.blFilter==='all'?'all':S.blFilter)))`.

### 9. No loading state on Standup and Outreach modals after first open
- **What**: After a modal is opened once and then closed/reopened, the body still shows the previous response, and clicking "Regenerate" only shows the update after completion — no spinner or "generating" state is shown.
- **Where**: `givelink.html:1484–1516` (`generateStandup`), `givelink.html:1632–1667` (`generateOutreach`)
- **Why it matters**: On slow connections, users click "Regenerate" and see no feedback for 3–5 seconds, leading to double-clicks and confusion about whether the action registered.
- **Effort**: S
- **Suggested fix**:
  - Both functions already set `body.textContent='⏳ Generating...'` at the top — ensure the regen button is disabled while generating: `const btn=document.getElementById('out-regen');btn.disabled=true;` and re-enable in the finally path.

### 10. `api/claude.js` proxy has no rate limiting (production risk)
- **What**: The proxy forwards any authenticated Supabase session to Anthropic with no per-user request limit.
- **Where**: `api/claude.js:1–49`
- **Why it matters**: A single compromised or abusive account can run up the Anthropic bill at the app operator's expense. The comment at line 12 acknowledges this but it's unimplemented.
- **Effort**: M
- **Suggested fix**:
  - Add a simple token-bucket counter in Vercel KV or Upstash: check `user_id` → allow max 20 requests/minute.
  - Or use Vercel's built-in Edge rate limiting middleware as a simpler first step.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Duplicate API key lookup logic
- **What**: `getApiKey()` (lines 1075–1088) and `callClaudeGL()` (lines 1257–1262) each implement different key-lookup strategies — one checks `taskos_profiles`, the other doesn't.
- **Where**: `givelink.html:1075–1088`, `givelink.html:1257–1262`
- **Why it matters**: When the key lookup order is inconsistent, users who set their key in one place find it missing in another context. Bugs fixed in one function won't be fixed in the other.
- **Effort**: S
- **Suggested fix**:
  - Extract one `getKey()` utility that checks profiles → shared key → prompts (or returns null), and call it from both `getApiKey()` and `callClaudeGL()`.

### 12. `givelink.html` is a 1,756-line monolith with seed data mixed with logic
- **What**: All CSS, HTML, business logic, CRM, AI features, seed data, and PWA code lives in one file with no module separation.
- **Where**: `givelink.html:1–1756`
- **Why it matters**: The file is past the complexity threshold where one developer can reason about the whole thing at once. Features like CRM, standup, outreach, and sprint planner are interleaved, making regressions hard to spot. (`index.html` at 14,924 lines is the extreme version of the same problem.)
- **Effort**: L
- **Suggested fix**:
  - Split into at least: `givelink-data.js` (seed + storage), `givelink-crm.js`, `givelink-ai.js`, `givelink-ui.js`.
  - Do this incrementally — one feature module per sprint — rather than a big-bang rewrite.

### 13. `callClaudeGL` model is hardcoded to Haiku, Sprint Planner uses Opus 4.5
- **What**: Two different Claude models are called in the same file — Haiku for standup/outreach, `claude-opus-4-5` for sprint planning — with no config point for either.
- **Where**: `givelink.html:1140`, `givelink.html:1256`
- **Why it matters**: Haiku has changed version naming (`claude-haiku-4-5-20251001`) — hardcoded strings will break when models are deprecated. Operators can't tune cost vs quality without editing source.
- **Effort**: S
- **Suggested fix**:
  - Define `const GL_MODELS={fast:'claude-haiku-4-5-20251001',smart:'claude-sonnet-5'}` at the top of the script block and reference from each call site.

### 14. Service worker update detection can double-trigger the update banner
- **What**: The `updatefound` handler fires `showUpdateBanner()` on `state==='activated'`, and the `controllerchange` handler also calls `showUpdateBanner()`. Both can fire on the same update cycle, causing the banner to flash twice or fight with itself.
- **Where**: `givelink.html:1720–1733`
- **Why it matters**: Minor visual glitch, but also the `_swRefreshing` flag on `controllerchange` prevents the banner from showing on legitimate future updates in the same session if triggered first by `updatefound`.
- **Effort**: S
- **Suggested fix**:
  - Keep only the `controllerchange` path for showing the banner; remove the `updatefound`/`statechange` nested handler which is redundant.

### 15. `renderVelocityStats` uses `innerHTML+=` on the stats container
- **What**: `el.innerHTML+=` re-parses the entire existing HTML and appends, which resets event listeners on any existing child nodes and causes a full DOM reparse on every overview render.
- **Where**: `givelink.html:1551–1553`
- **Why it matters**: Currently harmless (no event listeners on stat cards), but any future interactivity on `ov-stats` children will silently break. It's also slightly slower than appending nodes.
- **Effort**: S
- **Suggested fix**:
  - Append dedicated wrapper elements instead: `el.insertAdjacentHTML('beforeend', velocityHTML)`.

---

## 💡 P3 — Nice to have

### 16. Landing page (`landing.html`) has no dark-mode support
- **What**: All landing page colors are light-only (`--bg:#f7f6f3`, `--surface:#ffffff`) with no `@media (prefers-color-scheme: dark)` block.
- **Where**: `landing.html:CSS root vars (~line 40–55)`
- **Why it matters**: Visitors arriving from a dark-mode device get a jarring light flash, especially on mobile. Inconsistent with the app which is dark-first.
- **Effort**: M
- **Suggested fix**:
  - Add dark variants under `@media (prefers-color-scheme: dark)` using the app's existing dark palette (`--bg:#070d1a`, `--text:#e2e8f0`).

### 17. CRM Kanban has no mobile layout
- **What**: `crm-kanban` uses `grid-template-columns:repeat(6,1fr)` with `min-width:160px` per column — on a 375px phone this overflows horizontally but the container doesn't have `overflow-x:auto`.
- **Where**: `givelink.html:197` (`.crm-kanban` CSS)
- **Why it matters**: The CRM view is completely unusable on mobile — columns overflow off-screen with no way to scroll to them.
- **Effort**: S
- **Suggested fix**:
  - Add `overflow-x:auto;padding-bottom:16px;` to `.crm-kanban`, and add a media query at `@media(max-width:768px)` setting each column to `min-width:140px` so they scroll horizontally.

### 18. No keyboard shortcut to open CRM or Past Sprints
- **What**: The existing keyboard shortcut block (`givelink.html:876–880`) only handles `n` (new task) and `Escape` (close modal). No shortcuts exist for navigation.
- **Where**: `givelink.html:876–880`
- **Why it matters**: Power users who navigate by keyboard have to reach for the mouse for every view switch. Minor friction that compounds during heavy sprint board use.
- **Effort**: S
- **Suggested fix**:
  - Add `if(e.key==='c')nav('crm')`, `if(e.key==='b')nav('backlog')`, `if(e.key==='o')nav('overview')` to the keydown handler, consistent with the `n` shortcut already there.

### 19. PWA `manifest-givelink.json` references `icon-gl.svg` as apple-touch-icon
- **What**: `givelink.html:11` uses `<link rel="apple-touch-icon" href="icon-gl.svg">` — Apple's home screen icon requires a raster PNG, not SVG.
- **Where**: `givelink.html:11`
- **Why it matters**: On iOS, the home screen icon will fall back to a generic bookmark icon instead of the Givelink logo, making the installed PWA look unprofessional.
- **Effort**: S
- **Suggested fix**:
  - Export a 180×180 PNG from `icon-gl.svg` and reference it: `<link rel="apple-touch-icon" href="icon-gl-180.png">`.

### 20. `syncToTaskOS` matches tasks by title string (case-insensitive) — fragile
- **What**: `givelink.html:1222` uses `tt.title.toLowerCase()===gt.title.toLowerCase()` to match sprint tasks to Task OS tasks for sync — any title edit breaks the link permanently.
- **Where**: `givelink.html:1218–1250` (`syncToTaskOS`)
- **Why it matters**: If a task title is edited in either app, the sync creates a duplicate. This leads to the same task appearing twice in Task OS with no way to deduplicate.
- **Effort**: M
- **Suggested fix**:
  - Stamp a `givlinkId` field on tasks pushed to Task OS on first sync, then match by `givlinkId` on subsequent syncs — fall back to title match only for legacy records.
