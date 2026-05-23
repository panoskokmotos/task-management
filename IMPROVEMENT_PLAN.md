# Givelink / Task OS — Improvement Plan

_Generated: 2026-05-23 · Codebase: `index.html` (9,565 lines), `givelink.html` (1,755 lines), `sw.js`, manifests_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `finishReview()` crashes and loses the user's weekly review

**What:** `JSON.parse(localStorage.getItem('taskos_history')||'[]')` at line 2439 has no try/catch. If `taskos_history` was corrupted by a previous quota-exceeded mid-write, this throws an uncaught exception — the weekly review is never saved, and the user gets no error message.

**Where:** `index.html:2439–2441`

**Why it matters:** The Sunday weekly review is a keystone ritual. Silent data loss here destroys trust in the whole app.

**Effort:** S

**Suggested fix:**
- Wrap lines 2439–2441 in `try { … } catch(e) { console.warn('taskos_history corrupt, resetting', e); localStorage.removeItem('taskos_history'); }`
- Alternatively, consolidate `taskos_history` into the main `taskos` key so it shares the same parse guard already in `load()`

---

### 2. Unescaped `t.title` injected into `innerHTML` in three render functions

**What:** Task titles are inserted raw into `innerHTML` without calling `esc()` in the task card renderer (`tcHTML`), the weekly wizard steps, and the completed-tasks digest. An imported backup with HTML in a title (e.g. from a pasted CSV) corrupts the task list display.

**Where:** `index.html:2366` (wizard step 1), `index.html:2373` (wizard step 2), `index.html:2458` (`tcHTML` — used everywhere)

**Why it matters:** Every task card across all views is rendered via `tcHTML`. One malformed import entry breaks the entire task list visually. The `esc()` helper already exists at line 8107 — it is simply not used consistently.

**Effort:** S

**Suggested fix:**
- In `tcHTML` (line 2458), change `${t.title}` → `${esc(t.title)}`
- Do the same at lines 2366 and 2373 inside the wizard body strings
- Add a repo-wide grep for `${t.title}` (without `esc`) and audit each hit

---

### 3. EOD quick-pick embeds task title inside an `onclick` attribute without attribute encoding

**What:** Line 8280 builds `onclick="…value='${t.title.replace(/'/g,"\'")}';"` — only single-quotes are escaped. A task title containing a double-quote (`"`) terminates the attribute early; a title containing `<` or `>` can inject extra markup. The button silently does nothing or breaks adjacent UI.

**Where:** `index.html:8280`

**Why it matters:** End-of-day ritual is a daily touch-point. A task named `Fix "the bug"` breaks the entire EOD quick-pick list silently.

**Effort:** S

**Suggested fix:**
- Replace inline onclick with a `data-title` attribute and a delegated event listener: `<div data-title="${esc(t.title)}" class="eod-pick">…</div>` + `el.addEventListener('click', e => { const el = e.target.closest('.eod-pick'); if(el) mit.value = el.dataset.title; })`
- This pattern is already used elsewhere in the codebase (swipe gestures use `data-swipe-id`)

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Brand accent color is GitHub blue, not brand purple — used in 50+ UI elements

**What:** `--accent: #58a6ff` (dark theme) and `--accent: #2563eb` (light theme) are Tailwind/GitHub blues. Every active nav item, button border, progress bar, sprint indicator, checkbox, and link uses this color. The brand is purple (`#6B3FA0` / `#5718CA`). The manifest `theme_color` also shows blue on the PWA splash screen.

**Where:** `index.html:17` (dark), `index.html:24` (light) · `manifest.json:9` · `manifest-givelink.json:17`

**Why it matters:** Every screen the user sees is blue-accented. This breaks the visual brand identity entirely and makes the product look like a GitHub clone.

**Effort:** S

**Suggested fix:**
- Change `--accent` in `:root` to `#6B3FA0` and in `body.light` to `#5718CA`
- Update `theme_color` in both manifest files to `#6B3FA0`
- Spot-check high-contrast text on the new purple (WCAG AA requires 4.5:1 on small text)

---

### 5. No empty state or onboarding for new users — dashboard shows a wall of zeros

