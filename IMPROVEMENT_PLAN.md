# Givelink — Improvement Plan

Codebase: two monolithic HTML files (`index.html` 4 583 lines, `givelink.html` 2 241 lines), vanilla JS, localStorage persistence, Anthropic Claude API called directly from the browser.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `toast()` is called ~30 times in `index.html` but never defined

- **What**: Every notification, error message, and success confirmation in `index.html` silently fails because the function doesn't exist.
- **Where**: `index.html` lines 1317, 2286, 2295, 2350, 2353, 2396, 2399, 2411, 2451, 2460, 2522, 2527, 2535, 2538, 2590, 2669, 2703, 2706, 3162, 3371, 4150, 4320, 4426, 4443, 4534, 4562 (and more).
- **Why it matters**: Users get no feedback when they save a task, hit a missing API key, or complete a weekly review. The app silently does nothing while throwing `ReferenceError: toast is not defined` in the console — this kills trust immediately.
- **Effort**: S
- **Suggested fix**:
  - Copy the working implementation from `givelink.html` line 608: `function toast(msg,ms=2200){const t=document.getElementById('toast');t.innerHTML=msg; t.classList.add('show');setTimeout(()=>t.classList.remove('show'),ms);}`.
  - Ensure the `#toast` element exists in `index.html`'s HTML (search for the element; add if missing).
  - Smoke-test the 5 most common call sites: API key missing, task saved, goal added, weekly review complete, capture submitted.

---

### 2. XSS — user content injected raw into `innerHTML` in `index.html`

- **What**: Task titles, goal titles, and values are interpolated directly into innerHTML template strings without HTML escaping; `givelink.html` correctly uses `esc()` everywhere but `index.html` has no such function.
- **Where**: `index.html` lines 1295, 1399, 1453, 1456, 1460, 1462, 1524, 1531, 1709, 1727, 2288, 2315, 2323, 2326, 3458, 3531, 3557, 3729, 4276, 4288. Example: `` `<div class="tt">${t.title}</div>` `` at line 1524.
- **Why it matters**: A task title containing `<script>alert(1)</script>` or `<img src=x onerror=...>` executes arbitrary JS in the user's browser — stealing their stored Claude API key from localStorage is trivial.
- **Effort**: S
- **Suggested fix**:
  - Port the `esc()` helper from `givelink.html` line 607 into `index.html`: `function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}`.
  - Replace every `${t.title}`, `${g.title}`, `${v}`, `${desc}` inside innerHTML strings with `${esc(t.title)}` etc.
  - The CSP in `vercel.json` allows `unsafe-inline` for scripts, so CSP alone will not block this.

---

### 3. API response body parsed without checking `res.ok`

- **What**: Both `callClaude()` in `index.html` and `runAiSprintPlanner()` / `aiGoalBreakdown()` / `autoFillRetro()` in `givelink.html` call `await res.json()` unconditionally — a 429, 401, or 500 response returns HTML or an error object that crashes the caller.
- **Where**: `index.html` lines 2293–2295; `givelink.html` lines 1748–1752, 1852–1856, 2183–2187.
- **Why it matters**: Rate-limit or bad-key errors produce an unhandled exception that freezes whichever feature the user just tried (AI sprint planner, goal breakdown, retro autofill). There is no error message and the UI is left in a broken state.
- **Effort**: S
- **Suggested fix**:
  - After `const res = await fetch(...)`, add `if(!res.ok) throw new Error(await res.text())` before `.json()`.
  - Wrap callers with try/catch and surface the error via `toast()` (once fixed per item 1).
  - For 429s specifically, show "You've hit your Claude rate limit — try again in a moment."

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. No loading indicator or disabled state during AI calls

