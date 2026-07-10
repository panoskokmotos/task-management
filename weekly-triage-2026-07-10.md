# Weekly Triage — 2026-07-10

## 📊 Week at a glance
- **Commits:** 7 (2026-07-04 → 2026-07-06) | **Files changed:** 6 unique files
- **Debt markers added:** 0 (no new TODO/FIXME/console.log found in changed files)
- **High-churn files:** `index.html` (all 7 commits) · `sw.js` (4 commits) · `api/claude.js` (1 commit)
- **Feature commits without test coverage:** all 7 — no test files exist in the repo

---

## 🚨 Needs immediate attention

### 1. `aiProxy` left blank — AI is completely broken for hosted users
**File:** `index.html:9812` · **Commit:** `e0b0a00` (Personal OS + hosted signup)

```js
aiProxy: '',   // e.g. 'https://taskos.vercel.app/api/claude'
```

`api/claude.js` was added in this same commit and deployed to `/api/claude`. The proxy is live, but `aiProxy` was never set. Every single AI feature — "Plan my day," "Auto-triage inbox," "AI Sprint Planner," ⌘K natural language — shows "Add Claude API key in Settings" for signed-in users. This is the primary value driver of the app.

**Fix:** `aiProxy: '/api/claude'` (relative URL, works on any domain).

---

### 2. Service worker push notification icon is a 404
**File:** `sw.js:42–43` · **Commit:** `e0b0a00` (multiple SW touches across the week)

```js
icon: './icons/icon-192.png',
badge: './icons/icon-192.png',
```

The `icons/` folder doesn't exist. Actual path is `./icon-192.png`. Push notifications on all platforms will show a blank/broken icon. The rebrand commit (`1fb177a`) added new icons at root level but didn't fix this reference.

**Fix:** Change both to `'./icon-192.png'`. Bump `CACHE` version to force SW update.

---

### 3. CSP in vercel.json blocks Google Fonts — Inter font never loads
**File:** `vercel.json:14` · **Commit:** `07213ad` (Enable Supabase CSP) / `e0b0a00` (updated CSP)

```
style-src 'self' 'unsafe-inline'; ... font-src 'self';
```

`index.html` loads Inter from `https://fonts.googleapis.com`. The `style-src` doesn't allow that domain, so the stylesheet is blocked. `fonts.gstatic.com` is also not in `font-src`. Every production visitor falls back to the system font stack (`-apple-system, BlinkMacSystemFont, Segoe UI`). The entire typography system — Inter 800 headings, 500 labels, tabular numerals — is invisible.

