# Arete — Improvement Plan
_Generated: 2026-09-16_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Default user name is "Panos" for every new user
- **What**: Every new signup lands on "Good morning, Panos 👋" — the developer's first name is the hardcoded fallback.
- **Where**: `index.html:2519` — `let profileName = localStorage.getItem('taskos_name') || 'Panos'`
- **Why it matters**: Every single new user sees someone else's name on their very first screen. Immediate loss of trust.
- **Effort**: S
- **Suggested fix**:
  - Change fallback from `'Panos'` to `'there'` (renders as "Good morning, there")
  - Or prompt the user to set their name during first-run onboarding and leave the field empty until then

---

### 2. PWA home-screen shortcuts are completely broken
- **What**: All four Android/iOS home-screen shortcuts (Quick Add, Journal, Coach, Reflect) navigate to hash URLs that the app never handles.
- **Where**: `manifest.json:22–44` — `{ "url": "./index.html#quick-add" }` etc.; `index.html` — the `nav()` router uses view-name strings, not URL hashes.
- **Why it matters**: Users who pin the app and tap shortcuts land on the dashboard with no modal or view opening. The feature simply doesn't work.
- **Effort**: S
- **Suggested fix**:
  - In the boot script read `location.hash` after load and call `nav(hash.slice(1))` or `openQuickCapture()` for `#quick-add`
  - Alternatively rewrite the shortcut URLs to use query params (`?v=journal`) that the router already handles

---

### 3. Push notification icons are 404
- **What**: The service worker push handler references `./icons/icon-192.png` but the actual file is at `./icon-192.png` — there is no `icons/` directory.
- **Where**: `sw.js:47–48`
- **Why it matters**: Every push notification on Android renders without icon or badge; on some browsers the notification is suppressed entirely.
- **Effort**: S
- **Suggested fix**:
  - Change `'./icons/icon-192.png'` → `'./icon-192.png'` in both `icon` and `badge` fields
  - Add `./icon-192.png` to the `STATIC` cache array so it's always available offline

---

### 4. First-login cloud sync failure is silent — user opens with stale data
- **What**: In `_afterAuth()`, the initial cloud pull is wrapped in `try{await sbSyncNow(true);}catch(e){}` — any error is silently discarded.
- **Where**: `index.html:10131`
- **Why it matters**: If Supabase is slow or the JWT isn't ready yet, the user opens the app with their old localStorage data and never knows the pull failed. Subsequent auto-save pushes overwrite the cloud with the stale local state.
- **Effort**: S
- **Suggested fix**:
  - Replace the bare catch with one that calls `toast('⚠ Sync failed — retrying…')` and schedules one retry after 3 s
  - Display the sync pill status immediately so the user sees a warning state

---

### 5. Share card renders old "Task OS" brand name
- **What**: The canvas-drawn shareable progress card paints "Task OS" in the brand purple — the product is now called "Arete".
- **Where**: `index.html:10214–10215` — `x.fillText('Task', …); x.fillText('OS', …)`
- **Why it matters**: Every shared screenshot actively advertises the wrong product name to potential new users. Breaks brand consistency for growth loops.
- **Effort**: S
- **Suggested fix**:
  - Replace the two-part `Task` + `OS` draw calls with a single `x.fillText('Arete', …)` in the brand violet (`#8272f2`)
  - Confirm font size / positioning matches the new shorter string

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. Finance view has hardcoded personal income targets (€25K / €300)
- **What**: Income and passive-income goals are literal numbers baked into the template, not read from user settings.
- **Where**: `index.html:5323–5324` — `goal: €25K` and `goal: €300` hardcoded in markup; the progress bar denominators are also hardcoded literals.
- **Why it matters**: Every user who opens the Finance view sees a stranger's income plan. Prevents the view from being useful to anyone.
- **Effort**: M
- **Suggested fix**:
  - Add `financeGoals: { annualIncome: 0, passiveMonthly: 0 }` to the `S` state schema
  - Render the goals from `S.financeGoals` and provide an editable settings row in the Finance view header
  - Progress bars should use `S.financeGoals.annualIncome` as the denominator (0 → hide the bar)

---

### 7. Health view has hardcoded personal body-fat target (12%)
- **What**: Same pattern as the finance view — `goal: 12%` body fat is a literal in the template.
- **Where**: `index.html:5223`
- **Why it matters**: Every user sees the developer's physique goal instead of their own. Erodes trust in the tool as a personal OS.
- **Effort**: S
- **Suggested fix**:
  - Add a `healthGoals: { bodyFatPct: null }` key to `S`
  - Render the goal from `S.healthGoals.bodyFatPct` with an inline "Set goal" affordance when null