**What:** On first load (empty `S`), the dashboard displays five stat cards all reading `0`, an empty Eisenhower matrix, an empty Top 3 section, and no CTA explaining what to do next. There is no "add your first task" prompt anywhere.

**Where:** `index.html:2052–2110` (dashboard render), `index.html:2130–2160` (Top 3 section)

**Why it matters:** The first-run experience is the conversion moment. A blank dashboard with zeros reads as broken, not minimal.

**Effort:** M

**Suggested fix:**
- Add an `if (!S.tasks.length)` branch in the dashboard render that shows a single "capture your first task" CTA card with a button calling `openQuickAdd()`
- In the Top 3 section, replace the empty container with a one-sentence explanation of what Top 3 means and a link to add tasks
- These can be pure HTML strings — no new abstractions needed

---

### 6. Mobile layout: single breakpoint, givelink.html 5-column grid never collapses

**What:** `index.html` has one `@media (max-width:768px)` breakpoint (line 168) that only switches to column layout and hides some header buttons. `givelink.html` has **no media queries at all** — its `.pcards{grid-template-columns:repeat(5,1fr)}` and Kanban board overflow horizontally on every phone.

**Where:** `index.html:168,197,203,254` · `givelink.html` (no @media rules)

**Why it matters:** The app is installed as a PWA on mobile. The givelink sprint board is completely unusable on a phone — columns overflow off-screen with no horizontal scroll affordance.

**Effort:** M

**Suggested fix:**
- In `givelink.html`, add `@media(max-width:768px){.pcards{grid-template-columns:1fr 1fr;}.main{overflow-x:auto;}}` as a minimum
- In `index.html`, add breakpoints for the 5-column stats grid (`.stats`) and the Eisenhower 2×2 grid (`.eg`) so they collapse to 1 column below 480px
- Test with Chrome DevTools device emulation before shipping

---

### 7. `taskos_history` secondary localStorage key silently fails on quota exceeded

**What:** `taskos_history` is written at line 2441 with `localStorage.setItem(...)` — but unlike the main `save()` (which has a `QuotaExceededError` handler at line 1813), this write has no error handling. It also grows unboundedly — every weekly review appended forever.

**Where:** `index.html:2439–2441`

**Why it matters:** Users who have been using the app for a year will hit localStorage quota. The weekly review appears to save (toast fires) but the history is actually lost.

**Effort:** S

**Suggested fix:**
- Wrap in try/catch matching the pattern at line 1811–1816
- Add a cap: keep only the last 52 entries (one year of weekly reviews) before pushing
- Consider removing `taskos_history` entirely and reading from `S.reviews` (which is already in the main key)

---

### 8. Service worker cache key is a hardcoded date — stale HTML served indefinitely after deploys

**What:** `sw.js:1` hardcodes `const CACHE = 'task-os-20260521'`. The activate handler deletes all other caches (line 22–27), but if this constant is not updated on every deploy, users get the old `index.html` from the service worker cache indefinitely regardless of Vercel's CDN cache headers.

**Where:** `sw.js:1`

**Why it matters:** A bug fix deployed to Vercel will not reach installed PWA users until the cache key is bumped. This is a silent release blocker.

**Effort:** S

**Suggested fix:**
- Replace the hardcoded date with a build-time value injected via a Vercel build command: add a `build` script that runs `sed -i "s/task-os-[0-9]*/task-os-$(date +%Y%m%d%H%M)/" sw.js` before deploy
- Or use `__CACHE_VERSION__` as a placeholder and substitute it in `vercel.json` build hooks

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. 9,565-line monolithic HTML file — no modularity, no testability

**What:** All CSS, all JS (~7,000 lines), and all HTML templates live in a single file. There are zero automated tests. Adding any feature risks breaking an unrelated one with no safety net.

**Where:** `index.html` (entire file)

**Why it matters:** At this size, a single typo mid-refactor can break 20 features. Onboarding a collaborator is effectively impossible. PR diffs are unreadable.

**Effort:** L

