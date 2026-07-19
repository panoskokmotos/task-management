# Improvement Plan — Arete / Givelink Sprint Board
*Generated: 2026-07-19 — automated codebase audit*

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Givelink: `callClaudeGL` swallows all HTTP errors silently
- **What**: `callClaudeGL` calls `res.json()` without checking `res.ok`, so 401 / 429 / 500 errors never surface; the function returns `null` and the UI shows a generic "Could not generate. Check your API key." message even when the key is fine.
- **Where**: `givelink.html:1264–1271`
- **Why it matters**: The AI Standup Generator and AI Outreach Email Generator are both broken for any user hitting a rate limit or transient error. They get no actionable feedback and may churn.
- **Effort**: S
- **Suggested fix**:
  - Add `if(!res.ok){...}` check identical to the one in `index.html:5026–5029`.
  - Map 429 → "Rate limit — wait a moment", 401 → "Invalid key", other → `AI error ${res.status}`.
  - Show the error in the modal body rather than falling back to a toast.

---

### 2. Service worker push notification uses a missing icon path
- **What**: `sw.js:47` references `icon: './icons/icon-192.png'` but the file lives at `./icon-192.png` (no `icons/` subdirectory). Push notifications arrive with a broken / placeholder icon.
- **Where**: `sw.js:47–48`
- **Why it matters**: Every push notification the app sends looks unbranded. On iOS/Android, icon-less notifications are easy to dismiss or distrust.
- **Effort**: S
- **Suggested fix**:
  - Change line 47 to `icon: './icon-192.png'`.
  - While there, also fix `badge: './icons/icon-192.png'` on line 48 for the same reason.

---

