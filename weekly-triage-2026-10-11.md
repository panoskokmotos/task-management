# Weekly Triage — 2026-10-11

## 📊 Week at a glance
- Commits this week: **0** (last commit was `160f0d8` on Oct 6)
- Files changed: 0
- Debt markers added this week: 0 (nothing changed)
- High-churn files (last 30 days): `index.html` (changed in both recent PRs #84 and the rebase)

_No commits landed in the last 7 days. The triage below covers the standing codebase state from the two most recent PRs (#84, #85) that are still fresh and worth reviewing._

---

## 🚨 Needs immediate attention

### 1. `aiProxy` left blank — AI features broken in production
**File**: `index.html:9959`  
**Commit**: `72e03fe` (PR #84 "Givelink bug fixes")  
**Why this matters**: `APP_CONFIG.aiProxy` is `''`. Every AI call silently fails for users who haven't added their own Claude key. The proxy endpoint (`/api/claude`) exists and is deployed — this is a one-liner fix that unlocks the core product.

---

### 2. Google Fonts missing from CSP — Inter never loads in production
**File**: `vercel.json:12-13` (added/modified in PR #83)  
**Commit**: `b38d4bb`  
**Why this matters**: `style-src` and `font-src` don't include `fonts.googleapis.com` / `fonts.gstatic.com`. Chromium enforces CSP strictly; the app renders in fallback fonts for all non-cached visitors.

---

### 3. `--faint` CSS variable used in 5 places but never declared
**File**: `index.html:44-59` (`:root` block, unchanged)  
**Commit**: pre-existing, not caught in recent rebrand cleanup (`0c1d32d`, `72d9c68`)  
**Why this matters**: Goal-group task counts, the capture hint text, and goal-linked task previews are invisible (transparent). This was likely introduced during the rebrand that purged the old palette variables but missed `--faint`.

---

### 4. Unescaped `t.title` / `g.title` in Weekly Review wizard HTML
**File**: `index.html:3594`, `3601`, `3603`  
**Commit**: pre-existing in review wizard code  
**Why this matters**: Three `body.innerHTML=` branches in `renderWizPanel` inject user task and goal titles without `esc()`. The function `esc()` exists (line 11776) and is used correctly everywhere else. This is a stored-XSS risk on the Weekly Review path.

---

### 5. Supabase keep-alive workflow runs every 3 days but the free tier pauses after 7 days inactive
**File**: `.github/workflows/supabase-keepalive.yml`  
**Commit**: `160f0d8` (PR #85, this week)  
**Why this matters**: The workflow comment says "prevent auto-pause" but Supabase's free tier pauses after 7 days of inactivity, not 3. Verify the cron interval is `0 0 */3 * *` (every 3 days) and the ping actually counts as "activity" (a `SELECT 1` via the REST API does, but a GitHub action hitting the health endpoint might not). If the workflow fails silently, the database pauses and all syncs break.

---

## 🧹 Cleanup opportunities

### 6. `profileName` defaults to `'Panos'` for all new users
**File**: `index.html:2519`  
**Commit**: pre-existing (not addressed in rebrands #80, #81)  
**Why this matters**: Every new user who hasn't set a name is greeted as "Panos" in the morning briefing. Introduced when the app was personal; should have been removed in the Arete rebrand.

---

### 7. `_maybeGuestNudge` embeds HTML inside a `toast()` call
**File**: `index.html:2594`  
**Commit**: `0e19b15` (PR #77 "guest mode") — 4 PRs ago, never cleaned up  
**Why this matters**: The guest-to-signup conversion toast relies on `<span onclick="openAuthGate()">` being rendered as HTML by `toast()`. If the toast implementation ever switches to `textContent` (safer), the CTA disappears and conversion drops to zero.

---

### 8. Hardcoded preview Vercel URL in three OG meta tags and `_APP_URL`
**File**: `index.html:24`, `25`, `32`, `10180`  
**Commit**: unchanged through multiple rebrands  
**Why this matters**: `task-management-beige-eight.vercel.app` is the old preview URL. All social shares and PWA install banners point there. This should have been updated in PR #82 ("Elevate the landing page").

---

### 9. `api/claude.js` has no CORS headers and no OPTIONS handler
**File**: `api/claude.js:15`  
**Commit**: initial setup, never updated  
**Why this matters**: Blocks any self-hosted or `localhost` development setup. Anyone following the README's setup instructions who tries to point a local index.html at a deployed API will get CORS errors with no error message explaining why.

---

### 10. `S.claudeKey` stored inside the main synced state blob and included in exports
**File**: `index.html:2517`  
**Commit**: original design, predates cloud sync  
**Why this matters**: `exportData()` dumps the entire `S` object to JSON. Anyone who exports their tasks for backup or shares a debug snapshot is unknowingly including their Anthropic API key.

---

## 🤔 Worth a second look

### 11. `sbSyncNow` last-write-wins on entire state blob
**File**: `index.html:10418-10425`  
**Commit**: cloud sync implementation  
**Why this matters**: If a user creates tasks on mobile (saves at T=1), then opens desktop (which has a sync from T=0.9), the desktop syncs its slightly-older version upstream and overwrites the mobile tasks. Probably intentional for simplicity, but worth documenting clearly.

### 12. Supabase keep-alive ping — what endpoint does it call?
**File**: `.github/workflows/supabase-keepalive.yml`  
**Commit**: `160f0d8`  
**Why this matters**: If the workflow pings the Supabase health/status endpoint rather than making an authenticated query, it may not count as project activity for the auto-pause timer. Verify with Supabase docs.

### 13. `_maybeShowWeeklyWrapped` called at boot without date guard visible in this context
**File**: `index.html:10663`  
**Commit**: pre-existing  
**Why this matters**: If the weekly wrapped modal fires every time someone reopens the app on Monday, that's disruptive. The guard is probably inside the function but worth confirming there's a "shown this week" check.
