# Improvement Plan — Arete / Givelink
_Generated 2026-08-13. Max 20 items, ordered by ROI within each tier._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Wrong model ID in Givelink AI Sprint Planner → 100% failure rate
- **What**: `claude-opus-4-5` is not a valid model ID; the Anthropic API returns a 404 on every call.
- **Where**: `givelink.html:1140`
- **Why it matters**: The AI Sprint Planner is a marquee feature of Givelink — every user who clicks "Generate" gets a broken error screen, eroding trust in the whole product.
- **Effort**: S
- **Suggested fix**:
  - Replace `model:'claude-opus-4-5'` with a valid current model (`claude-haiku-4-5-20251001` for cost, `claude-sonnet-5` for quality).
  - Add a model version constant at the top of the file so it's a single place to update.

---

### 2. `window.prompt()` for API key blocks on mobile and fails silently in private browsing
- **What**: `getApiKey()` uses `window.prompt()` to collect the Anthropic API key; `logActivityNP()` uses it for CRM notes. Both are blocked by default in iOS Safari when a PWA is installed, making those features completely inaccessible on mobile.
- **Where**: `givelink.html:1086–1088` (getApiKey), `givelink.html:1261` (callClaudeGL fallback), `givelink.html:1431` (logActivityNP)
- **Why it matters**: Givelink is shipped as a PWA targeting mobile-first users. `window.prompt()` is silently suppressed in standalone PWA mode on iOS — users tap "Generate" or "Log Activity" and nothing happens, no error, no explanation.
- **Effort**: M
- **Suggested fix**:
  - Replace `window.prompt()` API key entry with a small inline modal (reuse the existing `.mo/.md` modal pattern already in the file).
  - Replace `window.prompt()` activity logging with a modal text field.
  - Share the existing `taskos_api_key` localStorage key so key entry persists between sessions.

---

### 3. Service worker push notification icons point to non-existent path
- **What**: The push notification handler uses `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'`, but the actual file is at `./icon-192.png` (no `/icons/` subdirectory).
- **Where**: `sw.js:48–49`
- **Why it matters**: Every push notification that fires will show a broken icon (or no icon on Android). This looks like a buggy, unpolished app at the exact moment you want to re-engage a lapsed user.
- **Effort**: S
- **Suggested fix**:
  - Change both paths to `'./icon-192.png'`.
  - Add a smoke-test: fetch the icon URL in the install event and `console.warn` if it returns non-200.

---

### 4. AI proxy not configured — all AI features require a personal Claude key
- **What**: `APP_CONFIG.aiProxy: ''` means the `/api/claude` serverless proxy (which exists and works) is never used. Every user who hasn't manually entered a Claude API key in Settings gets a toast saying "Add Claude API key" and AI features are dead.
- **Where**: `index.html:9959`
- **Why it matters**: Guest users and new sign-ups — the majority of new traffic — get a broken AI experience out of the box. This is the biggest single conversion blocker: the demo on the landing page promises AI, the app delivers a settings page about API keys.
- **Effort**: S
- **Suggested fix**:
  - Set `aiProxy: '/api/claude'` (or the full Vercel URL if cross-origin).
  - The `/api/claude` handler already exists and gates to Supabase sessions — configure it as the default.
  - Fall back to the user's personal key only if the proxy returns a 4xx.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. PostHog key empty on landing page — zero conversion analytics
- **What**: `POSTHOG_KEY = ''` on the landing page silently disables all analytics events (`landing_view`, `landing_cta_click`, `landing_scroll`, `landing_demo_seen`).
- **Where**: `landing.html:701`
- **Why it matters**: You built a complete analytics layer and documented it in the commit message, but it's never fired. You can't see which CTA converts, how far users scroll, or whether the demo works — making every landing page decision a guess.
- **Effort**: S
- **Suggested fix**:
  - Paste the same PostHog project key used in `index.html` (already configured at `APP_CONFIG.posthogKey`).
  - Landing and app events will stitch together automatically (same key, same distinct ID).

