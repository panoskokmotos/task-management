# Improvement Plan — Task OS & Givelink Sprint Board

> Scanned 2026-05-21. Total codebase: ~11,430 LOC across `index.html` (9,565), `givelink.html` (1,755), `sw.js` (110).
> Architecture: two standalone vanilla-JS PWAs sharing localStorage. No build tooling, no TypeScript.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. "Sync to Task OS" button always fails silently
**What:** `syncToTaskOS()` reads from `localStorage.getItem('taskos_profiles')` and `taskos_data_<id>`, but `index.html` never writes to those keys — it only writes to `taskos`. Every click shows "No Task OS profile found" and syncs nothing.

**Where:** `givelink.html:1206-1251`

**Why it matters:** The sync button is a prominent CTA in the sprint bar. Any user who tries it discovers it's broken, eroding confidence in the whole product.

**Effort:** S

**Suggested fix:**
- Replace `localStorage.getItem('taskos_profiles')` with a direct read of `localStorage.getItem('taskos')`
- Parse the resulting object as Task OS state: `const tosData = JSON.parse(localStorage.getItem('taskos') || '{}')`
- Write changes back to `'taskos'` instead of `'taskos_data_'+profile.id`

---

### 2. Givelink AI calls eat errors silently — user sees nothing on 401/429/500
**What:** `callClaudeGL()` calls `res.json()` without first checking `res.ok`. A 401 (bad key), 429 (rate limit), or 500 returns a JSON error body that resolves to `data.content?.[0]?.text = undefined`, so the function returns `null` with no toast explaining why.

**Where:** `givelink.html:1264-1271`

**Why it matters:** When the API key is wrong or rate-limited, every AI feature in Givelink (Sprint Planner, Standup, CRM Outreach) silently fails. Users assume the feature is broken, not that the key needs fixing.

**Effort:** S

**Suggested fix:**
- Add `if(!res.ok){ const e=await res.json().catch(()=>({})); toast('AI error '+res.status+': '+(e.error?.message||res.statusText)); return null; }` immediately after `const res = await fetch(...)`, mirroring the pattern in `index.html:1412-1415`
- Remove the current bare `catch(e){toast('AI error: '+e.message)}` — it only fires on network failure, not HTTP errors

---

### 3. Push notification icons are 404 — `icons/` directory doesn't exist
**What:** `sw.js:38-39` and `index.html:7620` reference `./icons/icon-192.png` for notification icons, but the `icons/` directory does not exist in the repository.

**Where:** `sw.js:38-39`, `index.html:7620`

**Why it matters:** Browser push notifications and local reminder notifications show broken/missing icons on Chromium-based browsers, making the PWA feel unfinished. On some platforms, a missing badge icon causes the notification to fail to display entirely.

**Effort:** S

**Suggested fix:**
- Option A (quickest): Replace both references with `./icon.svg` — the existing icon file
- Option B (proper): Create an `icons/` directory and add PNG icons at 192×192 and 512×512 (can be rasterised from `icon.svg`) and update `manifest.json` to reference them

---

### 4. API key included in JSON backup export — key exposed on share
**What:** `exportData()` serialises the full `S` state object, which includes `S.claudeKey` (the Anthropic API key). Any exported backup file contains the live secret key in plaintext.

**Where:** `index.html:1819-1824`

**Why it matters:** Users who share backups with teammates, store them in Dropbox, or post them in support threads inadvertently expose their Anthropic API key. The key would allow anyone who reads the file to make API calls billed to the user's account.

**Effort:** S

**Suggested fix:**
- Destructure the key out before exporting: `const {claudeKey, ...exportS} = S; const blob = new Blob([JSON.stringify(exportS, null, 2)], ...)`
- Show a note in the UI that "API key is not included in exports — re-enter it after importing"
- Also strip key from CSV exports if they're ever extended to include notes

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. `window.prompt()` used for API key entry and CRM activity logging in Givelink
**What:** Two flows use the native browser `window.prompt()`: entering the Anthropic API key when none is stored (`givelink.html:1261`) and logging CRM activity against a nonprofit (`givelink.html:1431`). Both render an unstyled OS-level dialog that can't be cancelled gracefully on mobile Safari.

**Where:** `givelink.html:1261`, `givelink.html:1431`

**Why it matters:** The CRM activity log is the primary engagement action in the Nonprofit CRM — it's used after every call or meeting. A native browser dialog destroys the product experience. On iOS PWA mode, `window.prompt()` is functionally broken.

**Effort:** M

**Suggested fix:**
- API key prompt: Redirect to the Task OS Settings page with a toast: `toast('Add your Claude key in Task OS → Settings'); window.open('index.html', '_blank')`
- Activity log: Add a two-field inline form (textarea + save button) inside the CRM card modal rather than using `window.prompt()`. The `logActivityNP()` at `givelink.html:1429` already has modal infrastructure — add the input there.