**Suggested fix:**
- Do not rewrite — extract incrementally: start with `callClaude()` and all AI features into `ai.js`, loaded as `<script src="ai.js">` at the bottom
- Move CSS variables and base resets into `base.css`
- Each extracted file becomes independently testable with a simple HTML harness
- Target: reduce `index.html` below 3,000 lines over 4–6 sprints

---

### 10. Empty catch blocks suppress push notification failures without any signal

**What:** Three catch handlers are `catch(_){}` with no body — lines 7622 (browser Notification constructor), 7644 (`postToNtfy` ntfy.sh send), 7666 (`saveNtfySettings` confirmation send). When ntfy.sh is misconfigured or the browser notification is blocked, the user sees nothing.

**Where:** `index.html:7622`, `index.html:7644`, `index.html:7666`

**Why it matters:** Push notifications are a retention feature. Silent failures mean users assume the feature works when it doesn't, and reminders never arrive.

**Effort:** S

**Suggested fix:**
- At 7644: `catch(e){ console.warn('ntfy post failed', e); }` — even a console warning lets developers diagnose it
- At 7622: log the error; if it's `NotAllowedError`, show a toast: "Enable notifications in browser settings"
- At 7666: surface the failure to the user since this is interactive (they just hit "Save")

---

### 11. External API base URLs are inline string literals — no central constants

**What:** `https://api.anthropic.com/v1/messages` (line 3407), `https://readwise.io/api/v2` (line 7142), `https://api.notion.com/v1/blocks/` (line 7263), and `https://ntfy.sh` (line 7635) are each written as one-off strings. Changing an endpoint requires a grep-and-replace across the file.

**Where:** `index.html:3407`, `index.html:7142`, `index.html:7263`, `index.html:7635`

**Why it matters:** Anthropic versioned their API once already. When they do again, every integration will need manual updating.

**Effort:** S

**Suggested fix:**
- Define at the top of the script block: `const API = { claude: 'https://api.anthropic.com/v1/messages', readwise: 'https://readwise.io/api/v2', notion: 'https://api.notion.com/v1/blocks/', ntfy: 'https://ntfy.sh' };`
- Replace all inline strings with `API.claude`, `API.readwise`, etc.

---

### 12. Magic numbers without named constants in business logic

**What:** `oldSomeday.length >= 3` and `29` days (line 2202), `7 * 86400000` for a week in ms (line 4022), `new Date().getDay() >= 3` for "mid-week" (line 4014), and `candidates.slice(0, 30)` for AI sequence limit (line 3432) are all inline literals with no explanation.

**Where:** `index.html:2202`, `index.html:4014`, `index.html:4022`, `index.html:3432`

**Why it matters:** `86400000` reads as a typo, not "one day in milliseconds." Magic numbers are the #1 source of off-by-one bugs when these values need adjusting.

**Effort:** S

**Suggested fix:**
- `const DAY_MS = 86400000; const WEEK_MS = 7 * DAY_MS;`
- `const SOMEDAY_AUDIT_THRESHOLD = 3; const SOMEDAY_AUDIT_DAYS = 29;`
- `const AI_SEQUENCE_LIMIT = 30;`
- Define all at the top of the script block alongside existing constants like `CATS`, `BKTS`

---

### 13. `importData()` only validates the `tasks` array — bad imports silently corrupt all other state

**What:** Line 1832 checks `if(!d.tasks || !Array.isArray(d.tasks))` and rejects the file. But if the file is a valid JSON object with a `tasks` array but corrupted `goals`, `habits`, `people`, or `weeklyNotes`, those fields are merged via `Object.assign(S, d)` with no validation.

**Where:** `index.html:1826–1836`

**Why it matters:** An accidentally modified backup JSON can wipe goals or habits silently. The user sees "✅ Imported 47 tasks!" and doesn't know their goals are gone.

**Effort:** S

**Suggested fix:**
- Validate array fields before merge: `['goals','habits','people','books','values','wins'].forEach(k => { if(d[k] !== undefined && !Array.isArray(d[k])) { toast('❌ Invalid backup: '+k+' field corrupted'); return; } });`
- Show a summary: "Imported 47 tasks, 8 goals, 12 habits" so users can spot missing data

---

