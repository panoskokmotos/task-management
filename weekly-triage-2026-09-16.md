# Weekly Triage — 2026-09-16

## 📊 Week at a glance
- **Commits**: 2 | **Files changed**: 3 | **Debt markers added**: 0
- **High-churn files**: `givelink.html` (1 commit, 96-line diff), `index.html` (1 commit, 14-line diff), `.github/workflows/supabase-keepalive.yml` (new file)

---

## 🚨 Needs immediate attention

### 1. `sw.js:47–48` — Push notification icons are 404 (pre-existing, surfaced by this week's refocus on Givelink)
**Commit that exposes relevance**: `72e03fe` (Givelink bug fixes — confirms we're shipping production features that rely on SW push)
The SW push handler references `./icons/icon-192.png` but the file lives at `./icon-192.png`. Every push notification on Android renders without icon/badge. This affects all users who accepted notification permissions.
```js
// sw.js:47-48 — wrong path
icon:  './icons/icon-192.png',  // file doesn't exist
badge: './icons/icon-192.png',  // file doesn't exist
```
**Why it matters**: Silent failure for all push notifications — the most direct re-engagement channel.

---

### 2. `index.html:2519` — Every new user is greeted as "Panos"
**Commit**: pre-existing, never addressed
```js
let profileName = localStorage.getItem('taskos_name') || 'Panos';
```
Any user who hasn't explicitly set their name sees `Good morning, Panos 👋` on their dashboard. First impression for every new signup.
**Why it matters**: Trust-destroying for a personal productivity app. P0 fix.

---

### 3. `index.html:10214–10215` — Shared progress card renders "Task OS" (old brand)
**Commit**: pre-existing rebrand residue
```js
x.fillText('Task', 170, 124);
x.fillText('OS', 170 + tw, 124);
```
The canvas-drawn "share your wins" card still paints the old product name in the brand colour. Growth-loop screenshots actively advertise the wrong brand.
**Why it matters**: Every viral share is mis-attributed to a dead brand name.

---

### 4. `manifest.json:22–44` — All PWA home-screen shortcuts are non-functional
**Commit**: pre-existing
Shortcuts use `#quick-add`, `#journal`, etc. as URL hashes. The `nav()` router never reads `location.hash`, so tapping a shortcut from the home screen lands on the dashboard with the hash in the URL but no view or modal opens.
**Why it matters**: Android/iOS users who pin the app and rely on shortcuts get a broken experience — and likely uninstall.

---

### 5. `.github/workflows/supabase-keepalive.yml:26–27` — Anon key hardcoded in new workflow (added this week)
**Commit**: `160f0d8`
```yaml
"https://bgvddpkdsftgynxyhnoc.supabase.co/rest/v1/" \
-H "apikey: sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M"
```
The new keep-alive workflow hardcodes the Supabase project URL and anon key directly in the YAML. While technically public values, embedding them in git sets a bad precedent — they cannot be rotated without rewriting git history.
**Why it matters**: Correct hygiene now prevents a footgun if RLS is ever misconfigured. Move to GitHub Secrets before other contributors start copying the pattern.

---

## 🧹 Cleanup opportunities

### 6. `api/claude.js:12–13` — Rate-limiting TODO left open since initial creation
**Commit**: pre-existing (has a comment acknowledging the gap)
```js
// Note: this is a minimal proxy. For production add per-user rate limiting
// (e.g. Upstash) so a single account can't run up your Anthropic bill.
```
The proxy is live in production with zero rate limiting. A single user or discovered URL can exhaust the Anthropic quota.
**Why it matters**: Financial risk — one abusive session can generate a four-figure Anthropic bill overnight.

---

### 7. `givelink.html` — Six bugs fixed this week in commit `72e03fe` — verify no regressions in the NP modal
The NP modal received a fix for "buttons always rendered, shown/hidden per mode." The pattern changed from one-time `innerHTML` to dynamic show/hide — a subtle behaviour change. Verify manually: open the NP modal in Add mode, then in Edit mode, confirm Delete/Log/Advance buttons appear and hide correctly per mode. The fix is correct in code but the original bug existed undetected for a while, suggesting no test coverage for this UI path.

---

### 8. `index.html:10131` — Silent catch on auth sync needs a retry, not silence
**Commit**: `72e03fe` touched nearby code; the gap is pre-existing
```js
try { await sbSyncNow(true); } catch(e) {}
```
First-login sync failures are swallowed entirely. A network hiccup at login time means the user opens with stale data and never sees an error.

---

## 🤔 Worth a second look

### 9. `givelink.html` — "This Week" view: no loading state while `curTasks()` filters
**Commit**: `72e03fe`
The new week-plan view renders synchronously via `renderWeek()` called in `nav()`. If the task list is large or the sprint data needs a network call, the view flashes empty columns before populating. There is no skeleton/loading state. Low priority now, worth adding if the data source ever becomes async.

---

### 10. `sw.js:1` — Cache key `arete-20260723` is over 7 weeks old
**Commit**: `160f0d8` (supabase-keepalive was the only change; `sw.js` was not updated)
`CACHE = 'arete-20260723'` means the two commits this week — including bug fixes and a new Givelink feature — are served to installed PWA users **from the stale July 23 cache**. Users who installed the PWA before July 23 may still be running the old code.
**Why it matters**: Bug fixes this week (F-01 through F-06 in `givelink.html`) are invisible to PWA users until the cache key is bumped.

---

### 11. `landing.html:~702` — PostHog key blank, funnel analytics dark
**Commit**: pre-existing
```js
var POSTHOG_KEY = '';
```
The landing page sends zero analytics events. CTA click rates, scroll depth, and trial conversion are unmeasured. The analytics gap means any growth work on the landing page is flying blind.

---

_Triage complete. 11 items total: 5 immediate, 3 cleanup, 3 worth watching._