---

### 8. Login error always says "wrong password" even for network/server failures
- **What**: Every catch in `authSubmit()` during login mode shows "Wrong email or password — or confirm your email first." regardless of the actual error (network timeout, 503, 429, etc.).
- **Where**: `index.html:10092–10093`
- **Why it matters**: A user on a flaky connection keeps changing their password trying to "fix" what is actually a connectivity problem.
- **Effort**: S
- **Suggested fix**:
  - Check `e.message` for known Supabase error codes (401 → wrong credentials, 429 → too many requests, others → "Connection error — try again")
  - Pass a generic "Connection error — check your internet and try again" for unrecognised errors

---

### 9. Auth signup exposes raw Supabase error messages to users
- **What**: In signup mode, the raw `e.message` is shown verbatim in the auth error div.
- **Where**: `index.html:10093` — `_agErr(e.message)` for signup
- **Why it matters**: Messages like `"duplicate key value violates unique constraint \"users_email_key\""` appear to real users, leaking DB internals and damaging trust.
- **Effort**: S
- **Suggested fix**:
  - Map known error patterns to friendly copy: `duplicate key` → "An account with this email already exists — try logging in"; others → "Something went wrong — try again in a moment"

---

### 10. Landing page PostHog key is blank — zero conversion analytics
- **What**: The landing page initialises PostHog with an empty string key, so no events (CTA clicks, scroll depth, trial starts) are ever sent.
- **Where**: `landing.html:~702` — `var POSTHOG_KEY = ''`
- **Why it matters**: The top of the funnel is completely invisible. A/B testing, attribution, and conversion rate optimisation are impossible without data.
- **Effort**: S
- **Suggested fix**:
  - Fill `POSTHOG_KEY` with the same key used in `APP_CONFIG.posthogKey` in `index.html`
  - Add `posthog.capture('landing_cta_click')` to the hero and comparison-table CTA buttons

---

### 11. Givelink sprint board back-link reads "← Task OS"
- **What**: The navigation link back to the main app still uses the old product name.
- **Where**: `givelink.html:~225` — `← Task OS` in the sidebar header link
- **Why it matters**: Users switching between the two products see a brand name that no longer exists.
- **Effort**: S
- **Suggested fix**:
  - Update the link text to `← Arete`

---

### 12. OAuth UID fetch failure leaves user signed-in with sync silently broken
- **What**: After a Google OAuth redirect, the code that fetches `/auth/v1/user` to obtain the UID has an empty catch — if it fails, `_SB.uid` is never set and all sync calls are no-ops.
- **Where**: `index.html:10374` — `try { ... fetch('/auth/v1/user') ... } catch(e) {}`
- **Why it matters**: Google sign-in users complete the OAuth flow, the UI shows them as signed in, but their data never syncs. They won't discover the problem until they switch devices.
- **Effort**: S
- **Suggested fix**:
  - In the catch, call `_sbSetStatus('⚠ Could not confirm identity — tap Sync to retry')` and `toast('⚠ Sign-in incomplete — please tap Sync')`
  - Schedule one automatic retry after 5 s

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 13. Claude proxy has no rate limiting — anyone can exhaust the Anthropic quota
- **What**: `/api/claude` accepts any POST with a valid (or no) auth header and forwards it to Anthropic with no per-user or per-IP throttle.
- **Where**: `api/claude.js` — no rate limiting code exists; the comment at line 12 acknowledges the gap.
- **Why it matters**: A single abusive account or discovered endpoint URL can run the Anthropic bill to thousands of dollars overnight.
- **Effort**: M
- **Suggested fix**:
  - Add a token-bucket per authenticated UID using `@vercel/kv` (Upstash Redis): 10 req/minute, 100 req/day
  - Return HTTP 429 with `Retry-After` when the bucket is empty
  - Log UID + token count to spot abuse before it becomes expensive

---

