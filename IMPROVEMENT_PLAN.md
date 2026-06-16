# Givelink Codebase — Improvement Plan
_Generated 2026-06-16 | Stack: Vanilla JS · Single-file HTML · PWA · Supabase · Anthropic API_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. CRM modal Delete / Log Activity / Next Stage buttons never appear

**What:** The NP modal is created once via `document.createElement`; the template literal that conditionally renders the Delete, Log Activity, and → Next Stage buttons evaluates `editNpId` at creation time — which is `null` if `openAddNP()` has ever been called first. Every user who clicks "+ Add Org" before editing one locks themselves out of deleting orgs forever.

**Where:** `givelink.html:1358–1388` — specifically the template string `${editNpId?'<button...>Delete</button>':''}` inside `_showNPModal`.

**Why it matters:** Users cannot delete incorrectly added nonprofits. The Log Activity and → Next Stage buttons (same bug) mean the CRM pipeline cannot be advanced from the modal — the core action in a CRM.

**Effort:** S

**Suggested fix:**
- Remove all conditional button rendering from the static template.
- Instead, add a `<div id="npm-actions"></div>` placeholder inside the modal footer.
- In `_showNPModal`, after the modal is retrieved/created, imperatively set `document.getElementById('npm-actions').innerHTML = editNpId ? '...' : ''` on every call.

---

### 2. `callClaudeGL` swallows API errors — rate limits and auth failures show nothing useful

**What:** The shared Claude wrapper in givelink.html calls `res.json()` without first checking `res.ok`. A 429 rate-limit or 401 invalid-key response is valid JSON, so the `catch` block is never reached; the function returns `null` and callers display "Could not generate. Check your API key." regardless of the actual error.

**Where:** `givelink.html:1264–1271` (`callClaudeGL`) vs. the correct pattern in `index.html:4141–4144` (`callClaude`).

**Why it matters:** Rate limit hits during sprint planning or standup generation look identical to misconfiguration — users will cycle their API key instead of waiting, burning quota and eroding trust in the feature.

**Effort:** S

**Suggested fix:**
- After `const res = await fetch(...)`, add `if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(...); }` mirroring the `callClaude` pattern in index.html.
- Expose specific messages for 429 ("Rate limit — wait a moment") and 401 ("Invalid API key — check Settings").

---

### 3. Push notification and browser Notification icons point to a non-existent path

**What:** Both the service worker and index.html reference `./icons/icon-192.png` for notification icons. The `icons/` directory does not exist — only `icon.svg` and `icon-gl.svg` live at root.

**Where:** `sw.js:38–39` (push handler `icon` and `badge`), `index.html:9286` (browser `Notification` constructor).

**Why it matters:** Every push notification and in-browser reminder fires with a broken image. On Android this shows a grey placeholder; on some browsers it causes the notification to fail silently. Reminders are a retention mechanism.

**Effort:** S

**Suggested fix:**
- Create an `icons/` folder and add `icon-192.png` and `icon-512.png` (can be rasterised from the existing `icon.svg`).
- Or replace the path in sw.js and index.html with `./icon.svg` (modern browsers support SVG notification icons).
- Add both icon sizes to `manifest.json` and `manifest-givelink.json`.

---

### 4. AI Sprint Planner uses invalid model ID `claude-opus-4-5`

**What:** `runAiSprintPlanner` hardcodes `model:'claude-opus-4-5'`, a model ID that does not exist in the Anthropic API. The correct Opus identifier is `claude-opus-4-8`. Every click of "✨ Generate" returns a 400 error and shows a raw API error message.

**Where:** `givelink.html:1140`.

**Why it matters:** The AI Sprint Planner is the flagship productivity feature of the Givelink board. It is completely non-functional.

**Effort:** XS

**Suggested fix:**
- Change `model:'claude-opus-4-5'` → `model:'claude-haiku-4-5-20251001'` (fast and cheap; appropriate for list generation) or `'claude-sonnet-4-6'` for higher quality suggestions.
- Align with the model used by `callClaudeGL` to avoid maintenance divergence.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. `window.prompt()` used to collect Anthropic API key in givelink.html

