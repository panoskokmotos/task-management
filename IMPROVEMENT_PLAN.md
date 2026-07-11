# Task OS / Givelink — Improvement Plan

_Scan date: 2026-07-11 | Files reviewed: `index.html` (14 401 lines), `givelink.html` (1 755 lines), `api/claude.js` (49 lines)_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `authLogout()` does not clear user data from the device
**What:** Signing out only removes the four session-token keys; the entire `taskos` localStorage key (all tasks, habits, goals, health data, and the Claude API key) stays on the device.  
**Where:** `index.html:9966-9970`  
**Why it matters:** On a shared Mac, a friend who borrows the browser sees the previous user's complete life OS. This is a privacy failure and will erode trust the moment it is discovered.  
**Effort:** S  
**Suggested fix:**
- After removing session tokens, run `localStorage.removeItem('taskos')` and `S = {...DEFAULT_STATE}` (or just reload) in hosted mode.
- Keep local data if the user explicitly chooses "Keep my data on this device" (add a confirm dialog before wiping).
- Re-run `_showAuthGate()` after the wipe so the next user sees the login screen, not a blank app.

---

### 2. `exportData()` leaks the Claude API key inside the backup JSON
**What:** Every export function (`exportData`, `exportFullJSON`) serialises the entire `S` state object, which includes `S.claudeKey`, `S.readwiseKey` (token stored in `S`), and any other sensitive string the user has pasted into Settings.  
**Where:** `index.html:2476-2482`, `index.html:2549-2554`  
**Why it matters:** Users share backup files with partners or store them in Dropbox. The API key gets exposed and can rack up Anthropic charges.  
**Effort:** S  
**Suggested fix:**
- Create a `_safeCopy(s)` helper that clones `S` and `delete`s `claudeKey`, `readwiseKey`, `notionKey`, `notionPage`, and `_sbApplying`.
- Use `_safeCopy(S)` in all export functions. The import flow is unaffected.

---

### 3. AI features are silently dead for all hosted users (`aiProxy` is empty)
**What:** `APP_CONFIG.aiProxy` is an empty string, so every hosted user hits the "Add your Claude API key in Settings" toast on the first AI action. There is no onboarding path that explains this or offers an easy fix.  
**Where:** `index.html:9812`; all AI entry points gate on `!S.claudeKey && !APP_CONFIG.aiProxy`  
**Why it matters:** "Plan My Day", "AI Auto-Triage", and "AI Sequence" are core differentiators. They are currently inaccessible to every new signup, which is the single biggest gap between the landing page promise and actual experience.  
**Effort:** S  
**Suggested fix:**
- Deploy `/api/claude.js` to Vercel with `ANTHROPIC_API_KEY` set, then paste the resulting URL as `aiProxy`.
- Add item 4 (rate limiting) first, or you'll face runaway costs within days of enabling this.
- Once `aiProxy` is set, remove the Settings → Claude Key section from the hosted UI to reduce confusion.

---

