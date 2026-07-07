# Givelink / Task OS — Improvement Plan
> Reviewed: 2026-07-07 | Codebase: single-file monolith (`index.html` 14,401 lines) + `givelink.html` (1,755 lines)

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. Push-notification icon path is broken (silent failure for all users)

**What**: Service worker references `./icons/icon-192.png` for notifications but no `icons/` directory exists — the file is `./icon-192.png`.

**Where**: `sw.js:42-43`
```js
icon:'./icons/icon-192.png',   // ← directory does not exist
badge:'./icons/icon-192.png',
```

**Why it matters**: Every push notification lands with a broken icon (or fails silently on strict platforms). Trust signal is damaged every time a reminder fires.

**Effort**: S

**Suggested fix**:
- Change both paths to `'./icon-192.png'`
- Also add `/icons/` as an alias in `vercel.json` rewrites, or simply correct the paths

---

### 2. `callClaude()` silently swallows 401 when proxy auth token fails

**What**: When `_sbToken()` rejects (expired session, network hiccup), the `catch(()=>'')` returns an empty string and the request is sent without `Authorization`. If the proxy requires a session, the user sees a generic 401/500 toast and the AI feature dies with no recovery path.

**Where**: `index.html:4869-4874`
```js
const tok = _sbEnabled() ? await _sbToken().catch(()=>'') : '';
// ^^^ silent fallback to '' — proxy returns 401 but user only sees "AI error 401"
```

**Why it matters**: Any user whose Supabase session expires mid-session loses all AI features until a hard reload. No prompt to re-authenticate.

**Effort**: S

**Suggested fix**:
- Catch the token failure explicitly; if it throws, call `authLogout()` and `toast('Session expired — please sign in again')` before returning `null`
- Or trigger a silent token refresh and retry once before failing

---

### 3. Content pipeline kanban is broken on mobile

**What**: The content kanban is rendered with a hard-coded inline `grid-template-columns:repeat(4,1fr)` with no responsive override. On any screen narrower than ~900px, four columns pack content into ~80px-wide cards — unusable.

**Where**: `index.html:13863` (HTML), `index.html:12102-12116` (render function)
```html
<div id="content-kanban" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;"></div>
```

**Why it matters**: Mobile is a primary use case for a PWA. Anyone visiting the content pipeline on a phone sees a broken layout.

**Effort**: S

**Suggested fix**:
- Replace inline style with a CSS class `.kanban-grid` that uses `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`
- Or add a `@media(max-width:768px)` rule: `#content-kanban{grid-template-columns:1fr !important;overflow-x:auto;}`

---

### 4. AI prompts inject the owner's personal bio for all users

**What**: Six AI prompt builders fall back to `'Panos — Greek founder building Givelink (nonprofit fundraising SaaS)...'` when `getAboutMe()` returns empty (which it will for every new user). Any user who hasn't filled in their About Me gets Panos's personal context injected into their AI outputs.

**Where**: `index.html:5300, 5310, 5506, 5777, 5937` — all call `getAboutMe()||'Panos — Greek...'`

**Why it matters**: New users get AI responses personalized to someone else, completely breaking the AI features until they discover and fill the About Me field.

**Effort**: S

**Suggested fix**:
- Change the fallback from the owner's bio to a generic placeholder: `getAboutMe() || 'A founder working on their startup goals'`
- Or gate the AI call: if `!getAboutMe()`, prompt the user to fill About Me first with a link to Settings
- Also add the About Me prompt to the onboarding welcome-seed flow

---

### 5. Sync last-write-wins destroys offline edits silently

**What**: `sbSyncNow()` resolves conflicts by picking whichever device has the newer `_updatedAt` timestamp. If you work offline on two devices and then sync, one device's entire state is silently overwritten with no merge, diff, or warning.

**Where**: `index.html:10064-10081`
```js
if(remote && remote.data && remote.ms > localMs) {
  S = {...S, ...remote.data};  // ← destructive overwrite, no diff
  ...
  if(!force) toast('☁️ Updated from another device');  // too mild a message
}
```

**Why it matters**: A user who loses a week of Givelink metrics data because they switched devices will never trust the app again. The toast "Updated from another device" gives no indication that local changes were discarded.

**Effort**: M

