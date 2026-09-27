# Arete Improvement Plan
_Generated 2026-09-27 · Max 20 items, ordered by ROI within each tier_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icon path is broken
- **What**: Service worker references `./icons/icon-192.png` for push notification icon and badge, but that directory doesn't exist
- **Where**: `sw.js:46-47`
- **Why it matters**: Any user who receives a push reminder (habit due, snooze expired) gets a broken/blank icon — looks like a spam notification and damages trust
- **Effort**: S
- **Suggested fix**:
  - Change both `icon` and `badge` values from `'./icons/icon-192.png'` to `'./icon-192.png'`
  - Confirm with a quick Lighthouse PWA audit after the fix

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 2. AI features are dead for all new users (aiProxy not configured)
- **What**: `APP_CONFIG.aiProxy` is an empty string; every AI button shows "Add Claude API key in Settings first"
- **Where**: `index.html:9959`, all `callClaude()` call sites (~15 locations)
- **Why it matters**: AI is the app's core differentiator. New users hit a dead end immediately on the feature that's meant to hook them. The first-run brain-dump → AI organise flow is completely broken
- **Effort**: S
- **Suggested fix**:
  - Deploy `api/claude.js` to Vercel (it's already written) with `ANTHROPIC_API_KEY` as a secret
  - Set `aiProxy: 'https://<your-domain>/api/claude'` in `APP_CONFIG`
  - Rate-limit per UID as a follow-up (see P2 item 6)

### 3. Share card still shows old "TaskOS" brand name
- **What**: `_drawStatsCard()` draws `"Task"` + `"OS"` in accent colour in the canvas header — the rebrand to Arete was not applied here
- **Where**: `index.html:10214-10215`
- **Why it matters**: Users who tap "Share my progress" send out a branded image that says "TaskOS" — confusing to recipients and undermines brand credibility after the rebrand
- **Effort**: S
- **Suggested fix**:
  - Replace the two `x.fillText('Task', ...)` / `x.fillText('OS', ...)` calls with a single `x.fillText('Arete', ...)` call using the same brand gradient colour (`#5a49e0`)
  - While there, remove the hardcoded watermark URL on line 10232 (see item 4)

### 4. Domain hardcoded as `task-management-beige-eight.vercel.app` everywhere
- **What**: The temp Vercel project subdomain is baked into OG meta tags, `_APP_URL` constant, the share-card canvas watermark, and landing.html's `<link rel="canonical">` and schema.org JSON-LD
- **Where**: `index.html:24-32` (OG/Twitter meta), `index.html:10180` (`_APP_URL`), `index.html:10232` (canvas), `landing.html:11,16-17,21,25` (canonical, OG, schema)
- **Why it matters**: Social share previews, SEO signals and referral links all point to a generic Vercel URL. The share-card watermark embarrasses users. Any domain migration silently breaks all referral tracking
- **Effort**: S
- **Suggested fix**:
  - Change `_APP_URL` to `location.origin + '/'` so it's always dynamic
  - Replace the hardcoded watermark string with `_APP_URL.replace(/^https?:\/\//,'')` or just `'arete.app'`
  - Update `landing.html` canonical + OG URLs to the real production domain

### 5. Push notification permission request ignored by browsers (called from setTimeout)
- **What**: `Notification.requestPermission()` is called inside `setTimeout(..., 5000)` — not triggered by a direct user gesture
- **Where**: `index.html:~11270`
- **Why it matters**: Chrome 69+, Safari 15.4+, and Firefox silently deny or ignore permission requests that are not triggered directly by a user click/tap. The reminder feature appears to work (no error), but permissions are never actually granted — users never receive any reminders
- **Effort**: S
- **Suggested fix**:
  - Remove the `setTimeout` wrapper; instead call `Notification.requestPermission()` inside the existing "Enable Reminders" button's click handler
  - This already exists in the codebase at the reminder toggle UI — just move the call there

### 6. Black text on `var(--accent)` fails contrast in light mode
- **What**: Multiple UI elements use `color:#000` on `background:var(--accent)` — in light mode `--accent:#5a49e0` (dark purple), giving roughly 1.5:1 contrast, well below WCAG AA (4.5:1 for small text)
- **Where**: `index.html:247` (`.sn2` step numbers), `:310` (`.focus-num`), `:426` (`.rel-avatar`), and `~6305` (dynamically generated OKR chips)
- **Why it matters**: All numbered badges, step indicators, and avatar initials become unreadable in light mode — this is the mode new/casual users are most likely to prefer
- **Effort**: S
- **Suggested fix**:
  - Change `color:#000` to `color:#fff` on dark-accent backgrounds
  - The dark theme uses `--bg:#0a0a0f` where black text on the same accent would be the same issue — use white consistently

### 7. `--faint` CSS variable undefined in main app — text silently invisible
- **What**: 5 elements in `index.html` use `var(--faint)` for text colour, but the variable is never defined in `:root` or `body.light`; it is only defined in `landing.html`
- **Where**: `index.html:144` (goal-group task count), `:301` (process mode hint), `:917` (first-run hint text), `:6267-6268` (goal linked-task sub-row)
- **Why it matters**: In light mode the inherited text colour is dark and readable, but the intent is a subtle dimmed colour. In dark mode the inherited colour is the full `--text` value — these hints look the same weight as headings. First-run UX is affected.
- **Effort**: S
- **Suggested fix**:
  - Add `--faint:#5a5a6e;` to `:root` in `index.html` (for dark theme)
  - Add `--faint:#9b9488;` to `body.light` (matching `landing.html`'s value)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 6. No per-user rate limiting on the AI proxy
- **What**: `api/claude.js` calls Anthropic directly with zero rate limiting; the file's own comment says "for production add per-user rate limiting … so a single account can't run up your Anthropic bill"
- **Where**: `api/claude.js:13`
- **Why it matters**: A single user (or a script) can call the proxy in a tight loop and exhaust the entire monthly Anthropic budget in minutes
- **Effort**: M
- **Suggested fix**:
  - Add [Upstash Rate Limit](https://upstash.com/docs/redis/sdks/ratelimit/overview) keyed on the Supabase `uid` extracted from the validated token
  - A sensible default: 30 requests / user / hour with a sliding window
  - Return HTTP 429 with a `Retry-After` header on limit hit

### 7. Product analytics are off — `posthogKey` empty
- **What**: `APP_CONFIG.posthogKey = ''` so every `track()` call in the codebase is a no-op; no funnel, retention or error visibility
- **Where**: `index.html:9960`
- **Why it matters**: There is no data on conversion rate, which AI features are used, where users drop off in first-run, or whether the rebrand improved retention
- **Effort**: S
- **Suggested fix**:
  - Create a PostHog project (free tier is sufficient to start), copy the project key
  - Set `posthogKey: 'phc_...'` — the existing `track()` calls cover all key events already

### 8. OG image (1.6 MB) cached in the service-worker offline shell
- **What**: `sw.js` lists `'./og-image.png'` in the `STATIC` array, so it is fetched and cached on every install. The file is 431 KB compressed but still large for a first-load cache
- **Where**: `sw.js:10`
- **Why it matters**: Inflates the install-time payload for every user who launches the PWA. The OG image is never shown in the app itself — it exists only for social link previews which are fetched by scrapers, not the service worker
- **Effort**: S
- **Suggested fix**:
  - Remove `'./og-image.png'` and `'./shot-app.png'` (372 KB) from the `STATIC` array
  - These will still be served over the network when scrapers request them

### 9. `saveContent()` and `saveExperience()` have a fragile `createdAt` preservation pattern
- **What**: Both functions build `obj` with `createdAt: editId ? undefined : new Date()` then rely on an explicit override after the spread to repair it. The `undefined` value is spread in first, which means the fix is load-bearing and easy to accidentally remove
- **Where**: `index.html:12656-12657` (`saveContent`), `index.html:12819` (`saveExperience`)
- **Why it matters**: A future refactor that drops or reorders the spread can silently re-introduce `createdAt` clobber, which was a production data-integrity bug (fixed in commit 72e03fe)
- **Effort**: S
- **Suggested fix**:
  - Build `obj` without `createdAt` when in edit mode; set it only on create:
    ```js
    const obj = { id: editId||uid(), title, … };
    if (!editId) obj.createdAt = new Date().toISOString();
    ```
  - Then the spread `{...prev, ...obj}` is safe without any extra override

### 10. `renderFocusDayPlan()` has hardcoded "Givelink Outreach" block
- **What**: The Focus Day Plan function permanently renders a block labelled "Givelink Outreach" linked to `category==='givelink'` tasks
- **Where**: `index.html:~4375`
- **Why it matters**: Users who don't use Givelink see a mystery block in their planned day with no tasks. The Givelink product is supposed to be a separate app, but this coupling pushes it into every user's focus session
- **Effort**: S
- **Suggested fix**:
  - Remove the hardcoded "Givelink Outreach" block entirely from the Focus Day Plan
  - If category-based blocks are desired, generate them dynamically from the user's actual categories instead

### 11. AI model ID hardcoded in source — not in `APP_CONFIG`
- **What**: `'claude-haiku-4-5-20251001'` is hardcoded as a string literal in `callClaude()` and in `api/claude.js`
- **Where**: `index.html:5023`, `api/claude.js:42`
- **Why it matters**: Model IDs change at deprecation. When this ID is retired, all 15+ AI features silently fail or return errors — there is no single place to update
- **Effort**: S
- **Suggested fix**:
  - Add `aiModel: 'claude-haiku-4-5-20251001'` to `APP_CONFIG`
  - Reference `APP_CONFIG.aiModel` in both `callClaude()` and `api/claude.js`

### 12. 132 inline hex color values are not theme-aware (light mode is broken)
- **What**: Template strings throughout the JS produce `style="color:#58a6ff"`, `style="background:#22d3ee"`, etc. — 132 instances of hardcoded hex values that do not change when `body.light` is applied
- **Where**: `index.html` — generated by JS template strings throughout render functions
- **Why it matters**: The entire light theme is broken for these elements: deep-work timers, OKR status bars, habit streaks, relationship board, and network health widgets all remain dark-mode coloured in light mode
- **Effort**: M
- **Suggested fix**:
  - Systematically replace inline hex colors with CSS custom property references (e.g., replace `#58a6ff` with `var(--accent)`, `#22d3ee` with `var(--ca)`)
  - Priority: covers the most-visible widgets first (streak, habits, OKR bars)

### 13. `index.html` is a 14,926-line monolithic file
- **What**: The entire application — 700+ JS functions, all CSS, and all HTML templates — lives in a single file
- **Where**: `index.html` (entire file)
- **Why it matters**: Makes it impossible to code-split, test individual modules, or use editor tooling (folding, go-to-definition) effectively. The file takes ~2 s to parse in editors
- **Effort**: L
- **Suggested fix**:
  - First step (low risk): extract all `<script>` content after the closing `</style>` into `app.js` and load it with `<script src="app.js" defer>`
  - Second step: split CSS into `app.css`
  - Do not attempt a full component refactor until the file is split; the risk of regression is too high

---

## 💡 P3 — Nice to have

### 17. Old `#toast` element still in DOM alongside `#toast-stack`
- **What**: The original single-toast implementation (`#toast`, opacity-based) and the new stack (`#toast-stack`) both exist in the DOM simultaneously; the old one is never shown by current code but occupies a `role="status"` live region slot
- **Where**: `index.html:436` (`#toast`), `:467` (`#toast-stack`)
- **Why it matters**: Screen readers may announce the stale live region unpredictably; the dead element adds confusion to future debugging
- **Effort**: S
- **Suggested fix**: Remove the `#toast` div and its associated CSS rule entirely; `#toast-stack` is the live implementation

### 18. Modals lack ARIA `role="dialog"` and `aria-modal="true"`
- **What**: The `.mo` modal backdrop divs have no `role="dialog"`, `aria-modal="true"`, or `aria-labelledby` attributes; screen readers read through the backdrop as if it wasn't there
- **Where**: `index.html:197` (`.mo` CSS definition); all dynamically rendered modals (~12 modal IDs)
- **Why it matters**: Screen-reader users cannot distinguish modal context from the page behind it
- **Effort**: S
- **Suggested fix**:
  - Add `role="dialog" aria-modal="true"` to each `.md` inner panel (not the backdrop)
  - Add `aria-labelledby="<mh-id>"` pointing to the modal heading

### 19. Landing page `<link rel="canonical">` and schema.org URL use the temp Vercel domain
- **What**: `landing.html` has `<link rel="canonical" href="https://task-management-beige-eight.vercel.app/">` and the same URL in the JSON-LD `SoftwareApplication` object
- **Where**: `landing.html:11,25`
- **Why it matters**: Google consolidates SEO authority to the canonical URL — if it stays as the temp URL, a domain change starts from zero authority
- **Effort**: S
- **Suggested fix**: Update both to the real production domain (same work as P1 item 4 — batch them together)

### 20. SW serves a generic 503 response for offline external requests
- **What**: External fetch failures (Supabase, Anthropic API) return `new Response('', { status: 503 })` with no body — the caller then has to handle an empty JSON parse
- **Where**: `sw.js:99`
- **Why it matters**: `callClaude()` calls `res.json().catch(()=>({}))` to recover, but other callers that don't guard can surface a confusing empty error to users
- **Effort**: S
- **Suggested fix**: Return `new Response(JSON.stringify({error:'offline'}), { status: 503, headers: {'Content-Type':'application/json'} })` so all callers get a parseable error body