**What:** Both `getApiKey()` (called by `runAiSprintPlanner`) and `callClaudeGL` use `window.prompt()` as a fallback when no key is found in localStorage. This is a browser-blocking modal with no styling, no help text, and no cancel affordance that makes sense.

**Where:** `givelink.html:1086` and `givelink.html:1261`.

**Why it matters:** `window.prompt()` is the least trusted UX pattern on the web. New users (e.g. Fanos onboarding) will see an unstyled system dialog asking for an API key they may not have yet — highest friction possible on the first AI interaction.

**Effort:** M

**Suggested fix:**
- Add a minimal "Settings" panel to givelink.html (same pattern as index.html's Settings modal) with an `<input>` for the API key that saves to `taskos_api_key`.
- Surface it from a ⚙️ button in the sprint bar instead of triggering it inline from AI actions.
- Remove both `window.prompt()` calls; replace with `toast('Add API key in Settings ⚙️')` and return early.

---

### 6. 100+ auto-seeded tasks are injected for every new user with no bulk-delete

**What:** `seed()` runs on first load and creates ~115 hardcoded sprint tasks and backlog items — real company data (partner names, email subjects, legal notes) — when `S.seeded` is falsy. There is no bulk-delete or "clear all seed data" action anywhere.

**Where:** `givelink.html:883–1072`.

**Why it matters:** Any new team member who opens givelink.html gets an app pre-loaded with someone else's data. Clearing it requires 115+ individual "Edit → Delete" interactions. This blocks collaborative adoption.

**Effort:** S

**Suggested fix:**
- Add a "Clear demo data" button in Sprint Settings that sets `S.tasks = []; S.seeded = false; save(); refresh();`.
- Show it only when tasks are ≤ the seeded count and no real tasks exist (or simply always show it in Settings).
- Alternatively, prompt the user on first load with a "Load sample sprint data?" confirmation before seeding.

---

### 7. Sprint defaults to a past date — new users start with a sprint already ended

**What:** The default sprint object is `{name:'Sprint 1 — US Growth Push', start:'2026-03-28', end:'2026-04-11'}`. Today is 2026-06-16; both dates are over two months in the past. `daysLeft()` returns 0 and `sprintPct()` returns 100%.

**Where:** `givelink.html:437–442`.

**Why it matters:** The sprint bar immediately shows "0 days left" and the burndown shows the sprint as complete. New users are confused why the app says they're behind before they've added a task.

**Effort:** XS

**Suggested fix:**
- Replace hardcoded dates with relative defaults: `const _d = new Date(); const _e = new Date(_d); _e.setDate(_d.getDate()+14);` and set `start: _d.toISOString().slice(0,10)`, `end: _e.toISOString().slice(0,10)`.
- Or simply update the static dates to a current sprint cycle on each deploy (2-minute fix).

---

### 8. Keyboard shortcut `n` (new task) fires when a `<select>` is focused in a modal

**What:** The keydown listener guards against INPUT and TEXTAREA focus but not SELECT. When a user is tabbing through the task modal's Pillar or Status dropdowns and presses a navigation key that browsers redirect, or when focus is in a `<select>` and 'n' is typed (e.g. to navigate options), `openAdd()` is triggered.

**Where:** `givelink.html:877–879`.

**Why it matters:** Opening a second modal while one is already open results in two overlapping modals. The existing task entry is lost and there's no way to close both cleanly without a page reload.

**Effort:** XS

**Suggested fix:**
- Change the guard to: `if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;`
- Also add `document.querySelectorAll('.mo:not(.hidden)').forEach(...)` check: if any modal is open, skip shortcut handling.

---

### 9. Burndown chart pixel math is hardcoded — breaks at any container width

**What:** `renderBurndown()` calculates all SVG coordinates using `W=280, H=100` but renders the SVG with `style="width:100%;max-width:280px"`. On screens wider than 280px the SVG scales up but axis labels (`x="pad"`, `x="W-pad"`) were calculated for 280px, placing them at 20px and 260px in the viewBox — creating invisible text on larger screens.

**Where:** `givelink.html:763–774`.

**Why it matters:** The burndown chart is the primary sprint health indicator on the Overview page. It appears broken on any desktop wider than 280px.

**Effort:** S

**Suggested fix:**
- Add `viewBox="0 0 ${W} ${H}"` to the SVG element and remove the `width/max-width` inline style.
- Use `preserveAspectRatio="none"` and let the SVG scale via CSS `width:100%; height:auto;`.
- Or switch to a CSS-based progress visualization (simpler to maintain in this codebase).

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 10. Two diverging AI wrappers: `callClaude` (index.html) and `callClaudeGL` (givelink.html)

**What:** `callClaude` (index.html:4132) and `callClaudeGL` (givelink.html:1256) are nearly identical functions with different quality levels — only `callClaude` checks `res.ok`, handles 429/401 specifically, and reads from the correct key path.

**Where:** `index.html:4132–4149`, `givelink.html:1256–1272`.

**Why it matters:** Any fix to API error handling must be applied in two places. P0 item #2 above is a direct result of this divergence.

**Effort:** M

**Suggested fix:**
- Extract a shared utility into a `<script src="claude-api.js">` or a single inline `<script>` block referenced by both HTML files.
- Or move the correct `callClaude` implementation into a `<template>` in a shared include and reference it from both files.

---

### 11. Dynamic modal creation with template literals evaluated at creation time

**What:** The NP modal, Standup modal, and Outreach modal are created once with `document.createElement` and `innerHTML = \`...\`` template literals that embed `editNpId` conditional logic. This is the root cause of P0 item #1 (CRM delete buttons missing).

**Where:** `givelink.html:1360–1388`, `1469–1480`, `1603–1615`.

**Why it matters:** Any new conditional button added to these modals will silently fail for all users who opened the app before the condition was true. This is a footgun that will keep generating P0 bugs.

**Effort:** M

**Suggested fix:**
- Move all three modals into static HTML (as `<div class="mo hidden">` elements in the body, like the task modal and sprint settings modal already are).
- Control visibility of conditional elements imperatively via `.style.display` in the open/show functions.

---

### 12. `logActivityNP` uses `window.prompt()` for in-app data entry

**What:** The "📝 Log Activity" button in the CRM modal calls `window.prompt('Log activity...')` to collect text. This interrupts the page, loses focus, and cannot be styled or validated.

**Where:** `givelink.html:1431`.

**Why it matters:** Activity logging is the core daily action in the CRM. A native-browser prompt undermines the professional feel of the sprint board — especially during sales calls.

**Effort:** S

**Suggested fix:**
- Add a small inline textarea inside the modal that appears when "Log Activity" is clicked (slide-down pattern or a dedicated "Log" section in the edit form).
- Save on blur or an explicit "Save note" button.

---

### 13. CRM sidebar badge count shows "overdue" but label says "Nonprofit CRM" — intent unclear

**What:** `updateCRMSidebarCount()` counts orgs with `daysSinceCRM > 7` and sets this as the CRM sidebar badge. There is no tooltip, label, or explanation. Users see a red number on "Nonprofit CRM" without knowing what it represents.

**Where:** `givelink.html:1458–1462`, sidebar HTML line 241.

**Why it matters:** Ambiguous badges cause alert fatigue. A sales rep seeing "3" next to CRM doesn't know if that's new leads, overdue follow-ups, or pipeline count.

**Effort:** XS

**Suggested fix:**
- Change sidebar label to "Nonprofit CRM 🔴 {n} overdue" when `overdue > 0`.
- Or add `title="3 nonprofits need follow-up"` to the badge span for a tooltip.

---

### 14. Deprecated `document.execCommand('copy')` in clipboard fallback

**What:** Both the standup copy button and outreach copy button fall back to `document.execCommand('copy')` when `navigator.clipboard.writeText` fails. This API is deprecated and will be removed in future browser versions.

**Where:** `givelink.html:1521`, `givelink.html:1621`.

**Why it matters:** When the deprecated path is hit, it silently fails on browsers that have already removed the API — no copy happens, no error shown.

**Effort:** XS

**Suggested fix:**
- Replace the fallback with: display a pre-selected `<textarea>` overlay the user can manually `Ctrl+C`, or show a "Copy failed — select the text above manually" toast.
- The modern clipboard API should work in all contexts where givelink.html is served over HTTPS.

---

### 15. No ARIA attributes on interactive emoji-only elements throughout givelink.html

**What:** Close buttons (`×`), checkbox-style divs (`.gcheck`, `.ck2`), and FAB button (`+`) have no `aria-label`. Screen readers announce "times" or nothing for these controls.

**Where:** `givelink.html:317` (close button), `givelink.html:65–66` (goal checkboxes), `givelink.html:303` (FAB), plus all task checkboxes.

**Why it matters:** Keyboard-only and screen reader users cannot operate the core task-check and modal-close flows.

**Effort:** S

**Suggested fix:**
- Add `aria-label="Close"` to all `×` close buttons.
- Add `role="checkbox"` and `aria-checked="true/false"` to `.gcheck` and `.ck2` divs.
- Add `aria-label="Add task"` to the FAB.

---

### 16. `index.html` is 12,893 lines — one file contains all views, styles, and logic

**What:** The entire Task OS application lives in a single HTML file. While functional, it makes version control diffs unreadable, local search impractical, and any performance profiling impossible.

**Where:** `index.html` (entire file).

**Why it matters:** Each feature addition or bug fix touches one enormous file, creating merge conflicts, review fatigue, and onboarding friction for collaborators.

**Effort:** L

**Suggested fix:**
- No immediate rewrite required. As a first step: extract the CSS into `taskos.css`, the main `<script>` block into `taskos.js`, and keep `index.html` as a thin shell.
- This is a 2-file split (not a framework migration) and enables proper editor features like code folding, go-to-definition, and file-level diff reviews.

---

## 💡 P3 — Nice to have

---

### 17. PWA manifests lack icon entries — install experience is degraded

**What:** `manifest.json` and `manifest-givelink.json` do not include `icons` arrays with PNG sizes. The current setup only has an SVG `apple-touch-icon`. Android Chrome and many PWA installers require `icon-192.png` and `icon-512.png` for a proper install prompt and splash screen.

**Where:** `manifest.json`, `manifest-givelink.json`.

**Effort:** S

**Suggested fix:**
- Rasterize `icon.svg` and `icon-gl.svg` to 192×192 and 512×512 PNGs (using Inkscape, ImageMagick, or any SVG converter).
- Add `"icons":[{"src":"icons/icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icons/icon-512.png","sizes":"512x512","type":"image/png"}]` to both manifests.

---

### 18. `theme-color` meta inconsistency between givelink.html and index.html

**What:** `givelink.html` sets `<meta name="theme-color" content="#3b82f6">` (Tailwind blue-500) while `index.html` uses `#58a6ff` (GitHub accent blue). On iOS the browser chrome color is visibly different when switching between the two apps.

**Where:** `givelink.html:6`, `index.html:6`.

**Effort:** XS

**Suggested fix:**
- Align both files to `#58a6ff` (matches the shared `--accent` CSS variable) or pick the brand purple `#6B3FA0` for a more Givelink-specific identity.

---

### 19. Sprint close numbering assumes sequential naming — breaks with manual sprint names

**What:** `openCloseSprint()` pre-fills the new sprint name as `Sprint ${(S.pastSprints||[]).length + 2}`. If past sprints were named "Sprint Q1 2026" or "US Growth — April", the auto-name will be `Sprint 2` regardless.

**Where:** `givelink.html:812`.

**Effort:** XS

**Suggested fix:**
- Default the new sprint name to `''` with placeholder text "e.g. Sprint 2 — June Growth" rather than auto-generating a name that may conflict.

---

### 20. Service worker cache key is hardcoded as `task-os-20260530` — stale caches on redeploy

**What:** The cache version string `task-os-20260530` must be manually updated on every deploy to bust the old cache. If forgotten, users continue serving the previous version of all HTML files until they manually clear their browser cache.

**Where:** `sw.js:1`.

**Effort:** S

**Suggested fix:**
- Inject the cache key as a build-time variable (e.g. using a deploy hook that replaces `CACHE_VERSION` with the current date/commit hash).
- Or switch to a cache-busting approach using the response's `ETag` header in the fetch handler rather than a hardcoded version string.

---

_Total: 4 P0 · 5 P1 · 7 P2 · 4 P3_