**Suggested fix**:
- Before overwriting, check if local has changes not in remote (compare `_updatedAt`); if so, show a conflict modal: "Another device has newer data. Keep local / Keep remote / Download backup first"
- Short-term: at minimum, change the toast to "⚠️ Cloud data is newer — local changes replaced. Export a backup before switching devices."
- Also always auto-export a backup before applying a remote overwrite

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 6. `APP_CONFIG.aiProxy` is empty — all AI features dead without a personal API key

**What**: `aiProxy` is `''` in `APP_CONFIG` (line 9812). Unless users set `S.claudeKey` in Settings, every AI button (Plan My Day, AI Triage, Givelink Outreach, etc.) shows a toast: "Add Claude API key in Settings" and does nothing.

**Where**: `index.html:9812`, `index.html:4863-4864`

**Why it matters**: First-time users who expect a hosted AI experience hit dead buttons with no obvious fix. This kills the first session for every new user on the hosted deployment.

**Effort**: S

**Suggested fix**:
- Deploy `api/claude.js` on Vercel and set `aiProxy` to the actual proxy URL
- Add a visible "AI requires your API key" banner (not just a toast) with a link to Settings when the key is missing — surface it at first AI button click rather than on every refresh

---

### 7. `/api/claude.js` proxy has no CORS headers — breaks cross-origin setups

**What**: The Vercel serverless function returns no `Access-Control-Allow-Origin` header and doesn't handle `OPTIONS` preflight. If the proxy URL domain differs from the app domain (or during local development), all AI calls are blocked by the browser.

**Where**: `api/claude.js` — entire file, no CORS handling

**Why it matters**: Anyone deploying this (or testing locally) who configures a separate Vercel URL for the proxy will get CORS errors and assume the AI is broken.

**Effort**: S

**Suggested fix**:
```js
// At the top of handler():
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
if (req.method === 'OPTIONS') { res.status(204).end(); return; }
```
- For production, scope `Allow-Origin` to your app's specific domain instead of `*`

---

### 8. Givelink "Users Reached" metric is mislabeled as "beneficiaries"

**What**: The `gl-impact-counter` shows `m.users` as "beneficiaries reached toward 1,000,000" (line 8514-8521), but `m.users` is the number of platform users (team seats / app users), not people benefiting from nonprofit fundraising. The 1M people goal is calculated using the Impact Model (`np × donations × avg_size / €50`) — not `m.users` at all.

**Where**: `index.html:8513-8521`

**Why it matters**: The core Givelink mission metric (1M people) is displayed with the wrong number. The progress bar could read 0% even when 100,000 people have actually been impacted via the Impact Model.

**Effort**: S

**Suggested fix**:
- Replace `m.users` in the impact counter with the calculated `peopleImpacted` value from the Impact Model (already computed at line 8541)
- Rename the `m.users` stat card label from "Users Reached" to "Platform Users" to remove ambiguity

---

### 9. No rate limiting on the Claude proxy — one account can drain the Anthropic bill

**What**: `api/claude.js` has no per-user rate limiting. The code acknowledges this: "for production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."

**Where**: `api/claude.js:12-13`

**Why it matters**: A single user running 1,000 AI Workflow automations in a loop can generate a large Anthropic bill. As Givelink grows and more users access the proxy, this risk scales linearly.

**Effort**: M

**Suggested fix**:
- Add Upstash Redis rate limiting: 20 requests per user per hour
- Use the Supabase `uid` (extracted from the verified JWT) as the rate-limit key
- Return `429` with a `Retry-After` header when exceeded

---

### 10. Givelink dashboard sparklines silently disappear with < 2 history snapshots

**What**: `gl-sparklines` only renders if `S.givelinkHistory.length >= 2` (line 8577). New users or users who just started tracking see no sparklines and no explanation — just a blank space.

**Where**: `index.html:8577-8584`

**Why it matters**: New Givelink users see an empty dashboard with no indication of what to do to see growth charts. The onboarding moment is wasted.

**Effort**: S

**Suggested fix**:
- When `hist.length < 2`, show a prompt: "📸 Take your first snapshot to start tracking growth — the trend will appear after 2 snapshots."
- Make the "📸 Snapshot Today" button more prominent (currently a small `bg sm` button at line 13796)

---

### 11. `manifest-givelink.json` uses off-brand blue theme

