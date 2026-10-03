# Arete Improvement Plan
> Generated: 2026-10-03

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Developer's personal data seeded to all new users
- **What**: The `seed()` function ships real personal tasks — appointments in Greek, banking references, a personal name ("panagiotis") — to every new non-hosted user.
- **Where**: `index.html:4532–4653` — `seed()`, especially lines 4540–4653
- **Why it matters**: Any new local/self-hosted install opens the app with the developer's private tasks. Instant trust-kill; looks broken or like a privacy breach.
- **Effort**: S
- **Suggested fix**:
  - Replace all personal tasks in `seed()` with 5–8 generic illustrative tasks (e.g. "Review Q3 OKRs", "Plan the team offsite")
  - Or call `_seedStarter()` (already exists at line 10443) instead of `seed()` for non-hosted users — it's already generic
  - Remove line 4653: `mk('Unsubscribe from things I don\'t want (Superhuman for panagiotis email?)'…)`

### 2. AI proxy has no rate limiting — any user can exhaust the Anthropic budget
- **What**: `api/claude.js` has a hardcoded comment warning that rate limiting is missing; there is no per-user quota check.
- **Where**: `api/claude.js:12–13` (the comment), entire handler at lines 15–49
- **Why it matters**: A single malicious or runaway user can call the proxy in a loop and drive up Anthropic costs to hundreds of dollars in minutes. The auth check (lines 22–31) blocks unauthenticated calls but does nothing to limit authenticated volume.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limit (e.g. 20 req/user/hour): `npm i @upstash/ratelimit @upstash/redis` — Upstash free tier covers it
  - At minimum, add a sliding-window check using the Supabase user ID extracted in the auth check block (lines 22–31) before the Anthropic call
  - Document the env vars needed (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) in the setup comments

### 3. `profileName` defaults to `'Panos'` — all new users greeted by the wrong name
- **What**: `let profileName = localStorage.getItem('taskos_name') || 'Panos'` at line 2519. Every new user who hasn't set their name gets "Good morning, Panos" in the greeting and their AI prompts filled with "Panos — Greek founder in his 20s building Givelink in San Francisco" as the context fallback (lines 5647, 7849, 11672 and ~10 other sites).
- **Where**: `index.html:2519` (default), `index.html:5647, 7849, 9806, 11415, 11672` (AI prompt fallbacks)
- **Why it matters**: Every new user gets a wrong name, and AI features give them advice personalized for the developer's life. Immediate trust loss; makes the app feel like a leaked personal tool, not a product.
- **Effort**: S
- **Suggested fix**:
  - Change the fallback to `|| ''` and handle empty name in the greeting: `profileName ? `Good morning, ${profileName}` : 'Good morning'`
  - Replace the AI context fallback `'Panos — Greek founder...'` with a generic placeholder: `'a professional user'` or prompt users to fill in their About Me on first run

### 4. Claude API key synced to cloud database
- **What**: `S.claudeKey` is part of the main state object `S`, which `sbPush()` serialises and upserts to Supabase as `data: S`. Users' private Anthropic API keys are uploaded to the database on every sync.
- **Where**: `index.html:9917` (key stored into `S`), `index.html:10405–10410` (`sbPush` sends `S`), `index.html:10614` (auto-push on save)
- **Why it matters**: A Supabase misconfiguration or RLS gap would expose all users' API keys. It also means key rotation requires a cloud wipe.
- **Effort**: S
- **Suggested fix**:
  - Move `claudeKey` out of `S` and into a dedicated `localStorage` key (e.g. `taskos_claude_key`)
  - Read it with `localStorage.getItem('taskos_claude_key')` at call sites; save with `localStorage.setItem`
  - Exclude it from `sbPush` — cloud sync should carry task data, not credentials

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. `callClaudeGL()` in givelink.html silently fails on 401/429/500
- **What**: `givelink.html:1338` calls `const data = await res.json()` without checking `res.ok` first. On an invalid key (401), rate limit (429), or server error (500), `data.content?.[0]?.text` is `undefined` and the function returns `null` with no user-visible error.
- **Where**: `givelink.html:1325–1345` (`callClaudeGL`). Compare with `runAiSprintPlanner()` at line 1214 which correctly checks `if(!res.ok)`.
- **Why it matters**: Users clicking "AI Sprint Plan" or any AI feature in Givelink get a silently empty result with no explanation. Looks broken, not just unhelpful.
- **Effort**: S
- **Suggested fix**:
  - After `const data = await res.json()` add: `if(!res.ok) throw new Error(data.error?.message || 'API error '+res.status)`
  - Unify with the `callClaude()` function already in `index.html:5006` — share it via a `<script>` include or copy the pattern

