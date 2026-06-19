# Givelink / Task OS — Improvement Plan
_Generated 2026-06-19. Based on full static analysis of `index.html` (12,893 lines), `givelink.html` (1,755 lines), `sw.js`, `vercel.json`, and `supabase-setup.sql`._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP blocks Supabase cloud sync entirely

**What:** `vercel.json:14` sets `connect-src` to a fixed allowlist that does not include any Supabase domain. All `fetch()` calls to `https://<project>.supabase.co` — auth, pull, push — are blocked by the browser's Content Security Policy. Cloud sync is non-functional in production.

**Where:** `vercel.json:14` (`connect-src` header), `index.html:8551`, `8598`, `8609` (Supabase fetch calls)

**Why it matters:** Every user who enabled cloud sync (Settings → Cloud Sync) gets silently broken data sync. The UI shows "Connected" but no data is ever written to or read from Supabase. Data loss risk on device switch.

**Effort:** S

**Suggested fix:**
- Add `https://*.supabase.co` to `connect-src` in `vercel.json:14`
- While there: also add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` (see item 2)

---

### 2. CSP blocks Google Fonts — Inter font never loads in production

**What:** `index.html:14` loads the Inter font stylesheet from `fonts.googleapis.com`. The CSP in `vercel.json:14` sets `style-src 'self' 'unsafe-inline'` and `font-src 'self'` — neither includes `fonts.googleapis.com` or `fonts.gstatic.com`. The stylesheet and font files are both blocked; the app silently falls back to system fonts.

**Where:** `vercel.json:14`, `index.html:12-14`

**Why it matters:** The entire visual design was built around Inter. On Windows/Android (no system Inter), the app renders with a visually different fallback (Segoe UI or Roboto), breaking spacing, weight, and letter-spacing assumptions across the UI.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src` in `vercel.json:14`
- Add `https://fonts.gstatic.com` to `font-src` in `vercel.json:14`
- Combine with item 1 fix in a single `vercel.json` change

---

### 3. XSS: goal titles and descriptions injected unescaped into innerHTML

**What:** `goalHTML()` at `index.html:2864-2865` interpolates `g.title` and `g.description` directly into an innerHTML template string with no `esc()` call. Same pattern in the Weekly Review wizard: `index.html:2888` (`t.title`), `2895` (`t.title`), `2897` (`g.title`). A goal or task with a title like `<img src=x onerror=alert(1)>` executes inline JavaScript. Additionally, `_renderChecklistEditor()` at `index.html:2046-2050` injects `c.text` unescaped.

**Where:** `index.html:2864`, `index.html:2865`, `index.html:2888`, `index.html:2895`, `index.html:2897`, `index.html:2046-2050`

**Why it matters:** Content pasted into a task/goal title from an untrusted source (email, web page, AI output) can execute arbitrary JavaScript. For a personal app storing API keys and personal data in localStorage, self-XSS can exfiltrate the Claude API key and all life data.

**Effort:** S

**Suggested fix:**
- Replace bare `${g.title}` / `${g.description}` / `${t.title}` / `${c.text}` with `${esc(g.title)}` etc. in all innerHTML template literals in the functions listed above
- The `esc()` function already exists at `index.html:9773`; it is hoisted and available throughout

---

### 4. Missing `icons/icon-192.png` breaks push notifications

**What:** `sw.js:38-39` references `./icons/icon-192.png` as the icon and badge for push notifications. `index.html:9286` also references the same path for browser Notification API calls. The `icons/` directory does not exist anywhere in the repository.

**Where:** `sw.js:38-39`, `index.html:9286`

**Why it matters:** Push notification events from the service worker either display without an icon (ugly) or, on stricter platforms, the `showNotification()` promise rejects silently. Reminder notifications — a key retention feature — degrade or fail.

**Effort:** S

**Suggested fix:**
- Create `icons/icon-192.png` by rasterising `icon.svg` at 192×192 (use Inkscape CLI or a CI step)
- Alternatively, change the paths in `sw.js:38-39` and `index.html:9286` to `'./icon.svg'` — SVG is accepted as a notification icon in modern browsers

---

### 5. Givelink AI Sprint Planner ignores stored API key; always falls through to `window.prompt()`

**What:** `givelink.html:1075-1087` `getApiKey()` searches `localStorage.getItem('taskos_profiles')` and `taskos_data_<id>.apiKey` — a format that does not exist in the actual Task OS data model. Task OS stores the key at `S.claudeKey` inside the `taskos` blob. The lookup always returns `null`, triggering a blocking `window.prompt()` every time the AI Sprint Planner is used. `callClaudeGL()` at `givelink.html:1259` already reads the key correctly from the `taskos` blob.

**Where:** `givelink.html:1075-1087` (`getApiKey()`), `givelink.html:1098` (caller), compared against correct implementation at `givelink.html:1259`

