# Weekly Triage — 2026-08-07

## 📊 Week at a glance
- **Commits this week:** 0 (last commit: `b38d4bb` on 2026-07-22 — 16 days ago)
- **Files changed this week:** 0
- **Debt markers added this week:** 0 (no activity)
- **High-churn files:** N/A — no commits this week
- **Note:** Because there were zero commits in the past 7 days, this report covers a static scan of the codebase from the last active commit. All findings below are pre-existing.

---

## 🚨 Needs immediate attention

### 1. API proxy has no auth when `SUPABASE_URL` env var is absent
**File:** `api/claude.js:22` | **Introduced:** `b38d4bb` or earlier
```js
if (process.env.SUPABASE_URL) {   // ← entire auth block skipped if env var is unset
  const tok = (req.headers.authorization || '').replace(...)
```
**Why this matters:** If the Vercel deployment is missing the `SUPABASE_URL` env var (easy to miss when deploying fresh), the `/api/claude` endpoint accepts requests from anyone on the internet. The Anthropic API key gets billed per token — an open endpoint is a financial risk.

**Action:** Verify `SUPABASE_URL` is set in Vercel → Settings → Environment Variables. If it is, you're covered for now; still consider making auth unconditional.

---

### 2. Push notification icon references a non-existent path
**File:** `sw.js:46–47` | **Introduced:** unknown (appears to be a leftover from a directory restructure)
```js
icon:  './icons/icon-192.png',   // ← directory doesn't exist
badge: './icons/icon-192.png',
```
The actual asset path is `./icon-192.png` (sw.js:7). Every push notification currently shows a broken icon.

**Action:** Change both paths to `'./icon-192.png'` and bump the CACHE version string to bust stale service workers.

---

### 3. `save()` has no error handling for localStorage quota exceeded
**File:** `index.html:2578` | **Introduced:** initial commit
```js
function save(){
  ...
  localStorage.setItem('taskos', JSON.stringify(S));  // ← no try/catch
```
The state object `S` is enormous (tasks, goals, habits, health logs, finance entries, automations, books, people, etc.). Power users with months of data will hit the 5–10MB localStorage quota. When that happens, the write silently fails and the user loses their last session of changes with no feedback.

**Action:** Wrap in try/catch; toast a storage-full warning and suggest exporting data or connecting Supabase sync.

---

### 4. "Panos" hardcoded as default profile name — all new users get wrong personalization
**File:** `index.html:2519` and 14 other AI prompt locations | **Introduced:** appears to be pre-rebrand to multi-user
```js
let profileName = localStorage.getItem('taskos_name') || 'Panos';
```
AI prompts (coaching, brand audit, weekly notes, decisions, discomfort analysis, book highlights, relationships) all fall back to `"Panos — Greek founder in his 20s building Givelink"` context when no profile is set. Every new user who skips the name setup gets AI suggestions written for a specific person.

**Action:** Change default to `''` or `'you'`. Require name setup before AI features are enabled, or dynamically use first-person language when no name is set.

---

### 5. Personal task seed visible to all new users
**File:** `index.html:4653` | **Introduced:** pre-rebrand seed data
```js
mk('Unsubscribe from things I don\'t want (Superhuman for panagiotis email?)','backlog','other','low','low','low'),
```
This personal task (including an email address reference) is seeded into every new user's task list.

**Action:** Delete or replace this line. Audit the rest of `_seedStarter()` for other personal tasks that reference Panos's specific startup situation.

---

## 🧹 Cleanup opportunities

### 6. 71 empty catch blocks silence all errors across the app
**File:** `index.html` (71 instances — search `catch\s*(e)\s*\{\}`)
```js
try { ... } catch(e) {}   // repeated 71 times
```
Errors in auth, Supabase sync, rendering, and AI calls are completely invisible. Debugging any production issue requires re-inserting logging manually.

**Commit that introduced them:** The pattern appears throughout the codebase from many commits. Not introduced this week.

**Action (medium-term):** Add at minimum `console.warn('[functionName]', e)` in critical paths (auth, save, sync, AI). Consider a global error telemetry call: `track('js_error', {fn, msg: e.message})`.

---

### 7. Givelink-era artifacts still active in the service worker
**File:** `sw.js:4, 16`
```js
'./manifest-givelink.json',   // sw.js:4
'./givelink.html',            // sw.js:16
```
These are pre-rebrand files. `givelink.html` is actively served at `/givelink` with old branding. The SW pre-caches both on every install, adding unnecessary overhead.

**Commit:** `72d9c68` (Brand consistency rebrand) should have cleaned these up but didn't touch sw.js.

