# Arete — Improvement Plan

Generated: 2026-08-22

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP blocks Google Fonts → Inter fails to load in production
- **What**: The `Content-Security-Policy` header permits `font-src 'self'` and `style-src 'self' 'unsafe-inline'`, but the app loads Inter from `fonts.googleapis.com` (stylesheet) and `fonts.gstatic.com` (font files). CSP-enforcing browsers silently drop both, falling back to system fonts and breaking the visual design.
- **Where**: `vercel.json:15` — CSP header; `index.html:14-16` — font link tags
- **Why it matters**: Every user on Chrome/Firefox/Edge in production sees a broken layout. Brand perception and polish are core to an Arete-tier product.
- **Effort**: S
- **Suggested fix**:
  - Add `https://fonts.googleapis.com` to `style-src` in vercel.json:15
  - Add `https://fonts.gstatic.com` to `font-src` in vercel.json:15
  - Alternatively, self-host Inter via `@fontsource/inter` and eliminate the external dependency entirely

---

### 2. Staging URL hardcoded in OG tags, share card, and app constant
- **What**: `task-management-beige-eight.vercel.app` is hardcoded in `_APP_URL`, the canvas share card text, og:url, og:image, twitter:image, structured data, canonical link, and robots.txt. Any custom domain deployment sends shares and SEO signals to the wrong URL.
- **Where**: `index.html:10180` (`_APP_URL`), `index.html:10232` (share card canvas), `landing.html:11,16,17,25`, `robots.txt:4`
- **Why it matters**: Viral shares ("Made with Arete · task-management-beige-eight.vercel.app") look unprofessional and send traffic to the staging deployment instead of the live product.
- **Effort**: S
- **Suggested fix**:
  - Replace the `_APP_URL` constant with `window.location.origin + '/'` so it derives from wherever the app is deployed
  - In the canvas share card (line 10232), use `new URL(window.location.href).hostname` instead of the hardcoded string
  - Update `landing.html` OG tags and `robots.txt` to use the production domain

---

