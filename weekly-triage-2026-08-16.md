# Weekly Triage — 2026-08-16

## 📊 Week at a glance

- **Commits this week:** 0 (last commit `b38d4bb` was 2026-07-22 — 25 days ago)
- **Files changed this week:** 0
- **Debt markers added this week:** 0 (no recent commits to scan)
- **High-churn files (last 30 days):** `index.html` (touched in every commit), `landing.html`, `sw.js`

> No commits landed in the last 7 days. The triage below covers standing debt in the current HEAD that poses production risk or slows the next sprint.

---

## 🚨 Needs immediate attention

### 1. CSP blocks Google Fonts — Inter does not load in production
**File:** `vercel.json:17`
**Commit introduced:** `b38d4bb` (2026-07-22) — "Landing growth: analytics, SEO foundation, and comparison table"
**Why it matters:** `style-src 'self' 'unsafe-inline'` does not include `https://fonts.googleapis.com`, and `font-src 'self'` does not include `https://fonts.gstatic.com`. The `<link>` to Google Fonts in `index.html:14-16` loads Inter, which the browser will refuse under this CSP. Every user sees system fonts. This regressed in the last big commit.

### 2. `aiProxy` is empty string — all AI features fail for every user
**File:** `index.html:9959`
**Commit introduced:** Config has been this way since the `aiProxy` field was added; most recently confirmed in `b38d4bb`.
**Why it matters:** `APP_CONFIG.aiProxy = ''` means `callClaude()` falls back to the direct-browser Anthropic path and gates on the user having their own API key. The `/api/claude` serverless function exists and works — it's just not wired up. Every AI feature (auto-triage, day planning, AI commands) is broken for any user who hasn't entered their own API key.

### 3. Push notification icon path is wrong — broken icon on all devices
**File:** `sw.js:46-47`
**Commit introduced:** `0c1d32d` (2026-07-17) — service worker was updated during the Arete rebrand but the icon path wasn't corrected.
**Why it matters:** `./icons/icon-192.png` does not exist; the file is `./icon-192.png`. Every push notification (reminders, recurring task nudges) shows a broken image to the user.

### 4. 15+ AI prompts hardcode "Panos" — wrong identity for any other user
**File:** `index.html` — lines 5647, 5920, 7319, 7477, 7849, 9806, 11415, 11516, 11524, 11672
**Commit introduced:** Accumulated across commits `f883adf` through `b38d4bb`.
**Why it matters:** AI responses will address every new user as "Panos," a "Greek founder in his 20s building Givelink," regardless of who they are. If a second user is onboarded, every AI feature gives them advice for the wrong person.

### 5. `posthogKey` is empty — no analytics in production
**File:** `index.html:9960`
**Commit introduced:** `b38d4bb` added the PostHog init call but left the key blank.
**Why it matters:** Dozens of PostHog events are wired up (`firstrun_organized`, `auth_google_start`, `guest_to_signup`, `landing_scroll`, etc.) but none fire. There's zero visibility into funnels, conversion, or feature usage.

---

## 🧹 Cleanup opportunities

### 6. `profileName` defaults to `'Panos'` — wrong for new users
**File:** `index.html:2519`
**Commit introduced:** `0c1d32d` (2026-07-17)
**Context:** `let profileName = localStorage.getItem('taskos_name') || 'Panos'`. The fallback is a personal name, not a generic default. Every new guest who hasn't set a name sees "Good morning, Panos 👋."
**Fix:** Change fallback to `'there'` or `''` and prompt for a name on first run.

### 7. `.gc{}` CSS rule defined twice — second definition shadows first
**File:** `index.html:242` and `index.html:320`
**Commit introduced:** Accumulation from layout work in `0c1d32d`.
**Context:** The goal card CSS class is defined identically at two different locations. The second definition at line 320 wins via cascade order, making the first dead code.
**Fix:** Delete the first block at line 242; ensure the second at 320 is complete.

### 8. `manifest-givelink.json` still in service worker STATIC cache
**File:** `sw.js:4`
**Commit introduced:** `0c1d32d` (2026-07-17) — rebrand commit that renamed the app to Arete but didn't clean up the legacy manifest from the SW.
**Context:** The product is now Arete. `manifest-givelink.json` is a legacy artifact that inflates SW install size on every user's device.
**Fix:** Remove from STATIC array in `sw.js`; bump cache version string to force reinstall.

### 9. Duplicate `refresh()` call after `nav()` in `_frEnter`
**File:** `index.html:10587-10588`
**Commit introduced:** `0c1d32d` (first-run flow added).
**Context:** `nav('dashboard')` already calls `renderView('dashboard')` internally. The `try{refresh();}catch(_){}` immediately after re-renders the dashboard twice on first-run completion.
**Fix:** Remove the second `try{refresh();}` call at line 10588.

---

## 🤔 Worth a second look

### 10. `authGoogle()` builds the redirect URL without any error handling or fallback
**File:** `index.html:10108-10111`
**Context:**
```js
function authGoogle(){
  const redirect = encodeURIComponent(location.origin + location.pathname);
  location.href = `${_SB.url}/auth/v1/authorize?provider=google&redirect_to=${redirect}`;
}
```
If `_SB.url` is empty (mis-configured), this redirects to `/auth/v1/authorize?provider=google&...` — a relative URL that returns a 404. No error is shown to the user. The flow silently breaks. Worth adding a guard: `if (!_SB.url) { _agErr('Sign-in unavailable — contact support'); return; }`.

### 11. `callClaude` guest 401 shows wrong CTA
**File:** `index.html:5028`
**Context:** When a guest (unauthenticated) hits the proxy and gets a 401, the code shows `'Please sign in again'`. But guests haven't signed in — they need to *create an account*. This is a conversion moment being wasted on a confusing error message.

### 12. Stats grid has 5 items in a 2-column mobile layout
**File:** `index.html:338`
**Context:** `.stats` is `repeat(2,1fr)` on mobile with 5 stat cards → 5th card is left orphaned half-width. Could be intentional (meant to show partial), but looks broken. Either hide one stat on mobile or go to 3 columns at ≥360px.

### 13. `showAiOut` uses `textContent` (safe) but `toast()` uses `innerHTML` (footgun)
**File:** `index.html:2789`
**Context:** `toast()` accepts raw HTML strings (used for the undo-delete `<a>` tag). All current callers pass trusted strings, but the pattern is a footgun: one future `toast(t.title)` where `t.title` is user input would be XSS. Worth refactoring before the codebase grows.

---

*Triage generated by automated scan — 2026-08-16. No commits in the past 7 days; findings reflect standing HEAD debt.*
