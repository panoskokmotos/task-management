# Givelink / Task OS — Improvement Plan

> Generated 2026-05-31 via full codebase audit of `index.html` (12,888 lines), `givelink.html` (1,755 lines), `sw.js`, and `vercel.json`.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. CSP silently blocks Google Fonts — Inter never loads in production

**What:** `vercel.json` sets `style-src 'self' 'unsafe-inline'` and `font-src 'self'`, both of which block the external Google Fonts request the `<link>` tag makes on every load.

**Where:** `vercel.json:14`, `index.html:12-14`

**Why it matters:** In production, the app silently falls back to `-apple-system` / `BlinkMacSystemFont`. Inter's tabular numerals and tight letter-spacing are load-bearing design choices — without them, the dashboard stats, timer, and XP bar look broken and inconsistent across OSes. The font has probably never loaded for any user via Vercel.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src` in `vercel.json:14`
- Add `https://fonts.gstatic.com` to `font-src` in `vercel.json:14`
- Alternative: self-host Inter via `@font-face` in the `<style>` block to eliminate the external dependency entirely and respect the current strict CSP

---

### 2. CSP silently blocks Supabase sync — cloud backup is broken for every configured user

**What:** `connect-src` in `vercel.json` lists specific domains but omits `*.supabase.co`. Every `fetch()` call in `_sbAuth()`, `sbSyncNow()`, and `sbPush()` is blocked by the browser with a CSP violation — silently, with no error shown to the user.

**Where:** `vercel.json:14`, `index.html:8546`, `index.html:8593`, `index.html:8604`

**Why it matters:** Any user who went through the effort of configuring Supabase for cross-device sync is getting zero benefit. Their data is not being backed up. They have no idea. This is the highest-effort feature in Settings.

**Effort:** S

**Suggested fix:**
- Add `https://*.supabase.co` to `connect-src` in `vercel.json:14`
- Note: user-configurable Supabase URLs mean a wildcard subdomain is necessary

---

### 3. Push notification icon is a 404 — every notification is broken

**What:** `sw.js:38-39` references `./icons/icon-192.png` for the `icon` and `badge` fields of every push notification. The `icons/` directory does not exist in the repo — only `icon.svg` and `icon-gl.svg` at the root.

**Where:** `sw.js:38-39`, `manifest.json:13-19`

**Why it matters:** Every push reminder (habits, deep work sessions, ntfy) shows either a broken image or a generic system icon. Users don't recognise the notification as coming from Task OS. On Android, the badge icon is also broken.

**Effort:** S

**Suggested fix:**
- Change both `icon` and `badge` in `sw.js:38-39` to `'./icon.svg'`
- Or generate PNG icons (192px and 512px) using the existing SVG and add them to an `icons/` dir, then update `manifest.json` to reference them for better PWA installability

---

### 4. Claude API key is serialized into Supabase — leaks on any DB breach

**What:** `S.claudeKey` lives inside the main `S` state object (declared at `index.html:2036`). `sbPush()` serializes the entire `S` object as `JSON.stringify(S)` and pushes it to Supabase's `app_state` table. The API key is stored in plaintext in the cloud.

**Where:** `index.html:2036` (key lives in S), `index.html:8600–8604` (`sbPush` serializes S)

**Why it matters:** A Supabase RLS misconfiguration, a compromised anon key, or any DB-level breach exposes the Claude API key. Other third-party credentials (Readwise token, Notion token) are correctly stored in isolated `localStorage` keys excluded from sync — `claudeKey` is the only outlier.

**Effort:** S

**Suggested fix:**
- Remove `claudeKey` from the `S` declaration; read/write it via `localStorage.getItem/setItem('taskos_claude_key')` as a standalone key (same pattern used for `taskos_readwise_key` at `index.html:8483/8508`)
- Update `openSettings()` and `saveSettings()` to use the new key; update `callClaude()` to read from localStorage directly
- On first load after deploy, migrate: `if(S.claudeKey && !localStorage.getItem('taskos_claude_key')) { localStorage.setItem('taskos_claude_key', S.claudeKey); delete S.claudeKey; save(); }`

