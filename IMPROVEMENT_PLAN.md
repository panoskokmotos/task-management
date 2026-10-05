# Improvement Plan — Arete (Task OS)
> Generated: 2026-10-05. 17 items across 4 tiers.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Broken push-notification icon path
- **What**: `sw.js` and `index.html` reference `./icons/icon-192.png` (inside an `icons/` subdirectory that does not exist); the actual file is `./icon-192.png`.
- **Where**: `sw.js:46-47`, `index.html:11289`
- **Why it matters**: Every push notification (task reminders, deep-work pings) shows a broken image on iOS and Android. Users see a blank badge — looks buggy and erodes trust in the PWA install.
- **Effort**: S
- **Suggested fix**:
  - In `sw.js:46-47` change `./icons/icon-192.png` → `./icon-192.png`
  - In `index.html:11289` apply the same fix
  - Run `ls` to confirm no `icons/` directory, then update once

### 2. `profileName` defaults to hardcoded "Panos" for new users
- **What**: The default profile name fallback is hard-coded to `'Panos'`; new users who skip the name step (or whose `localStorage` is empty) see **"Good morning, Panos 👋"** on their dashboard.
- **Where**: `index.html:2519` (`let profileName=localStorage.getItem('taskos_name')||'Panos'`)
- **Why it matters**: First impression is broken for any user who isn't Panos. Combined with a guest-first acquisition strategy this hits the very first moment of engagement.
- **Effort**: S
- **Suggested fix**:
  - Change fallback to `'there'` so greeting reads "Good morning, there 👋" until the user sets a name
  - Alternatively derive from Supabase email on login (this is already attempted in `_welcomeSeed` at line 10459, but it doesn't cover the offline/guest path)

### 3. Last-write-wins sync silently discards changes on concurrent edit
- **What**: `sbSyncNow` decides who wins entirely on the latest `_updatedAt` timestamp. If the same account edits tasks on two devices within the same sync window, the lower-timestamp device's changes are silently overwritten with no warning.
- **Where**: `index.html:10417-10423`
- **Why it matters**: Users who use the app on phone + laptop will lose work without knowing. "Sync error" is a churn trigger in productivity tools.
- **Effort**: M
- **Suggested fix**:
  - When `remote.ms > localMs` AND local has unsaved pending writes (`_sbPending`), show a merge dialog instead of silently overwriting
  - At minimum, toast "Updated from another device — N local changes merged" and do a task-level merge (union of both sides' task arrays, prefer whichever side has the more recent `completedAt` per task)
  - Store a `_localUpdatedAt` separate from `_updatedAt` to detect true divergence

### 4. AI proxy URL is empty — all AI features require a personal API key
- **What**: `APP_CONFIG.aiProxy` is `''` in the shipped `index.html`. Every AI feature silently fails for users who haven't wired up their own Anthropic key in Settings.
- **Where**: `index.html:9959`
- **Why it matters**: Every AI CTA ("Plan my day", "Triage inbox", "AI daily picks") hits the guard at `callClaude()` line 5008 and shows "Add Claude API key in Settings first" — a dead end for 100% of users on the hosted deployment if the proxy isn't set.
- **Effort**: S
- **Suggested fix**:
  - Deploy `api/claude.js` to Vercel (it's already written) and fill in `aiProxy` with the resulting URL
  - Add a one-time banner on first AI-feature tap that walks users to the Settings key field if `aiProxy` is still empty rather than a bare toast

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. No per-user rate limiting on the AI proxy
- **What**: `api/claude.js` explicitly warns "for production add per-user rate limiting" but it is unimplemented. Any authenticated user can loop AI calls and run up the Anthropic bill without bounds.
- **Where**: `api/claude.js:12-13`
- **Why it matters**: A single curious user (or any exploit script) can exhaust the monthly Anthropic budget. This is the #1 financial risk to leaving the proxy live.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (they have a free tier; ~10 lines of code in the handler)
  - Gate on `SUPABASE_URL` (already wired) and limit to e.g. 20 calls per user per day
  - Return `429` with "Daily AI limit reached" so the client toast is meaningful

### 6. `t.title` injected into `innerHTML` without escaping in Weekly Review wizard
- **What**: Two places in the Weekly Review wizard (`goStep(1)` and `goStep(2)`) build HTML strings with `${t.title}` without wrapping in `esc()`.
- **Where**: `index.html:3594`, `index.html:3601`
- **Why it matters**: A task title containing `<img src=x onerror=alert(1)>` would execute. All task data is user-supplied; the `esc()` helper exists and is used correctly elsewhere. This is an inconsistency that creates a stored XSS vector (low severity in single-user context, higher if the sync feature ever supports sharing).
- **Effort**: S
- **Suggested fix**:
  - Wrap every `${t.title}` and `${t.notes}` in template literals that go into `innerHTML` with `${esc(t.title)}`
  - Also fix `index.html:2543` (option element text from `t.title` without escaping)
  - A global search for `` `${t.title}` `` → `` `${esc(t.title)}` `` inside strings assigned to `.innerHTML` covers most cases

### 7. No loading or error state in the Sync pill on auth failure
- **What**: When `_sbToken()` throws (expired session, network error), the sync pill shows "Sync error — retry" but clicking it just re-triggers `sbSyncNow` with no guidance. There is no "Sign in again" CTA.
- **Where**: `index.html:9985`, `10439`
- **Why it matters**: Expired sessions are the most common sync failure. A user stuck in "Sync error — retry" loop has no escape route and may think they've lost data.
- **Effort**: S
- **Suggested fix**:
  - Detect `401` / `403` errors in `sbSyncNow` catch block and show a targeted toast: "Session expired — sign in again" with an inline button
  - Or automatically trigger `authLogout()` → redirect to login after 3 consecutive 401s

### 8. First-run brain-dump uses AI but fails silently if no key is configured
- **What**: The first-run `_frOrganize()` calls `callClaude()` to parse and bucket the user's brain dump. If AI isn't configured, the user is told to "Add Claude API key" in Settings — during their very first experience of the app.
- **Where**: `index.html:10527-10563` (first-run organize flow)
- **Why it matters**: The magic moment is "organize my chaos in one click" — if that fails, first-run completion drops and the user churns before ever seeing the product's value.
- **Effort**: S
- **Suggested fix**:
  - Make first-run triage work with a simple rule-based fallback (NLP date parsing already exists via `_parseNLDate`; keyword-match for buckets)
  - Only use AI if `APP_CONFIG.aiProxy` is set; otherwise always succeed with the rule-based path

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. Single 14,926-line HTML file (~1 MB) with no build system
- **What**: The entire application is one monolithic `index.html` with inline CSS, inline JS, and 711 JavaScript functions. No modules, no bundler, no tree-shaking.
- **Where**: `index.html` (entire file)
- **Why it matters**: Parse + compile time on a mid-range phone is meaningful. No code splitting means no lazy-loading slow paths. Harder to test, harder to review.
- **Effort**: L
- **Suggested fix**:
  - Adopt a minimal Vite setup: extract CSS to `style.css`, split AI helpers and sync logic into separate JS modules
  - Use dynamic `import()` for heavy features (AI lab, relationships, deep-work) loaded on demand
  - Keep the app single-page; the refactor can be incremental

### 10. Silent `catch(e){}` swallows unknown errors throughout
- **What**: There are 60+ `catch(e){}` blocks (or `catch(e){return}`) that swallow every thrown error with no logging, reporting, or user feedback.
- **Where**: `index.html` — pervasive; representative examples: lines 956, 2587, 2983, 3031, 10392
- **Why it matters**: Production errors are invisible. When something breaks (e.g. `_parseNLDate` throws on a malformed date, or `renderGoals` crashes), the user sees nothing and the bug goes unreported.
- **Effort**: M
- **Suggested fix**:
  - Wire up PostHog (the key field exists but is blank) or a lightweight error boundary: `window.onerror = (msg, src, line) => track('js_error', {msg, src, line})`
  - Replace `catch(e){}` in critical paths (save, sync, AI calls) with at least `console.warn` + `track('error', {fn:'...', msg:e.message})`

### 11. Seeded starter tasks and goals contain hardcoded personal/Givelink data
- **What**: `_mkStarterTasks` (line ~4600–4970) seeds a new account with dozens of hardcoded Givelink-specific tasks, personal goals referencing Panos/SF/etc., and challenges mentioning `Givelink` by name.
- **Where**: `index.html:4616,4653,4814,4932,4945,4970,4976`, prompt at `7477`
- **Why it matters**: When a new user signs up, their dashboard is pre-populated with Panos's personal goals ("6+ Months in SF", "Financial Independency w/ Givelink"). This is confusing at best, off-putting at worst.
- **Effort**: S
- **Suggested fix**:
  - Replace personal seed data with generic, relatable examples ("Launch a side project", "Read 12 books this year")
  - Keep a private `_devSeed()` function behind a `#dev` URL flag for personal use

### 12. `sbSyncNow` has no exponential backoff on failure
- **What**: When `sbSyncNow` fails (network error, Supabase timeout), it sets `_sbPending=true` and the next sync is only triggered on the next `save()` call or `window.online` event. There is no automatic retry schedule.
- **Where**: `index.html:10412-10441`, `_sbScheduleSync` at line ~10607
- **Why it matters**: If the Supabase project is briefly paused (the keepalive workflow prevents this, but it can still happen on cold starts), data changes sit in `_sbPending` state indefinitely.
- **Effort**: S
- **Suggested fix**:
  - On sync failure, schedule a retry with `setTimeout` at 5s, 15s, 60s
  - Cap retries at 3 before surfacing the "Sync error" state to the user

### 13. `givelink.html` is a separate 1,829-line file diverging from the main app
- **What**: `givelink.html` duplicates several components (nav, styling, data model) from `index.html` without a shared import. Any CSS or data-model change must be applied twice.
- **Where**: `givelink.html` (full file)
- **Why it matters**: Causes drift. The rebrand in commit `72d9c68` had to specifically call out "purge stray old-brand colors" — exactly the problem that diverged files cause.
- **Effort**: M
- **Suggested fix**:
  - Extract shared components (nav, auth gate, `_SB` sync layer) into a shared JS/CSS include
  - Or merge the Givelink sprint board into `index.html` as a view (it already has a `givelink-dash` nav entry at line 2984)

---

## 💡 P3 — Nice to have

### 14. Landing page `og:url` and canonical use a Vercel preview URL
- **What**: `landing.html:11,17` hard-codes `https://task-management-beige-eight.vercel.app/` as the canonical and OG URL — a Vercel-generated domain, not a custom one.
- **Where**: `landing.html:11,17`
- **Why it matters**: SEO authority doesn't consolidate on a permanent domain. The URL in OG tags looks unpolished when shared.
- **Effort**: S
- **Suggested fix**:
  - Register a custom domain (e.g. `arete.app` or `usearete.com`), set it in Vercel, and update canonical + OG URLs to the custom domain

### 15. `JSON-LD` structured data on the landing page exposes personal name
- **What**: `landing.html:25` has `"author":{"@type":"Person","name":"Panos"}` in the structured data that Google indexes.
- **Where**: `landing.html:25`
- **Why it matters**: Minor: if the product ever grows beyond a personal project, the author attribution bakes in a personal name in search results.
- **Effort**: S
- **Suggested fix**:
  - Change to `"author":{"@type":"Organization","name":"Arete"}` or remove the author field

### 16. No error tracking in production (PostHog key is empty)
- **What**: `APP_CONFIG.posthogKey` is `''`, so there is zero product analytics or error telemetry in production.
- **Where**: `index.html:9960`
- **Why it matters**: No way to know which features are used, which flows break, or how many users drop off at first-run. Flying blind.
- **Effort**: S
- **Suggested fix**:
  - Create a free PostHog project and fill in the key + host
  - The `track()` wrapper is already wired up throughout the code — it just needs a live key to start emitting events

### 17. Service worker cache key is date-stamped, causing manual invalidation requirement
- **What**: `sw.js:1` uses `const CACHE = 'arete-20260723'` — a hardcoded date string. To bust the cache, developers must remember to update this string manually with every deploy.
- **Where**: `sw.js:1`
- **Why it matters**: Easy to forget, causing users to run stale HTML for days after a deploy.
- **Effort**: S
- **Suggested fix**:
  - Inject the cache key from the build step using a timestamp or commit hash (e.g. via Vercel's `VERCEL_GIT_COMMIT_SHA` environment variable)
  - Or adopt a Workbox-based precache manifest that handles versioning automatically