**What**: The Givelink PWA manifest sets `theme_color: "#3b82f6"` (Tailwind blue-500). The app's brand is purple (`--brand: #8b7cff` / `--brand-gradient: linear-gradient(135deg,#7b8cff,#c08cff)`).

**Where**: `manifest-givelink.json` — `theme_color` field

**Why it matters**: When Givelink is installed as a PWA, the browser chrome (Android address bar, iOS status bar) shows blue instead of purple. First install impression is inconsistent with the product.

**Effort**: S

**Suggested fix**:
- Change `theme_color` to `"#7b8cff"` (the start of the brand gradient)
- Also update `background_color` to match the dark theme background (`#0a0a0f`)

---

### 12. `givelink.html` NP modal buttons are frozen to first-open mode for entire session

**What**: `_showNPModal()` creates the modal DOM once (`if(!m)`) and caches it. Footer buttons ("Delete", "Log Activity", "→ Next Stage") are conditionally rendered at creation time based on `editNpId`. If `openAddNP()` is called first (`editNpId=null`), those buttons never appear for the rest of the session — even in edit mode. If edit is opened first, Delete appears on new-org forms too.

**Where**: `givelink.html:1358-1401` (`_showNPModal`, conditional button template inside `if(!m)` block)

**Why it matters**: Any user who adds a new nonprofit before editing one will find the CRM's edit mode permanently missing its action buttons until they hard-refresh. This breaks the core CRM workflow.

**Effort**: S

**Suggested fix**:
- Move the conditional footer buttons out of the cached `if(!m)` template into `_showNPModal`'s body, updating them each time the modal opens: `footer.innerHTML = editNpId ? '...' : ''`
- Alternatively, always include the buttons but show/hide via `style.display` toggled on each open

---

### 13. `givelink.html` entire color system uses Tailwind blue, not brand purple

**What**: The brand palette is purple `#6B3FA0`/`#5718CA` and pink `#C2185B`/`#E353B6`. In `givelink.html`, `--accent` is `#3b82f6` (Tailwind blue-500). This drives every interactive element: buttons, links, active nav, form focus rings, progress bars, the FAB, the sprint bar. Zero brand colors appear anywhere in the file.

**Where**: `givelink.html:17` (`--accent:#3b82f6`), `givelink.html:6` (meta `theme-color:#3b82f6`), and ~30 hardcoded inline color values throughout

**Why it matters**: Givelink is a separate product brand. The entire app feels like a generic blue dashboard, not a Givelink product. This is the highest-leverage single CSS change for brand alignment.

**Effort**: M

**Suggested fix**:
- Change `--accent` to `#7b5cff` (a purple that pairs with the brand gradient)
- Update `theme-color` meta to `#7b5cff`
- Replace pillar colors with brand-adjacent hues: product pillar → brand pink, growth → brand purple light
- Sweep for hardcoded hex values in inline styles and route them through CSS variables

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 14. `index.html` is 14,401 lines of monolithic inline code — no modules, no build step

**What**: The entire application — all CSS, HTML, and 665+ JS functions — lives in one file. There is no package.json, no bundler, no linting, no type checking.

**Where**: `index.html` — entire file

**Why it matters**: Adding a feature means scrolling through 14,000 lines. No dead-code analysis. No tree shaking. Refactoring one function risks breaking an unrelated one. Developer velocity will compound-decay as the file grows.

**Effort**: L

**Suggested fix**:
- Short-term: extract the `<style>` block to `style.css` and major function groups to `modules/*.js` loaded via `<script type="module">`
- Medium-term: migrate to Vite + vanilla JS (no framework needed) with a proper build pipeline
- Don't attempt this in a single PR — carve out one section at a time, starting with the Supabase sync layer

---

### 15. `renderGivelinkDash()` is 107 lines of innerHTML string concatenation

**What**: The main Givelink dashboard renderer at line 8479-8585 assembles complex nested HTML via template literals and scattered `element.innerHTML` assignments with no structure.

**Where**: `index.html:8479-8585`

**Why it matters**: Any bug in the Givelink dashboard is extremely hard to debug — the HTML structure only exists at runtime. Test coverage is zero. A typo in a template literal can break the entire view silently.

**Effort**: M

