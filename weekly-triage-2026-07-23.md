# Weekly Triage — 2026-07-23

## 📊 Week at a glance
- **Commits**: 13 | **Files changed**: 13 | **Debt markers added**: 4
- **High-churn files**: `index.html` (11 commits), `sw.js` (8 commits), `landing.html` (3 commits)

---

## 🚨 Needs immediate attention

### 1. Share card still says "TaskOS" — missed in brand-consistency commit
- **File**: `index.html:10214–10215`
- **Commit**: `72d9c68` ("Brand consistency: rebrand update banner + purge stray old-brand colors")
- **Why this matters**: The commit's stated goal was purging old brand colors/text, but two `fillText` calls inside `_drawStatsCard()` still render "Task" + "OS" as the logo. Every user who shares a progress card (new PLG feature from `fb63461`) broadcasts the wrong brand name. This will silently undermine the rebrand for any viral spread that happens before it's fixed.

---

### 2. PostHog key left blank after landing analytics block was added
- **File**: `landing.html:702`
- **Commit**: `b38d4bb` ("Landing growth: analytics, SEO foundation, and comparison table")
- **Why this matters**: The entire analytics block was added in yesterday's commit, but `POSTHOG_KEY = ''` — every `track()` call is a silent no-op. The comparison table and hero CTA click tracking added in the same commit produce zero data. The landing → signup funnel remains completely unobserved.

---

### 3. Push notification icon path not fixed across 8 sw.js commits
- **File**: `sw.js:47–48`
- **Commits**: `0c1d32d`, `f883adf`, `fb63461`, `0e19b15`, `32e7288`, `7c260f5`, `a8586f3`, `d635c06` (cache key bumped in each; path not corrected)
- **Why this matters**: `icon: './icons/icon-192.png'` has been wrong since before this week — the correct path is `./icon-192.png`. The service worker was touched in 8 of this week's commits (each bumped the cache version string) and not one of them caught the broken path. Users who receive push notifications see a broken icon placeholder.

---

### 4. AI proxy still not deployed — PLG AI features blocked for all signed-in users
- **File**: `index.html:9959`
- **Commits**: `0e19b15` (guest mode), `7c260f5` (onboarding tour), `f883adf` (templates) — all three PLG-tier features call `callClaude()`, which requires `APP_CONFIG.aiProxy` or a personal API key
- **Why this matters**: Guest mode (`_enterGuest`) and the first-run brain-dump (`_frOrganize`) prominently use AI to organize tasks. The proxy at `/api/claude.js` is complete and deployed on Vercel but `aiProxy: ''`. Every user who tries an AI feature hits the "Add Claude API key" wall, which kills the no-friction PLG loop all three commits were building toward.

---

## 🧹 Cleanup opportunities

### 5. `_APP_URL` hardcoded to raw Vercel subdomain in referral link feature
- **File**: `index.html:10180`
- **Commit**: `32e7288` ("Product-led growth: referral links + share-the-win moments")
- **Code**: `const _APP_URL='https://task-management-beige-eight.vercel.app/';`
- **Why this matters**: This URL is baked into every referral link, share card, and invite message. It also shows up in the canvas-drawn share card footer (`index.html:10232`). Should be extracted to a constant that can be updated in one place once a domain is registered.

---

### 6. New guest-to-signup conversion path not tracked
- **File**: `index.html` around line 10129
- **Commit**: `0e19b15` ("Optimize acquisition: instant try-without-account guest mode")
- **Code**: `track('guest_to_signup',{})` is called, but `posthogKey` is blank — this event is never recorded.
- **Why this matters**: Guest → paid is the core PLG metric. Without the key filled in (see item #2 above), this conversion event — as well as `guest_started`, `firstrun_started`, `template_applied` — are all invisible.

---

### 7. Template deduplication not implemented — double-apply is silent
- **File**: `index.html:10267–10276` (`_applyTemplate`)
- **Commit**: `f883adf` ("PLG Tier 1: templates gallery + import")
- **Code**: No guard prevents the same template from being applied twice. `S.tasks.push(...)` runs unconditionally.
- **Why this matters**: A user who clicks "Use template" twice gets 10 duplicate tasks with no feedback. The toast says "Added the Weekly Reset template" both times. Low severity today, but will generate confusing user data.

---

### 8. First-run brain-dump calls `callClaude` without an aiProxy or key
- **File**: `index.html` around `_frOrganize` function
- **Commit**: `0c1d32d` ("Rebrand to Arete + first-run magic moment + landing + boot/timezone fixes")
- **Why this matters**: The first-run "Organize my day ✨" button is the flagship magic moment of the rebrand commit. If neither `APP_CONFIG.aiProxy` nor `S.claudeKey` is set (which they aren't in the current deployment), the button silently falls back to local NLP (`_frOrganize` local path). The fallback is functional but parses only simple patterns; the magic moment most users will experience is the local, not AI, version. Not a bug per se, but the commit's headline feature is degraded in production.

---

## 🤔 Worth a second look

### 9. `_welcomeSeed` sets `window._justWelcomed = true` but the flag may not survive a page reload
- **File**: `index.html:10456`, `10136`
- **Commit**: `0c1d32d`
- **Code**: `window._justWelcomed = true` is set in `_welcomeSeed()` and consumed in `_afterAuth()` (line 10136). If the Supabase magic-link auth flow causes a full page reload (which it does — the landing page replaces to `index.html`), `window._justWelcomed` resets to `undefined` between pages.
- **Why this matters**: New accounts may never see the onboarding tour (`_startFirstRun`) because the flag is lost. The session continuity between the auth callback redirect and the app boot should use `localStorage`, not `window.*`.

---

### 10. Service worker cache name `arete-20260723` matches today's date — was this a one-time bump or intended to rotate daily?
- **File**: `sw.js:1`
- **Commit**: `0c1d32d` (initial rebrand)
- **Code**: `const CACHE = 'arete-20260723';`
- **Why this matters**: If the convention is to update this on every deploy (as it was bumped in 8 commits this week), it will force a full cache re-download on every push, removing the offline-first benefit. If the intent is to bump it only on breaking cache changes, many of this week's sw.js commits that only changed the cache string (not the strategy) were unnecessary invalidations. Suggest adopting a hash-based cache name instead of a date.
