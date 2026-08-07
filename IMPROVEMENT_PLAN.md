# Arete — Improvement Plan
_Generated: 2026-08-07_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. API proxy is completely open to the internet when SUPABASE_URL env var is absent
**What:** The auth guard in `api/claude.js` is wrapped in `if (process.env.SUPABASE_URL)`. If that environment variable is not set on the Vercel deployment, the proxy accepts requests from anyone on the internet with no authentication whatsoever.

**Where:** `api/claude.js:22–30`

**Why it matters:** The Anthropic API key is billed per token. An open proxy that gets discovered (or indexed by bots) can run up hundreds of dollars before the operator notices. This is a budget-burning hole, not a theoretical risk.

**Effort:** S

**Suggested fix:**
- Verify `SUPABASE_URL` is set in Vercel environment variables — if not, set it now
- Alternatively, always require auth regardless of env var: remove the `if (process.env.SUPABASE_URL)` wrapper and make the Supabase token check unconditional
- Add an explicit startup check: `if (!key) throw new Error('ANTHROPIC_API_KEY required')` to fail loudly on misconfiguration

---

### 2. "Panos" hardcoded as default name across 15+ AI prompt templates
**What:** Every new user who hasn't set their profile name receives AI suggestions explicitly written for "Panos, a Greek founder in his 20s building Givelink, targeting financial freedom and a move to San Francisco" — including routine notifications, AI coaching, brand audits, and decision-making prompts.

**Where:** `index.html:2519` (default profileName), `index.html:1070` (initial DOM greeting), `index.html:11254` (morning routine message), `index.html:5445, 5647, 5920, 7319, 7477, 7849, 7850, 8604, 9806, 9807, 11415, 11416, 11516` (AI prompt strings)

**Why it matters:** Any real user who signs up gets AI output personalized to someone else. This actively breaks trust and signals the app isn't ready for multi-user use.

**Effort:** M

**Suggested fix:**
- Replace `||'Panos'` in `profileName` default with `||'you'` or prompt the user to set their name during onboarding
- Audit every AI prompt template: replace all hardcoded `"Panos"`, `"Givelink"`, `"SF move"` with `${profileName}` / `${getAboutMe()}` interpolation
- Add a guard at `_startFirstRun()` that blocks AI features if `getAboutMe()` is empty — prompt to fill it first

---

### 2. Personal task seeded into every new user's backlog
**What:** The seed data function `_seedStarter()` injects a task `'Unsubscribe from things I don\'t want (Superhuman for panagiotis email?)'` into every new user's task list.

**Where:** `index.html:4653`

**Why it matters:** New users land in the app with a task that refers to someone else's email address. Immediate loss of trust.

**Effort:** S

**Suggested fix:**
- Delete or replace line 4653 with a generic task (e.g. `'Review and unsubscribe from unused email lists'`)
- Audit the full `_seedStarter()` function (~lines 4540–4770) for other personal tasks or goal seeds that reference Panos's specific situation

---

### 3. AI proxy not connected — AI features silently unavailable for all hosted users
**What:** `APP_CONFIG.aiProxy` is an empty string (`''`). The proxy endpoint exists at `/api/claude` (deployed and valid) but the config line that points to it is blank. All AI features gate on `S.claudeKey || APP_CONFIG.aiProxy` — with both empty, users see a toast "Add your Claude API key in Settings to use AI commands" instead of AI working.

**Where:** `index.html:9959` (`aiProxy: ''`), `api/claude.js` (exists and works)

**Why it matters:** Every AI feature — day planning, inbox triage, habit coaching, brand audit, etc. — is broken for any user who hasn't added their personal Anthropic key. The proxy exists to solve this but isn't wired up.

**Effort:** S

**Suggested fix:**
- Set `aiProxy: '/api/claude'` (relative URL so it works on any domain) or the full Vercel URL
- Confirm `ANTHROPIC_API_KEY` is set in Vercel environment variables
- If `SUPABASE_URL` env var is also set, auth-gating on the proxy already works — no additional change needed

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. No rate limiting on the API proxy — single user can exhaust the Anthropic budget
**What:** `api/claude.js` has no per-user rate limiting. Any authenticated user can loop calls and run up the Anthropic bill. The comment on line 12–13 explicitly calls this out but it was never implemented.

