# Weekly Triage — 2026-08-17

## 📊 Week at a glance
- **Commits this week**: 0 | **Files changed**: 0 | **Debt markers added**: 0
- **High-churn files (last 30 days)**: `landing.html` (touched in 2 of the last 2 commits), `robots.txt`, `sitemap.xml`
- **Last commit**: b38d4bb (2026-07-22) — "Landing growth: analytics, SEO foundation, and comparison table"
- **Repo status**: Quiet week — no new code. Triage below covers existing technical debt identified in a full codebase scan.

_Note: since no code was committed this week, Steps 2 & 3 of the scan template ran against the full codebase rather than just changed files._

---

## 🚨 Needs immediate attention

### 1. `givelink.html:1131` — Anthropic API key called directly from browser
**Commit introduced**: pre-history (original AI Sprint Planner feature, before tracked range)
**Why this matters**: The API key is fetched from `localStorage` (or `window.prompt()`) and sent in an HTTP header directly to `api.anthropic.com` with `anthropic-dangerous-direct-browser-access: true`. Any DevTools session, browser extension, or XSS can steal the key. There is already a server-side proxy at `/api/claude.js` that should be used instead.

### 2. `givelink.html:1488` — Off-by-one in standup "yesterday" date
**Commit introduced**: pre-history (standup generator feature)
**Why this matters**: `yesterday.setDate(now.getDate()-2)` computes two days ago, not one. Tasks completed yesterday always show as "Nothing completed yet" in the AI-generated standup — the primary use case of the feature is silently broken.

### 3. `sw.js:48–49` — Push notification icon path doesn't exist
**Commit introduced**: likely b38d4bb or near (SW update), actual path uncertain without deeper bisect
**Why this matters**: `./icons/icon-192.png` is referenced for both the notification icon and badge, but no `icons/` subdirectory exists in the repo. The root-level `./icon-192.png` is the correct path. All push notifications (scheduled reminders) render with a broken icon; on some Android versions this causes the notification to fail silently.

### 4. `givelink.html:1358–1386` — CRM modal action buttons never render for most users
**Commit introduced**: pre-history (CRM feature)
**Why this matters**: `_showNPModal` creates the modal DOM once with `if(!m)` guard. The Delete, Log Activity, and Advance Stage buttons are conditionally included in that one-time HTML string based on `editNpId`. If the first call is `openAddNP()` (which sets `editNpId=null`), those buttons are absent from the DOM permanently. Users who ever open "Add Org" before "Edit" can never delete or advance a nonprofit through the pipeline — they just don't see the buttons.

### 5. `givelink.html:1264` — `callClaudeGL` never checks `res.ok`
**Commit introduced**: pre-history (shared AI utility)
**Why this matters**: HTTP 429 (rate limit) and 401 (bad key) both return `null` from the function with no distinction. The caller shows "Could not generate. Check your API key." on a rate limit — which causes users to rotate their key unnecessarily and erodes trust in the AI features.

---

## 🧹 Cleanup opportunities

### 6. `givelink.html:702` — `POSTHOG_KEY = ''` on landing (acknowledged in commit, never followed up)
**Commit**: b38d4bb ("Gated on a key you paste; a blank key is a silent no-op, so nothing fires until you opt in.")
**Why this matters**: The comment says "paste the same key from index.html" — that step was left as a follow-up and never happened. The landing page has never collected any analytics since it was built. No funnel data (which CTA, how far they scrolled, did they see the demo) exists for the new landing.

### 7. `givelink.html:882–1072` — 120+ real sprint tasks hardcoded as seed data
**Commit introduced**: original Givelink feature (pre-tracked range)
**Why this matters**: Real business tasks with contact names, org-specific notes ("Customer Onboarding Apollo — Quo"), and assignees are in a public GitHub repo. Any new browser/device will seed these as "current sprint" tasks, potentially overwriting real data if `S.seeded` isn't already set. This is both a data hygiene issue and a mild privacy risk.

### 8. `api/claude.js:13` — Rate limiting TODO deferred since launch
**Commit introduced**: original API proxy addition
**Why this matters**: The comment reads "For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill." This has never been addressed. The proxy is reachable by any authenticated user with no throttle.

### 9. `givelink.html:1521, 1621` — `document.execCommand('copy')` deprecated fallback
**Commit introduced**: pre-history
**Why this matters**: `document.execCommand` is removed from some modern browsers. The fallback silently fails in environments where it's gone. Since the app requires HTTPS, `navigator.clipboard.writeText` always works — the fallback is dead weight that gives false confidence of a graceful fallback.

### 10. `index.html:16–18` — Inter font loaded from Google CDN, blocks offline first run
**Commit introduced**: pre-history (font choice)
**Why this matters**: The app markets "Works offline ✓" but on first offline visit after a network switch, the Inter font may not be cached by the service worker (it's not in `STATIC` in `sw.js`). The browser falls back to system font and layout shifts. This is also a render-blocking resource on slow connections.

---

## 🤔 Worth a second look

### 11. `givelink.html:1675` — PWA install banner dismissed state persists in localStorage forever
`localStorage.setItem('gl_pwa_dismissed','1')` — once dismissed, the banner never returns, even across browsers or after app updates. This is common but worth a conscious decision: should a major update reset the prompt? There's currently no expiry or version check on this flag.

### 12. `sw.js:1` — Cache key `arete-20260723` is hardcoded with a date stamp
The cache key was last bumped on July 23. It hasn't been bumped with the branch being worked on, so users with the old SW cached will not receive any updates deployed on this branch until someone manually bumps the string. A build-time hash would be more reliable than a manually maintained date.

### 13. `givelink.html:1205–1251` — Task OS sync matches tasks by title string comparison
`tosData.tasks.find(tt=>tt.title&&tt.title.toLowerCase()===gt.title.toLowerCase())` — syncing tasks by title means two tasks with the same name will collide and only one will be synced. If a task is renamed in either system, it loses the connection. This is probably fine for current scale but will produce subtle bugs as the task list grows.

### 14. `landing.html:11` — Canonical URL is the Vercel default subdomain
`https://task-management-beige-eight.vercel.app/` appears in canonical, all OG tags, and `sitemap.xml`. If a custom domain is added later, the canonical will need a sweep — until then, search engines index the Vercel subdomain URL, which is both unmemorable and sends mixed signals about the brand.

### 15. `givelink.html:454–455` — `daysLeft()` and `sprintPct()` don't account for timezones
Both functions use `new Date()` (local time) against `new Date(S.sprint.end)` (date string, interpreted as midnight UTC). For users in UTC+X timezones, the sprint end day can appear one day earlier than intended. Low likelihood of real impact but worth noting if international use grows.

---

_Triage complete. 5 items flagged for immediate attention, 10 cleanup/watch items. No new debt added this week (quiet repo). Highest priority fix remains the API key exposure in `givelink.html:1131`._
