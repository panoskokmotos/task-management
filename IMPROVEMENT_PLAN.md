# Givelink Improvement Plan

Codebase: `givelink.html` (1,755 lines) + `index.html` (11,595 lines, Task OS)  
Reviewed: 2026-05-24

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. "Sync to Task OS" button is completely broken

**What:** The sync feature always fails silently — users see "No Task OS profile found" and nothing is synced.

**Where:** `givelink.html:1207–1215`

**Why it matters:** The only cross-app workflow (moving completed Givelink sprint tasks back into Task OS) never works. Any team member who tries it gets a dead end.

**Effort:** S

**Suggested fix:**
- `syncToTaskOS()` reads `localStorage.getItem('taskos_profiles')`, a key that `index.html` never writes. Index.html stores its full state under the `taskos` key.
- Replace the `taskos_profiles` lookup with a direct read of `localStorage.getItem('taskos')`, then parse `tosData = JSON.parse(d)` and use `tosData.tasks[]` directly.
- Remove the profile-ID indirection (`taskos_data_${profile.id}`) and write the updated `tosData` back to `localStorage.setItem('taskos', ...)`.

---

### 2. `load()` has no error handling — corrupt data crashes the app on startup

**What:** A `JSON.parse` exception in `load()` propagates uncaught, leaving users with a blank screen and no recovery path.

**Where:** `givelink.html:448`

```js
function load(){const d=localStorage.getItem('givelink_sprint');if(d){const p=JSON.parse(d);S={...S,...p};}}
```

**Why it matters:** Any partial write (e.g. tab closed mid-save, storage quota error, manual edit) corrupts the key and permanently breaks the app for that user. Index.html handles this correctly at line 1877.

**Effort:** S

**Suggested fix:**
- Wrap the parse in try/catch: `try{S={...S,...JSON.parse(d)};}catch(e){console.warn('Corrupt givelink data, resetting',e);}` — mirrors the pattern already in `index.html:1877`.
- Optionally, show a one-time toast: "Could not load saved data, starting fresh."

---

### 3. AI Sprint Planner prompts for API key even when it's already set in Task OS

**What:** The Sprint Planner uses `getApiKey()` (line 1075) which does not read `S.claudeKey` from the `taskos` storage key; Standup and Outreach use `callClaudeGL()` (line 1256) which does. Users who set their key in Task OS Settings are prompted a second time only for the Sprint Planner.

**Where:** `givelink.html:1075–1087` vs `givelink.html:1256–1272`

**Why it matters:** Two AI functions work seamlessly; the flagship Sprint Planner blocks with a raw browser prompt. Erodes trust in the product's polish.

**Effort:** S

**Suggested fix:**
- Add the `taskos` JSON fallback to `getApiKey()` — the same `try{const p=JSON.parse(localStorage.getItem('taskos')||'{}');k=p.claudeKey||'';}catch(e){}` already present in `callClaudeGL` at line 1259.
- Consider deleting `getApiKey()` entirely and making `runAiSprintPlanner` call `callClaudeGL()` for consistency.

---

### 4. Daily Standup includes 2-day-old completions, not yesterday's

**What:** The `yesterday` cutoff is set 2 days back instead of 1, so "Yesterday I completed…" in standups can include tasks finished 2 days ago while sometimes excluding tasks done yesterday morning.

**Where:** `givelink.html:1488`

```js
const yesterday=new Date(now);yesterday.setDate(now.getDate()-2);
```

**Why it matters:** Standup summaries sent to the team contain inaccurate content. Undermines trust in the AI feature.

**Effort:** S

**Suggested fix:**
- Change `now.getDate()-2` → `yesterday.getDate()-1` (or equivalently `now.getDate()-1`).
- Set hours to start-of-day: `yesterday.setHours(0,0,0,0)` instead of `6,0,0,0` for a clean calendar day boundary.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. Mobile bottom nav hides Nonprofits, CRM, and Past Sprints

**What:** The fixed bottom nav shown on mobile (≤768px) covers only 5 of 9 navigation destinations. The Nonprofits pillar, CRM, and Past Sprints are only accessible by opening the sidebar drawer — a non-obvious interaction that most users won't find.

**Where:** `givelink.html:306–312`

**Why it matters:** Nonprofit CRM is a core daily workflow. Users managing the pipeline on mobile (field use, between meetings) can't reach it without discovering the hamburger.

**Effort:** M

