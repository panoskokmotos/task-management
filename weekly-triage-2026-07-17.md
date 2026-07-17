# Weekly Triage — 2026-07-17

## 📊 Week at a glance
- Commits: 9 | Files changed: 4 (index.html, sw.js, MARKETING.md, og-image.png) | Debt markers added: 0 explicit TODOs
- High-churn files: **index.html** (9 commits), **sw.js** (9 commits)
- Theme: PLG / growth mechanics sprint — referral links, templates, share cards, guest mode, onboarding tour

---

## 🚨 Needs immediate attention

### 1. Service worker icon path is broken — push notifications show no icon
- **File**: `sw.js:42–43`
- **Commit**: `a8586f3` (Marketing: social-share previews…) — icon path was not updated when assets were reorganised
- **Why**: `icon:'./icons/icon-192.png'` and `badge:'./icons/icon-192.png'` point to a non-existent `icons/` folder. The actual path is `./icon-192.png`. Every push notification renders without the app icon — looks like an anonymous browser notification, reduces click-through.

### 2. Givelink sprint seed dates are 99 days in the past
- **File**: `givelink.html:437`
- **Commit**: predates this week (never updated after initial seed was written)
- **Why**: Default sprint is `2026-03-28 → 2026-04-11`. Today is 2026-07-17. Any fresh givelink.html load shows "0 days left", velocity at ∞, and an ETA chip that errors. Givelink is the Nonprofit CRM / sprint board used for live sales conversations — a broken header stat is bad in front of prospects.

### 3. CRM modal Delete button can appear on the "Add Nonprofit" form
- **File**: `givelink.html:1358–1390`
- **Commit**: predates this week (CRM was built earlier)
- **Why**: `_showNPModal()` creates the modal DOM once. The Delete button is injected at creation time based on `editNpId`. If the first modal open is "Edit", the Delete button is baked in forever — it shows even when adding a new org, and `deleteNP()` would delete the previously-edited org. Silent data loss risk.

### 4. `api/claude.js` proxy is missing CORS headers — will fail if wired up
- **File**: `api/claude.js:15–49`
- **Commit**: unchanged this week; risk is that this week's PLG commits push toward using the proxy
- **Why**: No `Access-Control-Allow-Origin` header, no OPTIONS preflight. Any call from the browser will fail with a CORS error before the request reaches Anthropic. `MARKETING.md:76` explicitly says "optionally deploy the `/api/claude` proxy" — if Panos wires this up without adding CORS, AI features break silently.

---

## 🧹 Cleanup opportunities

### 5. Standup generator re-fires on every modal open (wasted tokens)
- **File**: `givelink.html:1481`
- **Commit**: unchanged this week
- **Why**: `openStandup()` always calls `generateStandup()`. Re-opening the modal to copy text triggers a fresh 200-token Claude call. A simple `standupCache = {date, text}` guard would prevent this. ~$0.01 per extra call, more importantly adds 2–4s latency to a "copy text" action.

### 6. `runAiSprintPlanner()` duplicates the `callClaudeGL()` function
- **File**: `givelink.html:1097–1161` vs `givelink.html:1256–1272`
- **Commit**: unchanged this week
- **Why**: Two independent `fetch('https://api.anthropic.com/v1/messages', ...)` blocks with identical header logic. They've already drifted: sprint planner uses `claude-opus-4-5`, `callClaudeGL` uses `claude-haiku-4-5-20251001`. Model choice should be a parameter, not duplicated code.

### 7. `index.html` now has 13 bare `try{...}catch(e){}` swallow-all blocks at init
- **File**: `index.html:13519–13525`
- **Commit**: several this week (PLG features wrapped in defensive try-catch)
- **Why**: The init block at the bottom runs 7 functions in naked try/catch with no logging. Silent errors on init are hard to debug in production. The `console.warn` at `index.html:2509` is the right pattern — the init block should at minimum log caught errors.

### 8. Guest mode nudge in `try{}catch(e){}` with no error tracking
- **File**: `index.html:2498`
- **Commit**: `0e19b15` (guest mode, this week)
- **Why**: `_maybeGuestNudge()` — a feature added this week — is called inside a catch-silent try block. If it throws, nothing surfaces it. PostHog is already wired up; a `track('error', {fn:'guestNudge',e})` here would catch regressions.

---

## 🤔 Worth a second look

### 9. PLG templates gallery applies tasks + goal — no undo
- **File**: `index.html` (template apply logic, committed `f883adf` this week)
- **Why**: `_applyTemplate()` seeds tasks and a goal into the user's data. There's no undo or confirmation. A user who accidentally clicks "Use Template" on an active account could overwrite goal state. Worth adding a `confirm()` guard or a "Start fresh" option.

### 10. `shareStats()` (PLG Tier 2) draws to canvas without checking canvas support
- **File**: `index.html` (committed `fb63461` this week)
- **Why**: Canvas rendering for the progress card will silently fail in environments where `canvas` isn't supported (some older WebViews, certain PWA shells). Should check `canvas.getContext('2d')` and fall back to a static share message.

### 11. Referral capture stores `ref` in localStorage with no expiry
- **File**: `index.html` (`_captureRef()`, committed `32e7288` this week)
- **Why**: `localStorage.setItem('taskos_ref', ref)` has no TTL. A user who loads the app with `?ref=abc` and then signs up 30 days later still carries that referral credit. This probably over-attributes referrals. Common fix: pair with a `taskos_ref_at` timestamp and reject if older than 7 days.

### 12. Onboarding tour (`_startOnboarding`) fires inside a `setTimeout` with no guard against repeat fires
- **File**: `index.html` (committed `7c260f5` this week)
- **Why**: `setTimeout(()=>{try{_startOnboarding();}catch(e){}},650)` at two call sites. The guard `window._justWelcomed` prevents one of them, but the guard isn't cleared atomically with the timeout. If the user navigates quickly (e.g. router change), both timeouts could resolve and fire the tour twice.