### 3. CRM "Delete" button in Givelink never appears during edits
- **What**: `_showNPModal` creates the modal DOM once on the first call. The delete button is conditionally included in the template string: `${editNpId?'<button ...>Delete</button>':''}`. On first creation, `editNpId` is always `null` (called via `openAddNP()`), so the delete button is never rendered. Subsequent `openEditNP()` calls populate fields but never regenerate the HTML.
- **Where**: `givelink.html:1358–1401`, specifically line `1380`
- **Why it matters**: Users editing a nonprofit org can never delete it via the modal (only via the global CRM view, which doesn't surface the delete action prominently). This is data they entered and expect to be able to remove.
- **Effort**: S
- **Suggested fix**:
  - Move the delete button outside the one-time template: always render it in the modal footer, and toggle its `display` via JS in `_showNPModal` based on whether `editNpId` is set.
  - Or: clear `m.innerHTML` and re-generate the modal HTML on every call.

---

### 4. AI proxy is never wired up — all AI features fail for new users
- **What**: `APP_CONFIG.aiProxy` is an empty string (`index.html:9959`). The proxy endpoint exists at `/api/claude.js` (Vercel serverless function) but is never pointed to. Without it, every AI feature — auto-triage, plan my day, AI day planner, reply-to-act — hits the "Add Claude API key in Settings" toast immediately. The landing page's primary value prop ("AI that clears your inbox") is broken on first use.
- **Where**: `index.html:9959`, `api/claude.js`
- **Why it matters**: The landing page runs a 5-step "get going in 30 seconds" pitch, and step 2 involves AI. Any visitor who converts, tries AI, and immediately sees a prompt for an Anthropic API key churns on the spot.
- **Effort**: M
- **Suggested fix**:
  - Deploy `api/claude.js` on Vercel and add `ANTHROPIC_API_KEY` as an environment variable.
  - Set `aiProxy: '/api/claude.js'` (relative URL works in Vercel deployments).
  - The proxy already gates on Supabase auth when `SUPABASE_URL` is set — enable that gating so only signed-in users call the proxy, preventing anonymous abuse.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. PostHog key is empty — zero product analytics being collected
- **What**: `posthogKey: ''` (`index.html:9960`). Every `track()` call throughout the app — `task_created`, `onboarding_started`, `onboarding_completed`, `guest_nudge_shown`, `triage_applied`, `auth_signup`, `auth_login`, `guest_to_signup` — is a complete no-op.
- **Where**: `index.html:9960`, and all `track()` calls throughout the file
- **Why it matters**: Without analytics it's impossible to know conversion rate from guest → account, which AI features get used, where onboarding drops off, or whether the new templates feature drives retention. Every product decision is a guess.
- **Effort**: S
- **Suggested fix**:
  - Create a free PostHog project (posthog.com) and paste the key into `APP_CONFIG.posthogKey`.
  - `autocapture: false` is already set — good. The existing `track()` event taxonomy covers the critical funnel.

---

### 6. Landing page canonical URL points to Vercel subdomain
- **What**: `landing.html:11` has `<link rel="canonical" href="https://task-management-beige-eight.vercel.app/">`. If a custom domain (`arete.app`, etc.) is ever pointed at this project, Google will continue indexing the Vercel URL and split authority. The OG / Twitter `og:url` and `og:image` in both `landing.html` and `index.html` have the same Vercel URL hardcoded.
- **Where**: `landing.html:11–16`, `index.html:24–25`
- **Why it matters**: Every backlink and share to the app consolidates SEO authority on the Vercel subdomain. Migrating to a real domain later means starting SEO from scratch.
- **Effort**: S
- **Suggested fix**:
  - Replace all Vercel URLs in canonical, og:url, og:image, twitter:image with the production domain.
  - Keep the Vercel URL as a `301` redirect target so existing links still work.

---

### 7. Givelink sprint board still brands itself "Task OS"
- **What**: `givelink.html:225` has a nav link `← Task OS`. The main product was rebranded to "Arete" in commit `0c1d32d`. Givelink also has `<meta name="apple-mobile-web-app-title" content="Givelink">` (fine) but the cross-link text still says the old name.
- **Where**: `givelink.html:225`
- **Why it matters**: Users who open Givelink and click the back link are navigating to something labeled "Task OS," which doesn't exist in any surface they can see. Brand confusion after a rebrand is a trust signal issue.
- **Effort**: S
- **Suggested fix**:
  - Change the link text to `← Arete` (or `← Back to Arete`).
  - Confirm the `<title>` and all human-readable strings in `givelink.html` use the current product name.

---

### 8. Anthropic API key stored in plaintext in localStorage
- **What**: The user's Anthropic key is stored under `localStorage.taskos_api_key` (set in `givelink.html:1086`) and inside the `S` JSON blob as `S.claudeKey` (serialized into `localStorage.taskos`). Any browser extension, third-party script, or XSS that can read `localStorage` can extract it. The headers `anthropic-dangerous-direct-browser-access: true` are required specifically because this is an anti-pattern.
- **Where**: `givelink.html:1086`, `index.html:2517` (claudeKey in S), `index.html:5022`, `givelink.html:1266`
- **Why it matters**: If an attacker reads the key, they can use the user's Anthropic quota (and spend real money) without the user knowing. While the aiProxy fix (P0 #4) eliminates the need for users to enter keys, any user who already entered a key has it at risk.
- **Effort**: M
- **Suggested fix**:
  - After wiring up the aiProxy, remove the per-user API key flow entirely (or gate it behind a "developer mode" setting).
  - For the interim, at minimum display a warning next to the key input: "Your key is stored locally. Never share this device."
  - Do not store the key inside the `S` blob that syncs to Supabase — it would then be stored server-side too.

---

### 9. Mobile Givelink sprint board is missing two pillars in bottom nav
- **What**: The bottom navigation bar in `givelink.html` shows only: Overview, Growth, Product, Execute, Backlog. It is missing Nonprofits (🤝) and Smooth Ops (🔧), which together contain ~40+ tasks in the default seed data.
- **Where**: `givelink.html:306–312`
- **Why it matters**: Mobile users have no quick path to the Nonprofits CRM or Ops tasks. They must open the sidebar (hamburger menu) for every visit to those views, adding 2–3 taps per context switch on the device used most in the field.
- **Effort**: S
- **Suggested fix**:
  - Replace the least-used bottom nav item (Backlog is accessible via sidebar) with Nonprofits.
  - Or use a scrollable horizontal bottom nav that shows all 6 items; the current 5-item layout has spare horizontal pixels on most phones.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `index.html` is a 14,924-line monolith
- **What**: The entire main app — 30+ features, ~600 CSS rules, ~300 functions — lives in a single HTML file that exceeds the tool's 256 KB read limit and weighs over 1 MB uncompressed.
- **Where**: `index.html` (entire file)
- **Why it matters**: Any edit risks clobbering another feature. There is no tree-shaking, no per-feature caching, and the browser must parse 15k lines even when the user only uses 3 features. Onboarding a second developer is nearly impossible. Feature flags or A/B tests can't be scoped.
- **Effort**: L
- **Suggested fix**:
  - Extract inline CSS to `style.css`; extract the `<script>` block to `app.js`. This alone cuts the HTML to ~500 lines and allows selective cache-busting.
  - Group functions into modules (auth, sync, ai, tasks, goals) using ES module `<script type="module">` or a lightweight bundler.
  - Do not attempt a full rewrite — incremental extraction file-by-file is lower risk.

---

### 11. Duplicate AI call implementations with diverging quality
- **What**: `callClaude()` (index.html:5006) and `callClaudeGL()` (givelink.html:1256) are independent implementations. `callClaude` has proper `res.ok` checking, proxy support, and model selection. `callClaudeGL` lacks all three.
- **Where**: `index.html:5006–5033`, `givelink.html:1256–1272`
- **Why it matters**: The P0 bug (#1 above) exists because of this duplication. Future improvements to the AI call path (retry logic, streaming, prompt caching) need to be applied twice.
- **Effort**: M
- **Suggested fix**:
  - Extract a shared `callAnthropicAPI(prompt, opts)` function into a shared script block included in both files.
  - Or, once `index.html` is modularized, import the function in `givelink.html` from the shared module.

---

### 12. Service worker cache key is a manually-updated date string
- **What**: `sw.js:1`: `const CACHE = 'arete-20260723'`. When a developer forgets to update this after a deployment, clients keep serving cached HTML/assets from the previous version indefinitely (or until the user clears storage). The SW `install` event always succeeds with the stale key.
- **Where**: `sw.js:1`
- **Why it matters**: After-deploy bugs that only appear in fresh loads (new code paths, API changes) won't show up for returning users. This has already caused at least one incident — commit `c32b2ef` is titled "fix load-time init bug," which is a class of bug that stale SW caches are notorious for.
- **Effort**: S
- **Suggested fix**:
  - Inject the cache key at build time using a content hash (e.g. in a `vercel.json` build step or a simple `sed` script).
  - Alternatively, use `'arete-v'+APP_VERSION` where `APP_VERSION` is a constant updated by a pre-commit hook or CI script.

---

### 13. Givelink burndown chart is actually a burn-up (misleading label)
- **What**: `givelink.html:754–775` — `renderBurndown` maps **completed tasks** (done count) to Y position, so the plotted line trends **upward** as work gets done. The ideal line also goes up (from start to end). This is a burn-up chart, not a burndown. A burndown shows **remaining** work going down toward zero.
- **Where**: `givelink.html:764–775`
- **Why it matters**: A sprint that is on track looks visually identical to one that is stalled, because both can trend upward. The chart provides no signal about whether the sprint will complete on time.
- **Effort**: S
- **Suggested fix**:
  - Change `doneToY` to map **remaining tasks** (`total - done`) to Y, so the line falls toward zero as work completes.
  - Update the ideal line to go from `(start, total)` to `(end, 0)`.
  - Or rename the chart to "Completion Progress" to reflect what it actually shows.

---

### 14. Seeded CRM data uses real organization names
- **What**: `givelink.html:1281–1292` — `seedNonprofits()` seeds St. Anthony Foundation, SF Safehouse, Edgewood, Swords to Plowshares, and others as pre-populated CRM contacts, including stage, mission copy, and activity notes. Any new user who opens `givelink.html` gets a CRM that looks populated with real partner data.
- **Where**: `givelink.html:1281–1292`
- **Why it matters**: A new team member or demo user could accidentally draft and send AI-generated outreach to these real organizations. It also blurs the line between product demo and live data. If these orgs ever stop being partners, the seed data becomes misleading.
- **Effort**: S
- **Suggested fix**:
  - Replace the real org names with clearly fictional placeholders (e.g. "Acorn Food Bank [Demo]", "Riverside Shelter [Demo]").
  - Or add a `_isDemo: true` flag to seeded records and show a "Demo data" watermark, with a "Clear demo data" button in the CRM header.

---

## 💡 P3 — Nice to have

### 15. `theme-color` meta doesn't adapt to light/dark mode
- **What**: `index.html:6` hardcodes `<meta name="theme-color" content="#0a0a0f">` (always dark). `landing.html:8` hardcodes `#f7f6f3` (always light). The main app supports both themes via `body.light`, but the browser chrome color never changes.
- **Where**: `index.html:6`, `landing.html:8`
- **Why it matters**: On mobile, the browser toolbar color clashes with the app's current theme, creating a jarring transition when switching modes.
- **Effort**: S
- **Suggested fix**: Use two `<meta name="theme-color">` tags with `media` attributes:
  ```html
  <meta name="theme-color" content="#0a0a0f" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#f7f6f3" media="(prefers-color-scheme: light)">
  ```

---

### 16. `syncToTaskOS` uses title-matching — fragile cross-product sync
- **What**: `givelink.html:1222–1226` — matching Givelink tasks to Task OS tasks by case-insensitive title comparison. If a user renames a task in Givelink, the sync creates a duplicate in Task OS rather than updating the original.
- **Where**: `givelink.html:1222–1226`
- **Why it matters**: Sync that silently duplicates tasks erodes user trust in both products. Users may end up with 2× tasks they've already completed.
- **Effort**: M
- **Suggested fix**:
  - Add a `givelinkId` field to Task OS tasks on first sync.
  - On subsequent syncs, match by `givelinkId` first, fall back to title only if no ID match exists.

---

### 17. Givelink uses a separate blue design palette — no shared tokens with Arete
- **What**: `givelink.html:17`: `--accent:#3b82f6` (Tailwind blue-500). The main Arete app uses `--accent:#8272f2` / `--brand:#5a49e0` (violet). The two products share no CSS variables.
- **Where**: `givelink.html:15–20`, `index.html:44–51`
- **Why it matters**: As Givelink is positioned as a companion to Arete, a blue-vs-violet split creates unnecessary brand confusion. Any future effort to create a unified design system has to start by reconciling two incompatible token sets.
- **Effort**: M
- **Suggested fix**:
  - Define shared brand tokens in a `brand.css` file: primary violet, surface colors, border radius scale, type scale.
  - Givelink can keep its blue accent color as a product-level override (`--gl-accent:#3b82f6`) while inheriting the shared surface/border/type tokens.

---

### 18. SW caches `manifest-givelink.json` for main Arete users unnecessarily
- **What**: `sw.js:7`: `'./manifest-givelink.json'` is in the `STATIC` array and cached for all users who install the Arete PWA. This file is only needed by `givelink.html`.
- **Where**: `sw.js:3–11`
- **Why it matters**: Minor: adds a spurious cache entry and a cache-invalidation surface for every Arete-only user. Low impact but trivially fixable.
- **Effort**: S
- **Suggested fix**: Remove `manifest-givelink.json` from the `STATIC` array and add it to a separate fetch-on-demand path for `givelink.html` requests only.

---

*Max 18 items — 4 P0, 5 P1, 5 P2, 4 P3.*
