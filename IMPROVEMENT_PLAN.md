# Givelink Improvement Plan

Codebase: `givelink.html` (sprint board SPA, ~1,756 lines, vanilla JS)
Reviewed: 2026-06-13 · Branch: `claude/quirky-euler-09uecl`

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. AI Sprint Planner crashes modal on any API error response

**What:** `data.content[0].text.trim()` is called without first checking that `data.content` exists and has at least one element.

**Where:** `givelink.html:1147`

**Why it matters:** Any non-200 response from the Claude API (rate limit, billing, bad key) will cause a `TypeError: Cannot read properties of undefined` that leaves the modal frozen with a spinner and no error message. The user cannot recover without a hard reload.

**Effort:** S

**Suggested fix:**
- Replace `data.content[0].text.trim()` with `data.content?.[0]?.text?.trim()` and throw explicitly if null: `if(!raw) throw new Error('Empty response from Claude');`
- Already done correctly one level down in `callClaudeGL` (line 1270) — replicate the same optional-chain pattern here.

---

### 2. `callClaudeGL()` silently eats API errors — standup, outreach, and AI features fail invisibly

**What:** `callClaudeGL` (the shared AI helper used by standup generator, outreach drafter, and sprint insights) never checks `res.ok` before calling `res.json()`. A 401 (bad key) or 429 (rate limit) returns an Anthropic error JSON body, `data.content?.[0]?.text` resolves to `null`, and the function returns `null` with no user feedback.

**Where:** `givelink.html:1263–1271` (`callClaudeGL` function body)

**Why it matters:** If the API key is expired or wrong, three separate features (standup, outreach draft, sprint insights) silently produce nothing. Users assume the app is broken with no recovery path.

**Effort:** S

**Suggested fix:**
- After `const data=await res.json();` add: `if(!res.ok) throw new Error(data?.error?.message||'API error '+res.status);`
- This will fall into the existing `catch(e){toast('AI error: '+e.message);return null;}` at line 1271, surfacing the real error message.
- Add a specific check for 401 to prompt re-entry of the API key.

---

### 3. AI Sprint Planner uses `claude-opus-4-5` — model ID missing date suffix, likely 400 errors

**What:** The sprint planner hardcodes `model:'claude-opus-4-5'` while every other Claude call in the app uses `'claude-haiku-4-5-20251001'`. Anthropic requires the full versioned identifier; the bare `claude-opus-4-5` form is likely rejected with a 400 and the error body swallowed by the catch at line 1157.

**Where:** `givelink.html:1140`

**Why it matters:** The AI Sprint Planner is the highest-value AI feature in Givelink. If the model ID is invalid, every generation attempt fails.

**Effort:** S

**Suggested fix:**
- Change to a valid, pinned model ID — `'claude-sonnet-4-6'` is a sensible choice (lower cost than Opus, capable enough for sprint planning).
- Extract the model constant to a single top-level variable (e.g. `const GL_AI_MODEL='claude-sonnet-4-6'`) and reference it in both `generateSprintPlan()` (line 1140) and `callClaudeGL()` (line 1256) to prevent future drift.

---

### 4. CRM Kanban 6-column grid is unusable on mobile — no responsive breakpoint

**What:** `.crm-kanban` is a 6-column CSS grid (line 197) where each `.crm-col` has `min-width:160px` (line 198). The `@media(max-width:768px)` block at line 155 never overrides this grid, so the CRM view requires ~960px minimum width on a phone — it just overflows with no scroll affordance and no column labels visible.

**Where:** `givelink.html:197–198`, `givelink.html:155–175` (mobile media query block)

**Why it matters:** The CRM is a core daily-use feature for nonprofit pipeline management. On mobile it is completely broken.

**Effort:** S

**Suggested fix:**
- Inside the `@media(max-width:768px)` block, add: `.crm-kanban{grid-template-columns:1fr 1fr;overflow-x:auto;}`
- At `max-width:480px` collapse to `.crm-kanban{grid-template-columns:1fr;}` and add a stage filter tab so users can switch between pipeline stages instead of scrolling horizontally.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. `--accent` is Tailwind blue `#3b82f6` — entire UI diverges from brand purple palette

**What:** Every interactive element (active nav indicator, progress fills, focus rings, FAB, sprint bar, goal tags, badges, button backgrounds) uses `--accent:#3b82f6` — Tailwind's `blue-500`. The Givelink brand palette is purple (`#6B3FA0` / `#5718CA`). This makes the app look like a generic Tailwind project, not a distinct product.

**Where:** `givelink.html:17` (CSS variable declaration) — cascades to ~60+ use sites via `var(--accent)`