### 5. `landing.html` front-door router has an empty catch — stuck users can't re-enter the app
- **What**: The session-check script at `landing.html:27–41` wraps the entire router in `try{}catch(e){}`. If any localStorage call throws (storage quota, private mode, Safari ITP), the catch silently swallows the error and the user sees the landing page forever even if they have a valid session.
- **Where**: `landing.html:27–41`
- **Why it matters**: iOS Safari in private mode and some incognito browsers throw on `localStorage.getItem`. Returning users get stuck on the marketing page instead of going to their app. Given mobile is likely majority traffic, this is a silent conversion sink.
- **Effort**: S
- **Suggested fix**:
  - Replace `catch(e){}` with `catch(e){ location.replace('/index.html'); }` — if we can't read storage, default to the app, not the landing page
  - Or wrap only the `localStorage.getItem` calls in a safe helper that returns `null` on error

### 7. Broken Supabase session triggers a silent dead state, not a re-login prompt
- **What**: When the Supabase refresh token expires (happens after ~1 week on free tier), `_sbToken()` throws `auth 400`. `sbSyncNow()` catches it and sets a status pill to `⚠ auth 400` but never re-prompts the user to log in. Sync silently stops working.
- **Where**: `index.html:10022–10026` (`_sbToken`), `index.html:10439` (catch in `sbSyncNow`)
- **Why it matters**: Users working across devices stop getting their data synced without knowing it. They may lose task updates or edit on stale data, only discovering the problem days later.
- **Effort**: S
- **Suggested fix**:
  - In the `catch` block of `sbSyncNow` (line 10439), check `if(e.message.startsWith('auth'))` and call `_showAuthGate()` — the login gate already exists
  - Add a toast: `'Session expired — please sign in again to restore sync'`
  - Set a flag `_sbSessionExpired = true` so the auto-sync interval backs off instead of hammering auth

### 8. Hardcoded deploy URL in every social share card and OG tag
- **What**: `task-management-beige-eight.vercel.app` is hardcoded as the canonical URL, OG image host, and app URL in meta tags and the share-card generator.
- **Where**: `index.html:24–32, 10180, 10232` | `landing.html:11, 16–17, 21, 25`
- **Why it matters**: Every shared link, social preview, and progress card shows the raw Vercel project slug instead of a branded domain. Kills credibility when shared with potential users.
- **Effort**: S
- **Suggested fix**:
  - Define a single `const APP_DOMAIN = 'https://task-management-beige-eight.vercel.app'` (or better, an env-injectable var) and reference it everywhere
  - Replace the 8 hardcoded occurrences with the constant (find with `grep -n 'task-management-beige-eight'`)
  - When a custom domain is set up on Vercel, this becomes a one-line change

### 9. AI features are non-functional out of the box — no setup guide
- **What**: `APP_CONFIG.aiProxy` is `''` and `APP_CONFIG.posthogKey` is `''`. All AI commands, auto-triage, and day planning calls hit a wall and show a generic toast pointing users to Settings.
- **Where**: `index.html:9956–9961` (`APP_CONFIG`), `index.html:4328, 5047, 5111`
- **Why it matters**: The landing page and app header heavily market AI features as a core differentiator, but new users hit them and get a dead end with no friction-free path forward. Conversion drops the moment they try AI for the first time.
- **Effort**: M
- **Suggested fix**:
  - In the first-run flow (`_startFirstRun` / brain dump screen), add a step: "Enable AI (optional) — paste your Claude API key" with a direct link to the Anthropic console
  - Or self-host the proxy (set `aiProxy`) and configure it for all users — see `api/claude.js` setup instructions
  - At minimum, make the toast action-link deep-link directly to the Settings AI section: `onclick="nav('settings');document.getElementById('set-claude-key')?.focus()"`

