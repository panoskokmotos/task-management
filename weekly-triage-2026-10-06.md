# Weekly Triage — 2026-10-06

## 📊 Week at a glance
- Commits this week: **0** (last commit was 2026-09-12, 24 days ago)
- Files changed this week: 0
- Debt markers added this week: 0
- High-churn files (all time): `index.html` (touched in 10 of last 15 commits), `givelink.html` (4 of last 15)

_No new code was pushed this week. The analysis below covers the two most recent commits (#84, #85 from 2026-09-12) and pre-existing issues in the codebase that are likely to bite._

---

## 🚨 Needs immediate attention

### 1. Claude API key sent from browser with `dangerous-direct-browser-access` header
- **File**: `index.html:5022`
- **Commit**: `72e03fe` (Givelink bug fixes and This Week view)
- **Why this matters**: `APP_CONFIG.aiProxy` is an empty string (line 9959). When a user enters their Claude key, all AI calls bypass the proxy and go directly to `api.anthropic.com` from the browser with `anthropic-dangerous-direct-browser-access: true`. The key is transmitted on every AI request, visible to any network observer or browser extension. The proxy at `api/claude.js` is effectively never used.

### 2. `givelink.html` stores Anthropic API key via `window.prompt()` → localStorage
- **File**: `givelink.html:1155, 1330`
- **Commit**: `72e03fe`
- **Why this matters**: Two separate `getApiKey()` implementations both use `window.prompt()` to collect the Anthropic key and store it unencrypted in `localStorage` under `taskos_api_key`. Any XSS or malicious extension can read this. No proxy support exists in Givelink at all.

### 3. API proxy has no rate limiting — acknowledged but unresolved
- **File**: `api/claude.js:12`
- **Commit**: present since proxy was added
- **Why this matters**: The comment literally says "add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill." This hasn't been actioned. Any authenticated user can loop the `/api/claude` endpoint indefinitely.

### 4. PostHog keys empty — analytics completely non-functional
- **File**: `index.html:9960`, `landing.html:702`
- **Commit**: present since landing/analytics work in PRs #74–#83
- **Why this matters**: ~15 `track()` call sites are live (signup, firstrun_started, firstrun_skipped, import_done, etc.) but PostHog never initialises. The product has no visibility into conversion, activation, or retention.

---

## 🧹 Cleanup opportunities

### 5. `givelinkMetrics` and `givelinkHistory` serialised for every user
- **File**: `index.html:2517`
- **Commit**: present since rebrand PR #80 (Givelink metrics were not removed from S)
- **Why this matters**: `givelinkMetrics.impactModel` (6 fields) and `givelinkHistory` (array) are stored in every user's localStorage and synced to Supabase even for users who never open Givelink. Wasted bytes on every save.

### 6. 15+ seeded tasks categorised as `givelink` shown to new users
- **File**: `index.html:4546–4754`
- **Commit**: `72e03fe` — tasks survive the rebrand
- **Why this matters**: "Nonprofits Board Follow Ups", "Greek Nonprofits Board (Make-A-Wish etc)", "Find how to use OpenClaw" are seeded as default tasks for any new user. Non-Givelink users see tasks that mean nothing to them, hurting first-run impression.

### 7. 71 silent `catch(e){}` blocks
- **File**: `index.html` — throughout (lines 2573, 2583, 2587, 2983, 3031, 3583, 3868, 3979, and 62 more)
- **Commit**: accumulated over multiple PRs; most recently in `72e03fe`
- **Why this matters**: A crash in `_startFirstRun()` (critical onboarding path) is completely silent. Production bugs are invisible. The pattern `try{fn();}catch(e){}` is used to guard UI rendering but also hides real JS errors.

### 8. `renderGivelinkDash` still navigable as `givelink-dash` view
- **File**: `index.html:2984, 8618`
- **Commit**: `72e03fe` — not removed during rebrand
- **Why this matters**: Navigating to `#givelink-dash` renders a Givelink-specific CRM dashboard inside the Arete app. Confusing for any non-Givelink user who stumbles on it.

### 9. `document.execCommand('copy')` deprecated fallback in Givelink
- **File**: `givelink.html:1695`
- **Commit**: `72e03fe`
- **Why this matters**: `execCommand` is removed in Safari 17+ and marked for removal in Chrome. Clipboard copy silently fails on modern Safari.

---

## 🤔 Worth a second look

### 10. `renderWeekPlan()` added in #84 — no error state if `curTasks()` throws
- **File**: `givelink.html` (new `renderWeekPlan` function added in `72e03fe`)
- **Why this matters**: The new Week Plan view calls `curTasks()` and renders directly into innerHTML with no guard for an empty/error state. If task data is malformed, the week view renders blank with no user feedback.

### 11. Supabase keep-alive workflow may not be sufficient
- **File**: `.github/workflows/supabase-keepalive.yml` (added in `160f0d8`)
- **Why this matters**: The workflow pings Supabase to prevent auto-pause. This is a workaround for the Supabase free-tier inactivity pause. Worth checking if this is the intended long-term solution or if upgrading to a paid tier (which removes the pause) is more reliable.

### 12. `_SB.url` and `_SB.anon` read from localStorage on every access
- **File**: `index.html:9964–9966`
- **Why this matters**: `_SB` is an object with getter functions that call `localStorage.getItem` on every access. In tight loops (Supabase sync iterating tasks), this generates hundreds of localStorage reads per sync cycle. Consider caching the values on first read.
