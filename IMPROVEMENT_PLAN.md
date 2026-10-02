# Givelink / Arete — Improvement Plan

_Generated: 2026-10-02. Codebase snapshot: commit `160f0d8` (Sep 12 2026)._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Hardcoded default name "Panos" greets every new user

- **What**: Every new user without a saved name sees "Good morning, Panos 👋" on the dashboard.
- **Where**: `index.html:2519` — `let profileName=localStorage.getItem('taskos_name')||'Panos';`
- **Why it matters**: The first-impression greeting names the founder, not the user. Kills trust and looks like a shipped prototype. Comment at line 10458 even says "so it's never 'Panos'" but the fallback was never changed.
- **Effort**: S
- **Suggested fix**:
  - Change default to `'there'` or `''`
  - In the greeting render, handle empty: `'Good morning'+(profileName ? ', '+profileName : '')+' 👋'`
  - The onboarding wizard already captures the name — no additional UX work needed

---

### 2. CSP in `vercel.json` blocks Google Fonts — Inter fails to load in production

- **What**: The `font-src 'self'` directive in the Content Security Policy blocks the Inter font loaded from `fonts.googleapis.com` / `fonts.gstatic.com`, causing the app to fall back to system fonts in production.
- **Where**: `vercel.json:15` — `"font-src 'self'"` / `index.html:14-16` — `<link href="https://fonts.googleapis.com/css2?family=Inter…">`
- **Why it matters**: The entire app renders in a fallback system font in production. The typography is visually broken relative to local dev. Any user visiting the deployed app sees a degraded experience.
- **Effort**: S
- **Suggested fix**:
  - In `vercel.json` CSP header, change `font-src 'self'` → `font-src 'self' https://fonts.gstatic.com`
  - Add `https://fonts.googleapis.com` to `style-src` if the Google Fonts stylesheet is also blocked
  - One-line change; no code changes needed

---

### 3. Service worker references a broken icon path — push notifications show no icon

- **What**: `sw.js` references `'./icons/icon-192.png'` for notification icon and badge, but the file lives at `./icon-192.png` (no `icons/` subdirectory). Same wrong path in `index.html`.
- **Where**: `sw.js:46-47` — `icon:'./icons/icon-192.png', badge:'./icons/icon-192.png'` / `index.html:11289` — same path
- **Why it matters**: Push notifications silently render with no icon on all platforms. On Android this looks broken; on iOS it triggers a CSP warning and the notification may not display at all.
- **Effort**: S
- **Suggested fix**:
  - Change `'./icons/icon-192.png'` → `'./icon-192.png'` in both `sw.js` (lines 46-47) and `index.html` (line 11289)
  - Verify with Chrome DevTools > Application > Push messaging

---

### 4. No per-user rate limiting on the AI proxy

- **What**: Any signed-in user can exhaust the Anthropic bill — the proxy itself has a TODO comment admitting this.
- **Where**: `api/claude.js:13` — comment: "For production add per-user rate limiting (e.g. Upstash)"
- **Why it matters**: One heavy user or a leaked session token can generate hundreds of dollars in API charges per hour. The proxy caps `max_tokens` at 2000 but puts no limit on request count.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (e.g., 50 calls/user/hour) in the handler before the Anthropic fetch
  - Return HTTP 429 with a `Retry-After` header when limit exceeded
  - The client-side `callClaude` already handles 429 with a user-visible toast — no front-end changes needed

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Seeded tasks and Focus Planner show founder-specific Givelink work to all new users

- **What**: New user onboarding seeds tasks like "Nonprofits Board Follow Ups", "Greek Nonprofits Board (Make-A-Wish etc)", and hardwires a "Givelink Outreach" focus block in the daily planner.
- **Where**:
  - `index.html:4375` — Focus planner time block label: `'Givelink Outreach'`, `color:'#a78bfa'`
  - `index.html:4546,4552,4566,4602,4605,4619,4625,4629,4642` — `seedGoals()` creates a dozen Givelink-specific backlog tasks for every new account
- **Why it matters**: A new user lands in the app and immediately sees tasks about onboarding nonprofits to a platform they've never heard of. It's disorienting and undermines the "this is your personal OS" pitch.
- **Effort**: M
- **Suggested fix**:
  - Remove all Givelink-specific seeded tasks from `seedGoals()` (lines 4540–4645); replace with generic growth/business placeholders or skip seeding for those rows
  - In the focus planner template (line 4375), replace the hardcoded Givelink block with a generic "Deep Work" block using the user's own top task

---

### 6. "Givelink OS" dashboard and category visible to all users in the sidebar

- **What**: The sidebar navigation includes a "Givelink" category entry and a "🟣 Givelink" menu item linking to `givelink-dash`, which is a founder-only business metrics view.
- **Where**:
  - `index.html:9569` — `{id:'givelink-dash',e:'🟣',l:'Givelink'}` in the nav menu data
  - `index.html:2503` — `CATS` object includes `givelink:{l:'Givelink',e:'🟣'}` as a task category
  - `index.html:11929` — Security panel has a direct link to "Givelink OS →"