### 3. Claude API key exposed in `window.S` (global state)
- **What**: The entire state object `S` — including `S.claudeKey` (the user's Anthropic API key) — is a plain global variable. Any injected script, browser extension, or XSS vector can read it via `window.S.claudeKey`. Anthropic's own header `anthropic-dangerous-direct-browser-access: true` signals this is discouraged.
- **Where**: `index.html:2517` (global `let S={...}`), `index.html:5022` (direct browser fetch with key in header)
- **Why it matters**: A stolen Anthropic key can run up hundreds of dollars in charges. Even self-hosted users trust the app not to leak their credentials.
- **Effort**: M
- **Suggested fix**:
  - Don't store the key in `S` at all; read it from `document.getElementById('set-claude-key').value` only at call time and never persist it in the state blob
  - Or wrap `S` in a module closure so it's not globally accessible: `const S = (() => { ... })()` — note this requires refactoring all `window.S` access points
  - Push users toward the proxy (`APP_CONFIG.aiProxy`) which keeps the key server-side; make that path the default onboarding CTA instead of the "paste your key" path

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Rebrand to Arete is incomplete — Givelink brand fully functional in production
- **What**: The `/givelink` route, the `renderGivelinkDash` view, `CATS.givelink` task category, `S.givelinkMetrics` / `S.givelinkHistory` state keys, and `givelink.html` (old sprint board) all survived the "Rebrand to Arete" commit. The sidebar can navigate to a "Givelink" dashboard; tasks created in the `givelink` category show `🟣 Givelink` in every user's category picker.
- **Where**: `vercel.json:4` (route), `index.html:2503` (CATS), `index.html:2517` (state), `index.html:8618` (`renderGivelinkDash`), `index.html:9569` (sidebar nav), `givelink.html`
- **Why it matters**: New users see a "Givelink" category and dashboard they don't understand. It muddies the Arete identity and leaves an orphaned page indexed by search engines.
- **Effort**: M
- **Suggested fix**:
  - Replace the `/givelink` rewrite in `vercel.json` with a 301 redirect to `/` and add `<meta name="robots" content="noindex">` to `givelink.html`
  - Rename `CATS.givelink` → `CATS.work` (or `CATS.startup`) with a migration that re-labels any existing tasks on load
  - Keep `S.givelinkMetrics` and `renderGivelinkDash` as a personal hidden view (e.g., accessible only via a URL hash `#givelink-dash`) rather than a sidebar nav item visible to all users

---

### 5. AI day plan hardcodes "Givelink Outreach" block for every user
- **What**: The focus day plan template hardcodes a `Givelink Outreach` block mapped to the `givelink` category. Every user who runs "Plan my day" gets a time block labelled "Givelink Outreach" in their schedule.
- **Where**: `index.html:4375`
- **Why it matters**: Arete users who have nothing to do with Givelink see a confusing, irrelevant block in their AI-generated day. It undermines trust in the AI feature on first use.
- **Effort**: S
- **Suggested fix**:
  - Remove the hardcoded `Givelink Outreach` block from the template
  - Replace with a dynamic block: find the user's highest-priority task in the `this-week` bucket and fill the slot with that task
  - If no task is found, use a generic "Deep Work" block without a category label

---

### 6. No rate limiting on the Claude proxy — unlimited API spend possible
- **What**: `api/claude.js` itself warns "add per-user rate limiting... so a single account can't run up your Anthropic bill" but this is unimplemented. Any authenticated user can make unlimited AI calls through the operator's API key.
- **Where**: `api/claude.js:13` (comment), `api/claude.js:38-48` (handler with no rate limit)
- **Why it matters**: A single power user or a compromised account can generate hundreds of dollars in Anthropic charges against the operator's key with no circuit breaker.
- **Effort**: M
- **Suggested fix**:
  - Add a per-user rate limit using the Supabase user ID already extracted at line 28 of `api/claude.js`; a simple in-memory Map works for single-instance Vercel serverless (resets on cold start), Upstash Redis is better for production
  - Suggested limit: 30 AI requests per user per hour; return HTTP 429 with a `Retry-After` header so the app can surface a useful message instead of a generic error

---

### 7. `seed()` inserts developer's personal task list for all non-hosted users
- **What**: The 356-line `seed()` function populates new users' inboxes with Panos's personal nonprofit/Givelink CRM tasks ("Nonprofits Board Follow Ups", "Song on Givelink", "Film AWG check", "Apply to moonshots gathering", Greek-language nonprofit tasks). Anyone who runs the app without a configured Supabase instance sees this data.
- **Where**: `index.html:4546-4902`
- **Why it matters**: OSS contributors and self-hosters see confusing personal content on first open; it also leaks internal pipeline strategy (prospect names, sales frameworks).
- **Effort**: M
- **Suggested fix**:
  - Replace with 10-15 generic demo tasks across the app's core categories (health, learning, work, relationships)
  - Move the Givelink-specific seed data to a separate private config file not committed to the public repo

---

### 8. Share card renders wrong URL into image pixels
- **What**: The progress share card canvas writes `Made with Arete · task-management-beige-eight.vercel.app` pixel-by-pixel into the image (line 10232). Users who share this card are advertising the staging Vercel URL — not the production domain.
- **Where**: `index.html:10232`
- **Why it matters**: Shared cards are the primary viral loop. Attaching the wrong URL kills referral traffic and looks unprofessional.
- **Effort**: S
- **Suggested fix**:
  - Once `_APP_URL` is fixed (P0 item 2), replace the hardcoded string with `'Made with Arete · ' + new URL(_APP_URL).hostname`

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. 14,924-line monolithic `index.html` — all JS, CSS, and HTML in one file
- **What**: 711 JavaScript functions, ~1,000 lines of CSS, and the full HTML structure are in a single file with no module boundaries. PR reviews are nearly impossible, merge conflicts are catastrophic, and browser caching of unchanged assets doesn't work.
- **Where**: `index.html` (entire file)
- **Why it matters**: Developer velocity is severely limited. Any future team contributor cannot work on separate features without constant conflicts. The file is genuinely unsalvageable as a monolith.
- **Effort**: L
- **Suggested fix**:
  - Extract CSS to `styles.css` first (isolated change, low risk)
  - Then extract logical JS modules by domain: `auth.js`, `ai.js`, `tasks.js`, `sync.js` — import via `<script type="module">`
  - Each extraction is an independent PR; don't attempt a big-bang rewrite

---

### 10. `save()` has no debounce on localStorage writes — 203 call sites
- **What**: Every user interaction calls `save()`, which synchronously runs `JSON.stringify(S)` (potentially megabytes) and writes to localStorage. With large datasets (health logs, finance, habits), this can jank on lower-end devices. The Supabase sync is debounced; the localStorage write is not.
- **Where**: `index.html:2578-2588` (save function), called 203 times throughout
- **Why it matters**: On data-heavy accounts, rapid-fire interactions (checking off habits, logging health) visibly stall the UI.
- **Effort**: S
- **Suggested fix**:
  - Wrap the `localStorage.setItem` call in a 50ms debounce timer inside `save()`
  - Keep the immediate `_sbScheduleSync()` call (Supabase scheduling) outside the debounce so sync timing is unaffected

---

### 11. Two modal systems coexist with inconsistent behavior
- **What**: The app has two separate modal implementations: `openModal(id)`/`closeModal(id)` (older, no focus trap) and `openM(id)`/`closeM(id)` (newer, has focus trap at line 4136). Mix of both systems across 30+ modals means some modals trap focus correctly and some don't.
- **Where**: `index.html:2819` (`openM`), `index.html:4136` (focus trap), scattered `closeModal` calls at lines 1594, 1611, 1640, 1675, 1713, 1753
- **Why it matters**: Keyboard-only users can tab out of older modals. Inconsistency means bugs appear only in specific modals, making them hard to catch.
- **Effort**: M
- **Suggested fix**:
  - Migrate remaining `openModal`/`closeModal` calls to `openM`/`closeM` (search for `closeModal(` — 6 occurrences)
  - Delete the old `openModal` / `closeModal` implementations

---

### 12. State loaded with no schema validation — corrupt data silently merges
- **What**: `load()` does `S = {...S, ...JSON.parse(d)}` with no type checking or schema validation. A value stored with the wrong type (e.g., `tasks: null` from a sync conflict) silently replaces the defaults and causes cryptic runtime errors downstream.
- **Where**: `index.html:2598`
- **Why it matters**: One corrupt localStorage entry can break the entire app. The `QuotaExceededError` is handled, but corrupt-but-valid JSON is not.
- **Effort**: M
- **Suggested fix**:
  - After `JSON.parse`, assert that critical fields have the right types: `if (!Array.isArray(loaded.tasks)) loaded.tasks = S.tasks`
  - Apply the same guard to `goals`, `habits`, `habitLogs`, and other arrays before spreading into `S`

---

### 13. `robots.txt` and sitemap point to staging domain
- **What**: `robots.txt` line 4 references `https://task-management-beige-eight.vercel.app/sitemap.xml`. Search engines parsing robots.txt will attempt to fetch the sitemap from the staging URL, not the production domain.
- **Where**: `robots.txt:4`
- **Why it matters**: SEO crawlers may not properly index the production domain's sitemap, hurting organic discovery.
- **Effort**: S
- **Suggested fix**:
  - Update `robots.txt` to reference the production domain's sitemap
  - Also update `sitemap.xml` if it contains staging URLs

---

### 14. README references files that don't exist (`CHANGELOG.md`, `CONTRIBUTING.md`, `package.json`)
- **What**: The README (updated this week in commit `5cd9437`) instructs users to run `npm ci`, `npm test`, and `npm run build`, but there is no `package.json` in the repo. It also links to `CHANGELOG.md` and `CONTRIBUTING.md` which don't exist.
- **Where**: `README.md:43-52, 62, 65`
- **Why it matters**: Contributors who follow the README instructions hit errors on the first command. Broken docs create a bad first impression for OSS users and potential hires.
- **Effort**: S
- **Suggested fix**:
  - Remove the `npm ci / npm test / npm run build` section (there are no build steps — the app is a static file)
  - Replace with accurate deploy instructions: `vercel deploy` or "open index.html in a browser"
  - Either create stub `CHANGELOG.md` / `CONTRIBUTING.md` files or remove the references

---

## 💡 P3 — Nice to have

### 15. Supabase refresh token stored in plain `localStorage`
- **What**: The Supabase refresh token (long-lived session credential) is stored in `localStorage` via `localStorage.setItem('taskos_sb_refresh', ...)`. Any same-origin script can read it. `httpOnly` cookies would be safer but require a server.
- **Where**: `index.html:9969, 10018`
- **Why it matters**: Stolen refresh tokens allow persistent account access. Medium risk for a personal productivity app; high risk if the app grows.
- **Effort**: L
- **Suggested fix**: Document this as a known risk; set a short `localStorage` TTL and call `_sbAuth('refresh_token')` proactively on each app open to rotate the token

---

### 16. `givelink.html` uses a completely different design system (blue/pink/navy)
- **What**: `givelink.html` uses a navy background (`#070d1a`), blue accent (`#3b82f6`), and pink (`#f472b6`) — none of which are in the Arete brand palette. If this page is ever shared or linked, it presents a second brand identity.
- **Where**: `givelink.html:16-19`
- **Why it matters**: If the Givelink page stays live, it should be either branded consistently or clearly identified as a separate internal tool.
- **Effort**: S
- **Suggested fix**: Either apply Arete's CSS variables or add a visible "Internal tool — not part of Arete" header

---

### 17. PostHog analytics `connect-src` may miss events on domain variation
- **What**: The CSP allows `https://us.i.posthog.com` and `https://us-assets.i.posthog.com` but PostHog routes events to `https://us.posthog.com` (no `.i.`) in some configurations. If PostHog updates their routing, analytics will silently drop.
- **Where**: `vercel.json:15`
- **Why it matters**: Silent analytics loss means conversion funnels and feature usage data become unreliable without any warning.
- **Effort**: S
- **Suggested fix**: Replace specific PostHog entries in `connect-src` with `https://*.posthog.com https://*-assets.i.posthog.com`
