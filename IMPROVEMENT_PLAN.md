# Arete — Improvement Plan

_Generated: 2026-10-06_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Claude API key transmitted directly from the browser
- **What**: When `APP_CONFIG.aiProxy` is empty (the default), the app calls `https://api.anthropic.com/v1/messages` directly with the user's API key and the `anthropic-dangerous-direct-browser-access` header, exposing it in network traffic visible to any browser extension or MITM proxy.
- **Where**: `index.html:5014–5025`
- **Why it matters**: Any user who enters their API key is silently at risk of key theft. Anthropic explicitly requires this header only for explicit developer testing; it should not ship in production. Also means the proxy at `api/claude.js` is effectively never used unless a host manually fills in `aiProxy`.
- **Effort**: S
- **Suggested fix**:
  - Set `aiProxy` in `APP_CONFIG` to the deployed `/api/claude` endpoint URL at build time (or via a config injection step).
  - Remove the `anthropic-dangerous-direct-browser-access` path entirely; route all AI calls through the proxy.
  - Add a visible error if neither `aiProxy` nor `claudeKey` is set, rather than silently failing.

---

### 2. `givelink.html` stores Anthropic API key in localStorage via `window.prompt()`
- **What**: Two separate call sites in givelink.html collect the API key with a native browser `prompt()` dialog and store it unencrypted in `localStorage` under `taskos_api_key`. No proxy path exists.
- **Where**: `givelink.html:1150–1168`, `1326–1340`
- **Why it matters**: Native prompts are phishable, key is stored in plain text (readable by any JS on the page, XSS risk), and the UX is jarring. There is no proxy fallback for Givelink's AI features at all.
- **Effort**: M
- **Suggested fix**:
  - Add a settings modal (like the main app) to enter the API key.
  - Route calls through `api/claude.js` as the proxy (same setup as index.html).
  - Remove both `prompt()` calls entirely.

---

### 3. API proxy has no rate limiting — any signed-in user can drain the Anthropic bill
- **What**: `api/claude.js` correctly gates on Supabase auth, but has no per-user rate limit. A single account can call `/api/claude` in an unbounded loop.
- **Where**: `api/claude.js:12` (the comment acknowledges this), `api/claude.js:16–49`
- **Why it matters**: One runaway client or a compromised account can generate thousands of dollars of Anthropic API cost in minutes. This is noted in the code but never actioned.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (free tier covers the load): `10 req/min` per user.
  - Alternatively, add a simple in-memory counter with a 1-minute sliding window at the Edge function level.
  - Cap `max_tokens` at a sensible value (currently 2000; consider 800 for most prompts).

---

### 4. PostHog analytics unconfigured — conversion funnel is dark
- **What**: Both `APP_CONFIG.posthogKey` (index.html:9960) and `POSTHOG_KEY` (landing.html:702) are empty strings. PostHog never initialises; no events are captured.
- **Where**: `index.html:9956–9962`, `landing.html:702`
- **Why it matters**: Every conversion event (`signup`, `firstrun_started`, `firstrun_skipped`, `import_done`, etc.) silently no-ops. The product is flying blind on activation and retention metrics.
- **Effort**: S
- **Suggested fix**:
  - Create a PostHog project (free tier), copy the project API key.
  - Set `posthogKey` in `APP_CONFIG` and `POSTHOG_KEY` on landing.
  - Verify at least `signup`, `landing_view`, and `firstrun_started` fire in the network tab.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Givelink branding embedded in new-user seeded data and task categories
- **What**: New users are seeded with tasks categorised as `givelink` (a separate product), the `CATS` constant exposes `Givelink` as a category label, and `renderGivelinkDash` remains a navigable view. 15+ seeded tasks reference Givelink explicitly.
- **Where**: `index.html:2503–2507` (CATS/PILLARS), `index.html:4375, 4546–4754` (seeded tasks), `index.html:8618–8728` (renderGivelinkDash), `index.html:7068–7070` (gamification badges)
- **Why it matters**: A new user with no Givelink context sees tasks about "Nonprofits Board Follow Ups", "Greek Nonprofits Board (Make-A-Wish etc)" and a mysterious `givelink-dash` view. It breaks the illusion of a personal OS and confuses activation.
- **Effort**: M
- **Suggested fix**:
  - Rename `givelink` category to `ventures` or `business` in CATS/PILLARS.
  - Remove or gate `renderGivelinkDash` behind a feature flag for personal use.
  - Replace seeded tasks with generic high-value examples that any user can relate to.

