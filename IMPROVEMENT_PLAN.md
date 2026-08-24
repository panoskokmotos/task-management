# Arete — Improvement Plan
_Generated: 2026-08-24_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. All AI prompts address users as "Panos" and pitch Givelink as context
**What**: 12+ AI feature prompts hardcode the name "Panos" and describe Givelink as the user's business, so every user receives advice tailored to the founder's life, not their own.  
**Where**: `index.html` lines 7849–7850, 9806–9807, 12186, 11415, 11516, 11524, 11672, 11734, 11810, 12945, 7319, 7477, 8604  
**Why it matters**: Any user who clicks "AI" features (triage, plan my day, relationships, self-knowledge, sleep analysis, brand audit, decisions) receives irrelevant, often confusing output that references a nonprofit fundraising SaaS they know nothing about. It actively erodes trust.  
**Effort**: M  
**Suggested fix**:
- Replace every hardcoded `'Panos — Greek founder...'` fallback with `getAboutMe()||'You'` (or a generic `'A focused individual...'`).
- For prompts that need a name (e.g. `give Panos:`, `for Panos`), substitute with `` `${profileName||'you'}` ``.
- Global search for `Panos` and `Givelink` in prompt strings and replace all occurrences. The generic fallback already exists at lines 5444, 5454, 5646, 5917 — replicate that pattern everywhere.

---

### 2. Morning push-notification fires "Good morning Panos!" to every user
**What**: `DEFAULT_REMINDERS` (seeded for every new account) contains `msg:'Good morning Panos! Check your One Thing and start focused work.'` and a second reminder: `msg:'Check your Givelink CRM — who needs a follow-up today?'`  
**Where**: `index.html` lines 11253–11259  
**Why it matters**: Every new user's 8 AM push notification announces another person's name and references a product they don't use. Likely to cause immediate uninstall.  
**Effort**: S  
**Suggested fix**:
- Replace `'Good morning Panos!'` with `` `Good morning${profileName?' '+profileName:''}!` `` (resolved at notification-fire time).
- Rename `r-crm` reminder to something generic (e.g. `r-crm-check`) and change the message to `'Check your CRM — who needs a follow-up today?'`, removing the Givelink reference.

---

### 3. Push notification icon path is broken
**What**: `sw.js` registers push notifications with `icon:'./icons/icon-192.png'` but no `icons/` directory exists; the actual file is `./icon-192.png`.  
**Where**: `sw.js` lines 47–48  
**Why it matters**: Every push notification shows a broken/blank icon on all platforms. On iOS this silently fails; on Android it may show a generic placeholder, undermining the "native app" feel.  
**Effort**: S  
**Suggested fix**:
- Change `'./icons/icon-192.png'` → `'./icon-192.png'` in both `icon` and `badge` fields.
- Same fix needed for `badge:'./icons/icon-192.png'`.

---

### 4. Default profile name falls back to "Panos" for signed-out or unconfigured users
**What**: `let profileName=localStorage.getItem('taskos_name')||'Panos'` and the dashboard HTML starts as `<h1 id="greeting">Good morning, Panos 👋</h1>`.  
**Where**: `index.html` lines 2519, 1070  
**Why it matters**: Any user who clears localStorage, uses a private window, or hasn't yet signed in sees "Good morning, Panos" before the JS has a chance to personalize it. This is the first thing a new user sees.  
**Effort**: S  
**Suggested fix**:
- Change fallback to `||''` or `||'there'`: `let profileName=localStorage.getItem('taskos_name')||'';`
- Update the static HTML greeting to `Good morning 👋` (name is injected by JS anyway).
- Update `_welcomeSeed()` comment on line 10458 still references "it's never 'Panos'" — confirm the fix propagates.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Givelink category, dashboard, and daily quests still visible to all users
**What**: `givelink` is still a selectable task category (CATS object), there's a reachable `givelink-dash` route, sidebar entry, and daily quest that references "Check Givelink CRM".  
**Where**: `index.html` lines 2503, 2507, 2984, 8618, 9569, 11151, 11929, 14311  
**Why it matters**: Commit #73 claimed to "fully separate" Givelink, but users still see a "🟣 Givelink" category when tagging tasks, a sidebar "Givelink" link, and a Givelink dashboard at `/index.html#givelink-dash`. This is confusing for new users and reveals the app's private-tool origins.  
**Effort**: M  
**Suggested fix**:
- Remove `givelink` from `CATS` (line 2503) and from the `wealth` area mapping (line 2507).
- Remove `'givelink-dash':renderGivelinkDash` from `renderView` and the sidebar entry (line 9569).
- Remove the `'Check Givelink CRM'` daily quest (line 11151) or replace with a generic CRM/network check.
- Migrate existing user data: on load, remap `category:'givelink'` to `category:'other'` with a one-time migration flag.

