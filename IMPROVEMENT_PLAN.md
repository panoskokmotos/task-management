# Givelink Improvement Plan

_Generated 2026-07-30 by automated codebase review._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. API key exposed in localStorage, direct Anthropic calls from browser
- **What**: `givelink.html` stores the Anthropic API key in `localStorage` and makes direct calls to `api.anthropic.com` — bypassing the server-side proxy completely.
- **Where**: `givelink.html:1075–1088` (`getApiKey`), `1131–1144` (`runAiSprintPlanner`), `1264–1271` (`callClaudeGL`)
- **Why it matters**: Any XSS, malicious browser extension, or script injected into the page can steal the key and run up a billing catastrophe. The proxy at `/api/claude.js` exists precisely to prevent this and is unused here.
- **Effort**: S
- **Suggested fix**:
  - Remove `getApiKey()` / all direct `fetch('https://api.anthropic.com/v1/messages', ...)` calls from `givelink.html`.
  - Route all AI calls through `fetch('/api/claude', {method:'POST', body:JSON.stringify({prompt, max_tokens})})` — already implemented and working in `index.html`.
  - Delete the `anthropic-dangerous-direct-browser-access` header; it should never appear in production code.

---

### 2. Nonprofit CRM delete button permanently hidden
- **What**: The "Delete" button in the nonprofit edit modal is rendered once using a template literal that checks `editNpId` at modal-creation time. Since the modal is created on the _first_ open (usually "Add Nonprofit", where `editNpId` is null), the button is never inserted into the DOM and nonprofits can't be deleted via the UI.
- **Where**: `givelink.html:1359–1388` (`_showNPModal`, modal creation block)
- **Why it matters**: Users have no way to remove a nonprofit from the CRM — they accumulate forever. The only recourse is DevTools.
- **Effort**: S
- **Suggested fix**:
  - Move the delete button render outside the `if(!m)` block; re-render the footer buttons on every call to `_showNPModal()`.
  - Simpler: replace the one-time `innerHTML` template with per-call footer updates: `document.getElementById('npm-del-btn').style.display = editNpId ? '' : 'none'`.

---

### 3. Push notification icon 404
- **What**: The service worker references `'./icons/icon-192.png'` for push notification icons, but no `icons/` subdirectory exists — the file is at `./icon-192.png`.
- **Where**: `sw.js:48–49`
- **Why it matters**: Every push notification shows a broken icon on Android, which looks unprofessional and erodes trust.
- **Effort**: XS
- **Suggested fix**:
  - Change `icon:'./icons/icon-192.png'` → `icon:'./icon-192.png'` and `badge:'./icons/icon-192.png'` → `badge:'./icon-192.png'` in `sw.js:48–49`.
  - Bump the `CACHE` version string in `sw.js:1` so the new SW is picked up.

---

### 4. AI Sprint Planner uses an invalid model ID
- **What**: `runAiSprintPlanner()` requests model `'claude-opus-4-5'` — no date suffix. The Anthropic API requires `claude-opus-4-5-20251001` (or similar dated alias). This causes a 400 on every planner invocation.
- **Where**: `givelink.html:1141`
- **Why it matters**: The AI Sprint Planner feature is completely broken for any user who clicks "Generate".
- **Effort**: XS
- **Suggested fix**:
  - Change `model:'claude-opus-4-5'` → `model:'claude-haiku-4-5-20251001'` (Haiku is fast and cheap enough for task selection) _or_ `model:'claude-opus-4-5-20251001'` if Opus quality is needed.
  - Consider routing through `/api/claude` (see P0.1) which already pins the model server-side.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. CRM kanban is completely broken on mobile