- **What**: When any AI feature runs (sprint planner, goal breakdown, retro fill, weekly digest), the button stays interactive and the UI shows nothing — users click again, firing duplicate requests.
- **Where**: `index.html` lines 2877, 3154, 3339, 3563, 4058, 4151; `givelink.html` lines 1698, 1816, 2154.
- **Why it matters**: Duplicate API calls drain the user's Claude credits and produce race-condition UI glitches. Perceived slowness without a spinner causes users to assume the feature is broken.
- **Effort**: M
- **Suggested fix**:
  - Before each `callClaude()` invocation, disable the triggering button and swap its label to "Thinking…".
  - Restore on both success and the catch block.
  - Add a CSS `.spinner` animation — one small keyframe block used everywhere.

---

### 5. Seed data contains personal details and Greek-language content

- **What**: The 390-line `seed()` function (lines 1811–2202) ships with hardcoded tasks referencing real names ("Sophia", "Alex"), Greek text ("Αγόρασε φρούτα"), personal financial goals (Etoro, SpaceX IPO, "245€"), and specific medical details.
- **Where**: `index.html` lines 1823–1824 (Greek tasks), 1826, 1843, 1852 (financial), 1835, 1867 (personal names).
- **Why it matters**: New users who click "Load sample data" see content that is meaningless or confusing. This erodes trust in the product and makes the onboarding feel unfinished.
- **Effort**: M
- **Suggested fix**:
  - Replace seed content with locale-neutral, universally relatable examples (e.g. "Read 20 pages of a book", "Prepare weekly budget review").
  - Extract seed data to a separate `seed-data.js` file or a JSON constant at the top of the script block so it can be maintained without scrolling through the function.
  - Add a visible "This is sample data — clear it when you're ready" banner when seed data is active.

---

### 6. No empty state for Inbox, Buckets, or Goal views

- **What**: When a new user has no tasks, the main content areas render blank white/dark space with no call to action.
- **Where**: `renderDash()` line 1227, `renderBuckets()` line 1312, `goalHTML()` line 1404.
- **Why it matters**: Blank screens on first launch are the #1 reason users abandon apps before they add a single item. Without a prompt, users don't know where to start.
- **Effort**: S
- **Suggested fix**:
  - Each render function should check `if (items.length === 0)` and return a friendly empty state: icon, one-line message, and a primary CTA ("+ Add your first task").
  - Reuse a single `emptyState(icon, msg, ctaLabel, ctaFn)` helper to keep it consistent.

---

### 7. Accessibility: interactive divs lack keyboard support and ARIA roles

- **What**: Clickable task cards, sidebar nav items, and modal close buttons are `<div>`/`<span>` elements with `onclick` handlers — they are invisible to screen readers and unreachable via Tab key.
- **Where**: Throughout `index.html` (only 1 `aria-label` at line 280); throughout `givelink.html`.
- **Why it matters**: Fails WCAG 2.1 AA. Users who rely on keyboard navigation (motor disabilities, power users) cannot use the app at all. Also an SEO signal.
- **Effort**: M
- **Suggested fix**:
  - Add `role="button" tabindex="0"` to all interactive divs, plus a keydown handler: `onkeydown="if(e.key==='Enter'||e.key===' ')this.click()"`.
  - Add `aria-label` to icon-only buttons (hamburger, close, AI buttons).
  - Add `alt=""` to decorative icons and meaningful alt text to any informational images.

---

### 8. `getApiKey()` silently returns `null` — no prompt to configure key

- **What**: `getApiKey()` (lines 1667–1687) checks multiple sources and returns `null` if none found; callers like the weekly digest, AI lab, and goal breakdown call it and receive nothing, but the only gating is a `toast()` call that itself is broken (see P0 item 1).
- **Where**: `index.html` lines 2286–2287 (`if(!S.claudeKey){toast(...);return null;}`), plus every other AI feature entry point.
- **Why it matters**: After fixing the toast bug, users still hit a dead end with no link to settings. First-time users never discover they need to add a key.
- **Effort**: S
- **Suggested fix**:
  - When `getApiKey()` returns null, in addition to the toast, auto-open the settings modal and scroll to the API key input.
  - Add a persistent banner in the dashboard when no key is configured: "AI features need a Claude API key — add it in Settings."

