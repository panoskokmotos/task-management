# Givelink / Task OS — Improvement Plan

> Scanned: `index.html` (12,893 lines / 893 KB), `givelink.html` (1,755 lines / 113 KB), `sw.js`
> Repo: panoskokmotos/task-management · branch `claude/quirky-euler-xh5yxd`

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. XSS via unescaped task/goal titles in innerHTML
**What:** `t.title` and `g.title` are interpolated directly into `innerHTML` without `esc()` in at least five rendering functions.  
**Where:**
- `index.html:3005` — `tcHTML()` → `<div class="tt">${t.title}</div>`
- `index.html:3014` — `tcHTML()` → `↳ ${gl.title.slice(0,20)}`
- `index.html:2694` — `inboxHTML()` → `<div class="tt">${t.title}</div>`
- `index.html:2888,2895,2897` — Weekly Review wizard renders `${t.title}` and `${g.title}` verbatim
- `index.html:2776` — Eisenhower view bucket card `${t.title}`  

**Why it matters:** A task titled `<img src=x onerror=alert(document.cookie)>` executes JavaScript. With Supabase sync enabled, a malicious payload could arrive from the cloud and auto-execute on load. The `esc()` helper already exists at line 9773 — it's just not being called consistently.  
**Effort:** S  
**Suggested fix:**
- Replace every bare `${t.title}` / `${g.title}` inside an HTML template literal with `${esc(t.title)}` / `${esc(g.title)}`
- Add a `grep -n 'innerHTML.*\.title' index.html` pass to catch any remaining instances
- Note: `inboxHTML()` correctly uses `esc()` in some places (e.g. people selector at line 3049) — apply the same pattern throughout

---

### 2. Claude API key leaked into Supabase sync blob
**What:** `S.claudeKey` (line 2036) is a first-class field on the global state object. `sbPush()` at line 8608 sends `data: S` verbatim to Supabase — the API key travels over the wire and is stored in the `app_state` table as plain JSON.  
**Where:** `index.html:8608` — `const body=[{user_id:_SB.uid,data:S,updated_at:...}]`  
**Why it matters:** Anyone with Supabase read access (DB backups, Supabase Dashboard, compromised credentials) can extract the Anthropic API key. If Claude usage limits are shared across a team, one leaked key can drain the budget.  
**Effort:** S  
**Suggested fix:**
- Move `claudeKey` out of `S` into a dedicated `localStorage` key (`taskos_claude_key`) that is never part of the sync blob
- In `sbPush()`, strip sensitive fields before syncing: `const {claudeKey, ...safeS} = S; data: safeS`
- Update `saveSettings()` (line 8505) and `callClaude()` (line 4134) to read from the new key

---

### 3. Push notification icon 404s — notifications broken silently
**What:** `sw.js` lines 36–37 reference `./icons/icon-192.png` as both `icon` and `badge` for push notifications. The `icons/` directory does not exist; only `icon.svg` and `icon-gl.svg` are present.  
**Where:** `sw.js:36-37`  
**Why it matters:** Every `ntfy.sh` push notification (reminders, habit nudges, EOD prompts) shows a broken/default icon on all platforms. Notifications are a key retention mechanism.  
**Effort:** S  
**Suggested fix:**
- Either create `icons/icon-192.png` from the existing SVG (add to `manifest.json` too), or
- Update `sw.js:36-37` to point to `'./icon.svg'` for both `icon` and `badge`
- Verify the manifest.json `icons` array is consistent with what `sw.js` references

---