- **What**: The kanban uses `grid-template-columns: repeat(6, 1fr)` with `min-width: 160px` per column — 960px minimum. There is no mobile breakpoint override for the CRM view.
- **Where**: `givelink.html:197–199` (`.crm-kanban` style)
- **Why it matters**: CRM is one of the three top nav items. On any phone it overflows horizontally and is unusable without awkward horizontal scrolling — the columns are unreadable.
- **Effort**: S
- **Suggested fix**:
  - Add `overflow-x: auto` to `.crm-kanban` and `min-width: 160px` to `.crm-col` so users can scroll the board horizontally on mobile.
  - At `max-width: 768px`, switch to a vertical accordion or swipeable columns view for better mobile UX.

---

### 6. Canonical / OG meta tags point to Vercel staging URL
- **What**: `landing.html`, `index.html`, and structured-data blocks all hardcode `https://task-management-beige-eight.vercel.app/` as the canonical, OG, and Twitter URLs.
- **Where**: `landing.html:11, 16–21` and `index.html:24–32`
- **Why it matters**: Google indexes the Vercel staging URL rather than the real domain. Social sharing shows the ugly staging URL. Link equity splits. SEO ranking for the real domain is suppressed.
- **Effort**: S
- **Suggested fix**:
  - Replace all occurrences of `https://task-management-beige-eight.vercel.app/` with the production domain (e.g. `https://givelink.io` or `https://arete.app`).
  - Use a Vercel environment variable to make the hostname configurable so staging doesn't accidentally overwrite prod.

---

### 7. `callClaudeGL` swallows API errors silently
- **What**: If the Anthropic API returns 401, 429, or 500, `callClaudeGL()` parses the error response but still returns null without surfacing the actual error message. The UI shows "Could not generate. Check your API key." regardless of whether it's a rate limit, an auth error, or a server outage.
- **Where**: `givelink.html:1264–1272` (`callClaudeGL`), affects Standup (line 1509) and Outreach (line 1660) generators.
- **Why it matters**: Users can't tell whether they entered the wrong key, hit a rate limit, or the service is down. They retry needlessly and lose trust in the feature.
- **Effort**: S
- **Suggested fix**:
  - Check `res.ok` inside `callClaudeGL`; if false, extract `data.error?.message` and pass it to `toast()` before returning null.
  - Surface specific messages: "Rate limit hit — try again in 60s", "Invalid API key", etc.

---

### 8. Task OS Sync overwrites by title match — wrong tasks get marked done
- **What**: `syncToTaskOS()` matches Givelink sprint tasks to Task OS tasks using a case-insensitive title comparison. If any two unrelated tasks happen to share a title, the Task OS version is incorrectly marked done.
- **Where**: `givelink.html:1220–1228`
- **Why it matters**: Corrupts the user's Task OS data silently. With 100+ seeded tasks that have generic names like "Follow Up" or "Send reminders", false matches are plausible.
- **Effort**: M
- **Suggested fix**:
  - Assign a stable `glId` field when pushing Givelink tasks into Task OS, and match on `glId` rather than title on subsequent syncs.
  - Alternatively, namespace task titles: `"[Givelink] ${gt.title}"` to reduce collision risk as a short-term fix.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. `/api/claude.js` proxy has no rate limiting or CORS protection
- **What**: The server-side Claude proxy accepts any POST from any origin. No per-user or per-IP rate limiting is implemented. A single compromised session (or anyone who discovers the endpoint) can exhaust the server-side Anthropic budget.
- **Where**: `api/claude.js:15–49`
- **Why it matters**: One bad actor = runaway Anthropic bill on the server key. The comment at line 12 explicitly acknowledges this risk.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (10 req/min per IP is a reasonable start) — Vercel's Edge middleware makes this a ~20-line addition.
  - Restrict CORS: `res.setHeader('Access-Control-Allow-Origin', 'https://your-production-domain.com')`.

---

