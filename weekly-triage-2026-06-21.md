# Weekly Triage — 2026-06-21

> **Note:** No commits landed in the last 7 days (last commit: `0b54845` on 2026-06-08).  
> This triage covers the most recent sprint: the 4 bug-fix commits from June 8 plus the
> underlying Supabase-sync and Givelink-dashboard features they patched (commits #48–54,
> spanning 2026-05-29 → 2026-06-08). `index.html` was the only file changed across all 10
> commits in the past 3 weeks — it is the single highest-churn file in the repo.

---

## 📊 Week at a glance

- **Commits this calendar week:** 0  
- **Commits in most-recent active sprint (May 29 – Jun 8):** 10  
- **Files changed:** 2 (`index.html` × 10 commits, `supabase-setup.sql` × 1)  
- **Debt markers added this sprint:** 0 TODOs / 0 FIXMEs / 0 `console.log` (clean sprint)  
- **High-churn files:** `index.html` (only substantive code file — all 10 commits touch it)

---

## 🚨 Needs immediate attention

### 1. CSP blocks Supabase sync in production — feature ships broken
`vercel.json:14` — introduced with the Supabase feature in `67de902`

The `connect-src` directive covers `api.anthropic.com`, `ntfy.sh`, `readwise.io`, and `api.notion.com`, but not `*.supabase.co`. Every Supabase auth call (`/auth/v1/token`) and every data push/pull (`/rest/v1/app_state`) is blocked by the browser's CSP engine before leaving the device. The feature is invisible without Vercel deploy logs — the user just sees "⚠ push 0" or "⚠ auth 401."

**Why this matters:** Cloud sync is the headline feature of commit `#50`. As-shipped, it works in local dev (no Vercel CSP) but silently fails for anyone using the production deployment.

---

### 2. Claude API key written into Supabase cloud database on every sync
`index.html:2036, 8506, 8609` — `claudeKey` in `S`, saved via `saveSettings()`, pushed by `sbPush()`

`S.claudeKey` is part of the top-level state object that `sbPush()` serializes as-is:
```js
const body=[{user_id:_SB.uid,data:S,...}]; // S includes claudeKey
```
Any user who sets a Claude API key AND enables Supabase sync has their key stored in plaintext in the cloud database. RLS protects it from other users but not from a leaked/public Supabase anon key or a compromised project.

**Introduced by:** `67de902` (Supabase sync). The key was already in `S` before that; the risk materialized when sync was added.

---

### 3. Push notification icon path is a 404 — ntfy alerts broken
`sw.js:38-39`, `index.html:9286` — predates this sprint, not fixed in recent commits

```js
icon:'./icons/icon-192.png',  // this file does not exist
```
The repo contains `icon.svg` and `icon-gl.svg` at the root. No `icons/` directory exists. On Chrome/Android, push notifications and in-app `Notification()` calls that reference a missing icon are either degraded (no icon) or blocked entirely.

**Why this matters:** The ntfy-based reminder system added in `#38` is a user-visible feature; broken icons undermine trust. This should have been caught in the Givelink dashboard bug-fix session on June 8 but wasn't.

---

### 4. SW cache name stale since May 30 — June 8 bug fixes not served to PWA users
`sw.js:1` — not updated in commits `#51–54`

```js
const CACHE = 'task-os-20260530';
```
Four bug fixes shipped June 8 (commits `#51`, `#52`, `#53`, `#54`) — backdrop close, discomfort ladder crash, wins blank title, Givelink swipe. Any user who installed the PWA before June 8 is still running the May 30 cached build and hitting these bugs. The cache name must change for the service worker to evict the old version.

---

## 🧹 Cleanup opportunities

### 5. XSS: `t.title` injected raw into `innerHTML` in Weekly Review wizard
`index.html:2888, 2895, 2897` — `renderWizPanel()` steps 0, 2, 3

The `esc()` helper exists at `index.html:9773` and is used correctly in 95% of render functions. These three branches in `renderWizPanel()` are the only places where user-entered task and goal titles are inserted directly into `innerHTML` without escaping.