---

### 6. AI features are silently unavailable for most new users (no proxy configured)
**What**: `APP_CONFIG.aiProxy` is `''`, so all AI calls fall through to requiring a personal Anthropic API key. The landing page prominently advertises AI as a core feature.  
**Where**: `index.html` line 9959; `api/claude.js` (complete proxy ready but not wired)  
**Why it matters**: A new user clicks "Plan my day" on day 1 and gets a toast asking for an API key — a developer-facing concept completely opaque to typical users. The conversion from trial to engaged user likely drops sharply here.  
**Effort**: M  
**Suggested fix**:
- Deploy the Vercel proxy (`api/claude.js`) and set `APP_CONFIG.aiProxy` to the live URL.
- Add Upstash (or Vercel KV) rate-limiting as noted in the proxy's own comment (line 12–13 of `api/claude.js`): without it, a single user can exhaust the Anthropic budget.
- Until then, surface a friendlier gate: "AI features need a setup step — [Configure in 30 seconds]" instead of the raw API key prompt.

---

### 7. Service worker cache name must be manually bumped on every deploy
**What**: `const CACHE = 'arete-20260723'` is a hardcoded date string.  
**Where**: `sw.js` line 1  
**Why it matters**: If a deploy goes out without updating this string, returning users continue to receive the old cached HTML for all HTML pages. Given the network-first strategy for HTML this is partially mitigated, but static assets (icons, manifests) will stay stale indefinitely.  
**Effort**: S  
**Suggested fix**:
- Inject the cache name at build time using a Vercel env var or a simple hash of the build timestamp: `const CACHE = 'arete-BUILD_ID'` where Vercel substitutes `BUILD_ID`.
- Alternatively, use a short hash of a known changing asset (e.g. `sw.js` itself) as the version string.

---

### 8. No empty state or onboarding prompt when the AI proxy is missing
**What**: All AI-feature buttons silently toast "Add Claude API key in Settings first" — but there's no visible call-to-action linking them to the settings screen, and Settings is buried behind several taps.  
**Where**: `index.html` lines 5008, 5047, 5111 (and ~15 more `callClaude` call sites)  
**Why it matters**: Users who want to try AI features hit a dead end with no clear path forward. The onboarding tour doesn't mention API key setup.  
**Effort**: S  
**Suggested fix**:
- Replace the raw `toast()` call with a modal or sheet that says "AI needs a key — [Open Settings →]" and navigates directly on click.
- Add a one-time "AI setup" step in the first-run flow if `APP_CONFIG.aiProxy` is empty.

---