---

### 9. Brand color inconsistency — inline hex overrides CSS variables

- **What**: Status colours (`#22c55e`, `#fbbf24`, `#ef4444`, `#3b82f6`) and accent colours appear hardcoded in inline styles throughout both files, bypassing the CSS variable system defined in `:root`.
- **Where**: `index.html` lines 695 (status dots), 3458 (priority label), multiple `style="color:#…"` attributes; `givelink.html` similarly.
- **Why it matters**: The design system cannot be updated from one place. Any theme or brand change (e.g. adding a light mode) requires a grep-and-replace across thousands of inline styles — high risk of inconsistency.
- **Effort**: M
- **Suggested fix**:
  - Map each recurring hex to a new CSS variable (e.g. `--success: #22c55e`, `--warning: #fbbf24`, `--danger: #ef4444`).
  - Do a global find-and-replace of hex literals with `var(--...)` equivalents inside template strings.
  - Verify no pink-on-purple combinations exist in the pillar colour assignments.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. Utility functions duplicated between `index.html` and `givelink.html`

- **What**: `save()`, `load()`, `uid()`, `closeM()`, `toast()`, `esc()` are copy-pasted across both files with minor variations.
- **Where**: `index.html` lines 1197–1201, 1672; `givelink.html` lines 603–609, 1350.
- **Why it matters**: A bug fix or enhancement to `uid()` or `save()` must be applied twice. The two versions have already diverged (e.g. `esc()` exists only in givelink.html).
- **Effort**: M
- **Suggested fix**:
  - Extract into a `utils.js` file loaded by both pages via `<script src="utils.js">`.
  - Start with the six functions above; this already eliminates the P0 XSS bug gap.
  - Long-term, move toward ES modules with a simple bundler (Vite/esbuild) to enable tree-shaking.

---

### 11. Hardcoded Claude model name in two places

- **What**: `claude-haiku-4-5-20251001` is hardcoded as a string literal in `callClaude()` and `testClaudeKey()`.
- **Where**: `index.html` lines 2291 and 4214.
- **Why it matters**: When the model is deprecated (as older Haiku versions have been), every AI feature breaks simultaneously with no easy fix path. The model name also needs to be updated in `givelink.html`'s three AI functions.
- **Effort**: S
- **Suggested fix**:
  - Define `const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';` once at the top of each file's script block.
  - Reference it in all `fetch` bodies: `"model": CLAUDE_MODEL`.
  - Consider moving to `claude-haiku-4-5` (without date suffix) if Anthropic supports alias routing.

---

### 12. No localStorage schema validation — corrupt data crashes silently

- **What**: `load()` calls `JSON.parse(localStorage.getItem('taskos'))` with no try/catch and no schema version check. If the stored JSON is malformed or from an older schema version, the app silently initialises with `null`.
- **Where**: `index.html` line 1198; `givelink.html` line 604.
- **Why it matters**: A failed `JSON.parse` throws a SyntaxError that propagates to every render function, blanking the UI. Users lose access to their data with no recovery path offered.
- **Effort**: S
- **Suggested fix**:
  - Wrap `JSON.parse` in try/catch; on error, show a recovery modal ("Your data couldn't be loaded — restore from backup or reset").
  - Add a `schemaVersion` field to the stored object and write a migration function for each version bump.

---

### 13. `seed()` function is 390 lines — a maintenance hazard

- **What**: The function at lines 1811–2202 inlines 100+ task objects as object literals with no structure, making it impossible to review, localise, or A/B test onboarding content.
- **Where**: `index.html` lines 1811–2202.
- **Why it matters**: Every onboarding change requires navigating 400 lines of object literals. The personal data issues (P1 item 5) are a direct consequence of no review process for this function.
- **Effort**: M
- **Suggested fix**:
  - Extract the task/goal arrays to a `const SEED_DATA = {...}` at the top of the script, or a separate `seed-data.js`.
  - The `seed()` function itself should be ~10 lines: set `S = structuredClone(SEED_DATA)` then call `save()` and `render()`.