- **Why it matters**: New users see a mystery "Givelink" category and dashboard that means nothing to them. It clutters the navigation and exposes internal tooling publicly.
- **Effort**: S
- **Suggested fix**:
  - Gate the `givelink-dash` nav item behind a feature flag in `APP_CONFIG` (e.g., `APP_CONFIG.showGivelinkDash`) defaulting to `false`
  - Remove `givelink` from the `CATS` object or rename to a generic "Business" category
  - Remove the "Givelink OS →" link from the security panel

---

### 7. Standup generator in `givelink.html` reports tasks from two days ago, not yesterday

- **What**: `renderStandup()` sets "yesterday" as `getDate()-2` (two days ago), so tasks completed since yesterday morning are missed and reported as "nothing done."
- **Where**: `givelink.html:1561` — `yesterday.setDate(now.getDate()-2);`
- **Why it matters**: The daily standup is a core productivity feature. Reporting incorrect completed work undermines trust in the AI tooling and wastes the user's time correcting it.
- **Effort**: S
- **Suggested fix**:
  - Change `getDate()-2` → `getDate()-1`
  - One character change; verify by running a standup on a day where tasks were completed yesterday

---

### 8. App title bar shows "Arete — Panos" (user's name) permanently

- **What**: On auth success the title is updated to `'Arete — '+profileName` (line 9915), permanently showing the user's name in the browser tab and history.
- **Where**: `index.html:9915` — `document.title='Arete — '+n;`; also `index.html:10357`
- **Why it matters**: Browser history, shared screenshots, and OG previews expose the user's name. Many users share screens in meetings — this is a privacy UX issue. The tab title changing per-user also breaks bookmarked URLs.
- **Effort**: S
- **Suggested fix**:
  - Remove `document.title` mutation from the name-save path entirely; keep title as "Arete" throughout

---

### 9. `givelinkMetrics` / `givelinkHistory` pollute the global state object for all users

- **What**: The core state model `S` (line 2517) has `givelinkMetrics` (with `nonprofits`, `pipeline`, `arr`, `mrr`, `impactModel`) and `givelinkHistory` as top-level properties synced to Supabase for every user.
- **Where**: `index.html:2517` — the `let S = {...}` declaration
- **Why it matters**: Every user carries Givelink-specific fields in their synced state. This wastes storage, pollutes exports, and the Givelink-specific badges (lines 7068–7070) can never be earned by anyone but the founder.
- **Effort**: M
- **Suggested fix**:
  - Move `givelinkMetrics` and `givelinkHistory` to a separate localStorage key only read by the Givelink dashboard
  - Keep them out of the main `S` state object that all users export

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `index.html` is a 14,926-line monolith

- **What**: The entire application — CSS, data model, 40+ AI functions, all view renderers, and boot logic — lives in a single HTML file.
- **Where**: `index.html` (all 14,926 lines)
- **Why it matters**: Any change requires searching through 15K lines of minified inline code. There's no way to run tests, lint specific modules, or parallelize development. Every deploy ships the full file.
- **Effort**: L
- **Suggested fix**:
  - Start extracting: pull out `callClaude` + AI functions into `js/ai.js`, state model + persistence into `js/store.js`
  - The existing Vercel config already serves `api/claude.js` — the pattern for external JS files works
  - Don't do a full rewrite; extract the highest-churn sections first (AI functions, view renderers)

---

### 11. `innerHTML +=` in `givelink.html` causes unbounded duplicate stat cards on every re-render

- **What**: `renderVelocityStats()` appends two stat cards via `el.innerHTML +=` to an element that `renderOverview()` already populated. On each `refresh()` call (triggered by every task toggle), the cards stack up without bound.
- **Where**: `givelink.html:1625` — `el.innerHTML+=\`<div class="sc2">...`
- **Why it matters**: After toggling a few tasks done, the stats row grows to dozens of duplicate cards, breaking layout and leaking DOM nodes. The longer a user works, the more broken it gets.
- **Effort**: S
- **Suggested fix**:
  - Change `el.innerHTML +=` → `el.innerHTML =` to replace rather than append
  - Or call `el.innerHTML = ''` at the start of `renderVelocityStats()` before adding the cards

---

### 12. ~50+ silent `catch(e){}` blocks hide real bugs

- **What**: Throughout `index.html` and `givelink.html`, almost every try/catch uses an empty catch body, swallowing errors silently.
- **Where**: `givelink.html:1152`, `index.html:1328,2587,2949,2983,3868,3971,3979,5536,10115,10120` (and 40+ more)
- **Why it matters**: When a feature breaks in production, nothing surfaces. Users get a frozen UI and no error message. Developers have no signal to act on.
- **Effort**: M
- **Suggested fix**:
  - For user-facing catch blocks: at minimum `catch(e){ console.warn('[context]', e); }`
  - For critical paths (auth, sync, data load): call `toast()` with a user-friendly message
  - Empty catches around localStorage reads are acceptable — focus on network calls and render functions

---