### 9. `givelinkMetrics` and `givelinkHistory` in the global state expose internal product data
**What**: The top-level state object `S` (line 2517) has `givelinkMetrics:{nonprofits:0,pipeline:0,arr:0,users:0,...}` and `givelinkHistory:[]`. These fields are synced to Supabase for every user account.  
**Where**: `index.html` line 2517  
**Why it matters**: Non-Panos users' Supabase rows will have these fields populated (empty) indefinitely, adding noise to the schema and making future Givelink removal harder.  
**Effort**: S  
**Suggested fix**:
- Remove `givelinkMetrics` and `givelinkHistory` from the default state object.
- Write a one-time migration in `load()` that strips these keys from existing saved data (or simply stop persisting them by omitting from the save payload).

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `index.html` is a 14,924-line monolith
**What**: The entire app — HTML, CSS (~2,500 lines), and JS (~12,000 lines) — is a single file. Functions like `seed()` span ~500 lines, and there are no module boundaries.  
**Where**: `index.html` (entire file)  
**Why it matters**: Any edit requires searching a file longer than most novels. Adding AI calls, new views, or bug fixes means hunting through thousands of lines. IDE tooling like jump-to-definition, refactoring, and linting are effectively useless.  
**Effort**: L  
**Suggested fix**:
- Extract CSS into `arete.css`.
- Extract JS into logical modules (`ai.js`, `sync.js`, `views/dashboard.js`, etc.) and bundle with Vite or esbuild.
- This is a L effort but every week deferred makes the next bug fix 10% slower.

---

### 11. Personal seed data (`seed()` and `seedGoals()`) still in production bundle
**What**: The `seed()` function (line 4532, ~400 lines) contains Panos's personal tasks including items in Greek, Givelink-specific work, and personal health appointments. `seedGoals()` seeds Givelink-specific goals (line 4932, 4970–4972). These are gated by `_hostedMode()` but still ship to every user's browser.  
**Where**: `index.html` lines 4532–4925, 4926–4975  
**Why it matters**: If `_hostedMode()` ever returns false (e.g. in a staging environment, offline-first test, or future config change), Panos's personal data is written into the user's localStorage. The personal data is also a privacy concern for Panos.  
**Effort**: M  
**Suggested fix**:
- Move `seed()` and `seedGoals()` behind a build-time flag so they're stripped from the production bundle entirely.
- Replace with a sanitized demo dataset that makes sense for any user.

---