**Why it matters:** Every sprint planning session interrupts the user with a browser-native `prompt()` dialog even when the key is already configured. In some secure contexts (sandboxed iframes, certain Android WebViews), `prompt()` is blocked and the feature silently refuses to work.

**Effort:** S

**Suggested fix:**
- Delete `getApiKey()` entirely
- In `runAiSprintPlanner()` at `givelink.html:1098`, replace `const apiKey=getApiKey();` with an inline read: `let apiKey=''; try{const d=JSON.parse(localStorage.getItem('taskos')||'{}');apiKey=d.claudeKey||localStorage.getItem('taskos_api_key')||'';}catch(e){} if(!apiKey){toast('Add Claude API key in Task OS → Settings first');return;}`
- This mirrors the working pattern already used in `callClaudeGL()`

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. Givelink brand colors don't match the Givelink brand palette

**What:** `givelink.html:18` defines `--accent:#3b82f6` (Tailwind blue-500) throughout the sprint board. The Givelink brand palette is purple (#5718CA primary, #6B3FA0 secondary). The workspace switcher pill in `index.html:533` uses `#a78bfa` (a desaturated violet) which is also off-brand. No file uses the brand pinks (#C2185B, #E353B6).

**Where:** `givelink.html:18` (CSS custom properties), `index.html:533` (workspace switcher button)

**Why it matters:** Givelink's sprint board looks like a generic blue project tool, not a branded product. Any nonprofit partner or investor who views the internal board sees mismatched branding.

**Effort:** M

**Suggested fix:**
- In `givelink.html:18`, set `--accent:#5718CA` and add `--accent-secondary:#6B3FA0`
- Update `hover` states and `box-shadow` colors in givelink.html to use the purple tones (avoid pink on purple per brand rules)
- In `index.html:533`, change the workspace switcher from `color:#a78bfa` to `color:#5718CA` and update the border/background accordingly

---

### 7. `window.prompt()` used for CRM activity logging — blocked in many contexts

**What:** `givelink.html:1431` uses `const note=window.prompt('Log activity (what happened?):');` for the nonprofit CRM contact log. `prompt()` is a blocking, context-interrupting dialog, disabled in sandboxed environments, and feels jarring in a modern web app.

**Where:** `givelink.html:1431`

**Why it matters:** The CRM is the core nonprofit relationship tool. Every time someone logs an activity, they get a browser-native blocking prompt instead of an inline input. On Android PWA or secure iframes, `prompt()` returns `null` silently, swallowing the log entry.

**Effort:** S

**Suggested fix:**
- Replace `window.prompt()` with a small inline modal: show a two-field form (textarea + date) via `openM()` with the existing modal infrastructure
- Reuse the existing modal skeleton (`.mo`/`.md`/`.mf` classes) — there's already precedent for similar micro-modals elsewhere in the file

---

### 8. Supabase auth errors show cryptic status text, no actionable guidance

**What:** When Supabase auth fails (expired token, wrong credentials, network error), `sbSyncNow()` at `index.html:8630` catches the error and sets `_sbSetStatus('⚠ '+e.message)`. The raw error message (e.g. `"auth 401"`, `"push 500"`) appears in a small status element inside the Settings modal, which the user only sees if Settings is open.

**Where:** `index.html:8630` (catch block), `index.html:8638` (`sbPush` error in `_sbScheduleSync`)

**Why it matters:** Users lose sync silently. The error is invisible during normal use. Data diverges between devices without warning.

**Effort:** S

**Suggested fix:**
- Add a `toast()` call inside the catch block for sync errors (`toast('⚠️ Sync failed — open Settings to reconnect', 5000)`)
- Differentiate 401 errors ("Session expired — reconnect in Settings") from network errors ("Offline — will retry")
- Add a persistent "Sync error" badge in the sidebar when `_sbStatus` starts with `⚠`

---

### 9. iOS PWA install button silently does nothing with no user guidance

**What:** `index.html:8745` guards with `if(!_installPrompt)return;`. On iOS, the `beforeinstallprompt` event never fires so `_installPrompt` is always `null`. The Install App button (in Settings) is shown but tapping it silently returns. iOS users can still install via Safari's Share sheet, but there's no guidance.

**Where:** `index.html:8744-8748` (`installPWA()` function)

**Why it matters:** iOS is a large share of mobile traffic. Users who tap "Install App" and get no response assume the feature is broken, not that they need to use a different flow.

**Effort:** S

**Suggested fix:**
- In the `if(!_installPrompt)return;` early return, check for iOS and show guidance: `if(/iPhone|iPad|iPod/.test(navigator.userAgent)){toast('On iOS: tap the Share button → "Add to Home Screen"',5000);return;}`

---

### 10. AI morning briefing silently shows stale or empty content on cache parse failure

**What:** `index.html:9661` catches a JSON parse error from the briefing cache with `console.warn('Morning briefing cache error:',e)` and then continues to call `_renderAIBriefing(d,el)` with the cached data that just failed to parse. If `d` is `null` or malformed, `_renderAIBriefing` receives bad data and renders either blank content or throws silently.

**Where:** `index.html:9661` (cache read in morning briefing function)

**Why it matters:** The morning briefing is the first thing the user sees on Dashboard. Stale or blank content undermines trust in the AI features.

**Effort:** S

**Suggested fix:**
- In the catch block, set `d=null` to skip cache and fall through to a fresh fetch, or show a retry button rather than silent empty state
- Add a visible "could not load briefing" fallback with a "Try again" button

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Two conflicting API key lookup paths co-exist in `givelink.html`

**What:** `givelink.html` has two separate functions for finding the Claude API key: `getApiKey()` (line 1075) searches `taskos_profiles` + `taskos_data_*` (non-existent format); `callClaudeGL()` (line 1259) reads from the `taskos` blob's `claudeKey`. They can return different values depending on what's in localStorage.

**Where:** `givelink.html:1075-1087`, `givelink.html:1259`

**Why it matters:** Different Givelink AI features use different key sources. This makes debugging API key issues nearly impossible; a key set in Task OS may work in some features and fail in others.

**Effort:** S

**Suggested fix:**
- Remove `getApiKey()` (addressed in P0 item 5); standardize all key reads to `callClaudeGL()`'s pattern: read from `taskos` blob first, then `taskos_api_key` fallback

---

### 12. Service worker cache key is a hardcoded date string

**What:** `sw.js:1` defines `const CACHE = 'task-os-20260530'`. Stale cache is only busted when this string is manually updated. If a deploy goes out without updating this string, users continue running the previous version from cache.

**Where:** `sw.js:1`

**Why it matters:** Stale service worker caches have caused multiple recent bug fix commits (PR #51-54) to reach some users with a delay. The date string is easy to forget on quick deploys.

**Effort:** S

**Suggested fix:**
- Replace the hardcoded date with a version tied to a consistent signal, e.g. `const CACHE = 'task-os-v54'` matching the PR/commit number
- Add a comment `// BUMP ON EVERY DEPLOY` directly above the constant
- Long-term: inject the cache key via a CI build step using the git SHA

---

### 13. `esc()` is defined at line 9773 but needed from line 2046 onwards

**What:** The `esc()` HTML-escaping helper is defined at `index.html:9773`, near the bottom of the 12,893-line file. It's called throughout the file starting at line 2046. While JavaScript hoisting makes this work at runtime, any new contributor reviewing the rendering functions has no way to know the escaping function exists without reading 70%+ of the file.

**Where:** `index.html:9773` (definition), first use near `index.html:2062`

**Why it matters:** Makes XSS auditing harder. Contributors adding innerHTML templates copy patterns they see locally, which often lack `esc()`, compounding the vulnerability surface.

**Effort:** S

**Suggested fix:**
- Move the `esc()` definition to the top of the `<script>` block (after constants, before any rendering functions — around line 2030)
- While moving: add a one-line comment `// HTML-escape for all innerHTML insertions — always use this`

---

### 14. State arrays grow unbounded — approaching localStorage quota silently

**What:** `S.healthLogs`, `S.contextLog`, `S.challengeLogs`, `S.happinessLogs`, `S.photoLogs`, and `S.givelinkHistory` are appended to indefinitely. After months of daily use, the `taskos` JSON blob can exceed the 5-10MB localStorage limit. The only protection is a `QuotaExceededError` catch at `index.html:2101-2103` that shows a toast — after the write fails.

**Where:** `index.html:2097-2106` (`save()` function), `index.html:2036` (state schema)

**Why it matters:** When the quota is hit, `save()` silently fails for that call (toast fires but data is not persisted). Subsequent saves also fail. The user's next session loads state from before the failure, losing recent data.

**Effort:** M

**Suggested fix:**
- Add a pruning step inside `save()` that caps high-frequency arrays: `S.contextLog = (S.contextLog||[]).slice(-200); S.challengeLogs = (S.challengeLogs||[]).slice(-365);`
- Add a storage usage check on load: `if(JSON.stringify(S).length > 4_000_000) toast('⚠️ Storage is 80% full — export a backup', 6000)`
- Log health entries (workouts, sleep, etc.) are worth keeping fully — only prune ephemeral/high-frequency logs

---

### 15. README describes project structure that doesn't exist

**What:** `README.md:42-48` lists `style.css` and `script.js` as separate files. Neither exists. The actual structure is a single 873KB `index.html` file containing all CSS, HTML, and JavaScript.

**Where:** `README.md:42-48`

**Why it matters:** Misleads any contributor or new team member trying to find the code. Sets wrong expectations about the tech stack.

**Effort:** S

**Suggested fix:**
- Update README's "Project Structure" section to accurately list `index.html` (all code), `givelink.html` (sprint board), `sw.js` (service worker), `supabase-setup.sql`, `vercel.json`
- Add a one-liner about the monolithic architecture so contributors aren't surprised

---

## 💡 P3 — Nice to have

### 16. No tests for any data mutation or calculation functions

**What:** Zero test files in the repository. Functions like `goalStats()`, `calcLifeScore()`, `sbSyncNow()`, and the XP/badge system have no automated coverage. Bugs surface only through manual use.

**Where:** Entire repo (no `*.test.js`, `*.spec.js`)

**Why it matters:** PR #51-54 all contain bug fixes for regressions — four hotfixes in one day. A minimal test suite would have caught the ladder crash and backdrop-close bugs before shipping.

**Effort:** L

**Suggested fix:**
- Add Vitest (zero-config, runs in Node) with a `tests/app.test.js` file
- Start with 10 unit tests: `goalStats()`, `calcLifeScore()`, `save()/load()` round-trip, XP calculation, and the Supabase last-write-wins merge logic

---

### 17. No lazy rendering for non-primary views

**What:** All 39 views in `index.html` are present as hidden `<div>` elements in the DOM on initial load. The browser must parse ~12,893 lines before displaying the dashboard. Views like AGI Prep, Flourishing, and Security are rarely visited but always parsed.

**Where:** `index.html:602-~12000` (all views defined in HTML)

**Why it matters:** First meaningful paint is delayed. On a mid-range Android phone the Time to Interactive is noticeably long on first load.

**Effort:** L

**Suggested fix:**
- Convert `nav()` to populate view HTML on first visit, storing a `Set` of initialized views
- Start with collapsed nav groups (Life OS, Grow, More) — these 13 views are rarely hit on first session

---

### 18. Sidebar nav items use `<div onclick>` — keyboard inaccessible

**What:** Navigation items are `<div class="ni" onclick="nav('...')">` with no `role`, no `tabindex`, and no keyboard event handler. Tab key navigation skips them entirely. Modal close buttons (class `mc`) are `<button>` elements but have no `aria-label` — they display only `×`.

**Where:** `index.html:538-600` (sidebar nav divs), `index.html:141` (`.mc` CSS definition, used throughout modals)

**Why it matters:** The app is inaccessible to keyboard-only users and screen reader users. Fails WCAG 2.1 Level A (1.3.1, 2.1.1).

**Effort:** M

**Suggested fix:**
- Add `role="button" tabindex="0"` and `onkeydown="if(event.key==='Enter'||event.key===' ')nav('dashboard')"` to all sidebar `<div class="ni">` elements
- Add `aria-label="Close"` to all `.mc` buttons throughout modals

---

### 19. `script-src 'unsafe-inline'` in CSP negates XSS protection

**What:** `vercel.json:14` sets `script-src 'self' 'unsafe-inline'`. `'unsafe-inline'` allows all inline `<script>` tags and event handlers, which means the CSP provides no protection against XSS — even once the P0 innerHTML issues are fixed, any injected `<script>` tag would still execute.

**Where:** `vercel.json:14`

**Why it matters:** The CSP is effectively decorative for XSS protection. Its only real value currently is blocking non-self scripts from external domains.

**Effort:** M

**Suggested fix:**
- Long-term: move all JavaScript to a separate `app.js` file, remove `'unsafe-inline'` from `script-src`, and use `'strict-dynamic'` with a nonce or hash
- Short-term acceptable: keep current CSP but document the risk and prioritise the XSS innerHTML fixes (item 3, item 9 in P0/P1) so the attack surface is minimised

---

### 20. Givelink and Task OS sync via title-string matching — fragile

**What:** `givelink.html:1206-1248` `syncToTaskOS()` matches tasks between apps by comparing `gt.title.toLowerCase() === tt.title.toLowerCase()`. A task renamed in either app will be duplicated or orphaned on the next sync. Sprint-done tasks are marked done in Task OS, but there's no reverse sync (Task OS completions don't update Givelink).

**Where:** `givelink.html:1221`, `givelink.html:1234`

**Why it matters:** Sprint sync is the primary data integration point between the two apps. Title-based matching is fragile and breaks on any edit, creating duplicates that pollute the Task OS inbox.

**Effort:** M

**Suggested fix:**
- Store a `giveLinkId` field on tasks when they are pushed to Task OS; use ID matching instead of title matching
- Add reverse sync: when a task is completed in Task OS, find the matching Givelink task by `giveLinkId` and mark it done
