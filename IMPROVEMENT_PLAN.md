# Givelink Improvement Plan

Scanned: `givelink.html` (1 755 lines) · `index.html` (8 592 lines) · `sw.js` · `vercel.json`  
Date: 2026-05-18

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Deprecated model ID crashes AI Sprint Planner
**What:** `runAiSprintPlanner` passes `model:'claude-opus-4-5'` — a model ID that does not exist; the API returns a 400 and the sprint planner never works.  
**Where:** `givelink.html:1140`  
**Why it matters:** The sprint planning feature is completely non-functional for every user who tries it.  
**Effort:** S  
**Suggested fix:**
- Replace `'claude-opus-4-5'` with `'claude-opus-4-7'` (current Opus).
- Centralise the model string as a `const` at the top of the file alongside the `callClaudeGL` default so both callers stay in sync.

---

### 2. `load()` in givelink.html has no error handling — corrupt data crashes the app on startup
**What:** `function load(){const d=localStorage.getItem('givelink_sprint');if(d){const p=JSON.parse(d);S={...S,...p};}}` — if stored JSON is malformed, the uncaught `SyntaxError` stops script execution before any view renders.  
**Where:** `givelink.html:448`  
**Why it matters:** Any single bad write (storage full, interrupted save, browser bug) permanently breaks the app for that user with a blank white screen and no recovery path.  
**Effort:** S  
**Suggested fix:**
- Wrap in `try/catch` matching the pattern already used in `index.html:1762`.
- On catch, `toast('⚠️ Sprint data could not be loaded — using defaults. Export may recover your data.')` and log to console.
- Optionally stash the raw bad string under a `givelink_sprint_corrupt` key so it can be recovered manually.

---

### 3. `window.prompt()` for API key always returns `null` in iOS PWA standalone mode — AI is unreachable
**What:** Three places use blocking `window.prompt()` to collect the API key (`givelink.html:1086`, `givelink.html:1261`) and to log CRM activity (`givelink.html:1431`). iOS Safari in standalone (`display-mode: standalone`) silently returns `null` from `prompt()` without showing any dialog.  
**Where:** `givelink.html:1086`, `1261`, `1431`  
**Why it matters:** Every AI feature (sprint planner, standup, outreach drafts) and CRM activity logging is permanently broken for the primary use case (installed PWA on iPhone).  
**Effort:** M  
**Suggested fix:**
- For API key: render a small in-app modal (reuse the existing `.mo/.md` pattern) with a password `<input>` and a Save button; store the key on confirm.
- For activity log: add a text area inside the NP modal rather than calling `prompt()` after the fact.
- Remove all three `window.prompt()` / `window.confirm()` calls from production paths.

---

### 4. `callClaudeGL` does not check `res.ok` — HTTP errors silently return `null` with no actionable message
**What:** The shared AI helper fetches the Anthropic API then immediately calls `res.json()` without checking `res.ok`. A 401 (bad key), 429 (rate-limited), or 500 response is parsed as an error object; `data.content?.[0]?.text` returns `undefined`; the function returns `null`; callers show "Could not generate. Check your API key." for every error regardless of cause.  
**Where:** `givelink.html:1264–1270`  
**Why it matters:** Users can't tell whether the failure is a wrong key, a rate limit, or a server error — so they can't self-recover. The sprint planner's separate `runAiSprintPlanner` already handles this correctly at line 1145; `callClaudeGL` should match it.  
**Effort:** S  
**Suggested fix:**
- After `const res = await fetch(...)`, add `if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.error?.message||'HTTP '+res.status);}`.
- The existing catch block at line 1271 already toasts `e.message`, so callers will automatically see "Invalid API key" or "Rate limit exceeded".

---

### 5. localStorage quota exceeded silently loses the last user action in Task OS
**What:** `save()` in `index.html:1753` calls `localStorage.setItem(...)` inside try/catch; when quota is exceeded it toasts a warning — but the write already failed, so the triggering action (task creation, goal update, etc.) was never persisted. The user sees the change in the UI but it won't survive a refresh.  
**Where:** `index.html:1753–1760`  
**Why it matters:** Data loss with no undo and no clear signal that the action didn't save. The user finds out on next load.  
**Effort:** M  
**Suggested fix:**
- Before every `setItem`, estimate current payload size: `const bytes = new Blob([JSON.stringify(S)]).size`. If within 10 % of 5 MB, warn proactively.
- On quota error, immediately trigger `exportData()` (already exists at `index.html:1765`) so data is preserved before the session ends.
- Show the toast with a direct "Download backup now →" link rather than a passive warning.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. Pink `--pr:#f472b6` on dark/purple-adjacent backgrounds violates brand rule
**What:** The CSS variable `--pr` (`#f472b6`, hot pink) is used as the Product pillar's pip colour in the sidebar, in pillar header chips, and in the CRM stage-colour map. It appears directly beside `--op` (`#a78bfa`, purple) and on dark navy backgrounds throughout.  
**Where:** `givelink.html:18` (variable declaration), `237` (sidebar pip), `424` (PILLARS const), `1279` (CRM_STAGE_COLOR)  
**Why it matters:** Violates the explicit "no pink on purple" brand rule. The pink/purple collision in the sidebar is visible on every page load and erodes brand polish in investor/nonprofit demos.  
**Effort:** S  
**Suggested fix:**
- Remap `--pr` for the Product pillar to `#3b82f6` (the existing `--accent` blue) or `#06b6d4` (cyan) — something that doesn't collide with `--op`.
- Keep `--pr` in the CSS var list only if another use requires it; otherwise remove it.
- Add a one-line comment in the `:root` block listing the forbidden combinations.