**Why it matters:** Brand trust and product recognition. Every screenshot, demo, and investor deck currently shows a blue app instead of the purple brand.

**Effort:** S

**Suggested fix:**
- Change `:root { --accent:#3b82f6; }` → `--accent:#5718CA;` (or `#6B3FA0` for a softer variant).
- No other changes needed — `var(--accent)` propagates automatically.
- Verify the FAB box-shadow at line 135 and update its rgba color from `rgba(59,130,246,.4)` to `rgba(87,24,202,.4)`.

---

### 6. `theme-color` meta and logo accent are blue — first impression on install is off-brand

**What:** `<meta name="theme-color" content="#3b82f6">` (line 6) and `.logo-main { color:var(--accent) }` (line 25) both use the blue. On Android Chrome, the PWA chrome bar and the task switcher thumbnail display blue, not the brand purple.

**Where:** `givelink.html:6` (meta tag), `givelink.html:25` (logo CSS)

**Why it matters:** The first thing a user sees after installing the PWA is the brand color in the OS shell. Getting it wrong undermines brand recall. Fixed in 30 seconds once item 5 above is done.

**Effort:** S

**Suggested fix:**
- Update meta tag: `<meta name="theme-color" content="#5718CA">`
- `manifest-givelink.json` `theme_color` and `background_color` should also be updated to `#5718CA` / `#070d1a` respectively to match.

---

### 7. Update banner uses off-brand green `#22c55e` — violates no-pink-on-purple rule's spirit

**What:** The update-available banner (line 1738) uses `background:#22c55e; color:#000` — a hard-coded Tailwind green with black text. It collides with the brand palette and the reload button within it uses `background:#000; color:#22c55e` which will look wrong once the overall accent is purple.

**Where:** `givelink.html:1738–1742`

**Why it matters:** Every time the app updates, this banner appears prominently at the top of the screen for all users. It's a high-visibility surface that should reinforce brand, not break it.

**Effort:** S

**Suggested fix:**
- Change to `background:var(--accent); color:#fff;` (or `background:#5718CA; color:#fff;`).
- Inner reload button: `background:rgba(255,255,255,.15); color:#fff; border:1px solid rgba(255,255,255,.3);`

---

### 8. `syncToTaskOS()` has no loading indicator — users spam-click thinking it's not working

**What:** The Task OS sync button triggers `syncToTaskOS()` (line 1206) which runs synchronously but still does localStorage reads, array operations, and a stringify on potentially large data sets. There is zero visual feedback between click and the final toast at line 1250.

**Where:** `givelink.html:1206–1251` (`syncToTaskOS` function), sync button in the sprint bar

**Why it matters:** Without feedback, users click multiple times, potentially triggering duplicate task pushes. The toast says "Synced 0 tasks" when tasks already exist (matched by title), which looks like a failure.

**Effort:** S

**Suggested fix:**
- Disable the sync button and change its label to "Syncing..." at the start of the function; restore on completion.
- If `synced === 0`, change the toast to `'Already up to date ✅'` so users understand what happened.

---

### 9. CRM contact email field has no format validation — dirty data enters the pipeline

**What:** The "Contact Email" input in the nonprofit CRM modal accepts any string. There is no `type="email"` attribute and no validation on save. The CRM outreach generator then potentially uses a malformed email address as context.

**Where:** `givelink.html` — CRM nonprofit modal (the `_showNPModal()` function, ~line 1370), email `<input>` element

**Why it matters:** Outreach emails sent to invalid addresses will bounce. More importantly, the AI outreach generator uses `contactEmail` in its prompt — garbled emails degrade the quality of generated copy.

**Effort:** S

**Suggested fix:**
- Add `type="email"` to the contact email input (free browser-level validation).
- In `saveNP()`, add: `if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Enter a valid email address.');return;}`

---

### 10. Install banner "Add to Home Screen" button has `color:#0d1117` on a blue background — will break after brand fix