### 13. `api/claude.js` uses a pinned model with no override mechanism

- **What**: The proxy hardcodes `'claude-haiku-4-5-20251001'` as the model for all server-side AI calls, with no way to upgrade without a code deploy.
- **Where**: `api/claude.js:44`
- **Why it matters**: When this model is deprecated, all AI features silently fail with no warning. No way to offer quality tiers without changing code.
- **Effort**: S
- **Suggested fix**:
  - `const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';`
  - Add `CLAUDE_MODEL` to the setup comment so operators know it exists

---

### 14. `localStorage` keys still use old `taskos_` prefix after rebrand to Arete

- **What**: All persistence keys (`taskos`, `taskos_name`, `taskos_guest`, `taskos_theme`, etc.) still use the old product name while the UI shows "Arete" everywhere.
- **Where**: `index.html:2519,2558,2598,2602,2628,2652,2668,2675` and dozens more
- **Why it matters**: Creates confusion during debugging; impossible to tell at a glance which keys belong to this app in devtools vs other apps using the same origin.
- **Effort**: M
- **Suggested fix**:
  - Define `const STORE_KEY = 'arete'` and do a one-pass find/replace
  - Add a migration in `load()`: if `localStorage.getItem('taskos')` exists, copy to `arete` key then remove the old one

---

### 15. Staging URL hardcoded in 6+ user-facing locations

- **What**: `task-management-beige-eight.vercel.app` appears in OG tags, canonical links, the sitemap, the app's share URL constant, and the footer of every generated shareable stats card.
- **Where**: `index.html:24,25,32,10180,10232`, `landing.html:11,16,17,21,25`, `sitemap.xml:4`
- **Why it matters**: All user-facing links and SEO metadata show the staging subdomain. Shareable progress cards (which users post publicly) will show the staging URL in the footer permanently.
- **Effort**: S
- **Suggested fix**:
  - Create a single `const APP_URL = 'https://...'` constant (can live in `APP_CONFIG`)
  - Replace all hardcoded subdomain strings with this constant in both HTML files
  - Update `sitemap.xml` with the canonical production URL

---

## 💡 P3 — Nice to have

### 16. PostHog analytics keys are empty — zero product insights

- **What**: Both `index.html:9960` (`posthogKey: ''`) and `landing.html:702` (`var POSTHOG_KEY = ''`) have empty PostHog keys. No product analytics, funnel, or feature flag data is being collected.
- **Where**: `index.html:9960`, `landing.html:702`
- **Effort**: S
- **Suggested fix**: Paste the PostHog project API key into both files. The client-side tracking code and `track()` function are already fully wired up — just needs the key

---

### 17. Stripe / payment onboarding is entirely absent — "paid plans" mentioned but no path

- **What**: Landing page FAQ says "If paid plans ever arrive, the core of what you use today stays free" — but there is zero Stripe integration, no pricing page, and no upgrade path.
- **Where**: `landing.html:593`
- **Effort**: L
- **Suggested fix**:
  - Even a simple "Join the waitlist for Arete Pro" email capture creates a list and signals intent
  - Or add a "Buy me a coffee" / GitHub Sponsors link for low-friction support
  - Update FAQ to be specific: "There's a waitlist for an optional Pro tier — [join here]"

---

### 18. Brand color palette in use differs from spec

- **What**: The app uses an indigo/violet palette (`#5a49e0`, `#8272f2`, `#8b5ce6`) which does not match the specified brand colors `#6B3FA0`/`#5718CA` (purple) or `#C2185B`/`#E353B6` (pink). The no-pink-on-purple rule is implicitly followed since pink is absent from the palette.
- **Where**: `index.html:45–58` (CSS custom properties)
- **Effort**: S (palette swap only) / M (if updating all hardcoded hex values)
- **Suggested fix**: Confirm the canonical palette; if switching to purple, update `--brand`, `--brand2`, `--brand-gradient`, and the logo SVG gradient stops

---

### 19. `givelink.html` uses "← Task OS" and "Sync to Task OS" — stale brand name in UI

- **What**: The back-link and sync button in `givelink.html` still say "Task OS" rather than "Arete".
- **Where**: `givelink.html:225` — `← Task OS` / `givelink.html:255` — `🔗 Sync to Task OS`
- **Effort**: S
- **Suggested fix**: Global find/replace "Task OS" → "Arete" in `givelink.html`

---

### 20. No 404 page configured in `vercel.json`

- **What**: Any path not explicitly configured (e.g., `/app`, `/dashboard`) returns the default Vercel 404 page with no branding or back-navigation.
- **Where**: `vercel.json` (no `"404"` route defined)
- **Effort**: S
- **Suggested fix**:
  - Create a minimal `404.html` branded as Arete with a "Go to app" CTA
  - Add `{ "source": "/((?!api/).*)", "destination": "/404.html", "statusCode": 404 }` to `vercel.json` after the existing rewrites

---

_Total: 20 items across 4 tiers. P0–P1 items are actionable without architectural changes. P2 items can be tackled incrementally. P3 items are low-risk quality-of-life improvements._