### 14. Claude proxy sends no system prompt — AI responses are off-brand and can break parsing
- **What**: The proxy forwards the raw user prompt with no `system` message, so the model has no voice/tone/format constraints.
- **Where**: `api/claude.js:42` — `messages: [{ role: 'user', content: prompt }]`
- **Why it matters**: The app's downstream parsers (e.g. the plan-my-day and triage features) expect structured markdown output. A missing system prompt means any malformed input can produce unparseable responses that silently fail.
- **Effort**: S
- **Suggested fix**:
  - Add `system: "You are Arete, a calm and focused productivity assistant. Always respond in concise structured markdown unless instructed otherwise."` to the API body
  - Ensure the prompt templates in `index.html` don't duplicate instructions now covered by the system prompt

---

### 15. Claude model ID is a hardcoded string — will break silently on deprecation
- **What**: `claude-haiku-4-5-20251001` is hardcoded in the proxy with no fallback or env-var override.
- **Where**: `api/claude.js:42`
- **Why it matters**: When Anthropic deprecates this version, all AI features return a 404 with no alert or fallback.
- **Effort**: S
- **Suggested fix**:
  - Read from `process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'`
  - Document the env var in the setup comments and Vercel project settings

---

### 16. Service worker cache name is a manual date string — users get stale JS on redeploys
- **What**: `const CACHE = 'arete-20260723'` is never updated unless a developer manually edits the file before each deploy.
- **Where**: `sw.js:1`
- **Why it matters**: If this string is not bumped, users continue receiving months-old HTML and JS from the cache even after a Vercel redeploy. Bugs cannot be fixed for installed users.
- **Effort**: S
- **Suggested fix**:
  - Inject a build hash at deploy time: `const CACHE = 'arete-__BUILD_HASH__'` replaced by a Vercel build plugin or a `vercel.json` build command (`sed -i`)
  - Alternatively, use a `Cache-Control: no-cache` header on HTML documents and rely on the network-first strategy already in `sw.js` — then the cache name matters far less

---

### 17. Service worker static-asset handler has no offline fallback
- **What**: When a static asset is not in cache and the network fetch fails (e.g. user is offline), the `respondWith` promise rejects — the asset fails to load with a network error rather than a graceful degradation.
- **Where**: `sw.js:72–80`
- **Why it matters**: Offline users who navigate to a cached page may see broken images and icons even though the SW is installed.
- **Effort**: S
- **Suggested fix**:
  - Add `.catch(() => caches.match(e.request))` to the fetch inside the static handler (mirrors the pattern already used for HTML pages on line 92)

---

### 18. Empty-body 503 from SW causes unhandled JSON parse errors
- **What**: When an external (non-local) request fails offline, the SW returns `new Response('', { status: 503 })`. Callers that do `await r.json()` throw a SyntaxError.
- **Where**: `sw.js:99`
- **Why it matters**: The Supabase fetch calls in `index.html` do not guard against empty-body responses; the error surfaces as a confusing "unexpected end of JSON" instead of "you're offline".
- **Effort**: S
- **Suggested fix**:
  - Return `new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })`

---

### 19. Supabase anon key hardcoded in the GitHub Actions workflow file
- **What**: The keep-alive workflow hardcodes the project URL and anon key directly in the YAML, meaning they live in git history forever.
- **Where**: `.github/workflows/supabase-keepalive.yml:26–27`
- **Why it matters**: While Supabase anon keys are designed to be public (RLS protects data), embedding them in git prevents clean rotation. A future RLS misconfiguration + a rotated key that isn't updated in git = data exposure with no easy rollback. The correct precedent for secrets is secrets.
- **Effort**: S
- **Suggested fix**:
  - Move URL and key to GitHub Actions secrets: `${{ secrets.SUPABASE_URL }}` and `${{ secrets.SUPABASE_ANON_KEY }}`
  - Update the workflow YAML to reference those secrets — no functional change, but correct hygiene

---

## 💡 P3 — Nice to have

### 20. Maskable icons reuse the non-maskable PNG — logos get clipped on Android
- **What**: `manifest.json` declares both `any` and `maskable` purpose using the same `icon-192.png` and `icon-512.png` files. Maskable icons require the safe zone to be 80% of canvas; the current icons fill the canvas and will be clipped on circular home-screen slots.
- **Where**: `manifest.json:14–18`
- **Why it matters**: On Pixel/Samsung devices the app icon looks broken (logo edges cropped). Low priority since most users likely access via browser.
- **Effort**: M
- **Suggested fix**:
  - Create `icon-192-maskable.png` and `icon-512-maskable.png` with the logo centred at ≤80% of the canvas on the brand background
  - Update `manifest.json` to reference the maskable variants separately from the `any` variants
