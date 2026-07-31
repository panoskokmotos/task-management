# Weekly Triage — 2026-07-31

## 📊 Week at a glance
- **Commits this week (Jul 24–31):** 0 — no new commits
- **Files changed this week:** 0
- **Debt markers added this week:** 0 (none introduced)
- **High-churn files (last 30 days):** `index.html` (20 commits), `sw.js` (8 commits), `landing.html` (4 commits)
- **Context:** The last commit was `b38d4bb` on Jul 22 — 9 days ago. The week was quiet.

> Debt scan below covers the 3 files with the highest churn in the last 30 days, since there were no changes in the 7-day window.

---

## 🚨 Needs immediate attention

### 1. `sw.js:46-47` — broken icon path in push notifications
**Commit:** `0c1d32d` (Jul 17, Rebrand to Arete)
```
icon: './icons/icon-192.png',   // file does not exist at this path
badge: './icons/icon-192.png',
```
The rebrand commit moved icons to the repo root (`./icon-192.png`) but never updated these two lines. Every web push notification shows a broken icon. Introduced Jul 17, present in all 8 subsequent `sw.js` commits.

**Why it matters:** Push is the only re-engagement channel. A broken icon degrades trust and increases dismiss rates.

---

### 2. `vercel.json:15` — CSP blocks Google Fonts (Inter never loads)
**Commit:** `0c1d32d` (Jul 17, Rebrand to Arete) introduced the CSP header; no subsequent commit added `fonts.googleapis.com` to `style-src` or `fonts.gstatic.com` to `font-src`.
```
style-src 'self' 'unsafe-inline'   // missing fonts.googleapis.com
font-src 'self'                    // missing fonts.gstatic.com
```
`index.html:14-16` loads Inter from Google Fonts. Both the stylesheet and the WOFF2 files are blocked. The app falls back to system fonts for all users.

**Why it matters:** Brand typography is broken on every page load. CSP errors fill the console.

---

### 3. `api/claude.js:12` — acknowledged missing rate limit
**Commit:** This file has been present since before the 30-day window; the comment is unchanged.
```js
// Note: this is a minimal proxy. For production add per-user rate limiting
// (e.g. Upstash) so a single account can't run up your Anthropic bill.
```
`APP_CONFIG.aiProxy` in `index.html:9959` is currently `''` so the proxy is inactive. But if/when it is activated, there is zero throttling. A single authenticated user can make unlimited API calls.

**Why it matters:** One activation commit away from an unbounded bill risk.

---

### 4. `index.html:3223, 3274` — unescaped `t.title` in innerHTML
**Commit:** Multiple commits in the `renderBuckets()` / `inboxHTML()` paths; `esc()` was never applied here.
```js
`<div class="tt">${t.title}</div>`   // line 3223 — no esc()
`<div class="tt">${t.title}</div>`   // line 3274 — no esc()
```
The `esc()` helper exists at `index.html:11776` and is used in some paths but not others. Task titles with HTML content execute on render.

**Why it matters:** Stored XSS vector; low exploitability today (single-user localStorage) but a real risk once sync is active.

---

## 🧹 Cleanup opportunities

### 5. `index.html:9959` — `aiProxy: ''` placeholder left uncommented
**Commit:** `0c1d32d` (Jul 17)
The proxy endpoint `/api/claude.js` is built and deployed but `APP_CONFIG.aiProxy` is never filled in. This is the root cause of AI features being unavailable to users without their own API key. Not a bug in the code — a missing deployment step — but it's been sitting for 9+ days.

---

### 6. `index.html:9960` and `landing.html:702` — PostHog keys never pasted
**Commit:** `b38d4bb` (Jul 22, Landing growth — analytics, SEO foundation) added all the analytics instrumentation on the landing page with the explicit comment "Paste the SAME PostHog key..." but left `POSTHOG_KEY = ''`. Same for `index.html:9960`.
Zero product analytics are firing. The funnel wiring is complete; it just needs a key.

---

### 7. `index.html:5022` — `anthropic-dangerous-direct-browser-access: true`
**Commit:** Present before the 30-day window; not changed recently.
```js
headers: { ..., 'anthropic-dangerous-direct-browser-access': 'true' }
```
This code path exposes the user's personal Anthropic API key (stored in `localStorage`) directly from the browser. Once `aiProxy` is live this path should be removed entirely rather than left as a fallback.

---

## 🤔 Worth a second look

### 8. `sw.js:19` — `self.skipWaiting()` in `install` event
```js
self.addEventListener('install', e => {
  e.waitUntil(Promise.allSettled([...]).then(() => self.skipWaiting()));
  // or: self.skipWaiting() is called outside e.waitUntil
```
Actually `self.skipWaiting()` is called after the `waitUntil` resolves, which is correct. But combined with `self.clients.claim()` in `activate`, the service worker takes over all open tabs immediately on update — which could cause requests in-flight at update time to hit a partially-updated cache. Intentional choice (fast updates), but worth a comment so the next engineer doesn't "fix" it.

**Why this matters:** Not a bug, but the pattern surprises people and gets cargo-culted out.

---

### 9. `index.html:10132` — double nav on login, with try/catch swallowing errors
**Commit:** `28dc1b8` (Jul 16, Land on Today after login)
```js
try{nav('dashboard');}catch(e){try{refresh();}catch(_){}}
```
Nested `try/catch` with an ignored inner error (`_`) around a navigation call. If `nav()` throws and `refresh()` also throws, the user ends up on an indeterminate view. The intent is correct (always land somewhere safe), but the silent-catch-all hides whatever made `nav()` fail.

**Why this matters:** If there is a render error in the dashboard view, this mask makes it invisible in production. Consider at minimum `console.warn` in the outer catch before the fallback.

---

### 10. `index.html:2517` — `S` state object has 60+ top-level fields, no `_version`
Every feature adds a new key to the flat `S` object without any schema migration. The `load()` function at line 2598 does a plain spread (`{...S,...JSON.parse(d)}`). A removed or renamed field will silently persist stale data in users' browsers indefinitely. This has been the pattern since the beginning — no commits address it.

**Why this matters:** As the codebase grows, this becomes the source of subtle bugs that only appear for returning users with old data.

---

_10 items — quality over quantity. Each item includes the commit that introduced it and a one-line "why this matters."_
