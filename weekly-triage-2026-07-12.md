# Weekly Triage — 2026-07-12

## 📊 Week at a glance
- **Commits:** 6 | **Files changed:** 10 unique | **Debt markers added:** 0 (no TODO/FIXME/HACK found in changed files)
- **High-churn files:** `index.html` (6/6 commits), `sw.js` (4/6 commits), `api/claude.js` (1 commit)
- **Test commits:** 0 — no test files exist in the repo; all testing is manual
- **"Fix" commits this week:** 2 — `c32b2ef` ("fix load-time init bug"), `9f898e0` ("Fix: new signups must not inherit the owner's seeded data")

---

## 🚨 Needs immediate attention

### 1. Push notification and in-app reminder icons return 404
**File:** `sw.js:41-42`, `index.html:10769`
**Introduced:** Predates this week's commits; not caught during the sw.js bump in `42775fc` (commit #60) or the rebrand in `1fb177a` (#67).
**Why this matters:** Every push notification and every in-app reminder fires with a broken icon path (`./icons/icon-192.png`). The actual file is at `./icon-192.png`. On Android the icon is blank; on some browsers the notification is silently dropped.
**Fix:** `s/\.\/icons\/icon-192\.png/\.\/icon-192\.png/g` in both files; bump `CACHE` key in `sw.js`.

---

### 2. `APP_CONFIG.aiProxy` is an empty string in the committed source
**File:** `index.html:9812`
**Introduced:** `e0b0a00` (#68, 2026-07-06) — the hosted-signup feature was shipped but the proxy URL was not wired in.
**Why this matters:** Every AI feature (Auto-triage, Plan My Day, AI commands, Task Reply) shows a "Add your Claude API key in Settings" error for hosted users. These are the headline features. The API proxy (`api/claude.js`) is deployed and ready — it just needs its URL in `aiProxy`.
**Fix:** Set `aiProxy: 'https://<your-vercel-domain>/api/claude'` in `index.html:9812`.

---

### 3. `authLogout()` and `sbDisconnect()` don't invalidate the server-side Supabase session
**File:** `index.html:9966-9970`, `index.html:9906-9908`
**Introduced:** `e0b0a00` (#68, 2026-07-06) — the auth flows were added this week.
**Why this matters:** Both functions clear the local tokens from `localStorage` but never call `POST /auth/v1/logout`. The refresh token stays valid on Supabase's servers for ~1 week. Anyone who obtains the old refresh token (e.g., on a shared device) can continue authenticating after the user "signed out."
**Fix:** Call the Supabase logout endpoint before clearing localStorage (wrap in try/catch so a network failure doesn't block local sign-out).

---

### 4. AI proxy has no rate limiting — any auth'd session can exhaust the Anthropic bill
**File:** `api/claude.js:12-13` (the TODO comment acknowledges this)
**Introduced:** `e0b0a00` (#68, 2026-07-06).
**Why this matters:** A looping client, a compromised token, or an intentionally abusive account can make unlimited calls to Anthropic. The `max_tokens` cap (2,000) limits individual call cost but not call frequency. Financial exposure is unbounded once the proxy URL is live.
**Fix:** Add Upstash Redis rate-limiting (5 req/min, 200 req/day per `user_id`) before the Anthropic call.

---

## 🧹 Cleanup opportunities

No explicit `TODO`/`FIXME`/`HACK`/`@ts-ignore` markers were added in files changed this week.

The following are implicit gaps introduced in recent commits:

### 5. `authMagic()` has no loading/disabled state
**File:** `index.html:9950-9959` — added in `e0b0a00` (#68)
**Context:** The password submit path (`authSubmit`) correctly disables the button and shows `…` while loading (line 9930). The magic-link path does not — a double-tap sends two OTP requests, which then hits Supabase's per-email cooldown and shows the user a confusing error.
**Fix:** Pattern-match the existing `authSubmit` loading guard; disable the button, set text to `Sending…`, re-enable on success/error.

---

### 6. Account chip (`#account-chip`) is a `<div>` with no keyboard access
**File:** `index.html:941` — added in `2fa1c76` (#70, 2026-07-06)
**Context:** The chip is a `<div onclick>` with no `tabindex` or `role`. Keyboard users can't tab to it and can't sign out without a mouse.
**Fix:** Add `tabindex="0" role="button" aria-label="Account options"` and a `keydown` handler (`Enter`/`Space` → `_openAcctMenu`).

---

### 7. `posthog.reset()` not called in `sbDisconnect()`
**File:** `index.html:9906-9908`
**Context:** `authLogout` (the hosted path) calls `posthog.reset()`. `sbDisconnect` (the self-hosted path) does not. If PostHog is later enabled, analytics from a new user on the same device will be attributed to the previous account.
**Fix:** Add `try{if(window.posthog&&posthog.reset)posthog.reset();}catch(e){}` to `sbDisconnect`, mirroring `authLogout`.

---

## 🤔 Worth a second look

### 8. `sbConnect()` auto-signs-up when login fails — may be intentional, definitely a footgun
**File:** `index.html:9891-9896`
**Context:** If `_sbAuth('password', ...)` throws (e.g. wrong password), the catch immediately calls the signup endpoint with the same credentials. This is designed for the self-hosted first-run flow where the user's account doesn't exist yet. But it means a wrong password silently creates a blank second account instead of surfacing the auth error.
**Verdict:** Probably intentional for the "enter your Supabase creds once" flow, but dangerous in any shared-Supabase deployment. Consider separating the "first time" and "returning" paths with an explicit UI branch.

---

### 9. `_welcomeSeed()` fires when `S.tasks` is empty AND no remote row exists — edge case: user who cleared tasks
**File:** `index.html:10078`, `10087-10103`
**Context:** Guard is `!remote && !S._welcomed && (!S.tasks||S.tasks.length===0)`. A returning user who deliberately emptied all their tasks would get re-seeded with the welcome tasks if they clear remote data too (e.g. reset their Supabase row). `S._welcomed` is the correct guard but it lives inside `S` — if the remote row is deleted, `S._welcomed` comes from localStorage only.
**Verdict:** Low probability, acceptable risk given the current user volume. If user self-service data deletion becomes a feature, add a dedicated `_welcomed` key outside of `S`.

---

### 10. `sw.js` cache key (`task-os-20260711`) changed 4 times this week — manual process is fragile
**File:** `sw.js:1` — bumped in commits `2fa1c76`, `9f898e0`, `e0b0a00`, `1fb177a`
**Context:** The service-worker cache version is a manually maintained string. It was bumped 4× this week across 4 separate commits, meaning it's being edited as an afterthought. A missed bump = PWA users see stale UI.
**Verdict:** Automate the bump. A one-line build script (`sed -i "s/task-os-[0-9]*/task-os-$(date +%Y%m%d%H%M)/" sw.js`) as a pre-deploy hook would eliminate this class of error.
