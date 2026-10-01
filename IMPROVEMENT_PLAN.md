# Givelink / Arete — Improvement Plan
_Generated: 2026-10-01_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Stored XSS via unescaped task/goal titles in Weekly Review
- **What**: Task and goal titles rendered directly into `innerHTML` in the Weekly Review wizard without calling `esc()`.
- **Where**: `index.html:3594` (completed tasks), `index.html:3601` (backlog step), `index.html:3603` (goal step) — all inside `renderWizPanel()`.
- **Why it matters**: Any task with a title like `<img src=x onerror=alert(1)>` executes as script. Since titles come from user input and are persisted in localStorage / Supabase, this is self-XSS today but becomes stored XSS once multi-user sharing lands.
- **Effort**: S
- **Suggested fix**:
  - Replace `${t.title}` and `${g.title}` with `${esc(t.title)}` and `${esc(g.title)}` at all three call sites.
  - Also fix line `2543` where `t.title.slice(0,45)` is injected into an `<option>` without escaping (option content is technically safe from script injection, but `<` and `>` still break rendering).

---

### 2. `authMagic()` has no loading state — double-send risk
- **What**: The "Email me a magic link instead" button has no disabled/loading state during the async Supabase OTP call.
- **Where**: `index.html:10097–10108` (`authMagic`) and `index.html:882` (the button).
- **Why it matters**: On slow connections users click again, sending duplicate magic-link emails and confusing them ("why did I get two?"). The login button next to it is correctly disabled during auth; the magic link button is not.
- **Effort**: S
- **Suggested fix**:
  - Add `const btn = document.querySelector('.ag-textlink'); btn.disabled = true; const lbl = btn.textContent; btn.textContent = '…';` at the top of `authMagic()`.
  - Restore in both the success and catch branches.

---

### 3. AI features broken for all users — `aiProxy` is empty
- **What**: `APP_CONFIG.aiProxy` is an empty string (`''`), so every AI feature (triage, day plan, AI commands, morning briefing) falls back to prompting users for their own Anthropic API key. Most users will not have one.
- **Where**: `index.html:9959` (`aiProxy: ''`) and `index.html:5007–5033` (`callClaude`).
- **Why it matters**: AI features are a core differentiator on the landing page ("AI clears your inbox, plans your day"). They silently fail for every new user who hasn't added a key in Settings.
- **Effort**: S
- **Suggested fix**:
  - Deploy the already-written `/api/claude` Vercel proxy and set `aiProxy: '/api/claude'` in `APP_CONFIG`.
  - The proxy validates Supabase sessions so there's no open abuse vector; add Upstash rate-limiting as the in-code TODO notes.

---

### 4. Share card watermark shows the old Vercel slug, not the brand domain
- **What**: The progress share card footer text is hardcoded to `'Made with Arete · task-management-beige-eight.vercel.app'`.
- **Where**: `index.html:10232` (`_drawStatsCard`) and `index.html:10180` (`_APP_URL = 'https://task-management-beige-eight.vercel.app/'`).
- **Why it matters**: Every shareable image users post publicly shows the internal Vercel slug instead of the brand name. Kills word-of-mouth credibility and SEO signal when the brand is "Arete".
- **Effort**: S
- **Suggested fix**:
  - Set `_APP_URL` to the real production domain once it's live.
  - Change the watermark to `'Made with Arete · usearete.com'` (or whatever the domain is).
  - Same URL appears 11 more times across `index.html`, `landing.html`, and `sitemap.xml` — do a single search-and-replace.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. PostHog analytics key not configured — all product analytics dead
- **What**: `APP_CONFIG.posthogKey` is `''`, so `initPosthog()` short-circuits immediately. No events are captured.
- **Where**: `index.html:9960` and `index.html:10390–10394`.
- **Why it matters**: Every tracked event (`task_created`, `auth_login`, `guest_nudge_shown`, `onboarding_completed`, etc.) is silently dropped. You are flying blind on conversion, activation, and retention.
- **Effort**: S
- **Suggested fix**:
  - Paste the real PostHog project key into `posthogKey`.
  - Verify events arrive in the PostHog Live Events panel after a test login.

---

### 6. `givelink.html` asks for API key via `window.prompt()` — broken on mobile/Safari PWA
- **What**: When the Givelink CRM needs an Anthropic key, it calls `prompt('Enter your Anthropic API key:')`, which is blocked in iOS PWA mode and jarring everywhere.
- **Where**: `givelink.html:1155` and `givelink.html:1326–1330`.
- **Why it matters**: The app-level Arete prompt modal already exists (`index.html:2817`). Using `window.prompt()` is inconsistent, fails silently in some browser security contexts, and stores the key in plain `localStorage` under a key the main app doesn't share.
- **Effort**: S
- **Suggested fix**:
  - Replace both `prompt(…)` calls with a small inline input dialog matching the existing modal pattern.
  - Share the key with the main app via `localStorage.getItem('taskos_claude_key')` or use the existing `APP_CONFIG.aiProxy` endpoint.

