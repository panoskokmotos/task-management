# Arete / Givelink — Improvement Plan
_Generated 2026-10-11 · Reviewed 2026-10-16 · P0 items 1–5 still open_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Google Fonts blocked by CSP → app renders in fallback font
**What**: `vercel.json` CSP `style-src` and `font-src` only allow `'self'` — Google Fonts URLs (`fonts.googleapis.com`, `fonts.gstatic.com`) are missing, so Inter never loads for new visitors in Chromium.
**Where**: `vercel.json` lines 12–13 (`style-src`, `font-src`)
**Why it matters**: Every new user (who hasn't cached the font) sees browser-default sans-serif. The carefully tuned typography — tight tracking, 800-weight logo — looks broken.
**Effort**: S
**Suggested fix**:
- Add `https://fonts.googleapis.com` to `style-src`
- Add `https://fonts.gstatic.com` to `font-src`
- Or self-host Inter via `@font-face` to remove the dependency entirely

---

### 2. AI features silently broken — `aiProxy` is empty and no fallback UI
**What**: `APP_CONFIG.aiProxy` is blank (`''`) in production (`index.html:9959`). Every AI call (`callClaude`) checks `if(!S.claudeKey && !APP_CONFIG.aiProxy)` — meaning users who haven't pasted a personal key get a toast but no path forward. The proxy endpoint (`api/claude.js`) exists and works, but its URL was never wired in.
**Where**: `index.html:9959`, `api/claude.js:1`
**Why it matters**: "Plan my day", auto-triage, AI workflows, and the morning briefing all fail silently for every user who signed up expecting AI to work out of the box. This is the core value proposition.
**Effort**: S
**Suggested fix**:
- Set `aiProxy: '/api/claude'` (relative works on Vercel) in `APP_CONFIG`
- Verify the serverless function has `ANTHROPIC_API_KEY` set in Vercel environment variables
- Add a settings banner when both `claudeKey` and `aiProxy` are missing, instead of just a toast

---

### 3. Unescaped task/goal titles in Weekly Review wizard — stored-XSS risk
**What**: `renderWizPanel()` injects task and goal titles directly into `innerHTML` without `esc()` in multiple branches (lines 3594, 3601, 3603). `esc()` exists and is used elsewhere; these three wizard panels missed it.
**Where**: `index.html:3594`, `3601`, `3603`
**Why it matters**: Any task title containing `<script>` or event handlers (`<img onerror=...>`) executes when the Weekly Review opens. All user data is stored in localStorage — cross-user risk is low, but this is a self-XSS that could fire on every weekly review.
**Effort**: S
**Suggested fix**:
- Replace bare `${t.title}` with `${esc(t.title)}` in all three `body.innerHTML=` assignments
- Add a lint rule or grep-CI check for `innerHTML.*\$\{(?!esc)` to catch future regressions

---

### 4. `--faint` CSS variable is used but never defined → invisible text
**What**: Five places use `var(--faint)` (lines 144, 301, 917, 6267, 6268), but `:root` and `body.light` never declare `--faint`. Browsers fall back to transparent/inherit, making those labels invisible.
**Where**: `index.html:44–59` (`:root` block), usages at lines 144, 301, 917, 6267–6268
**Why it matters**: Goal-group task counts (`.gg-ct`), the capture hint, and goal-card link counts are silently invisible. Users lose context about how many tasks remain.
**Effort**: S
**Suggested fix**:
- Add `--faint: rgba(255,255,255,.28);` to `:root` (dark mode)
- Add `--faint: rgba(0,0,0,.28);` to `body.light`
- Audit whether `--faint` and `--muted` should be consolidated

---

### 5. Hardcoded Vercel preview URL in OG tags and `_APP_URL`
**What**: `og:url`, `og:image`, `twitter:image`, and `_APP_URL` all point to `https://task-management-beige-eight.vercel.app/` (lines 24–25, 32, 10180). Social previews and any share-card logic will break the moment the custom domain is set.
**Where**: `index.html:24`, `25`, `32`, `10180`
**Why it matters**: Every tweet, iMessage preview, and Slack unfurl shows the wrong URL. Social sharing is a PLG surface.
**Effort**: S
**Suggested fix**:
- Replace the hardcoded URL with the production domain (e.g. `https://arete.app`)
- Extract it to `APP_CONFIG.appUrl` so it can be changed in one place

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. No per-user rate limiting on `/api/claude` proxy
**What**: `api/claude.js` has no rate limiting. Any signed-in user (or anyone who gets the URL) can call it without bound, running up the Anthropic bill. The comment at line 13 notes this explicitly: "For production add per-user rate limiting".
**Where**: `api/claude.js:13`
**Why it matters**: A single power user or a leaked URL could exhaust the Anthropic credit in hours. This isn't a future concern — it blocks making `aiProxy` non-empty (P0 #2 above).
**Effort**: M
**Suggested fix**:
- Add Upstash Redis rate limiting (the standard Vercel pattern): 10–20 AI calls per user per hour
- Tie the limit to `_SB.uid` from the verified Supabase token
- Return `429` with a human-readable retry-after so the client can show a useful message

---

### 7. Guest nudge toast uses raw HTML in `toast()` but toast stack renders with `textContent`
**What**: `_maybeGuestNudge()` calls `toast(...)` with an embedded `<span onclick="openAuthGate()">` (line 2594). If `toast()` uses `textContent` internally the HTML is shown as literal text; if it uses `innerHTML` it's fine but untested. Either way the nudge copy reads oddly when the HTML leaks.
**Where**: `index.html:2594`
**Why it matters**: The guest-nudge is the single most important conversion moment (the user has built ≥9 tasks and hasn't created an account). A broken or garbled toast kills the conversion.
**Effort**: S
**Suggested fix**:
- Find the `toast()` implementation and confirm it renders HTML safely (or switch to a rich-toast API that accepts a DOM node)
- Add an "action" parameter to toast (`toast(text, duration, onClickFn)`) so the CTA is never embedded as raw HTML

---

### 8. `callClaude` with direct API key sends key over the network in the browser
**What**: When a user enters their own Claude key in Settings, it is stored in `S.claudeKey` (serialised into `localStorage`) and sent in an `x-api-key` header directly to `api.anthropic.com` from the browser (line 5021). The CSP in `vercel.json` allows this (`connect-src … https://api.anthropic.com`), but the key is visible in DevTools Network tab.
**Where**: `index.html:5019–5026`
**Why it matters**: Users who share their screen, use a public computer, or have browser extensions that log network traffic will leak their Anthropic key. It also means any XSS (see P0 #3) can exfiltrate the key.
**Effort**: M
**Suggested fix**:
- Once the proxy (P0 #2) is live, remove the direct-API path entirely and always go through the proxy
- Migrate any users with stored `claudeKey` with a one-time migration that tells them the proxy handles things now

---

### 9. Mobile Eisenhower grid hides its axis labels (`display:none`) but doesn't explain the layout to the user
**What**: The mobile media query at line 342 hides `div:nth-child(1)`, `(2)`, `(3)`, `(4)`, `(7)` of `.eg` — the axis labels and column/row headers — leaving 4 unlabelled quadrant buckets with no legend.
**Where**: `index.html:342`
**Why it matters**: The Eisenhower matrix is conceptual — users can't use it if they don't know which quadrant is which. On mobile (where >50% of sessions likely happen), the tool is opaque.
**Effort**: S
**Suggested fix**:
- Add a compact inline legend above each quadrant (e.g. "DO FIRST" badge inside `.eq.e1`) that is always visible, not relying on the external axis labels
- Or show a one-time tooltip/guide when the user first opens the view on mobile

---

### 10. `profileName` defaults to `'Panos'` for all new users
**What**: Line 2519: `let profileName=localStorage.getItem('taskos_name')||'Panos';`. Any new user who hasn't set a name sees "Panos" in the morning briefing, dashboard greeting, and other personalised copy.
**Where**: `index.html:2519`
**Why it matters**: Immediate uncanny-valley moment that breaks trust. The app calls them by the developer's name.
**Effort**: S
**Suggested fix**:
- Change the default to `''` or `'Friend'`
- Trigger a "What should I call you?" prompt during first-run onboarding (the brain-dump flow already exists — add a name field there)

---

### 11. No CORS header on `/api/claude` — blocks non-Vercel deployments
**What**: `api/claude.js` sets no `Access-Control-Allow-Origin` header and does not handle `OPTIONS` preflight requests. The Vercel dev server works because the SPA is same-origin, but any user self-hosting or testing from localhost will get CORS errors.
**Where**: `api/claude.js:15–49`
**Why it matters**: Contributors, self-hosters, and anyone following the README who points a local copy at a deployed `/api/claude` can't use AI features.
**Effort**: S
**Suggested fix**:
- Add `res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')` for POST
- Add early return for `OPTIONS` with `204`

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 12. `index.html` is a 14,926-line monolith
**What**: The entire app — CSS, HTML, 13,000+ lines of JS — lives in one file. The givelink dashboard (`renderGivelinkDash` at line 8618), review wizard (3583), and AI lab (5394) are each hundreds of lines.
**Where**: `index.html` (entire file)
**Why it matters**: Any change risks breaking an unrelated view. Conflict resolution on PRs is brutal. Lighthouse and browser parse times increase. Every deploy ships the entire app.
**Effort**: L
**Suggested fix**:
- Extract CSS to `styles.css`, the `APP_CONFIG` block to `config.js`
- Move each major render function (renderGivelinkDash, renderHealth, renderReview, renderAilab) to a module loaded lazily
- This doesn't need to happen at once — each PR can move one section

---

### 13. `sbSyncNow` uses last-write-wins with no conflict resolution
**What**: `sbSyncNow` (line 10412) compares `remote.ms > localMs` and blindly overwrites local state. If two devices save within the same second, one change is silently dropped.
**Where**: `index.html:10418–10425`
**Why it matters**: Users who work on mobile and desktop simultaneously will silently lose tasks. This is the most common usage pattern for a "syncs everywhere" tool.
**Effort**: M
**Suggested fix**:
- Move to per-task `updatedAt` timestamps and a merge strategy (remote wins per task, not per entire blob)
- At minimum, show a "conflict detected — which version to keep?" prompt when `remote.ms === localMs ± 5s`

---

### 14. Supabase anon key is hardcoded in source (low severity, but needlessly public)
**What**: `APP_CONFIG.supabaseAnon` at line 9958 is set to a real publishable key: `sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M`. Anon keys are designed to be public, but having them in git makes rotation painful.
**Where**: `index.html:9958`
**Why it matters**: Rotation requires a code deploy. If the project is ever open-sourced, it exposes the project URL to scraping. Low risk, higher hygiene.
**Effort**: S
**Suggested fix**:
- Move `supabaseAnon` and `supabaseUrl` to Vercel environment variables
- Serve them via a lightweight `/api/config` endpoint or inject them at build time via a Vercel build step

---

### 15. `renderWizPanel` inlines entire step HTML as a single string with nested template literals 5 levels deep
**What**: Lines 3594–3611, each `body.innerHTML = \`...\`` assignment nests template literals inside template literals inside `.map()` callbacks — impossible to read, test, or diff.
**Where**: `index.html:3589–3611`
**Why it matters**: This is the Weekly Review flow — a high-value, high-frequency feature. Any bug is invisible until a user hits it. Adding a step or changing copy means editing a 200-character minified string.
**Effort**: M
**Suggested fix**:
- Extract each wizard step to a named function: `renderWizStep0()`, `renderWizStep1()`, etc.
- Each function returns a DOM fragment built with `createElement` or a simple template helper

---

## 💡 P3 — Nice to have

### 16. PostHog key is empty — zero product analytics
**What**: `APP_CONFIG.posthogKey` is `''` (line 9960). `track()` is called in 20+ places (signup, first_win, auth, etc.) but none of it reaches PostHog.
**Where**: `index.html:9960`
**Why it matters**: There's no data on where users drop off, which features drive retention, or whether the PLG funnel works. Can't A/B test anything.
**Effort**: S
**Suggested fix**:
- Create a PostHog project (free tier), paste the key into `APP_CONFIG.posthogKey` and Vercel env vars
- Verify the key is not exposed differently than the Supabase anon key (it's public by design in PostHog too)

---

### 17. Reminder / ntfy notifications have no error UX
**What**: `initReminders()` at line 13768 connects to ntfy.sh. The catch block at line 11291 calls `console.warn('Notification failed:', e)` with no user feedback.
**Where**: `index.html:11291`, `11335`
**Why it matters**: If the ntfy topic is misconfigured, reminders silently never fire. The user assumes they'll be reminded.
**Effort**: S
**Suggested fix**:
- Show a one-time toast when the first reminder fires successfully ("Reminders are working ✓") and a persistent warning badge if they fail
- Add a "Test notification" button in Settings

---

### 18. `_APP_URL` share-card logic uses `navigator.share` without checking iOS PWA vs browser
**What**: `_APP_URL` at line 10180 is used in share flows. On iOS Safari PWA mode, `navigator.share` is available but sometimes fails silently on certain URL schemas.
**Where**: `index.html:10180`
**Why it matters**: Share cards are the main Givelink viral loop. Silent failures kill K-factor.
**Effort**: S
**Suggested fix**:
- Wrap `navigator.share` in a try/catch with a fallback to clipboard copy + toast confirmation
- Log `track('share_failed', {reason: e.message})` when it fails so failures appear in PostHog

---

### 19. Landing page OG image and app OG image are the same file, sized for app
**What**: `landing.html` and `index.html` both reference `/og-image.png` (1200×630). The landing page would benefit from a distinct marketing preview while the app can keep its current one.
**Where**: `landing.html` (OG tags), `index.html:25`
**Why it matters**: Differentiated previews improve CTR on social links. Low effort, measurable impact.
**Effort**: S
**Suggested fix**:
- Create a `landing-og.png` with product copy ("Command your day. Quiet your mind.") and swap it into `landing.html`

---

### 20. `S.claudeKey` stored in plaintext localStorage alongside all user task data
**What**: The Anthropic API key is serialised as part of the `S` state blob in `localStorage['taskos']` (line 2517 has `claudeKey:''` in the default). Any `exportData()` call includes it.
**Where**: `index.html:2517`, `2598` (load), `2578` (save)
**Why it matters**: When a user exports their data to share with someone or for debugging, their API key is included in the JSON. Once the proxy is live (P0 #2), this field becomes obsolete.
**Effort**: S
**Suggested fix**:
- Store `claudeKey` in a separate `localStorage['taskos_claudekey']` key, not inside the synced blob
- Strip it from `exportData()` output
- Add a migration that moves it from `S.claudeKey` to the separate key on first load
