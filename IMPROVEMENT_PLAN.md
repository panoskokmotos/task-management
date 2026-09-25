# Improvement Plan — Arete / Givelink

Generated: 2026-09-25

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP in vercel.json blocks Google Fonts — all users see fallback typeface
- **What**: `font-src 'self'` in `vercel.json:15` blocks `fonts.gstatic.com`; `style-src` omits `fonts.googleapis.com`. Inter never loads; every user sees the system fallback (`-apple-system`).
- **Where**: `vercel.json:15`; `index.html:14–16` (Google Fonts `<link>` tags)
- **Why it matters**: The entire visual identity depends on Inter. Every user in production is seeing a font the designer never intended.
- **Effort**: S
- **Suggested fix**:
  - Add `https://fonts.googleapis.com https://fonts.gstatic.com` to `font-src`.
  - Add `https://fonts.googleapis.com` to `style-src`.
  - Verify with DevTools → Network → filter by `font`.

---

### 2. Static HTML greets every new user as "Panos" — first-impression failure
- **What**: `index.html:1070` has `<h1 id="greeting">Good morning, Panos 👋</h1>` baked in. `profileName` defaults to `localStorage.getItem('taskos_name')||'Panos'` at line 2519. Any fresh signup sees the developer's first name until JS overwrites it.
- **Where**: `index.html:1070`, `index.html:2519`
- **Why it matters**: Every new user's first screen shows the wrong name — an embarrassing first impression that erodes trust immediately after signup.
- **Effort**: S
- **Suggested fix**:
  - Change static HTML to `<h1 id="greeting">Good morning 👋</h1>`.
  - Change default in line 2519 to `localStorage.getItem('taskos_name')||''` and render greeting as "Good morning 👋" when name is unset.

---

### 3. Push notification icon path is wrong — all notifications show blank/broken icon
- **What**: `sw.js:46–47` uses `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'`, but the `icons/` directory does not exist — assets live at root (`icon-192.png`).
- **Where**: `sw.js:46–47`
- **Why it matters**: Every push notification silently shows a broken/missing icon on all browsers. This makes notifications look like spam or a malfunction.
- **Effort**: S
- **Suggested fix**:
  - Change both paths to `'./icon-192.png'`.

---

### 4. `taskReply()` ignores `aiProxy` — AI reply feature broken for all hosted users
- **What**: `index.html:9206` guards with `if(!S.claudeKey){return _taskReplyLocal(id,text);}`, checking only the personal API key. Every other AI feature checks `!S.claudeKey&&!APP_CONFIG.aiProxy`. When the proxy is wired up, task replies will silently fall back to 5 hardcoded keyword matches instead of calling Claude.
- **Where**: `index.html:9206`
- **Why it matters**: The "Reply to do it" feature is the most conversational AI touchpoint in the app. Breaking it for proxy users undermines the core AI UX.
- **Effort**: S
- **Suggested fix**:
  - Change guard to `if(!S.claudeKey&&!APP_CONFIG.aiProxy){return _taskReplyLocal(id,text);}`.

---

### 5. `syncToTaskOS()` uses obsolete localStorage keys — cross-app sync permanently broken
- **What**: `givelink.html:1276–1284` reads `taskos_profiles` and `taskos_data_<id>` — multi-profile keys removed when state was consolidated into the single `taskos` key. The function always toasts "No Task OS profile found" and returns.
- **Where**: `givelink.html:1276–1284`
- **Why it matters**: The Givelink ↔ Arete sync flow (a visible feature in the UI) has been silently broken for every user since the storage key migration.
- **Effort**: M
- **Suggested fix**:
  - Update `syncToTaskOS()` to read from `localStorage.getItem('taskos')` and parse the consolidated state object.
  - Remove references to `taskos_profiles` and `taskos_data_<id>`.

---

### 6. `_afterAuth` swallows sync failure silently — user data may not load after login
- **What**: `index.html:10131` — `try{await sbSyncNow(true);}catch(e){}`. If sync throws (expired token, network failure, RLS error), the user sees a "Welcome back" toast but their cloud data is not loaded. They may unknowingly overwrite cloud data with an empty local state.
- **Where**: `index.html:10131`
- **Why it matters**: Silent data loss after login is the worst possible failure mode. Users would lose tasks and goals with no warning.
- **Effort**: S
- **Suggested fix**:
  - Replace `catch(e){}` with `catch(e){ toast('⚠ Sync failed — tap here to retry'); console.error('sbSyncNow', e); }`.
  - Optionally surface a persistent retry button rather than just a toast.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 7. `aiProxy` is blank — all AI features broken for every hosted user
- **What**: `APP_CONFIG.aiProxy` is `''` at `index.html:9959`. All ~20 AI entry points gate on `!S.claudeKey&&!APP_CONFIG.aiProxy` and show "Add your Claude API key in Settings" to every signed-up user.
- **Where**: `index.html:9959`; gate checks at lines 4328, 5047, 5111, and ~15 other call sites
- **Why it matters**: AI is the core value proposition. Every hosted user hits a wall on every AI feature the first time they try it.
- **Effort**: S
- **Suggested fix**:
  - Deploy `api/claude.js` to Vercel with `ANTHROPIC_API_KEY` set.
  - Set `aiProxy: 'https://<your-vercel-app>.vercel.app/api/claude'` in `APP_CONFIG`.
  - Remove the personal-key Settings field from the hosted-mode UI.