### 6. Massive accessibility gap: 662 interactive elements, only 89 aria-labels
- **What**: There are 662 `<button>` and `<a>` elements in index.html but only 89 `aria-label` attributes. Icon-only buttons (emoji labels, no text) are entirely opaque to screen readers.
- **Where**: `index.html` — throughout, most egregiously in the sidebar nav, FAB dial, and task checkboxes.
- **Why it matters**: Keyboard and screen reader users cannot navigate the app. Fails WCAG 2.1 AA (required for most EU/US markets). Also makes the app unusable with browser voice control tools.
- **Effort**: L
- **Suggested fix**:
  - Start with the highest-traffic elements: sidebar nav items, the FAB dial buttons, and task checkboxes.
  - Add `aria-label` to every button whose visible text is an emoji or icon only.
  - Add `role="main"` to the main content div and `role="navigation"` to the sidebar.

### 7. AI features require manual API key entry — kills activation for non-technical users
- **What**: When `aiProxy` is not set, every AI feature (AI Triage, Day Plan, AI Commands) shows "Add your Claude API key in Settings first." Non-technical users don't know what an API key is.
- **Where**: `index.html:4328, 5007–5025, 5047, 5111`
- **Why it matters**: AI is the primary differentiator. Making it blocked on a manual API key step means a large portion of users never experience it. Directly ties into item #1 above.
- **Effort**: S (once proxy URL is wired in per P0 item 1)
- **Suggested fix**:
  - Wire the hosted proxy URL into `APP_CONFIG.aiProxy` so AI just works for hosted users.
  - Reserve the "enter your own API key" path for self-hosters (make it a Settings → Advanced option).

### 8. `givelinkMetrics` and `givelinkHistory` bloat every user's localStorage
- **What**: The global state `S` includes `givelinkMetrics` (with nested `impactModel`) and `givelinkHistory` — large default objects that are serialised to localStorage on every save for every user, even those who never use Givelink.
- **Where**: `index.html:2517` (state declaration)
- **Why it matters**: localStorage has a ~5MB limit. Bloating it with dead fields pushes users toward the limit sooner. Also makes Supabase sync payloads larger.
- **Effort**: S
- **Suggested fix**:
  - Remove `givelinkMetrics` and `givelinkHistory` from the default state in index.html (they belong only in givelink.html).
  - Run a one-time migration to strip these keys from existing localStorage on load.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. Entire app in a 14,926-line single HTML file
- **What**: `index.html` contains all CSS (~2,000 lines), all HTML templates (~3,000 lines), and all JS logic (~9,000 lines) in a single file with no module boundaries.
- **Where**: `index.html:1–14926`
- **Why it matters**: Any change risks breaking an unrelated view. No tree-shaking, no parallel loading of non-critical code, no ability to test individual modules. Estimated 30–40% of features are loaded on page init regardless of which view the user opens.
- **Effort**: L
- **Suggested fix**:
  - As a first step, extract CSS into `styles.css` and the largest independent render functions (renderGivelinkDash, renderFinance, renderHealth) into separate `<script src>` modules loaded lazily.
  - Don't attempt a full rewrite at once; extract one section per sprint.

### 10. 71 silent `catch(e){}` blocks hiding real errors
- **What**: 71 catch blocks in index.html swallow exceptions with no logging, no user feedback, and no telemetry.
- **Where**: `index.html` — e.g. lines 2573, 2583, 2587, 2983, 3031, 3583, 3868, 3979, and 62 others.
- **Why it matters**: Production bugs become invisible. A crash in `_startFirstRun()` (line 3868) is completely silent, leaving a user on a blank screen with no indication of failure.
- **Effort**: M
- **Suggested fix**:
  - Replace silent catches with at minimum `console.warn('context', e)` so errors show in DevTools.
  - For user-facing flows (first run, sync, AI), show a graceful error toast.
  - Add a Sentry or PostHog error capture call: `posthog.capture('js_error', {message: e.message})`.

