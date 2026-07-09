# Weekly Triage — 2026-07-09

## 📊 Week at a glance
- **Commits**: 16 | **Files changed**: index.html (16×), sw.js (5×), vercel.json (2×), api/claude.js (1×), supabase-setup.sql (1×), icons (1×)
- **High-churn files**: `index.html` (touched in every commit this week), `sw.js` (5 commits)
- **Debt markers added this week**: 2 new empty `catch(e){}` blocks; no new TODOs/FIXMEs; 1 acknowledged missing feature (rate limiting in api/claude.js)

---

## 🚨 Needs immediate attention

### 1. `authLogout()` does not clear app data — data leak on shared devices
**`index.html:9966–9970`** · introduced in `e0b0a00` (hosted signup, Jul 6)

The logout path removes session tokens (`taskos_sb_access`, `taskos_sb_refresh`, `taskos_sb_uid`, `taskos_sb_exp`) but leaves the full app state blob (`taskos` key) in localStorage. When the next user signs in, `load()` picks up the previous user's state and `sbSyncNow` pushes it to the new user's cloud row.

Commit `9f898e0` fixed the "owner seeds new signups" bug, but the fix only guards against seeding when the browser has no existing tasks (`!S.tasks||S.tasks.length===0`). A logout-and-re-login on the same device bypasses that guard entirely.

**Why this matters**: New signups on any device the owner has previously used will silently inherit private tasks, goals, and personal data.

---

### 2. Push notification icons reference a non-existent path
**`sw.js:41–42`** · introduced in `1fb177a` (rebrand, Jul 5)

```js
icon:'./icons/icon-192.png',   // ← no icons/ subdirectory exists
badge:'./icons/icon-192.png',
```

The actual file is `./icon-192.png`. This path was not updated during the rebrand commit that moved/renamed the icons. Every push notification (daily reminders, etc.) will display with a broken icon on Android.

**Why this matters**: Broken notification icons erode trust in the PWA on Android — it looks like an unfinished app.

---

### 3. Google Fonts blocked by the Content-Security-Policy
**`vercel.json` CSP header** · introduced in `07213ad` (CSP enable, Jul 4)

`style-src 'self' 'unsafe-inline'` and `font-src 'self'` block `fonts.googleapis.com` and `fonts.gstatic.com`. The `<link>` to Inter (index.html:16) silently fails. All production users see the OS fallback sans-serif rather than the designed Inter typeface.

This was present from the moment the CSP was added — it's been shipping broken fonts for 5 days.

**Why this matters**: Every user currently sees the wrong font; the visual design and brand identity are broken in production.

---

### 4. No per-user rate limiting on the Claude proxy (acknowledged in code)
**`api/claude.js:13`** · introduced in `e0b0a00` (hosted signup, Jul 6)

```js
// Note: this is a minimal proxy. For production add per-user rate limiting
// (e.g. Upstash) so a single account can't run up your Anthropic bill.
```

This shipped as a known gap. With the hosted auth now live and real users able to sign up, the gap is now exposed to production traffic.

**Why this matters**: A single user repeatedly hitting "Plan my day" or "Morning briefing" can generate unbounded API spend.

---

## 🧹 Cleanup opportunities

### 5. Two new empty `catch(e){}` blocks added in commit `2fa1c76`
**`index.html:10011, 13254`** · introduced in `2fa1c76` (account chip, Jul 6)

```js
// line 10011
try{const g=document.getElementById('greeting');...}catch(e){}

// line 13254
try{_renderAccountChip();}catch(e){}
```

The account chip render and greeting update both swallow errors silently. If `_renderAccountChip()` throws (e.g., missing DOM element), there's no signal to debug.

**Why this matters**: The account chip is new (this commit) — if it breaks, there's no error surface. At minimum, `catch(e){console.warn('account chip',e)}`.

---

### 6. `callClaudeGL` in `givelink.html` falls back to `window.prompt()` for API key
**`givelink.html:1261`** · present since the givelink page was added

```js
if(!k){k=window.prompt('Enter Anthropic API key:');if(k)localStorage.setItem('taskos_api_key',k);}
```

This uses a system-level browser dialog, which is blocked in many mobile contexts, bypasses the app's UX, and leaks the API key in browser history on some implementations. The proxy at `/api/claude` is not used by givelink.html at all.

**Why this matters**: Users who tap AI features in the Givelink tab (sprint planner, outreach generator) get a raw system prompt with no explanation or branding.

---

### 7. `aiProxy` config field is empty — AI features non-functional for hosted users
**`index.html:9812`** · introduced in `e0b0a00`

```js
aiProxy : '',   // e.g. 'https://taskos.vercel.app/api/claude'
```

The proxy URL is shipped as an empty string despite the `/api/claude` serverless function being deployed. Users who sign up via the hosted auth flow and don't have a personal Claude key get "Add your Claude API key in Settings" — an irrelevant instruction.

---

## 🤔 Worth a second look

### 8. `_welcomeSeed()` is only triggered when `S.tasks.length === 0`
**`index.html:10078`** · introduced in `9f898e0`

```js
if(_hostedMode()&&!remote&&!S._welcomed&&(!S.tasks||S.tasks.length===0)){_welcomeSeed();}
```

This guard correctly handles a fresh browser. But if the in-memory `S` has tasks (e.g., carried over from a previous session's localStorage that wasn't cleared), a new user won't get the welcome seed and instead their empty cloud row gets pushed with someone else's data.

The fix for item #1 above (clearing `taskos` from localStorage on logout) would close this gap — but it's worth tracking as a separate logical condition.

---

### 9. `_hostedMode()` always returns `true` in production config
**`index.html:9816`**

```js
function _hostedMode(){return !!(APP_CONFIG.supabaseUrl&&APP_CONFIG.supabaseAnon);}
```

Both values are hardcoded in `APP_CONFIG`. This means `seed()` and `seedGoals()` are permanently skipped (guarded by `if(!_hostedMode())`). If someone clones the repo to run locally they see only the auth gate — not the demo with 389 tasks. This is intentional for the hosted product but creates a silent developer experience barrier.

If development requires the full seeded demo, a dev override (e.g., `?devMode=1` or `localhost` detection) would help.

---

### 10. `Cmd+2` shortcut navigates via hardcoded relative string
**`index.html:10137`** · introduced during keyboard shortcuts work

```js
if((e.metaKey||e.ctrlKey)&&e.key==='2'){e.preventDefault();window.location.href='givelink.html';}
```

Works fine at the root. Would 404 on any subpath deployment. Low priority now, but worth noting before the app is ever moved.