**What:** The install CTA button (line 1751) has inline `color:#0d1117` (near-black). This is paired with the current blue `var(--accent)` background and looks passable today. After the accent color switches to dark purple (#5718CA), near-black text on dark purple will have a contrast ratio below 1.5:1 — effectively invisible.

**Where:** `givelink.html:1751`

**Why it matters:** The PWA install prompt is the gateway to retaining power users. A broken CTA here means fewer installs.

**Effort:** S

**Suggested fix:**
- Change inline style to `color:#fff; font-weight:700;` — white on brand purple passes WCAG AA (contrast ~8:1).
- Remove the `color:#0d1117` from the dismiss button at line 1748 too; change to `color:var(--muted)`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `seed()` is 190 lines of inline fixture data mixed into business logic

**What:** The `seed()` function (lines 883–1072) initializes all demo data (tasks, goals, sprints, nonprofits) inline in the JS. It runs on every load with an early-exit guard, but it bloats the logic layer and makes the seed data hard to update without touching business logic.

**Where:** `givelink.html:883–1072`

**Why it matters:** Every refactor risks accidentally touching seed data. When demo data needs updating for sales calls or onboarding, a developer has to navigate 190 lines of interleaved JSON-as-code.

**Effort:** M

**Suggested fix:**
- Extract to a top-of-file `const SEED_DATA = { tasks:[...], goals:[...], nonprofits:[...] }` constant block.
- `seed()` becomes a 10-line function that checks the guard and copies `SEED_DATA` into `S`.
- Long-term: move to a `seed.js` file and load via `<script src="seed.js">` so it can be toggled off in production builds.

---

### 12. Date validation logic duplicated in `saveSprint()` and `confirmNewSprint()`

**What:** The check `if(start&&end&&new Date(end)<=new Date(start)){toast('End date must be after start date.');return;}` appears verbatim at line 789 and again at line 825.

**Where:** `givelink.html:789`, `givelink.html:825`

**Why it matters:** If the validation message or logic changes (e.g. same-day sprints allowed), it must be updated in two places. Classic DRY violation.

**Effort:** S

**Suggested fix:**
- Extract to: `function validateSprintDates(start,end){if(start&&end&&new Date(end)<=new Date(start)){toast('End date must be after start date.');return false;}return true;}`
- Call in both `saveSprint()` and `confirmNewSprint()`.

---

### 13. Sprint completion color formula duplicated three times

**What:** The inline ternary `rate>=70?'var(--done)':rate>=40?'#fbbf24':'var(--block)'` (or close variants) appears at lines 802, 860, and within `renderOverview()`. Each uses slightly different thresholds or color references.

**Where:** `givelink.html:802`, `givelink.html:860`

**Why it matters:** Threshold drift — the three copies have diverged in subtle ways (one uses `#fbbf24` directly, another uses `var(--prog)`). Every future change requires hunting down all three copies.

**Effort:** S

**Suggested fix:**
- Add a helper: `function completionColor(pct){return pct>=70?'var(--done)':pct>=40?'var(--prog)':'var(--block)';}`
- Replace all three inline ternaries with `completionColor(rate)`.

---

### 14. API key retrieval has two divergent code paths

**What:** The AI Sprint Planner has its own `getApiKey()` helper (lines 1075–1088) that checks multiple localStorage keys and offers a prompt. `callClaudeGL()` (line 1257–1262) duplicates this logic inline with subtly different key names (`taskos_api_key` vs `taskos_claude_key` fallback chain). A user who saves their key via one path may find it absent via the other.

**Where:** `givelink.html:1075–1088` vs `givelink.html:1257–1262`

**Why it matters:** Users report "API key required" even after entering their key — this is likely caused by path divergence. It erodes trust in the AI features.

**Effort:** S

**Suggested fix:**
- Consolidate into a single `getApiKey()` function with the full lookup chain and the `window.prompt()` fallback.
- Remove the inline version in `callClaudeGL` and call `getApiKey()` there instead.
- Standardize on one localStorage key: `taskos_claude_key` (matching Task OS convention).

---

### 15. Service worker `register()` has no `.catch()` — silent failures on restricted origins

**What:** `navigator.serviceWorker.register('./sw.js')` at line 1721 has no `.catch()` handler. On HTTP origins, cross-origin iframes, or some iOS WebViews, this throws a DOMException that is swallowed.

**Where:** `givelink.html:1721`

**Why it matters:** When the SW fails to register, offline support and update detection silently break. The developer gets no signal when this happens in production.

**Effort:** S

**Suggested fix:**
- Add `.catch(err=>console.warn('SW registration failed:',err))` — a `console.warn` is appropriate here (not a user-facing toast) since offline is an enhancement, not a core feature.

---

### 16. Backdrop `click` listeners on modals run at parse time — dynamic modals get none

**What:** Line 875 runs `document.querySelectorAll('.mo').forEach(...)` at script parse time to wire up backdrop-close. Any modals created dynamically at runtime (standup modal, outreach modal, sprint AI modal) are built via `document.createElement()` and appended after this runs — they never get the backdrop listener.

**Where:** `givelink.html:875`

**Why it matters:** Users clicking outside a dynamically-created modal expect it to close (standard UX pattern). Currently it doesn't. This is inconsistent with the statically-defined modals which do close on backdrop click.

**Effort:** S

**Suggested fix:**
- Replace the `querySelectorAll` loop with a single delegated listener: `document.addEventListener('click',e=>{if(e.target.classList.contains('mo')){e.target.classList.add('hidden');editId=null;}});`
- Remove the existing loop at line 875.

---

## 💡 P3 — Nice to have

---

### 17. FAB and all ×-dismiss buttons missing `aria-label`

**What:** The floating action button (line 135, renders `+`) and every modal close button (`×` at lines 1741, 1748, and the sprint settings close button) have no `aria-label`. Screen readers announce them as "plus" or "times" with no context.

**Where:** `givelink.html:135` (FAB), `givelink.html:1741`, `givelink.html:1748`, all `<button class="mc">` elements

**Effort:** S

**Suggested fix:**
- FAB: `<button class="fab" aria-label="Add task" ...>`
- Close buttons: `aria-label="Close"` on each `<button class="mc">` and the install/update dismiss buttons.

---

### 18. Filter tab `<div>` elements are not keyboard-navigable

**What:** All filter tabs (pillar filter, status filter, etc.) are `<div class="ftab">` with `onclick` handlers. They receive no keyboard focus, have no `role`, and cannot be activated with Enter or Space.

**Where:** `givelink.html:138–140` (CSS), all `.ftab` elements throughout the view HTML

**Effort:** M

**Suggested fix:**
- Change `<div class="ftab">` → `<button class="ftab" type="button">` (no JS changes needed; existing `onclick` handlers work on buttons).
- Add `role="tablist"` to the `.ftabs` container and `role="tab"` + `aria-selected` to each tab.

---

### 19. CRM stage colors are all off-brand

**What:** `CRM_STAGE_COLOR` at line 1279 maps pipeline stages to six colors: `#64748b` (slate), `#60a5fa` (blue), `#fbbf24` (amber), `#a78bfa` (violet), `#22c55e` (green), `#ef4444` (red). None use the brand purple. The "Won" stage (the most positive outcome) is shown in green — which works semantically but is 100% off-brand.

**Where:** `givelink.html:1279`

**Effort:** S

**Suggested fix:**
- Map the positive/active stages to brand purples: `lead:'#4e6180'`, `contacted:'#6B3FA0'`, `meeting:'#5718CA'`, `proposal:'#C2185B'` (brand pink for urgency), `won:'var(--done)'`, `lost:'var(--block)'`.
- This satisfies the no-pink-on-purple rule because pink (#C2185B) is only used for "Proposal" stage cards which have a dark `var(--sf)` background.

---

### 20. `<label>` elements in modals are not associated with their inputs via `for`/`id`

**What:** Throughout the task-add and goal-edit modals, `<label>` tags are visual labels only — they have no `for` attribute and the paired `<input>` elements have no `id`. Clicking a label does not focus its input, and screen readers cannot associate them.

**Where:** All modal `<label>` + `<input>` pairs, e.g. around lines 318–361 (task modal)

**Effort:** M

**Suggested fix:**
- Add `id` attributes to each input (`id="t-title"`, `id="t-notes"`, etc.) and matching `for` attributes to each label (`<label for="t-title">`).
- This is a find-and-replace across ~15 input/label pairs in the modal HTML.

---

## Summary

| # | Item | Tier | Effort |
|---|------|------|--------|
| 1 | Unguarded `data.content[0]` crashes sprint planner modal | P0 | S |
| 2 | `callClaudeGL` silently drops API errors | P0 | S |
| 3 | `claude-opus-4-5` missing date suffix → 400 errors | P0 | S |
| 4 | CRM Kanban 6-col grid unusable on mobile | P0 | S |
| 5 | `--accent` is blue not brand purple | P1 | S |
| 6 | `theme-color` meta and manifest off-brand | P1 | S |
| 7 | Update banner off-brand green | P1 | S |
| 8 | `syncToTaskOS()` no loading feedback | P1 | S |
| 9 | CRM email field no format validation | P1 | S |
| 10 | Install button text color will break after brand fix | P1 | S |
| 11 | `seed()` 190-line inline fixture data | P2 | M |
| 12 | Date validation duplicated in two sprint functions | P2 | S |
| 13 | Completion color formula duplicated 3× | P2 | S |
| 14 | Two divergent API key retrieval code paths | P2 | S |
| 15 | Service worker `register()` no `.catch()` | P2 | S |
| 16 | Modal backdrop listeners miss dynamic modals | P2 | S |
| 17 | FAB and ×-buttons missing `aria-label` | P3 | S |
| 18 | Filter tabs not keyboard-navigable | P3 | M |
| 19 | CRM stage colors all off-brand | P3 | S |
| 20 | Labels not associated with inputs via `for`/`id` | P3 | M |
