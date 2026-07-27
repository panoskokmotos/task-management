# Weekly Triage — 2026-07-27

## 📊 Week at a glance
- **Commits this week:** 1 (`b38d4bb`) | **Files changed:** 3 | **Debt markers added:** 0
- **High-churn files (last 7 days):** `landing.html` (only churn file; 3 files total for the single commit)
- **Context:** Last week was quiet — one landing growth commit on 2026-07-22. The heavy shipping sprint was the week prior (#73–#82, all on 2026-07-16 to 2026-07-18).

---

## 🚨 Needs immediate attention

### 1. PostHog key not pasted — analytics silent in production
**File:** `index.html:9960`, `landing.html:703` | **Commit:** `b38d4bb`

The #83 commit ("Landing growth: analytics, SEO foundation, and comparison table") explicitly says analytics are "gated on a key you paste; a blank key is a silent no-op, so nothing fires until you opt in." The key was not pasted. `posthogKey: ''` in `APP_CONFIG` and `var POSTHOG_KEY = '';` in `landing.html` means every `track()` call silently does nothing. You've built a full funnel analytics layer and it has never collected a single event.

**Why this matters:** You can't measure CTA click rates, scroll depth, or landing → signup conversion. Every growth decision this week is made without data.

---

### 2. CSP in production blocks Google Fonts — Inter never renders
**File:** `vercel.json:15`, `index.html:14-16` | **Commit:** pre-existing, surfaced now

`style-src 'self' 'unsafe-inline'` in the Vercel CSP blocks the `fonts.googleapis.com` stylesheet. `font-src 'self'` blocks `fonts.gstatic.com`. The main app loads Inter but it is silently blocked in every production request. Every user sees system fonts. Browser console shows CSP violation errors on every pageload.

**Why this matters:** Design fidelity is broken in production. This also means every browser that reports CSP violations (most do) is logging errors against your domain — a signal that affects browser trust scores.

---

### 3. Push notification icon path broken
**File:** `sw.js:47-48` | **Commit:** pre-existing

`icon: './icons/icon-192.png'` — there is no `icons/` directory. File is at `icon-192.png`. Notifications render without the Arete icon. Verifiable by checking the STATIC array in `sw.js` (no `icons/` prefix there) against line 47.

**Why this matters:** Unbranded notifications look like spam and contribute to notification permission being revoked.

---

### 4. Givelink CRM: delete button permanently absent if Add was opened before Edit
**File:** `givelink.html:1380` | **Commit:** pre-existing (CRM feature from earlier sprint)

`_showNPModal` creates the modal DOM lazily. The delete button is baked into the template with `${editNpId ? '<button...>Delete</button>' : ''}`. If `openAddNP()` is called first (inevitable for any new user), `editNpId = null` and the delete button is never included in the DOM. All subsequent edit operations on any org show no delete button. This is a regression in UX completeness for a shipped feature.

**Why this matters:** Users editing an existing nonprofit org have no way to remove it. The only workaround is clearing localStorage.

---

## 🧹 Cleanup opportunities

### 5. Givelink sprint seed dates are 107 days expired
**File:** `givelink.html:437-438` | **Commit:** pre-existing seed data

`start:'2026-03-28', end:'2026-04-11'`. Today is 2026-07-27. New users open Givelink to "0 days left" on a sprint that ended in April. `daysLeft()` returns 0, `sprintPct()` returns 100.

**Fix:** Compute dates dynamically: `new Date().toISOString().slice(0,10)` for start, +14 days for end.

---

### 6. `aiProxy` URL empty — serverless proxy is dead code
**File:** `index.html:9959` | **Commit:** pre-existing

`aiProxy: ''` — the proxy at `api/claude.js` is written, deployed, but never called. Every user who tries AI features gets "Add Claude API key in Settings." The landing promises AI as a free feature.

**Fix:** Set `ANTHROPIC_API_KEY` in Vercel env, paste the deployed proxy URL into `aiProxy`.

---

### 7. `window.prompt()` for API key collection in Givelink
**File:** `givelink.html:1086`, `givelink.html:1261` | **Commit:** pre-existing AI feature

Both `getApiKey()` and `callClaudeGL()` fall back to `window.prompt('Enter your Anthropic API key:')`. This is blocked on iOS Safari (silent fail), blocked in iframes, and is a security anti-pattern that trains users to enter keys into browser dialogs.

**Fix:** Add a key input to Sprint Settings modal, save to `taskos_api_key`, toast to settings when key is missing.

---

### 8. `renderVelocityStats()` uses `innerHTML +=` pattern
**File:** `givelink.html:1551` | **Commit:** pre-existing feature

`el.innerHTML += '...'` re-parses and replaces the entire `ov-stats` element's DOM on every overview render. If any child element ever gets an event listener, this silently breaks it.

**Fix:** Merge velocity stats into the stats HTML built in `renderOverview()`.

---

## 🤔 Worth a second look

### 9. Service worker `CACHE` name hardcoded as `'arete-20260723'`
**File:** `sw.js:1` | **Commit:** pre-existing

The cache name matches the date of a recent commit, suggesting it was bumped manually. There is no automated process to ensure it gets bumped on deploy. If it's forgotten, users stay on a stale cached version indefinitely while the SW update detection never fires a new install.

**Considered risk:** Low if the team is disciplined; high if deploys are frequent. Worth adding a comment or a build hook.

---

### 10. `givelink.html` calls Anthropic API directly from the browser (`anthropic-dangerous-direct-browser-access: true`)
**File:** `givelink.html:1136`, `givelink.html:1264` | **Commit:** pre-existing AI feature

Both AI callers in Givelink set this header. This header exists explicitly to acknowledge the risk: the API key is visible in DevTools, stored in localStorage, and travels in every request header. Any XSS vulnerability would immediately compromise the user's Anthropic account.

**Context:** The main `index.html` does the same when `aiProxy` is empty (`index.html:5022`). This is an intentional design choice for the self-hosted version. Once the proxy is wired up in `index.html`, this risk disappears there. Givelink would need its own proxy endpoint to eliminate it.

**Recommendation:** Not a blocking issue for now if users are aware their own key is in use. Becomes higher priority if Givelink ever becomes a multi-user or shared-link product.

---

### 11. Landing page CTA "Browse templates →" links to `/index.html` but templates aren't the first thing users see
**File:** `landing.html:514` | **Commit:** `59abf2d` (landing #82)

The "Browse templates →" CTA in the templates section links to `/index.html` which lands on the dashboard (or last view). There's no deep link to the templates gallery. New users clicking this CTA will not land on templates — they'll land on the inbox or today view with no obvious path to templates.

**Recommendation:** Consider adding a `?view=templates` query param and handling it in the app's boot sequence to `nav('templates')` on first load.

---

*Total: 11 items (4 immediate, 4 cleanup, 3 worth a second look). Week was low-churn — the real debt was introduced in the July 16–18 sprint; this triage is catching what slipped through.*
