# Arete · Improvement Plan
_Generated 2026-08-05 from codebase audit_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. AI proxy is empty — every AI feature is broken for real users
- **What**: `APP_CONFIG.aiProxy` is an empty string, so every AI call falls through to the direct Anthropic path, which requires users to paste their own `sk-ant-*` key in Settings. The main value proposition ("AI that plans your day") is non-functional out of the box.
- **Where**: `index.html:9959` (`aiProxy: ''`) and gating checks at lines `4328`, `5047`, `5111`
- **Why it matters**: Every user who clicks "☀️ Plan my day", "Auto-triage", "Reply to act", or any AI Lab workflow hits "Add your Claude API key in Settings" — a cryptic dead end that kills the first impression and the core value loop.
- **Effort**: S
- **Suggested fix**:
  - Deploy `api/claude.js` to Vercel; set `ANTHROPIC_API_KEY` as a Vercel environment variable.
  - Paste the deployed URL into `APP_CONFIG.aiProxy`.
  - Add per-user rate limiting (see P2 item 3) before deploying publicly.

---

### 2. Personal seed tasks visible to every new user
- **What**: The `seed()` function populates the task list with the developer's own personal tasks — "Nonprofits Board Follow Ups," "Dex CRM," "Givelink Outreach," "Clawmetry for OpenClaw observability," etc.
- **Where**: `index.html:4537–4856` (the `seed()` function)
- **Why it matters**: New users open the app and immediately see someone else's private work. It signals the app is a personal project, not a product, and destroys trust and first-run relevance.
- **Effort**: S
- **Suggested fix**:
  - Replace personal tasks with a small set of generic example tasks that illustrate the product (3–5 tasks across categories like Health, Work, and Personal).
  - Or remove seed tasks entirely and let the first-run brain-dump flow fill the initial state.

---

### 3. Service worker references wrong push-notification icon path
- **What**: `sw.js` references `./icons/icon-192.png` (lines 47–48) for push notification icons, but the actual file lives at `./icon-192.png` — there is no `icons/` subdirectory in the repo.
- **Where**: `sw.js:47–48`
- **Why it matters**: Every push notification on Android shows a broken placeholder icon instead of the Arete logo, undermining the brand trust of this specific engagement channel.
- **Effort**: S
- **Suggested fix**:
  - Change `./icons/icon-192.png` → `./icon-192.png` (two occurrences: `icon` and `badge` fields in `showNotification`).

---

### 4. Analytics are fully disabled — no funnel visibility
- **What**: `APP_CONFIG.posthogKey` is `''` (disabled) in `index.html`, and `POSTHOG_KEY` is also `''` in `landing.html`. All `track()` calls are silent no-ops.
- **Where**: `index.html:9960`, `landing.html:699–703`
- **Why it matters**: There is no visibility into the landing → first-run → signup funnel. Cannot measure which CTAs convert, where users drop off, or whether any recent changes improved or hurt metrics.
- **Effort**: S
- **Suggested fix**:
  - Set `APP_CONFIG.posthogKey` in `index.html` to the real PostHog project key.
  - Set the matching `POSTHOG_KEY` in `landing.html` to the same key (same project, same origin = landing → signup funnel auto-connects).

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Hard-coded "Panos" in the greeting and profile name
- **What**: `profileName` is initialised to `'Panos'` at `index.html:2519`. Every new guest user is greeted "Good morning, Panos 👋".
- **Where**: `index.html:2519` (`let profileName=localStorage.getItem('taskos_name')||'Panos';`)
- **Why it matters**: Signals the app is a personal tool, not a product. Creates immediate cognitive dissonance for any real user.
- **Effort**: S
- **Suggested fix**:
  - Change the fallback to `'there'` → "Good morning, there 👋" — neutral and friendly.
  - On sign-in, pull the user's display name from Supabase and persist it.

---

### 6. Auth gate has no "Forgot password?" option
- **What**: The sign-in card (`index.html:878–880`) has an email + password form with no way to recover a forgotten password. `authMagic()` exists as a magic-link flow but is only exposed as "Email me a magic link instead" — easily missed.
- **Where**: `index.html:878–884` (auth gate card)
- **Why it matters**: Users who forget their password cannot recover their account and churn permanently, despite having a functional recovery path in the codebase.
- **Effort**: S
- **Suggested fix**:
  - Add a small "Forgot password?" link beneath the password input that calls `authMagic()` with the email pre-filled.
  - Relabel the `authMagic` button more clearly: "Reset password / magic link".