**Action:** Remove both from the SW cache list. Either update or redirect `givelink.html`.

---

### 8. `anthropic-version` header is `2023-06-01` — 3+ years old
**File:** `api/claude.js:40`
```js
headers: { ..., 'anthropic-version': '2023-06-01' }
```
This is the oldest supported version. Newer API capabilities won't be accessible. The version may eventually be sunset.

**Commit:** Appears in the initial commit; never updated.

**Action:** Update to `'2025-01-01'` or check the Anthropic docs for the current recommended version.

---

### 9. Service worker cache version is a manually-typed date string
**File:** `sw.js:1`
```js
const CACHE = 'arete-20260723';
```
This string was last updated on 2026-07-22 (the most recent commit). If code is deployed without bumping it, clients get stale assets from cache indefinitely.

**Commit:** `b38d4bb` (last deploy) did bump this — good. But it's a manual process with no automation.

**Action:** Consider automating cache-busting via a CI step that injects a build hash, or document clearly in a pre-deploy checklist that sw.js must be updated.

---

### 10. AI proxy `max_tokens` cap of 2000 truncates complex responses
**File:** `api/claude.js:35`
```js
const max_tokens = Math.min(parseInt(body.max_tokens) || 1000, 2000);
```
Brand audit, weekly review, and Know Thyself analysis prompts generate responses that regularly hit 2000 tokens and are cut off mid-sentence.

**Action:** Raise the server-side cap to 8000. Client call sites can pass appropriate limits per feature.

---

### 11. Landing page canonical URL is a Vercel-generated project slug
**File:** `landing.html:11`
```html
<link rel="canonical" href="https://task-management-beige-eight.vercel.app/">
```
This slug (`task-management-beige-eight`) is not a brand URL. Google indexes this as the canonical address, which will split SEO equity when a custom domain is added.

**Commit:** `b38d4bb` (Landing growth / SEO foundation) added structured data and sitemap but left the canonical pointing at the Vercel slug.

**Action:** Set a custom domain on Vercel. Update canonical, og:url, twitter:url, and JSON-LD url in one pass.

---

### 12. PostHog key is blank on both landing and app — analytics are completely dark
**File:** `index.html:9960`, `landing.html:701`
```js
posthogKey: '',       // index.html
var POSTHOG_KEY = ''; // landing.html
```
Despite the `b38d4bb` commit specifically targeting "analytics" for the landing, the PostHog key was never filled in. All `track()` calls are silent no-ops.

**Action:** Add the PostHog project key to both files. This is a 2-minute fix with high-value impact — the landing→signup funnel described in the commit message is completely untracked until this is done.

---

## 🤔 Worth a second look

### 13. `'unsafe-inline'` in CSP negates XSS protection
**File:** `vercel.json:15`
```
"script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com"
```
This is intentional (required because all JS is inline in `index.html`) but worth flagging: the entire XSS defense layer of the CSP is disabled. The app stores Anthropic API keys, Supabase credentials, and all user data in localStorage. An XSS exploit on any page reads all of it.

**Why it could be intentional:** The single-file architecture requires `'unsafe-inline'`. This is a deliberate architectural trade-off.

**Why to revisit:** As the app acquires more users, the risk surface grows. Extracting JS to an external file (even one large bundle) would allow removing `'unsafe-inline'` entirely.

---

### 14. `connect-src` allows direct browser → `api.anthropic.com` calls
**File:** `vercel.json:15`
The CSP `connect-src` includes `https://api.anthropic.com`. This is required for `givelink.html` (which calls Anthropic directly from the browser), but it means users can call Anthropic directly from `index.html` too — bypassing the auth-gated proxy. This makes the proxy's auth checks optional from a browser enforcement standpoint.

**Why to revisit:** If the intent is to route all AI calls through the proxy (for auth + cost control), removing `api.anthropic.com` from `connect-src` would enforce that. But it would also break the "bring your own API key" mode in index.html. This is a deliberate design choice — document it either way.

---

### 15. No DELETE RLS policy in Supabase — users can't erase their own data
**File:** `supabase-setup.sql` (entire file)
There are SELECT, INSERT, and UPDATE policies but no DELETE policy. Users cannot delete their own `app_state` row. This may become a GDPR compliance issue if EU users request data erasure (Article 17 right to erasure).

**Why it might be intentional:** Single-row-per-user table; deletion was likely not considered since the client overwrites rather than deletes.

**Action:** Add: `CREATE POLICY "app_state delete own" ON app_state FOR DELETE USING (auth.uid() = user_id);`
