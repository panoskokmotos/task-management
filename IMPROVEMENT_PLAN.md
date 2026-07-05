# Givelink Improvement Plan

_Scanned: 2026-07-05 · Scope: `index.html`, `givelink.html`, `sw.js`, `vercel.json`, `manifest-givelink.json`_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. AI Sprint Planner calls a non-existent model and always errors
- **What:** `runAiSprintPlanner` sends `model: 'claude-opus-4-5'` — this model ID does not exist; the API returns a 400/404 on every call.
- **Where:** `givelink.html:1140`
- **Why it matters:** The AI Sprint Planner button is prominently placed in the top bar. Every user who clicks it sees an error. The feature is 100% broken in production.
- **Effort:** S
- **Suggested fix:**
  - Change `model:'claude-opus-4-5'` → `model:'claude-haiku-4-5-20251001'` (fast, cheap, sufficient for planning) or `model:'claude-sonnet-5'` for higher quality.
  - Confirm the model string matches an active Claude API model before shipping any AI feature.

---

### 2. CSP blocks Google Fonts — Inter font never loads on production
- **What:** `index.html` loads Inter from `https://fonts.googleapis.com`, but the Vercel CSP has `style-src 'self' 'unsafe-inline'` and `font-src 'self'` — both Google Fonts CDN origins are absent.
- **Where:** `vercel.json:14`, `index.html:12–14`
- **Why it matters:** On the live site, Task OS falls back to the system font stack. The entire typographic design (Inter 400–800) is invisible to real users while looking fine in local dev.
- **Effort:** S
- **Suggested fix:**
  - Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` in the CSP header in `vercel.json`.
  - Alternatively, self-host the Inter woff2 files and eliminate the external dependency.

---

### 3. CRM nonprofit modal loses Delete / Log Activity / Advance Stage buttons permanently
- **What:** `_showNPModal` creates the modal element only once using `document.createElement`, rendering footer buttons conditionally based on `editNpId` at creation time. If "Add Org" is clicked first (`editNpId = null`), the modal is created without Delete / Log Activity / Next Stage buttons. All subsequent "Edit" clicks reuse the same element — the buttons are never rendered.
- **Where:** `givelink.html:1358–1401`
- **Why it matters:** In a fresh session, "+ Add Org" is a natural first action. After that, users literally cannot delete an org, log a sales activity, or advance a CRM stage — the core actions of the CRM feature are gone.
- **Effort:** M
- **Suggested fix:**
  - Move the conditional footer HTML out of the one-time `createElement` block and into a dedicated `_updateNPModalFooter()` function called every time `_showNPModal` runs.
  - Or: always render all three buttons and set `style.display` based on `editNpId` on each show.
  - Test by clicking "+ Add Org" first, closing, then clicking an existing org card.

---

### 4. `callClaudeGL` silently swallows HTTP error details
- **What:** `callClaudeGL` calls `res.json()` without checking `res.ok`. On 401 (bad key), 429 (rate limit), or 500 errors, `data.content?.[0]?.text` is undefined and the toast shows "AI error: undefined" — no useful information.
- **Where:** `givelink.html:1264–1272`
- **Why it matters:** Standup generation and outreach email drafting both use this function. Users with an invalid or expired API key see no actionable error — "undefined" sends them nowhere.
- **Effort:** S
- **Suggested fix:**
  - After `const data=await res.json()`, add: `if(!res.ok){const msg=data?.error?.message||res.statusText; throw new Error(msg);}` — matching the pattern already used in `runAiSprintPlanner` at line 1145.

---

### 5. Service worker push notification references a non-existent icon path
- **What:** `sw.js:38–39` sets `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'`. The `icons/` directory does not exist — only `icon.svg` and `icon-gl.svg` are present.
- **Where:** `sw.js:38–39`
- **Why it matters:** Any push notification (task reminders, updates) will show with a broken/blank icon on Android and some desktop browsers. Broken icons erode app credibility at the moment of highest user visibility.
- **Effort:** S
- **Suggested fix:**
  - Change both paths to `'./icon.svg'`. SVG is supported as a notification icon on modern browsers.
  - Long-term: add proper 192×192 and 512×512 PNG icons and reference those.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. givelink.html uses blue (#3b82f6) everywhere — wrong brand color
- **What:** The entire Givelink Sprint Board uses `--accent:#3b82f6` (Tailwind blue-500) for every interactive element — buttons, active states, sprint progress, focus rings. The brand palette is purple (`#6B3FA0` / `#5718CA`). The two apps feel like different products.
- **Where:** `givelink.html:17` (CSS vars), `givelink.html:6` (`<meta name="theme-color">`), `manifest-givelink.json:8`
- **Why it matters:** Any investor demo, nonprofit onboarding, or user who switches between Task OS and the Sprint Board sees a jarring color shift. Brand inconsistency signals immaturity.
- **Effort:** M
- **Suggested fix:**
  - Change `--accent:#3b82f6` → `--accent:#8b7cff` (matching Task OS `--brand`) in givelink.html's `:root`.
  - Update `<meta name="theme-color" content="#3b82f6">` → `#8b7cff` and the same in `manifest-givelink.json`.
  - Spot-check the pillar color `--pr:#f472b6` (pink) doesn't land on purple backgrounds — swap to a less saturated rose if needed.

---

### 7. CRM Kanban is unusable on mobile — 6 equal columns, no breakpoint
- **What:** `.crm-kanban` uses `grid-template-columns:repeat(6,1fr)` with no mobile override. On a 390px iPhone, each column is ~60px wide — card names are fully clipped.
- **Where:** `givelink.html:197–198`
- **Why it matters:** The CRM is a key sales-tracking tool used in the field. Unusable on mobile means it can't be updated after meetings, which is exactly when you need it.
- **Effort:** S
- **Suggested fix:**
  - Add to the existing `@media(max-width:768px)` block: `.crm-kanban{grid-template-columns:1fr 1fr 1fr; overflow-x:auto;}` — 3 columns with scroll, or use `min-width:160px` on `.crm-col` and `overflow-x:auto` on the container for free horizontal scroll.

---

### 8. `window.prompt()` used for API key entry and activity logging — broken on mobile
- **What:** `getApiKey()` uses `window.prompt('Enter your Anthropic API key:')` to collect a sensitive credential. `logActivityNP()` uses `window.prompt('Log activity...')` for CRM notes. Both are native blocking dialogs.
- **Where:** `givelink.html:1086`, `givelink.html:1431`
- **Why it matters:** `window.prompt` is blocked by default in Safari on iOS in many contexts. Even where it works, it offers no password masking, no validation, and an abrupt UX. The API key is entered in plain text in a system dialog.
- **Effort:** M
- **Suggested fix:**
  - For API key: add a small settings panel (or inline input in the Sprint Settings modal) with `type="password"`. Store with the same localStorage key.
  - For activity log: add a text input + "Log" button inline inside the NP modal footer, replacing the prompt.

---

### 9. All Givelink sprint data exists only in localStorage — one browser clear = total data loss
- **What:** `givelink.html` stores everything (sprint goals, tasks, CRM pipeline, past sprints) in a single localStorage key `givelink_sprint`. There is no export, backup, or cloud sync. Task OS has a Supabase sync path; Givelink has none.
- **Where:** `givelink.html:447–448`
- **Why it matters:** A year of sprint history, nonprofit pipeline, and CRM notes is destroyed by "Clear browser data." This is business-critical data. The Supabase schema in `supabase-setup.sql` already exists but isn't wired up.
- **Effort:** M
- **Suggested fix:**
  - Immediately: add a "📤 Export JSON" button in Sprint Settings that downloads `JSON.stringify(S)`.
  - Short-term: wire givelink.html to the same Supabase sync that Task OS uses (the schema is already there).

---

### 10. Mobile bottom nav omits Nonprofits, CRM, Ops, and Past Sprints
- **What:** The bottom nav in givelink.html has 5 slots: Overview, Growth, Product, Execution, Backlog. Nonprofits, Smooth Ops, CRM, Past Sprints, and Sprint Settings are only reachable via the sidebar drawer — which requires tapping the hamburger, then scrolling.
- **Where:** `givelink.html:307–312`
- **Why it matters:** Nonprofits is the second most important pillar. The CRM is a primary daily feature. Both are effectively hidden on mobile.
- **Effort:** M
- **Suggested fix:**
  - Replace "Backlog" in the bottom nav with a "More ⋯" button that opens a full-screen sheet listing all remaining views (identical pattern to index.html's `#more-nav-modal`).
  - Or: make the bottom nav scrollable horizontally with all 6 pillars + CRM.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Priority badge in task cards shows raw key ("high") not the label ("High")
- **What:** `taskHTML` renders `${t.priority||'medium'}` for the priority badge text, but `goalHTML` correctly uses `${PRI[t.priority]?.l||'Todo'}`. Task cards show lowercase raw enum values; goal cards show formatted labels.
- **Where:** `givelink.html:667`
- **Why it matters:** Visual inconsistency between goal cards and task cards in the same view. Low-effort fix, high polish impact.
- **Effort:** S
- **Suggested fix:**
  - Change line 667: `<span class="badge ${PRI[t.priority]?.cls||'pri-med'}">${PRI[t.priority]?.l||'Medium'}</span>`

---

### 12. Burndown snapshots only trigger on `toggleDone`, not on task save or sprint move
- **What:** `_recordSnapshot()` is only called from `toggleDone`. Editing a task's status to "done" via the modal (`saveTask`), or moving a task from backlog to sprint (`moveSprint`), doesn't record a snapshot. The burndown chart misses completion events.
- **Where:** `givelink.html:729` (`saveTask`), `givelink.html:741` (`moveSprint`), `givelink.html:737` (only call site)
- **Why it matters:** The burndown is the sprint health signal. If it's stale it gives a false picture — leading to missed sprint adjustments.
- **Effort:** S
- **Suggested fix:**
  - Add `_recordSnapshot();` at the end of `saveTask` (after `save()`) and at the end of `moveSprint`.

---

### 13. AI standup prompt hardcodes the name "Panos" — not configurable
- **What:** `generateStandup` prompt begins "Generate a daily standup for **Panos**, founder of Givelink". Any other user of the app gets standup notes authored for someone else.
- **Where:** `givelink.html:1492`
- **Why it matters:** The app is positioned as a team tool. The moment a second person (Fanos? Alex?) uses it, the standup is wrong. Also surfaces if shared in a demo.
- **Effort:** S
- **Suggested fix:**
  - Read the name from `S.sprint.ownerName` (add a field to Sprint Settings), defaulting to `'the founder'` if unset.
  - One-line change: `const ownerName = S.sprint.ownerName || 'the founder';` and substitute into the prompt.

---

### 14. `load()` doesn't catch `JSON.parse` failure — corrupted localStorage crashes the app silently
- **What:** `function load(){const d=localStorage.getItem('givelink_sprint');if(d){const p=JSON.parse(d);S={...S,...p};}}` — if `d` is malformed JSON (partial write, storage corruption, tampering), `JSON.parse` throws an uncaught exception and the app renders blank.
- **Where:** `givelink.html:448`
- **Why it matters:** localStorage can get corrupted. A broken app with no error message is worse than a reset; users assume the app is down and churn.
- **Effort:** S
- **Suggested fix:**
  ```js
  function load(){
    const d=localStorage.getItem('givelink_sprint');
    if(!d)return;
    try{const p=JSON.parse(d);S={...S,...p};}
    catch(e){console.warn('State corrupted, starting fresh',e);}
  }
  ```

---

### 15. `syncToTaskOS` deduplicates by title match across all Task OS tasks, including completed
- **What:** The sync skips pushing a Givelink backlog task if any Task OS task with the same lowercase title exists — even if it's already marked done. A recurring task (e.g. "Weekly KPIs evaluation") will never re-sync after its first completion.
- **Where:** `givelink.html:1233–1236`
- **Why it matters:** Recurring action items silently stop syncing. The operator won't notice until they've missed several cycles.
- **Effort:** M
- **Suggested fix:**
  - Filter the dedup check to active (non-done) tasks only: `tosData.tasks.some(tt=>tt.status!=='done'&&tt.title?.toLowerCase()===gt.title.toLowerCase())`.
  - Longer-term: track synced task IDs in a `Set` rather than relying on title matching.

---

## 💡 P3 — Nice to have

### 16. CSP allows `'unsafe-inline'` for scripts — weakens XSS protection
- **What:** `vercel.json` sets `script-src 'self' 'unsafe-inline'`, which allows any inline `<script>` to execute. This is necessary given the single-file architecture but it negates most of the XSS benefit of having a CSP at all.
- **Where:** `vercel.json:14`
- **Why it matters:** If an XSS vector is introduced (e.g. a user-controlled URL that ends up in innerHTML without escaping), the CSP won't stop it. The `esc()` function is used consistently, but one miss is enough.
- **Effort:** L
- **Suggested fix:**
  - Extract all `<script>` blocks from both HTML files to external `.js` files, remove `'unsafe-inline'`, and add `'nonce-...'` or hash-based CSP.

---

### 17. Custom checkboxes and interactive cards lack ARIA roles
- **What:** `.gcheck`, `.ck2` checkboxes in givelink.html are `<div>` elements with `onclick` but no `role="checkbox"`, `aria-checked`, or keyboard (`Enter`/`Space`) support. Goal cards have `onclick` but no `role="button"`.
- **Where:** `givelink.html:65–66` (`.gcheck`), `givelink.html:81` (`.ck2`), `givelink.html:628` (goal card)
- **Why it matters:** Screen reader users cannot interact with the sprint board at all. As Givelink grows toward nonprofit customers (who often have accessibility requirements), this becomes a legal/sales risk.
- **Effort:** M
- **Suggested fix:**
  - Add `role="checkbox"` and `aria-checked="true/false"` to `.gcheck` and `.ck2`.
  - Add `role="button" tabindex="0"` to card containers with `onkeydown` handlers for `Enter`/`Space`.

---

### 18. `icon-gl.svg` marked as both `any` and `maskable` without safe-zone padding
- **What:** `manifest-givelink.json` specifies `"purpose": "any maskable"` for the SVG icon, but maskable icons require the subject to stay within a centered 80% safe zone so Android adaptive icon shapes don't clip it.
- **Where:** `manifest-givelink.json:12–17`
- **Why it matters:** On Android, the icon may be clipped to a circle or squircle, potentially cutting off logo edges.
- **Effort:** S
- **Suggested fix:**
  - Split into two separate icon entries: `{"purpose": "any"}` for the current SVG and `{"purpose": "maskable"}` for a padded version.
  - Or add 10% padding inside the SVG viewBox so the content stays in the safe zone.
