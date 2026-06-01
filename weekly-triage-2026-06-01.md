# Weekly Triage — 2026-06-01

## 📊 Week at a glance
- **Commits:** 12 | **Files changed:** 4 (unique) | **Empty catch blocks:** 10
- **High-churn files:** `index.html` (12/12 commits), `sw.js` (4/12), `supabase-setup.sql` (1/12)
- **Suspicious commit keywords:** 1 `fix` (d3a28fb), 1 `wip`-adjacent (mobile polish series)
- **All 12 commits landed on two calendar days** (May 28–29) — velocity spike, not sustained flow

---

## 🚨 Needs immediate attention

### 1. Push notification icon is a 404 — silent failure on every push
**`sw.js:40`** — commit `dd16e0c`

```js
icon: './icons/icon-192.png',
badge: './icons/icon-192.png',
```

There is no `icons/` directory in the repo. No `.png` files exist at all. Every push notification will render without an icon (or fail silently depending on browser). Users on iOS PWA will see a blank notification badge.

**Fix:** Create `icons/icon-192.png` (and `icon-512.png`) from the existing `icon.svg`, or change the path to `./icon.svg`.

---

### 2. Supabase cloud sync shipped untested against a live project
**`index.html:8546–8604`** — commit `67de902`

The commit message for the largest new feature explicitly states:
> *"the Supabase calls follow Supabase Auth + PostgREST conventions but couldn't be tested against a live project in this environment — needs a real project to verify end to end."*

This is in production. Users who attempt to configure cloud sync may hit auth flow bugs, upsert failures, or token refresh race conditions with no feedback beyond the status line. The `_sbApplying` flag is set to `true` inside `sbSyncNow` but only reset on the happy path — if `save()` throws (rare but possible) it stays `true` indefinitely, permanently disabling `_sbScheduleSync`.

**Fix:** Manual QA pass with a real Supabase project before promoting the feature.

---

### 3. Personal financial targets hardcoded in source — two separate locations, out of sync
**`index.html:5136`** and **`index.html:2849`** — commit `1d3ea98`

```js
// Line 5136
const _NS_TARGETS = {bodyfat:12, sleep:85, workout:5, weight:75, income:25000, passive:3600};

// Line 2849 (Goals view)
const targets = {income:25000, passive:3600};
```

And hard-rendered in HTML at line 4296:
```js
`Income ${yr} (goal: €25K)`
```

Three different places encode the same personal targets. If you update the goal in one place, the North Star strip, the Goals view, and the Finance progress bar will diverge. These are also not the app user's goals — they're the developer's personal targets baked into shipping code.

**Fix:** Read from `S.goals` target values, not the hardcoded object. The `_northStarPace` function already reads `g.targetValue` — `_NS_TARGETS` is only used as a fallback and should be removed.

---

### 4. Hardcoded AI model ID will break silently when deprecated
**`index.html:4136`** — commit `1d3ea98`

```js
body: JSON.stringify({model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, ...})
```

Every AI feature in the app (sequencing, briefing, workflow hub, coaching, social posts) routes through `callClaude()` which hardcodes this model. When this model ID is retired, all AI features return an API error that surfaces only as a toast — no graceful degradation, no fallback.

**Fix:** Move to a `S.claudeModel` setting (default: current ID), or at minimum add a settings field so the user can update it without a code deploy.

---

### 5. Sync conflict resolution is silent last-write-wins — multi-device data loss risk
**`index.html:8611–8626`** — commit `67de902`

```js
if (remote && remote.data && remote.ms > localMs) {
  S = {...S, ...remote.data};  // remote wins, local changes discarded
```

If a user works offline on two devices and both sync within the same second (or if `_updatedAt` is the same), the push silently overwrites. There is no merge, no diff, no conflict notification. A user closing a task on their phone while their laptop just pushed a new task will lose one of those changes.

**Fix:** At minimum, show a toast when remote data is applied ("Remote sync applied — local changes since X may have been overwritten"). A proper fix merges the `tasks` array by ID.

---

## 🧹 Cleanup opportunities

### 6. Ten silent empty `catch(e){}` blocks across critical paths
Multiple locations — commits `cc36c6f` through `67de902`

These swallow exceptions with zero logging or user feedback:

| Line | Context | Why it matters |
|------|---------|----------------|
| `2430` | `_toggleNsGroup` — localStorage write | Nav state silently fails to persist |
| `2498` | Weekly review draft banner | Draft resume banner may not show |
| `2874` | Review wizard restore | Wizard step restore fails invisibly |
| `4513` | `awardXP(5,'workflow')` | XP never awarded; user can't tell |
| `8619` | `refresh()` after cloud sync pull | UI doesn't update after sync with no error |
| `8649` | `_autoSnapshot()` body | Daily Givelink history point silently skipped |
| `8670` | Nav collapsed state restore | Sidebar state not restored, no error |
| `10049`| `awardXP(15,'eod')` | EOD XP never awarded |
| `9305` | ntfy push notification | Notification silently dropped |
| `3227` | `_haptic()` | Acceptable — vibrate API failure is truly ignorable |

The XP ones are the most user-visible: completing the EOD ritual or keeping an automation shows the success toast but doesn't actually award XP if `awardXP` throws.

---

### 7. Magic numbers for timeouts and animation delays are scattered and inconsistent
**`index.html:2079,2284,2309,2329,2442,2473,2491,2500,2684,2801,8669`** — multiple commits

Examples:
```js
setTimeout(()=>document.body.classList.remove('theme-anim'), 400);  // matches CSS?
setTimeout(()=>{el.remove();}, immediate ? 0 : 240);  // what transition is 240ms?
setTimeout(()=>{inp.focus();inp.select();}, 60);
setTimeout(()=>_vEl.classList.remove('entering'), 520);  // CSS transition is how long?
setTimeout(()=>{if(_sbEnabled()) sbSyncNow();}, 900);  // why 900?
```

None are referenced against the CSS transition values they're designed to match. If the CSS changes, the JS timeouts silently desync.

---

### 8. `_autoSnapshot` empty catch hides the only data-collection path for Pace Engine
**`index.html:8645–8659`** — commit `67de902`

```js
function _autoSnapshot(){
  try{ ... localStorage.setItem('taskos_autosnap', today); }
  catch(e){}  // ← completely silent
}
```

This function is the sole source of historical data for the North Star Pace Engine trend lines. If it fails (quota exceeded, private browsing, etc.) the Pace Engine degrades to "no data" with no indication. A `console.warn` at minimum would help diagnosis.

---

## 🤔 Worth a second look

### 9. Claude API key stored and sent from browser with no scope guard
**`index.html:4133–4148`** — commit `cc36c6f`

```js
headers: {
  'x-api-key': S.claudeKey,
  'anthropic-dangerous-direct-browser-access': 'true'
}
```

The key lives in `localStorage` (`taskos_api_key`) and in `S` (serialized to `localStorage`). Any injected script, browser extension, or XSS has full access to it. The `anthropic-dangerous-direct-browser-access` header is the documented workaround for CORS, which means Anthropic has acknowledged this pattern as intentionally risky. Fine for a personal tool; concerning if this ever becomes multi-tenant.

---

### 10. `sw.js` CACHE name is hardcoded with a date — requires manual bump on every deploy
**`sw.js:1`** — commit `dd16e0c`

```js
const CACHE = 'task-os-20260530';
```

The cache version is not tied to a build hash or the HTML's actual content. Between May 29 and today (June 1), `index.html` was updated in commit `67de902` but the service worker cache version was not bumped. Users with a cached PWA may be running yesterday's code until they force-refresh.

---

### 11. AI Workflows Hub passes an empty `ctx` object to `wf.build()` — goal linking is fragile
**`index.html:4476–4483`** — commit `1d3ea98`

```js
const ctx = {};
const prompt = wf.build(ctx);  // build() may populate ctx.goalId, ctx.category
const text = await callClaude(prompt, wf.maxTokens || 650);
_wfLast = {id, title:wf.title, text, tasky:!!wf.tasky, goalId:ctx.goalId||null, ...};
```

Workflows populate `ctx` as a side effect of building their prompt (e.g. picking the weakest North Star goal). If a workflow doesn't set `ctx.goalId`, tasks added from it are unlinked from any goal. There's no validation that the goal ID actually exists in `S.goals` before the task is pushed.

---

### 12. Supabase anon key stored as plain text with misleading comment
**`index.html:8528`** and `supabase-setup.sql` setup note

The setup SQL notes: *"The anon key is meant to be public; Row Level Security above ensures a user can only ever touch their own row."* This is accurate — but the RLS `update` policy uses `auth.uid()` which requires an authenticated JWT. The `sbPush` function sends `'apikey': _SB.anon` alongside `'Authorization': 'Bearer '+tok`. If `tok` is expired and `_sbToken()` fails to refresh (network blip), the push hits the API with only the anon key and no auth header — Postgres RLS will reject it, but the error is surfaced only as `⚠ push 401` in the status line with no retry.

---

*Triage generated 2026-06-01. All line numbers reference the current HEAD (`67de902`).*
