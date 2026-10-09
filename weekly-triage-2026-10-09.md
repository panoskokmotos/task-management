# Weekly Triage — 2026-10-09

## 📊 Week at a glance
- **Commits this week**: 0
- **Files changed**: 0
- **Debt markers added**: 0
- **High-churn files**: None — repository has been quiet since 2026-09-12

The last 7 days had no commits. The most recent work (commits #84 and #85, both 2026-09-12) shipped the Givelink "This Week" view and the Supabase keep-alive GitHub Actions workflow. No new tech debt was introduced in the past week.

---

## 🚨 Needs immediate attention

None introduced this week. However, three pre-existing issues in the codebase warrant production attention regardless of when they were introduced:

### `sw.js:47–48` — broken push notification icon path
- **File**: `sw.js`, lines 47–48
- **Commit**: Likely present since the PWA push notification feature was added; confirmed present in `160f0d8` (HEAD)
- **Issue**: `icon:'./icons/icon-192.png'` references a non-existent `icons/` subdirectory. The actual icon is at `./icon-192.png`. Push notifications have no icon on all platforms.
- **Why this matters**: The habit streak nudge (runs every evening at 21:00) and any future push reminders fire silently with a broken icon — or are suppressed entirely on iOS.

### `api/claude.js:12` — no rate limiting on the AI proxy
- **File**: `api/claude.js`, lines 12–13
- **Commit**: Present since `api/claude.js` was created; confirmed in `160f0d8` (HEAD)
- **Issue**: A comment explicitly notes "For production add per-user rate limiting (e.g. Upstash)" but it was never implemented. Any authenticated user can hit the proxy in a tight loop.
- **Why this matters**: Unbounded Anthropic API spend. One malicious or runaway client can exhaust the key.

### `vercel.json:15` — CSP blocks Google Fonts
- **File**: `vercel.json`, line 15; `index.html:14–16`
- **Commit**: Present since the CSP header was added; confirmed in `160f0d8` (HEAD)
- **Issue**: `font-src 'self'` and `style-src 'self' 'unsafe-inline'` block `fonts.googleapis.com` and `fonts.gstatic.com`. `index.html` loads Inter from Google Fonts. The font silently falls back to system fonts on all deployed pages.
- **Why this matters**: The entire Inter typography system (weights 400–800, tight tracking) isn't loading. The share stats card canvas also renders with wrong font metrics, causing text overflow.

---

## 🧹 Cleanup opportunities

### `index.html:10214–10215, 10232` — "TaskOS" brand in share stats card
- **Commit**: Introduced before rebrand in `0c1d32d` (rebrand commit, 2026-07-17), not cleaned up
- **Issue**: `_drawStatsCard()` still hard-codes `fillText('Task')` + `fillText('OS')` and footer text `task-management-beige-eight.vercel.app`
- **Why this matters**: Every progress card shared to social media says "TaskOS" — an abandoned brand name. High virality surface.

### `givelink.html:682–685` — This Week grid only collapses on initial render
- **Commit**: Introduced in `72e03fe` (2026-09-12, #84)
- **Issue**: The responsive collapse (`<600px → 2 cols`) runs once in the render function via an `if(window.innerWidth<600)` check. It doesn't re-run on resize or orientation change.
- **Why this matters**: Rotating the device or resizing the browser leaves the grid in a stale layout.

---

## 🤔 Worth a second look

### `index.html:10180` — `_APP_URL` hardcoded to Vercel subdomain
```js
const _APP_URL='https://task-management-beige-eight.vercel.app/';
```
This string is used in every share flow (invite, goal share, template share, stats card footer). It's not obviously broken now, but when a custom domain is set up this will need a sweep across all four share call sites. Flag it before the domain migration.

### `api/claude.js:43` — model ID `claude-haiku-4-5-20251001`
Both `api/claude.js` and `index.html:5023` call this specific model snapshot. The `20251001` date-pinned ID will continue to work (Anthropic keeps snapshots available) but won't benefit from model improvements. Worth an intentional decision: stay pinned for stability, or point at `claude-haiku-4-5` (the latest alias).

### `index.html:9959` — `aiProxy: ''` (AI features unreachable for all users)
The proxy endpoint `/api/claude.js` is deployed on Vercel but not connected. All new signups who click "Plan my day" or "AI Triage" get an error toast. This is a conversion-critical path — first AI action should delight, not error.

---

_Triage complete. 0 items from this week's commits; 7 pre-existing items surfaced for awareness. See `IMPROVEMENT_PLAN.md` for full prioritized context._