### 10. Givelink uses a blue palette (#3b82f6) that conflicts with Arete's purple — neither matches the stated brand
- **What**: `givelink.html:15–20` defines `--accent:#3b82f6` (Tailwind blue). `index.html` uses `--accent:#8272f2` (purple). The stated brand guide specifies purple (#6B3FA0, #5718CA) and pink (#C2185B, #E353B6). Neither app's palette matches.
- **Where**: `givelink.html:15–20` (CSS variables), `index.html:44–51`
- **Why it matters**: Givelink looks like an entirely different product from Arete. If the two tools are shown together or linked, they visually signal two different brands. The `--pr` variable in Givelink (`#f472b6`, pink) is used on the `--accent` purple background in some sprint board chips — violating the no-pink-on-purple rule.
- **Effort**: M
- **Suggested fix**:
  - Align `givelink.html`'s `--accent` to `#8272f2` (or the brand purple) to match the main app
  - Audit where `--pr` (pink) is rendered on `--accent` (purple) backgrounds in the sprint board and replace the background token

### 11. No error recovery after a failed sync push — data loss risk on poor connectivity
- **What**: `sbPush()` at line 10409 has no retry. `sbSyncNow()` sets `_sbPending = true` on failure but the auto-retry (line 10614) uses `sbPush().then().catch()` with no backoff. A flaky network can leave users with `_sbPending` stuck at true indefinitely.
- **Where**: `index.html:10405–10410` (`sbPush`), `index.html:10614` (auto-push in save), `index.html:10439` (error handler)
- **Why it matters**: If a push silently fails and the user closes the tab, their last changes are lost. For a productivity app, silent data loss is a P0-level user trust issue.
- **Effort**: M
- **Suggested fix**:
  - Add exponential backoff retry (3 attempts: 2s, 8s, 30s) in the `save()` triggered push path
  - Show a persistent (non-auto-dismiss) banner if 3 retries all fail: `"Changes couldn't be saved to cloud — check your connection"`
  - Track `_sbFailCount` and only show the re-login prompt after auth-type failures

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 12. `seed()` is 394 lines and mixes personal data with generic data
- **What**: The seed function spans lines 4532–4926 (394 lines), is the second-largest function in the codebase, and contains a mix of obviously personal tasks with generic demo tasks.
- **Where**: `index.html:4532–4926`
- **Why it matters**: Impossible to maintain or update. Fixing P0 item #1 requires understanding which tasks to keep. Any future product pivot requires editing a 400-line function.
- **Effort**: S (after P0 fix #1 is done)
- **Suggested fix**:
  - After stripping personal tasks (P0 #1), extract the seed data into a `const SEED_TASKS = [...]` array at the top of the script section
  - Reduce to ≤20 curated generic tasks across the key buckets

### 13. `renderDash()` is 163 lines — all layout, no structure
- **What**: The dashboard render function at line 2988 runs 163 lines of templated HTML construction inline with business logic.
- **Where**: `index.html:2988–3150`
- **Why it matters**: Adding or changing any dashboard widget requires scanning 163 lines; bugs are easy to introduce and hard to isolate.
- **Effort**: M
- **Suggested fix**:
  - Split into: `_renderDashStats()`, `_renderDashTop3()`, `_renderDashHabits()`, `_renderDashGoals()`
  - Each sub-function returns an HTML string; `renderDash()` assembles them

### 14. 88 ARIA labels for 997 interactive elements — major accessibility gap
- **What**: There are 997 `<button>`, `<input>`, `<select>`, `<textarea>` elements in `index.html` but only 88 `aria-label` attributes. Most icon-only buttons (FAB, sidebar collapse arrows, quick-action dots) have no accessible name.
- **Where**: `index.html` throughout — most severely in the sidebar (lines 64–260) and task card actions (lines 124–165)
- **Why it matters**: Screen reader users and keyboard-only users cannot operate core features. Also blocks App Store PWA reviewers who test accessibility.
- **Effort**: M
- **Suggested fix**:
  - Add `aria-label` to all icon-only `<button>` elements — at minimum the FAB (line 265), sidebar collapse (line 73), and task action icons
  - Use `title` as fallback where `aria-label` isn't set — most buttons already have `title` attributes
  - Run `axe-core` or Lighthouse accessibility audit to enumerate remaining gaps

### 15. Entire app is one 14,926-line HTML file — no module separation
- **What**: All HTML, ~2,000 lines of CSS, and ~12,000 lines of JS live in a single `index.html`. No ES modules, no imports, no bundler.
- **Where**: `index.html:1–14926`
- **Why it matters**: No tree-shaking, no code splitting, no lazy loading. The entire app must be parsed before first interaction. Bundle size grows linearly with every feature. Impossible to unit-test individual functions.
- **Effort**: L
- **Suggested fix**:
  - This is a multi-sprint effort — don't rewrite; migrate gradually
  - First: extract `APP_CONFIG` and `CATS`/`LIFE_AREAS` constants to a `config.js` module
  - Second: extract `api/supabase.js` (all `_sb*` functions) and `api/ai.js` (all `_ai*` functions)
  - Use `<script type="module">` imports; Vite with zero config supports the current vanilla JS style

### 16. `givelinkMetrics` lives in the Arete state object — stale Givelink coupling
- **What**: The default state `S` at line 2517 includes `givelinkMetrics`, `givelinkHistory`, and the `givelink` task category (line 2503). These are Givelink-specific business metrics stored in the general Arete user state.
- **Where**: `index.html:2503` (CATS), `index.html:2517` (S default), `index.html:4375` (time block color `#a78bfa`)
- **Why it matters**: Every Arete user's localStorage and cloud sync carries Givelink business metrics. After the rebrand separation (PR #73), these should live only in `givelink.html`. The hardcoded `#a78bfa` at line 4375 is also outside the declared brand token system.
- **Effort**: S
- **Suggested fix**:
  - Remove `givelinkMetrics` and `givelinkHistory` from the default `S` object; migrate to `givelink.html`'s own state
  - Replace `color:'#a78bfa'` at line 4375 with `color:'var(--accent)'`
  - Consider renaming the `givelink` task category to `work` or `startup` in the Arete app

---

## 💡 P3 — Nice to have

### 17. PostHog analytics configured but never initialised
- **What**: `APP_CONFIG.posthogKey` is `''` (line 9960), so `initPosthog()` returns immediately at line 10390. The `track()` function is called in ~40 places but all calls are no-ops.
- **Where**: `index.html:9956–9962, 10390–10393`
- **Why it matters**: Zero insight into how users actually use the app, which features convert, or where they drop off. The tracking instrumentation is already written — it just needs a key.
- **Effort**: S
- **Suggested fix**:
  - Create a free PostHog Cloud account, grab the project key, and set `posthogKey` in `APP_CONFIG`
  - Consider making it injectable via a Vercel environment variable to avoid hardcoding

### 18. The `givelink` task category icon uses a hardcoded purple (#a78bfa)
- **What**: In `_renderFocusBlock()` at line 4375, the Givelink time block color is set as `color:'#a78bfa'` — hardcoded outside the CSS token system.
- **Where**: `index.html:4375`
- **Why it matters**: Won't adapt to light/dark mode or future brand changes.
- **Effort**: S
- **Suggested fix**: Replace with `color:'var(--accent)'`

### 19. Landing page nav links have no mobile menu
- **What**: `landing.html` has a `.nav-links` row with "Features", "Compare", "FAQ" links (lines 67–70) that are hidden on mobile with no hamburger menu fallback.
- **Where**: `landing.html:67–79, 310–330` (nav section)
- **Why it matters**: Mobile users (the majority of traffic) can't access comparison or FAQ sections from the nav. The CTA is visible, but secondary content is unreachable via the nav.
- **Effort**: S
- **Suggested fix**:
  - Add a `<button id="nav-toggle">` hamburger for mobile
  - On click, reveal the `.nav-links` as a dropdown overlay
  - Or simplify: hide all nav links on mobile and rely on the hero CTA alone (the page is single-column and the sections are reachable by scroll)
