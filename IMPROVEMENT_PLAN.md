# Givelink Codebase — Improvement Plan

> Scanned: `givelink.html` (1,755 lines) · `index.html` (12,893 lines) · `sw.js` · `vercel.json`  
> Date: 2026-06-12

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### P0-1 · `window.prompt()` used to collect Anthropic API key

**What:** Two separate code paths fall back to `window.prompt()` to collect the API key when it's not stored, producing an unstyled browser-native dialog mid-flow.

**Where:**
- `givelink.html:1086` — `getApiKey()` fallback
- `givelink.html:1261` — `callClaudeGL()` fallback

**Why it matters:** `window.prompt()` is blocked in many WebView/embedded contexts and shows confusing origin text ("from givelink.html") in iOS homescreen PWA mode. Users have no way to back out gracefully — hitting Cancel silently aborts the feature with only a generic "API key required" toast. Sensitive credentials should never pass through a native browser dialog.

**Effort:** S

**Suggested fix:**
- Add an API key input field to the Sprint Settings modal (already open for sprint config).
- On first AI feature use, if key is missing, open Sprint Settings with the key field highlighted and an inline explanation.
- Remove both `window.prompt()` fallback branches entirely.

---

### P0-2 · `window.prompt()` used for activity logging in Nonprofit CRM

**What:** The "Log Activity" button in the CRM triggers `window.prompt('Log activity (what happened?):')` — the same class of UX breakage as P0-1, but worse because activity notes can be multi-line.

**Where:** `givelink.html:1431`

**Why it matters:** Multi-line activity notes are truncated by `window.prompt()`, which only provides a single-line input. Notes are permanent CRM data; data loss here damages the sales pipeline record.

**Effort:** S

**Suggested fix:**
- Inline a `<textarea>` + Save button directly into the CRM edit modal (which is already open when this function fires).
- The modal already has a "Latest Activity Note" field (`#np-note`); wire the "Log Activity" button to focus that field and auto-save on blur instead of prompting.

---

### P0-3 · AI Sprint Planner uses an invalid/stale model ID

**What:** `runAiSprintPlanner()` calls the Anthropic API with `model:'claude-opus-4-5'`, a model ID that does not exist in the current API. Valid IDs are `claude-opus-4-8`, `claude-haiku-4-5-20251001`, etc.

**Where:** `givelink.html:1140`

**Why it matters:** Every click of "✨ AI Sprint Planner → Generate" returns an API error. The error is caught and shown inline (`givelink.html:1158`) but the user just sees "Error: …" with no clear path to fix it. This silently kills the flagship AI feature.

**Effort:** S

**Suggested fix:**
- Change `model:'claude-opus-4-5'` → `model:'claude-haiku-4-5-20251001'` (matches what `callClaudeGL()` uses elsewhere and is sufficient for a JSON task list).
- Better yet, refactor `runAiSprintPlanner()` to call the shared `callClaudeGL()` utility (see P2-1) so model names are defined in one place.

---

### P0-4 · CRM Kanban is completely broken on mobile

**What:** `.crm-kanban` is defined as `grid-template-columns:repeat(6,1fr)` with no responsive override, creating six ~45px-wide columns that are unreadable on any viewport below ~1000px.

**Where:** `givelink.html:197`

**Why it matters:** The Nonprofit CRM is one of the highest-value views for Givelink's sales motion. Any team member checking pipeline status on a phone (a common scenario) sees a broken layout they cannot use.

**Effort:** S

**Suggested fix:**
- Add a media query: `@media(max-width:900px){.crm-kanban{grid-template-columns:1fr 1fr 1fr;}}` and `@media(max-width:600px){.crm-kanban{grid-template-columns:1fr 1fr;}}`.
- Or switch to a horizontal scroll layout: `display:flex; overflow-x:auto` with fixed `min-width:160px` per column (already partially defined in `.crm-col`).

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### P1-1 · Sprint bar action buttons overflow on mobile

**What:** The `.sprint-bar` header packs sprint name, dates, completion bar, and three full-text action buttons (AI Sprint Planner, Standup, Sync to Task OS) into a single flex row. On mobile the row is also indented 58px for the hamburger button.

**Where:** `givelink.html:248–254`, `givelink.html:162` (mobile padding override)

