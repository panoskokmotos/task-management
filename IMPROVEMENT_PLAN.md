# Givelink / Arete Improvement Plan
_Generated 2026-07-23 · 18 items across 4 tiers_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Givelink AI Sprint Planner uses a non-existent model ID
- **What**: `runAiSprintPlanner()` calls the Claude API with `model:'claude-opus-4-5'`, which does not exist — every call returns a model-not-found error and the feature is silently broken.
- **Where**: `givelink.html:1140`
- **Why it matters**: The AI Sprint Planner is a headline feature of the Givelink board; users who click "✨ Generate" see an error modal and may assume the whole app is broken.
- **Effort**: S
- **Suggested fix**:
  - Change `model:'claude-opus-4-5'` → `model:'claude-haiku-4-5-20251001'` (fast, cheap) or `'claude-sonnet-4-6'` (better quality).
  - Prefer the same model used by `callClaudeGL` (`claude-haiku-4-5-20251001`) for consistency.

---

### 2. Nonprofit CRM edit modal loses Delete / Log Activity / Next Stage buttons
- **What**: The NP modal HTML (including Delete, Log Activity, and → Next Stage buttons) is injected only once on first creation (`if(!m){ m.innerHTML=… }`). The buttons are conditionally rendered based on `editNpId` at that moment. If the user clicks "Add Org" first (`editNpId=null`), those buttons are never rendered — subsequent org edits silently lack all action controls.
- **Where**: `givelink.html:1359–1388` (`_showNPModal`)
- **Why it matters**: Any user who clicked "Add Org" before editing an existing org cannot delete, log activity, or advance pipeline stage — core CRM operations that will be used by Panos daily.
- **Effort**: S
- **Suggested fix**:
  - Move the footer button HTML outside the `if(!m)` block so it regenerates each time `_showNPModal` is called.
  - Alternatively, always recreate `m.innerHTML` on every call (the modal is small and the overhead is negligible).

---

### 3. Push notification icon references a path that doesn't exist
- **What**: The service worker's push handler specifies `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'`, but no `icons/` subdirectory exists — the actual file is at `./icon-192.png`. Every push notification shows a broken image.
- **Where**: `sw.js:47–48`
- **Why it matters**: Notifications with broken icons look like spam and erode trust. iOS/Android may also suppress them.
- **Effort**: S
- **Suggested fix**:
  - Change both `icon` and `badge` values from `'./icons/icon-192.png'` → `'./icon-192.png'`.
  - While there: bump the `CACHE` constant to force clients to receive the fix.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Share card still says "TaskOS" after the Arete rebrand
- **What**: The canvas-drawn progress share card renders "Task" + "OS" as the logo wordmark (lines 10214–10215). Commit #81 purged stray old-brand colors everywhere but missed the canvas draw calls.
- **Where**: `index.html:10214–10215` (`_drawStatsCard`)
- **Why it matters**: Every user who shares their progress card via "📸 Share my progress" distributes an image with the wrong brand. Each share is an impression; confusing branding undermines the Arete rebrand.
- **Effort**: S
- **Suggested fix**:
  - Replace `fillText('Task', …)` and `fillText('OS', …)` with `fillText('Arete', …)` in a single draw call.
  - Update footer text on line 10232: remove the raw Vercel subdomain once a proper domain is set.

---

### 5. Givelink sprint defaults to dates already in the past
- **What**: The initial state hardcodes `start:'2026-03-28', end:'2026-04-11'`. For every new user on the live deployment, the sprint ended months ago, showing "0 days left" and a 100% elapsed sprint bar on first load.
- **Where**: `givelink.html:437`
- **Why it matters**: The first impression of the sprint board is a stale, finished sprint — users don't understand the product and churn before they try it.
- **Effort**: S
- **Suggested fix**:
  - Replace the hardcoded dates with dynamic defaults: `start: new Date().toISOString().slice(0,10)`, `end` two weeks from today.
  - Keep the hardcoded sprint *name* but compute dates on first load only.

---

### 6. `window.prompt()` used to collect Anthropic API key
- **What**: Both `getApiKey()` (line 1086) and `callClaudeGL` (line 1261) fall back to `window.prompt()` to collect the user's Anthropic API key. Native prompts are blocked in sandboxed iframes and certain mobile browsers, and even when they work they look terrible.
- **Where**: `givelink.html:1086, 1261`
- **Why it matters**: Users who haven't pre-stored a key get a jarring system dialog instead of a product-quality modal. Some won't see it at all. This gates every AI feature in Givelink.
- **Effort**: S
- **Suggested fix**:
  - Replace both `window.prompt()` calls with a small modal that has a `<input type="password">` field and a "Save & Continue" button.
  - Persist the key in `localStorage` under the same key (`taskos_api_key`) so existing users aren't re-prompted.

---

### 7. Analytics not wired up on landing or app (PostHog keys blank)
- **What**: `APP_CONFIG.posthogKey` in `index.html:9960` and `POSTHOG_KEY` in `landing.html:702` are both empty strings. PostHog is loaded and instrumented but never initialised — all `track()` calls are silent no-ops.
- **Where**: `index.html:9960`, `landing.html:702`
- **Why it matters**: The landing → signup → first-action funnel is completely invisible. There's no data to inform which PLG features (guest mode, templates, share cards) drive actual signups.
- **Effort**: S
- **Suggested fix**:
  - Create a PostHog project (free) and paste the key into both locations.
  - Ensure `POSTHOG_KEY` in `landing.html` matches `posthogKey` in `index.html` so both use the same project and the full funnel is visible.

---

### 8. AI proxy not deployed — signed-in users still need their own key
- **What**: `APP_CONFIG.aiProxy` is an empty string (`index.html:9959`). The serverless Claude proxy exists at `/api/claude.js` and even has Supabase auth gating, but it was never deployed or wired up. Every signed-in user hits the "Add Claude API key in Settings" wall for all AI features.
- **Where**: `index.html:9959`, `api/claude.js`
- **Why it matters**: All PLG AI features (Day Planner, Auto-Triage, Task Reply) require a personal API key. This kills the "no account needed" promise and will block conversion for the vast majority of users.
- **Effort**: M
- **Suggested fix**:
  - Deploy `/api/claude.js` on Vercel with `ANTHROPIC_API_KEY` set as an env var.
  - Set `aiProxy: 'https://<your-domain>/api/claude'` in `APP_CONFIG`.
  - Consider adding Upstash-based rate limiting (noted in the file but not implemented) to prevent abuse.

---

### 9. Canonical URL and OG/Twitter tags point to raw Vercel subdomain
- **What**: `og:url`, `og:image`, `twitter:image`, and the `<link rel="canonical">` in both `index.html` and `landing.html` reference `https://task-management-beige-eight.vercel.app/`. This is what search engines index and what appears in social card previews.
- **Where**: `index.html:24–32`, `landing.html:11–21`
- **Why it matters**: Brand-less, hyphenated Vercel subdomains hurt SEO (no keyword authority) and social trust (links look auto-generated). Google also splits PageRank between the Vercel URL and any future custom domain.
- **Effort**: S (once domain is purchased)
- **Suggested fix**:
  - Set a custom domain in Vercel → Domains.
  - Replace all occurrences of `task-management-beige-eight.vercel.app` in both files and in `_APP_URL` (`index.html:10180`).
  - Do a repo-wide find-replace: there are 7 occurrences across `index.html`, `landing.html`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. Givelink makes direct browser-to-Anthropic API calls, exposing the user's key