```js
// line 2888 — step 0: completed tasks
`<div class="tt" ...>${t.title}</div>`   // ← should be esc(t.title)
// line 2895 — step 2: backlog
`<div class="tt">${t.title}</div>`       // ← same
// line 2897 — step 3: goals
`${g.title}`                             // ← same
```
This is a self-XSS (single-user local app) but still wrong in principle. Introduced in the original wizard; not patched in subsequent bug-fix rounds.

---

### 6. `toLocaleDateString` dependency option selector populates without `label` elements
`index.html:2062`

```js
s.innerHTML='...'+'<option ...>'+t.title.slice(0,45)+'</option>';
```
Same unescaped `t.title` pattern as above, in the dependency-picker `<select>`. Minor but consistent.

---

### 7. Empty `catch(e){}` swallowing errors in navigation collapse
`index.html:2433`

```js
}catch(e){}  // silently drops any localStorage parse error
```
The nav-collapse state reads/writes `localStorage` and swallows all errors with an empty catch. If `taskos_nav_collapsed` is ever corrupted, the sidebar silently reverts to defaults with no user notice and no diagnostic output.

**Commit that introduced it:** Present since at least commit `#46` (nav IA redesign). Similar empty catches also at `index.html:2501`, `2877` (weekly review draft restore).

---

### 8. Hardcoded personal goals embedded in Finance and Health view HTML
`index.html:4199, 4299-4300, 10771, 10973`

```
"Income 2026 (goal: €25K)"
"Passive this month (goal: €300)"
"Body fat % (goal: 12%)"
```
These are literal strings, not derived from `S` or Settings. Added across multiple sprint cycles; no single commit to blame. Will confuse any second user of the app and look like broken placeholder UI.

---

### 9. Impact model divides by hardcoded 50 instead of user-edited `avgSize`
`index.html:7506` — introduced in `#37` or earlier

```js
const peopleImpacted=Math.round(totalDonations/50);
```
`avgSize` is already computed from `im.avgDonationSize` on the line above. The `peopleImpacted` formula should use `avgSize` instead of the literal `50`. If the user edits donation size to $100, the displayed number is half what it should be.

---

## 🤔 Worth a second look

### 10. `sbConnect()` tries signup when login fails — user gets stuck on email-confirm
`index.html:8576-8582`

```js
try { j=await _sbAuth('password',{email,password}); }
catch(e){
  const r=await fetch(`.../auth/v1/signup`, ...);
  if(!j.access_token){ _sbSetStatus('⚠ Confirm your email...'); return; }
}
```
If login fails (wrong password), the app silently attempts to *create a new account* with the same email. If that account doesn't exist yet, the signup succeeds and the user is asked to confirm an email they may not have intended to create. If the account *does* exist, the signup fails with a confusing "User already registered" error that's swallowed inside the catch's catch. This is intentional as a "first-time setup" convenience but could surprise users who mistype their password.

**Suggested check:** Add a round-trip to check if the user exists before attempting signup, or split into two explicit buttons ("Sign In" / "Create Account").

---

### 11. `_sbBusy` prevents concurrent syncs but doesn't queue the missed write
`index.html:8612-8631`

If a sync is in-flight when another save triggers `_sbScheduleSync()`, the 2.5s timer resets correctly. But if the *scheduled timer fires while `_sbBusy` is still true* (a slow push), `sbSyncNow()` returns immediately (`if(_sbBusy)return`) and the latest changes are not re-queued. In practice this only matters on very slow connections — the next user action will trigger a new sync — but it means a single-action session (e.g., quick habit check then close tab) could lose the sync window.

---

### 12. `Notion-Version: 2022-06-28` header — check deprecation timeline
`index.html:8930`

Notion's API version `2022-06-28` is 4 years old. The integration is already broken by CORS, so this doesn't cause immediate harm, but if/when a proxy is added (see IMPROVEMENT_PLAN item #5), verifying the version is still supported will prevent a debugging mystery.