**Why it matters:** On any phone, at least two buttons wrap or get clipped beneath the sprint meta info, making them invisible without scrolling — and the `.sprint-bar` is `flex-shrink:0` so it may overlap content.

**Effort:** S

**Suggested fix:**
- On mobile (`max-width:768px`), hide the three action buttons from the sprint bar and expose them via a `⋯` overflow menu or add them to the mobile bottom nav's "More" tab.
- Alternatively, collapse button labels to icons-only on small screens using a `<span class="btn-label">` hidden via CSS.

---

### P1-2 · Duplicate API key management creates confusing prompt loops

**What:** `getApiKey()` (used by sprint planner) and `callClaudeGL()` (used by standup + outreach) manage the API key through different localStorage keys and different fallback chains. If a user enters a key in one path, the other may not find it and prompt again.

**Where:**
- `givelink.html:1075–1088` — `getApiKey()` checks `taskos_profiles` → `taskos_api_key` → `prompt()`
- `givelink.html:1256–1262` — `callClaudeGL()` checks `taskos_api_key` → `taskos.claudeKey` → `prompt()`

**Why it matters:** A new user who configured their key in Task OS (`taskos.claudeKey`) and then clicks "Generate Standup" will be prompted a second time because `callClaudeGL` checks `taskos.claudeKey` but `getApiKey` skips that path. Two unexpected dialogs in one session will cause abandonment.

**Effort:** S

**Suggested fix:**
- Consolidate into one `getApiKeyGL()` function that checks in priority order: `taskos_api_key` → `taskos_data_*.apiKey` (profile) → `taskos.claudeKey`. Remove the `prompt()` branch and instead surface the settings modal (see P0-1).
- Delete `getApiKey()` once `runAiSprintPlanner()` is refactored to use `callClaudeGL()`.

---

### P1-3 · Regenerate button not disabled during AI generation (spam risk)

**What:** In the AI Outreach Generator and Daily Standup modals, the "↺ Regenerate" button remains enabled while an AI call is in flight. Clicking it multiple times fires concurrent requests.

**Where:**
- `givelink.html:1610` — `<button id="out-regen">`
- `givelink.html:1475` — `<button onclick="generateStandup()">`

**Why it matters:** Each concurrent call consumes API tokens and the last-to-resolve response overwrites earlier ones, producing confusing flickering. A slow user who double-clicks sees the cost doubled with no benefit.

**Effort:** S

**Suggested fix:**
- At the top of `generateOutreach()` and `generateStandup()`, set `btn.disabled=true; btn.textContent='⏳ Generating...'`.
- Re-enable in the `finally` block (or after both success and error paths).

---

### P1-4 · `window.confirm()` for destructive delete actions breaks the design

**What:** "Delete?" for tasks and "Delete this org?" both use `window.confirm()`, which renders as a system dialog completely outside the app's visual language.

**Where:**
- `givelink.html:732` — `delCur()` task delete
- `givelink.html:1425` — `deleteNP()` CRM org delete

**Why it matters:** Jarring UX that signals low polish to anyone evaluating the tool. On iOS standalone mode, `confirm()` shows the app URL/filename as the dialog source, which looks like a browser security warning.

**Effort:** S

**Suggested fix:**
- Add a tiny inline confirmation row to each edit modal: when "Delete" is first clicked, replace the button with "Really delete? [Yes, delete] [Cancel]" rendered as styled HTML buttons in the existing modal footer.
- No new modal needed — this is a two-state toggle on the existing footer div.

---

### P1-5 · Sidebar nav items are `<div>` not `<button>` — keyboard navigation is broken

**What:** Every nav item in the sidebar (`.ni`) is a `<div onclick="nav(...)">` rather than a semantic `<button>`. The bottom nav uses `<button class="bni">` correctly, but the sidebar does not.

**Where:** `givelink.html:233–244` (all `.ni` sidebar divs)

**Why it matters:** Keyboard users (Tab + Enter) and screen reader users cannot reach any sidebar destination. This also violates WCAG 2.1 SC 4.1.2 (Name, Role, Value) at the AA level.

**Effort:** S

**Suggested fix:**
- Change all `.ni` `<div>` elements to `<button class="ni" type="button">`. Add `tabindex="0"` or rely on the native button tab order.
- Add `aria-current="page"` to the active item and an `aria-label` where the visible text is an emoji only.

---

### P1-6 · Sprint Planner uses Opus where Haiku is sufficient (cost × 15)

