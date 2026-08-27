# Weekly Triage — 2026-08-27

## 📊 Week at a glance

- **Commits this week:** 1 (`5cd9437 README update`)
- **Files changed:** 1 (`README.md` only)
- **Debt markers added this week:** 0
- **High-churn files:** N/A — only one file changed
- **Velocity note:** The single commit this week was documentation-only. All active findings below come from a static scan of the current codebase, not this week's changes.

---

## 🚨 Needs immediate attention

### 1. Morning briefing silently skips for proxy users

**`index.html:11670`** · introduced in commit `0c1d32d` ("Rebrand to Arete + first-run magic moment")

```js
if(!S.claudeKey&&!localStorage.getItem('taskos_api_key'))return;
```

`taskos_api_key` is never written by the app. `APP_CONFIG.aiProxy` (the real path for hosted users) is not checked. Proxy users see the briefing section but it never populates — silent failure on the most visible dashboard feature. **Fix: replace with `if(!S.claudeKey && !APP_CONFIG.aiProxy) return;`**

---

### 2. All AI prompts hardcode "Panos" / "Givelink" as the user identity

**`index.html:5647, 5920, 7319, 7849, 8604, 11672` and 4 others** · introduced across commits `#68`–`#83`

The morning briefing, relationship nudges, discomfort coach, decisions AI, brand audit, and weekly newsletter all send "Panos, Greek founder building Givelink" as identity context to Claude — regardless of who is actually using the app. Any non-developer user gets AI advice tailored to a stranger's life. **This breaks the product's core value proposition for every other user.**

---

### 3. Service worker push notification icon path is a 404

**`sw.js:46-47`** · introduced in commit `1fb177a` ("Rebrand app icon + logo to violet, add a launch splash")

```js
icon:'./icons/icon-192.png',   // ./icons/ directory does not exist
badge:'./icons/icon-192.png',
```

The correct path is `./icon-192.png`. Every push notification fires without an icon on Android. The `icons/` directory was never created when the icon was moved to the root.

---

### 4. API proxy has no rate limiting and may be fully unauthenticated

**`api/claude.js:12`** — acknowledged in a comment but never implemented

```js
// Note: this is a minimal proxy. For production add per-user rate limiting
```

The Supabase auth check is behind `if(process.env.SUPABASE_URL)`. If this env var is not set (any misconfigured deployment), the endpoint accepts arbitrary POST requests with no authentication, allowing anyone to drain the Anthropic API budget.

---

## 🧹 Cleanup opportunities

### 5. Stale `taskos_api_key` localStorage key

**`index.html:11670`**

`localStorage.getItem('taskos_api_key')` references a key that the app never writes. The current code uses `S.claudeKey` (stored inside the main serialised state object). This dead check has been in the codebase since at least commit `0c1d32d`.

---

### 6. Default `profileName = 'Panos'` shown to every new user

**`index.html:2519`** · `let profileName=localStorage.getItem('taskos_name')||'Panos';`

A new user's dashboard header reads "Good morning, Panos 👋" until they visit Settings. The guest-to-signup funnel (added in `#77`) never prompts for a name. This was a development shortcut that was never cleaned up.

---

### 7. `seedGoals()` is 394 lines of personal content (Givelink, SF move, etc.)

**`index.html:4532–4926`** · present since commit `#37`

The function seeded with the developer's personal goals/tasks — "Financial Independency w/ Givelink", "Song on Givelink", "ETF for founder-led companies", "6+ Months in SF" — runs for every non-hosted-mode user. Commit `d635c06` removed Givelink from the main UI but this function was not updated.

---

### 8. PostHog analytics key is blank — all tracking is a no-op

**`index.html:9960`** · `posthogKey: '',`

`track()` is called for 20+ meaningful events (`auth_login`, `auth_signup`, `guest_to_signup`, `first_win`, etc.) but they all no-op silently. Zero visibility into conversion or activation. Added in commit `b38d4bb` ("analytics, SEO foundation") but the key was never configured.

---

### 9. `givelink.html` still in the main app's SW cache after product separation

**`sw.js:17`** — `'./givelink.html'` in the `HTML` array

Commit `d635c06` ("Remove Givelink from Task OS — fully separate the two products") separated the products at the UI level, but the service worker still pre-caches `givelink.html` for all main-app users, bloating install time and wasting cache quota.

---

## 🤔 Worth a second look

### 10. `innerHTML` assignment of raw AI output in the morning briefing

**`index.html:11704`**

```js
if(body)body.innerHTML=lines.join('<br><br>');
```

`lines` contains unescaped AI-generated text. The app has an `esc()` helper (line 11776) used consistently elsewhere — it was just not applied here. Low-severity today (Anthropic responses are not adversarially controlled), but briefings are cached in localStorage across sessions — a malformed cache entry executes on every load.

---

### 11. `givelinkMetrics` field still in core state schema

**`index.html:2517`**

The main state object `S` still contains `givelinkMetrics` (pipeline, ARR, MRR, nonprofit count, impact model). After the product separation in `d635c06`, this field is vestigial in the main app state. It bloats every localStorage save and cloud sync payload. `openGivelinkMetrics()` at line 8727 is a 107-line function still rendering a full dashboard panel.

---

### 12. `_sbToken()` has no timeout — a hung token refresh can freeze all sync

**`index.html:10022-10026`**

```js
async function _sbToken(){
  if(!_SB.refresh)throw new Error('not connected');
  if(_SB.access&&Date.now()<_SB.exp-60000)return _SB.access;
  const j=await _sbAuth('refresh_token',{refresh_token:_SB.refresh});
  // ↑ no AbortController, no timeout
```

If the Supabase auth endpoint is slow or unreachable, this hangs indefinitely. `sbPull()` and `sbPush()` await this without a timeout, so the sync indicator spins forever with no user-facing recovery path or retry.

---

_Total: 12 items — 4 immediate, 5 cleanup, 3 worth a second look._
_This week had minimal commit activity (1 commit, docs only). All findings are from static analysis of the current HEAD._
