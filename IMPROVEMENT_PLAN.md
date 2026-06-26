# Givelink Improvement Plan

Analyzed: `givelink.html` (1,755 lines), `index.html` (12,893 lines), `sw.js`, git log (30 commits).

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. NP modal buttons are permanently absent if "Add Org" opens before "Edit Org"

**What:** The Nonprofit CRM modal is created once via `if(!m){...}` — the Delete / Log Activity / Next Stage buttons are rendered via template literals that capture `editNpId` at creation time, not at open time. If "Add Org" is clicked first (`editNpId=null`), those buttons are never inserted into the DOM for the entire session.

**Where:** `givelink.html` lines 1358–1400, specifically `m.innerHTML=\`...\`` at line 1362

**Why it matters:** A team member who clicks "Add Org" (the primary call-to-action in the CRM header) before clicking an existing card loses the ability to delete or log activity on any org for that session — invisible data loss until page refresh.

**Effort:** S

**Suggested fix:**
- Move the Delete / Log Activity / Next Stage buttons out of the once-created template and into a separate `<div id="np-modal-actions">` that is updated each time `_showNPModal()` is called
- Replace the `if(!m){ create }` pattern's inner footer with: `document.getElementById('np-modal-actions').innerHTML = editNpId ? '...' : ''`
- Alternatively, always include the buttons and toggle `.style.display` based on `editNpId` on each open

---

### 2. `window.prompt()` for API key and activity logging silently fails in iOS PWA standalone mode

**What:** `getApiKey()` (line 1086) and `callClaudeGL()` (line 1261) both fall back to `window.prompt()` when no key is found. `logActivityNP()` uses `window.prompt()` for the activity note (line 1431). iOS and some Android browsers suppress these dialogs in standalone/PWA mode, returning `null` silently — the user gets no feedback and the action silently no-ops.

**Where:** `givelink.html` lines 1086, 1261, 1431

**Why it matters:** Givelink is a PWA. The primary install path (`initPWA()`) pushes users into standalone mode. Every AI feature and every CRM activity log is broken for installed-app users who haven't pre-set their API key.

**Effort:** S

**Suggested fix:**
- Replace the `window.prompt()` in `getApiKey()` and `callClaudeGL()` with an inline modal that renders a password input (reuse the existing `.mo` / `.md` pattern)
- Replace `window.prompt()` in `logActivityNP()` with an inline `<textarea>` form shown in the NP edit modal itself (a "Log note" sub-form)
- Store and find the key from a single canonical path (see P1 item 5)

---

### 3. Standup generator shows tasks from 2 days ago as "yesterday completed"

**What:** The cutoff for "yesterday's work" in `generateStandup()` is `now.getDate()-2` (line 1488), so tasks completed today are excluded and tasks from 2 days ago are included. The word "Yesterday" in the generated standup is factually wrong.

**Where:** `givelink.html` line 1488

```js
// Current (wrong):
yesterday.setDate(now.getDate()-2);
// Should be:
yesterday.setDate(now.getDate()-1);
```

**Why it matters:** The AI writes "Yesterday I completed X" but X was actually done two days ago. Pasted into Slack/email this looks sloppy and erodes trust in the AI feature.

**Effort:** S (one-line fix)

**Suggested fix:**
- Change `-2` to `-1` on line 1488
- Keep `setHours(6,0,0,0)` so tasks done after midnight are excluded from "yesterday"

---

### 4. AI Sprint Planner uses `claude-opus-4-5` — a non-canonical model identifier

**What:** `runAiSprintPlanner()` (line 1140) sends `model:'claude-opus-4-5'` directly to the Anthropic API, bypassing the `callClaudeGL()` helper. The canonical current identifier for Claude Opus is `claude-opus-4-8`; `claude-haiku-4-5-20251001` is what `callClaudeGL` uses for standup and outreach. The `claude-opus-4-5` string may be a stale alias that returns a 400 from the API without a clear error message to the user.