---

### 6. `alert()` used for three validation errors in Task OS
**What:** Three places in `index.html` use the native `alert()` dialog for form validation: empty task title (`index.html:2541`), Top 3 slots full (`index.html:2686`), and empty goal title (`index.html:2740`).

**Where:** `index.html:2541`, `index.html:2686`, `index.html:2740`

**Why it matters:** A raw `alert()` pauses JS execution, requires a click to dismiss, and looks broken in a polished app that otherwise uses custom toasts everywhere. It's jarring on mobile.

**Effort:** S

**Suggested fix:**
- Replace each with a `toast()` call: e.g. `toast('⚠️ Enter a task title first')`
- For Top 3 full, also highlight the existing Top 3 slots with a brief CSS pulse to orient the user

---

### 7. Native `confirm()` used for deletion in Givelink — skips undo pattern
**What:** `givelink.html:732` (delete task) and `givelink.html:1425` (delete CRM org) use `window.confirm()`. The Task OS side has a proper `showConfirm()` custom modal (used ~20 times in `index.html`) but it was never ported to Givelink.

**Where:** `givelink.html:732`, `givelink.html:1425`

**Why it matters:** `window.confirm()` is inaccessible (no keyboard trap management, no focus), breaks in some PWA contexts, and bypasses the undo pattern used everywhere else in Task OS. Accidentally deleting a nonprofit CRM entry is non-recoverable.

**Effort:** S

**Suggested fix:**
- Copy the `showConfirm()` function from `index.html:1865-1872` into `givelink.html`
- Add the confirm modal HTML stub (already in `index.html` around line 1340) to `givelink.html`
- Replace the two `confirm()` calls with `showConfirm('Delete?', ok => { if(!ok) return; ... })`

---

### 8. Givelink bottom nav omits two pillars — Nonprofits and Ops unreachable on mobile
**What:** The fixed bottom nav in `givelink.html:306-312` shows Overview, Growth, Product, Execution, and Backlog. Nonprofits (`nav('nonprofits')`) and Ops (`nav('ops')`) are absent. On mobile, the sidebar is hidden behind a hamburger menu that many users won't open.

**Where:** `givelink.html:306-312`

**Why it matters:** Nonprofits is the core Givelink business pillar — tracking relationships with nonprofits is the product's primary value. Hiding it behind a hamburger on mobile means the most important view is the hardest to reach.

**Effort:** S

**Suggested fix:**
- Swap Backlog out of the bottom nav (low daily-use) and add Nonprofits: `<button class="bni" data-v="nonprofits" onclick="nav('nonprofits')"><span class="bni-ic">🤝</span>Nonprofits</button>`
- Or add a scrollable nav row that allows all 5 pillars + Backlog to sit horizontally with `overflow-x: auto`

---

### 9. Task/goal titles rendered unescaped in weekly review wizard
**What:** The weekly review wizard's `renderWizPanel()` at `index.html:2366, 2373, 2375` inserts `t.title` and `g.title` directly into `innerHTML` template strings without calling `esc()`. Task or goal titles containing `<`, `>`, `"`, or `&` will corrupt the review wizard's HTML or (in adversarial edge cases) render injected content.

**Where:** `index.html:2366` (completed tasks step), `index.html:2373` (backlog promotion step), `index.html:2375` (goal progress step). Also `index.html:2146, 2181, 2218, 2241, 2342`.

**Why it matters:** A user who names a task `Fix <br> issue` or uses `"quotes"` in a title will see broken review wizard output. This is a self-XSS surface — mostly cosmetic now, but it sets a fragile precedent.

**Effort:** S

**Suggested fix:**
- Wrap all unescaped title interpolations: `${t.title}` → `${esc(t.title)}` and `${g.title}` → `${esc(g.title)}`
- The `esc()` function is already defined at `index.html:8107` (hoisted, so available throughout)

---

### 10. Dashboard re-renders 12 sub-components on every navigation
**What:** `renderDash()` at `index.html:2058-2073` synchronously calls 12 render sub-functions (`renderTop3`, `renderDailyPicks`, `renderMorningBriefing`, `renderStreakRow`, `renderAntiPatterns`, `checkEatTheFrog`, `checkPreMortem`, `renderMomentumScore`, `renderOneThing`, `renderWeeklyTheme`, `renderExecutionScore`, plus `_renderBookInsight`) every time the dashboard is navigated to.

**Where:** `index.html:2058-2073`

**Why it matters:** On mid-range Android devices and iPhone SE, this causes a 200–400 ms main-thread block on every return to the dashboard, producing visible layout jank. As state grows, this will get worse.

