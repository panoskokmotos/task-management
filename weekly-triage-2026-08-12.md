# Weekly Triage — 2026-08-12

## 📊 Week at a glance
- Commits this week: **0** (last commit was 2026-07-22 — `b38d4bb`)
- Files changed: n/a
- Debt markers added this week: n/a (no new commits since July 22)
- High-churn files: n/a

> The repo has been quiet for 3 weeks. The triage below is drawn from a static analysis of the current `main` branch HEAD.

---

## 🚨 Needs immediate attention

### 1. Push notification icon path is wrong — all reminders ship without icons
- **File**: `sw.js:47-48`
- **Commit**: `0c1d32d` (Rebrand to Arete)
- **Why this matters**: `./icons/icon-192.png` 404s every time. No `icons/` directory exists. Notification icon and badge are invisible on all platforms. This silently breaks the reminder and ntfy integrations.

### 2. CSP blocks Google Fonts — Inter never loads in production
- **File**: `vercel.json:15` (CSP header)
- **Commit**: `0c1d32d` (same rebrand commit that set up the security headers)
- **Why this matters**: `style-src 'self' 'unsafe-inline'` and `font-src 'self'` don't whitelist `fonts.googleapis.com` / `fonts.gstatic.com`. Every user sees the fallback system font, not Inter — every marketing screenshot is misleading.

### 3. AI features blocked for all new users — proxy URL is empty
- **File**: `index.html:9959`
- **Commit**: `0c1d32d`
- **Why this matters**: `aiProxy: ''` means every AI button fires a "please add your Claude API key" toast. The landing page headline is "AI that clears your inbox and plans your day" — users who click "Try free" discover the AI doesn't work. This is the #1 conversion blocker.

### 4. `aiAutoTriage` and `aiPlanDay` miss `try/finally` on `_aiUnlock`
- **File**: `index.html:5048-5060` and `5126-5136`
- **Commit**: `0c1d32d` (AI features were there before; inconsistency introduced vs newer functions)
- **Why this matters**: If the internal fetch is interrupted mid-stream, the AI lock key stays set and the button is permanently dead for the session. Newer functions (`aiSequenceTasks`, `aiRelNudge`, etc.) already use `try/finally` correctly.

### 5. New users greeted as "Panos" — first impression is broken
- **File**: `index.html:2519` + `11254`
- **Commit**: `0c1d32d`
- **Why this matters**: `profileName` defaults to `'Panos'`. New users (including all referral traffic) hit a dashboard addressed to the developer. Morning reminder also fires with "Good morning Panos!" regardless of who enabled it.

---

## 🧹 Cleanup opportunities

### 6. `taskos-` prefix on all file downloads
- **File**: `index.html:2602, 2628, 2652, 2668, 2675, 10243, 10247`
- **Commit**: `0c1d32d` (rebrand changed app name to Arete but missed export filenames)
- **Why this matters**: Users download `taskos-backup-2026-08-12.json` — old brand visible on every export.

### 7. `givelink.html` and `manifest-givelink.json` still in SW cache list
- **File**: `sw.js:4, 16` · `vercel.json:4`
- **Commit**: `d635c06` (commit #73 removed Givelink from Task OS but left SW artifacts)
- **Why this matters**: Every SW install caches two files nobody navigates to. Cache slot wasted; /givelink route still exists in vercel.json.

### 8. ntfy example topic says `taskos-panos-2026`
- **File**: `index.html:11385`
- **Commit**: `0c1d32d`
- **Why this matters**: Users copy example strings verbatim. Recommending the old brand + personal name is a small but visible sloppiness.

### 9. Share progress card renders "Task OS" not "Arete"
- **File**: `index.html:10214-10215`
- **Commit**: `0c1d32d`
- **Why this matters**: Canvas `fillText('Task' … 'OS')` — every progress card shared to social promotes the old brand name.

### 10. `_APP_URL` and all OG/canonical tags point to dev Vercel URL
- **File**: `index.html:24-32, 10180, 10232` · `landing.html:11-21`
- **Commit**: `b38d4bb` (last commit; landing SEO work didn't update canonical to a real domain)
- **Why this matters**: No custom domain is registered. All share links, referral URLs, and SEO canonicals point at `task-management-beige-eight.vercel.app`. Every social share undercuts trust.

---

## 🤔 Worth a second look

### 11. `CATS` still includes `givelink` as a public category
- **File**: `index.html:2503`
- **Commit**: `d635c06` (Givelink separation) — this CATS entry was not removed
- **Why this matters**: Every user's task form shows "Givelink 🟣" as a category option. Looks like a bug to anyone who isn't the founder. `renderGivelinkDash` is also in the public nav map.

### 12. ~12 AI prompts fall back to hardcoded personal context
- **File**: `index.html:5647, 5920, 7319, 7477, 7849, 9806, 11415, 11524, 11672, 12945` (and more)
- **Commit**: `0c1d32d` (prompts were personal from the start; never parameterized)
- **Why this matters**: New users with no About Me get AI responses about "Panos — Greek founder building Givelink." Plausible that some users have noticed this.

### 13. `PostHog` key is blank — `track()` calls are no-ops everywhere
- **File**: `index.html:9960`
- **Commit**: `b38d4bb` (landing analytics commit — app analytics still not wired)
- **Why this matters**: No data on AI usage, guest→signup conversion, or which views users visit. The landing has PostHog event tracking written but the key is also blank there.

### 14. Seeded data contains 40+ personal tasks (Givelink, Dex CRM, etc.)
- **File**: `index.html:4546-4905`
- **Commit**: predates current history window — personal from inception
- **Why this matters**: Self-hosting users or anyone who turns off `_hostedMode()` gets an inbox full of the founder's private plans. Low risk for hosted users (gated), but embarrassing if screenshotted.

---

_30-item cap: 14 findings shown. All P0/P1 items from the IMPROVEMENT_PLAN.md are represented. No new commits this week means no new debt was introduced, but all existing issues remain unaddressed._
