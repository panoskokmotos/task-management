# Arete — Improvement Plan
_Generated: 2026-08-06_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Hardcoded personal AI prompts shipped to all users
**What**: ~20 AI features send prompts referring to "Panos", "Givelink", "Greek founder", "SF move", "nonprofit fundraising SaaS" — every user gets Panos's personal context, not their own.
**Where**: `index.html:5647`, `5920`, `7319`, `7477`, `7849–7850`, `8604` (and 96 more occurrences of "Panos"/"Givelink" in prompts)
**Why it matters**: Users of AI features (Relationship Nudge, Decisions, Social Audit, Newsletter, etc.) get AI output about a stranger's life. The product is unsellable to anyone other than the developer until this is fixed.
**Effort**: M
**Suggested fix**:
- Replace all hardcoded personal strings with `getAboutMe()` — the function already exists and reads from settings
- Where Givelink/SF references are baked into feature logic (e.g. Social Audit), replace with generic `{{user_context}}` interpolated from `getAboutMe()`
- Audit every `const prompt = ...` block with a grep for `'Panos|Givelink|Greek founder'` and parameterize

---

### 2. Push notification icon path broken in service worker
**What**: `sw.js` push handler uses `./icons/icon-192.png` but no `icons/` directory exists — the correct path is `./icon-192.png`.
**Where**: `sw.js:46–47`
**Why it matters**: Every push notification (reminders, streaks, nudges) shows a broken icon on Android. On some platforms this causes the notification to be silently dropped.
**Effort**: S
**Suggested fix**:
- Change `'./icons/icon-192.png'` → `'./icon-192.png'` in both `icon` and `badge` fields
- Add the correct paths to the `STATIC` cache array in `sw.js` if not already there (they're not — `sw.js:2–12` only caches `./icon-192.png` directly)

---

### 3. Shared progress card promotes old "Task OS" brand
**What**: `_drawStatsCard()` draws canvas text `"Task"` + `"OS"` for the app name; every user who shares their progress card broadcasts the stale brand.
**Where**: `index.html:10214–10215`
**Why it matters**: Word-of-mouth shares (the product's primary growth loop) are undermining brand recognition for "Arete" just as the rebrand launched. Every share is anti-marketing.
**Effort**: S
**Suggested fix**:
- Replace `x.fillText('Task',...)` / `x.fillText('OS',...)` with a single `x.fillText('Arete', ...)` in a matching gradient style
- Update footer line `10232` from `'Made with Arete · task-management-beige-eight.vercel.app'` to use a real custom domain (or just `'arete.app'` as a placeholder until the domain is set)

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. AI features silently dead in hosted mode — `aiProxy` is empty
**What**: `APP_CONFIG.aiProxy` is an empty string (`index.html:9959`). In hosted mode (Supabase configured), authenticated users who tap any AI feature see "Add your Claude API key in Settings" — but Settings has no key field visible in hosted mode, so they hit a dead end.
**Where**: `index.html:9956–9962`, `5007–5033`
**Why it matters**: AI is the product's primary differentiator (Triage, Plan Day, Reply-to-Act, etc. are in the hero copy). Every signed-in user trying AI churns at a wall with no explanation.
**Effort**: S
**Suggested fix**:
- Deploy `/api/claude.js` (already written and correct), set its Vercel URL as `aiProxy` in `APP_CONFIG`
- If the proxy isn't deployed yet, at minimum change the toast message in `callClaude()` to `'AI features require a Pro account — upgrade in Settings'` so the dead end is explained

---

### 5. Hardcoded Vercel dev URL in share links and social card
**What**: `_APP_URL = 'https://task-management-beige-eight.vercel.app/'` (`index.html:10180`) is used in invite shares, template shares, the social canvas footer, and the referral URL. OG tags in both `index.html` and `landing.html` also use this URL.
**Where**: `index.html:10180`, `10232`, `landing.html:11,16–21`
**Why it matters**: Every invite, social share, and OG preview card exposes a raw Vercel staging URL instead of the brand. This actively undermines trust in link previews (the URL is the first thing a recipient reads).
**Effort**: S
**Suggested fix**:
- Set a single `const APP_DOMAIN = 'https://arete.app'` (or whatever the production domain is) at the top of the config block
- Replace all 6+ hardcoded Vercel URL occurrences with this constant
- Update OG image URLs in both HTML files to match

---

### 6. No empty/error state for AI features when `aiProxy` is unconfigured
**What**: AI buttons (Triage, Plan Day, Daily Picks, etc.) show a loading spinner via `_aiBtn()`, but when `callClaude()` returns `null` due to missing config, the button re-enables with no feedback about why nothing happened.
**Where**: `index.html:5044–5064` (aiAutoTriage), `5110–5145` (aiPlanDay), and all other AI entry points
**Why it matters**: Users tap "Triage my inbox" and see a brief spinner, then nothing — not even the error toast in some paths. Silent failures destroy trust in a core feature.
**Effort**: M
**Suggested fix**:
- Ensure every AI function that calls `callClaude()` checks the `null` return and shows a contextual toast (`if(!raw){toast('AI couldn\'t respond — try again');return;}`) — some do, several don't
- Add an inline disabled-state tooltip on AI buttons when `!APP_CONFIG.aiProxy && !S.claudeKey`

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 7. Off-brand pink colors in data visualizations
**What**: `areaColors.health = '#f472b6'` and `BL_CATS.creative.color = '#ec4899'` — both are the old Givelink pink, and `#f472b6` appears on the purple-background chart, violating the no-pink-on-purple rule.
**Where**: `index.html:13211`, `12193`
**Why it matters**: The Wheel of Life chart and Bucket List render with a pink that clashes with the violet brand and fails the brand consistency rule. Small but visible.
**Effort**: S
**Suggested fix**:
- `health` → `'#a78bfa'` (lavender from the existing `--bi` token), `creative` → `'#c084fc'` (purple-adjacent)
- Run a brand audit grep: `grep -n '#f47\|#ec48\|#db27\|#e879\|#f9a8\|hotpink\|magenta' index.html`

---

### 8. No API rate limiting on the Claude proxy
**What**: `api/claude.js` acknowledges in a comment (line 13): "For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill" — but it is not implemented.
**Where**: `api/claude.js:1–49`
**Why it matters**: Any signed-in user (or a single compromised account) can call the proxy in a tight loop, burning unbounded Anthropic API credits. At scale this becomes a critical financial risk.
**Effort**: M
**Suggested fix**:
- Add an Upstash Redis rate limiter (or Vercel KV) — e.g. 20 AI requests per user per hour
- At minimum, log `user_id + ip + timestamp` per request to Vercel's built-in logs so abuse is detectable

---

### 9. Multiple critical error paths silently swallowed
**What**: Sync, auth, and navigation flows use `try{...}catch(e){}` with no logging or user feedback. Examples: `catch(e){}` at `10131` (sync on login), `10134` (template application), `10381` (sync on boot), `10653`.
**Where**: `index.html:10131`, `10134`, `10381`, `10653`
**Why it matters**: A sync failure on login (`_afterAuth`) is completely silent — the user doesn't know their data isn't saved. A template application failure leaves no trace.
**Effort**: S
**Suggested fix**:
- At minimum change the sync-on-login catch from `catch(e){}` to `catch(e){_sbSetStatus('⚠ '+e.message);}` so the sync pill reflects the failure
- For auth-critical catches, add `console.warn('context', e)` so errors surface in Vercel logs

---

### 10. Single 14,924-line HTML file — untestable critical paths
**What**: `index.html` contains 15k lines of HTML, CSS, and JS. Zero unit tests exist. The AI triage flow, auth flow, and sync logic are completely untestable as shipped.
**Where**: `index.html` (entire file)
**Why it matters**: Every regression is caught only by users. Recent rapid feature velocity (commits #73–#83 in 6 days) with no tests is high-risk. The sync flow in particular is a data-loss vector if broken.
**Effort**: L
**Suggested fix**:
- Extract the three highest-risk modules as `<script src="...">` files: `auth.js` (sbAuth/sbToken/sbSyncNow), `ai.js` (callClaude + all AI workflows), `state.js` (load/save + S object)
- Add Vitest or Jest with smoke tests for `save()` → `load()` round-trip, `_sbToken()` expiry logic, and `callClaude()` proxy path

---

## 💡 P3 — Nice to have

### 11. Referral attribution stored but reward mechanic incomplete
**What**: `_captureRef()` saves `taskos_ref` in localStorage and tracks `referred_arrival` to PostHog, but there's no reward flow for the referrer when the referred user signs up.
**Where**: `index.html:10338–10344`
**Why it matters**: The growth loop is half-built — sharing works, attribution is tracked, but the referrer gets no feedback ("You earned a Pro month!") so the loop doesn't close.
**Effort**: M
**Suggested fix**:
- On `_welcomeSeed()`, if `localStorage.getItem('taskos_ref')` is set, fire `track('referral_converted', {ref})` and show the referrer (via a push notification or next-session toast) "Your friend joined — thanks!"
- Wire a simple milestone in PostHog to alert when referral count hits 5, 10, etc.

---

### 12. `givelink.html` icon path uses `.svg` not `.png` for apple-touch-icon
**What**: `givelink.html:6` sets `<link rel="apple-touch-icon" href="icon-gl.svg">` — Safari ignores SVG apple-touch-icons and shows a blank icon on the iOS homescreen.
**Where**: `givelink.html:6`
**Why it matters**: Givelink's PWA install experience on iOS shows a blank homescreen icon, undermining the polish of that product.
**Effort**: S
**Suggested fix**:
- Generate a `icon-gl-180.png` at 180×180 and reference it: `<link rel="apple-touch-icon" sizes="180x180" href="icon-gl-180.png">`

---

### 13. OG image URLs point to dev Vercel domain in both HTML files
**What**: Both `index.html:24` and `landing.html:16` embed `task-management-beige-eight.vercel.app` in OG image URLs. Social previews on Twitter/LinkedIn resolve this URL, which may serve stale cached images after a domain move.
**Where**: `index.html:24–32`, `landing.html:16–21`
**Why it matters**: When a custom domain is eventually set, all historical shares will resolve to a stale OG image (or broken redirect). Fixing now avoids a future SEO/OG cache invalidation headache.
**Effort**: S
**Suggested fix**:
- Set one canonical `BASE_URL` constant and use it across all meta tags; configure Vercel's `vercel.json` with a redirect from the old domain to the new one

---

_Max 13 items shown; ordered within each tier by user/revenue impact._
