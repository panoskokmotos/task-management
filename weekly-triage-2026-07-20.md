# Weekly Triage — 2026-07-20

## 📊 Week at a glance
- Commits: 12 | Files changed: 13 | Debt markers added: 0 explicit TODO/FIXME; ~20 silent `catch(e){}` patterns
- High-churn files: `index.html` (11 commits), `sw.js` (10 commits), `landing.html` (2 commits)
- All 12 commits from a single author; zero test commits this week
- Theme: heavy PLG push (guest mode, templates, referrals, shareable cards, onboarding, rebrand)

---

## 🚨 Needs immediate attention

### 1. Service worker cache key is dated 3 days in the future
**`sw.js:1`** — commit `0c1d32d`

```js
const CACHE = 'arete-20260723'; // deployed 2026-07-20
```

Today is Jul 20. The cache name is Jul 23. Any emergency hotfix deployed before Jul 23 will **reuse the same cache key** — the SW install step sees a name it already knows, skips activation, and PWA users stay on stale code. This is a silent deployment freeze window until Wednesday.

**Fix:** Bump the cache key to today's date (or use a build hash) before any hotfix push.

---

### 2. Rebrand "Remove Givelink from Task OS" is incomplete — new Arete users get Givelink seed tasks
**`index.html:2503, 4375, 4546–4800`** — commit `d635c06` ("Remove Givelink from Task OS (fully separate the two products)")

The commit removed the Givelink dashboard link but left behind:
- `CATS` object still defines `givelink` as a task category (`index.html:2503`)
- `renderView()` dispatcher still routes `givelink-dash` to `renderGivelinkDash` (`index.html:2984`)
- Focus planner hardcodes `'🟣 Givelink Outreach'` as a time block for all users (`index.html:4375`)
- `seed()` function seeds new users with 20+ Givelink-specific tasks (nonprofit board, CRM, investor pipeline) (`index.html:4546–4800`)
- `sw.js` still precaches `givelink.html` and `manifest-givelink.json` — the old app is still being served to PWA users (`sw.js:4,16`)
- 113 occurrences of `givelink` remain in `index.html`

**Why this matters:** Every new Arete account starts with "Nonprofits Board Follow Ups", "Greek Nonprofits Board (Make-A-Wish etc)", "MEDDPICC sales framework → integrate into sales training" in their task list. This is the founder's personal task data seeded to new users.

---

### 3. Guest-to-signup: guest flag removed before sync completes — silent data loss path
**`index.html:10128–10131`** — commit `0e19b15`

```js
async function _afterAuth(){
  const wasGuest = localStorage.getItem('taskos_guest') === '1';
  if(wasGuest){ localStorage.removeItem('taskos_guest'); ... }  // flag removed first
  try{ await sbSyncNow(true); }catch(e){}  // silent catch — if this throws, data wasn't pushed
```

If `sbSyncNow` fails (network error, auth token not ready, Supabase timeout), the exception is silently swallowed. The guest flag is already gone. On the next page load, `_isGuest()` returns false, the app authenticates normally, pulls a blank cloud state, finds no remote data (`remote === null`), and enters the welcome-seed path — **potentially overwriting the user's guest tasks with a generic starter set** if `S.tasks.length === 0` at that moment.

The practical window is small (local data is still in localStorage), but the re-authentication path (`sbConnect` token refresh → `_afterAuth`) could rerun and race with the welcome seeder.

---

## 🧹 Cleanup opportunities

### 4. Logout localStorage clear is silently swallowed
**`index.html:10120`** — commit `f89aed3`

```js
try{['taskos','taskos_name','taskos_guest','taskos_guest_nudged'].forEach(k=>localStorage.removeItem(k));}catch(e){}
```

A failed clear (private browsing storage limits, SecurityError) leaves `taskos_guest='1'` in storage. Next visit, `_isGuest()` returns true, auth gate is hidden, user browses as "still a guest" even though they're signed in. Should at minimum `console.warn` on failure.

---

### 5. Guest nudge is silently swallowed — potential conversion loss
**`index.html:2587`** — commit `0e19b15`

```js
if(localStorage.getItem('taskos_guest')==='1'&&...){try{_maybeGuestNudge();}catch(e){}}
```

`_maybeGuestNudge` sets `taskos_guest_nudged='1'` first, then fires a toast. If the toast call throws (DOM not ready), the nudge is marked as seen but never shown. Users who would have converted see nothing and never get a second chance.

---

### 6. `sbSyncNow` in `_afterAuth` is completely silent on failure
**`index.html:10131`** — commit `0e19b15`

```js
try{await sbSyncNow(true);}catch(e){}
```

`sbSyncNow` is called with `force=true`, which normally toasts "Connect cloud sync first" if sync isn't available. Wrapping in a bare `catch` means any failure (expired token, network, Supabase down) gives the user zero feedback during the most critical moment — their first login.

---

### 7. `86400000` magic number used ~15 times inline
**`index.html:2928, 3258, 3918, 3924, 5040, 5668, 6004, 6511, 6620...`** — multiple commits

`86400000` (milliseconds per day) appears roughly 15 times as an inline literal. A single off-by-one in one copy is invisible. Extracting `const MS_PER_DAY = 86400000` at the top of the data section would catch transposition errors and make intent clear.

---

### 8. `_drawStatsCard` canvas function has no internal error guard
**`index.html:fb63461` (shareable progress card)** — commit `fb63461`

The caller wraps it in `try/catch`, but the ~80-line canvas drawing function itself calls `ctx.measureText`, `ctx.fillText`, and `ctx.drawImage` with values derived from live app state — if `S.habits`, `S.tasks`, or `S.wins` are in an unexpected shape, the canvas draw silently produces a blank card and the user downloads a white image. No guard at the data extraction layer.

---

## 🤔 Worth a second look

### 9. Cloud sync is last-write-wins with no conflict detection
**`index.html:10409`** — sync architecture

```js
const r = await fetch(`${_SB.url}/rest/v1/app_state`, {
  headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
  ...
});
```

The sync strategy compares `remote.ms > localMs` to decide direction (`sbSyncNow:10412`). On two active devices with sub-second time drift, the device that wins the timestamp race silently overwrites the other's changes. No merge, no conflict UI. This is safe for a single-device user but becomes a data loss vector as guest-to-multi-device conversion grows.

---

### 10. No test commits across 12 feature-heavy PRs this week
All 12 commits shipped: guest mode, onboarding tour, referral links, templates gallery, template import, shareable progress card, accountability invites, social share previews, rebrand, landing page redesign, update banner, logout fix.

Zero test commits. The core task data model (`S`), sync path, and guest conversion flow have no visible automated coverage. Manual "verified" notes in commit messages are the only QA signal.

---

### 11. Template `_applyTemplate` doesn't check for duplicate application
**`index.html:10283`** — commit `f883adf`

Arriving via a `?template=<id>` link calls `_applyPendingTemplate()` which calls `_applyTemplate(id, true)`. There's no idempotency guard — if the URL is shared and a user visits it twice (or presses back/forward), the template tasks are seeded twice. For the "Get Fit" template with 8 tasks, a double-visit creates 16 duplicate tasks.

---

*Report generated 2026-07-20. Covers commits f89aed3–59abf2d (Jul 13–Jul 20).*
