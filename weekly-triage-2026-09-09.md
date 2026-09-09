# Weekly Triage — 2026-09-09

## 📊 Week at a glance
- Commits this week: **0** | Files changed: 0 | Debt markers added: 0
- High-churn files: _none — no commits in the last 7 days_
- Note: Triage scope widened to current HEAD since there is no recent commit activity to scope to. Items below reflect the standing state of the codebase.

---

## 🚨 Needs immediate attention

### 1. Personal tasks seeded for every new user
- **File**: `index.html:4540–4760`
- **Commit**: First introduced in early seeding commits; still present as of HEAD
- **Why this matters**: Every new account gets injected with the developer's personal backlog including medical appointments, Greek-language tasks, financial details, and personal contact names. Real users see this on first login — makes the app look broken or hacked.

### 2. Push notification icon path doesn't exist
- **File**: `sw.js:47-48`
- **Commit**: Present since SW refactor
- **Why this matters**: `./icons/icon-192.png` is referenced for notification icon/badge, but only `./icon-192.png` exists (no `icons/` subdirectory). Push notifications silently display a broken icon or fail on strict browsers.

### 3. Notion API called directly from the browser (CORS-blocked)
- **File**: `index.html:10940`
- **Commit**: Added with integrations feature
- **Why this matters**: `api.notion.com` does not allow browser-to-API cross-origin requests. The Notion weekly-notes integration is dead in production but not flagged to users — they configure a token and nothing happens.

### 4. No rate limiting on `/api/claude` endpoint
- **File**: `api/claude.js:13`
- **Commit**: Present since proxy was added; the code comments it explicitly: "For production add per-user rate limiting"
- **Why this matters**: Unlimited authenticated requests to the Anthropic API; one user or a credential leak can drain the bill. `max_tokens` is capped at 2000 per request but there is no per-user or per-minute cap on request count.

### 5. `givelinkMetrics` / `givelinkHistory` still in global state after product separation
- **File**: `index.html:2517` (state default), `index.html:2503`, `index.html:2984`
- **Commit**: PR #73 removed the Givelink views but left state objects and the `renderGivelinkDash` registration intact
- **Why this matters**: Every user's synced Supabase snapshot carries Givelink-specific data. If a future clean-up migration runs against real data, stale keys may cause parse errors or data loss.

---

## 🧹 Cleanup opportunities

### 6. `console.error` in initial render falls through silently
- **File**: `index.html:10689`
- **Why this matters**: `console.error('initial render failed; falling back to dashboard', e)` logs the error but the UI continues without telling the user anything is wrong. If the startup render fails the user sees a blank view with no explanation.
- **Suggested action**: Wrap in a user-visible toast or a simple error banner so failures surface during debugging.

### 7. `console.warn` silencing real failures at startup
- **File**: `index.html:10656–10665` (all init calls wrapped in `try/catch` with `console.warn`)
- **Why this matters**: `resetRecurring()`, `_genDailyQuests()`, `_maybeShowWeeklyWrapped()`, `_initSidebarSwipe()` and `_autoSnapshot()` all fail silently. A startup regression in any of these is invisible in production.
- **Suggested action**: At minimum, log failures to an error tracking service or to PostHog (once analytics is wired up) so regressions are visible.

### 8. `APP_CONFIG.aiProxy` left empty in source — AI dead for all new users
- **File**: `index.html:9959`
- **Why this matters**: There is no in-code signal that this needs to be filled in before deploying. A developer forking or deploying this will ship with broken AI and no error message pointing to the fix.
- **Suggested action**: Add a startup assertion: `if (_hostedMode() && !APP_CONFIG.aiProxy) console.warn('[Arete] aiProxy not configured — AI features disabled for all users');`

### 9. `APP_CONFIG.posthogKey` left empty — analytics dead
- **File**: `index.html:9960`
- **Why this matters**: All `track()` calls are no-ops. Same issue as `aiProxy` — no signal that this needs to be configured.
- **Suggested action**: Same pattern — startup warning if `_hostedMode()` and `posthogKey` is empty.

### 10. Hardcoded personal Supabase anon key in source
- **File**: `index.html:9958`
- **Why this matters**: `sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M` is committed to the repository. Even as a "publishable" key, rotating it requires a source edit and redeploy. Better handled via environment variable injected at build time.
- **Suggested action**: Move to a Vercel environment variable (`VITE_SUPABASE_ANON` or similar), injected into the HTML at build/deploy time.

---

## 🤔 Worth a second look

### 11. `self.skipWaiting()` in SW install — may surprise users mid-session
- **File**: `sw.js:26`
- **Why this matters**: `skipWaiting()` activates the new service worker immediately, which can reload cached assets mid-session. This is intentional for fast deploys but can cause subtle UI glitches (e.g. a user mid-edit gets a stale JS bundle). Consider prompting users to reload instead.

### 12. `Promise.allSettled` in SW install hides asset fetch failures
- **File**: `sw.js:24`
- **Why this matters**: The comment says "Non-atomic: one missing/failed asset must not fail the whole install". This is a reasonable tradeoff, but means a broken `og-image.png` or missing icon silently ships without error. Worth adding a `console.warn` for rejected entries during development.

### 13. `_maybeOnboard()` wrapped in try/catch at line 13770 — onboarding may silently fail
- **File**: `index.html:13770`
- **Why this matters**: The first-run onboarding tour (PR #75) is the key activation moment. If `_maybeOnboard()` throws, new users see nothing — no tour, no empty state guidance — and may never understand the product.
- **Suggested action**: Remove the try/catch here (let it bubble so it's visible in development) or add explicit error recovery.

### 14. Readwise API called directly from browser — CORS unverified
- **File**: `index.html:10819`
- **Why this matters**: `readwise.io/api/v2` is called directly. Readwise has historically allowed browser CORS for their v2 API, but this is not documented. If they restrict it, the integration breaks silently.
- **Suggested action**: Verify CORS headers on `readwise.io/api/v2`, or proxy through the same serverless function used for Claude.

### 15. `esc()` function used inside template literal at `index.html:10848`
- **File**: `index.html:10848`
- **Why this matters**: Book titles from Readwise are injected into `onclick` attribute values via `esc()`. If `esc()` is an HTML entity encoder (not a JS string escaper), a book title with a single quote or backslash could break the inline handler and create an XSS vector.
- **Suggested action**: Check `esc()` implementation — it should JS-escape (replace `'` → `\'`, `\` → `\\`) for use inside `onclick`, not just HTML-encode. Better: use data attributes + a delegated event listener.