**Fix:** Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src`. Or self-host Inter.

---

### 4. AI proxy has no rate limiting — one user can exhaust the API budget
**File:** `api/claude.js:13` · **Commit:** `e0b0a00`

The comment in the file explicitly flags this:
```js
// Note: this is a minimal proxy. For production add per-user rate limiting
// (e.g. Upstash) so a single account can't run up your Anthropic bill.
```

With hosted signup now live (`APP_CONFIG.supabaseUrl` is set, auth gate is wired), any signed-in user can call `/api/claude` in a loop. No per-user quota, no per-IP limit, no burst protection.

**Fix:** Add Upstash Redis rate limiting keyed on the Supabase JWT `sub` claim (20 req/hour per user). Alternatively, add a simple per-IP in-memory map with a 1-minute window as a stopgap until Upstash is wired.

---

### 5. `_welcomeSeed` condition can miss new users on a second device
**File:** `index.html:10078` · **Commit:** `9f898e0` (Fix new signups)

```js
if(_hostedMode() && !remote && !S._welcomed && (!S.tasks || S.tasks.length === 0)){
  _welcomeSeed();
}
```

`S._welcomed` is part of the synced state blob. After the user's first login seeds data and pushes it, `_welcomed: true` is in the cloud. On a second device, `sbSyncNow` pulls that state first — `S._welcomed` becomes `true` before the welcome check runs — so `_welcomeSeed()` is skipped. This is the correct behaviour for a returning user. But if the first device's push fails (network error, auth expiry), the cloud row stays `null`. A second login attempt on the same or different device won't re-seed because `S._welcomed` is now `true` in the local (stale) state from the failed push.

**Why it matters in production:** Silent blank-app experience for new users on flaky connections.

**Fix:** Store `_welcomed` in `localStorage` only (not in `S`), keyed to the user UID. Check `localStorage.getItem('taskos_welcomed_'+_SB.uid)` instead.

---

## 🧹 Cleanup opportunities

### 6. `profileName` defaults to hardcoded "Panos" for all new users
**File:** `index.html:2406, 951` · **Commit:** `e0b0a00` (hosted signup)

```js
let profileName = localStorage.getItem('taskos_name') || 'Panos';
```
```html
<h1 id="greeting">Good morning, Panos 👋</h1>
```

The hosted signup flow now creates real user accounts. Any new user sees "Panos" in the browser tab title, page heading, and greeting. `_afterAuth` calls `_renderAccountChip` but does not update the greeting or `document.title`.

**Fix:** Default to `''`; render greeting as "Good morning 👋" until a name is resolved. In `_afterAuth`, derive from the Supabase email (already done in `_welcomeSeed`; just surface it earlier).

---

### 7. Init TDZ fix is brittle — comment explains why, but the guard is invisible
**File:** `index.html:10186–10190` · **Commit:** `c32b2ef` (init bug fix)

The fix comment says: *"Calling initReminders() here referenced DEFAULT_REMINDERS before its declaration, throwing a TDZ error that silently halted all remaining top-level init."* The fix was to move calls to the bottom of the script. But the ordering is fragile: any future function added before the init block that references a later-declared constant will silently break init again with no error surfaced to the user.

**Cleanup:** Wrap each init call individually with try/catch logging (see IMPROVEMENT_PLAN.md #13). This makes future breakage visible in the console instead of silent.

---

### 8. `supabase-setup.sql` comment recommends turning off email confirmation
**File:** `supabase-setup.sql:38` · **Commit:** `e0b0a00`

```sql
-- turn OFF "Confirm email" for the fastest single-user setup
```

This guidance is appropriate for a single-user local setup. It's dangerous if this Supabase project is now accepting public signups (the hosted auth gate is live). With email confirmation off, anyone can sign up with any email address (including someone else's) and immediately access the app with a valid session.

**Fix:** Remove or gate this recommendation behind a "single-user mode" note. Ensure the production Supabase project has email confirmation ON in Authentication settings.

---

### 9. Service worker CACHE version may not have been bumped after icon rebrand
**File:** `sw.js:1` · **Commit:** `1fb177a` (icon rebrand) vs `e0b0a00`

```js
const CACHE = 'task-os-20260711';
```

The CACHE name appears to have been bumped (dated `20260711`). However, the `STATIC` array in `sw.js` caches `./icon-192.png`, `./icon-512.png`, etc. After the rebrand replaced the icon files, existing PWA installs would have stale icons until the SW activates. Given the same-origin static caching strategy, this should self-heal — but verify that old installs (cached before `20260711`) are picking up the new worker and the new icons.

**No action required if** all users have seen the update banner. Worth a manual check on an old PWA install.

---

## 🤔 Worth a second look

### 10. `sbSyncNow` fires with a 900ms cold-start delay that may race with `_authBoot`
**File:** `index.html:10153` · **Commit:** `e0b0a00`

```js
setTimeout(() => { if(_sbEnabled()) sbSyncNow(); }, 900);
```

`_authBoot()` (called elsewhere in the init sequence) may also call `sbSyncNow(true)` if the user is already signed in. The 900ms cold-start sync and the `_authBoot` sync can therefore fire concurrently. `sbSyncNow` has a `_sbBusy` guard, so they won't both run, but the second call silently no-ops — which means if `_authBoot` fires first and the token refresh takes >900ms, the cold-start sync wins with a potentially stale token.

**Recommendation:** Remove the cold-start `setTimeout` sync entirely and let `_authBoot` own the initial sync. The 900ms delay was likely added to let auth finish first — but `_authBoot` is the right place for that logic.

---

### 11. `givelink.html` uses blue (#3b82f6) while every other brand surface uses violet
**File:** `givelink.html:17` · **Commit:** context predates this week but unchanged

```css
--accent: #3b82f6;
```

All Task OS elements use `--accent: #8b7cff`. The Givelink sprint board is navigated to via the workspace switcher in the sidebar. The color break is jarring and inconsistent with the brand. Low confidence this is intentional given the rest of the rebrand was to violet this week.

**Recommendation:** Confirm with the product owner if Givelink is intentionally blue (separate product identity) or should match the violet brand. If violet: one-line CSS fix.

---

### 12. `_sbScheduleSync` can fire concurrent pushes during rapid edits
**File:** `index.html:10109–10112` · **Commit:** `e0b0a00`

```js
_sbTimer = setTimeout(() => {
  sbPush().then(...)
}, 2500);
```

If a user edits a task at T=0 (timer starts), edits again at T=2 (timer resets), then pauses — the timer fires at T=4.5. But if the user pauses at T=2.4 (first timer fires) then edits again at T=2.6, two `sbPush` calls are in-flight simultaneously. The Supabase `merge-duplicates` upsert is idempotent so data won't corrupt, but the second push overwrites with the state at T=2.6, which is correct — unless a previous unrelated push from another device arrived between them.

**Recommendation:** Add `if(_sbBusy) { _sbPending=true; return; }` at the top of the setTimeout callback and re-fire after the current push completes. Low urgency while the app is single-user.

---

*Total actionable items: 12. Items 1–5 are production-blocking; 6–9 are clean-up; 10–12 are design decisions worth confirming.*