---

### 8. Share card still says "Task OS" and links to the raw Vercel scaffolding URL
- **What**: `index.html:10214` renders the old product name "Task OS" in the canvas. `index.html:10232` bakes `'task-management-beige-eight.vercel.app'` into every shared progress card footer.
- **Where**: `index.html:10214`, `10232`
- **Why it matters**: Every shared progress card is a brand touchpoint. Displaying the old name and an unmemorable Vercel domain undercuts every sharing loop the product is trying to create.
- **Effort**: S
- **Suggested fix**:
  - Replace "Task OS" with "Arete" in the canvas `fillText` calls.
  - Replace the hardcoded URL with a constant `_APP_URL` that maps to the canonical domain (also fix `index.html:10180` which sets `_APP_URL` to the same old URL).

---

### 9. `givelink.html` palette is Tailwind blue + pink — violates brand and no-pink rule
- **What**: `givelink.html:17–19` sets `--accent:#3b82f6` (Tailwind blue-500), `--pr:#f472b6` (Tailwind pink-400) for the "product" pillar. Arete brand is purple (`#8272f2`/`#6a58ee`). The `#f472b6` pink on a purple background directly violates the no-pink-on-purple rule.
- **Where**: `givelink.html:17–19`; everywhere `var(--accent)` and `var(--pr)` are used
- **Why it matters**: Givelink and Arete share a domain and are linked from the sidebar — the visual discontinuity reads as a broken/unfinished product.
- **Effort**: M
- **Suggested fix**:
  - Set `--accent` to `#8272f2` (dark) or `#6a58ee` (light) to match the Arete brand.
  - Replace `--pr:#f472b6` with a purple variant; choose a pillar color from within the purple family or use distinct non-pink hues.

---

### 10. Personal seed tasks are exposed in self-hosted (non-hosted) mode
- **What**: `index.html:10660` — `if(!_hostedMode()){seed();seedGoals();}`. The `seed()` function at lines 4546–4711 contains ~100 of the developer's personal tasks ("Nonprofits Board Follow Ups", "Formalize n8n training plan", "Greek Nonprofits Board (Make-A-Wish etc)", etc.).
- **Where**: `index.html:4546–4711`, `10660`
- **Why it matters**: Anyone who forks or self-hosts the repo (without filling in Supabase credentials) gets the developer's personal backlog seeded into their app — a privacy and embarrassment concern.
- **Effort**: S
- **Suggested fix**:
  - Replace personal tasks in `seed()` with generic placeholder tasks ("Learn something new", "Plan a meal", etc.).
  - Or gate `seed()` behind a `DEV_SEED=true` environment flag.

---

### 11. `importData()` merges without allowlist — crafted backup can overwrite credentials
- **What**: `index.html:2638` — `Object.assign(S, d)` where `d` is parsed from a user-supplied JSON file. A crafted file can overwrite `S.claudeKey`, `S.supabaseAnon`, or any of the 60+ root state keys.
- **Where**: `index.html:2638`
- **Why it matters**: An attacker who tricks a user into importing a backup file can silently replace their stored API key or auth credentials with attacker-controlled values.
- **Effort**: S
- **Suggested fix**:
  - Replace `Object.assign(S, d)` with a destructured allowlist: only merge `tasks`, `goals`, `reviews`, `habits`, and other data arrays — never credentials or system keys.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 12. No rate limiting on `/api/claude` proxy — one user can drain the Anthropic bill
- **What**: `api/claude.js` has no per-user or per-IP rate limit. The code itself notes: *"For production add per-user rate limiting (e.g. Upstash)"*. As soon as `aiProxy` is wired (P1 item 7), this becomes an active billing risk.
- **Where**: `api/claude.js:12–13` (comment), entire proxy (lines 15–49)
- **Why it matters**: A single user running a loop, or a credential leak, could run up an uncapped Anthropic bill with no circuit breaker.
- **Effort**: M
- **Suggested fix**:
  - Add `@upstash/ratelimit` with `slidingWindow(50, '1 d')` per UID from the Supabase JWT.
  - As a cheap immediate guard: hard-cap `max_tokens` to 500 and require a valid JWT even without `SUPABASE_URL`.

---

### 13. `index.html` is a 14 926-line monolith — no modules, no tests, no linter
- **What**: All HTML, CSS, and JS for the entire application lives in one file with no build step, no TypeScript, no ESLint, and no test suite.
- **Where**: `index.html` (entire file)
- **Why it matters**: Every change carries full-file risk. Code review diffs span thousands of lines. Finding a function requires grep. Any future hire or contributor faces a days-long onboarding just to navigate the file.
- **Effort**: L
- **Suggested fix**:
  - As a minimal first step: extract the Supabase sync module (`~9938–10310`), the AI call layer (`~5006–5560`), and the router/nav layer into separate `<script src="...">` files.
  - Add ESLint with `no-unused-vars` and `no-undef` to catch regressions without a framework.

