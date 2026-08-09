# Arete — Improvement Plan
> Generated: 2026-08-09 | Codebase: panoskokmotos/task-management @ main

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Default greeting says "Good morning, Panos 👋" for every user

- **What**: `profileName` falls back to the hardcoded string `'Panos'`, so any user who hasn't set their name sees the wrong greeting on the first screen they ever see.
- **Where**: `index.html:2519` (`let profileName=localStorage.getItem('taskos_name')||'Panos'`), `index.html:1070` (static HTML fallback also says "Panos")
- **Why it matters**: This is the very first thing a new user reads. Seeing a stranger's name destroys trust and makes the product feel like a half-finished demo, not a real product.
- **Effort**: S
- **Suggested fix**:
  - Change the fallback to `''` and render "Good morning 👋" (no name) until the user sets one.
  - The first-run flow already prompts for a name — just gate the name-display on it being set.
  - Also update `index.html:1070` static HTML to not hardcode "Panos".

---

### 2. AI features are dead for all users — `aiProxy` is not wired up

- **What**: `APP_CONFIG.aiProxy` is an empty string. Every call to `callClaude()` from a user without a personal Claude key (i.e. everyone) hits the "Add Claude API key in Settings first" toast and returns `null`. AI triage, day planning, command palette AI, and weekly notes extraction all silently fail.
- **Where**: `index.html:9959` (`aiProxy: ''`), `index.html:5008` (the guard that shows the toast)
- **Why it matters**: AI is the main differentiation advertised on the landing page. New users trying the headline feature immediately hit a dead end — the #1 reason for bounce.
- **Effort**: S (config change + one Vercel deploy)
- **Suggested fix**:
  - Deploy `/api/claude.js` to Vercel with `ANTHROPIC_API_KEY` as an environment variable (already built and correct).
  - Paste the resulting URL into `aiProxy` in `index.html:9959`.
  - Add per-user rate limiting (see P2 item #9) before doing this, or cap `max_tokens` aggressively in the interim.

---

### 3. Push notification icon path is broken (404)

- **What**: The service worker references `./icons/icon-192.png` for push notification icons, but no `icons/` subdirectory exists. The actual file is at `./icon-192.png`. Every triggered reminder and push notification shows a broken image.
- **Where**: `sw.js:46-47`, `index.html:11289` (in-app `Notification` constructor)
- **Why it matters**: Any user who has enabled reminders sees a broken icon on every notification — visually signals an unfinished product on the most trusted surface (the OS notification tray).
- **Effort**: S
- **Suggested fix**:
  - In `sw.js:46-47`, change `'./icons/icon-192.png'` → `'./icon-192.png'` (both `icon` and `badge`).
  - Same change in `index.html:11289`.
  - After deploy, bump the `CACHE` version in `sw.js` to force SW update.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. AI prompts hardcode "Panos" and Givelink context as the default "about me"

- **What**: Six AI prompt templates fall back to `'Panos — Greek founder in his 20s building Givelink (nonprofit fundraising SaaS), targeting financial freedom and a move to San Francisco.'` when the user hasn't filled in their About Me. Every other user receives AI advice that is literally written for the developer — including references to Givelink, Greek market, and the SF move.
- **Where**: `index.html:5647, 5920, 7319, 7477, 7849, 9806`
- **Why it matters**: A user receiving relationship suggestions like "reach out to support Panos's Givelink fundraising platform" won't understand what happened — and will not trust the AI feature again. High churn risk for any activated user.
- **Effort**: M
- **Suggested fix**:
  - Change the fallback string to a generic placeholder: `'a productivity-focused individual working toward their goals'`.
  - Add a persistent soft prompt inside the AI lab and dashboard: "Personalize AI — tell it who you are (takes 30 seconds)" linking to the About Me field in Settings.
  - Remove all explicit "Givelink", "Greek", and "SF" references from default prompt templates entirely.

---

### 5. Staging URL `task-management-beige-eight.vercel.app` hardcoded throughout

- **What**: The old Vercel preview URL is hardcoded in OG meta tags, canonical URL, JSON-LD structured data, the share-card canvas, and the `_APP_URL` constant. Social shares and Google indexing point to the preview URL.
- **Where**: `index.html:24,25,32,10180,10232` | `landing.html:11,16,17,25`
- **Why it matters**: Social shares generate link previews for the wrong URL. Google may split PageRank between two URLs. Users sharing their progress cards embed the dev URL in the image text.
- **Effort**: S
- **Suggested fix**:
  - Replace all instances of `task-management-beige-eight.vercel.app` with the actual production domain (or a custom domain if one exists).
  - Set `_APP_URL` dynamically: `const _APP_URL = location.origin + '/';`
  - Use that constant in the canvas text instead of a hardcoded string.

---

### 6. Givelink is still fully wired into the app after the "removal" commit (#73)

- **What**: Despite commit `d635c06` claiming to "Remove Givelink from Task OS", `renderGivelinkDash()` still exists (229 lines), `givelink-dash` is still in the nav sidebar and router, `givelink` is still a task category in `CATS`, and `_renderGivelinkToday()` still injects a "Givelink OS" section on the dashboard.
- **Where**: `index.html:2503` (CATS), `index.html:2984` (router), `index.html:8618` (render fn, 229 lines), `index.html:9569` (nav), `index.html:11917` (_renderGivelinkToday), `index.html:14311` (HTML div `v-givelink-dash`)
- **Why it matters**: New users see "Givelink" in their task categories, dashboard, and sidebar — a confusing brand that isn't theirs. Adds ~300 lines of dead weight. State object `S.givelinkMetrics` persists business KPIs (ARR, MRR, pipeline) for every user account.
- **Effort**: M
- **Suggested fix**:
  - Remove `givelink` key from `CATS` constant; add a migration guard to reclassify existing `givelink` tasks to `other`.
  - Delete `renderGivelinkDash()` function and `v-givelink-dash` HTML div.
  - Remove `givelink-dash` from `renderView()` dispatch map and sidebar nav items.
  - Remove `_renderGivelinkToday()` call from the dashboard render path.
  - Remove `givelinkMetrics` and `givelinkHistory` from the `S` state object.

---

### 7. PostHog analytics key is empty — zero product data

- **What**: `APP_CONFIG.posthogKey = ''` means `initAnalytics()` returns early and no events fire. Signups, feature use, churn signals, and funnel data are invisible.
- **Where**: `index.html:9960`
- **Why it matters**: Can't make data-driven decisions about what's working. All the `track()` calls throughout the codebase are already correct — this is a one-line config gap.
- **Effort**: S (config change)
- **Suggested fix**:
  - Create or activate a PostHog project, copy the project API key.
  - Paste it into `index.html:9960`.
  - Verify events are arriving in PostHog after first login.

---

### 8. Financial targets hardcoded to developer's personal goals

- **What**: The Life OS dashboard renders `€25K income` as a hardcoded goal (line 5323), and `_NS_TARGETS` sets bodyfat:12, sleep:85, workout:5, weight:75, income:25000, passive:3600 as fixed thresholds for health/status indicators — all specific to the developer's personal situation.
- **Where**: `index.html:5323` (rendering), `index.html:6163` (`_NS_TARGETS` object)
- **Why it matters**: A user with a different income target or currency sees "income 2026 (goal: €25K)" with their data measured against a stranger's goal. Breaks the whole Life OS scorecard for anyone who isn't the developer.
- **Effort**: M
- **Suggested fix**:
  - Move targets to `S.targets = {}` in the state object with user-configurable values.
  - Add a "Set your targets" prompt in the Life OS / Goals section.
  - Fall back to `_NS_TARGETS` defaults only when `S.targets[key]` is unset.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. No rate limiting on the AI proxy — one user can drain the budget

- **What**: `api/claude.js` contains the comment "For production add per-user rate limiting (e.g. Upstash)" but has not implemented it. There is nothing preventing a single authenticated user from sending thousands of requests.
- **Where**: `api/claude.js:12`
- **Why it matters**: A single power user (or a tab that loops) can exhaust the Anthropic billing quota for all users. Direct financial risk.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting: `npm i @upstash/ratelimit @upstash/redis` — 10–20 lines of middleware.
  - Gate per `_SB.uid` (already extracted from the Supabase token in the handler).
  - Fallback: add a simple `max_tokens` cap already enforced (currently 2000 — keep) and consider request-per-minute limits per IP even before auth.

---

### 10. Brand colors used as raw hex in 50+ JS render functions — breaks light mode

- **What**: Colors `#69db7c` (green), `#ff6b6b` (red), `#ffa94d` (orange) appear as hardcoded hex strings inside JavaScript-rendered HTML throughout the file. These colors are defined as CSS variables (`--bb`, `--bw`, `--bm`) in `:root` with light-mode overrides, but the JS doesn't use them — so inline-styled elements never adapt when the user switches to light mode.
- **Where**: `index.html:411,424,441,3554,3622,5232,5301,5323,5334,5354,5950,6235` (50+ instances total)
- **Why it matters**: Light mode users see neon green (`#69db7c`) on white — nearly unreadable and inconsistent with the rest of the UI. Brand inconsistency erodes trust.
- **Effort**: M
- **Suggested fix**:
  - Add semantic CSS variables: `--color-ok`, `--color-warn`, `--color-danger` in `:root` and override in `body.light`.
  - In JS render functions, switch from `color:#69db7c` to `color:var(--color-ok)` etc.
  - Alternatively, add a `getComputedStyle(document.body)` helper for JS to read current theme values.

---

### 11. `seed()` function (400+ lines of developer personal data) never cleaned up

- **What**: The `seed()` function (lines 4532–4925) is blocked by `_hostedMode()` at runtime, but still ships 400+ lines of the developer's personal tasks (Greek medical appointments, personal financial entries, specific business tasks). It would run — loading all personal data — for anyone who clones the repo and opens it without Supabase configured.
- **Where**: `index.html:4532-4925`, `index.html:10660`
- **Why it matters**: Anyone self-hosting gets the developer's personal data as their own starter. Also adds 400+ lines to the file unnecessarily now that `_seedStarter()` exists.
- **Effort**: S
- **Suggested fix**:
  - Delete the entire `seed()` function body and replace the call at line 10660 with `_seedStarter()`.
  - Delete `seedGoals()` similarly, or replace with a generic set of example goals.
  - Update the `seededV2` / `seededGoalsV3` flags accordingly.

---

### 12. Supabase anon key format looks non-standard — may be misconfigured

- **What**: The anon key at `index.html:9958` is `sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M`. Standard Supabase anon/public keys are JWT format starting with `eyJ...`. The `sb_publishable_` format is used for edge-function publishable keys, not the anon key used in browser auth calls.
- **Where**: `index.html:9958`
- **Why it matters**: If this is the wrong key type, Supabase auth calls (`/auth/v1/token`, `/auth/v1/user`) will 401 silently — users will appear signed in but sync will fail. Hard to debug.
- **Effort**: S
- **Suggested fix**:
  - Open Supabase dashboard → Project Settings → API → copy the `anon` / `public` key (JWT format).
  - Replace the `sb_publishable_...` value with the correct JWT key.
  - Test auth by signing in as a fresh user and confirming sync works.

---

## 💡 P3 — Nice to have

### 13. Landing page uses system font, app uses Inter — visible font shift on enter

- **What**: `landing.html` declares `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,...` while `index.html` loads Inter from Google Fonts. Users navigating from landing to app see a font swap.
- **Where**: `landing.html:53`, `index.html:16`
- **Effort**: S
- **Suggested fix**: Add the Google Fonts `<link>` to `landing.html`, or self-host Inter and use it in both.

---

### 14. Calendar-sharing invite deep-link appends raw HTML to URL

- **What**: `_agErr` and sharing functions construct URLs by concatenating strings without encoding — special characters in task names or goal titles can break the generated deep-links.
- **Where**: `index.html:10106` (`_agErr`), sharing helpers around line 10245
- **Effort**: S
- **Suggested fix**: Wrap all URL-embedded user content in `encodeURIComponent()`.

---

### 15. `givelink` category still appears in new-task dropdowns

- **What**: Even if the nav link to Givelink is removed, the `CATS` constant still includes `givelink:{l:'Givelink',e:'🟣'}`, so the category picker on every new task and task-edit modal shows "Givelink" as an option. Users assigning categories will see a brand they've never heard of.
- **Where**: `index.html:2503`
- **Effort**: S
- **Suggested fix**: Remove the `givelink` entry from `CATS`; add a one-time migration guard on `load()` to reclassify any existing `category:'givelink'` tasks to `'other'`.

---

*Total items: 15 | P0: 3 | P1: 5 | P2: 4 | P3: 3*
