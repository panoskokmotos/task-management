# Weekly Triage — 2026-08-15

## 📊 Week at a glance
- **Commits this week**: 0 (last commit was 2026-07-22 — `b38d4bb`)
- **Files changed this week**: 0
- **Debt markers added this week**: 0 (no new commits to scan)
- **High-churn files (last 30 days)**: `index.html` (11 commits), `sw.js` (10 commits), `landing.html` (3 commits)

> No code was committed this week. Triage below covers residue from the July burst of 11 commits (PLG features, rebrand, guest mode, landing redesign) that landed without follow-up cleanup. These are the items most likely to bite.

---

## 🚨 Needs immediate attention

### 0. Every new user is greeted as "Panos" and all AI prompts use the owner's persona
`index.html:2519` (default name), `index.html:1070` (H1), `index.html:11672, 11734, 5445` (AI prompts)
The default name fallback is hardcoded to the developer's first name. The dashboard H1 is static HTML: "Good morning, Panos 👋". Three AI prompt templates inject "Panos, founder of Givelink (B2B SaaS for nonprofits)" as the user persona — so every AI response (morning briefing, triage, AI lab suggestions) is shaped around the owner's identity and business context. Present since before the July rebrand commits.
**Why this matters**: This is a launch-blocking bug. Every user who has not set their name sees someone else's name from the first second. AI features produce personalized content for the wrong person. Highest-priority fix in the codebase.

### 1. Push notification icon path is wrong — silent failure on every notification
`sw.js:47` — introduced in `0c1d32d` ("Rebrand to Arete … boot/timezone fixes")
References `./icons/icon-192.png` but the file is at `./icon-192.png` (no `icons/` folder). Push notifications fire without an icon; on Android this can suppress the notification entirely. Reminders are a retention mechanism — broken from day one of the rebrand.
**Why this matters**: Users who enabled reminders are receiving silent failures they have no way to diagnose.

### 2. `APP_CONFIG.aiProxy` hardcoded as empty string — AI features dead for all users
`index.html:9959` — present since at least `0e19b15` ("guest mode")
`aiProxy: ''` means every AI call (triage, plan-my-day, AI commands) falls back to "Add your Claude API key." The `/api/claude` serverless proxy is deployed and ready but not wired in. AI is the core pitch; this breaks it silently.
**Why this matters**: No AI = no differentiation from a plain to-do list. Every conversion from guest → account hits this wall.

### 3. `manifest-givelink.json` and `givelink.html` still precached — dead assets on every install
`sw.js:4, 6, 16` — not cleaned up in `d635c06` ("Remove Givelink from Task OS")
Commit #73 split the products but left the Givelink assets in the service worker STATIC and HTML arrays. These are fetched on every fresh install. If the files 404 (possible after a future cleanup), the `Promise.allSettled` will swallow the error silently but DevTools will show red.
**Why this matters**: Every install wastes bandwidth on dead assets. CACHE version `'arete-20260723'` was not bumped after this was noticed.

### 4. `CATS.givelink` and 20+ seed tasks shown to every new Arete user
`index.html:2503` (CATS), `index.html:4546–4711` (seed function)
Introduced before the product split. After `d635c06`, the Givelink category was removed from navigation but not from the CATS dictionary or the `seed()` function. New users get tasks like "Greek Nonprofits Board (Make-A-Wish etc)" and "Dex CRM — set up & use" in their Arete inbox.
**Why this matters**: New user onboarding is the highest-leverage moment. Seeing irrelevant B2B tasks on day one destroys the "calm, relevant, personal" brand promise.

### 5. XSS: `t.title` rendered as raw HTML in delete-undo toast
`index.html:3844` — present in the task delete handler
`` toast(`🗑 "<strong>${t.title.slice(0,30)}</strong>" deleted...`) `` — no escaping. A task titled `<img src=x onerror=alert(1)>` executes on delete. The `esc()` helper exists at line 11776 and is used in most other places, but missed here and at the blocking select (line 2543).
**Why this matters**: Self-XSS now; becomes higher severity if template import or shared goal links ever allow cross-user task content.

---

## 🧹 Cleanup opportunities

### 6. `givelinkMetrics` and `givelinkHistory` in default state `S`
`index.html:2517` — in the `S` object literal
`givelinkMetrics:{nonprofits:0,pipeline:0,arr:0,...}` and `givelinkHistory:[]` serialise into every user's localStorage on every save. There is no UI that reads them in the Arete product. Added when Givelink was part of the same codebase; never cleaned up in `d635c06`.
**Commit**: `d635c06` removed navigation but left the state.
**Why this matters**: Silent data debt. Will cause confusion if someone adds a field with the same name. Adds ~300 bytes to every localStorage write.

