# Givelink + Task OS — Improvement Plan

_Produced by codebase audit of `index.html` (4,685 lines) and `givelink.html` (1,716 lines) — two vanilla-JS PWAs sharing a localStorage-based data layer._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. `callClaude` / `callClaudeGL` swallow HTTP errors — users see blank output instead of an actionable message

**What:** Both AI helper functions call `res.json()` without first checking `res.ok`, so HTTP 401/429/500 errors silently resolve to `null` instead of propagating the actual API error.

**Where:**
- `index.html:2221` — `callClaude()`
- `givelink.html:1230` — `callClaudeGL()`

(The AI Sprint Planner in `givelink.html:1106` correctly checks `res.ok` — that pattern should be applied to both helpers.)

**Why it matters:** A user who exhausts API credits, or has a rate-limit hit, sees "Could not generate audit. Check your API key." — identical to a missing-key error — with no way to tell what actually went wrong. Affects every AI feature in both apps (priority audit, tweet generator, standup, outreach drafts, sprint planner, daily briefing, etc.).

**Effort:** S

**Suggested fix:**
- After `const res = await fetch(...)`, add: `if (!res.ok) { const err = await res.text(); throw new Error(err); }`
- Both `callClaude` and `callClaudeGL` can then surface the Anthropic error message (e.g., "credit balance is too low") to the user via `toast()`.

---

### 2. "🔗 Sync to Task OS" reads a localStorage schema that doesn't exist — feature is dead for all users

**What:** `syncToTaskOS()` in `givelink.html` reads `taskos_profiles` and `taskos_data_<profileId>` keys. Task OS (`index.html`) writes everything to a single `taskos` key. `taskos_profiles` is never set anywhere in the codebase.

**Where:** `givelink.html:1169–1211`

**Why it matters:** Every user who clicks "🔗 Sync to Task OS" gets a "No Task OS profile found" toast and returns. The sync feature — which is a key cross-app workflow — has been silently broken since it was built. Givelink tasks never reach the personal task list.

**Effort:** S

**Suggested fix:**
- Replace profile lookup with direct read: `let tosData; try { tosData = JSON.parse(localStorage.getItem('taskos') || 'null'); } catch(e) { tosData = null; }`
- Operate on `tosData.tasks` directly, then write back with `localStorage.setItem('taskos', JSON.stringify(tosData))`.
- Remove dead `taskos_profiles` code path entirely.

---

### 3. Sprint seed data hardcodes `start: '2026-03-28'`, `end: '2026-04-11'` — new users always start with an expired sprint

**What:** The default state object and seed function bake in specific dates. After mid-April 2026, every first-time user sees 0 days left, 100% elapsed, and a `daysLeft()` / `sprintPct()` that are both permanently at their limits.

**Where:** `givelink.html:433` (default state), `givelink.html:775–778` (new sprint prefill is correct — ironically)

**Why it matters:** The sprint bar shows "0 days left" and velocity stats display as if the sprint is complete from the moment the app loads. The pillar completion percentages (calculated against current sprint tasks) are still correct, but the time-based signals are all wrong, eroding trust in the board's accuracy.

**Effort:** S

**Suggested fix:**
- Replace hardcoded dates with dynamic defaults:
  ```js
  sprint: {
    name: 'Sprint 1 — US Growth Push',
    start: new Date().toISOString().slice(0, 10),
    end: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  }
  ```