---

### 6. Givelink direct-browser API calls expose user API keys in plaintext
- **What**: `callClaudeGL()` and `runAiSprintPlanner()` POST directly to `api.anthropic.com` from the browser, sending the user's `sk-ant-...` key as a request header visible in any browser's DevTools Network tab.
- **Where**: `givelink.html:1131–1145`, `givelink.html:1264–1270`
- **Why it matters**: Any user who opens DevTools (or any third-party extension with network access) can read the key and run up charges. For a product asking users to trust you with their data, this is a serious credibility risk if discovered.
- **Effort**: M
- **Suggested fix**:
  - Route Givelink AI calls through the same `/api/claude` proxy used by the main app.
  - The proxy can authenticate via the Supabase session token or accept an anonymous mode for guest use.
  - Remove `anthropic-dangerous-direct-browser-access: true` from all browser-side fetch calls.

---

### 7. Givelink uses completely different brand colours (blue) vs. Arete (purple)
- **What**: `givelink.html` defines `--accent:#3b82f6` (Tailwind blue) for all primary interactions — buttons, active nav states, progress bars. The rest of the product uses purple (`#8272f2` in app, `#5a49e0` on landing).
- **Where**: `givelink.html:17` (`:root` CSS vars), pervasive
- **Why it matters**: Users who navigate between Givelink and Task OS (the "← Task OS" link is in the sidebar) experience a jarring brand shift. This undermines the "one product family" impression and makes Givelink feel like a prototype, not a polished product.
- **Effort**: S
- **Suggested fix**:
  - Change `--accent:#3b82f6` → `#6a58ee` (or the same purple token used in `index.html`).
  - Update `--prog` (currently the same blue) and the FAB shadow (`rgba(59,130,246,.4)`) to match.
  - Keep pillar colours (`--gr`, `--np`, etc.) as-is — they're semantic, not brand.

---

### 8. No empty state when sprint has no tasks — blank page on first launch
- **What**: When a new Givelink user opens the app before `seed()` has run, the Overview view renders four stat boxes all showing `0` and empty pillar cards with no guidance on what to do.
- **Where**: `givelink.html:511–547` (`renderOverview`)
- **Why it matters**: First impressions on a blank state often determine whether a user comes back. The current blank state looks like a load error, not an invitation.
- **Effort**: S
- **Suggested fix**:
  - Add an empty-state card to `renderOverview` when `curTasks().length === 0`: "Start your first sprint → Add your goals and tasks using the + button."
  - The seed data is good — but add a "Load sample sprint" CTA so power users don't have to deal with pre-filled data.

---

### 9. Standup generator uses `yesterday -2 days` — always reports "nothing completed"
- **What**: In `generateStandup()`, `yesterday` is computed as `now.getDate() - 2` (two days ago), not one. Tasks completed yesterday are excluded; the standup always shows "Nothing completed yet" unless something was done two or more days ago.
- **Where**: `givelink.html:1488`
- **Why it matters**: The Daily Standup is a daily driver — a user who checks it every morning will see their actual work from yesterday silently ignored, making the feature feel unreliable.
- **Effort**: S
- **Suggested fix**:
  - Change `yesterday.setDate(now.getDate()-2)` → `yesterday.setDate(now.getDate()-1)` and set hours to `0,0,0,0` to capture the full previous day.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `index.html` is 1MB+ — a single-file monolith with ~11,000 lines of JS
- **What**: The entire Arete app lives in one HTML file. Reading a specific function requires `Read` with exact line offsets; searching requires multiple grep passes. Every edit risks breaking an unrelated section.
- **Where**: `index.html` (entire file)
- **Why it matters**: Shipping velocity will slow quadratically as the file grows. Bug fixes in one feature now require reading thousands of lines of context. This is the root cause of why the files below are duplicated.
- **Effort**: L
- **Suggested fix**:
  - Extract JS into `app.js` (or `src/` modules) and CSS into `app.css`.
  - Keep the HTML shell thin: `<script src="app.js">` at the bottom.
  - Adopt a simple module boundary (`// ── SECTION ──`) as a first step before a full build pipeline.

