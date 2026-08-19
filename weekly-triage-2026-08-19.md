# Weekly Triage — 2026-08-19

## 📊 Week at a glance
- **Commits this week**: 0 | **Files changed**: 0 | **Debt markers added**: 0
- **Last commit**: `b38d4bb` (2026-07-22) — Landing growth: analytics, SEO foundation, comparison table
- **High-churn files (30-day view)**: `landing.html` (only file touched in the last 30 days)

> **No commits in the last 7 days (2026-08-12 → 2026-08-19).** The steps below cover the most recent commit (`b38d4bb`) and standing debt found in the full codebase via a static scan, since the scheduled prompt asks for both.

---

## 🚨 Needs immediate attention

### 1. `api/claude.js` — no rate limiting; acknowledged as production-unsafe
- **File**: `api/claude.js:12`
- **Commit**: present since before the 30-day window; not a recent addition
- **Why this matters**: Comment in the file literally says _"Note: this is a minimal proxy. For production add per-user rate limiting"_. The endpoint is deployed and live. A single actor can exhaust the Anthropic quota with no throttling.

### 2. `index.html:3594, 3601, 3603` — task/goal titles in `innerHTML` without `esc()`
- **File**: `index.html:3594, 3601, 3603`
- **Commit**: present in the current codebase (not introduced recently)
- **Why this matters**: `renderWizPanel()` (weekly review) renders `t.title` and `g.title` as raw HTML. Titles with `<`, `>`, or `&` render broken; a crafted title can execute JS in the session.

### 3. `sw.js:46–47` — push notification icon path `./icons/icon-192.png` doesn't exist
- **File**: `sw.js:46`, `sw.js:47`
- **Commit**: present in current codebase
- **Why this matters**: Actual icon lives at `./icon-192.png`. Every push notification (habit nudges, reminders) fires without an icon. On some Android browsers, this silently drops the notification.

### 4. `APP_CONFIG.aiProxy` is blank — AI features gate on a personal API key
- **File**: `index.html:9959`
- **Commit**: present in current codebase
- **Why this matters**: The proxy infra exists but isn't wired up. Every user must supply their own Anthropic key to use any AI feature — a hard activation blocker.

---

## 🧹 Cleanup opportunities

### 5. `APP_CONFIG.posthogKey` is blank — all analytics are silent no-ops
- **File**: `index.html:9960`
- **Pattern**: Hardcoded empty string
- **Likely meant**: Paste a PostHog project key; currently 100+ `track()` calls throughout the codebase fire and return immediately without sending any events.

### 6. `_APP_URL` hardcoded to `task-management-beige-eight.vercel.app`
- **File**: `index.html:10180`
- **Pattern**: Hardcoded literal URL in a global constant
- **Likely meant**: Use `window.location.origin`; the current value bakes a non-branded domain into every referral link and share card.

### 7. Canvas share card draws the hardcoded Vercel subdomain as visible text
- **File**: `index.html:10232`
- **Pattern**: String literal `'Made with Arete · task-management-beige-eight.vercel.app'`
- **Likely meant**: Use `window.location.hostname`; currently every share card screenshot shows the wrong domain.

### 8. `givelink.html` still cached in the Arete service worker (product split incomplete)
- **File**: `sw.js:17`, root `givelink.html`
- **Pattern**: Leftover from commit #73 "Remove Givelink from Task OS"
- **Likely meant**: Remove `./givelink.html` from the SW's `HTML` array; the file should either be deleted from this repo or moved to a separate deployment.

### 9. `index.html:2059` — settings text references `supabase-setup.sql` with no link
- **File**: `index.html:2059`
- **Pattern**: Plain-text reference to a file without a download link
- **Likely meant**: Provide `<a href="./supabase-setup.sql" download>` so self-hosters can follow the in-app instructions end-to-end.

---

## 🤔 Worth a second look

### 10. `setInterval` running every minute to check for the 21:00 habit nudge
- **File**: `index.html:10712–10723`
- **Pattern**: `setInterval(…, 60000)` runs for the entire browser session
- **Suspicion**: This polls 60× per hour. On mobile with the tab backgrounded, it can prevent the page from being eligible for background suspension. `setTimeout` to the next 21:00 boundary would be equivalent with zero wasted cycles.

### 11. `authSubmit()` swallows the specific login error — `"Wrong email or password"` even for network failures
- **File**: `index.html:10092–10094`
- **Pattern**: The catch block for login always shows `"Wrong email or password — or confirm your email first."` regardless of whether the failure was a 401 (wrong password), 422 (malformed email), or a network timeout.
- **Suspicion**: A network error would show a misleading message. Consider checking `e instanceof TypeError` (network) vs. HTTP status codes for cleaner user feedback.

### 12. `initReminders()` comment says it was moved to avoid TDZ — but the same pattern is now used again
- **File**: `index.html:10706–10710`
- **Pattern**: Comment explaining a past TDZ bug with a workaround
- **Suspicion**: The TDZ bug was real (a `const` referenced before declaration). The fix (move init calls to end-of-file) is correct, but the comment implies this may still happen if new top-level `const`s are added before the init block. Worth noting for future contributors.

---

_Triage scope: 0 files changed in the last 7 days. Standing debt identified via static analysis of `index.html`, `api/claude.js`, and `sw.js`. 12 items total._