---

### 7. No mobile navigation on the landing page
- **What**: `.nav-links` is hidden on screens under 760px (`landing.html:291`) with no hamburger menu, anchor links, or alternative navigation. Mobile visitors can only use the primary "Start free →" CTA.
- **Where**: `landing.html:291–292` (mobile media query)
- **Why it matters**: Mobile visitors cannot navigate to #features, #faq, or #trust sections. Users with doubts can't self-serve answers, reducing conversion.
- **Effort**: M
- **Suggested fix**:
  - Add a `<details>` or slide-down mobile menu with the same 5 anchor links.
  - Or make the section headers sticky enough that scroll alone is sufficient — add a "Back to top" link at the bottom of each section.

---

### 8. OG/canonical URLs still point to the Vercel developer subdomain
- **What**: `og:url`, `og:image`, `twitter:image`, and `<link rel="canonical">` all reference `https://task-management-beige-eight.vercel.app/` — the auto-generated Vercel slug, not a branded domain.
- **Where**: `index.html:24–32`, `landing.html:11, 17–21`
- **Why it matters**: When pages are shared on social media or indexed by Google, the Vercel dev URL appears. Google may split link equity across both URLs.
- **Effort**: S
- **Suggested fix**:
  - Replace with a permanent custom domain (e.g. `areteapp.io`) across both files.
  - Update the `og-image.png` alt text and `og:site_name` too.

---

### 9. "Givelink" category surfaces in task creation dropdowns
- **What**: `CATS` at `index.html:2503` still includes `givelink:{l:'Givelink',e:'🟣'}`, and it appears in the task/goal category `<select>` elements in every modal. The `renderView` dispatch table also still has `'givelink-dash':renderGivelinkDash`.
- **Where**: `index.html:2503`, `2507`, `2984`, `4375`, and every task modal's `<select>` element
- **Why it matters**: Users creating tasks see "Givelink" as a category option — a confusing ghost of a previous product. It breaks the rebrand to Arete.
- **Effort**: M
- **Suggested fix**:
  - Remove `givelink` from `CATS` and the `wealth.cats` array.
  - Replace existing tasks that have `category:'givelink'` with `category:'other'` in a migration function run once on `load()`.
  - Remove `'givelink-dash': renderGivelinkDash` from `renderView`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. No per-user rate limiting on the AI proxy