### 12. `callClaude` sends API key in `Authorization` header when using proxy but silently drops errors
**What**: When the proxy call returns a non-ok status (e.g. 429, 502), `callClaude` toasts the error but returns `null`. Call sites often do `if(raw){...}` but rarely communicate the failure to the user beyond a toast. Toasts auto-dismiss in ~3 seconds and are easily missed.  
**Where**: `index.html` lines 5026–5033 and all call sites  
**Why it matters**: AI failures (rate limits, token budget exceeded, network errors) are invisible after the toast. Users click "Plan my day," nothing happens, and there's no retry path.  
**Effort**: S  
**Suggested fix**:
- Persist the last AI error to the output area (don't clear it on failure) so users can see what went wrong.
- Add a "Retry" button to the AI output areas for transient errors.
- Log AI failures to PostHog (when configured) to measure actual error rates.

---

### 13. Smart reminders `DEFAULT_REMINDERS` are seeded once and never updated when defaults change
**What**: `initReminders()` only seeds if `S.reminders` is empty (line 11261). If defaults change (as they should after fixing item #2 above), existing users keep the old broken messages.  
**Where**: `index.html` lines 11260–11265  
**Why it matters**: The "Good morning Panos!" fix (P0 item #2) won't reach existing users without a migration.  
**Effort**: S  
**Suggested fix**:
- Check for the specific stale reminder IDs (`r-morning`, `r-crm`) on load and patch their `msg` field if they haven't been manually edited by the user.
- Use a `reminderSchemaVersion` flag in state to know when to re-apply defaults.

---

### 14. No rate-limiting on the Claude API proxy
**What**: `api/claude.js` has a comment: "For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill." Currently there is none.  
**Where**: `api/claude.js` lines 12–13  
**Why it matters**: Once `aiProxy` is configured (P1 item #6), a single malicious or careless user could exhaust the Anthropic budget. There's no per-user daily cap.  
**Effort**: M  
**Suggested fix**:
- Add Upstash Redis rate limiting: 20 requests/user/day (configurable via env var).
- Return HTTP 429 with a clear message when the limit is hit.
- The proxy already validates the Supabase session; use the user's `sub` claim as the rate-limit key.

---

## 💡 P3 — Nice to have

### 15. PostHog analytics key is blank in both landing and app
**What**: `POSTHOG_KEY = ''` in `landing.html` (line 701) and `APP_CONFIG.posthogKey:''` in `index.html` (line 9960), so no analytics events are collected.  
**Where**: `landing.html` line 701; `index.html` line 9960  
**Why it matters**: The landing page has scroll-depth tracking, CTA click tracking, and demo-seen events — all wired up but firing into nowhere. Without this data there's no funnel visibility.  
**Effort**: S  
**Suggested fix**: Set both keys to the same PostHog project key (as noted in the landing page comment on line 697–699). Use a Vercel env var and inject at build time to avoid committing the key.

---

### 16. Canonical URL and OG image point to a Vercel preview URL, not a custom domain
**What**: `<link rel="canonical" href="https://task-management-beige-eight.vercel.app/">` and all OG/Twitter image URLs reference the same ugly Vercel URL.  
**Where**: `landing.html` lines 11, 16, 24, 25; `index.html` lines 24–32  
**Why it matters**: The canonical URL signals to search engines that the definitive URL is the Vercel preview. If a custom domain is ever set up, search equity won't transfer automatically.  
**Effort**: S  
**Suggested fix**: Set a custom domain in Vercel, then update canonical and OG URLs. Use a Vercel env var for the base URL to keep it consistent.

---

### 17. Footer SVG icon references gradient ID `#lg` that is only defined in the hero SVG
**What**: `landing.html` footer (line 634) uses the same SVG path as the nav logo but references `stroke="url(#lg)"` — a gradient defined in the first SVG on line 316. In a different browser rendering context or if the hero SVG is not rendered first, the footer icon renders as a transparent stroke.  
**Where**: `landing.html` line 634  
**Why it matters**: Footer logo may render invisible in some browsers (Firefox is stricter about cross-element gradient references).  
**Effort**: S  
**Suggested fix**: Add a `<defs>` block with the gradient directly inside the footer SVG, or give the gradient a unique ID (`lg2`) for the footer instance.

---

### 18. `sw.js` caches `manifest-givelink.json` — no longer needed
**What**: `STATIC` array in `sw.js` includes `'./manifest-givelink.json'` (line 6), which is the manifest for the separate Givelink PWA. This file will be cached for every Arete user unnecessarily.  
**Where**: `sw.js` line 6  
**Why it matters**: Minor: wastes one cache entry per install, and if the file is ever removed it will cause a non-fatal cache-install error (mitigated by `Promise.allSettled`).  
**Effort**: S  
**Suggested fix**: Remove `'./manifest-givelink.json'` from `STATIC` (or keep it only if Givelink shares the same origin).

---

### 19. `landing.html` has no `<meta name="robots">` tag or structured data for the app
**What**: While there is JSON-LD structured data in `landing.html` (line 24), it lists the canonical URL as the Vercel preview domain (see item #16). Also, there's no `robots.txt` entry specifically allowing the landing page.  
**Where**: `landing.html` line 25; `robots.txt`  
**Effort**: S  
**Suggested fix**: After setting custom domain (item #16), update structured data. Verify `robots.txt` allows all user-agent crawlers on `/`, `/index.html`, and `/landing.html`.

---

### 20. No `rel="noopener noreferrer"` on external links in the landing
**What**: The landing page has no external links currently, but internal `<a class="app-link">` elements use plain `href` without any security attributes. If external links are added later, the default behavior exposes `window.opener`.  
**Where**: `landing.html` throughout  
**Effort**: S  
**Suggested fix**: Add `rel="noopener noreferrer"` to any external link as a convention. Not a live bug today, but worth establishing as the landing grows.