**Suggested fix:**
- Replace the static 5-item bottom nav with a scrollable bottom nav or a "More" overflow item that navigates to a menu.
- Minimum viable: swap "Growth" (accessible via Overview's pillar cards) for "Nonprofits" or "CRM" since those have no other entry point in the Overview.
- Ensure `bni[data-v]` matching in `nav()` line 474 still works for new items.

---

### 6. API key collected via native `window.prompt()` — blocks on PWA, breaks UX

**What:** When no API key is found, both `getApiKey()` and `callClaudeGL()` call `window.prompt()`. On iOS PWA standalone mode, prompts are blocked by default. On desktop, they break the app's visual context.

**Where:** `givelink.html:1086`, `givelink.html:1261`

**Why it matters:** Givelink is deployed as a PWA. On iOS (the most common phone platform for nonprofit managers), the AI features are completely inaccessible on first use without a fallback UI. The raw browser chrome dialog also looks unfinished in a product being pitched to nonprofits.

**Effort:** M

**Suggested fix:**
- Add an "API Key" field to Sprint Settings modal (`sm`) — same pattern as Task OS's settings modal at `index.html:7491`. Store under `taskos_api_key`.
- Remove both `prompt()` calls and instead call `toast('Add API key in Sprint Settings ⚙️')` with no further action.
- The key persists across both apps since both read `taskos_api_key`.

---

### 7. CRM Kanban is unusable on mobile — no responsive layout

**What:** The 6-column kanban grid requires 960px+ width (6 columns × 160px min-width). On a 375px phone screen, horizontal scrolling is required across a very wide area with no snap points.

**Where:** `givelink.html:197–199`

```css
.crm-kanban{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;overflow-x:auto;}
.crm-col{min-width:160px;}
```

**Why it matters:** CRM is the highest-stakes daily tool for nonprofit sales. Managing pipeline from a phone between meetings is a realistic use case — and currently broken.

**Effort:** M

**Suggested fix:**
- Add a media query at 768px: switch `.crm-kanban` to a stacked list view grouped by stage, with each stage as a collapsible section.
- Alternative: a horizontal scroll with `scroll-snap-type: x mandatory` and `scroll-snap-align: start` per column, plus a stage tab bar at top to jump directly.

---

### 8. `--muted` text fails WCAG 2.1 AA contrast in sidebar and metadata

**What:** `--muted: #4e6180` on `--sf: #0e1628` (sidebar background) produces a 2.87:1 contrast ratio. WCAG AA requires 4.5:1 for normal text and 3:1 for large text. The "Todo" status badge color `#475569` on the same background is 2.38:1.

**Where:** `givelink.html:17` (CSS variables), throughout sidebar nav items (`.ni`), badge `.st-todo`, `.bcnt2`, `.sl2`, `.pcard-label`

**Why it matters:** Nonprofit organizations frequently have accessibility requirements for tools used by their staff. Also affects readability in dim environments (which is common on a dark theme).

**Effort:** S

**Suggested fix:**
- Lighten `--muted` to `#6b82a0` (≈ 4.6:1 on `--sf`) — preserves the slate-blue tone without going white.
- Update `.st-todo` badge color to at least `#64748b` → `#7e92a8` to pass 3:1.
- Test both changes against `--bg`, `--sf`, and `--s2` backgrounds since muted is used on all three.

---

### 9. Delete actions use native `confirm()` dialog — inconsistent and blocked in some contexts

**What:** Both task deletion (`delCur()`) and org deletion (`deleteNP()`) use the browser's native `confirm()` dialog, while the rest of the app uses a custom confirm modal (visible in `index.html`).

**Where:** `givelink.html:732`, `givelink.html:1425`

**Why it matters:** Native dialogs are blocked in iframes, inconsistent across OS/browser styles, and can be suppressed on some mobile browsers. The UX mismatch makes the app feel unfinished in demo contexts.

**Effort:** S

**Suggested fix:**
- Replace `confirm('Delete?')` with a small inline confirmation: after clicking Delete, show the button text change to "Confirm?" with a 3-second auto-reset (already used in some other apps for destructive actions).
- Or: use a minimal shared `showConfirm(msg, onOk)` helper that renders a small inline dialog overlay — avoids adding a whole new modal.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 10. Two separate API key resolution paths produce inconsistent behavior

**What:** `getApiKey()` (line 1075) and `callClaudeGL()` (line 1256) both resolve the Anthropic API key but use different lookup chains. Bug #3 above is a direct symptom of this.

**Where:** `givelink.html:1075–1087`, `givelink.html:1256–1272`

**Why it matters:** Every new AI feature added has a 50% chance of using the wrong resolver, causing subtle key-not-found bugs that only appear for certain users.

**Effort:** S

**Suggested fix:**
- Merge into a single `resolveApiKey()` function with the full lookup chain: `taskos_api_key` → `taskos` JSON `claudeKey` → `null`.
- Remove prompt() from the resolver (see Bug #6). All AI callers check for `null` and show a settings toast.

---

### 11. Dynamically created modals are not closed by the Escape key handler

**What:** The Escape key listener at line 876 (`document.querySelectorAll('.mo')`) runs at page load and captures only the 4 static modals. The `np-modal`, `standup-modal`, and `outreach-modal` are appended to `<body>` on first use and are never covered.

**Where:** `givelink.html:875–880`, `givelink.html:1359–1389`, `givelink.html:1469–1479`, `givelink.html:1603–1614`

**Why it matters:** Users who press Escape to dismiss the CRM or Standup modal are surprised when it doesn't work, then must find and click the ×.

**Effort:** S

**Suggested fix:**
- Replace the `querySelectorAll` snapshot with an event-delegation approach: in the keydown handler, check `document.querySelectorAll('.mo:not(.hidden)')` at handler invocation time rather than at bind time.
- Alternatively, ensure dynamic modals are always added to a single container div that exists at load and is queried by CSS class.

---

### 12. Priority badge in task cards shows raw enum value, not display label

**What:** `taskHTML()` renders `${t.priority||'medium'}` (outputs "high", "medium", "low") while `goalHTML()` correctly uses `PRI[t.priority]?.l` (outputs "High", "Medium", "Low"). Same inconsistency in the AI suggestions list at line 1178.

**Where:** `givelink.html:666`, `givelink.html:1178`

**Why it matters:** Minor but visible: task cards and goal cards look inconsistent when viewed side-by-side. "high" and "High" are both present in the same pillar view.

**Effort:** XS

**Suggested fix:**
- Line 666: change `${t.priority||'medium'}` → `${PRI[t.priority]?.l||'Medium'}`.
- Line 1178: change `${t.priority}` → `${PRI[t.priority]?.l||t.priority}`.

---

### 13. Sprint seed data has hardcoded March 2026 dates — shows "0 days left" on first load after April 11

**What:** `S.sprint` is initialized with `start:'2026-03-28', end:'2026-04-11'`. After April 11, 2026 (already past), any new user sees a sprint at 100% elapsed with 0 days remaining.

**Where:** `givelink.html:436–443`

**Why it matters:** First-time users see a broken, completed sprint immediately. The app looks stale before they've done anything.

**Effort:** S

**Suggested fix:**
- In `seed()`, replace the hardcoded dates with dynamic ones: start = today, end = today + 14 days.
- Sprint name: `Sprint 1 — ${new Date().toLocaleDateString('en-US',{month:'short',year:'numeric'})}`.

---

### 14. `saveSprint()` silently accepts empty date strings — corrupts all date calculations

**What:** If a user clears the Start Date or End Date field in Sprint Settings and saves, `S.sprint.start` / `S.sprint.end` become empty strings. Every downstream call (`daysLeft()`, `sprintPct()`, `calcSprintVelocity()`) then produces `NaN` or `Infinity`.

**Where:** `givelink.html:784–793`

**Why it matters:** A single accidental clear-and-save corrupts the sprint header permanently until the user understands why all numbers show "NaN".

**Effort:** S

**Suggested fix:**
- After line 789, add: `if(!start||!end){toast('Both start and end dates are required.');return;}`.
- Also add `required` attributes to the date inputs in the Sprint Settings modal (lines 376–377).

---

### 15. Burndown snapshots only captured on task completion — chart has gaps

**What:** `_recordSnapshot()` is called only from `toggleDone()`. If a user updates task status (todo → in-progress → blocked) without completing any tasks for several days, the burndown chart has no data points for those days and underestimates velocity.

**Where:** `givelink.html:737`, `givelink.html:743–752`

**Why it matters:** The burndown chart is the primary visual signal of sprint health. Gaps make it unreliable for the weekly review conversation with the team.

**Effort:** M

**Suggested fix:**
- Call `_recordSnapshot()` from `saveTask()` as well (line 730), not just `toggleDone`.
- Add a `setInterval(() => _recordSnapshot(), 3600000)` on page load (every hour) so the chart builds even if no completions happen.
- Alternatively, generate synthetic data points between known snapshots when rendering the chart.

---

### 16. AI Sprint Planner calls `claude-opus-4-5` — likely invalid model ID

**What:** `runAiSprintPlanner()` hardcodes `model:'claude-opus-4-5'` (line 1140). The current valid model IDs are `claude-opus-4-7`, `claude-sonnet-4-6`, and `claude-haiku-4-5-20251001`. `claude-opus-4-5` may be accepted as a legacy alias or may return a 400 error.

**Where:** `givelink.html:1140`

**Why it matters:** Sprint planning is a weekly ritual. If the model ID starts returning errors after an API deprecation, the feature silently breaks.

**Effort:** XS

**Suggested fix:**
- Change to `claude-haiku-4-5-20251001` for cost-efficient sprint planning (same model already used by Standup and Outreach).
- Or use `claude-sonnet-4-6` if higher quality output is needed for this planning task.

---

## 💡 P3 — Nice to have

---

### 17. CRM "Log Activity" uses `window.prompt()` — should be inline

**What:** `logActivityNP()` at line 1429 fires a browser prompt for the activity note, while the CRM modal is already open in the background. Users see the prompt text "Log activity (what happened?):" over the blurred app.

**Where:** `givelink.html:1429–1439`

**Why it matters:** Inconsistent with the app's design language and blocked in strict popup contexts. Minor but visible in demos.

**Effort:** S

**Suggested fix:**
- Add a small `<textarea>` + "Log" button directly inside the `np-modal` footer, visible only in edit mode. On submit, update `lastActivityNote` and append to `activityLog`.

---

### 18. Burndown SVG is fixed 280×100px — looks small and pixelated on retina

**What:** `renderBurndown()` hardcodes `const W=280,H=100` and renders an SVG with `max-width:280px`. On a 1440px+ desktop, this takes up ~20% of the content width. On retina displays, it renders at half the visual resolution.

**Where:** `givelink.html:763–775`

**Why it matters:** The burndown is the key data visualization in the sprint review. It should fill the available width to be readable.

**Effort:** S

**Suggested fix:**
- Make the SVG responsive: set `viewBox="0 0 280 100"` and `width="100%"` without a max-width cap. Scale pad/stroke proportionally or switch to a percentage-based coordinate system.

---

### 19. Product pillar pink (`#f472b6`) appears adjacent to Ops purple (`#a78bfa`) in pillar card grid

**What:** The Overview pillar card grid renders all 5 pillars side by side. Product uses `#f472b6` (pink) and Ops uses `#a78bfa` (purple). The brand spec flags "no pink on purple" as a rule; the adjacency creates a visual clash in the pillar card row.

**Where:** `givelink.html:18` (CSS variables), `givelink.html:523–541` (pillar card rendering)

**Why it matters:** Brand consistency — especially relevant when the Givelink board is shown to potential nonprofit partners or investors during demos.

**Effort:** S

**Suggested fix:**
- Reorder the pillar cards in the Overview so Product and Ops are not adjacent (e.g. Growth → Nonprofits → Execution → Product → Ops).
- Or re-assign Product pillar to a different accent color: `#38bdf8` (sky blue) creates better separation while remaining visually distinct from the other pillars.

---

## Summary

| # | Item | Tier | Effort |
|---|------|------|--------|
| 1 | syncToTaskOS broken | P0 | S |
| 2 | load() no error handling | P0 | S |
| 3 | getApiKey() misses claudeKey | P0 | S |
| 4 | Standup date off by 1 day | P0 | S |
| 5 | Mobile nav hides Nonprofits & CRM | P1 | M |
| 6 | API key via window.prompt() | P1 | M |
| 7 | CRM kanban unreadable on mobile | P1 | M |
| 8 | --muted fails WCAG contrast | P1 | S |
| 9 | Native confirm() for deletes | P1 | S |
| 10 | Duplicate API key resolution | P2 | S |
| 11 | Dynamic modals miss Escape handler | P2 | S |
| 12 | Priority badge shows raw enum | P2 | XS |
| 13 | Seed data has past sprint dates | P2 | S |
| 14 | saveSprint() accepts empty dates | P2 | S |
| 15 | Burndown gaps between completions | P2 | M |
| 16 | Wrong model ID in Sprint Planner | P2 | XS |
| 17 | Log Activity uses window.prompt() | P3 | S |
| 18 | Burndown SVG too small | P3 | S |
| 19 | Pink/purple pillar adjacency | P3 | S |
