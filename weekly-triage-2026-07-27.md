# Weekly Triage — 2026-07-27

## 📊 Week at a glance
- Commits: 1 | Files changed: 3 | Debt markers added: 0
- Only commit: `b38d4bb` "Landing growth: analytics, SEO foundation, and comparison table" (Jul 22)
- High-churn files (last 15 commits): `index.html` (13/15), `sw.js` (12/15), `landing.html` (3/15)
- Note: 10 commits landed Jul 16–22 just outside the 7-day window; the instability in index.html and sw.js is fresh

---

## 🚨 Needs immediate attention

### 1. Push notification icons point to a directory that doesn't exist
**`sw.js:41–42`** — introduced in sw.js churn (12 commits)
```
icon:  './icons/icon-192.png'
badge: './icons/icon-192.png'
```
There is no `icons/` directory. Icons live at the root: `./icon-192.png`, `./icon-512.png`. Every push notification silently arrives with no icon/badge. Browsers may reject the notification outright on some platforms.

### 2. Analytics are wired but producing zero data — PostHog key is blank
**`landing.html:702`** — commit `b38d4bb`
**`index.html:9960`** — prior churn commits
```js
var POSTHOG_KEY = '';   // landing.html
posthogKey: '',         // index.html APP_CONFIG
```
The entire point of `b38d4bb` was to "turn the landing into a measurable, discoverable growth surface." The analytics scaffolding is there — `landing_view`, `landing_cta_click`, `landing_scroll`, `landing_demo_seen` — but none of it fires until a key is pasted. The landing → signup funnel is invisible right now.

### 3. AI proxy has no per-user rate limiting — open to bill-running abuse
**`api/claude.js`** (comment on line 12)
```
// Note: this is a minimal proxy. For production add per-user rate limiting
// (e.g. Upstash) so a single account can't run up your Anthropic bill.
```
Any authenticated Supabase user can call `/api/claude` without limit. If you've activated the proxy (`APP_CONFIG.aiProxy`), a single user can make thousands of requests and spike your Anthropic costs with no circuit-breaker. The code explicitly flags this but it hasn't been addressed.

### 4. Dev Vercel slug hardcoded as the production domain everywhere
`task-management-beige-eight.vercel.app` appears in 5+ places:

| File | Lines | Impact |
|------|-------|--------|
| `landing.html` | 11, 16, 17, 21, 25 | Canonical URL, og:image, og:url, twitter:image, JSON-LD structured data |
| `index.html` | 10180, 10232 | `_APP_URL` constant drives referral links; also hard-printed on social share cards |
| `sitemap.xml` | 4 | Google's indexed sitemap URL |
| `robots.txt` | 3 | Sitemap reference |

If you move to a custom domain (or have already), Google sees two canonical URLs and may split SEO credit. The share cards literally print `task-management-beige-eight.vercel.app` as the brand URL — that's user-facing text that signals "this is a side project" rather than a product.

---

## 🧹 Cleanup opportunities

### 5. Cache name requires a manual date bump every deploy
**`sw.js:1`** — high-churn file (12 commits)
```js
const CACHE = 'arete-20260723';
```
There's no automated bump. If someone ships without updating this string, users stay on the stale `arete-20260723` cache. Easy to forget, hard to debug. Consider deriving from a build hash or adding a check.

### 6. `givelink.html` (112 KB) is deployed but the product was removed
**`vercel.json`** rewrite: `"/givelink" → "givelink.html"`
Commit `d635c06` ("Remove Givelink from Task OS") was Jul 16, but `givelink.html` was last touched 34+ commits ago (commit `76d794a`). It's still live at `/givelink`. If it's truly dead, it's a 112 KB surface that crawlers will index, confused users will find, and nobody is maintaining.

### 7. Anthropic API version is pinned to a 2023 value
**`api/claude.js`** (implicit — the version header)
```js
'anthropic-version': '2023-06-01'
```
Not immediately broken, but Anthropic has shipped many features since then (prompt caching, extended thinking, tool use improvements). Worth bumping to the current stable version.

---

## 🤔 Worth a second look

### 8. CSP `connect-src` allows direct browser → Anthropic calls alongside the proxy
**`vercel.json:15`**
```
connect-src 'self' https://api.anthropic.com ...
```
If `APP_CONFIG.aiProxy` is set (the proxy path), the app routes AI calls through `/api/claude`. Direct `api.anthropic.com` in CSP then exists only for users supplying their own key. This is intentional dual-mode — but it means a CSP bypass for `api.anthropic.com` is permanently open even for hosted users. Worth tightening once you commit to one mode.

### 9. JSON-LD structured data uses a first-name author, no org schema
**`landing.html:25`** — commit `b38d4bb`
```json
"author": {"@type": "Person", "name": "Panos"}
```
Perfectly valid, but if you want SEO results to show an organization, `@type: Organization` with a full name would match the Arete brand better. Minor — won't hurt rankings, but the structured data is person-attributed.

### 10. `robots.txt` gives blanket `Allow: /` with no API path exclusions
**`robots.txt`** — commit `b38d4bb`
```
User-agent: *
Allow: /
```
`/api/claude` is crawlable. Vercel serverless functions likely return a 405 for GET, so crawlers won't pull data — but an explicit `Disallow: /api/` is the correct posture for any backend endpoint.

---

*Triage generated automatically on 2026-07-27. 10 items total (4 high, 3 cleanup, 3 watch).*
