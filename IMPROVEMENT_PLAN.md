# Arete — Improvement Plan
_Generated 2026-09-09_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icon path is wrong — notifications silently broken
- **What**: The service worker references `./icons/icon-192.png` for push notification icons, but the file lives at `./icon-192.png`. No `icons/` directory exists.
- **Where**: `sw.js:47-48`
- **Why it matters**: Every web push notification shows a broken icon (or silently fails on stricter browsers). Users who opted in to reminders get no visual feedback.
- **Effort**: S
- **Suggested fix**:
  - Change `icon:'./icons/icon-192.png'` → `icon:'./icon-192.png'` (same for `badge`)
  - While there, verify the `notificationclick` handler URL resolves correctly on all platforms

### 2. AI features broken for every new user — aiProxy is empty
- **What**: `APP_CONFIG.aiProxy` is an empty string. The UI says "Add your Claude API key in Settings", but the onboarding doesn't surface this step. All AI features (triage, day planning, Quick Capture AI commands) silently fail for anyone who hasn't manually found the hidden settings field.
- **Where**: `index.html:9959` (`aiProxy: ''`), `index.html:4328`, `index.html:5007-5028`
- **Why it matters**: AI is the core value prop on the landing page ("AI that clears your inbox"). A new user who tries ⌘K → "Plan my day" immediately hits a dead end.
- **Effort**: M
- **Suggested fix**:
  - Either deploy `api/claude.js` and set `aiProxy` (preferred — one backend key, no friction)
  - Or surface the API key field prominently in the first-run flow, not buried in Settings
  - At minimum, make the error toast actionable: "No AI key — [Open Settings]" with a direct link

### 3. Personal tasks seeded for every new user account
- **What**: The `seed()` function injects ~200+ highly personal tasks into every new account, including tasks in Greek, personal health appointments ("Do a blood test", "Ακτινογραφία στα γόνατα"), financial details ("245€ in investments"), and personal relationship reminders ("Γενέθλια Σοφίας").
- **Where**: `index.html:4540–4760` (the entire `seed()` body)
- **Why it matters**: Every new real user who signs up sees someone else's personal backlog. This is a P0 retention killer — the app looks broken or hacked.
- **Effort**: S
- **Suggested fix**:
  - Replace personal seeds with neutral demo tasks (3–5 generic examples per bucket)
  - Or remove `seed()` entirely and rely on the first-run capture flow instead
  - Gate behind a `seededV2` flag that's already in state — just make sure real seeds never run