---

### 5. Task title rendered as raw HTML in delete toast — self-XSS corrupts UI

**What:** `delTask()` passes `t.title` unescaped into a template literal that is then set via `el.innerHTML` in `toast()`. Titles containing `</strong><img src=x onerror=...>` execute arbitrary JS. Same pattern in `toggleDone()` at line 3184 (`t.bundledWith`) and badge unlock toasts at line 5988 (`b.name`).

**Where:** `index.html:3128`, `index.html:3184`, `index.html:5988`, `index.html:2273`

**Why it matters:** A task title like `</strong><b style="font-size:200px">HACKED</b>` will break the toast layout. A title with `onerror` on an injected image executes JS in the page context — including exfiltrating `S.claudeKey`. While the threat is currently self-injection (single-user app), it becomes meaningful if multi-user sharing is ever added or if data is imported from an untrusted backup.

**Effort:** S

**Suggested fix:**
- Wrap all user data interpolated into toast HTML with the existing `esc()` helper: `esc(t.title.slice(0,30))` at line 3128
- Apply the same fix at line 3184 (`esc(t.bundledWith)`) and line 5988 (`esc(b.name)`)
- `esc()` is already defined at `index.html:9768` — it just needs to be applied consistently

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 6. Brand accent color is blue (#58a6ff) — Givelink brand is purple (#5718CA)

**What:** The app's primary `--accent` and `--brand` tokens are `#58a6ff` (blue) in dark mode and `#2563eb` in light mode. The Givelink brand palette specifies purple (`#6B3FA0` / `#5718CA`). The workspace switcher button in the sidebar uses `#a78bfa` (a different, lighter purple). `givelink.html` uses yet another blue (`#3b82f6`). Three different accent colors across two workspaces.

**Where:** `index.html:22` (`--accent`/`--brand`), `index.html:30` (light mode), `index.html:533` (workspace button), `givelink.html:17`

**Why it matters:** Every call-to-action button, active state, and link uses the off-brand blue. The Givelink workspace, which is the company's operational hub, has no visual relationship to the company's own identity. This signals unfinished product to any stakeholder shown the app.

**Effort:** M

**Suggested fix:**
- Introduce a `--brand-gl` token: `#5718CA` (brand purple) / `#6B3FA0` (brand purple alt)
- Apply `--brand-gl` as the accent in `givelink.html` CSS variables
- In `index.html`, use the existing `--cg` color (`#cc5de8`) for Givelink-specific UI elements (workspace badge, givelink-dash nav item)
- Verify no pink (`#f783ac` / `#f472b6`) appears on the new purple backgrounds — the existing badge system already avoids this but check the hover/active states on `--cg`-colored elements

---

### 7. Modals have no consistent focus trap — keyboard navigation is broken

**What:** Focus trap logic exists at `index.html:3374` but is only applied to the main task modal (`tm`). The ~15 other modals (goal, settings, health, finance, confirm, prompt, AI output, etc.) do not receive focus on open, and tabbing inside them cycles into the background page.

**Where:** `index.html:3374` (trap logic), modal open functions throughout (e.g., `openSettings()`, `openAddGoal()`, `openM()`, `showConfirm()`)

**Why it matters:** Fails WCAG 2.1 Success Criterion 2.4.3 (Focus Order) and 2.1.2 (No Keyboard Trap inversion — focus escapes the modal). Keyboard-only users and screen reader users cannot reliably use any modal except Add Task.

**Effort:** M

**Suggested fix:**
- Create a single `_openModal(id)` utility that focuses the first focusable element inside the modal and sets up a keydown listener to trap Tab within `focusable` selectors
- Store the previously-focused element and restore it on `closeM(id)`
- Replace all direct `classList.remove('hidden')` modal openings with `_openModal(id)`

---

### 8. Toast stack has no ARIA live region — screen readers get no feedback

**What:** `#toast-stack` (`index.html:381`) has no `role` or `aria-live` attribute. Toast messages announcing errors, completions, deletions, XP gains, and AI results are invisible to screen readers.

**Where:** `index.html:381-383`, `index.html:2271-2278`

**Why it matters:** A screen reader user completing a task, hitting a validation error, or triggering an AI feature gets zero feedback. This makes the app fundamentally unusable without vision for the most common interactions.

**Effort:** S

**Suggested fix:**
- Add `role="status"` and `aria-live="polite"` to `#toast-stack` in the HTML at `index.html:381`
- For destructive or error toasts (containing "❌" or "⚠"), add a second hidden element with `role="alert"` and `aria-live="assertive"` and write the text content (not innerHTML) there so screen readers announce immediately

---

### 9. Weekly Review wizard step bar is illegible on mobile

**What:** `.wiz-step` is styled at `index.html:234` with `font-size:11px`. Six steps × 11px text across 100% width on a 375px screen renders labels like "Process" and "Intentions" as single or double characters. There is no responsive override.

**Where:** `index.html:234`, `index.html:2876` (render logic)

**Why it matters:** The Weekly Review is one of the highest-value flows in the app — it's the mechanism for intentional planning. Users who can't read the step bar on mobile skip steps or don't understand progress. On 360px devices it's completely illegible.

**Effort:** S

**Suggested fix:**
- At ≤480px, switch `.wiz-step` to show only the step number or a single emoji via a `data-short` attribute: `content: attr(data-short)` with `font-size:0` on the label span
- Or collapse the bar to a "Step 2 of 6" text + progress fill bar on mobile, which is more thumb-friendly anyway

---

### 10. Givelink.html has no mobile bottom navigation for key views

**What:** `givelink.html` defines a `.bnav` with only two items in the mobile bottom bar. Views like "Nonprofit CRM", "Past Sprints", "Backlog", and the five pillar views have no mobile bottom-nav entry. Users on mobile can only navigate to them by opening the sidebar.

**Where:** `givelink.html:154`, `givelink.html:171-174`

**Why it matters:** The Givelink sprint board is used operationally. On mobile during standup or meetings, the CRM and pillar views are inaccessible without the sidebar gesture. The sidebar is hidden off-screen on mobile.

**Effort:** M

**Suggested fix:**
- Add at minimum: Overview, Growth, Nonprofits, and "More" to the mobile bottom nav (4 items + overflow)
- Use the same `_showMoreNav()` pattern from `index.html` for the "More" item to expose remaining views in a sheet

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. Single 12,888-line monolithic HTML file

**What:** `index.html` contains all CSS (~500 lines), all HTML (~1,600 lines of static DOM), and all JavaScript (~10,800 lines) in a single file. There are no modules, no build step, no linting, and no tests.

**Where:** `index.html:1–12888`

**Why it matters:** A one-line typo in any render function requires diffing the entire file. Finding a function means scrolling thousands of lines. Adding any external contributor is impractical. Browser devtools show line numbers in the 5,000s for trivial bugs.

**Effort:** L

**Suggested fix:**
- Introduce a minimal Vite or esbuild pipeline: split JS into logical modules (`storage.js`, `ai.js`, `render-dash.js`, `render-review.js`, etc.) and use `<script type="module">` or bundled output
- Keep CSS in a single `styles.css` initially; split by component later
- The HTML skeleton can stay in `index.html`; inline JS is moved out
- This is an L effort but every other P2 item gets easier after this

---

### 12. Service worker cache key is date-hardcoded — stale assets guaranteed

**What:** `sw.js:1` sets `const CACHE = 'task-os-20260530'`. This value never changes unless someone manually edits the file. If `index.html` is deployed with a change but `sw.js` is not re-deployed (or is cached itself), users continue serving the old `index.html` from the service worker cache indefinitely.

**Where:** `sw.js:1`

**Why it matters:** The SW has `skipWaiting()` and `clients.claim()`, but if the cache key doesn't change, the new files are never fetched to populate the cache. Long-lived PWA installs can be stuck on days-old versions silently.

**Effort:** S

**Suggested fix:**
- Inject a build hash at deploy time: `const CACHE = 'task-os-__BUILD_HASH__'` replaced by a CI step or a Vite plugin
- Short-term stopgap: use `Date.now()` truncated to the day in a pre-push hook to auto-update the key: `const CACHE = 'task-os-' + new Date().toISOString().slice(0,10).replace(/-/g,'')`

---

### 13. `profileName` defaults to "Panos" — hardcoded personal name leaks into UI

**What:** `index.html:2038` reads `let profileName = localStorage.getItem('taskos_name') || 'Panos'`. Any session with cleared localStorage, any other user, or any demo context shows "Task OS — Panos" in the browser tab and all greeting strings.

**Where:** `index.html:2038`

**Why it matters:** If this app is ever demoed, open-sourced, or used by another person, every UI surface greets them as "Panos". It also makes the onboarding feel broken — first-time users see someone else's name before completing onboarding.

**Effort:** S

**Suggested fix:**
- Change the fallback to a neutral string: `|| 'You'` or trigger the onboarding name step for unset names
- If the onboarding modal already asks for a name (`index.html:8062–8066`), ensure it's shown before `document.title` is set with the name

---

### 14. `_autoSnapshot()` calls `save()` on every page load — wasted Supabase writes

**What:** `_autoSnapshot()` at `index.html:8638–8652` is called unconditionally at init (`index.html:8668`). It calls `save()` at line 8648, which calls `_sbScheduleSync()`, which pushes the full state blob to Supabase. This happens on every page load even when the snapshot was already taken today.

**Where:** `index.html:8638–8652`, `index.html:8668`

**Why it matters:** Every page load triggers an extra Supabase write (after the 2.5s debounce). With free-tier Supabase quotas, this adds up. More importantly it causes a write race: the app loads, fires two sync operations (init sync at line 8669 + autoSnapshot sync), and the second can overwrite a `sbSyncNow()` pull with stale data.

**Effort:** S

**Suggested fix:**
- Add a guard before calling `save()` in `_autoSnapshot()`: only call `save()` if `hasData` is true AND the entry was actually added (i.e., `S.givelinkHistory` was mutated)
- The `localStorage.setItem('taskos_autosnap', today)` guard already prevents duplicate snapshots — the `save()` inside that same block is the problem

---

### 15. `catB()` throws if category is falsy — silent render crash on malformed tasks

**What:** `catB(c)` at `index.html:2265` uses `c[0]` (first char of category) to build the CSS class. If `c` is `null`, `undefined`, or an empty string (possible on imported data), `c[0]` throws a TypeError, which crashes the render function that called it and leaves the view empty.

**Where:** `index.html:2265`

**Why it matters:** If a user imports a JSON backup where any task has `category: null` (e.g., exported from an older version), the entire task list, Eisenhower matrix, or bucket view silently fails to render with no error message.

**Effort:** S

**Suggested fix:**
- Change to: `function catB(c){ const k = CATS[c] ? c : 'other'; const x = CATS[k]; return \`<span class="badge c${k[0]}">${x.e} ${x.l}</span>\`; }`
- This guarantees `k` is always a valid CATS key before taking `k[0]`

---

## 💡 P3 — Nice to have

---

### 16. Deep Work timer state is lost on accidental page refresh

**What:** The Pomodoro/deep work timer runs entirely in in-memory state. If the user refreshes the page mid-session (common on mobile when apps are backgrounded and evicted), the timer resets with no warning.

**Where:** Deep work render functions in `index.html` (~lines 4700–4900 range)

**Why it matters:** Losing a 90-minute deep work session's timer mid-flow breaks focus and feels like a product failure. The session log (to `S.deepWorkSessions`) is only saved at session end.

**Effort:** M

**Suggested fix:**
- On timer start, write `{startedAt, duration, taskTitle}` to `sessionStorage`
- On page load, check sessionStorage for an in-progress session and offer "Resume your deep work session?" with the elapsed time

---

### 17. `confirm-msg` renders caller-supplied HTML — future callers risk XSS

**What:** `showConfirm()` at `index.html:2290–2291` does `document.getElementById('confirm-msg').innerHTML = msg`. All current callers pass literal HTML strings (`'Reset ALL data? This <strong>cannot be undone</strong>.'`), which is intentional. But the function's signature suggests plain strings, making it easy for future callers to accidentally pass user data.

**Where:** `index.html:2291`

**Why it matters:** One future refactor that passes a task title directly to `showConfirm()` without `esc()` would be an XSS escalation — confirm dialogs block the page and have a privileged appearance.

**Effort:** S

**Suggested fix:**
- Add an optional `htmlMsg` parameter to make the intent explicit: `showConfirm(plainText, cb, { htmlMsg: '<strong>formatted</strong>' })`
- Set `confirm-msg.textContent = plainText` by default; only use `innerHTML` when `htmlMsg` is explicitly passed
- Add a JSDoc comment to the function noting the XSS risk of innerHTML

---

### 18. Givelink sprint board has no "first sprint" onboarding state

**What:** When `givelink.html` is opened for the first time (or after a data reset), the overview view renders empty grids with no goal cards, no CTA, and no guidance. The sprint name defaults to "Sprint 1" and no start/end dates are set.

**Where:** `givelink.html:260–271`

**Why it matters:** A new Givelink team member or investor opening the board for the first time sees a blank dashboard. There's no path forward without already knowing to click "Sprint Settings."

**Effort:** S

**Suggested fix:**
- If `currentSprint.goals.length === 0`, render a hero state: "Start your first sprint" with a "⚡ Set Sprint Goals" button that opens Sprint Settings
- Pre-populate a sample sprint with one example goal per pillar (same pattern as `seed()` in `index.html`)

---

### 19. `#toast-stack` bottom position conflicts with mobile nav bar on older iPhones

**What:** `#toast-stack` is positioned at `bottom: 90px` on desktop and `bottom: calc(78px + env(safe-area-inset-bottom, 0px))` on mobile. On iPhone SE (375×667) and iPhone 13 mini, the combination of the 60px bottom nav bar + safe area often clips the bottom of long toast messages.

**Where:** `index.html:381`, `index.html:384`

**Why it matters:** Toasts containing actionable content (the "Undo" delete toast, the "→ CRM" relationship toast) may be partially hidden below the navigation bar on small iPhones — the exact users most likely to use the PWA.

**Effort:** S

**Suggested fix:**
- Increase the mobile bottom offset to `calc(90px + env(safe-area-inset-bottom, 0px))` to ensure the toast clears the nav bar on all device sizes
- Verify with Safari dev tools device simulation on iPhone SE

---

### 20. Light mode has no brand-gradient override — gradient buttons render dark purple on white

**What:** `.bp` buttons use `background: var(--brand-gradient)` which in light mode resolves to `linear-gradient(135deg, #2563eb, #9333ea)`. The text color rule `body.light .bp { color: #fff }` (`index.html:35`) ensures white text. However the gradient ends on `#9333ea` (medium purple) — white text on medium purple at small sizes may fail WCAG AA contrast (4.5:1).

**Where:** `index.html:30` (`--brand-gradient` in light mode), `index.html:35`

**Why it matters:** Primary action buttons (Save Task, Create Goal, etc.) may fail accessibility contrast in light mode, particularly for users with low vision or color deficiency.

**Effort:** S

**Suggested fix:**
- Verify contrast ratio: `#9333ea` background with `#ffffff` text = 4.8:1 (passes AA, barely). If text is at 12px bold (`.sm` buttons), minimum is 4.5:1 — marginal
- Darken the light-mode gradient endpoint to `#7e22ce` or use a solid color for `.sm` buttons in light mode to ensure clear contrast headroom