- **What**: `callClaudeGL()` (`givelink.html:1264`) and the AI Sprint Planner (`givelink.html:1131`) call `api.anthropic.com` directly from the browser using `anthropic-dangerous-direct-browser-access: true`. The API key is visible in the browser network tab and accessible to any XSS.
- **Where**: `givelink.html:1131–1144`, `givelink.html:1264–1272`
- **Why it matters**: Any XSS in the page (or a malicious browser extension) can steal the stored Anthropic key. The header name itself signals this is not intended for production use.
- **Effort**: M
- **Suggested fix**:
  - Route Givelink's AI calls through `/api/claude.js` (the same proxy used by the Arete app).
  - Replace the `fetch('https://api.anthropic.com/...')` call in `callClaudeGL` with a `fetch(PROXY_URL, ...)` call using the same pattern as `callClaude()` in `index.html`.

---

### 11. `index.html` is 14,924 lines — one-file monolith
- **What**: The entire Arete app — HTML, CSS, ~14,000 lines of JS — lives in a single file with no module boundaries, build step, or tests.
- **Where**: `index.html` (whole file)
- **Why it matters**: Every new feature adds to an already unnavigable file. There's no way to tree-shake unused code, write unit tests for individual functions, or get type-checking benefits. Velocity will drop quadratically as the file grows.
- **Effort**: L
- **Suggested fix**:
  - Start by extracting the ~1,000-line Supabase sync block and the ~500-line AI/Claude block into separate `<script src>` files served statically.
  - Add a Vite or esbuild config for bundling — no React rewrite needed, vanilla JS splits cleanly.
  - Aim for ≤3,000 lines per logical module.

---

