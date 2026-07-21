# Weekly Triage — 2026-07-21

## 📊 Week at a glance
- Commits: 12 | Files changed: 15 | Debt markers added: 0 explicit (see below)
- High-churn files: `index.html` (11 commits), `sw.js` (10 commits), `manifest.json` (2 commits)

---

## 🚨 Needs immediate attention

### 1. Broken push notification icon path — ships to users right now
- `sw.js:38` — `icon: './icons/icon-192.png'` (no `icons/` subdirectory exists)
- Introduced in: `0c1d32d` (Rebrand to Arete)
- **Why this matters:** Every push notification sent by the app shows a broken image. Silent failure — no error log, just bad UX.

### 2. "Panos" is the default user name for ALL new signups
- `index.html:2519` — `let profileName=localStorage.getItem('taskos_name')||'Panos';`
- `index.html:1070` — `<h1 id="greeting">Good morning, Panos 👋</h1>`
- Introduced in: predates this week but survives the Arete rebrand (`0c1d32d`) despite the comment at `10458`: `"Personalize the greeting from the sign-in email (so it's never 'Panos')"` — the JS override only fires after login, not for the static DOM default.
- **Why this matters:** First thing a new user sees after onboarding is someone else's name. Instant trust-killer.

### 3. Logout silently leaves auth tokens in localStorage
- `index.html:10120` — only 4 keys cleared; `taskos_sb_access`, `taskos_sb_refresh`, `taskos_sb_uid`, `taskos_sb_email` remain.
- Introduced in: `f89aed3` (Make logout clean and safe for re-login)
- **Why this matters:** On shared/public devices, next visitor can extract the bearer token and use the previous session's Supabase access.

### 4. `aiProxy` is blank in production config — AI features silently require manual key entry
- `index.html:9959` — `aiProxy: ''`
- Survives entire week's churn untouched
- **Why this matters:** New users hit "Add Claude API key in Settings first" toast on every AI feature with no path forward. Conversion blocker.

### 5. AI proxy has no rate limiting — bill exposure on open proxy
- `api/claude.js:12` — comment: `"add per-user rate limiting (e.g. Upstash)"`
- Present since the file was added; `api/claude.js` was unchanged this week
- **Why this matters:** Any signed-in user can hammer AI endpoints. A single user running AI triage in a loop could cost $50+ before anyone notices.

---

## 🧹 Cleanup opportunities

### 6. 210 hardcoded "Panos" references across AI prompt strings
- Scattered across `index.html`: lines 5647, 7849, 8604, 9806, 11415, 11416, 11516, 11524, 11672, 11734, 11810, 12186, 13111, 13198, 13289, 13293
- Introduced gradually; not addressed in rebrand commits `#80` or `#81`
- **Why this matters:** Every AI feature (morning briefing, book highlights, mentor finder, manifesto drafter, anti-goals, relationship nudge) addresses the user as "Panos" and tailors output to his specific life context. Wrong for every other user.

### 7. `//` comment left in logout function as rationale for `nav('dashboard')`
- `index.html:10132` — `// always land on Today after login, not a stale last view`
- Introduced in `28dc1b8` — rationale comment belongs in the commit message, not the code
- **Why this matters:** Low priority but adds noise to a security-sensitive function

### 8. Morning reminder default message hardcoded to "Panos"
- `index.html:11254` — `'Good morning Panos! Check your One Thing and start focused work.'`
- Present since reminders were added; not caught in rebrand
- **Why this matters:** Any user who enables reminders without editing the default message gets notifications addressed to someone else

### 9. Service worker CACHE key hardcoded date `'arete-20260723'`
- `sw.js:1` — requires manual bump on every deploy
- Introduced in `0c1d32d` (Rebrand to Arete)
- **Why this matters:** Forgetting to bump means clients serve stale HTML/JS indefinitely with no indication anything is wrong

### 10. `getAboutMe()` fallbacks still reference Givelink/SF/founder context
- `index.html:7849`, `9806`, `12186`, `13289` — `|| 'Panos — Greek founder in his 20s building Givelink...'`
- Some fallbacks were cleaned up (lines with `'A focused individual...'` fallback) but ~4 remain with personal context
- **Why this matters:** Inconsistent fallback quality — some features work generically, others are still personal-specific

---

## 🤔 Worth a second look

### 11. `_afterAuth` tries `sbSyncNow(true)` then silently swallows the error
- `index.html:10131` — `try{await sbSyncNow(true);}catch(e){}`
- Introduced in `f89aed3`
- **Why it looks suspicious:** If sync fails at login (race, token issue, Supabase down), the user silently gets local-only state with no indication. Could cause data loss perception.

### 12. XSS in weekly review wizard — `t.title` and `g.title` unescaped in innerHTML
- `index.html:3594`, `3601`, `3603`
- Not changed this week but these paths were touched in `f883adf` (PLG Tier 1: templates gallery)
- **Why it looks suspicious:** If templates can import arbitrary task titles (they can — line 5000 seeding), a crafted template could inject HTML into the weekly review render path

### 13. `_justWelcomed` global window flag controlling onboarding tour
- `index.html:10136` — `if(window._justWelcomed&&!localStorage.getItem('taskos_onboarded'))`
- Introduced in `7c260f5` (Add first-run onboarding tour)
- **Why it looks suspicious:** Global window flags are fragile — if the page reloads between setting and checking the flag (e.g. OAuth redirect), the tour never fires for truly new accounts. Should use a persisted signal instead.

### 14. Guest mode nudge relies on `taskos_guest_nudged` key that is never set in some code paths
- `index.html:2587` — `if(localStorage.getItem('taskos_guest')==='1'&&!localStorage.getItem('taskos_guest_nudged'))`
- The `try{_maybeGuestNudge();}catch(e){}` wrapper swallows any error silently
- **Why it looks suspicious:** If `_maybeGuestNudge` throws before writing `taskos_guest_nudged`, the nudge fires on every page load for that guest. Can't confirm without seeing `_maybeGuestNudge`'s write logic.