---

### 7. CRM kanban is completely unusable on mobile — 6 fixed-width columns overflow with no scroll cue
**What:** `.crm-kanban` is a CSS grid with `repeat(6,1fr)` and each column has `min-width:160px`, producing a 960 px+ layout that overflows the viewport. There is no `overflow-x: auto` on the container, no sticky stage headers, and no visual indicator that hidden columns exist.  
**Where:** `givelink.html:~198–200` (`.crm-kanban` CSS rule), `givelink.html:~600–620` (renderCRM output)  
**Why it matters:** The CRM is the primary Givelink revenue tracking surface. On a phone it shows only 1–2 columns with no way to reach Won/Lost stages — pipeline health is invisible when away from desk.  
**Effort:** M  
**Suggested fix:**
- Add `overflow-x:auto;-webkit-overflow-scrolling:touch;` to `.crm-kanban`.
- Inside the existing `@media(max-width:768px)` block, set `.crm-kanban{display:flex;flex-direction:row;gap:10px;padding-bottom:16px;}` and `.crm-col{min-width:200px;flex-shrink:0;}`.
- Add a subtle `box-shadow: inset -8px 0 8px -4px var(--border)` on the right edge to hint at horizontal scrollability.

---

### 8. Entire app is inaccessible — only one `aria-label` exists across 1 755 lines
**What:** The only ARIA attribute in `givelink.html` is on the hamburger button (line 218). All nav items are `<div onclick>` with no `role`, modals have no `role="dialog"` or `aria-modal`, icon-only buttons have no `aria-label`, and toast notifications have no `aria-live` region.  
**Where:** `givelink.html:230–260` (nav items), `389` (modals), `452` (toast), throughout  
**Why it matters:** Nonprofit procurement often requires WCAG compliance. A screen-reader user cannot navigate to any feature. Failing basic a11y is also an SEO and legal risk in some markets.  
**Effort:** M  
**Suggested fix:**
- Convert `.ni` nav divs to `<button>` elements with `aria-current="page"` on the active one.
- Add `role="dialog" aria-modal="true" aria-labelledby="[title-id]"` to each `.md` modal.
- Add `aria-live="polite" aria-atomic="true"` to `#toast`.
- Add `aria-label` to all icon-only buttons (FAB, close buttons, pillar filter chips).

---

### 9. Activity logging via `window.prompt()` destroys CRM context — and logs `null` silently
**What:** `logActivityNP()` at `givelink.html:1431` opens a native `prompt()` dialog. The NP detail modal remains open underneath. On dismiss, `if(!note)return` silently exits. On iOS PWA, `prompt()` returns `null` immediately — any tap on "Log Activity" does nothing.  
**Where:** `givelink.html:1431–1442`  
**Why it matters:** Logging donor relationship activity is a core CRM workflow. Silent no-ops during outreach sequences cause missed follow-ups and lost deals.  
**Effort:** S  
**Suggested fix:**
- Add a `<textarea id="np-activity-input">` and a "Save Note" button inside the existing NP modal (near `np-note` at `givelink.html:~1385`).
- On save, push to `np.activityLog` and call `save()`.
- Remove `logActivityNP()` entirely.

---

### 10. Standup and outreach AI prompts hardcode "Panos Evangelou" — wrong for any other user
**What:** `generateStandup()` sends `"Generate a daily standup for Panos"` (line 1492) and `generateOutreach()` sends `"from Panos Evangelou, co-founder of Givelink"` (line 1637). If any other team member uses the app, all AI output is attributed to the wrong person.  
**Where:** `givelink.html:1492`, `1637`  
**Why it matters:** Outreach emails written by AI and sent with the wrong name damage the relationship before it starts. This is low-hanging fruit that also gates the app for multi-user use.  
**Effort:** S  
**Suggested fix:**
- Read the founder name from `S.sprint` (or a new `S.settings.founderName` field that can be set in a settings modal) and interpolate: `` `Generate a daily standup for ${S.settings.founderName||'the founder'}` ``.
- Add a one-field "Your name" setting in the sprint setup modal — same flow as `S.sprint.name`.