### 7. `window._justWelcomed` global for onboarding trigger
`index.html:10456, 10136` — set in the auth/boot flow, read in `_maybeOnboard()`
A window global used as a one-shot flag. Any other script, browser extension, or async timer that touches `window` can accidentally re-trigger onboarding. Introduced in `7c260f5` ("first-run onboarding tour").
**Commit**: `7c260f5`
**Why this matters**: If onboarding fires twice, users see the modal stack. Rare but non-zero risk on slow connections with multiple async paths.

### 8. `CACHE = 'arete-20260723'` not bumped after subsequent deploys
`sw.js:1` — set in `0c1d32d` (July 17), not changed in `b38d4bb` (July 22)
The July 22 landing commit (`b38d4bb`) changed `landing.html`, `robots.txt`, and `sitemap.xml` but did not bump the cache version. Users with an active service worker continue to serve the July 17 landing page from cache.
**Commit**: `b38d4bb` (the last commit) changed cached HTML without bumping the version.
**Why this matters**: The new comparison table, SEO meta changes, and analytics code in `b38d4bb` may not reach returning users until their browser auto-updates the SW (~24h after next visit).

### 9. Social post AI prompt references `givelink` as a writing angle
`index.html:6077` — inside the `generateTweet()` function
`const angles={founder:...,givelink:'startup progress building B2B SaaS for nonprofits',...}`. After the product split, clicking "Generate Tweet" with the Givelink angle produces Givelink-branded content for an Arete user. The angle selector is available in the UI.
**Commit**: Leftover from before `d635c06`.
**Why this matters**: Users see AI-generated copy about "B2B SaaS for nonprofits" — a product they don't use — when asking for a personal growth tweet. Confusing and off-brand.

### 10. Google Fonts loaded remotely — Inter unavailable offline
`index.html:14-16`, `sw.js:98-101`
`fonts.googleapis.com` is an external origin. sw.js explicitly routes all non-local requests as network-only. Going offline → Inter falls back to system fonts → visible layout shift and brand inconsistency.
**Commit**: Architecture choice from early commits; never revisited despite "offline-first" landing promise.
**Why this matters**: The comparison table on `landing.html` lists "Works fully offline" as an Arete-exclusive feature. The font failure is the first visible crack in that promise.

---

## 🤔 Worth a second look

### 11. `callClaude()` uses direct browser API key path with `anthropic-dangerous-direct-browser-access`
`index.html:5022` — in the non-proxy code path
When a user provides their own Claude API key in Settings, the key is sent in a request header directly from the browser. Anyone with DevTools open can copy the key. The header name `'anthropic-dangerous-direct-browser-access':'true'` is self-documenting about the risk.
**Why worth a look**: The proxy solves this for hosted users. The settings-key path is documented as a "self-host" option, but the UI doesn't warn the user their key will be visible in browser network traffic. Consider adding a one-line warning in the Settings UI.

### 12. PostHog `posthogKey` empty in both files — every `track()` call is a silent no-op
`index.html:9960`, `landing.html:699`
Analytics infrastructure is fully wired (30+ `track()` calls across the app: `auth_signup`, `onboarding_completed`, `ai_command`, etc.) but the key is empty. No data has ever been collected.
**Why worth a look**: Not a code bug, but a blind spot. Without analytics, there is no signal on whether PLG features shipped in July (templates, referrals, guest mode) are driving any conversions. Worth adding before the next growth push.

### 13. `aiAutoTriage` and `aiPlanDay` unlock pattern relies on sequential async, not `finally`
`index.html:5060, 5136` — `_aiUnlock()` called after `await callClaude()`, not in `finally`
If `callClaude()` throws (which it wraps internally, but edge cases exist), `_aiUnlock` at lines 5060/5136 is still reached in the current code. However, the lack of a `try/finally` block is a brittle pattern. A future refactor that adds an early `return` or `throw` inside `callClaude` could leave the lock permanently held, disabling the AI feature for the session.
**Why worth a look**: Not broken today, but the `_aiBtn()` helper pattern (line 2774) uses `try/finally` correctly. `aiAutoTriage` and `aiPlanDay` should follow the same pattern for consistency.

---

*Triage covers `index.html`, `sw.js`, `api/claude.js`, `landing.html`, and `givelink.html`. All 5 files changed in the last 30 days.*