### 10. `seed()` data is not idempotent — localStorage wipe creates duplicates
- **What**: `seed()` is guarded only by `S.seeded`. If a user clears site data (DevTools, browser settings), `seeded` is gone and the entire task list is re-seeded on top of any user-added tasks on next load.
- **Where**: `givelink.html:883–1072`
- **Why it matters**: Users who clear their cache lose their custom tasks and get 100+ seed tasks back. Hard to recover without DevTools.
- **Effort**: S
- **Suggested fix**:
  - Move seed data to a separate check: only seed if `S.tasks.length === 0` (in addition to the `S.seeded` flag).
  - Consider moving initial data to a JSON import rather than inline code, making the guard easier to reason about.

---

### 11. `pastSprints` grows unbounded in localStorage
- **What**: Each closed sprint archives full goal data into `S.pastSprints`. After many sprints, the localStorage payload (serialized on every `save()` call) can approach browser limits (~5MB typical; ~2MB on some mobile browsers), causing silent write failures.
- **Where**: `givelink.html:828–848` (`confirmNewSprint`)
- **Why it matters**: Silent localStorage overflow means saves stop working and users lose data — with no error shown.
- **Effort**: M
- **Suggested fix**:
  - Cap archived sprint count at 20 (trim oldest). Goal data per sprint is the main size driver.
  - Add a size guard before `save()`: `if(JSON.stringify(S).length > 4_000_000) pruneOldSprints()`.

---

### 12. `givelink.html` is a 1756-line single-file monolith
- **What**: HTML, CSS (214 lines), data constants, 8 features (CRM, standup, burndown, AI planner, outreach, impact, sync, PWA), and all modal logic are in one file.
- **Where**: `givelink.html:1–1756`
- **Why it matters**: Any new feature or bug fix requires scrolling thousands of lines. Merge conflicts are painful. Functions like `renderCRM`, `renderOverview`, `openStandup` have no way to share state cleanly.
- **Effort**: L
- **Suggested fix**:
  - Extract CSS into `givelink.css`, each major feature into a JS module (e.g. `crm.js`, `ai.js`, `sprint.js`).
  - This is a background refactor — do it feature-by-feature during natural feature work rather than as a big-bang rewrite.

---

## 💡 P3 — Nice to have

### 13. Three different accent colors across the two products
- **What**: `givelink.html` accent is `#3b82f6` (blue), `landing.html` uses `#5a49e0` (violet), `index.html` uses `#8272f2` (soft purple). No unified brand token.
- **Where**: `givelink.html:17`, `landing.html:48`, `index.html:47`
- **Why it matters**: Cross-product brand looks inconsistent. Givelink feels like a different company from Arete.
- **Effort**: M
- **Suggested fix**: Align Givelink's `--accent` to `#5a49e0` or `#8272f2`. Update all derived `rgba()` shadow values accordingly. One CSS variable change, propagates everywhere.

---

### 14. Missing keyboard shortcuts for CRM and navigation in `givelink.html`
- **What**: Only `n` (add task) and `Escape` (close modal) are bound. No shortcuts to navigate to CRM, Backlog, or pillar views.
- **Where**: `givelink.html:876–880`
- **Why it matters**: Power users navigating by keyboard have to reach for the mouse for every view change.
- **Effort**: S
- **Suggested fix**: Add `g c` → CRM, `g b` → Backlog, `g o` → Overview in the keydown handler. Match the chord pattern from the main Arete app's keyboard system.

---

### 15. Burndown chart doesn't mark today's position
- **What**: The SVG burndown shows `Sprint start` and `End` labels but doesn't draw a vertical "today" line.
- **Where**: `givelink.html:754–775` (`renderBurndown`)
- **Why it matters**: Users can't tell at a glance whether they're ahead or behind pace without counting days manually.
- **Effort**: S
- **Suggested fix**: Add a vertical dashed line at `dateToX(new Date().toISOString().slice(0,10))` with a "Today" label below. Three SVG elements: `<line>`, `<text>`.

---

_Max 15 items shown; highest-leverage per tier. Items not included: minor copy tweaks, cosmetic polish, and features without clear user-impact evidence._