**Where:** `givelink.html` line 1140

**Why it matters:** The AI Sprint Planner is a headline feature surfaced in the sprint bar on every view. If it silently fails with a cryptic API error the whole time, users assume AI is broken.

**Effort:** S

**Suggested fix:**
- Route `runAiSprintPlanner()` through `callClaudeGL()` to share key-resolution logic and error handling
- If sprint planning needs a more capable model, use `claude-haiku-4-5-20251001` (cost-efficient, JSON-reliable) or `claude-sonnet-4-6`
- The catch block (line 1157) already shows `esc(e.message)` — ensure `res.ok` check includes the parsed API error body for clearer messages

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. Three divergent API key fallback chains — sprint planner and standup may use different keys

**What:** Givelink has three separate storage paths for the Anthropic API key: (a) profile-data `taskos_data_${id}.apiKey`, (b) `localStorage.taskos_api_key`, and (c) `JSON.parse(localStorage.taskos).claudeKey`. `getApiKey()` (used by AI Sprint Planner) checks paths a → b → prompt. `callClaudeGL()` (used by Standup and Outreach) checks b → c → prompt. Setting the key in Task OS Settings writes to path c. A user who sets their key in Task OS will have Standup/Outreach work but AI Sprint Planner re-prompt every time.

**Where:** `givelink.html` lines 1075–1088 (`getApiKey`), 1256–1271 (`callClaudeGL`)

**Why it matters:** Users who set their key in Task OS then open Givelink get a jarring "Enter your Anthropic API key:" prompt when they click AI Sprint Planner, even though they've already configured it. This makes the product feel broken.

**Effort:** S

**Suggested fix:**
- Unify to a single `resolveApiKey()` function that tries all three paths in consistent order: c → b → a → inline modal
- Replace all `window.prompt()` fallbacks (see P0 item 2) with the inline modal
- Document the canonical key in a comment so both helpers stay in sync

---

### 6. "AI Sprint Planner" adds tasks to Backlog, not to Sprint

**What:** The modal is labelled "🤖 AI Sprint Planner" and the button in the sprint bar says "AI Sprint Planner", but the action button inside the modal reads "✅ Add Selected to Backlog" and the code sets `sprint:'backlog'` (line 1193). Users expecting sprint planning get backlog grooming instead.

**Where:** `givelink.html` lines 1193–1201, modal title line 406, sprint bar button line 252

**Why it matters:** The primary value of a sprint planner is staging selected tasks into the active sprint. The mismatch between label and behavior causes hesitation ("will this overload my sprint?") and means the AI recommendation is two clicks further from being actionable.

**Effort:** S

**Suggested fix:**
- Add a `<select>` in the AI suggestions UI letting the user choose "Current Sprint" or "Backlog" before adding (default: Current Sprint)
- Or rename the modal to "AI Backlog Prioritiser" if backlog is the intended target
- Update the button text to match whichever destination is chosen

---

### 7. Mobile bottom nav is missing Nonprofits, Ops, and CRM — three of eight sections

**What:** The bottom nav (lines 307–312) has 5 items: Overview, Growth, Product, Execution, Backlog. Nonprofits, Smooth Ops, and CRM are only reachable by opening the hamburger sidebar. On mobile, the sidebar requires two taps (hamburger + nav item) and closes on each navigation, making Nonprofits — a core pillar — require 2 extra taps per visit.

**Where:** `givelink.html` lines 306–312

**Why it matters:** Nonprofits is one of the two highest-priority pillars (23 sprint tasks). If the team's primary user is checking task status on mobile between meetings, a 2x tap penalty per pillar visit adds up to real friction.

**Effort:** S