---

### 11. Duplicate Claude API wrapper — `callClaude()` and `callClaudeGL()` diverged
- **What**: `index.html` defines `callClaude()` (lines ~5006–5034) with proxy support, error handling, and model selection. `givelink.html` defines a separate `callClaudeGL()` (lines 1256–1272) with no proxy support and no structured error handling.
- **Where**: `index.html:5006`, `givelink.html:1256`
- **Why it matters**: Any improvement to error handling, model versions, or rate-limit behaviour must be made in two places. They've already diverged (one has proxy support, one doesn't) and will continue to.
- **Effort**: M
- **Suggested fix**:
  - Extract a shared `claude-client.js` that both files can load via `<script src="claude-client.js">`.
  - This forces the proxy-first architecture fix (P1 #6) to be done once.

---

### 12. Service worker cache version not bumped after last deploy (22 days stale)
- **What**: `CACHE = 'arete-20260723'` in `sw.js`. Last commit was July 22. Static assets (icons, manifests) from before that date may still be served from the old cache to users whose browsers haven't evicted it.
- **Where**: `sw.js:1`
- **Why it matters**: Users on slow-update cycles (once-a-month phone restarts) may see old app behaviour even after a fix is deployed, because the stale cache wins the race. Debugging this is extremely hard.
- **Effort**: S
- **Suggested fix**:
  - Update `CACHE = 'arete-20260813'` on every meaningful deploy (or tie it to a build step that stamps the date automatically via a `package.json` script).
  - Add to the deploy checklist: bump cache version in `sw.js`.

---

### 13. Multiple `window.prompt()` / `confirm()` calls across givelink.html
- **What**: Beyond the API key case (P0 #2), `givelink.html` uses `confirm()` for destructive actions (delete task line 732, delete org line 1425). These are blocking, unstyled, and inaccessible.
- **Where**: `givelink.html:732`, `givelink.html:1425`
- **Why it matters**: `index.html` already has a `showConfirm()` helper that renders a beautiful in-app confirmation modal. Using native `confirm()` looks inconsistent and fails in standalone PWA mode on some iOS versions.
- **Effort**: S
- **Suggested fix**:
  - Inline a minimal `showGLConfirm()` function in `givelink.html` that matches the index.html modal pattern.
  - Or extract shared UI utilities (confirm, toast, prompt modal) to a `ui.js` module (aligns with #10).

---

### 14. `callClaudeGL` model hardcoded to `claude-haiku-4-5-20251001` — tied to specific version
- **What**: Both model identifiers in givelink.html (`claude-haiku-4-5-20251001` on line 1256 and `claude-opus-4-5` on line 1140) are hardcoded inline throughout the file.
- **Where**: `givelink.html:1140`, `givelink.html:1256`, `givelink.html:1660`
- **Why it matters**: When model IDs are updated (as happened with the broken `claude-opus-4-5`), there are multiple places to update and it's easy to miss one.
- **Effort**: S
- **Suggested fix**:
  - Define `const GL_MODEL_FAST = 'claude-haiku-4-5-20251001'` and `const GL_MODEL_SMART = 'claude-sonnet-5'` at the top of the script block.
  - Reference the constants throughout instead of inline strings.

---

## 💡 P3 — Nice to have

### 15. Landing page canonical URL points to Vercel subdomain, not production domain
- **What**: `<link rel="canonical" href="https://task-management-beige-eight.vercel.app/">` — if there's a custom domain, search engines will index the Vercel URL as canonical, splitting link equity.
- **Where**: `landing.html:11`
- **Why it matters**: SEO — if `arete.app` or similar is the real domain, all Google PageRank goes to the Vercel URL.
- **Effort**: S
- **Suggested fix**: Update canonical to the production domain. Same for the OG/Twitter `og:url` and `og:image` absolute URLs on lines 15–21.

---

### 16. Accessibility: clickable `<div>`s in givelink.html aren't keyboard-navigable
- **What**: `.ni` (nav items), `.gc2` (goal cards), and `.tc2` (task cards) are all `<div onclick>` elements. Screen readers can't focus them; keyboard-only users can't reach them.
- **Where**: `givelink.html:233–244` (nav), `givelink.html:628` (goalHTML), `givelink.html:660` (taskHTML)
- **Why it matters**: PWA on desktop means keyboard shortcuts and tabbing matter. The app already has a keyboard shortcut system in index.html — this is an inconsistency.
- **Effort**: M
- **Suggested fix**:
  - Add `role="button" tabindex="0"` to interactive divs.
  - Add `onkeydown="if(e.key==='Enter'||e.key===' ') this.click()"` handler.
  - Or convert to `<button>` elements with appropriate CSS reset.

---

### 17. Burndown chart renders incorrectly when sprint starts with 0 snapshots
- **What**: `renderBurndown()` shows "Complete tasks to see burndown progress" when `snapshots.length < 2`. But it also never auto-records a snapshot on init — only on `toggleDone()`. A sprint with 0 completions shows no burndown even partway through.
- **Where**: `givelink.html:754–775`
- **Why it matters**: The burndown is shown on the Overview (the first thing users see). An empty chart on a sprint that's been running for 3 days looks like a bug.
- **Effort**: S
- **Suggested fix**:
  - Call `_recordSnapshot()` on page load (in the `init` section) to always record today's state.
  - Add a synthetic "day 0" snapshot using the sprint start date and total task count.

---

### 18. Impact widget shows `0.00%` of 1M mission when nonprofits = 0
- **What**: `renderImpactWidget()` renders an empty string if `S.nonprofits.length === 0`, but after `seedNonprofits()` is called from `renderCRM()`, it renders with won orgs. On first load of Overview, the widget is blank until the user visits CRM.
- **Where**: `givelink.html:1573–1591`
- **Why it matters**: The mission counter is a powerful motivational element. It should be visible from first paint, not hidden behind a tab visit.
- **Effort**: S
- **Suggested fix**:
  - Call `seedNonprofits()` in `load()` / `init()` rather than only in `renderCRM()`.
  - Or call `renderImpactWidget()` after `seed()` during init.

---

### 19. `og:image` in index.html uses absolute Vercel subdomain URL — breaks on custom domains
- **What**: `<meta property="og:image" content="https://task-management-beige-eight.vercel.app/og-image.png">` (lines 25–27). When sharing the app from a custom domain, the OG image is fetched from the Vercel URL, which may have CORS or CDN issues.
- **Where**: `index.html:24–29`
- **Why it matters**: Social share previews are part of the referral / share-the-win PLG flow that was a major focus in recent sprints. A broken OG image undermines those shares.
- **Effort**: S
- **Suggested fix**: Use a relative or protocol-relative path (`/og-image.png`) if the image is served from the same origin, and verify the Vercel CDN URL is stable.

---

### 20. App loads Inter font from Google Fonts — adds ~300ms latency, breaks offline
- **What**: `index.html:15–16` loads Inter from `fonts.googleapis.com`. This is a network request that blocks text rendering and fails entirely offline — the font falls back to `-apple-system` but with a flash.
- **Where**: `index.html:15–16`
- **Why it matters**: Arete is marketed as "works offline" and "Superhuman-fast." A Google Fonts request at load is inconsistent with both claims.
- **Effort**: M
- **Suggested fix**:
  - Self-host the Inter subset (variable font, latin only) as a `woff2` file.
  - Add it to the `STATIC` array in `sw.js` so it's pre-cached.
  - Or use the system font stack only (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`) — it already appears as a fallback and looks great.

---

_End of plan. 20 items; P0s are deploy-blocking, P1s are high-leverage growth fixes, P2s reduce future friction, P3s are polish._