### 11. `givelink.html` uses deprecated `document.execCommand('copy')`
- **What**: The clipboard fallback in givelink.html uses the deprecated `execCommand('copy')` API which is removed in recent Safari and may be removed from Chrome.
- **Where**: `givelink.html:1695`
- **Why it matters**: Copy-to-clipboard fails silently on modern Safari, breaking a core sharing flow in Givelink.
- **Effort**: S
- **Suggested fix**:
  - Replace with `navigator.clipboard.writeText(t).catch(() => { /* show manual copy prompt */ })`.
  - Already done correctly in the fallback at givelink.html:1594 — just mirror that pattern.

### 12. `api/claude.js` proxy uses `claude-haiku-4-5-20251001` — model ID may drift
- **What**: The model ID is hardcoded as a string literal in `api/claude.js:44`.
- **Where**: `api/claude.js:44`
- **Why it matters**: When Anthropic deprecates haiku-4-5, requests will return a 404/400. No fallback exists.
- **Effort**: S
- **Suggested fix**:
  - Make the model configurable via an env var: `process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'`.
  - Add the model ID to a comment with its deprecation date once known.

### 13. State object `S` has 60+ fields in a single untyped declaration
- **What**: The `let S = {...}` declaration at index.html:2517 is a single object with 60+ mixed-concern properties, many of which are empty arrays that grow unboundedly (logs, entries, sessions, etc.).
- **Where**: `index.html:2517`
- **Why it matters**: No ability to validate shape on load, no clear ownership of fields, and migration logic that checks `seededV2`/`seededGoalsV3` flags is fragile. A corrupted value in any field can silently break unrelated features.
- **Effort**: L
- **Suggested fix**:
  - Add a schema version field and a `migrateState(s)` function that validates and upgrades stored data on load.
  - Group related fields into namespaced sub-objects (e.g. `S.health.*`, `S.finance.*`) as a first step.

---

## 💡 P3 — Nice to have

### 14. Landing page CTA goes to `/index.html` directly, bypassing the Vercel rewrite
- **What**: If any internal link on landing.html uses `href="/index.html"` rather than `href="/app"` or a clean path, it may 404 on some CDN edge configs.
- **Where**: `landing.html` — check all CTA `href` values.
- **Why it matters**: Low risk but could cause a 404 for users who bookmark or share the direct link.
- **Effort**: S
- **Suggested fix**: Audit all CTAs on landing.html; ensure they link to `/index.html` or add a Vercel rewrite for `/app` → `/index.html`.

### 15. Service worker caches no versioned assets — stale UI after deployments
- **What**: `sw.js` caches all assets but has no cache-busting strategy. After a deployment, returning users may see stale JS/CSS until they hard-refresh.
- **Where**: `sw.js:1–117`
- **Why it matters**: Users who hit a regression in a deploy and try to refresh may not see the fix if the SW serves the old version from cache.
- **Effort**: M
- **Suggested fix**:
  - Add a cache version constant (`const CACHE_VERSION = 'v1.85'`) and increment it on each deploy.
  - Call `caches.delete(oldCacheName)` in the `activate` event handler.

### 16. No Content Security Policy `nonce` for inline scripts
- **What**: `vercel.json` sets a strict CSP with `'unsafe-inline'` for scripts, which allows any injected script to run.
- **Where**: `vercel.json` (CSP header)
- **Why it matters**: `'unsafe-inline'` negates most XSS protection from CSP. The entire app is inline JS so moving off it is a large effort, but it should be tracked.
- **Effort**: L
- **Suggested fix**:
  - As an interim, move the PostHog snippet and other third-party loaders to external `<script src>` tags and remove `'unsafe-inline'`.
  - Long term: hash-based CSP per script block once scripts are extracted.
