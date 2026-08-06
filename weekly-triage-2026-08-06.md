# Weekly Triage — 2026-08-06

## 📊 Week at a glance
- Commits this week: **0** — last commit was 2026-07-22 (15 days ago)
- Files changed in last 7 days: **0**
- Debt markers in recently-touched files: **N/A** (no churn)
- High-churn files (last active sprint): `index.html` (touched in 7 of last 10 commits), `landing.html` (4), `sw.js` (2)

> **Note**: There are no commits in the last 7 days. This triage scans the files most recently touched (last active sprint: commits #79–#83, 2026-07-17 → 2026-07-22) for accumulated debt.

---

## 🚨 Needs immediate attention

### 1. Hardcoded personal identity in all AI prompts
`index.html:5647`, `5920`, `7319`, `7477`, `7849`, `8604` · commit `0c1d32d`
The AI features (Relationship Nudge, Social Audit, Decisions, Newsletter, etc.) include hardcoded `"Panos"`, `"Givelink"`, `"Greek founder"`, and `"SF move"` in the Claude prompt strings. These are the developer's personal details, baked in during rapid development of the AI lab feature set. Every user who runs these features receives advice about a stranger's life. This is a ship-blocking bug for any multi-user use of the product.

---

### 2. Push notification icon resolves to a 404
`sw.js:46–47` · commit `0c1d32d` (sw.js updated in this commit)
The push handler references `./icons/icon-192.png` — a path that does not exist in the repo. The correct file is `./icon-192.png`. This means every push notification (task reminders, streak nudges) silently fails or renders with a broken icon. Given that push is a retention mechanism, this is a silent churn driver.

---

### 3. `aiProxy` left empty — AI is a dead feature in production
`index.html:9959` · commit `0c1d32d`
`APP_CONFIG.aiProxy = ''` was presumably left empty as a placeholder when the proxy endpoint (`api/claude.js`) was written. The proxy is fully implemented and ready to deploy. But in hosted mode (Supabase URL configured), all AI features are gated behind a missing proxy URL, and the "Add your Claude API key in Settings" fallback toast has no action path for hosted users. The entire AI value proposition is non-functional in production.

---

### 4. Share progress card still carries old "Task OS" brand
`index.html:10214–10215` · commit `fb63461`
The `_drawStatsCard()` canvas function was introduced in commit `fb63461` ("PLG Tier 2: shareable progress card") — a PLG growth feature. But the brand on the card still reads "Task OS" while the rebrand to "Arete" landed in commit `0c1d32d`. Every share of the progress card actively hurts the Arete brand.

---

## 🧹 Cleanup opportunities

### 5. Empty catch blocks hiding sync/auth failures
`index.html:10131, 10134, 10381` · commit `0c1d32d`
```
try{await sbSyncNow(true);}catch(e){}    // line 10131 — _afterAuth
try{_applyPendingTemplate();}catch(e){}  // line 10134
try{sbSyncNow();}catch(e){}              // line 10381 — auth boot
```
These were introduced in the reliability sweep of `0c1d32d`. Intent was "don't crash the page if sync fails" — reasonable. But the empty catch means a broken Supabase key, expired token, or network failure at login is completely invisible. The sync pill should show `'⚠ Sync failed'` on these paths.

---

### 6. Hardcoded `_APP_URL` using dev Vercel domain
`index.html:10180` · commit `32e7288` ("Product-led growth: referral links")
```js
const _APP_URL='https://task-management-beige-eight.vercel.app/';
```
This was added when referral links were introduced and hasn't been updated through the rebrand. Every invite, template share, and referral URL embeds the dev Vercel hostname. Needs a config constant — ideally derived from `location.origin` or a top-of-file `APP_DOMAIN` constant.

---

### 7. `console.warn` left in production theme/save paths
`index.html:2573, 2598, 3659, 3737`
```
console.warn('theme media listener', e)   // 2573
console.warn('Corrupt localStorage...')   // 2598
console.warn('_wizSave error', e)         // 3659
console.warn('fab action', e)             // 3737
```
These are reasonable diagnostic warnings — they're not `console.log` debugging. But they leak internal details to the browser console in production. They're fine to keep; they should just be routed through a `debug()` wrapper that's a no-op unless `?debug=1` is in the URL. Worth doing next quiet cycle, not now.

---

### 8. `givelink.html` apple-touch-icon references an SVG
`givelink.html:6` · commit `d635c06` ("Remove Givelink from Task OS")
```html
<link rel="apple-touch-icon" href="icon-gl.svg">
```
Safari ignores SVG for homescreen icons. A PNG at 180×180 is needed. Minor but affects the Givelink PWA install experience on iOS.

---

## 🤔 Worth a second look

### 9. `sbSyncNow` may overwrite newer local data with older remote
`index.html:10416–10426` · commit `0c1d32d`
The sync logic merges remote data when `remote.ms > localMs`. The merge is a shallow spread: `S = {...S, ...remote.data}`. If a user edits a nested array (e.g. `S.tasks`) on device A and the remote has an older `_updatedAt` than device B's last push, device A's edits win. But if device B's `_updatedAt` is technically newer (e.g. because it pushed a trivial settings change), device A's task edits get silently discarded. The last-write-wins scheme is documented in `supabase-setup.sql`, but the timestamp granularity (milliseconds set at save time) makes this a real race condition in practice when two devices are active.

**Why it looks suspicious**: Several commits in the last sprint (`#80`, `#72`, `#71`) specifically addressed login/sync/timezone bugs, suggesting this area has been unstable. The fix may have introduced this subtler conflict edge case.

---

### 10. Guest-to-signup conversion: local data merge uses spread, may drop tasks
`index.html:10129`
```js
if(wasGuest){localStorage.removeItem('taskos_guest');}
// then sbSyncNow(true) pulls remote (empty for new user) → sees localMs > remote.ms → pushes local. OK.
```
The guest conversion path looks correct when the account is brand-new. But if the same email was used to sign in on a different device first (creating a remote row), `sbSyncNow(true)` may treat the remote row as authoritative and overwrite the guest's local work. This is a data-loss scenario for the specific case: "tried the app as a guest, came back and signed up, lost everything." Low frequency but high severity — worth a specific test.

---

_Triage complete. 4 items need immediate attention before any new features ship._
