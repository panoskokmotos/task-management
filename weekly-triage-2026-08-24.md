# Weekly Triage — 2026-08-24

## 📊 Week at a glance
- Commits (last 7 days): **1** | Files changed: **1** (README.md only) | Debt markers added: **0**
- High-churn files (last 60 days): **index.html** (25 commits), **sw.js** (15 commits), **manifest.json** (4 commits)
- Zero test commits in the entire 60-day window across 83+ commits

---

## 🚨 Needs immediate attention

### 1. Push notifications silently broken — wrong icon path
**sw.js:43–44** · commit `0c1d32d` (Rebrand to Arete)

The service worker sends push notifications with `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'`, but no `icons/` subdirectory exists. The real files sit at `./icon-192.png`. Every notification fires without an icon; on some Android builds a missing icon causes the notification to be dropped entirely.

### 2. Claude proxy has no rate limiting — open billing hole
**api/claude.js:12–13, 34–35** · commit `e0b0a00` (Personal OS)

The file itself documents the risk: *"add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."* This was never implemented. Any authenticated Supabase session can POST an unlimited number of 20k-token prompts (max 2 000 output tokens each) to `/api/claude`. One abusive account or a leaked session token could exhaust the Anthropic quota with no guard.

### 3. Hardcoded production URL used in referral and template links
**index.html:10180** · commit `32e7288` (Product-led growth)

```js
const _APP_URL = 'https://task-management-beige-eight.vercel.app/';
```

Every referral link (`_refUrl()`) and template share URL (`/index.html:10279`) is built from this string. Any domain migration or vanity-domain switch silently breaks all share/referral links already in circulation. Should live in `APP_CONFIG` alongside the other config constants.

### 4. Supabase credentials committed to repo
**index.html:9957–9958** · commit `0c1d32d` (Rebrand)

```js
supabaseUrl : 'https://bgvddpkdsftgynxyhnoc.supabase.co',
supabaseAnon: 'sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M',
```

The comment says the anon key is safe because RLS protects data — that's true if RLS policies are airtight, but committing them means any future RLS misconfiguration immediately exposes all user data publicly. Standard practice is to keep these out of source control even when "safe to expose."

### 5. 71 completely silent catch blocks — production errors invisible
**index.html** (spread across file) · accumulation of all recent commits

`catch(e){}` with no logging appears 71 times. Examples: init sequence startup errors (lines 10662–10768), quick-capture, pull-refresh, checklist init. If any of these fail in production there is no signal — no Sentry event, no console.warn, no toast. Combined with zero tests, failures in the boot sequence would go undetected until a user reports them.

---

## 🧹 Cleanup opportunities

### 6. Notion integration is structurally broken for all browser users
**index.html:10940** · commit `e0b0a00`

The code explicitly catches the CORS `TypeError` and shows a workaround message. Notion's API blocks direct browser requests — this means the "Fetch from Notion" button never works for any user in a browser. The integration ships as a known-broken feature. Either add a server-side proxy route (alongside the Claude one) or remove the button and document the manual export workaround up front.

### 7. `anthropic-version: '2023-06-01'` — 3-year-old API header
**api/claude.js:41** · commit `e0b0a00`

The proxy pins the oldest supported Anthropic API version. This doesn't break anything today but means the proxy won't pick up streaming improvements, prompt-caching headers, or extended thinking support when those roll out. Low effort to bump to `2025-01-15` (current stable).

### 8. `aiProxy` config is empty — Claude features use client-side keys only
**index.html:9956–9962** · commit `e0b0a00`

`APP_CONFIG.aiProxy` is `''`, so all AI features fall back to users' personal `S.claudeKey`. The proxy at `api/claude.js` exists and is deployed but is not wired into APP_CONFIG. If the intent is for hosted users to use the shared proxy, this is a silent misconfiguration.

### 9. Guest-mode seeding still fires in local (BYOS) mode
**index.html:10660** · commit `9f898e0` (Fix: new signups)

The fix correctly guards `seed()` / `seedGoals()` with `if(!_hostedMode())`. But any developer running locally — or anyone self-hosting — will still seed the owner's 389 personal tasks as demo data on first load. Seed data should either be replaced with generic placeholder tasks or the seed function should be removed now that the onboarding tour handles first-run.

### 10. Service worker still caches `givelink.html` after separation
**sw.js:11** · commit `d635c06` (Remove Givelink from Task OS)

The commit that "fully separates the two products" removed Givelink from the main app but `sw.js` still pre-caches `./givelink.html` in the HTML list. Minor cache bloat, and it means updates to a "separated" product still affect the main app's service worker install step.

---

## 🤔 Worth a second look

### 11. `taskos_guest_nudged` survives logout — repeat nudge impossible
**index.html:2587, 2594** · commit `0e19b15` (Guest mode)

Guest nudging is suppressed by `localStorage.getItem('taskos_guest_nudged')`. But on `authLogout()` only `taskos`, `taskos_name`, `taskos_guest`, and `taskos_guest_nudged` are cleared (line 10120). After logout, if a new guest session starts in the same browser, the nudge fires again (key was cleared). This is probably the intended behavior, but it's worth confirming whether nudging a returning guest is desired or annoying.

### 12. `_APP_URL` referral tracking in guest-mode has no guard
**index.html:10279** · commit `32e7288`

Template share URLs include `&ref=<uid>` only when `_SB.uid` is set, but guest users have no UID. The fallback drops the `ref` silently. If referral attribution is important for growth metrics, guest-to-signup conversions where the share originated from a non-authenticated user lose their attribution entirely.

### 13. Token expiry check uses wall-clock comparison against a stored integer
**index.html:9971** · commit `10039` (sbSyncNow region)

`_SB.exp` is a Unix timestamp stored in localStorage and compared against `Date.now()/1000`. This is correct but if the user's system clock is wrong (common on mobile with bad NTP), the token will appear expired or unexpired incorrectly, causing confusing auth loops. Consider validating the session against the Supabase `/auth/v1/user` endpoint rather than relying on a client-side expiry check.
