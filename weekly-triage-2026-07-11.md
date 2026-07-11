# Weekly Triage — 2026-07-11

## 📊 Week at a glance
- **Commits:** 16 | **Files changed:** 6 distinct files | **Debt markers added this week:** 0 new TODOs/FIXMEs; 1 explicit production caveat already in the code (`api/claude.js:12-13`)
- **High-churn files:**
  1. `index.html` — touched in **all 16 commits** (extreme churn, every feature)
  2. `sw.js` — bumped in 3 commits (cache-busting on each deploy)
  3. `vercel.json` — touched in 2 commits (CSP updates for cloud sync and auth)

**Theme of the week:** hosted multi-user launch (commits #55–#70). The app went from a single-user personal tool to a publicly-deployed PWA with Supabase auth and cloud sync. A lot of ground covered fast; residue below.

---

## 🚨 Needs immediate attention

### 1. `authLogout()` keeps user data on device after sign-out
**File:** `index.html:9966-9970` | **Commit:** `2fa1c76` (account chip, #70)  
The new Sign Out button in the account chip runs `authLogout()`, which only removes 4 session token keys. The `taskos` localStorage key — containing all tasks, habits, goals, health logs, and the Claude API key — is left intact. On any shared device (family computer, borrowed phone), the next person who visits the URL loads the previous user's complete life data.  
**Why this matters:** Privacy failure for a multi-user hosted app. Could also cause data cross-contamination if a second person signs up on the same device.

---

### 2. `profileName` defaults to `'Panos'` for all new users — race condition with account chip
**File:** `index.html:2406` | **Commit:** `e0b0a00` (#68) introduced hosted mode; `2fa1c76` (#70) added the chip but did not fix the default  
`let profileName = localStorage.getItem('taskos_name') || 'Panos';` — this line runs before auth. In hosted mode, `_welcomeSeed()` (commit #69) correctly derives a name from the email, but only after the first cloud sync. Between page load and sync completion, any code reading `profileName` gets 'Panos'. The greeting, page title (`<title>Task OS — Panos</title>`), and all AI prompts that use `profileName` as context will show the wrong name.  
**Why this matters:** Every new user sees "Good morning, Panos" until JS patches it. The page title leaks into browser history and bookmarks as "Task OS — Panos".

---

### 3. 15+ AI prompts use `'Panos — Greek founder building Givelink...'` as the hardcoded fallback
**Files:** `index.html:5300, 5310, 5506-5507, 5777, 5780, 7005, 7179, 7337, 7421, 7709-7710, 8464, 9659-9660` | **Commit:** introduced across the feature history; not fixed in #69 which only fixed task seeding  
`getAboutMe()` returns an empty string for new users who haven't filled out Settings → About me. Every AI feature then falls back to a hardcoded string describing the owner. New users get coaching, social audits, and decision suggestions written specifically for a Greek startup founder in his 20s building a nonprofit SaaS in San Francisco.  
**Why this matters:** First-use AI responses are completely off-brand and confusing for any user who is not Panos. This is the most visible regression from the multi-user launch.

---

### 4. Rate limiting is absent from `/api/claude.js` — the proxy is not yet live, but this is the blocker
**File:** `api/claude.js:12-13` | **Commit:** `e0b0a00` (#68) deployed the proxy file  
`aiProxy` in `APP_CONFIG` is still `''`, so no users can currently hit the unprotected endpoint. But the file is deployed on Vercel. The moment `aiProxy` is set, there is no per-user rate cap. The code comment says _"For production add per-user rate limiting (e.g. Upstash)"_ and it hasn't been done.  
**Why this matters:** Enabling AI for hosted users (the correct next step) and leaving this unfixed means a single user could make thousands of calls before being noticed.

---

### 5. `_autoSnapshot()` has a bare `catch(e){}` — Pace Engine trend data silently fails
**File:** `index.html:10117-10131` | **Commit:** `e0b0a00` (#68)  
The entire auto-snapshot logic is wrapped in a try/catch that swallows all errors with no logging. `givelinkHistory` is the data source for the Givelink Pace Engine trend charts. If this fails (e.g., due to a quota error or state shape change), the charts appear to have no history with no indication of why.  
**Why this matters:** Silent failure in a charting data-collection routine makes debugging extremely hard and will look like a feature bug.

---

## 🧹 Cleanup opportunities

### 6. `<title>Task OS — Panos</title>` and `<h1>Good morning, Panos 👋</h1>` in HTML
**File:** `index.html:17, 951` | **Commit:** present since before this week, not addressed during the hosted launch  
These are the initial HTML values before JavaScript runs. Even though JS updates them on auth, the initial paint shows 'Panos' to all users, and browser history/bookmarks will capture the pre-JS title.  
**Fix:** Change to `<title>Task OS</title>` and `<h1>Good morning 👋</h1>`.

---

### 7. Hardcoded "Panos Evangelou" in `givelink.html` AI prompts
**File:** `givelink.html:1492, 1637`  
The Daily Standup Generator writes "Generate a daily standup for Panos, founder of Givelink" and the Outreach Email Generator writes emails "from Panos Evangelou, co-founder of Givelink". Any other user of the Givelink OS gets standups and outreach emails authored as Panos.  
**Fix:** Read sender name from `localStorage.getItem('taskos_name')` or a new Givelink Settings field.

---

### 8. `exportData()` / `exportFullJSON()` include `S.claudeKey` in the export
**File:** `index.html:2476-2482, 2549-2554`  
The entire `S` state object is serialised to JSON, including any Claude API key the user pasted into Settings. Users who share backups inadvertently share their Anthropic key.  
**Fix:** Strip sensitive fields from the export payload before serialising.

---

### 9. `window.prompt()` in `givelink.html` CRM — broken or blocked on iOS
**File:** `givelink.html:1431`  
`logActivityNP()` uses the browser's native `window.prompt()`. On iOS Safari this is often suppressed for PWAs running in standalone mode.  
**Fix:** Replace with the existing `showPrompt()` pattern from `index.html`.

---

### 10. `document.execCommand('copy')` used as clipboard fallback — deprecated API
**File:** `givelink.html:1521, 1622`  
Both copy-to-clipboard paths have a deprecated `execCommand` fallback that does nothing in modern browsers. The failure is silent.  
**Fix:** Remove the fallback; show a toast instead.

---

## 🤔 Worth a second look

### 11. Sync debounce (2.5s) with no `beforeunload` guard
**File:** `index.html:10104-10113`  
Changes are batched and synced 2.5s after the last edit. There is no `beforeunload` listener. A user who captures a task and immediately closes the tab loses that change.  
**Likely intentional?** The debounce is a reasonable UX choice; the missing `beforeunload` guard looks like an oversight. Low frequency of occurrence, high frustration when it happens.

---

### 12. `sbConnect()` old self-service form still exists alongside hosted auth
**File:** `index.html:9881-9904`  
The settings panel still contains a "Connect Supabase" form with URL/anon-key/email/password fields. In hosted mode (the current setup), `APP_CONFIG.supabaseUrl` is set, so this form is redundant and confusing — a user filling it in would be trying to connect to a *different* Supabase project.  
**Likely intentional?** It exists for power users who want to self-host. Consider hiding it when `_hostedMode()` is true.

---

### 13. `seed()` and `seedGoals()` still exist and run for non-hosted mode
**File:** `index.html:4387+` | **Commit:** #69 gated them on `!APP_CONFIG.supabaseUrl`  
For local/self-hosted builds where `APP_CONFIG.supabaseUrl` is empty, seed data still populates with owner-specific tasks (Tim Ferriss references, "Unsubscribe from panagiotis email?", Givelink-specific items). This is a personal app, so this may be intentional, but if a third party self-hosts, they get the owner's personal starter data.  
**Likely intentional** for now; flag if the project ever open-sources publicly.

---

### 14. XSS: checklist item `text` injected via `innerHTML` without escaping
**File:** `index.html:~2416` (checklist editor, `_renderChecklistEditor`)  
Task checklist items are rendered directly into `innerHTML`. A malicious item containing `<img src=x onerror=...>` executes on every open of that task. In the hosted multi-user setup this is a stored XSS risk — one user could craft a task payload that runs script in the victim's browser.  
**Fix:** Wrap `c.text` with `esc()` (the existing helper) before inserting into the template string.

---

### 15. Task edit silently corrupts state when the task was deleted mid-edit
**File:** `index.html:3704`  
`S.tasks.findIndex(t => t.id === editT)` returns `-1` if the task was deleted while the modal was open. `S.tasks[-1] = {...}` assigns a named property on the array — it persists in `JSON.stringify` but is invisible to `forEach`/`filter`. Over time, ghost entries accumulate in the serialised state.  
**Fix:** Guard with `if (i < 0) { toast('Task was deleted'); return; }`.

---

_Total: 15 items. Priority order: fix items 1, 2, and 3 first (logout/data leak, profileName, hardcoded AI context) — they're the most visible regressions from the multi-user launch this week. Items 14 and 15 are security-class bugs worth fixing before more users sign up._