**Suggested fix**:
- Extract each section (stats, sparklines, impact model, tasks) into its own render function (`_renderGlStats()`, `_renderGlSparklines()`, etc.)
- Move the HTML templates to static `<template>` elements in the HTML and clone them instead of building strings

---

### 16. Personal owner data hardcoded in `seed()` / AI prompt fallbacks

**What**: The `seed()` function (called only in non-hosted mode, line 10151) includes 60+ personal Givelink tasks referencing specific companies and strategies. Six AI prompt builders fall back to `'Panos — Greek founder building Givelink...'` (see P0 item #4 above).

**Where**: `index.html:4393-4760` (seed tasks), `index.html:5300, 5310, 5506, 5777, 5937` (AI prompts)

**Why it matters**: If this repo is ever made public or shared, the owner's personal data and strategy are exposed. Also, the AI fallback issue (covered in P0) stems from this same root cause.

**Effort**: M

**Suggested fix**:
- Extract seed data to a separate `seed-data.js` with clearly generic placeholder content
- Remove all hardcoded personal names, companies, and strategies from AI fallbacks (see P0 item #4)

---

### 17. Service worker cache name is a hardcoded date string

**What**: `sw.js:1`: `const CACHE = 'task-os-20260711'`. This must be manually updated on every deploy to bust stale caches. Forgetting to update it means users run old JS indefinitely.

**Where**: `sw.js:1`

**Why it matters**: If a bug fix is deployed but the cache name isn't updated, PWA-installed users continue running the buggy version until they clear their browser cache manually.

**Effort**: S

**Suggested fix**:
- Inject a build hash at deploy time: `const CACHE = 'task-os-{{GIT_HASH}}'` via a Vercel build hook or simple `sed` command in a `vercel.json` `buildCommand`
- Or use `self.__WB_MANIFEST` if migrating to Workbox

---

### 18. No `.env.example` — proxy environment variables are documented only in code comments

**What**: The three required environment variables (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) are documented only in comments at the top of `api/claude.js`. There is no `.env.example` file.

**Where**: `api/claude.js:4-13`

**Why it matters**: Any contributor or self-hoster must read the source code to discover what environment variables are needed. First-deploy friction is high; onboarding takes longer than necessary.

**Effort**: S

**Suggested fix**:
- Create `.env.example`:
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_ANON_KEY=eyJhbGci...
  ```
- Add a note about obtaining these values in the README

---

## 💡 P3 — Nice to have

---

### 19. `givelink.html` toast uses raw `innerHTML` — XSS if sprint name contains HTML

**What**: The `toast()` function at `givelink.html:452` uses `t.innerHTML=msg`. Multiple callers pass unsanitized user-controlled content: `archive.name` (line 847) and `profile.name` (line 1250) are stored raw and injected directly into the toast HTML.

**Where**: `givelink.html:452` (toast function), `givelink.html:847, 1250` (callers)

**Why it matters**: While this is self-XSS in a single-user context, it's a hygiene issue and a footgun for any multi-user expansion. A sprint named `<img src=x onerror="...">` would execute code in the toast.

**Effort**: S

**Suggested fix**:
- Add an `esc()` wrapper in every caller: `toast(\`"${esc(archive.name)}" archived\`)`
- Or switch the toast function itself to use `textContent` (with a second parameter for trusted HTML if needed)

---

### 20. `givelink.html` CRM activity log uses `window.prompt()` — broken on iOS PWA

**What**: "Log Activity" in the NP modal calls `window.prompt('Log activity...')` at `givelink.html:1431`. `window.prompt` is suppressed in PWA standalone mode on iOS and in some Android WebViews.

**Where**: `givelink.html:1431` (`logActivityNP` function)

**Why it matters**: Any user with the Givelink PWA installed on iOS cannot log CRM activity notes — the prompt silently returns `null` and nothing is saved.

**Effort**: S

**Suggested fix**:
- Replace `window.prompt()` with a small inline modal (or reuse the existing modal infrastructure) that contains a `<textarea>` and Save/Cancel buttons
- This is also an accessibility improvement — `window.prompt` cannot be styled or made accessible

---

*Total: 20 items. P0: 6 | P1: 7 | P2: 5 | P3: 2*

---

*Sources: `index.html` (14,401 lines), `givelink.html` (1,755 lines), `api/claude.js`, `sw.js`, `vercel.json`, `supabase-setup.sql`*