- **What**: `api/claude.js` itself documents the risk (line 12): _"For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."_ There is no throttle, no quota, and no abuse protection.
- **Where**: `api/claude.js:12–49`
- **Why it matters**: Once `aiProxy` is enabled (P0 fix #1), a single logged-in user can fire hundreds of Claude API calls, running up significant costs. A malicious actor with a valid Supabase session can automate this.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting: 20 AI calls per user per hour.
  - Return `429` with a `Retry-After` header; the app already handles 429 with a friendly toast at `index.html:5028`.
  - Alternatively, cap `max_tokens` more aggressively (current max: 2000) and add a daily per-user token budget.

---

### 11. `index.html` is a 14,924-line monolith
- **What**: All CSS (~700 lines), HTML structure, and ~13,000 lines of JavaScript live in a single file. There is no module system, no bundler, and no way to test any function in isolation.
- **Where**: `index.html` (entire file)
- **Why it matters**: Adding a feature now means scrolling through 15k lines. Finding a bug means grepping a giant wall. There are no unit tests; subtle regressions are invisible until a user reports them. Every deploy ships the entire app file with no cache benefits for individual modules.
- **Effort**: L
- **Suggested fix**:
  - Start extracting the largest, most self-contained modules: AI functions (`callClaude` onwards, ~3,000 lines), rendering helpers, and the Supabase sync layer.
  - Use native `<script type="module">` — Vercel and modern browsers support it without a build step.
  - Extract CSS into a separate `app.css` served with a long cache TTL.

---

### 12. Dual API key storage paths for Claude key
- **What**: The app checks both `S.claudeKey` (persisted in the main state blob) and `localStorage.getItem('taskos_api_key')` at `index.html:11670`. This is a leftover from a key migration that was never cleaned up.
- **Where**: `index.html:11670`
- **Why it matters**: The `taskos_api_key` path is a dead branch since `S.claudeKey` is the canonical store. This creates confusion when debugging why AI isn't working and could cause subtle inconsistencies for users who set the key before the migration.
- **Effort**: S
- **Suggested fix**:
  - Remove the `taskos_api_key` check; if it contains a key, migrate it to `S.claudeKey` on `load()` then delete it.

---

### 13. Service worker caches the abandoned `givelink.html` page
- **What**: `sw.js:17` lists `'./givelink.html'` in the HTML cache manifest. This page (~1,755 lines) is a separate product's landing page, presumably deprecated.
- **Where**: `sw.js:13–18`
- **Why it matters**: Every Arete install downloads and stores `givelink.html` in its offline cache, wasting ~50KB of storage on an irrelevant page. It also keeps the service worker cache name stale when unrelated content changes.
- **Effort**: S
- **Suggested fix**:
  - Remove `'./givelink.html'` from the `HTML` array in `sw.js`.
  - Bump `CACHE` version to `'arete-20260805'` so clients pick up the change.

---

## 💡 P3 — Nice to have

### 14. Landing page and app use separate PostHog tracking stubs
- **What**: `landing.html` has its own PostHog init snippet (lines 697–729) that is separate from the app's `_initPostHog()`. Because both are configured with the same key and same `localStorage` persistence, the funnel should connect — but only if both keys are actually set (currently both are empty; see P0 item 4).
- **Where**: `landing.html:697–729`, `index.html:10389–10400`
- **Why it matters**: Once the key is set, verify the `distinct_id` carries over from landing → app so that `landing_cta_click` → `task_created` attribution works correctly.
- **Effort**: S
- **Suggested fix**: After setting the PostHog key (P0 fix #4), test in PostHog's person activity view that a single session goes from `landing_view` → `landing_cta_click` → `firstrun_organized`.

---

### 15. First-run "Organize my day" creates false AI expectation
- **What**: The button says "Organizing your day…" with a pulse animation, implying AI is at work. The actual logic is a fast local heuristic (date parsing + sorting). Once users are inside the app and click a real AI button, they see "Add your Claude API key in Settings" — a jarring drop.
- **Where**: `index.html:965, 10521–10564`
- **Why it matters**: Creates expectation mismatch between the first-run magic moment (feels like AI, is instant, works great) and subsequent AI features (broken until key is set). Once the AI proxy is live (P0 fix #1), this becomes less of an issue, but the copy should still be accurate.
- **Effort**: S
- **Suggested fix**:
  - Change the loading copy to "Sorting your day…" or "Building your plan…" to avoid over-claiming AI involvement.
  - After sign-in, surface a "Try AI: Plan my day" prompt to introduce the real AI feature naturally.

---

### 16. Hardcoded structured data author name in landing page
- **What**: `landing.html:25` has `"author":{"@type":"Person","name":"Panos"}` in the `application/ld+json` schema. This is fine for an indie product but the same name issue as P1 item 5.
- **Where**: `landing.html:25`
- **Why it matters**: Minor — affects how search engines display the app's schema. Low priority.
- **Effort**: S
- **Suggested fix**: Change `"name":"Panos"` to `"name":"Panos Kokmotos"` or a company entity if the product is positioned as a company.

---

### 17. Eisenhower "Delegate" quadrant headers hidden on mobile without explanation
- **What**: `index.html:342` hides Eisenhower grid labels/headers (elements 1–4 and 7) on mobile. Users don't see any context for which quadrant is which when the grid collapses.
- **Where**: `index.html:342` (`.eg>div:nth-child(1),.eg>div:nth-child(2)...{display:none}`)
- **Why it matters**: Removes the axis labels that give the Eisenhower matrix its meaning on the device where most users likely capture tasks.
- **Effort**: S
- **Suggested fix**: Instead of hiding labels, show abbreviated versions inside each quadrant header (e.g., "🔴 Do First" label pinned at top of each `.eq`).

---

_Max 20 items — ordered by ROI within each tier._