**Effort:** M

**Suggested fix:**
- Introduce a dirty-tracking pattern: store a `_dashLastSaveId` counter, increment in `save()`; only re-render sub-components when the counter has changed since last render
- Alternatively, use `requestIdleCallback()` for the lower-priority widgets (AntiPatterns, StreakRow, MorningBriefing) so the above-fold content renders first
- At minimum, move `renderMorningBriefing` (which may fire an API call) to `setTimeout(..., 0)` to avoid blocking the initial paint

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `renderWizPanel()` is 452 lines — all six review steps in one function
**What:** The weekly review wizard renders all six steps (`renderWizPanel()`) in a single 452-line function at `index.html:2361-2813`, with repeated `if(wizStep===N)` branches, each constructing full innerHTML strings inline.

**Where:** `index.html:2361-2813`

**Why it matters:** Adding a new review step or editing an existing one requires navigating a 450-line function. Each step's HTML is untestable in isolation.

**Effort:** M

**Suggested fix:**
- Create a dispatch map: `const WIZ_RENDERERS = [renderWiz0, renderWiz1, ...]`
- Extract each step's 50-80 lines into `function renderWizStep0(body){ ... }` etc.
- `renderWizPanel()` becomes 5 lines: find body element, call `WIZ_RENDERERS[wizStep](body)`

---

### 12. `renderProcCard()` is 572 lines — three different features in one function
**What:** `renderProcCard()` at `index.html:2885-3457` handles inbox task processing, deep work timer UI, and focus day planning. It mixes state logic with HTML generation in 572 consecutive lines.

**Where:** `index.html:2885-3457`

**Why it matters:** This is the most complex function in the codebase. Touching the deep work timer risks breaking inbox processing. It's been touched in 3 of the last 5 commits based on git log.

**Effort:** M

**Suggested fix:**
- Extract `renderInboxProcessor()`, `renderDeepWorkCard()`, and `renderFocusDayBlocks()` as separate functions
- `renderProcCard()` becomes a coordinator that calls each in sequence

---

### 13. API key stored in 3 inconsistent places across both files
**What:** The Anthropic API key lives in `S.claudeKey` (written to `taskos` via `save()`), `localStorage.getItem('taskos_api_key')` (a separate key used only in `givelink.html`), and a profile-based key `d.apiKey` in `taskos_data_<id>` (also givelink, never written by either app). `index.html:8001` checks both `S.claudeKey` and `taskos_api_key`.

**Where:** `index.html:8001`, `givelink.html:1085-1087`, `givelink.html:1257-1260`

**Why it matters:** A key set in Task OS Settings won't reliably propagate to Givelink AI features. Users end up with some features working and others failing depending on which storage path each function happens to check first.

**Effort:** S

**Suggested fix:**
- Standardise on reading from `localStorage.getItem('taskos')` → parse → `.claudeKey` in both files
- Delete all references to `taskos_api_key` and `taskos_data_*` for key lookups
- Remove the orphaned `||localStorage.getItem('taskos_api_key')` guard at `index.html:8001`

---

### 14. Shared utility functions copy-pasted between both HTML files
**What:** `esc()`, `toast()`, `uid()` are defined independently in both `index.html:8107` and `givelink.html:451`. `callClaude` / `callClaudeGL` are parallel but divergent implementations of the same API wrapper.

**Where:** `index.html:8107`, `givelink.html:451`

