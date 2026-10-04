# Improvement Plan — Arete / Givelink Codebase
_Generated 2026-10-04_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Self-hosted users get the owner's personal task and goal data on first launch
- **What**: `seed()` and `seedGoals()` run for any non-hosted deployment and inject the owner's Greek health appointments, personal Givelink tasks, and private goals as the user's starter data.
- **Where**: `index.html:4532–4922` (seed tasks), `index.html:4925–4923` (seedGoals), `index.html:10660` (call site — `if(!_hostedMode()){seed();seedGoals();}`)
- **Why it matters**: Anyone cloning and self-hosting the app (or testing locally) opens the app and sees "Ακτινογραφία στα γόνατα", "Γενέθλια Σοφίας", Panos's financial moves, and Givelink sales tasks as their own. Destroys trust immediately.
- **Effort**: S
- **Suggested fix**:
  - Replace the contents of `seed()` and `seedGoals()` with 5–8 generic demo tasks (similar to `_seedStarter()` at line 10443 which already exists and is correct).
  - Or — guard the call site: `if(DEV_MODE){seed();}` and set `DEV_MODE=false` before any deploy.
  - Keep `_seedStarter()` as the only "new user" seeder; it is already generic and correct.

---

### 2. `profileName` defaults to "Panos" for all guests and self-hosted users
- **What**: Every user who hasn't signed in or set a name sees "Good morning, Panos 👋" on the dashboard.
- **Where**: `index.html:1070` (hardcoded in HTML), `index.html:2519` (`let profileName = localStorage.getItem('taskos_name')||'Panos'`)
- **Why it matters**: Immediately signals to new users that this is someone else's personal tool, not theirs — kills first impressions.
- **Effort**: S
- **Suggested fix**:
  - Change the fallback to `'there'` or `''` (render "Good morning 👋" without a name until one is set).
  - In the HTML: `<h1 id="greeting">Good morning 👋</h1>`.

---

### 3. AI prompts sent with the owner's personal bio for all users who haven't filled their profile
- **What**: Four AI features (Know Thyself, Brand, Life Frameworks, AI Coach) fall back to `'Panos — Greek founder in his 20s building Givelink (nonprofit fundraising SaaS), targeting financial freedom and a move to San Francisco.'` as the user context sent to Claude.
- **Where**: `index.html:7849`, `index.html:9806`, `index.html:12186`, `index.html:13291`
- **Why it matters**: Any user who hasn't filled in their About Me gets AI responses tailored to the owner's life situation. Privacy leak + wrong output = broken feature.
- **Effort**: S
- **Suggested fix**:
  - Change the fallback to a neutral prompt: `'(User has not filled in their About Me yet.)'`.
  - Or gate AI features that need personal context with an inline nudge to fill in the profile first.

---

### 4. `window.prompt()` and `confirm()` are broken in iOS PWA mode in Givelink
- **What**: Givelink uses `window.prompt()` to collect the API key, log activity, and `confirm()` for all deletions. iOS blocks both in standalone (Add to Home Screen) mode.
- **Where**: `givelink.html:1155`, `givelink.html:1330`, `givelink.html:1504` (`window.prompt`); `givelink.html:801`, `givelink.html:1498` (`confirm`)
- **Why it matters**: On iOS PWA (the primary mobile target), tapping "Delete" silently does nothing, and the API key flow is completely inaccessible. Givelink is unusable on iPhone home screen.
- **Effort**: M
- **Suggested fix**:
  - The main app already has an iOS-safe prompt replacement at `index.html:2817`. Copy that modal pattern into `givelink.html` and wire up the same 3 call sites.
  - Replace `confirm('Delete?')` with an inline confirmation UI (e.g., button turns red and requires a second tap, or a small modal).

---

