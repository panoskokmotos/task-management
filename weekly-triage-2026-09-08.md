# Weekly Triage — 2026-09-08

## 📊 Week at a glance
- Commits this week: **0** | Commits past 30 days: **1** (README-only)
- Files changed this week: **0** — last meaningful code commit was 2026-07-22 (#83)
- Debt markers found in active codebase: **8 notable items**
- High-churn files (all-time): `index.html` (touched in 50+ commits), `landing.html`, `sw.js`

> **Note:** No code changes in the past 7 days, so this report scans the current codebase for pre-existing debt rather than week-specific churn.

---

## 🚨 Needs immediate attention

### 1. Service worker uses a broken icon path
**`sw.js:46-47`** — commit `0c1d32d`
```
icon:'./icons/icon-192.png',
badge:'./icons/icon-192.png',
```
The `icons/` directory does not exist. Icons live at `./icon-192.png` (repo root). Push notifications will silently show no icon on every device. Any browser that enforces `icon` on `showNotification()` may suppress the notification entirely.

### 2. Claude proxy has no rate limiting in production
**`api/claude.js:12-13`** — commit `0c1d32d`
```
// Note: this is a minimal proxy. For production add per-user rate limiting
// (e.g. Upstash) so a single account can't run up your Anthropic bill.
```
This is a shipped proxy with an acknowledged gap. Any authenticated user can call `/api/claude` in an unbounded loop. A compromised account or abuse scenario runs up the Anthropic bill with no guardrail.

### 3. Outdated Anthropic API version header
**`api/claude.js:41`** — commit `0c1d32d`
```js
headers: { 'anthropic-version': '2023-06-01' }
```
The version string is 2+ years old. New features (extended thinking, prompt caching, updated tool-use schema) require a current version. Risk: silent degraded responses if the API deprecates old behavior.

### 4. `_APP_URL` hardcoded outside `APP_CONFIG`
**`index.html:10180`** — commit `32e7288`
```js
const _APP_URL='https://task-management-beige-eight.vercel.app/';
```
This Vercel URL is embedded 3 times (`_refUrl`, template share links). It lives separately from `APP_CONFIG`, so anyone forking/redeploying the app will generate referral and template links pointing to the original instance. The right fix is to move it into `APP_CONFIG` alongside the other deployment values.

---

## 🧹 Cleanup opportunities

### 5. README references files that don't exist
**`README.md:35,41`** — commit `5cd9437` (2026-08-22)
```
See CHANGELOG.md for recent updates.
... CONTRIBUTING.md (coming soon)
```
Neither `CHANGELOG.md` nor `CONTRIBUTING.md` exists in the repo. External contributors (and CI that checks links) will hit 404s. Either create stubs or remove the references.

### 6. `seed()` is 391 lines — split risk
**`index.html:4532`** — long-lived
The `seed()` function runs on boot for non-hosted users to populate demo data. At 391 lines it seeds tasks, goals, and multiple data structures. The guard `if(!_hostedMode()){seed();}` prevents it from running in production, but the function has no tests and any refactor touching the data model risks silently breaking the seeded experience — which is the first thing new users see.

### 7. SW cache key has a hardcoded date stamp
**`sw.js:1`** — commit `0c1d32d`
```js
const CACHE = 'arete-20260723';
```
Cache-busting requires manually updating this string on every deploy. If it's forgotten, users get stale assets after a deploy. Consider deriving this from a build hash or a short commit SHA.

### 8. `aiProxy` config gap — empty by default, no in-app hint
**`index.html:9959`** — commit `b38d4bb`
```js
aiProxy : '',   // e.g. 'https://taskos.vercel.app/api/claude'
```
The proxy URL is intentionally blank for self-hosters but the in-app Settings panel only exposes a "Claude API Key" field. There is no UI path for self-hosters to set a proxy URL — they must edit source. A low-cost fix: add a proxy-URL input below the API key field in Settings.

---

## 🤔 Worth a second look

### 9. `renderDash()` is 161 lines with no loading state
**`index.html:2988`** — long-lived
The dashboard render function is synchronous and 161 lines long. It calls `calcLifeScore()` inline (itself 55 lines). If AI-powered scoring is ever moved async, there is no loading skeleton in this path — the dashboard will flicker or show stale data.

### 10. `_ntfyPost()` result is never checked at most call sites
**`index.html:11313`**
```js
try{await _ntfyPost(topic,...);}catch(_){}
```
The catch swallows all errors silently. The test call at line 11320 does check `res.ok`, but the recurring reminder path at line 11313 does not — a failed reminder (bad topic, ntfy.sh down) is invisible to the user.

### 11. The whole app is one 14,924-line HTML file
`index.html` — structural note
All JS, CSS, and HTML live in a single unminified file with no build step. This makes it fast to deploy but increasingly hard to navigate and test. Functions like `seedGoals()` appear to be defined twice (lines 4926 shows two entries for the same name in the awk scan) — a build step would catch duplicate declarations at compile time.