**Where:** `api/claude.js:12-13, 38-48`

**Why it matters:** One power user or a scraper with a valid session token can cost hundreds of dollars before you notice.

**Effort:** M

**Suggested fix:**
- Add Upstash Redis rate limiting (their Vercel integration is one env var): 20 requests/user/hour is a safe starting point
- Alternatively, use a simple in-memory sliding-window keyed by `uid` from the Supabase token (acceptable for a single-instance function; not distributed-safe)
- Surface a 429 response with `Retry-After` header so the client can show a useful message instead of a generic error

---

### 5. Landing page canonical URL points to Vercel-generated domain
**What:** The landing's `<link rel="canonical">`, `og:url`, `twitter:url`, and JSON-LD `url` all hardcode `https://task-management-beige-eight.vercel.app/` — a Vercel project slug, not a real brand domain. The JSON-LD `author` field also hardcodes `"name":"Panos"`.

**Where:** `landing.html:11` (canonical), `landing.html:14` (og:url), `landing.html:16` (twitter:url), `landing.html:25` (JSON-LD)

**Why it matters:** Google indexes the Vercel slug as the canonical URL, splitting SEO equity if a custom domain is ever added. The personal author name in JSON-LD is a minor embarrassment if scraped.

**Effort:** S

**Suggested fix:**
- Replace the Vercel URL with the real custom domain in all four places
- Change `"author":{"@type":"Person","name":"Panos"}` to `"author":{"@type":"Organization","name":"Arete"}`
- If a custom domain isn't configured yet, add it first (free on Vercel) — this is the prerequisite

---

### 6. API proxy `max_tokens` cap of 2000 truncates complex AI responses
**What:** `Math.min(parseInt(body.max_tokens) || 1000, 2000)` hard-caps responses at 2000 tokens. Features like the Brand Audit, Weekly Review digest, and Know Thyself analysis generate responses that frequently hit this ceiling mid-sentence.

**Where:** `api/claude.js:35`

**Why it matters:** Truncated AI responses feel broken and erode trust in the AI features — the ones most likely to drive user retention.

**Effort:** S