### 4. Zero rate limiting on `/api/claude.js` — one user can drain the Anthropic bill
**What:** The serverless Claude proxy has no per-user call cap. The code itself contains the comment: _"For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."_  
**Where:** `api/claude.js:12-13`  
**Why it matters:** Once `aiProxy` is live, any authenticated user can loop-call the endpoint thousands of times. At Haiku pricing this is cheap per call, but at scale (or with a determined user) the bill becomes unbounded.  
**Effort:** M  
**Suggested fix:**
- Add [Upstash Redis](https://upstash.com) rate limiting: 10 requests per user per minute, using `_SB.uid` as the key.
- Return HTTP 429 with `Retry-After: 60` so the client can show the right toast (already handled at `index.html:4884`).
- Gate the hard limit at 100 calls/day per user to cap monthly exposure.

---

---

### 5. XSS: checklist items are injected raw via `innerHTML` — stored XSS
**What:** The checklist editor renders each item's `.text` directly into `innerHTML` with no escaping. A checklist item containing `<img src=x onerror=alert(1)>` executes on render.  
**Where:** `index.html:~2416` (checklist editor section, `_renderChecklistEditor`)  
**Why it matters:** This is a stored XSS vulnerability. The payload is persisted in `S.tasks` and re-executes every time the task is opened. In the hosted, multi-user version this is especially serious.  
**Effort:** S  
**Suggested fix:**
- Use `esc()` (the app's existing HTML-escape helper) on `c.text` before inserting into the template string.
- Audit all other places where task fields (`title`, `notes`, `goalId` labels) are placed inside `innerHTML` rather than `textContent`.

---

### 6. Deleted-task edit silently corrupts the `S.tasks` array
**What:** In the task save handler, `S.tasks.findIndex(t => t.id === editT)` can return `-1` if the task was deleted while the edit modal was open. The code then sets `S.tasks[-1] = {...}`, which creates a named property (not an array element) that persists in `JSON.stringify` but is invisible to `forEach`/`filter`.  
**Where:** `index.html:3704`  
**Why it matters:** Over time, ghost task objects accumulate in the serialised JSON. The size grows, sync gets slower, and restore-from-backup may fail validation.  
**Effort:** S  
**Suggested fix:**
- Guard: `const i = S.tasks.findIndex(t => t.id === editT); if (i < 0) { toast('Task was deleted — cannot save'); return; }`

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. 15+ AI prompts hardcode "Panos" as the fallback context — every new user gets someone else's AI persona
**What:** Every AI feature that offers contextualised advice (Relationships, Discomfort Coach, Social Brand, Week Plan Wizard, Know Thyself, Decisions AI, etc.) uses a hardcoded fallback string: `'Panos — Greek founder building Givelink (nonprofit fundraising SaaS), targeting financial freedom and a move to San Francisco.'`. A new user who has not filled out their "About me" gets coaching written for the owner.  
**Where:** `index.html:5300, 5310, 5506-5507, 5777, 5780, 7005, 7179, 7337, 7421, 7709-7710, 8464, 9659-9660`  
**Why it matters:** Every AI response sounds bizarrely personal and off-brand for the new user. This will immediately break trust ("why is this app talking about Givelink and San Francisco?").  
**Effort:** S  
**Suggested fix:**
- Replace every hardcoded fallback string with a single constant: `const _ABOUT_FALLBACK = 'the user (a motivated individual working toward personal and professional goals)';`
- Better: prompt the user to fill "About me" on first AI action if `getAboutMe()` is empty. A one-field modal (2 sentences about you) dramatically improves AI quality.
- Keep a private `seed()` path for the owner's own local install, gated on `!_hostedMode()`.

---

### 6. Page title and initial greeting hardcode "Panos" — new users see the wrong name on load
**What:** `<title>Task OS — Panos</title>` and `<h1>Good morning, Panos 👋</h1>` are baked into the HTML. The JS updates them after auth, but there is a visible flash of the wrong name on every page load. The `profileName` JS variable also defaults to `'Panos'` (line 2406), so until `_welcomeSeed()` or `_renderAccountChip()` runs, `profileName` is 'Panos' throughout the session.  
**Where:** `index.html:17, 951, 2406`  
**Why it matters:** The very first thing a new user sees is someone else's name. This creates immediate cognitive dissonance.  
**Effort:** S  
**Suggested fix:**
- Change the `<title>` to `Task OS` and the `<h1>` text to `Good morning 👋`.
- Change the `profileName` default to `''` and update all greeting renders to use `profileName || 'there'` as the fallback.
- The JS-side greeting is already updated on auth (line 10011); these are just the initial HTML values.

---

### 7. No `beforeunload` guard — edits made just before tab close may not sync
**What:** `_sbScheduleSync()` debounces sync by 2500ms. If the user makes a change and closes the tab within 2.5 seconds, `_sbPending` is `true` but the `sbPush()` never fires.  
**Where:** `index.html:10104-10113`  
**Why it matters:** Silent data loss is the worst possible failure mode for a personal productivity app. Users will lose tasks they just captured or edits they just made — and they will blame the app, not the timing.  
**Effort:** S  
**Suggested fix:**
```js
window.addEventListener('beforeunload', e => {
  if (_sbEnabled() && _sbPending && navigator.onLine) {
    // Fire a synchronous beacon so the browser can send it before unloading.
    navigator.sendBeacon(APP_CONFIG.aiProxy?.replace('/api/claude','')+'/api/sync', ...);
    // Or at minimum: clear the debounce and call sbPush() without awaiting
    clearTimeout(_sbTimer);
    sbPush().catch(()=>{});
  }
});
```
- Alternatively, lower the debounce to 800ms and use `keepalive: true` on the fetch.

---

### 8. `givelink.html` AI prompts hardcode "Panos Evangelou" as the sender
**What:** Both the Standup Generator (`givelink.html:1492`) and Outreach Email Generator (`givelink.html:1637`) hardcode the owner's name in the AI prompt. Any other team member using the Givelink OS gets standups and emails written from Panos's perspective.  
**Where:** `givelink.html:1492`, `givelink.html:1637`  
**Why it matters:** At minimum this is confusing. If a co-founder or assistant uses the tool, emails go out signed "Panos Evangelou" — a correctness bug for a sales outreach tool.  
**Effort:** S  
**Suggested fix:**
- Read the sender name from `localStorage.getItem('taskos_name')` or `_SB.email`.
- Add a "Sender name" setting to the Givelink Settings panel (one extra field).
- Fall back to `'the Givelink team'` rather than a specific name if unset.

---

### 9. `callClaude()` has no fetch timeout — a hung connection locks the AI button forever
**What:** There is no `AbortController` / `signal` timeout on the `fetch()` in `callClaude()`. If the Anthropic API or the Vercel proxy hangs mid-request, the `_aiLock` flag is never cleared, permanently disabling the AI button until page reload.  
**Where:** `index.html:4867-4881`  
**Why it matters:** On mobile connections, stalled fetches are common. Users think the feature is broken and either reload (losing all unsaved work) or give up on AI features.  
**Effort:** S  
**Suggested fix:**
```js
const ac = new AbortController();
const timeout = setTimeout(() => ac.abort(), 30000);
res = await fetch(url, { ..., signal: ac.signal });
clearTimeout(timeout);
```
- Both `aiAutoTriage` and `aiPlanDay` also call `_aiUnlock` sequentially (not in `finally`), so a thrown error before `callClaude` also permanently locks the feature. Wrap with `try/finally`.

---

### 10. `window.prompt()` used for activity logging in Givelink CRM — broken on mobile
**What:** `logActivityNP()` calls `window.prompt('Log activity...')` which is a native browser prompt dialog. On iOS Safari this is often blocked by default, and on mobile it creates a poor UX that breaks the tap-and-log flow.  
**Where:** `givelink.html:1431`  
**Why it matters:** The CRM is core to the Givelink product. If activity logging is broken on mobile (where founders spend >50% of their time), pipeline data goes un-logged.  
**Effort:** S  
**Suggested fix:**
- Replace the `window.prompt` with the app's own `showPrompt()` helper (already used in `index.html:10007`), or a small inline modal matching the existing `.mo` / `.md` pattern.
- Pre-populate the field with the last activity note to make it a quick edit.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `importData()` uses `Object.assign(S, d)` with no schema validation
**What:** Any JSON file (including malformed ones or a file from a different app) is merged directly into the live state object. There is no check that the imported file came from Task OS, no version compatibility check, and no protection against overwriting internal fields (`_updatedAt`, `_welcomed`).  
**Where:** `index.html:2508-2519`  
**Why it matters:** A bad import can corrupt the entire app state in an irreversible way (localStorage is immediately overwritten). This is especially risky after the import is documented in the UI as a "restore from backup" flow.  
**Effort:** S  
**Suggested fix:**
- Validate that `d.tasks` is an array AND `d.goals` is an array (or undefined). Reject otherwise with a clear error.
- Strip internal fields (`_updatedAt`, `_welcomed`, `_sbApplying`) from the imported object before merging.
- Show a diff summary before applying: "This backup contains X tasks, Y goals, Z habits — import?"

---

### 11. `_autoSnapshot()` silently swallows all errors
**What:** The entire function body is inside `try{...}catch(e){}` with no error logging. If the Givelink Pace Engine trend snapshots silently fail, `givelinkHistory` stays empty and the trend charts never update.  
**Where:** `index.html:10117-10131`  
**Why it matters:** The Pace Engine is a flagship feature of the Givelink OS. Silent failures make it appear broken when in fact the data collection is failing.  
**Effort:** S  
**Suggested fix:**
- Add `console.warn('[autoSnapshot]', e)` in the catch at minimum.
- Consider calling `_sbScheduleSync()` after a successful snapshot to ensure the new history point is persisted to the cloud.

---

### 12. Claude model ID is hardcoded in two places — will silently use an outdated model
**What:** `'claude-haiku-4-5-20251001'` is hardcoded in `api/claude.js:42` and `index.html:4879`. When a newer, cheaper, or faster model is preferred, both places must be found and changed manually (and a redeploy is required for the serverless function).  
**Where:** `api/claude.js:42`, `index.html:4879`  
**Why it matters:** Low velocity risk today; becomes a real cost/quality issue as Claude model cadence accelerates.  
**Effort:** S  
**Suggested fix:**
- In `api/claude.js`, read from an env var: `const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';`
- In `index.html`, define `const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';` near `APP_CONFIG` and reference it in `callClaude()`.
- This also makes it trivial to A/B test Sonnet vs Haiku for specific flows.

---

### 13. `document.execCommand('copy')` fallback is deprecated and broken in modern browsers
**What:** Both `givelink.html:1521` and the standup copy function use `document.execCommand('copy')` as a clipboard fallback. This API was deprecated in all major browsers in 2023.  
**Where:** `givelink.html:1521`, `givelink.html:1622`  
**Why it matters:** On browsers where `navigator.clipboard` is unavailable (HTTP, some PWA contexts), the copy silently fails.  
**Effort:** S  
**Suggested fix:**
- The existing pattern already tries `navigator.clipboard.writeText()` first. Remove the `execCommand` fallback entirely — it no longer works. Show a toast "Copy not supported in this browser" instead of silently failing.
- For the PWA (always HTTPS), `navigator.clipboard` is available in all target browsers.

---

## 💡 P3 — Nice to have

### 14. `givelink.html` uses blue accent (#3b82f6), conflicting with the violet brand (#8b7cff)
**What:** `givelink.html:17` defines `--accent:#3b82f6` (Tailwind blue-500). The main app uses `--accent:#8b7cff` (violet). The brand brief specifies purple `#6B3FA0 / #5718CA`. Three different accent colors exist across two pages.  
**Where:** `givelink.html:17`  
**Why it matters:** Users who switch between the two pages (`⌘2` or the sidebar Givelink link) notice the color shift. For a product pitched to nonprofits, visual consistency matters for trust.  
**Effort:** S  
**Suggested fix:**
- Update `givelink.html:17` to `--accent:#8b7cff` to match the main app's violet.
- Or, if intentional (Givelink has its own product identity), document the color split in a comment and ensure it's deliberate.

---

### 15. No `.env.example` — self-hosters have no reference for required environment variables
**What:** `api/claude.js` requires `ANTHROPIC_API_KEY` and optionally `SUPABASE_URL` + `SUPABASE_ANON_KEY`, but there is no `.env.example` file in the repo.  
**Where:** `api/claude.js:4-8`  
**Why it matters:** Anyone forking the repo or onboarding a new deploy has to read the source comments to discover the required env vars. Low friction today; becomes a blocker when bringing on a co-founder or contributor.  
**Effort:** S  
**Suggested fix:**
- Create `.env.example`:
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_ANON_KEY=eyJhbGci...
  CLAUDE_MODEL=claude-haiku-4-5-20251001
  ```

---

### 16. Recurring tasks advance to the wrong date in UTC-offset timezones
**What:** `new Date(t.dueDate)` in the recurring task cloner parses `'2024-01-15'` as UTC midnight. In any negative-offset timezone (UTC-1 to UTC-12), `toISOString().slice(0,10)` returns the *previous* day, so "daily" recurring tasks are due yesterday before the user has even seen them.  
**Where:** `index.html:3748`  
**Why it matters:** Recurring tasks are a core retention feature. Off-by-one dates cause overdue badges to show incorrectly, undermining trust in the system.  
**Effort:** S  
**Suggested fix:** Change to `new Date(t.dueDate + 'T00:00')` (local-time parsing). This same pattern applies everywhere a stored `YYYY-MM-DD` is passed to `new Date()` — search for `new Date(t.dueDate)` and `new Date(l.date)`.

---

_Total: 18 items across 4 tiers. Highest-leverage quick wins (all < 30 min): item 1 (logout clears data), item 7 (Panos hardcoding in AI prompts), item 8 (page title), item 5 (XSS in checklists), item 6 (task -1 corruption)._