---

### 14. Single-blob localStorage write risks `QuotaExceededError` for active users
- **What**: All state (`tasks`, `goals`, `healthLogs`, `books`, `bodyLogs`, `biomarkers`, ~60 arrays) is serialized in one `localStorage.setItem('taskos', JSON.stringify(S))` call. The error handler at `index.html:2582` only warns after the write has already failed.
- **Where**: `index.html:2517–2582`
- **Why it matters**: Active users accumulate data. When the ~5 MB localStorage limit is hit, saves silently fail and data is lost. This is a time-bomb for power users.
- **Effort**: M
- **Suggested fix**:
  - Shard storage by feature area: `taskos_tasks`, `taskos_goals`, `taskos_health`, etc.
  - Add a `try/catch` around every `setItem` that specifically handles `QuotaExceededError` with a user-visible warning and an export prompt.

---

### 15. 87 `setTimeout` calls used as async sequencing — fragile on slow networks
- **What**: `index.html` has 87 `setTimeout` calls used to sequence post-auth flows, first-run modals, and render steps (e.g. `setTimeout(()=>{_startFirstRun();},650)` at line 10138). These are arbitrary delays that break on slow 4G or when an upstream operation takes longer than expected.
- **Where**: `index.html` (87 occurrences, most critically at lines 10131–10145)
- **Why it matters**: On a slow connection, the first-run experience (the most critical conversion moment) can silently skip due to a race condition with no retry.
- **Effort**: M
- **Suggested fix**:
  - Replace timeout-based sequencing in the auth/first-run flow with explicit `await` chains or event-driven callbacks that fire only when the upstream condition is confirmed.

---

## 💡 P3 — Nice to have

### 16. `posthogKey` is blank — product analytics are completely dark
- **What**: `APP_CONFIG.posthogKey: ''` at `index.html:9961`. All `track()` calls are no-ops; there is zero visibility into user behaviour, onboarding completion, AI feature adoption, or conversion funnels.
- **Where**: `index.html:9961`
- **Why it matters**: Every product decision is a blind guess without analytics. Setting this up costs 10 minutes and unlocks all existing instrumentation for free.
- **Effort**: S
- **Suggested fix**: Create a PostHog project, copy the project key into `APP_CONFIG.posthogKey`.

---

### 17. `dc-card` and `ai-strip` use GitHub-blue / Tailwind-cyan, not brand purple
- **What**: `index.html:534–535` — `.dc-card` uses `rgba(88,166,255,.1)` + `rgba(34,211,238,.06)` (GitHub blue + Tailwind cyan). `index.html:588` — `.ai-strip` uses `rgba(88,166,255,.07)` + `rgba(167,139,250,.05)`. These are prominent dashboard cards with off-brand accent colors.
- **Where**: `index.html:534–535`, `588`
- **Why it matters**: Minor but visible brand inconsistency on the most-viewed screen in the app.
- **Effort**: S
- **Suggested fix**: Replace with `var(--accent-soft)` or `rgba(130,114,242,.08)` (the existing purple accent-soft token for dark mode).

---

### 18. `landing.html` trust-grid and feat-grid overflow on 375px mobile
- **What**: `landing.html:290–299` collapses `.posbar-in`, `.compare`, `.tpl-grid` at `max-width:760px` but leaves `.trust-grid{grid-template-columns:repeat(4,1fr)}` and `.feat-grid{grid-template-columns:repeat(2,1fr)}` at full width. On iPhone SE (375px) these create horizontal scroll or squished cards.
- **Where**: `landing.html:290–299` (mobile breakpoint)
- **Why it matters**: The landing page is the acquisition surface. A broken layout on the most common small phone size directly hurts sign-up conversion.
- **Effort**: S
- **Suggested fix**: Add `trust-grid` and `feat-grid` to the `@media(max-width:760px)` block with `grid-template-columns:repeat(2,1fr)` and `1fr` respectively.

---

### 19. No `.env.example` — deployers miss required environment variables
- **What**: `api/claude.js` requires `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` but there is no `.env.example` file documenting them.
- **Where**: `api/claude.js:1–13`
- **Why it matters**: Contributors deploying their own instance will miss `SUPABASE_URL`, silently disabling auth gating on the proxy — anyone can call Claude on the deployer's bill.
- **Effort**: S
- **Suggested fix**: Add `.env.example` at repo root with all three variables, their descriptions, and a note that `SUPABASE_URL` is required to gate access (not optional).

---

### 20. `index.html:9242` silently discards failed AI JSON parse — user sees nothing
- **What**: `try{act=JSON.parse(...);}catch(e){}` — if the AI returns malformed JSON, `act` is `undefined` and the command silently does nothing.
- **Where**: `index.html:9242`
- **Why it matters**: User types a command, fires it, nothing happens, no explanation. They blame the product, not the AI response.
- **Effort**: S
- **Suggested fix**: `catch(e){ toast('Could not interpret that command — try again'); return; }`.