- The seeded task list can stay; only the sprint envelope needs to be live.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 4. App accent is blue (#58a6ff / #3b82f6) — not Givelink brand purple (#5718CA / #6B3FA0)

**What:** Both apps use a blue accent color for every primary action: buttons, active nav items, focus rings, progress bars, card borders, and FAB shadows. Givelink's brand palette is purple/pink.

**Where:**
- `index.html:17` — `--accent: #58a6ff`
- `givelink.html:17` — `--accent: #3b82f6`
- Hardcoded uses: `rgba(88,166,255,...)` and `rgba(59,130,246,...)` appear ~40 times each.

**Why it matters:** Every interaction with the product reinforces a blue identity that conflicts with Givelink's brand. Investors, nonprofit clients, and team members who use this board see a tool that doesn't look like the product they represent. Brand credibility compounds over time.

**Effort:** M

**Suggested fix:**
- Update `--accent` in both files to `#5718CA` (Givelink primary) or `#6B3FA0` (softer).
- Replace hardcoded `rgba(88,166,255,...)` and `rgba(59,130,246,...)` with `rgba(87,24,202,...)` equivalents.
- Audit the install banner, update banner, and FAB box shadows which also hardcode the blue.

---

### 5. `window.prompt()` used for API key entry in Givelink — blocks the browser, destroys mobile UX

**What:** When a user triggers any Givelink AI feature without a saved API key, a native `window.prompt()` dialog fires. The same pattern is used in `logActivityNP()` to capture activity notes mid-modal.

**Where:**
- `givelink.html:1222` — API key prompt in `callClaudeGL()`
- `givelink.html:1047` — API key prompt in `getApiKey()`
- `givelink.html:1392` — activity note prompt in `logActivityNP()`

**Why it matters:** `window.prompt()` freezes the browser tab on desktop and shows an OS-native dialog that can't be dismissed with Escape on mobile. The "Log Activity" prompt fires mid-flow while the NP modal is open, creating a modal-on-modal situation that confuses users and loses their context.

**Effort:** S

**Suggested fix:**
- For API key: show an inline banner "⚠️ API key missing — add it in ⚙️ Sprint Settings" and open that modal; don't auto-prompt.
- For activity logging: add a `<textarea id="np-activity-note">` directly to the NP modal footer; save on the "Log Activity" button click without leaving the modal.

---

### 6. Someday audit toast fires on every Buckets view navigation — `taskos_someday_audit` is never written in `renderBuckets`

**What:** `renderBuckets()` checks `localStorage.getItem('taskos_someday_audit')` to decide whether to show a toast, but never writes it. `checkSomedayAudit()` (Dashboard only) correctly sets the key, but if the user opens Buckets without visiting Dashboard first (or after a forced reload), the toast fires on every navigation.

**Where:** `index.html:1242–1245`

**Why it matters:** Users who keep Buckets open or navigate back frequently see the "X Someday items need review" toast every time, turning a useful nudge into noise they learn to ignore — exactly the opposite of the feature's intent.

**Effort:** S

**Suggested fix:**
- Inside the `if(oldSomeday.length >= 3 && ...)` block at line 1244, add:
  `localStorage.setItem('taskos_someday_audit', new Date().toISOString().slice(0,10));`
- This mirrors what `checkSomedayAudit()` already does on line 3634.

---

### 7. `saveTask()` and `saveGoal()` use `alert()` in Task OS — blocking dialogs inconsistent with app design

**What:** Three validation errors in `index.html` use native `alert()`: empty task title (line 1506), Top 3 full (line 1530), and empty goal title (line 1572). Givelink uses `toast()` exclusively for the same errors.

**Where:** `index.html:1506`, `index.html:1530`, `index.html:1572`

**Why it matters:** `alert()` blocks the browser event loop, dismisses any open modals' backdrop state, and looks completely different from the app's toast system. The "Top 3 full" alert is particularly disruptive since it fires inline with a drag action.

**Effort:** S

**Suggested fix:**
- Replace all three `alert(...)` calls with `toast(...)` (already globally available).
- For "Top 3 full," add a brief shake animation to the Top 3 area instead.

---

### 8. Product pillar (pink `#f472b6`) and Smooth Ops pillar (purple `#a78bfa`) are adjacent in the Overview grid — violates no-pink-on-purple brand rule

**What:** The 5-pillar overview grid renders pillars in declaration order: Growth (green) → Nonprofits (blue) → **Product (pink)** → Execution (yellow) → **Smooth Ops (purple)**. Product and Smooth Ops are side-by-side in the grid.

**Where:** `givelink.html:97–103` (CSS vars), `givelink.html:518–536` (rendered via `Object.entries(PILLARS)` in declaration order)

**Why it matters:** Pink text or borders directly touching purple is the exact scenario the brand rule prohibits — poor contrast, muddled visual hierarchy, and off-brand in demos or screenshots shared with investors/nonprofits.

**Effort:** S

**Suggested fix:**
- Reorder PILLARS definition to interleave colors: Growth (green) → Product (pink) → Nonprofits (blue) → Smooth Ops (purple) → Execution (yellow). This separates pink and purple with blue in between.
- Or change Smooth Ops to use a neutral (e.g., `#94a3b8` slate) instead of purple.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 9. Claude fetch calls have no timeout — AI buttons can freeze indefinitely on network drops

**What:** Neither `callClaude` nor `callClaudeGL` set an `AbortController` or use `Promise.race` with a timeout. If Anthropic's API is slow or the user's connection drops mid-request, the button stays disabled forever until they reload.

**Where:** `index.html:2216`, `givelink.html:1225`

**Why it matters:** Mobile network drops on a 30+ task standup generation will leave the "⏳ Thinking..." state locked. Users can't recover without reloading and losing any unsaved modal state.

**Effort:** S

**Suggested fix:**
- Add: `const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);`
- Pass `signal: controller.signal` to `fetch(...)`, then `clearTimeout(timeout)` on success or error.

---

### 10. `load()` in Task OS has no error handling around `JSON.parse` — corrupted localStorage crashes the app on startup

**What:** `function load()` at `index.html:1125` calls `JSON.parse(d)` without a try/catch. If localStorage becomes corrupted (truncated write, browser quirk, quota error on a partial save), the app throws a `SyntaxError` on startup and never renders.

**Where:** `index.html:1125`

(Note: `givelink.html:443` has the same issue — no try/catch despite reading a similar large JSON blob.)

**Why it matters:** Data corruption in localStorage is rare but happens. When it does, the user sees a blank white screen with no recovery path. A try/catch with a friendly "Data reset required" prompt would let them self-recover.

**Effort:** S

**Suggested fix:**
- Wrap `JSON.parse` in try/catch in both `load()` functions.
- On catch: `toast('⚠️ Data load error — please reset in Settings', 5000)` and continue with the default empty state.

---

### 11. Deep work timer interval leaks when navigating away — battery drain on mobile

**What:** `_dwInterval = setInterval(...)` is started in `dwToggle()` (`index.html:2506`) but is never cleared when the user navigates to another view. The DOM elements (`dw-time`, `dw-btn`) still exist but the view is hidden; the interval keeps ticking and calls `renderDeepWork()` on completion, which re-renders a hidden view.

**Where:** `index.html:2506–2510`, `index.html:2512–2523`

**Why it matters:** On mobile, an active interval running in the background prevents the browser from aggressively suspending the tab, leading to battery drain during long days. Timer audio (if added later) or vibration would continue silently.

**Effort:** S

**Suggested fix:**
- In `nav()` or at the top of each `renderX()` function, check if `_dwRunning` and call `dwReset()` if the user leaves the Deep Work view.
- Or add a global `beforeunload` + `nav()` hook that pauses (not resets) the timer.

---

### 12. Service worker update banner fires twice per update cycle

**What:** The service worker update detection in both files wires up two separate listeners that both call `showUpdateBanner()`: one on `statechange → activated`, another on `controllerchange`.

**Where:**
- `givelink.html:1681–1693`
- `index.html` (same pattern)

**Why it matters:** On update, the update banner appears twice in rapid succession (or flickers), which looks buggy and erodes trust in the PWA's reliability.

**Effort:** S

**Suggested fix:**
- Remove the `statechange` listener block. The `controllerchange` event (which fires after the new SW takes control) is the correct and sufficient trigger. It already has the `_swRefreshing` guard.

---

### 13. Seed data contains personal names, real business contacts, and Greek-language tasks — a privacy/professionalism risk in a public repo

**What:** Both seed functions populate the app with real-world data: full names ("Gerald", "Fanos", "Caitlin"), personal tasks in Greek ("Ακτινογραφία στα γόνατα"), real company names ("Apollo", "Superhuman", "Mailerlite"), and internal business notes with pricing/strategy.

**Where:**
- `index.html:1746–1800` (Task OS seed)
- `givelink.html:852–1032` (Givelink sprint + backlog seed)

**Why it matters:** This is a public GitHub repo (`panoskokmotos/task-management`). Any contributor, recruiter, or investor who views the repo sees live strategy notes, supplier contacts, and personal medical tasks. Forks or deployments will seed this data for other users.

**Effort:** M

**Suggested fix:**
- Replace personal names with generic placeholders ("Alex T.", "Team Member", "Partner Org").
- Replace Greek personal health tasks with generic examples ("Annual health checkup").
- Replace internal strategy notes with neutral examples ("Follow up on partnership discussion").
- Keep the structure (pillar variety, priority mix, status distribution) — just sanitize the content.

---

### 14. `renderCRM()` calls `seedNonprofits()` on every render — unnecessary check per navigation

**What:** Every call to `renderCRM()` (triggered by each navigation to the CRM view) begins with `seedNonprofits()`. The function guards with `if((S.nonprofits||[]).length)return` so it's a no-op after first run, but it's still an extra function call and array scan on every render.

**Where:** `givelink.html:1261–1262`

**Why it matters:** Minor performance issue now, but a pattern that makes the code harder to reason about (side effects inside render functions). More importantly, it means if a user deletes all nonprofits, seed data re-appears on next navigation to CRM.

**Effort:** S

**Suggested fix:**
- Move `seedNonprofits()` to the `load()` / init block at `givelink.html:1678`, after data is loaded.
- Remove the call from `renderCRM()`.

---

## 💡 P3 — Nice to have

---

### 15. ⌘K button shows keyboard shortcut text but no label explaining it's a quick-capture on mobile

**What:** The dashboard button `<button ... onclick="openCmdK()" title="⌘K">⌘K</button>` relies on users knowing what ⌘K means. On mobile, the `title` tooltip never appears and the label is cryptic.

**Where:** `index.html:310`

**Effort:** XS

**Suggested fix:** Change button text to `+ Quick Add` on mobile (CSS `@media` or JS detection), keeping `⌘K` on desktop. The `title="⌘K"` can stay as a desktop tooltip.

---

### 16. No `<noscript>` fallback in either file — JS failure leaves a blank page

**What:** Both files are 100% JavaScript-driven. If JS fails to parse or execute (syntax error, CSP block, extension conflict), users see a completely blank page with no indication of what went wrong.

**Where:** `index.html` and `givelink.html` — neither has a `<noscript>` tag.

**Effort:** XS

**Suggested fix:** Add `<noscript><div style="...">This app requires JavaScript. Please enable it in your browser settings.</div></noscript>` inside `<body>`.

---

### 17. `ai-out-modal` title always reads "🤖 AI Output" regardless of which feature opened it

**What:** The shared `showAiOut(title, text)` function at `index.html:2225` accepts a `title` param and does set it correctly, but the modal is also opened by some feature flows without going through `showAiOut`, leaving the stale title from the previous call.

**Where:** `index.html:2225–2229`, `index.html:4481`

**Effort:** XS

**Suggested fix:** Always call `showAiOut(title, text)` — never set the modal visible with `classList.remove('hidden')` directly without first setting the title.

---

### 18. `renderTop3` sorts on `t3s` which is `null` for any task that lost its T3 slot via `rmT3` — silent sort corruption

**What:** `index.html:1184` filters `t.isT3 && t.status !== 'done'`, so `t3s` should always be 1/2/3 for matching tasks. But `toggleDone` at line 1520 clears `t3s` only when a task is completed, not when it's uncompleted. A task that was T3, completed, and then uncompleted has `isT3: false` and `t3s: null` — fine for the filter. However, a task whose T3 slot was re-used (slot stolen) retains old `t3s` values after `rmT3` only sets `isT3: false`. If `isT3` ever gets out of sync with `t3s`, the sort produces undefined behavior.

**Where:** `index.html:1184`, `index.html:1534`

**Effort:** XS

**Suggested fix:** In the `renderTop3` filter, add a guard: `.filter(t => t.isT3 && t.t3s && t.status !== 'done')`.

---

### 19. Mobile FAB (+) partially overlaps bottom nav on screens with safe-area insets (notched phones)

**What:** The FAB is positioned at `bottom: 74px` on mobile (to clear the `.bnav`), but on notched phones (iPhone 14+) with a larger safe-area-inset-bottom, the bottom nav grows taller via `padding-bottom: max(env(safe-area-inset-bottom,0px),4px)`. On these devices the FAB can overlap the nav.

**Where:** `index.html:205` (`@media(max-width:768px){.fab{bottom:74px;}}`)

**Effort:** XS

**Suggested fix:** Use `bottom: calc(74px + env(safe-area-inset-bottom, 0px))` to account for variable safe-area height.

---

### 20. AI Sprint Planner sends up to 40 backlog tasks in plain text to Claude — no token budget awareness

**What:** `runAiSprintPlanner()` at `givelink.html:1073` slices the backlog to 40 tasks and formats them as a newline-separated string. At an average task title of ~60 chars, this is ~3,600 chars just for the task list. With a `max_tokens: 1024` response limit and `claude-opus-4-5` pricing, each sprint-plan generation costs more than necessary.

**Where:** `givelink.html:1073–1089`

**Effort:** S

**Suggested fix:**
- Downgrade to `claude-haiku-4-5-20251001` for this task (same model used for standup/outreach, which are more complex prompts).
- Or add task prioritization before slicing: send only backlog tasks with `priority === 'high'` first, falling back to medium if fewer than 10.