### 12. Cloud sync uses last-write-wins with no conflict notification
- **What**: `sbSyncNow()` resolves conflicts by comparing `S._updatedAt` timestamps and silently discarding the older version (`index.html:10417–10421`). If two devices write data while offline, the later sync clobbers the earlier one with no warning.
- **Where**: `index.html:10417–10421` (`sbSyncNow`)
- **Why it matters**: For a solo founder working across laptop + phone, a single lost sprint annotation or task note discovered days later is deeply frustrating and damages trust in the product.
- **Effort**: M
- **Suggested fix**:
  - Show a non-destructive toast when a remote-wins scenario occurs: "Synced from another device — your local changes were superseded."
  - For task arrays specifically, attempt a merge by `id` before overwriting; only fall back to last-write-wins if the full `S` object's shape has changed.

---

### 13. Date-pinned model ID needs manual maintenance
- **What**: `index.html:5023` hardcodes `'claude-haiku-4-5-20251001'` directly in `callClaude()`, and `api/claude.js:42` does the same. When this model version is deprecated, every AI feature silently fails with a 404 until someone spots the hardcode.
- **Where**: `index.html:5023`, `api/claude.js:42`
- **Why it matters**: Model deprecations happen without warning — this is a silent breakage waiting to happen.
- **Effort**: S
- **Suggested fix**:
  - Centralise the model string: `const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';` near `APP_CONFIG` and reference it everywhere.
  - In `api/claude.js`, read from an env var `MODEL` with a hardcoded fallback, so production can be updated without a redeploy.

---

### 14. Google Fonts loaded over the network breaks offline PWA
- **What**: `index.html:14–16` loads Inter from `fonts.googleapis.com`. The service worker's fetch handler intercepts navigation and HTML (network-first) but fonts are cross-origin and not in the `STATIC` cache list. Offline, the app falls back to system fonts with a visible layout shift.
- **Where**: `index.html:14–16`, `sw.js:13–18`
- **Why it matters**: The app is marketed as offline-capable. Users on planes or weak connections see unstyled text, which looks broken.
- **Effort**: S
- **Suggested fix**:
  - Add `'https://fonts.googleapis.com/css2?...'` and `'https://fonts.gstatic.com/...'` to the service worker's STATIC list to cache them at install time.
  - Or: self-host the Inter woff2 subset in the repo and remove the Google Fonts dependency entirely.

---

## 💡 P3 — Nice to have

### 15. Burndown chart has a hardcoded pixel size
- **What**: The SVG burndown chart is drawn with `W=280, H=100` (`givelink.html:763`) — always 280×100 pixels regardless of screen size. On a 14" laptop it's tiny; on mobile it's barely legible.
- **Where**: `givelink.html:763–774` (`renderBurndown`)
- **Why it matters**: The burndown is the main health signal on the sprint Overview page. If you can't read it, you don't know you're behind.
- **Effort**: S
- **Suggested fix**:
  - Read the container width: `const W = document.getElementById('burndown-chart').offsetWidth || 320`.
  - Set `H = Math.round(W * 0.35)` for a consistent aspect ratio.

---

### 16. No per-user rate limiting on the Claude API proxy
- **What**: `/api/claude.js` proxies all authenticated requests to Anthropic with no per-account throttling. A single account can exhaust the Anthropic credit line.
- **Where**: `api/claude.js:1–49`
- **Why it matters**: The proxy comment explicitly notes this risk ("a single account can't run up your Anthropic bill") but the fix was never landed.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (10 req/min per `uid`): `await ratelimit.limit(uid)` before the Anthropic fetch.
  - Return `429` with a user-friendly message on breach.

---

### 17. `seedNonprofits` reseeds demo data if the user deletes all orgs
- **What**: `renderCRM()` calls `seedNonprofits()` on every render, which is guarded by `if((S.nonprofits||[]).length) return`. If the user deliberately deletes all nonprofits to start fresh, the demo data reappears on the next CRM view.
- **Where**: `givelink.html:1281–1292` (`seedNonprofits`), `givelink.html:1299–1302` (`renderCRM`)
- **Why it matters**: Confusing for power users who want a clean slate; they'd need to delete the same six orgs repeatedly.
- **Effort**: S
- **Suggested fix**:
  - Add a `S.nonprofitsSeeded` flag (set to `true` after first seed) and gate on that instead of `.length`.

---

### 18. Share card footer bakes in the raw Vercel subdomain as a PNG
- **What**: `index.html:10232` writes `task-management-beige-eight.vercel.app` into every canvas share card. Once a proper domain is set, all existing PNGs users already downloaded will show the wrong URL — and the fix requires a new share card generation, not just a text change.
- **Where**: `index.html:10232` (`_drawStatsCard`)
- **Why it matters**: Share cards are cached on users' devices. Every card shared before the domain migration keeps promoting the old URL indefinitely.
- **Effort**: S (fix now, before any marketing push)
- **Suggested fix**:
  - Extract the domain into a constant near `_APP_URL` (e.g. `const _DISPLAY_URL = 'useaete.com'`).
  - Reference it in both `_drawStatsCard` and `shareInvite`/`shareStats` text so there's a single update point.