**What:** `runAiSprintPlanner()` hardcodes `model:'claude-opus-4-5'` (which is also a stale/invalid ID — see P0-3). The task is straightforward JSON generation of 10 sprint task suggestions. Haiku is appropriate and ~15× cheaper per call.

**Where:** `givelink.html:1140`

**Why it matters:** At scale or with frequent regeneration, this is a meaningful cost leak. More immediately, if the user's key has usage limits, Opus calls exhaust them faster, causing all other AI features to start failing.

**Effort:** XS (one-line fix, already addressed as part of P0-3)

**Suggested fix:**
- Use `callClaudeGL(prompt, 1024)` (defaults to haiku) instead of the inline fetch.
- Document the model selection rationale with a short comment if a more capable model is genuinely needed.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### P2-1 · Sprint Planner duplicates the Claude API fetch instead of using `callClaudeGL()`

**What:** `runAiSprintPlanner()` contains a full inline `fetch('https://api.anthropic.com/v1/messages', {...})` block instead of calling the shared `callClaudeGL()` utility defined 125 lines earlier.

**Where:** `givelink.html:1130–1160` vs `givelink.html:1256–1272`

**Why it matters:** Any fix to error handling, model selection, the `anthropic-dangerous-direct-browser-access` header, or retry logic must be made in two places. This is how stale model IDs (P0-3) happen.

**Effort:** S

**Suggested fix:**
- Extract the JSON-parsing retry logic (`try JSON.parse → extract \[...\] with regex`) from `runAiSprintPlanner` into a `parseJsonFromAI(raw)` helper.
- Rewrite `runAiSprintPlanner` to: `const raw = await callClaudeGL(prompt, 1024); const suggestions = parseJsonFromAI(raw); renderAiSuggestions(suggestions);`

---

### P2-2 · Hardcoded model names scattered across both files

**What:** The model string `'claude-haiku-4-5-20251001'` appears 3 times across the two HTML files. When this model is deprecated, each instance must be found and updated manually.

**Where:**
- `givelink.html:1256` (default param in `callClaudeGL`)
- `givelink.html:1660` (explicit param in outreach generator)
- `index.html:4139` (in `callClaude()`)

**Why it matters:** Model version strings change with Anthropic releases. A single missed update causes a silent API error on every AI call.

**Effort:** XS

**Suggested fix:**
- Define `const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';` as a constant near the top of each file's script block.
- Replace all inline string literals with the constant.

---

### P2-3 · Service worker cache key contains hardcoded date — stale content risk

**What:** The cache key is `'task-os-20260530'` — a date that must be manually bumped to bust the cache on new deployments.

**Where:** `sw.js:1`

**Why it matters:** If a developer forgets to update this date when deploying, users with a cached service worker will continue to see old HTML/JS even after pushing fixes. This has likely already bit someone.

**Effort:** XS

**Suggested fix:**
- Replace with a build-time injected version: `const CACHE = 'task-os-v__VERSION__';` and substitute via a small build step, or use a git commit hash.
- If no build step exists, at minimum document "bump this on every deploy" prominently in the file.

---

### P2-4 · Multiple bare `catch(e){}` blocks silently swallow errors

**What:** Several catch blocks in both files do nothing on failure — no log, no toast, no user feedback.

**Where:**
- `givelink.html:1083` — API key profile lookup (silent JSON parse failure)
- `givelink.html:1259` — localStorage parse in `callClaudeGL` key fallback
- `index.html:3230` — haptic feedback failure
- `index.html:4516` — XP award failure
- `index.html:10054` — EOD XP failure

**Why it matters:** Failures in XP and data-related operations that are swallowed silently make bugs invisible in production. The haptic/XP ones are low-stakes but the API key lookup failure means a user gets `null` key with no clue why.

**Effort:** S

**Suggested fix:**
- For truly non-critical fallbacks (haptic, XP animation), add `catch(e){ /* non-critical */ }` with a comment.
- For data-path catches (API key lookup, localStorage parse), add `console.warn('[givelink] catch:', e)` so failures at least appear in DevTools.

---

### P2-5 · `givelink.html` is 1,755 lines with 5+ unrelated feature modules inlined

**What:** The file contains: Kanban board, CRM, Standup generator, Outreach generator, Sprint velocity, Burndown chart, PWA install, and Service Worker init — all in one file with no logical separation.