---

### 14. Content Security Policy weakened by `unsafe-inline`

- **What**: `vercel.json` sets `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'`, which allows any inline script execution — nullifying XSS protection even after fixing item 2.
- **Where**: `/home/user/task-management/vercel.json` (CSP header value).
- **Why it matters**: The XSS fix in P0 item 2 stops attacker-controlled HTML from running *today*, but `unsafe-inline` means that if any new interpolation gap is introduced, CSP provides no backstop.
- **Effort**: M
- **Suggested fix**:
  - Move all JS to external `.js` files (enabled by item 10's refactor), which allows removing `unsafe-inline` for scripts.
  - For styles, generate a `nonce` or use a hash-based CSP for any remaining inline styles.
  - Until JS is externalised, add `unsafe-hashes` + a SHA hash for known inline scripts as an interim hardening step.

---

## 💡 P3 — Nice to have

### 15. Zero test coverage on any critical path

- **What**: No test files exist anywhere in the repository — no unit tests for `uid()`, `save()`/`load()`, or any AI integration.
- **Where**: Entire repo.
- **Why it matters**: The P0 `toast()` bug and the XSS gap would have been caught by basic smoke tests. Without tests, every refactor is high-risk.
- **Effort**: L
- **Suggested fix**:
  - Add Vitest (zero-config, no bundler required for vanilla JS) with `jsdom` environment.
  - Start with pure utility functions: `uid()`, `esc()`, `save()`/`load()`, `getApiKey()`.
  - Add one integration test per AI feature that mocks `fetch` and asserts the UI updates correctly.

---

### 16. No rate-limiting or response caching for Claude API calls

- **What**: Every AI button click fires a live API request; repeated identical prompts (e.g. re-opening the weekly digest) hit the API again with no cache.
- **Where**: `index.html` lines 2877, 3154, 3339, 3563; `givelink.html` lines 1698, 1816, 2154.
- **Why it matters**: Users pay per token. Rapid re-clicks or accidental double-taps waste credits and can trigger Anthropic rate limits.
- **Effort**: M
- **Suggested fix**:
  - Cache the last AI response per feature keyed on a hash of the prompt input; return cached result if inputs haven't changed since last call.
  - Debounce the trigger buttons with a 2-second cooldown after any successful call.
  - Display the cached response with a "Regenerate" option rather than always re-fetching.

---

### 17. Magic numbers scattered throughout business logic

- **What**: Hardcoded values like `30` (days for someday audit, pre-mortem), `7` (days for weekly calc), `2200` (toast duration), `20` (title truncation) appear inline with no named constants.
- **Where**: `index.html` lines 1315, 2312, 2825–2827, 3321; `givelink.html` lines 608, 739.
- **Why it matters**: Changing the weekly review cycle from 7 to 14 days requires finding and auditing every `7` in the file — risky and time-consuming.
- **Effort**: S
- **Suggested fix**:
  - Define a `const CONFIG = { someDayAuditDays: 30, weekDays: 7, toastDurationMs: 2200, titlePreviewLen: 20 }` block.
  - Replace inline literals with `CONFIG.*` references.

---

### 18. No README or onboarding documentation for contributors

- **What**: The repository has no README, no architecture overview, no setup instructions, and no `.env.example` documenting the API key requirement.
- **Where**: Repository root — entirely absent.
- **Why it matters**: A new contributor (or the author returning after 3 months) has no entry point. The Claude API key requirement is invisible until runtime.
- **Effort**: S
- **Suggested fix**:
  - Add a `README.md` covering: what the app does, how to run it locally (open index.html), how to configure the Claude API key, and the two-file architecture.
  - Add `.env.example` (or a comment block at the top of each HTML file) documenting `CLAUDE_API_KEY`.

---

*Total: 18 items across 4 tiers. Last updated: 2026-04-21.*