### 14. Push notification icon path `./icons/icon-192.png` doesn't exist in the repo

**What:** `sw.js:38–39` and `sw.js:43` reference `./icons/icon-192.png` for push notification display. The `icons/` directory does not exist — only `icon.svg` and `icon-gl.svg` are present. All browser push notifications will display with a broken/default icon.

**Where:** `sw.js:38`, `sw.js:39`, `sw.js:43`

**Why it matters:** Branded push notifications reinforce the app identity. Broken icon paths also generate 404 log noise in production.

**Effort:** M

**Suggested fix:**
- Generate a 192×192 PNG from `icon.svg` (e.g. `npx svgexport icon.svg icon-192.png 192:192`) and commit it under `icons/`
- Or update sw.js to reference `./icon.svg` directly (modern browsers support SVG notification icons)
- Add `./icons/icon-192.png` to the `STATIC` array in sw.js so it's pre-cached

---

## 💡 P3 — Nice to have

### 15. Interactive buttons throughout both files lack `aria-label` attributes

**What:** Task checkboxes, modal close buttons, emoji action buttons, and status cycle buttons (`cycleStatus`, `toggleDone`) have no accessible names. Screen readers announce them as unlabeled buttons.

**Where:** `index.html:2456` (checkbox in tcHTML), `givelink.html:81` (checkbox in tc2), throughout both files

**Why it matters:** Accessibility is both a legal requirement in some markets and good practice. VoiceOver/NVDA users cannot operate the task list.

**Effort:** M

**Suggested fix:**
- Add `aria-label` to the checkbox: `aria-label="Mark '${esc(t.title)}' as done"`
- Add `aria-label="Close"` to all modal close buttons
- Run an automated axe-core scan (browser extension, free) to get a full inventory

---

### 16. PWA manifest has SVG-only icon — some browsers require PNG for install/splash

**What:** Both manifests declare only `icon.svg` as the PWA icon. Safari and older Chrome on Android require a raster PNG (at minimum 192×192) for the home screen icon and splash screen. The install prompt may be suppressed or show a broken icon.

**Where:** `manifest.json:13–19` · `manifest-givelink.json`

**Why it matters:** PWA install is a core acquisition channel for a productivity app. A broken home screen icon undermines the native app feel.

**Effort:** M

**Suggested fix:**
- Generate `icon-192.png` and `icon-512.png` from the SVG
- Add both to the `icons` array in each manifest with `"type": "image/png"` and sizes `"192x192"`, `"512x512"`
- This also resolves item #14 (missing icon for push notifications)

---

### 17. No keyboard focus trap in modals — Tab key navigates to background content

**What:** When any modal is open (edit task, AI output, weekly wizard, etc.), pressing Tab cycles focus through background sidebar links and nav items, not just modal content. There is no `aria-modal="true"` or focus trap implementation.

**Where:** `index.html` — all modal open functions (approx. lines 2550, 3421, 4063, 5761, 7164)

**Why it matters:** Keyboard-only users cannot operate modals safely. Focus escaping to the background also causes confusion for sighted users on slow connections.

**Effort:** M

**Suggested fix:**
- Add a 15-line `trapFocus(modalEl)` utility: on modal open, collect all focusable elements, intercept Tab/Shift+Tab to cycle within them, restore focus on close
- Wire it into the existing `closeM()` and modal open functions

---

### 18. `givelink.html` `theme_color` is Tailwind blue — wrong brand color on PWA chrome

**What:** `givelink.html:6` sets `<meta name="theme-color" content="#3b82f6">`. This colors the browser chrome and app switcher thumbnails with Tailwind blue instead of brand purple.

**Where:** `givelink.html:6` · `manifest-givelink.json` (if it also has a `theme_color`)

**Why it matters:** On Android, the theme color is visible whenever the PWA is open. Blue-branded chrome undermines the visual identity.

**Effort:** S

**Suggested fix:**
- Change `#3b82f6` to `#6B3FA0` in `givelink.html:6`
- Update `manifest-givelink.json` `theme_color` to match
- Check that text/icons remain legible against the purple background

---

_Total: 18 items — 3 P0, 5 P1, 6 P2, 4 P3_