### 4. No rate limiting on the AI proxy — Anthropic bill exposure
- **What**: `api/claude.js` has a comment explicitly stating "For production add per-user rate limiting (e.g. Upstash)". No such limiting exists. Any authenticated user (or anyone if Supabase env vars aren't set) can fire unlimited requests.
- **Where**: `api/claude.js:13`, `api/claude.js:22-31`
- **Why it matters**: A single compromised session or a misbehaving client can drain the Anthropic API bill in minutes. `max_tokens` is capped at 2000 but request rate is unbounded.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (10 req/min per user is reasonable)
  - Or add a simple in-memory sliding window keyed on Supabase `uid` from the verified session
  - Log `uid` and `prompt.length` to Vercel logs at minimum so abuse is visible

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. OG/canonical URLs still point to old Vercel subdomain
- **What**: All Open Graph, Twitter Card, and canonical URL meta tags in both `index.html` and `landing.html` hardcode `task-management-beige-eight.vercel.app`. Social shares and SEO crawlers hit the wrong domain.
- **Where**: `index.html:24-25, 32`, `landing.html:11, 16-17, 21`
- **Why it matters**: Every shared link, every Google result, every social card shows the wrong URL. Clicking a social share card could redirect to a stale deploy or confuse returning users.
- **Effort**: S
- **Suggested fix**:
  - Replace all hardcoded URLs with the canonical production domain
  - Consider using a relative `/og-image.png` path so it works on any deployment

### 6. Notion integration broken in production — direct browser API call fails CORS
- **What**: Notion API is called directly from the browser (`fetch('https://api.notion.com/...')`), but Notion's API does not permit cross-origin requests from browsers. This will be blocked with a CORS error in every real browser.
- **Where**: `index.html:10940`
- **Why it matters**: The Notion integration (import weekly notes) is a visible feature in Settings. Users who configure their Notion token find it silently does nothing.
- **Effort**: M
- **Suggested fix**:
  - Proxy Notion requests through a serverless function (extend `api/claude.js` pattern)
  - Or remove the integration from the UI until a proxy is in place
  - Readwise at `readwise.io/api/v2` may have the same issue — verify their CORS policy

### 7. Analytics are completely disabled — zero product insight
- **What**: `APP_CONFIG.posthogKey` is an empty string. No events reach PostHog. There is no way to know which features users actually use, where they drop off, or whether the referral/share flows from recent PLG work convert at all.
- **Where**: `index.html:9960` (`posthogKey: ''`)
- **Why it matters**: The last 5+ commits were product-led growth investments (referrals, sharing, onboarding tour). Without analytics none of those bets can be measured or iterated on.
- **Effort**: S
- **Suggested fix**:
  - Add a PostHog project key to `APP_CONFIG.posthogKey`
  - Verify existing `track()` call sites fire correctly once the key is active

### 8. Givelink view/state remnants after separation PR
- **What**: PR #73 ("Remove Givelink from Task OS") separated the products, but `givelinkMetrics` and `givelinkHistory` remain in the main `S` state object, `renderGivelinkDash` is still registered in `renderView`, and the `givelink` category is still in `CATS` and `PILLARS`.
- **Where**: `index.html:2503` (`CATS`), `index.html:2507` (`PILLARS.wealth`), `index.html:2517` (`S` state — `givelinkMetrics`, `givelinkHistory`), `index.html:2984` (`renderView` map)
- **Why it matters**: Incomplete separation bloats every user's localStorage snapshot with Givelink-specific data. The sidebar may expose a "Givelink Dash" nav item to users who have no context for it.
- **Effort**: M
- **Suggested fix**:
  - Remove `givelinkMetrics`, `givelinkHistory` from the `S` default state
  - Remove `givelink-dash` from `renderView` if the view is now in `givelink.html`
  - Remove `givelink` from `CATS` or rename it to a generic "Work / Startup" category

### 9. Claude API key stored as plaintext in localStorage
- **What**: The user's Claude API key is stored in `S.claudeKey`, which is serialized to `localStorage` under `taskos`. Any JavaScript running on the page — including future third-party analytics or browser extensions — can read it.
- **Where**: `index.html:2517` (state default), `index.html:9916-9917` (settings save), `index.html:5022` (used in fetch)
- **Why it matters**: API key exposure can lead to unexpected Anthropic billing. `sk-ant-api03-*` keys have no scoping — a leaked key is a full-access key.
- **Effort**: M
- **Suggested fix**:
  - Store the key in a separate `localStorage` item (e.g. `taskos_claude_key`) outside the serialized state blob — this prevents it from appearing in sync payloads or exports
  - Ideally use the `aiProxy` pattern so no user key is needed at all

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `index.html` is 14,924 lines — a single unmaintainable file
- **What**: The entire app lives in one HTML file: all CSS (~1000 lines), all JavaScript (~13000 lines), and all markup. No modules, no bundler, no split.
- **Where**: `index.html` (entire file)
- **Why it matters**: Any change requires searching a 15k-line file. Merge conflicts are catastrophic. The browser must parse the entire file before first paint.
- **Effort**: L
- **Suggested fix**:
  - Extract CSS into `app.css` and load via `<link>` — instant win, no logic change
  - Extract JS into `app.js` loaded as a `<script type="module">` — then split by domain (tasks, goals, AI, sync)
  - Don't attempt a full rewrite — file-by-file extraction keeps the app working throughout

### 11. Service worker caches `givelink.html` but the app no longer links to it
- **What**: `sw.js` pre-caches `./givelink.html` in its `HTML` array. If `givelink.html` is moving to a separate product, the SW wastes install time and cache space on a page that may eventually be removed.
- **Where**: `sw.js:16`
- **Why it matters**: SW install failures due to a missing/renamed resource silently break offline support for all users.
- **Effort**: S
- **Suggested fix**:
  - Remove `'./givelink.html'` from the `HTML` cache list if it is no longer part of the Arete product
  - Add a smoke-check: ensure every cached URL returns 200 before the SW activates

### 12. `givelink.html` uses a completely separate color scheme (blue, not purple)
- **What**: `givelink.html` defines `--accent:#3b82f6` (blue), `--pr:#f472b6` (pink), `--op:#a78bfa`, with a dark navy `--bg:#070d1a`. No relation to Arete's purple/violet brand (`#5a49e0`, `#8272f2`).
- **Where**: `givelink.html:17-20`
- **Why it matters**: If users navigate between the two products, the visual whiplash signals these are unrelated tools. Brand inconsistency erodes trust.
- **Effort**: S
- **Suggested fix**:
  - Align `givelink.html` accent color with Arete's `#5a49e0` / `#8272f2` if the two products share branding
  - Or establish a deliberate secondary palette for Givelink and document it

### 13. Seeded backlog tasks include hundreds of stale personal items
- **What**: Beyond the P0 item (wrong seeds for new users), the `seed()` function itself contains ~150 personal backlog tasks that are out of date and specific to the developer's life situation.
- **Where**: `index.html:4540–4760`
- **Why it matters**: Maintaining this list is overhead. It also inflates localStorage from the start, and the personal nature of the tasks means they can never be useful demos.
- **Effort**: S
- **Suggested fix**:
  - Replace with 5–10 aspirational but generic example tasks that showcase the app's features
  - Or remove `seed()` entirely; the first-run brain-dump flow is a better onboarding anyway

---

## 💡 P3 — Nice to have

### 14. Light mode contrast — `--muted` on `--bg` fails WCAG AA
- **What**: In light mode, `--muted:#8a857b` on `--bg:#f7f6f3` yields a contrast ratio of approximately 3.8:1, below the 4.5:1 WCAG AA threshold for normal text. Used for subtitles, labels, and helper text throughout the app.
- **Where**: `index.html:53-59` (`:root body.light` variables)
- **Why it matters**: Users in bright environments or with moderate visual impairment will struggle to read secondary labels.
- **Effort**: S
- **Suggested fix**:
  - Darken `--muted` in light mode to `#6b6560` or similar (contrast ratio ~5.2:1)
  - Run through a contrast checker (e.g. https://webaim.org/resources/contrastchecker/) before shipping

### 15. `landing.html` canonical URL points to old Vercel subdomain (see P1 #5)
- **What**: Structured data JSON-LD in `landing.html` also hardcodes the old URL.
- **Where**: `landing.html:25` (JSON-LD `url` field)
- **Why it matters**: Google may index the wrong URL for rich search results.
- **Effort**: S
- **Suggested fix**: Update the JSON-LD `url` and `author` fields to reflect the production domain and brand name

### 16. Missing empty state for the Calendar view
- **What**: The `renderCalendar` view is registered in `renderView` but it is unclear whether it has an empty state for users with no scheduled tasks.
- **Where**: `index.html:2984` (view registration)
- **Why it matters**: A blank calendar with no guidance is confusing on first use.
- **Effort**: S
- **Suggested fix**: Add a contextual empty state: "No tasks scheduled this week — drag a task here to block time"

### 17. `vercel.json` not reviewed — no edge-cache or security headers
- **What**: The `vercel.json` configuration has not been audited for security headers (`Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`) or proper cache-control directives for the app shell vs. static assets.
- **Where**: `vercel.json` (root)
- **Why it matters**: Without `X-Frame-Options: DENY`, the app can be embedded in iframes (clickjacking risk). Without cache headers, Vercel's CDN may serve stale HTML after deploys.
- **Effort**: S
- **Suggested fix**:
  - Add `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` headers
  - Set `Cache-Control: no-store` for HTML pages, `max-age=31536000, immutable` for hashed static assets