---

### 11. No offline feedback — AI features fail silently when the device is offline
**What:** When the device has no connectivity, `fetch('https://api.anthropic.com/...')` throws a `TypeError: Failed to fetch`. `callClaudeGL` catches this and toasts `"AI error: Failed to fetch"` — which is cryptic. The installed PWA (`sw.js`) has no offline fallback page.  
**Where:** `givelink.html:1264–1272`, `sw.js`  
**Why it matters:** PWA users explicitly install the app for mobile/offline use. An unhelpful error during a standup or sprint review erodes trust in the reliability of the tool.  
**Effort:** S  
**Suggested fix:**
- In `callClaudeGL` catch block, detect `!navigator.onLine` and toast `"You're offline — AI features need a connection."` instead of the raw error.
- In `sw.js`, register a minimal offline fallback for navigation requests (the existing SW doesn't cache anything).

---

### 12. Deprecated `document.execCommand('copy')` clipboard fallback will silently fail in Firefox
**What:** `copyStandup()` at `givelink.html:1521` and `generateOutreach()` at `givelink.html:1621` use `document.execCommand('copy')` as a clipboard fallback. This method is deprecated, removed from Firefox strict mode, and broken inside iframes (e.g., embedded demos).  
**Where:** `givelink.html:1521–1523`, `1621–1623`  
**Why it matters:** Copying standup text to Slack and copying outreach emails are the primary outputs of two AI features. A broken copy button at the end of the flow wastes the entire AI call.  
**Effort:** S  
**Suggested fix:**
- Replace the fallback with a `<textarea>` that is pre-selected and an instruction tooltip: `"Press Ctrl/Cmd+C to copy"`.
- Or simply surface a `<pre>` element with `user-select:all` styling so the user can triple-click and copy manually.
- The `navigator.clipboard.writeText` primary path is already correct; only the catch branch needs fixing.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 13. API key lookup logic is duplicated in `getApiKey()` and `callClaudeGL()` — they will diverge
**What:** Two functions independently implement the same 4-step key resolution: taskos_profiles → taskos.claudeKey → taskos_api_key → prompt user. `getApiKey()` is used by the sprint planner; `callClaudeGL()` re-implements it inline for all other features.  
**Where:** `givelink.html:1075–1090` (`getApiKey`), `givelink.html:1257–1262` (inline in `callClaudeGL`)  
**Why it matters:** The next time the key storage location changes (e.g., adding a per-profile key) the fix will need to be applied in two places and one will be missed.  
**Effort:** S  
**Suggested fix:**
- Delete the inline key lookup from `callClaudeGL` and replace it with a call to `getApiKey()`.
- Move `getApiKey()` above `callClaudeGL` in the file.

---

### 14. AI model IDs are raw string literals in three separate call sites
**What:** Model names appear as string literals: `'claude-opus-4-5'` at `givelink.html:1140`, `'claude-haiku-4-5-20251001'` at `givelink.html:1256` and `1660`, and various strings in `index.html:~3400`. When a model is deprecated the change requires a grep-and-replace across both files.  
**Where:** `givelink.html:1140`, `1256`, `1660`; `index.html:~3400`  
**Why it matters:** Model `claude-opus-4-5` is already wrong (P0 item 1). The haiku ID will also need updating on the next model release. String literals make this a risky multi-file edit under pressure.  
**Effort:** S  
**Suggested fix:**
- Add at the top of each file: `const MODEL_FAST='claude-haiku-4-5-20251001';` and `const MODEL_SMART='claude-opus-4-7';`.
- Replace all string literals. Two-minute change that prevents future breakage.

---

### 15. `save()` in `index.html` uses only `console.warn` for corrupt-data detection — no user-visible recovery
**What:** `load()` at `index.html:1762` catches JSON parse errors with `console.warn('Corrupt localStorage, using defaults', e)` and silently resets to a blank app. The user sees all their data gone with no explanation and no way to recover.  
**Where:** `index.html:1762`  
**Why it matters:** This is the highest-stakes single point of failure in Task OS. A user who loses months of tasks and goals will churn immediately.  
**Effort:** S  
**Suggested fix:**
- On catch, before resetting, copy the raw string to `localStorage.setItem('taskos_corrupt_backup', d)`.
- Show a persistent (not auto-dismissed) banner: `"⚠️ Data could not be loaded. A backup was saved — contact support or try importing taskos_corrupt_backup from DevTools."`.
- Log the error to `console.error` (not `warn`) so it shows up in browser crash reports.

---

### 16. CRM kanban has no mobile layout override in the responsive block
**What:** The `@media(max-width:768px)` block at `givelink.html:155–180` overrides most layout rules but does not touch `.crm-kanban` or `.crm-col`. This is a separate tracking item from the P1 usability issue — it shows that the mobile breakpoint is incomplete for new features.  
**Where:** `givelink.html:155–180` (media query), no `.crm-kanban` rule inside it  
**Why it matters:** Every new feature added to the kanban-style layout will silently break on mobile unless the pattern is fixed.  
**Effort:** S  
**Suggested fix:**
- Add `.crm-kanban` and `.crm-stat-bar` overrides to the existing `@media(max-width:768px)` block as part of the P1 fix (item 7) — do them together.
- Add a comment `/* CRM */` grouping inside the media block so future feature additions have a clear insertion point.

---

### 17. `toast()` uses `.innerHTML` — any future misuse is an XSS vector
**What:** `toast()` at `givelink.html:452` sets `t.innerHTML=msg`. Currently all call sites pass trusted string literals, but the pattern makes it one copy-paste away from injecting user-controlled content into the DOM.  
**Where:** `givelink.html:452`; `index.html` has the same pattern  
**Why it matters:** The `esc()` helper already exists in both files. The pattern only needs to be applied once to eliminate the entire class of risk.  
**Effort:** S  
**Suggested fix:**
- Change to `t.textContent=msg` for most toasts (plain text is sufficient).
- Where emoji/bold is needed, build the content with DOM methods: `const span=document.createElement('span');span.textContent=msg;t.replaceChildren(span)`.
- Or keep `innerHTML` but pipe all callers through `esc()` and audit for any that pass user data.

---

## 💡 P3 — Nice to have

### 18. Brand colour variables are informal aliases — `--pr` and `--op` don't map to the brand palette
**What:** `:root` defines `--pr:#f472b6` and `--op:#a78bfa` as pillar colour shortcuts, but neither value matches the canonical brand purples (`#6B3FA0`, `#5718CA`) or pinks (`#C2185B`, `#E353B6`). New contributors will add more one-off hex values rather than referencing a palette.  
**Where:** `givelink.html:15–22` (`:root` block)  
**Why it matters:** Brand drift is cumulative. Five more sprints and the palette will be unrecognisable. A five-minute comment fix prevents months of design debt.  
**Effort:** S  
**Suggested fix:**
- Add a comment block above the `:root` vars: `/* Brand palette: purple #6B3FA0 / #5718CA | pink #C2185B / #E353B6 | rule: no pink on purple */`.
- Rename `--pr` to `--pillar-product` and pick a non-pink colour (see P1 item 6).
- Rename `--op` to `--pillar-ops` for clarity.

---

### 19. `sw.js` caches nothing — the installed PWA has no offline capability
**What:** The service worker (`sw.js`) installs and activates but does not cache any assets or implement a fetch handler. The app shell (HTML, CSS, JS) is re-fetched from the network on every load, and any offline access results in a browser error page rather than the app.  
**Where:** `sw.js` (entire file)  
**Why it matters:** Users who install the PWA expect offline access to their sprint board. A network interruption during a standup or demo shows a Chrome "No internet" dinosaur instead of the app.  
**Effort:** M  
**Suggested fix:**
- Add a `CACHE_NAME` constant and cache `['/', '/givelink.html', '/icon-gl.svg', '/manifest-givelink.json']` on `install`.
- Add a `fetch` handler using cache-first for same-origin navigation and network-first for API calls.
- Display a small offline banner (already styled via `.install-banner` pattern) when `navigator.onLine` is false.

---

### 20. No schema version on `S` (givelink.html) or on Task OS state — future migrations will be ad-hoc
**What:** Neither `S` in `givelink.html` nor the Task OS state object in `index.html` carries a `schemaVersion` field. Every `load()` call does a shallow spread (`S={...S,...p}`) which silently drops removed fields and doesn't backfill new required fields.  
**Where:** `givelink.html:437–446` (state init and `load()`); `index.html:1705–1710` (state init)  
**Why it matters:** The git log shows 35 feature commits in ~6 months. Each one that adds a new field to `S` is a silent migration that users with existing data may hit. This will become a real support issue when the user base grows.  
**Effort:** M  
**Suggested fix:**
- Add `schemaVersion:1` to the initial `S` object.
- In `load()`, after the spread, check `if(loaded.schemaVersion !== CURRENT_VERSION)` and run a `migrate(loaded)` function that backfills missing fields with safe defaults.
- This doesn't require a rewrite — a single `migrate` function with version-gated `if` blocks is sufficient for now.