---

### 7. `renderDash()` is 161 lines and re-renders the whole dashboard on every save
- **What**: `renderDash` (lines `2988–3149`) rebuilds every widget — daily picks, quests, habits, AI briefing — from scratch on any `refresh()` call triggered by a task completion or save.
- **Where**: `index.html:2988`.
- **Why it matters**: On a typical user with 50–200 tasks the full re-render is perceptible (100–200ms jank) and causes the briefing area to flicker every time a habit is ticked. Slows down the most-used screen.
- **Effort**: M
- **Suggested fix**:
  - Extract the expensive subsections (daily-picks, AI briefing) into lazy-loaded functions called with `setTimeout(..., 0)` so the main task list renders immediately.
  - Skip re-rendering the briefing if `S.questsDate` hasn't changed.

---

### 8. `seed()` contains 391 lines of hardcoded personal tasks exposed to all new users
- **What**: `seed()` at `index.html:4532` inserts ~60 personal tasks specific to the developer (Givelink outreach, "panagiotis email", personal CRM work, etc.) for every new non-hosted user.
- **Where**: `index.html:4532–4923`.
- **Why it matters**: New users who open the self-hosted version see a task list filled with someone else's startup tasks instead of their own. Deeply confusing first-run experience.
- **Effort**: M
- **Suggested fix**:
  - Replace with 5–10 generic onboarding example tasks that showcase the product (as the existing `onboarding-modal` does).
  - Move personal tasks to a private config file excluded from the repo, or remove them entirely.

---

### 9. `index.html` is missing a `<link rel="canonical">` tag
- **What**: `landing.html` has a canonical pointing at `task-management-beige-eight.vercel.app`, but `index.html` (the app itself) has no canonical at all.
- **Where**: `index.html:1–35` (head section). `landing.html:11` has it.
- **Why it matters**: Search engines may index both the Vercel preview URL and the production domain as separate pages, splitting PageRank. Not critical today but blocks SEO at scale.
- **Effort**: S
- **Suggested fix**:
  - Add `<link rel="canonical" href="https://[real-domain]/index.html">` in the `<head>` of `index.html`.
  - Update both files together when switching to a custom domain.

---

### 10. No rate limiting on `/api/claude` proxy — single account can drain budget
- **What**: The Vercel Claude proxy (`api/claude.js`) validates Supabase sessions but has no per-user rate limit. The in-code comment explicitly flags this.
- **Where**: `api/claude.js:12–13`.
- **Why it matters**: A misbehaving client or a single heavy user can run up unbounded Anthropic bills. The existing max_tokens cap (2000) only limits per-call cost, not call frequency.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate-limiting (free tier handles low traffic): 10 requests/user/minute.
  - Return `429 Too Many Requests` with a `Retry-After` header; the client's `callClaude()` already shows toast errors on non-2xx responses.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `esc()` doesn't escape single quotes — onclick injection in Readwise book titles