### 4. `closeModal()` misses focus-trap release and scroll-lock fix
**What:** Two functions close modals: `closeM()` (line 3391) properly calls `_releaseFocus()`, resets `editT/editG`, and removes `body.modal-open`; `closeModal()` (line 10584) is just `el?.classList.add('hidden')`. The win modal at line 10177 calls `closeModal('win-modal')`, leaving `body.modal-open` set — subsequent page scrolling is locked.  
**Where:** `index.html:10177` — `save();closeModal('win-modal');renderWins();`; `index.html:10584`  
**Why it matters:** After logging a win (a frequent daily action), the app body scroll stays locked. Users must reload to unfreeze the page.  
**Effort:** S  
**Suggested fix:**
- Replace `closeModal('win-modal')` on line 10177 with `closeM('win-modal')`
- Audit for any other `closeModal()` call sites and migrate them to `closeM()`
- Consider deleting `closeModal()` entirely to prevent future confusion

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Givelink brand palette is absent from the entire codebase
**What:** Givelink's identity colors (purple `#6B3FA0` / `#5718CA`, pink `#C2185B` / `#E353B6`) appear **nowhere** in the codebase. `givelink.html` uses `--accent:#3b82f6` (generic blue) and `--pr:#f472b6` (off-brand pink); `index.html` uses `--accent:#58a6ff` (GitHub blue). The no-pink-on-purple rule cannot even be tested because the specified brand colors don't exist.  
**Where:** `givelink.html:15-20` (CSS variables block); `index.html:19-26`  
**Why it matters:** A nonprofit-facing SaaS product using a personal-productivity blue palette sends mixed signals to donors and NPO partners. Brand coherence is table-stakes for sales credibility.  
**Effort:** M  
**Suggested fix:**
- Add Givelink brand tokens to `givelink.html` CSS: `--brand-purple:#5718CA; --brand-pink:#C2185B; --accent:var(--brand-purple)`
- Replace `#3b82f6` accent with `--brand-purple` throughout `givelink.html`
- Replace the Givelink sidebar link in `index.html` (line 533) `#a78bfa` color with `--brand-purple` token
- Enforce no-pink-on-purple: in `givelink.html`, the Product pillar dot (`--pr:#f472b6` pink, line 237) and Ops pillar dot (`--op:#a78bfa` purple, line 239) appear side by side — swap one to a neutral color

---

### 6. Notion Weekly Notes fetch always fails (CORS) — feature is permanently broken
**What:** `fetchFromNotion()` at line 8929 calls `fetch('https://api.notion.com/v1/blocks/...')` directly from the browser. Notion's API does not include CORS headers for browser origins, so this fails 100% of the time. The error handler at line 8943 correctly detects the `TypeError` and shows a workaround, but the feature has never worked without a proxy.  
**Where:** `index.html:8929-8948`  
**Why it matters:** Weekly Notes with Notion sync is a visible feature in Settings (line 1570) and the sidebar (`📝 Weekly Notes`). Users who configure it expect it to work. Consistent silent failure erodes trust in other integrations.  
**Effort:** M  
**Suggested fix:**
- Remove the broken `fetch()` call entirely and replace the import button with a "Paste from Notion Export" textarea (Notion exports to Markdown)
- Or proxy through a lightweight Vercel Edge Function (one file) that forwards the request server-side — Vercel is already in use
- In the interim, update the UI label from "📥 Fetch from Notion" to "📋 Paste Notion Export" to set correct expectations

---

### 7. `givelink.html` AI calls fall back to `window.prompt()` for the API key
**What:** `callClaudeGL()` at line 1257 reads `localStorage.getItem('taskos_api_key')`, falls back to parsing `S.claudeKey` from the main app state, and if still empty calls `window.prompt('Enter Anthropic API key:')` at line 1261. `window.prompt()` is blocked in cross-origin iframes and returns `null` in some PWA contexts; it also bypasses the in-app UI entirely.  
**Where:** `givelink.html:1085-1090`, `givelink.html:1257-1261`  
**Why it matters:** First-time Givelink users (e.g. on mobile standalone) who try AI Sprint Planner or AI Outreach get a jarring native dialog with no context, and on failure the feature silently stops working.  
**Effort:** S  
**Suggested fix:**
- Remove the `window.prompt()` fallback entirely
- If no key is found, show an in-app toast: `"Add your Claude API key in Task OS → Settings, then return here"` with a link to `index.html#settings`
- Both apps already share `localStorage` on the same origin — `callClaudeGL()` already reads `taskos.claudeKey` correctly on line 1259

---