**Why it matters:** A bug fix in `esc()` or a toast timing change must be applied twice. The divergent `callClaude` implementations already have one bug in givelink (see P0 #2) that index.html does not have.

**Effort:** M

**Suggested fix:**
- Create `utils.js` with `esc`, `toast`, `uid`, and a single `callClaude(apiKey, prompt, maxTokens)` function
- Load it via `<script src="utils.js">` in both HTML files before their app scripts
- The function signatures can stay identical; just pass `apiKey` explicitly rather than reading from closure

---

### 15. Ephemeral localStorage keys accumulate forever with no cleanup
**What:** Five types of date-keyed flags are written to localStorage and never deleted: `taskos_briefing_<date>` (`index.html:8024`), `taskos_frog_<date>` (`index.html:4048`), `taskos_premortem_<date>` (`index.html:4554`), and `taskos_someday_audit` (`index.html:5924`). After a year of daily use, dozens of orphaned keys accumulate.

**Where:** `index.html:4037-4048`, `index.html:4540-4554`, `index.html:8001-8024`

**Why it matters:** localStorage is limited (~5MB). A power user with a year of briefing cache and per-day flags could silently hit quota, triggering the `QuotaExceededError` path in `save()` and losing all future data.

**Effort:** S

**Suggested fix:**
- On `save()`, scan localStorage for `taskos_briefing_`, `taskos_frog_`, `taskos_premortem_` keys older than 14 days and `localStorage.removeItem()` them
- Alternatively, move these flags inside `S` under a `S.flags` object with a date, and prune in `save()` any flags older than 14 days

---

## 💡 P3 — Nice to have

---

### 16. Brand accent colour not applied — Givelink uses generic blue, not brand purple
**What:** `givelink.html:17` sets `--accent:#3b82f6` (Tailwind blue-500). The stated Givelink brand palette is purple `#5718CA` / `#6B3FA0`. The `--pr` (Product pillar) uses `#f472b6` (Tailwind pink-400) instead of brand pink `#E353B6`.

**Where:** `givelink.html:13-20`

**Why it matters:** Givelink's sprint board will be shown to investors and partners. The blue accent makes it look like a generic Trello clone rather than the Givelink brand.

**Effort:** S

**Suggested fix:**
- Set `--accent:#5718CA` in `givelink.html` `:root`
- Set `--pr:#E353B6` for the Product pillar
- Verify the "no pink on purple" rule: avoid any element that places `--pr` text on a `--accent` background (e.g., pillar chips on the overview page)

---

### 17. Checkbox and toggle divs have no ARIA — invisible to screen readers
**What:** `.ck`, `.ck2`, `.gcheck`, `.bl-check`, and `.habit-ck` are `<div>` elements functioning as checkboxes. They have no `role`, no `aria-checked`, and no `tabindex`, making them completely invisible to assistive technology.

**Where:** `index.html:69-71` (`.ck`), `index.html:278` (`.habit-ck`), `givelink.html:81-83` (`.ck2`), `givelink.html:65-67` (`.gcheck`)

**Why it matters:** Users relying on keyboard navigation or screen readers cannot interact with any task completion checkbox — the core action of the app.

**Effort:** M

**Suggested fix:**
- Add `role="checkbox"` and `aria-checked="false"` (dynamically set to `"true"` when `.on` is present) to each checkbox div
- Add `tabindex="0"` and a `keydown` handler for Space/Enter to trigger the click handler
- This can be done in `tcHTML()` and `taskHTML()` template functions with one-line additions

---

### 18. Impact goal hardcoded at 1,000,000 — not configurable
**What:** The Givelink dashboard hero widget at `index.html:6234` hardcodes `1,000,000` as the beneficiary goal: `toward <strong>1,000,000</strong>`. This value is not stored in `S.givelinkMetrics` and can only be changed by editing source code.

**Where:** `index.html:6230-6237`

**Why it matters:** As Givelink's growth target evolves, the founder needs to adjust this without a code deploy. It also means the progress percentage is wrong if the real goal changes.

**Effort:** S

**Suggested fix:**
- Add an `impactGoal` field to `S.givelinkMetrics` with a default of `1000000`
- Render as `m.impactGoal?.toLocaleString() || '1,000,000'`
- Expose it as an editable field in the Givelink metrics modal

---

### 19. Service worker cache version is manually date-stamped — breaks on forgotten bump
**What:** `sw.js:1` hardcodes `const CACHE = 'task-os-20260521'`. Cache busting after a deploy requires manually editing this string, and it's easy to forget, leaving users on stale HTML for days.

**Where:** `sw.js:1`

**Why it matters:** A missed cache version bump means users continue running old code after a deploy. Given there's no build pipeline to automate this, the risk is high.

**Effort:** S

**Suggested fix:**
- Inject the cache key at deploy time via a Vercel build step or a simple pre-deploy script: `sed -i "s/task-os-[0-9]*/task-os-$(date +%Y%m%d%H%M)/g" sw.js`
- Or add a comment in `sw.js` and `CONTRIBUTING.md` that this must be bumped before every push to `main`

---

### 20. `renderSFTimeline()` is 463 lines and appears to be a personal planning feature
**What:** `renderSFTimeline()` at `index.html:6908-7371` is the 4th largest function in the codebase, rendering a "San Francisco relocation timeline" planning view with inline HTML templates. It's a personal-use feature embedded in a business productivity tool.

**Where:** `index.html:6908-7371`

**Why it matters:** 463 lines of personal planning logic adds noise to the codebase, increases the `index.html` payload (already ~9,500 lines), and creates maintenance burden. If Task OS is ever open-sourced or shared, this personal data is embedded in the source.

**Effort:** M

**Suggested fix:**
- Extract to a separate `sf-timeline.html` page (same pattern as `givelink.html`)
- Or collapse into a data-only view backed by the existing `S.sfTimeline` state object, reducing the render to ~50 lines
- At minimum, extract the 6 nested HTML template builders into named helpers

---

*Total items: 20 | P0: 4 | P1: 6 | P2: 5 | P3: 5*