**Suggested fix:**
- Limit bottom nav to the 5 most-used items but make them configurable, or use a "More" overflow tab that opens a full-screen tray
- Alternatively, replace "Backlog" in the bottom nav with "Nonprofits" (CRM and Ops are less time-sensitive than Nonprofits tasks)
- A "More →" sheet is the most scalable solution for 8+ sections

---

### 8. CRM "Draft email" button is ~24×16px — fails 44px minimum touch target

**What:** The `✉️ Draft` button in each CRM kanban card (line 1332) is styled `font-size:9px; padding:2px 6px`, producing a tappable area of roughly 24×16px. The WCAG 2.5.5 minimum is 44×44px; Apple HIG recommends 44pt.

**Where:** `givelink.html` line 1332

**Why it matters:** The outreach draft generator is the highest-value action in the CRM — it's the reason to open the CRM view. If tapping it requires precision on a phone, it goes unused.

**Effort:** S

**Suggested fix:**
- Increase to at minimum `padding:8px 12px; font-size:11px;` on the button
- Consider surfacing "Draft email" as a full button inside the edit modal instead (where there's more space), and remove it from the compact card

---

### 9. No data export from Givelink — sprint history and CRM exist only in localStorage

**What:** `givelink.html` has no export function. All sprint tasks, past sprint archives, CRM records, burndown snapshots, and activity logs live exclusively in `localStorage.givelink_sprint`. By contrast, `index.html` has full JSON export (around line 10550+). If the user clears site data, switches browsers, or the storage limit is hit silently, all history is gone.

**Where:** `givelink.html` — no export function exists

**Why it matters:** Past sprint data is the audit trail for investor/board reporting. Losing it is a high-stakes failure for a startup tracking nonprofit partnerships.

**Effort:** S

**Suggested fix:**
- Add a "Export JSON" button in the Sprint Settings modal (line 381) that calls `JSON.stringify(S)` and triggers a file download
- Optionally add import: parse the file back into `S` with a confirmation dialog

---

### 10. Every new task defaults to "High" priority — inflates urgency metrics

**What:** `openAdd()` (line 685) sets `document.getElementById('t-pri').value='high'` unconditionally. The Overview stats show Done/In Progress/Todo/Blocked counts, and the pillar health uses completion percentage — not priority-weighted — so defaults don't corrupt numbers. But `generateStandup()` sorts by `priority==='high'` first (line 1490), so every task appears equally urgent in AI summaries.

**Where:** `givelink.html` line 685

**Why it matters:** When everything is high priority, nothing is. The AI standup and sprint planner suggestions are built on priority signals that have been made meaningless by the default.

**Effort:** S (one-line change)

**Suggested fix:**
- Change the default to `'medium'` (line 685)
- The priority select label already reads "Priority" with "🔴 High" as the first option — reorder to put Medium first since it's the statistical center

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `renderVelocityStats()` appends to `ov-stats` via `innerHTML+=`, breaking 4-column grid

**What:** `renderOverview()` sets `ov-stats.innerHTML` with 4 stat cards. Then it calls `renderVelocityStats()` (line 1551) which does `el.innerHTML += '...'` to append 2 more. The `stats2` grid is defined as `grid-template-columns:repeat(4,1fr)` (line 105), so 6 items produce a 4+2 layout that orphans the last row. On mobile at `grid-template-columns:1fr 1fr` this means 3 rows, with the velocity stats looking disconnected from the sprint stats.

**Where:** `givelink.html` lines 105, 518–522, 1544–1552

**Why it matters:** The Overview is the first screen every user sees. Misaligned stat cards signal an unpolished product.

**Effort:** S

**Suggested fix:**
- Include the velocity cards inside the initial `ov-stats` HTML in `renderOverview()` directly — remove `renderVelocityStats()` as a separate function or make it update specific named elements
- Or change `stats2` to `grid-template-columns:repeat(auto-fill,minmax(110px,1fr))` to handle variable counts gracefully

---

### 12. Burndown SVG hardcoded at 280px with `width:100%` — renders blurry on large screens

**What:** `renderBurndown()` (line 763) creates an SVG with `width="280" height="100"` but also sets `style="width:100%;max-width:280px"`. On small screens the SVG is correct; on screens wider than 280px the SVG stretches up to 280px before capping, but the `viewBox` is absent, so SVG coordinates are treated as pixels and the chart looks pixelated/blurry at anything above 280px display width.

**Where:** `givelink.html` lines 763–774

**Why it matters:** On desktop (the primary use case for a sprint board), the burndown chart is the central data viz. A blurry chart erodes trust in the data.

**Effort:** S

**Suggested fix:**
- Add `viewBox="0 0 280 100"` to the SVG element and remove the `max-width:280px` constraint — the SVG will then scale cleanly to any container width
- Or use a `<canvas>` with `devicePixelRatio` scaling for sharper rendering

---

### 13. `seed()` depends on `S.seeded` flag in localStorage — clears on data wipe, re-seeds with orphaned IDs

**What:** `seed()` (line 883) checks `if(S.seeded)return`. `S.seeded` is persisted in the same `givelink_sprint` localStorage key as all user data. If a user clears localStorage (common in onboarding or debugging), `seed()` re-runs and pushes ~100 tasks with new UUIDs — duplicating any tasks the user had already modified before the wipe.

**Where:** `givelink.html` lines 883–1072

**Why it matters:** This is a one-way data integrity failure. A user who accidentally clears site data and refreshes gets their sprint board back (the seed), but all tasks they edited or completed before the wipe reappear as new todos.

**Effort:** M

**Suggested fix:**
- Replace the `S.seeded` flag with a version check: `if(S.tasks.length>0)return` — don't re-seed if any tasks exist
- Move seed data to a separate function called `getDefaultTasks()` that is only ever called once from `init()` if `S.tasks.length===0 && !localStorage.getItem('gl_ever_loaded')`
- Set `gl_ever_loaded` in a separate key so it survives even if the main data key is wiped

---

### 14. Standup priority sort comparator is binary — medium and low tasks are unordered

**What:** The `todayPlan` sort in `generateStandup()` (line 1490) uses `(b.priority==='high'?1:-1)-(a.priority==='high'?1:-1)`. This puts high-priority tasks first but treats medium and low identically (both map to -1), producing random ordering within the non-high group.

**Where:** `givelink.html` line 1490

**Why it matters:** The standup shows only 5 tasks from "today's plan" — the top 5 by priority. If several medium tasks precede lower items in the array, low tasks may surface instead of mediums.

**Effort:** S

**Suggested fix:**
```js
const ORDER = { high: 3, medium: 2, low: 1 };
.sort((a,b) => (ORDER[b.priority]||1) - (ORDER[a.priority]||1))
```

---

### 15. No localStorage quota guard — heavy sprint + CRM use risks silent data loss

**What:** The combined `givelink_sprint` key stores tasks (100+ seeded), past sprints, CRM orgs, burndown snapshots, and outreach drafts. `index.html`'s `taskos` key stores 40+ data arrays. Together, with active use, these can approach the 5–10 MB localStorage limit. `save()` (line 447) calls `localStorage.setItem()` without a try/catch — a quota error throws uncaught, data is not saved, and the user sees no feedback.

**Where:** `givelink.html` line 447

**Why it matters:** A silent save failure means the user keeps working, unaware that nothing is persisting. They close the tab and lose a sprint's worth of status updates.

**Effort:** S

**Suggested fix:**
```js
function save() {
  try {
    localStorage.setItem('givelink_sprint', JSON.stringify(S));
  } catch(e) {
    toast('⚠️ Storage full — export your data before continuing', 6000);
  }
}
```

---

### 16. `callClaudeGL()` and `getApiKey()` have separate, divergent key-resolution chains

**What:** See P1 item 5 for full diagnosis. From a code-health perspective: the two functions are 19 lines apart in the same file but have different fallback orders, different prompt text, and write to different storage keys on success. Any fix to key resolution requires changing both functions.

**Where:** `givelink.html` lines 1075–1088 and 1256–1271

**Why it matters:** Every future AI feature added to `givelink.html` will need a third copy of this logic unless it's extracted.

**Effort:** S

**Suggested fix:**
- Extract a shared `_resolveKey()` function (see P1 item 5 for the unified chain)
- Both `callClaudeGL` and `runAiSprintPlanner` call `_resolveKey()` — one place to fix, one place to test

---

## 💡 P3 — Nice to have

---

### 17. CRM kanban 6-column grid collapses to ~60px/column on mobile

**What:** `.crm-kanban` uses `grid-template-columns:repeat(6,1fr)` (line 197) with `overflow-x:auto`. On a 375px iPhone, each column is ~62px — the org name and buttons are clipped. The horizontal scroll is functional but the cards are nearly unreadable.

**Where:** `givelink.html` lines 197–199

**Why it matters:** CRM is the primary account-management tool. If it's unusable on mobile, follow-up actions happen on desktop only — limiting the team's ability to act from the field.

**Effort:** M

**Suggested fix:**
- Use `grid-template-columns:repeat(6,minmax(180px,1fr))` with `overflow-x:auto` so columns maintain minimum readable width
- Or switch the mobile layout to a list view (`@media(max-width:768px){.crm-kanban{display:flex;flex-direction:column;}}`) grouped by stage

---

### 18. Past sprint dates lose year — previous-year sprints are ambiguous

**What:** `fd()` (line 456) formats dates as `{month:'short', day:'numeric'}` — e.g. "Mar 28". The Past Sprints view uses `fd(s.start)`, `fd(s.end)`, and `fd(s.closedAt)` (line 865). If sprints span calendar years, "Dec 31 – Jan 14 · archived Jan 15" is ambiguous.

**Where:** `givelink.html` lines 456, 865

**Why it matters:** Past sprints are the performance record. Year ambiguity makes year-over-year comparisons error-prone in board reporting.

**Effort:** S

**Suggested fix:**
- For past sprint display only, use `{year:'numeric', month:'short', day:'numeric'}` — or conditionally add year if `new Date(d).getFullYear() !== new Date().getFullYear()`

---

### 19. No `prefers-reduced-motion` support in `givelink.html`

**What:** `givelink.html` defines `.fi{animation:fi .15s ease;}` (line 147) applied to every task card and goal card on render. There is no `@media(prefers-reduced-motion:reduce)` override. `index.html` has this media query (referenced in `_haptic()` at line 3230 of index.html).

**Where:** `givelink.html` lines 146–147

**Why it matters:** Users with vestibular disorders can experience discomfort from constant card-entrance animations. `prefers-reduced-motion` is a one-line fix.

**Effort:** S

**Suggested fix:**
```css
@media(prefers-reduced-motion:reduce){.fi{animation:none;}}
```

---

### 20. Givelink always dark — no theme parity with Task OS

**What:** `givelink.html` hard-codes dark variables in `:root` with no `body.light` override and no toggle. `index.html` has full light/dark theming. Users who use Task OS in light mode (e.g. in direct sunlight, or accessibility preference) get a jarring context switch when navigating to the Givelink sprint board.

**Where:** `givelink.html` lines 15–20 (`:root` variables)

**Why it matters:** Inconsistent theming between two apps that are linked from the same sidebar breaks the "one product" perception.

**Effort:** M

**Suggested fix:**
- Add a `body.light` CSS block mirroring the dark `:root` values with light equivalents (same approach as `index.html` lines 27–34)
- On init, read `localStorage.getItem('taskos_theme')` and apply the matching class — no new UI needed, just follows the Task OS preference

---

*Total: 4 P0 · 6 P1 · 6 P2 · 4 P3 = 20 items*