### 5. `syncToTaskOS()` silently fails — reads from obsolete localStorage keys
- **What**: The Givelink "Sync to Task OS" button reads `taskos_profiles` and `taskos_data_${id}`, which the current version of the main app no longer writes (removed in PR #73).
- **Where**: `givelink.html:1275–1319`
- **Why it matters**: Users click "Sync to Task OS" and either see "No Task OS profile found" or the sync silently does nothing. The feature appears broken even when both apps are open.
- **Effort**: M
- **Suggested fix**:
  - Update `syncToTaskOS()` to read from the current key `taskos` (the single `S` object) and its `tasks` array, removing the legacy multi-profile indirection.
  - Or remove the sync button entirely if the two apps are now intended to be fully separate.

---

### 6. Push notification icon 404s — wrong path in service worker
- **What**: `sw.js` references `'./icons/icon-192.png'` for the push notification icon, but the file lives at `./icon-192.png` (no subdirectory).
- **Where**: `sw.js:46–47`
- **Why it matters**: Every push reminder shows a broken/generic icon on Android and some desktop PWA installs — looks unprofessional and reduces tap-through.
- **Effort**: S
- **Suggested fix**:
  - Change lines 46–47 in `sw.js` to `icon: './icon-192.png'` and `badge: './icon-192.png'`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 7. Givelink has no mobile layout — sidebar takes 216px on 375px screens
- **What**: `givelink.html` has no `@media` breakpoints. The fixed-width sidebar leaves ~160px of usable content width on a typical iPhone.
- **Where**: `givelink.html:21–23` (body/sidebar styles), no `@media` rules anywhere in the file
- **Why it matters**: Givelink is used on the go for nonprofit tracking. On mobile it's effectively unusable in portrait mode.
- **Effort**: M
- **Suggested fix**:
  - Add a `@media(max-width:768px)` block: hide/collapse sidebar to a top nav or a hamburger drawer.
  - The task and goal cards are already styled well — only the layout container needs fixing.

---

### 8. AI features require an API key with no inline setup path
- **What**: Tapping any AI button when no key is set shows a dismissible toast: "Add your Claude API key in Settings". No link, no modal, no guided path.
- **Where**: `index.html:4328`, `index.html:5047`, `index.html:5111`
- **Why it matters**: New users who discover AI features in the first session bounce because there's no "here's how to get started" moment. This is the primary conversion blocker for the AI upsell.
- **Effort**: S
- **Suggested fix**:
  - Instead of a toast, open the Settings modal directly scrolled to the API key section, or show a small inline callout with a "Set up AI →" button.
  - Add a one-liner in the toast: `toast('Add your Claude API key in Settings → AI Features to enable this.')` with the Settings modal opening on click.

---

### 9. `_APP_URL` hardcoded to the Vercel preview subdomain
- **What**: Referral links, template share links, and the progress card watermark all use the hardcoded URL `https://task-management-beige-eight.vercel.app/`.
- **Where**: `index.html:10180`, `index.html:10232`
- **Why it matters**: Any link shared from the app points to the preview URL, not a custom domain. SEO canonical and referral attribution will break when a real domain is added. The watermark on share images looks unprofessional.
- **Effort**: S
- **Suggested fix**:
  - Derive the URL dynamically: `const _APP_URL = window.location.origin + '/';`
  - Or move it into `APP_CONFIG` at line 9956 alongside other config values so it can be changed in one place.

---

### 10. `givelink.html` `callClaudeGL()` swallows non-2xx API errors silently
- **What**: `callClaudeGL()` calls `res.json()` without first checking `res.ok`. A 429 (rate limit) or 401 (bad key) response is parsed as data and returns `null` without any user-visible error.
- **Where**: `givelink.html:1332–1341`
- **Why it matters**: Users triggering AI features in Givelink (outreach draft, nonprofit analysis) see nothing happen on rate-limit or auth errors — no toast, no indication of what went wrong.
- **Effort**: S
- **Suggested fix**:
  - Add a `!res.ok` check mirroring the pattern already used in `runAiSprintPlanner()` at `givelink.html:1214`:
    ```js
    if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.error?.message||'API error '+res.status);}
    ```

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. API proxy (`api/claude.js`) has no rate limiting — open to bill abuse
- **What**: The Vercel serverless proxy forwards any authenticated request to Anthropic with no per-user or per-day cap. The comment on line 13 acknowledges this is missing.
- **Where**: `api/claude.js:13`, `api/claude.js:38–48`
- **Why it matters**: A single compromised Supabase refresh token (or a bug in the auth check) can run up an uncapped Anthropic bill. Even honest users making a loop could do this accidentally.
- **Effort**: M
- **Suggested fix**:
  - Add a simple in-memory counter with a daily-reset (acceptable for low traffic): `const _calls = {}; if((_calls[uid]||0) > 50){res.status(429)...}`
  - Or use Upstash Redis for per-user rate limiting (the comment already suggests this).
  - At minimum, set `max_tokens` cap server-side (already done at 2000 — good) and add a 50 req/day/user guard.

---

### 12. Givelink AI sprint planner uses `claude-opus-4-5` — 15× more expensive than haiku
- **What**: `runAiSprintPlanner()` directly calls the API with `model: 'claude-opus-4-5'`, bypassing the `callClaudeGL()` helper that defaults to haiku.
- **Where**: `givelink.html:1209`
- **Why it matters**: Sprint planning suggestions (a simple JSON list of 10 tasks) don't need Opus. This costs ~15× more than Haiku per call with no quality difference for structured output tasks.
- **Effort**: S
- **Suggested fix**:
  - Change `model: 'claude-opus-4-5'` to `'claude-haiku-4-5-20251001'`, or refactor the function to use `callClaudeGL()` which already handles key retrieval, error handling, and model selection.

---

### 13. `index.html` is a 14,926-line monolith — no module boundaries
- **What**: The entire app — HTML, CSS, state, rendering, AI, sync, auth, seed data — lives in one file with no separation.
- **Where**: `index.html` (entire file)
- **Why it matters**: Searching for a bug requires grepping 15k lines. Accidental global variable collision is common. It's impossible to write any unit tests. Every deploy rerenders the entire file.
- **Effort**: L
- **Suggested fix**:
  - Don't do a full rewrite now. Start by extracting the three largest, most independent blocks: `seed()`/`seedGoals()` (lines 4531–4923), the Supabase auth/sync functions (lines 9963–10470), and the AI functions (lines 5005–5115) into `<script src="...">` modules.
  - This is a 6–8 sprint effort but can be done incrementally; prioritize the sections that change most often.

---

### 14. Personal seed data lives in production code
- **What**: ~400 lines of the owner's personal tasks, goals, Greek text, and Givelink-specific content are in the production `seed()` and `seedGoals()` functions.
- **Where**: `index.html:4531–4922`
- **Why it matters**: Beyond the P0 bug (item #1 above), this content creates maintenance overhead, confuses contributors, and leaks PII (email hints, personal health info) in the public repo.
- **Effort**: S (once P0 fix #1 is done)
- **Suggested fix**:
  - After replacing the seed content with generic demo data (P0 fix #1), delete the ~400 lines of personal content entirely. The `_seedStarter()` function at line 10443 is the correct replacement.

---

## 💡 P3 — Nice to have

### 15. `landing.html` structured data names the author as "Panos" instead of the product/org
- **What**: Google rich results will attribute the app to a person named "Panos" rather than a brand.
- **Where**: `landing.html:25` — `"author":{"@type":"Person","name":"Panos"}`
- **Why it matters**: Minor SEO/branding issue — fine for a personal project, worth fixing before a growth push.
- **Effort**: S
- **Suggested fix**: Change to `"publisher":{"@type":"Organization","name":"Arete"}`.

---

### 16. Givelink's color palette (`--accent:#3b82f6` blue) diverges from the Arete brand (purple)
- **What**: Givelink uses Tailwind blue as its primary accent, while Arete uses violet/purple. If these apps share a user, the visual mismatch is jarring.
- **Where**: `givelink.html:17` (`:root` token definitions)
- **Why it matters**: Low-priority because Givelink is intentionally a separate product, but if co-marketing increases, a shared design token file would reduce confusion.
- **Effort**: M
- **Suggested fix**: Create a shared `brand-tokens.css` file; each app imports and can override. Givelink keeps its blue for now — just document the intentional divergence.

---

### 17. Service worker `CACHE` key not versioned with a hash — stale deploys possible
- **What**: The SW cache key is `'arete-20260723'` (a manual date). If assets change but the SW isn't manually rebumped, users can get stale HTML.
- **Where**: `sw.js:1`
- **Why it matters**: Low risk if every deploy touches the SW file, but risky if only `index.html` is changed. One stale deploy causes hard-to-diagnose "old version" issues.
- **Effort**: S
- **Suggested fix**: Add a build step that injects a hash or deploy timestamp into the SW cache key automatically (e.g., using a Vercel build hook to sed-replace the key).

---

### 18. No empty-state copy for first-time Givelink views (CRM, Pipeline, burndown)
- **What**: Givelink's CRM, pipeline, and burndown chart render blank panels until data exists. There's no "Add your first nonprofit" prompt or onboarding nudge.
- **Where**: `givelink.html:599` (`renderBacklog`), `givelink.html:556` (`renderPillar`)
- **Why it matters**: New users land on an empty board with no guidance. First-session abandonment is high for tools with no visible "next step."
- **Effort**: S
- **Suggested fix**: Add a simple empty-state `<div>` in each render function: icon + 1-line copy + CTA button. Takes ~30 minutes per panel.