**Where:** `givelink.html` — feature modules identifiable by `// ════ FEATURE N` comments at lines ~1074, 1253, 1274, 1525, 1597, etc.

**Why it matters:** Adding a new CRM field requires scrolling through 400 lines of sprint logic. Test coverage is impossible without a module boundary. Already causing the model/key duplication issues above.

**Effort:** L

**Suggested fix:**
- This is the right size to split into ES modules with a simple build step: `givelink-crm.js`, `givelink-ai.js`, `givelink-sprint.js`, `givelink-pwa.js`.
- If staying single-file, at minimum extract CSS into `givelink.css` and the script into `givelink.js` — the HTML stays as a thin shell. This alone reduces the cognitive load per file by 2/3.
- **Do not split `index.html` (12,893 lines) until the architecture question is settled** — that deserves its own planning conversation.

---

## 💡 P3 — Nice to have

---

### P3-1 · Impact widget shows "0 people impacted" as the first-run experience

**What:** `renderImpactWidget()` displays "0 people impacted · 0.00% of 1M mission" on a fresh install before any nonprofits are marked as "won."

**Where:** `givelink.html:1581–1590`

**Why it matters:** New team members or evaluators see a zero metric as their first impression of the mission dashboard. The seeded nonprofits already include 3 "won" orgs — if the seed data fires before `renderImpactWidget`, this wouldn't happen. It's worth auditing init order.

**Effort:** XS

**Suggested fix:**
- Ensure `seed()` runs before `renderImpactWidget()` in the `load(); seed(); renderSprintBar(); updateSidebar(); renderOverview();` init sequence (confirm `renderImpactWidget` is called inside `renderOverview`).
- If the widget can be empty, show an aspirational placeholder ("Start adding nonprofit partners to track your mission impact") instead of "0."

---

### P3-2 · No shared design token file — brand palette will drift

**What:** Task OS uses a GitHub-inspired blue/purple palette (`--accent:#58a6ff`, `--brand2:#bc8cff`). Givelink Sprint Board uses Tailwind-mapped colors (`--accent:#3b82f6`, `--pr:#f472b6`). Neither matches the specified brand palette (purple `#6B3FA0`/`#5718CA`, pink `#C2185B`/`#E353B6`). There is no shared token source.

**Where:** `index.html:19–26` (Task OS tokens), `givelink.html:15–20` (Givelink tokens)

**Why it matters:** As the product surfaces to users (landing page, onboarding, marketing), inconsistent color use signals lack of brand cohesion. The no-pink-on-purple rule cannot be enforced without a shared token file.

**Effort:** M

**Suggested fix:**
- Create `tokens.css` with the canonical brand palette as CSS custom properties.
- Link it from both HTML files as the first stylesheet.
- In a subsequent pass, audit which deviations are intentional (dark-mode utility colors) vs brand violations.

---

### P3-3 · Google Fonts CDN call on every Task OS load (privacy + performance)

**What:** `index.html` preconnects to `fonts.googleapis.com` and loads Inter from Google's CDN on every page load.

**Where:** `index.html:12–14`

**Why it matters:** Adds 100–250ms of DNS + TLS + transfer latency on cold loads. Also sends user IP to Google on every visit, which may matter for GDPR/privacy positioning as Givelink markets to nonprofits.

**Effort:** S

**Suggested fix:**
- Self-host Inter: download the WOFF2 subset, add to the repo, update the `@font-face` declaration.
- Or use the system font stack already present as fallback (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`) — Inter is only used for visual polish, not brand identity.

---

### P3-4 · No keyboard shortcuts for common sprint board actions

**What:** "Add Task," "Open Standup," "Cycle through pillar views," and "Mark task done" have no keyboard shortcuts. The only keyboard navigation is Tab through interactive elements.

**Where:** `givelink.html` — no `keydown` / `keyup` listeners found

**Why it matters:** Power users (the primary audience for a sprint board) expect at minimum `n` = new task, `Escape` = close modal (already works for modals via the × button), `/` = search/filter.

**Effort:** S

**Suggested fix:**
- Add a `document.addEventListener('keydown', e => { if(e.key==='n'&&!inInput(e)) openAdd(); })` pattern.
- `inInput()` helper: `return ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)`.
- Start with 3 shortcuts: `n` (new task), `b` (focus backlog), `s` (open standup).
