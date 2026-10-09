# Improvement Plan — Arete (Task OS)
_Generated 2026-10-09 by automated codebase review_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notifications silently show broken icon
- **What**: Service worker references `./icons/icon-192.png` but no `icons/` directory exists.
- **Where**: `sw.js:47–48`
  ```js
  icon:'./icons/icon-192.png',
  badge:'./icons/icon-192.png',
  ```
  Correct path: `./icon-192.png` (used everywhere else in the project).
- **Why it matters**: Every push notification (habit streak reminders, morning briefings) renders without an icon/badge on all platforms. On iOS the notification may be suppressed entirely. Users never see the reminder they opted in for.
- **Effort**: S
- **Suggested fix**:
  - Change both `icon` and `badge` in `sw.js:47–48` to `'./icon-192.png'`
  - Bump the `CACHE` name string to force the SW to update immediately (`arete-20261009`)

---

### 2. No rate limiting on the Claude AI proxy — billing exposure
- **What**: `api/claude.js` accepts unlimited requests from any authenticated Supabase session. The code itself acknowledges this at line 12 ("For production add per-user rate limiting (e.g. Upstash)") but it was never implemented.
- **Where**: `api/claude.js:12` (comment) and the entire handler body.
- **Why it matters**: A single user can loop the proxy indefinitely and rack up an unbounded Anthropic bill. At scale this is a company-ending cost surprise.
- **Effort**: M
- **Suggested fix**:
  - Add an Upstash Redis sliding-window rate limit (e.g. 20 req/user/hour) keyed on the Supabase `uid` extracted from the JWT
  - Or as a quick interim: return 429 if the request body's `max_tokens` exceeds 1000 and enforce a server-side hard cap of 1000 regardless of what the client sends (replace current `Math.min(parseInt(body.max_tokens)||1000, 2000)` — cap is too generous)

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 3. CSP header blocks Google Fonts — Inter font never loads
- **What**: `vercel.json` CSP has `style-src 'self' 'unsafe-inline'` and `font-src 'self'`. Neither allows `fonts.googleapis.com` (stylesheet) or `fonts.gstatic.com` (woff2 files). `index.html:14–16` loads Inter via Google Fonts links.
- **Where**: `vercel.json:15`, `index.html:14–16`
- **Why it matters**: Every user of the deployed app sees the system font stack instead of Inter. The carefully tuned typography (font weights 400/500/600/700/800, letter-spacing, tracking) degrades silently. The share stats card (`index.html:10214`) calls `ctx.font = '800 46px Inter'` — without the font loaded the canvas renders with a mismatched fallback.
- **Effort**: S
- **Suggested fix**:
  - In `vercel.json`, add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src`
  - Alternatively self-host the Inter font subset (eliminates the third-party dependency and the CSP problem at once)

---

### 4. Givelink "This Week" grid is unusable on mobile — 7 columns crush to illegible chips
- **What**: The week view renders a 7-column CSS grid. The inline JS at `givelink.html:682–685` only applies a `1fr 1fr` collapse at `<600px` viewport width, but: (a) it runs only once on render, not on resize; (b) 600–1024px range still gets all 7 columns, each <120px wide.
- **Where**: `givelink.html:672–684`
- **Why it matters**: Givelink's primary use case (sprint planning) is mobile-heavy. A Monday morning 7-column view on an iPhone or iPad shows task titles truncated to 1–2 words. The "This Week" view shipped in PR #84 (2026-09-12) but is effectively broken on mobile.
- **Effort**: S
- **Suggested fix**:
  - Replace the inline `grid-template-columns: repeat(7,1fr)` style with a CSS class
  - Use `grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))` and let tasks reflow naturally
  - Remove the JS resize hack entirely — it's fragile and doesn't handle orientation changes

---

### 5. Share stats card still shows old "TaskOS" branding after rebrand to Arete
- **What**: `_drawStatsCard()` canvas function hard-codes "Task" + "OS" as the logo text and `task-management-beige-eight.vercel.app` in the footer.
- **Where**: `index.html:10214–10215, 10232`
  ```js
  x.fillText('Task',170,124);
  ...
  x.fillText('OS',170+tw,124);
  ...
  x.fillText('Made with Arete · task-management-beige-eight.vercel.app',96,H-70);
  ```
- **Why it matters**: Every "share my progress" card posted to X/LinkedIn/WhatsApp says "TaskOS". This actively undermines the Arete rebrand and sends users to the wrong mental model. High virality surface — worse with every share.
- **Effort**: S
- **Suggested fix**:
  - Replace `'Task'+'OS'` with `'Arete'` in a single `fillText` call
  - Update the footer URL to the custom domain (or at minimum to `arete.app` when it lands)
  - Update `_APP_URL` const at `index.html:10180` from the Vercel subdomain to the custom domain

---

### 6. `aiProxy` blank — AI features silently fail for all users without their own API key
- **What**: `APP_CONFIG.aiProxy` is an empty string (`index.html:9959`). The proxy at `/api/claude.js` exists and is deployed on Vercel but is not wired in. When `aiProxy` is blank, every AI call falls through to `S.claudeKey` (the user's personal key). The result: "Add Claude API key in Settings first" toast on first use.
- **Where**: `index.html:5007–5008, 9959`
- **Why it matters**: New users who sign up for Arete — specifically drawn by the "AI plans your day" headline on the landing page — hit a dead end. The #1 conversion and retention lever is unreachable without a developer step (adding personal API key). This directly kills day-1 activation.
- **Effort**: S (the proxy is already deployed — it just needs the URL pasted in)
- **Suggested fix**:
  - Set `aiProxy: 'https://task-management-beige-eight.vercel.app/api/claude'` in `APP_CONFIG`
  - Add the `ANTHROPIC_API_KEY` environment variable to the Vercel project settings if not already present
  - Add a usage-based guardrail (see P0#2) before enabling this for all users

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 7. Single 14,926-line monolithic file — no build step, no splitting
- **What**: All CSS (837 lines), HTML (1,664 lines), and JavaScript (12,425 lines) live in `index.html`. There is no bundler, no TypeScript, no tests.
- **Where**: `index.html` entirely
- **Why it matters**: Adding or refactoring any feature requires navigating a 14k-line file. Git diffs for any change are unrevierable. There is no dead-code elimination, tree-shaking, or minification. A Vite migration with section-based file splitting would cut review time by 80% and enable TypeScript/testing.
- **Effort**: L
- **Suggested fix**:
  - Adopt Vite as a zero-config bundler; migrate JS sections to `/src/modules/*.js`
  - Keep the no-framework philosophy — vanilla JS modules work fine with Vite
  - Start with the largest independent sections (Supabase sync ~300 lines, AI calls ~200 lines) as standalone modules

---

### 8. Canvas share card assumes Inter font is available — silently breaks when CSP blocks it
- **What**: `_drawStatsCard()` calls `ctx.font = '800 46px Inter, sans-serif'` repeatedly. Since the CSP currently blocks Google Fonts (see P1#3), the canvas renders with the browser's default sans-serif — different weight, letter-spacing, and character width than Inter. The text layout (x-offsets are hardcoded) overflows or misaligns.
- **Where**: `index.html:10214–10232`
- **Why it matters**: The share card is the primary viral loop — it's the "proof of progress" share that drives referrals. A misaligned card looks unprofessional and lowers share rates.
- **Effort**: S
- **Suggested fix**:
  - Fix the CSP first (P1#3); that resolves the root cause
  - As a defensive measure, add `document.fonts.load('800 46px Inter')` before calling `_drawStatsCard()` and await it

---

### 9. Inline `onclick="..."` handlers throughout — blocks CSP hardening
- **What**: Hundreds of `onclick="fn()"` inline event handlers in generated HTML strings throughout `index.html`. The current CSP requires `'unsafe-inline'` in `script-src` specifically to support these.
- **Where**: `index.html` — representative examples at 5081, 5092, 10000, 10292 (there are 200+ instances)
- **Why it matters**: `'unsafe-inline'` in `script-src` is the main remaining XSS vector. Removing inline handlers and switching to a delegated event pattern would allow dropping `'unsafe-inline'` and prevent any injected `<script>` from running.
- **Effort**: L
- **Suggested fix**:
  - Adopt a data-attribute delegation pattern: `data-action="closeModal" data-target="triage-modal"` + one top-level `document.addEventListener('click', handler)`
  - This is a progressive refactor — start with the most injection-adjacent surfaces (triage modal, templates modal)

---

### 10. `_sbScheduleSync` is not called after the first 900 ms boot sync — changes may not flush
- **What**: On boot at `index.html:10666`, there is `setTimeout(()=>{sbSyncNow()},900)`. After that, `save()` calls `_sbScheduleSync()` (a debounced push). However, the `_sbScheduleSync` function at `index.html:10606` guards with `if(!_sbEnabled()||_sbApplying)return` — but `_sbEnabled()` requires `_SB.refresh && _SB.uid` which are only present after a successful login. Before login completes, `save()` calls are silently not scheduled. This is by design for local-only users but could cause missed syncs for users who login slowly (e.g. on a poor connection where the boot-time `sbSyncNow()` at line 10666 fires before `_sbEnabled()` returns true).
- **Where**: `index.html:10606–10610, 10666`
- **Why it matters**: Low probability in practice (the 900ms boot sync races login), but a user who saves data during the login flow and immediately closes the tab can lose those changes.
- **Effort**: S
- **Suggested fix**:
  - In `_afterAuth()` (line 10126), after `await sbSyncNow(true)`, also call `_sbRenderPill()` (already present) and fire another debounced sync to catch any saves that happened during the auth flow window

---

## 💡 P3 — Nice to have

### 11. `canonical` URL in landing.html points to Vercel subdomain — SEO penalty
- **What**: `<link rel="canonical" href="https://task-management-beige-eight.vercel.app/">` — the Vercel deployment URL, not a branded custom domain.
- **Where**: `landing.html:11`, also `og:url`, `og:image`, `twitter:image`
- **Why it matters**: All backlinks and SEO equity accumulate on a `*.vercel.app` URL. When a custom domain is added, all that equity transfers only if canonicals are updated. Starting clean on a custom domain from day one is much better.
- **Effort**: S
- **Suggested fix**:
  - Register `arete.app` (or similar) and add it to Vercel as a custom domain
  - Update the canonical + OG URLs in `landing.html`, `index.html`, `givelink.html`, `sitemap.xml`, and `_APP_URL` const

---

### 12. Magic link failure always shows a generic "try again" message
- **What**: `authMagic()` at `index.html:10102` catches any non-200 response and shows a single hardcoded error: "Could not send the link — try again in a moment" regardless of whether the actual failure is rate limiting, an invalid email, or a Supabase outage.
- **Where**: `index.html:10097–10106`
- **Why it matters**: Users who mistype their email get the same unhelpful message as users who are rate-limited. This is a conversion friction point — users abandon rather than figuring out the issue.
- **Effort**: S
- **Suggested fix**:
  - After `if(!r.ok)`, read the response body: `const err = await r.json().catch(()=>({}))`
  - Map common Supabase error codes to readable messages (e.g. `rate_limit_exceeded` → "Slow down — wait 60 seconds and try again")

---

### 13. No keyboard shortcut reference overlay for new users
- **What**: The app has ~25 keyboard shortcuts (captured in the KEYBOARD section at `index.html:10636`) but there's no `?` or `/` shortcut to show them.
- **Where**: `index.html:10636–10643`
- **Why it matters**: Power-user shortcuts (Ctrl+K, Q for quick capture, etc.) are the core differentiator vs. mobile-first competitors, but new users never discover them unless they stumble into ⌘K.
- **Effort**: S
- **Suggested fix**:
  - Add `?` key handler that opens a modal listing all shortcuts grouped by context (navigation, task actions, capture)
  - Surface it as a tip in the first-run onboarding tour

---

_Total items: 13 across 4 tiers. Items within each tier are ordered by ROI._