### 8. AI output modal has no copy/save button — results disappear on dismiss
**What:** `showAiOut(title, text)` at line 4150 renders AI results in `#ai-out-modal` using `textContent`. There is no copy-to-clipboard button, no save-to-notes action, and no way to recall previous results. Closing the modal discards the output permanently.  
**Where:** `index.html:4150-4154`  
**Why it matters:** AI Sequence, Goal Digest, Priority Audit, and Pre-Mortem are all high-value outputs that users want to act on over time — not read once in a modal. This is a frequent source of friction given the ~5-second wait to generate.  
**Effort:** S  
**Suggested fix:**
- Add a "📋 Copy" button to `#ai-out-modal` footer that calls `navigator.clipboard.writeText(text)` with a toast confirmation
- Add a "💾 Save to Notes" button that appends the text to `S.weeklyNotes` for the current week
- The modal HTML is at lines 1493–1504; the copy button is a two-line addition

---

### 9. "Storage full" error shows a toast with no recovery CTA
**What:** When `localStorage.setItem('taskos',...)` throws `QuotaExceededError`, `save()` at line 2101 shows a toast: `"⚠️ Storage full! Export your data before adding more."` But the toast is not tappable, `exportData()` is not called, and the failed mutation remains in `S` — so the user's work is lost every time until they manually find the export button.  
**Where:** `index.html:2099-2104`  
**Why it matters:** A power user with 500+ tasks, health logs, and deep-work sessions will eventually hit the ~5MB localStorage limit. The current behavior silently drops data until the user notices inconsistencies — potentially after days.  
**Effort:** S  
**Suggested fix:**
- Replace the plain toast with an in-app modal that auto-triggers: `"Storage is full. Your last change was not saved. Export now to prevent data loss."` + primary "Export JSON" button calling `exportData()`
- After export, offer a "Trim History" option that deletes completed tasks older than 90 days from `S.tasks`
- The quota error is at line 2101: `toast(...)` → `showConfirm(..., exportData, {okLabel:'Export Now', danger:false})`

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `index.html` is 12,893 lines / 893 KB with zero tests
**What:** The entire app — CSS, HTML, and ~9,000 lines of JavaScript — lives in one file. Forty-plus render functions, 403 JS functions total. There are no tests of any kind.  
**Where:** `index.html` (entire file)  
**Why it matters:** Every bug fix risks a regression in another feature. The recent commits show repeated multi-bug hotfixes (#51, #52, #54) which is the signature of a codebase where changes ripple unpredictably.  
**Effort:** L  
**Suggested fix:**
- Don't rewrite — extract strategically. Start by moving the JS `<script>` block to `index.js` and loading it with `<script src="index.js">` (one line change, zero behavior change)
- Then write smoke tests for the three highest-risk functions: `save()`, `toggleDone()`, `sbPush()` using Playwright (already configured via env)
- Future sections can be extracted to `health.js`, `finance.js` etc. without changing the HTML structure

---

### 11. Three parallel task card implementations with diverging feature sets
**What:** Task cards are rendered by `tcHTML()` (line 2999), `inboxHTML()` (line 2690), and ad-hoc template literals in the Weekly Review wizard (lines 2888, 2895). Only `tcHTML()` shows: overdue badges, blocked-by status, checklist progress, and swipe gesture attachment. The others silently omit these.  
**Where:** `index.html:2690`, `index.html:2888,2895`, `index.html:2999`  
**Why it matters:** A blocked overdue task in the inbox shows no warning. Users reviewing inbox items in the weekly wizard miss context that's visible everywhere else. Feature additions to `tcHTML()` must be manually ported to two other places.  
**Effort:** M  
**Suggested fix:**
- Make `inboxHTML()` call `tcHTML()` with a dedicated `showMoveButtons` flag parameter instead of reimplementing the card
- Update the wizard (lines 2888, 2895) to call `tcHTML()` as well — it already returns a string
- This removes ~40 lines and ensures features added to `tcHTML()` propagate automatically

---

### 12. `S.habits` stores names as strings — renaming breaks all historical logs
**What:** Habits are stored in `S.habits` as a plain string array (e.g. `['Exercise','Meditation']`). `toggleHabit(name)` at line 4812 keys `S.habitLogs[date][name]` by name string. Renaming "Exercise" to "Workout" via the habit settings modal creates a new key and orphans all prior log entries — the streak resets to zero.  
**Where:** `index.html:4812-4818` — `toggleHabit(name)`; `index.html:4821` — `openHabitSettings()`  
**Why it matters:** Streak data is a core motivation mechanism. An accidental rename silently destroys months of logged history with no warning.  
**Effort:** M  
**Suggested fix:**
- Migrate `S.habits` to an object array: `[{id: uid(), name: 'Exercise'}, ...]`
- Key `S.habitLogs` by habit ID instead of name: `S.habitLogs[date][habit.id]`
- Write a one-time migration function that runs on load if `typeof S.habits[0] === 'string'` — converts old format to new without data loss

---

### 13. Hardcoded personal context as AI prompt fallback
**What:** Multiple AI functions fall back to `'Panos — Greek founder in his 20s building Givelink (nonprofit fundraising SaaS), targeting financial freedom and a move to San Francisco.'` when `getAboutMe()` returns empty. This appears at line 10184 (`aiSuggestWins`) and at least two other AI functions.  
**Where:** `index.html:10184`; search `'Panos'` in callClaude prompt strings  
**Why it matters:** If `getAboutMe()` is cleared or unset, AI suggestions name a specific person in responses visible to the user — bizarre if the profile name has been changed, and broken for any other user of this codebase.  
**Effort:** S  
**Suggested fix:**
- Replace hardcoded fallback with a generic prompt: `getAboutMe()||'A productivity-focused founder.'`
- Gate AI features that require personal context behind an empty-state check: if `!getAboutMe()`, show `"Add a bio in Settings → About Me for better AI suggestions"` before running

---

### 14. Service worker cache version hardcoded as a date literal
**What:** `sw.js:1` — `const CACHE = 'task-os-20260530'`. Deploying a new version of `index.html` or `givelink.html` without updating this string means users get stale cached HTML, potentially with mismatched JS behavior, until they hard-refresh.  
**Where:** `sw.js:1`  
**Why it matters:** The last 5 commits have all shipped significant changes. Every one of them was deployed with the same cache version string from May 30, 2026, meaning some users may still be running old HTML. The app has no build step, so cache-busting must be done manually.  
**Effort:** S  
**Suggested fix:**
- Replace the static date with a build timestamp injected by Vercel: `const CACHE = 'task-os-{{BUILD_ID}}'` substituted via a Vercel Edge Config or a tiny build script
- Or, simpler: document in the README that `sw.js:1` MUST be updated on every deploy that changes `index.html` or `givelink.html`
- Add a pre-deploy checklist item in `vercel.json` or a Git pre-push hook that validates the date is today's date

---

### 15. Missing ARIA attributes on all interactive navigation elements
**What:** The sidebar `.ni` items, filter pills `.fp`, bottom nav `.bni`, and stat cards `.sc` have no `role`, `aria-label`, `aria-current`, or `tabindex` attributes. Keyboard-only users can tab to these elements but screen readers announce nothing useful.  
**Where:** `index.html:51-54` (`.ni` CSS, repeated in ~50 sidebar items); `index.html:266-272` (`.bni` bottom nav); `index.html:825-836` (filter pills)  
**Why it matters:** WCAG 2.1 AA compliance requires navigable landmarks and labelled controls. More practically, keyboard-nav code already exists (Cmd+K, arrow keys on tasks) — ARIA would surface it to assistive tech users.  
**Effort:** M  
**Suggested fix:**
- Add `role="button"` and `aria-label` to each `.ni` element; mark the active one with `aria-current="page"`
- Change the `.bni` bottom nav from `<button>` with visual-only icons to `<button aria-label="Dashboard">` etc.
- For filter pills, add `role="radio"` and `aria-checked` to match the visual active state

---

## 💡 P3 — Nice to have

### 16. Light theme broken: hundreds of inline hardcoded dark colors
**What:** Throughout the HTML, inline styles use hardcoded dark-theme values: `rgba(88,166,255,.12)`, `color:#fbbf24`, `background:#0d1117`, etc. The `body.light` class switches CSS custom properties but has no effect on inline style attributes — these elements stay dark-mode styled even in light mode.  
**Where:** Throughout `index.html` — e.g. lines 637, 639, 651, 655, 662, 667, 676 (dashboard section alone has ~20 instances)  
**Why it matters:** The light theme toggle (☀️) is prominently surfaced. Users who prefer light mode see a visually broken dashboard with dark cards floating in a light background.  
**Effort:** M  
**Suggested fix:**
- Audit inline styles containing literal hex colors or `rgba()` values and replace with CSS variable references
- Priority: dashboard cards (lines 637–756), dashboard widgets, and the momentum/weekly-theme cards which are entirely hardcoded

---

### 17. `givelink.html` has no service worker — no offline support or update banner
**What:** `index.html` registers `sw.js` at line 8680 and shows an update banner when a new version activates. `givelink.html` has no `navigator.serviceWorker.register()` call anywhere.  
**Where:** `givelink.html` (absent)  
**Why it matters:** Users working in the Givelink sprint board mid-flight (on a train, at a venue) with a spotty connection get a blank page instead of the cached app. They also never see "New version available" banners.  
**Effort:** S  
**Suggested fix:**
- Add service worker registration to `givelink.html` (same `sw.js` already caches `./givelink.html`):
  ```html
  <script>
  if('serviceWorker' in navigator)
    navigator.serviceWorker.register('./sw.js');
  </script>
  ```

---

### 18. `givelink.html` CRM view not accessible from mobile bottom nav
**What:** The mobile bottom nav in `givelink.html` (line 306) has 5 tabs: Overview, Growth, Product, Execution, Backlog. The CRM (nonprofit pipeline) — the most operationally critical view — is only reachable via the hamburger menu on mobile.  
**Where:** `givelink.html:306-312`  
**Why it matters:** Managing the nonprofit pipeline during calls or events is a mobile-first workflow. Requiring two taps to reach CRM (vs. one for a less-used Backlog tab) slows down the core sales motion.  
**Effort:** S  
**Suggested fix:**
- Replace the "Backlog" tab in the bottom nav with "CRM 🏢", routing to `nav('crm')`
- Move Backlog access to the hamburger menu (it's a planning tool, not a real-time operational view)

---

### 19. Readwise highlight import silently truncates at 1,000 highlights
**What:** `loadReadwiseHighlights()` at line 8860 loops `for(let i=0;i<2;i++)` — fetching at most 2 pages × 500 items = 1,000 highlights. Books with more highlights (e.g. heavily annotated nonfiction) are silently truncated.  
**Where:** `index.html:8858-8864`  
**Why it matters:** Users who annotate heavily (500+ highlights per book is not unusual for research books) will import an incomplete set and not know it. AI-generated summaries built from partial highlights will be wrong.  
**Effort:** S  
**Suggested fix:**
- Remove the `i<2` cap and loop until `data.next` is null (already checked on line 8863)
- Add a progress indicator: "Loading highlights… (500 so far)" using `toast()` with each page fetch
- Cap at a reasonable limit (e.g. 2,000) with a visible warning if exceeded

---

### 20. PWA manifest `icons` array is empty — install prompts show no icon
**What:** `manifest.json` does not define an `icons` array at all (it uses only `icon.svg` via `<link rel="apple-touch-icon">`). `manifest-givelink.json` similarly omits a PNG icon set. The `sw.js` references `./icons/icon-192.png` which doesn't exist (see P0 item 3).  
**Where:** `manifest.json`, `manifest-givelink.json`, `sw.js:36`  
**Why it matters:** Chrome and Android PWA install prompts require `icons` with a 192px PNG entry; without it, the install prompt either doesn't appear or shows a blank icon. The iOS apple-touch-icon workaround doesn't help Android.  
**Effort:** S  
**Suggested fix:**
- Export `icon.svg` to `icon-192.png` and `icon-512.png` (Inkscape / ImageMagick one-liner)
- Add to both manifests: `"icons": [{"src": "./icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "./icon-512.png", "sizes": "512x512", "type": "image/png"}]`
- Update `sw.js:36-37` to reference the new paths