- **What**: `esc()` at `index.html:11776` escapes `&`, `<`, `>`, `"` but not `'`. The Readwise book list builds `onclick="loadReadwiseHighlights(...,'${esc(b.title)}',...)"` — a book title with a `'` character breaks out of the string.
- **Where**: `index.html:10848` and `index.html:10886`.
- **Why it matters**: A Readwise book titled `It's Complicated` silently breaks the click handler. A crafted title could inject arbitrary JS into the onclick attribute. Low exploitability (user's own Readwise data) but a latent bug for any real apostrophe in a title.
- **Effort**: S
- **Suggested fix**:
  - Add `.replace(/'/g, '&#39;')` to the `esc()` function.
  - Or refactor Readwise book cards to set `data-id` attributes and use a delegated event listener instead of inline onclick.

---

### 12. `calcLifeScore()` is 55 lines of pure score math with no unit tests
- **What**: `calcLifeScore` at `index.html:2681` is a multi-domain scoring function (health, finance, habits, goals) that affects the main dashboard KPI. No tests exist.
- **Where**: `index.html:2681–2736`.
- **Why it matters**: A typo in the scoring weights silently shows wrong scores and users lose trust. This is the kind of calculation that breaks quietly (returns `NaN`, shows `0%`) when new data fields are added.
- **Effort**: M
- **Suggested fix**:
  - Extract `calcLifeScore` to a standalone pure function file.
  - Add a minimal test harness (even a `console.assert` block or a simple HTML test page) covering the happy path and empty-state (no logs, no goals).

---

### 13. Duplicate localStorage keys for collapsed sidebar state
- **What**: Two functions (`_nsCollapsed` reader and `_toggleNsGroup`) both manually parse `'taskos_nav_collapsed'` with their own `try/catch` wrapping at `index.html:8066` and `index.html:8071` and `index.html:2949`.
- **Where**: `index.html:2949`, `index.html:8066`, `index.html:8071`.
- **Why it matters**: Three independent read/write sites for the same key means a format change needs triple updates. Already slightly out of sync (one uses `JSON.parse` default `'{}'`, another `'[]'`).
- **Effort**: S
- **Suggested fix**:
  - Extract into `_getNavCollapsed()` / `_setNavCollapsed(key, val)` helper functions called by all three sites.

---

### 14. `renderWizPanel()` is 69 lines — impossible to scan, test, or extend
- **What**: Each Weekly Review step is an `if/else if` branch inside one function, all building large HTML strings.
- **Where**: `index.html:3583–3652`.
- **Why it matters**: Adding a 7th step, or changing the backlog step's UI, means editing a 69-line wall of template strings. Each step is already 8–15 lines.
- **Effort**: M
- **Suggested fix**:
  - Split into `_wizStep0()`, `_wizStep1()`, … helper functions, each returning an HTML string, called by a dispatch table: `const _WIZ_PANELS = [_wizStep0, _wizStep1, ...]`.

---

## 💡 P3 — Nice to have

### 15. `givelink.html` and `index.html` load the same `esc()` / `uid()` utilities independently
- **What**: Both files define `esc()`, `uid()`, and basic toast/modal utilities in isolation.
- **Where**: `givelink.html` bottom `<script>` block; `index.html:11776`, `index.html:2822`.
- **Why it matters**: A bug fix in one `esc()` won't propagate to the other. Minor maintenance burden now, real divergence risk as Givelink grows.
- **Effort**: M
- **Suggested fix**: Extract to a shared `utils.js` loaded by both pages.

---

### 16. `seed()` and `seedGoals()` together are 467 lines, seeded on every cold start (non-hosted)
- **What**: `seed()` at `index.html:4532` (391 lines) and `seedGoals()` at `index.html:4926` (76 lines) run synchronously during boot.
- **Where**: `index.html:10660`.
- **Why it matters**: On a 2019 Android mid-range phone, synchronously building 60-task objects adds ~40ms to boot. Minor now; grows with seed data.
- **Effort**: S
- **Suggested fix**: Wrap in `requestIdleCallback` or `setTimeout(..., 200)`.

---

### 17. `_drawStatsCard()` hardcodes `'TaskOS'` brand name in the canvas font render
- **What**: Line `index.html:10215` draws `'Task'` + `'OS'` as two separate text runs using the old brand name.
- **Where**: `index.html:10215`.
- **Why it matters**: Brand was renamed to Arete. Every shared progress card still says "TaskOS".
- **Effort**: S
- **Suggested fix**: Change to `'Arete'` in a single fillText call.

---

### 18. Landing page comparison table minimum width (640px) breaks on iPhone SE / 375px screens
- **What**: `.ctable` has `min-width:640px` with an `overflow-x:auto` wrapper but the wrapper itself has no `-webkit-overflow-scrolling: touch`.
- **Where**: `landing.html:278`.
- **Why it matters**: On iPhone SE (375px) the table scrolls correctly in Safari but the scroll momentum stops abruptly without touch momentum. Feels broken.
- **Effort**: S
- **Suggested fix**: Add `-webkit-overflow-scrolling: touch` to `.ctable-wrap`, or replace the table with a responsive card layout for mobile.

---

### 19. `renderRelationships()` is 65 lines — renders an empty-state message but no CTA when people list is empty
- **What**: The Relationships view shows `'No contacts yet'` as plain text with no button to add the first person.
- **Where**: `index.html:5541–5606`, empty-state branch around line `5590`.
- **Why it matters**: Empty states without CTAs are activation dead ends. Users who land here have no obvious next action.
- **Effort**: S
- **Suggested fix**: Add `<button class="btn bp" onclick="openAddPerson()">+ Add first contact</button>` to the empty state.

---

### 20. No `<meta name="theme-color">` in `index.html` for Chrome Android PWA chrome colour
- **What**: `landing.html` has `<meta name="theme-color" content="#f7f6f3">`. `index.html` (the app itself) does not.
- **Where**: `index.html` `<head>` section.
- **Why it matters**: Chrome on Android shows the default grey/white browser chrome when the app is in the browser tab, breaking the immersive app feel even though it's a PWA.
- **Effort**: S
- **Suggested fix**: Add `<meta name="theme-color" content="#0a0a0f" media="(prefers-color-scheme: dark)">` and a light variant.