**Suggested fix:**
- Raise the server-side cap to `8000` (well within Haiku's context)
- Let individual client call sites pass `max_tokens` appropriate to the feature (e.g., 500 for quick suggestions, 4000 for brand audits)
- Consider using `claude-sonnet-5` or similar for the long-form features (brand audit, weekly digest) instead of Haiku globally

---

### 7. 71 empty catch blocks silently swallow all errors
**What:** There are 71 occurrences of `catch(e){}` with no logging or user feedback throughout the app — covering auth, sync, rendering, and AI calls.

**Where:** `index.html` (71 instances; search `catch\s*(e)\s*\{\}`)

**Why it matters:** When something breaks — a Supabase sync failure, a rendering error, an AI call timeout — the user sees nothing. Bugs are invisible to the developer too.

**Effort:** L

**Suggested fix:**
- In critical paths (auth, save, Supabase sync, AI calls): at minimum `console.warn(e)` so errors surface in devtools
- For user-facing failures: replace silent swallows with `toast('Something went wrong. Try again.')` + a `track('error', {fn: 'functionName', msg: e.message})` PostHog event
- Low-risk cosmetic catches (haptic, confetti, emoji rendering) can remain silent

---

### 8. `givelink.html` is stale old-brand content still being actively cached
**What:** After the rebrand to "Arete", `givelink.html` (1755 lines of old content) remains in the SW cache list and is served at `/givelink`. The service worker actively pre-caches it on every install.

**Where:** `sw.js:16` (`'./givelink.html'`), `vercel.json:4` (`"/givelink"` route), `givelink.html`

**Why it matters:** Users landing on `/givelink` see outdated product framing. The stale HTML is also wasting cache storage on users' devices.

**Effort:** S

**Suggested fix:**
- Either update `givelink.html` to match the current Arete brand, or add a Vercel redirect: `{ "source": "/givelink", "destination": "/", "permanent": true }`
- Remove `'./givelink.html'` from the SW static cache list
- Remove `'./manifest-givelink.json'` from the SW static cache too (sw.js:4)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. Supabase project URL and anon key hardcoded in frontend JS
**What:** `APP_CONFIG.supabaseUrl` and `APP_CONFIG.supabaseAnon` are hardcoded strings in `index.html:9957–9958`. The anon key comment says "safe in the browser; RLS protects data" — true, but only if RLS is actually configured correctly in every table.

**Where:** `index.html:9957` (`supabaseUrl`), `index.html:9958` (`supabaseAnon: 'sb_publishable_...'`)

**Why it matters:** If RLS has any misconfiguration (a common oversight), the hardcoded anon key becomes a direct path to all user data. Rotating the key requires a code deploy. The Supabase project ID in the URL is also exposed, making the project a target for enumeration attacks.

**Effort:** S

**Suggested fix:**
- Keep the anon key in the frontend (it's designed for this) but add a comment documenting which tables have RLS enabled
- Verify `supabase-setup.sql` enables RLS and has correct policies on all tables — if not, add them
- Consider moving the URL+key to a build-time substitution (even a simple search-replace in CI) so they're not in version control

---

### 10. `api/claude.js` uses `anthropic-version: 2023-06-01` — very outdated
**What:** The API proxy sends `'anthropic-version': '2023-06-01'` on every request. This is the oldest supported version header.

**Where:** `api/claude.js:40`

**Why it matters:** Some newer API capabilities (extended thinking, tool use improvements) require a more recent version header. Old version headers may be deprecated eventually.

**Effort:** S

**Suggested fix:**
- Update to `'anthropic-version': '2025-01-01'` or check the Anthropic docs for the current recommended version
- Test that existing features still work after the header change (they should — the API is backward-compatible)

---

### 11. Service worker cache name is a hardcoded date string
**What:** `const CACHE = 'arete-20260723'` in `sw.js:1`. When code changes, the cache is only busted if someone remembers to update this string manually.

**Where:** `sw.js:1`

**Why it matters:** If the SW cache name is not bumped after a deploy, users get stale HTML/JS from cache — "why isn't my fix showing up" class of bugs.

**Effort:** S

**Suggested fix:**
- Either automate the cache-busting string via a CI step (e.g., `CACHE = 'arete-' + BUILD_HASH`)
- Or add a comment reminding to bump the date before each deploy
- Consider removing `'./index.html'` from HTML cache entirely and relying on network-first for the main document — the SW already does network-first for HTML pages (sw.js:83–93), so pre-caching the main HTML is redundant

---

### 12. Many inline hex colors scattered outside the CSS variable system
**What:** Throughout `index.html`, colors like `#ef4444`, `#fbbf24`, `#58a6ff`, `#22d3ee`, `#69db7c`, `#74c0fc`, `#fbbf24`, `#69db7c` appear as inline styles or hardcoded CSS values rather than using the established CSS variable tokens (--q1, --q2, --q3, --brand, etc.).

**Where:** `index.html:1080, 1121, 1144, 1474, 2187, 5221–5223, 9877` and ~40 more instances

**Why it matters:** Theme switching (light/dark) doesn't apply to these values. The app has a complete CSS variable system that's simply not being used consistently.

**Effort:** M

**Suggested fix:**
- Audit inline `color:#` and `background:#` values and map them to existing CSS tokens
- `#ef4444` → `--danger` (define if missing), `#fbbf24` → `--q3` or `--warm`, `#58a6ff` → `--accent`
- At minimum fix high-visibility instances: the offline pill (line 847), checklist badge (line 1080), and dashboard stat cards

---

### 13. `save()` has no error handling for localStorage quota exceeded
**What:** `function save()` at `index.html:2578` writes the entire state object to localStorage with no try/catch. If the quota is exceeded (common with large task lists + logs + photos), the write silently fails and the next page load reverts to the last saved state.

**Where:** `index.html:2578`

**Why it matters:** A power user with months of data can suddenly "lose" their last hour of work with no warning.

**Effort:** S

**Suggested fix:**
- Wrap the `localStorage.setItem` call in try/catch
- On `QuotaExceededError`: toast a clear warning "Storage almost full — sync to Supabase or export your data"
- Optionally: prune the oldest `photoLogs`, `contextLog`, or `habitLogs` entries automatically when near quota

---

## 💡 P3 — Nice to have

### 14. API proxy model is hardcoded to Haiku for all features
**What:** `api/claude.js:42` hardcodes `model: 'claude-haiku-4-5-20251001'` for every request regardless of the feature's complexity requirements.

**Where:** `api/claude.js:42`

**Effort:** S

**Suggested fix:**
- Accept an optional `model` parameter from the client, validated against a whitelist: `['claude-haiku-4-5-20251001', 'claude-sonnet-5']`
- Use Haiku as the default, Sonnet for brand audit / weekly review / know thyself analysis
- This has a cost impact but meaningfully improves quality for the retention-driving features

---

### 15. Landing-to-app CTA uses `/index.html` path instead of a clean URL
**What:** Landing page CTAs link to `href="/index.html"` (lines 327, 338). The app works fine, but the URL is less clean than `/app` or just showing the app at the root after auth.

**Where:** `landing.html:327, 338`

**Effort:** S

**Suggested fix:**
- Add a Vercel rewrite: `{ "source": "/app", "destination": "/index.html" }` and update the CTA `href` to `/app`
- Alternatively, route `/` to the app (not the landing) for logged-in users by detecting a Supabase session cookie server-side

---

### 16. PostHog key is empty — analytics are completely dark
**What:** `posthogKey: ''` at `index.html:9960`. All `track()` calls are no-ops. There are no analytics events firing on any user action.

**Where:** `index.html:9960`

**Why it matters:** Without analytics, there is no data on which features users actually use, where they drop off, or whether any growth experiments are working.

**Effort:** S

**Suggested fix:**
- Paste the PostHog project key (safe to include in frontend JS) into `posthogKey`
- Confirm the PostHog host (`posthogHost`) matches the project region

---

### 17. `manifest-givelink.json` is still in the SW asset list
**What:** The service worker pre-caches `./manifest-givelink.json` (line 4 of sw.js), which references old Givelink brand assets.

**Where:** `sw.js:4`

**Effort:** S (remove the entry and bump the cache name)

---

### 18. Push notification icon path doesn't match cached assets
**What:** The service worker push handler specifies `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'`, but the actual asset in the STATIC cache list (and in the repo) is at `./icon-192.png` (no `icons/` subdirectory). Every push notification displays a broken icon.

**Where:** `sw.js:46–47` (push handler icon path) vs `sw.js:7` (actual cached path `'./icon-192.png'`)

**Why it matters:** Push notifications are the re-engagement mechanism for the app. Broken icons make them look unprofessional and reduce tap-through rates.

**Effort:** S

**Suggested fix:**
- Change `icon: './icons/icon-192.png'` to `icon: './icon-192.png'` in the push handler
- Same for the `badge` field
- Verify with a test push after deploying

---

### 19. `'unsafe-inline'` in script-src disables CSP's XSS protection entirely
**What:** `vercel.json` sets `"script-src 'self' 'unsafe-inline' ..."`. The `'unsafe-inline'` directive means any inline script tag on the page can run — which is the exact class of injection CSP is designed to block. The entire XSS protection of the policy is negated.

**Where:** `vercel.json:15`

**Why it matters:** The app stores Anthropic API keys, Supabase credentials, and all user tasks in localStorage. XSS on any page gives an attacker full read access to all of it.

**Effort:** M

**Suggested fix:**
- The root cause is that all JS is inline in `index.html`. The long-term fix is extracting inline scripts to external files
- Short-term: keep `'unsafe-inline'` but add `'strict-dynamic'` and a nonce — modern browsers with nonce support get full protection even with the `'unsafe-inline'` compatibility fallback
- At minimum, file a tracking issue so this is known technical debt rather than invisible risk
