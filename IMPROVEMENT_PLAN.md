# Givelink / Task OS — Improvement Plan

> Audited 2026-06-21 against `main` @ `0b54845`.  
> Scope: `index.html` (12,893 lines), `givelink.html` (1,755 lines), `sw.js`, `vercel.json`, `supabase-setup.sql`.  
> Architecture: zero-build vanilla HTML/JS/CSS, PWA, localStorage + optional Supabase sync.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP blocks all Supabase API calls in production
**What:** `connect-src` in `vercel.json` never lists `*.supabase.co`, so every Supabase auth and data request is rejected by the browser with a CSP violation.  
**Where:** `vercel.json:14`  
**Why it matters:** Anyone who follows the setup guide and enables cloud sync will see silent failures — `sbConnect()` throws "push 0" errors and nothing syncs. The entire multi-device sync feature ships broken.  
**Effort:** S  
**Suggested fix:**
- Add `https://*.supabase.co` to `connect-src` in `vercel.json`.
- While there, also add `wss://*.supabase.co` for future real-time subscriptions.
- Remove the vestigial `https://hooks.slack.com` entry (no Slack code exists in the codebase — see P2 #9).

---

### 2. Claude API key leaks into Supabase cloud database
**What:** `claudeKey` lives inside the top-level `S` state object; when the user saves settings (`index.html:8506`) and Supabase sync is enabled, the entire `S` blob — including the API key — is pushed to the cloud (`sbPush` at `index.html:8609`).  
**Where:** `index.html:2036` (key in S default), `index.html:8506` (`S.claudeKey=k; save()`), `index.html:8609` (`body:JSON.stringify(S)`)  
**Why it matters:** Every user who configures cloud sync is silently uploading their Anthropic API key to a Postgres database. A leaked or misconfigured Supabase project exposes it.  
**Effort:** S  
**Suggested fix:**
- Move `claudeKey` out of `S` and into a dedicated `localStorage` key (`taskos_claude_key`), mirroring how Readwise/Notion tokens are stored.
- In `sbPush`, never reconstruct it: `const {claudeKey, ...safeS} = S; body: JSON.stringify([{user_id:..., data:safeS, ...}])`.
- On `load()`, restore the key from `localStorage.getItem('taskos_claude_key')` into `S.claudeKey` at runtime only.

---

### 3. Push notification icon `./icons/icon-192.png` is a 404
**What:** Both the service worker and the in-app notification function reference a PNG icon at `./icons/icon-192.png`, which does not exist — the repo only has `icon.svg` and `icon-gl.svg` at the root.  
**Where:** `sw.js:38-39`, `index.html:9286`  
**Why it matters:** On Chrome/Android (the primary PWA platform), notifications without a valid icon are suppressed or displayed with a generic browser badge. ntfy-powered reminders — a promoted feature — silently break.  
**Effort:** S  
**Suggested fix:**
- Create an `icons/` directory containing `icon-192.png` and `icon-512.png` (generated from the existing `icon.svg`).
- Alternatively, update `sw.js:38` and `index.html:9286` to use `'./icon.svg'` — SVG icons are accepted by modern browsers for notifications.
- Add `icons/` to the PWA manifest entries.

---

### 4. XSS: task and goal titles injected raw into `innerHTML` in Weekly Review wizard
**What:** In `renderWizPanel()`, steps 0 through 2 template-literal `t.title` and `g.title` directly into `innerHTML` with no call to `esc()`.  
**Where:** `index.html:2888` (step 0 — completed tasks), `index.html:2895` (step 2 — backlog), `index.html:2897` (step 3 — goal progress)  
**Why it matters:** A task title containing `<img src=x onerror="...">` executes arbitrary JavaScript when the user opens their weekly review. The `esc()` helper already exists at `index.html:9773` and is used correctly elsewhere — it's simply missing from these three branches.  
**Effort:** S  
**Suggested fix:**
- Replace every bare `${t.title}` → `${esc(t.title)}` and `${g.title}` → `${esc(g.title)}` in all three `wizStep` branches.
- Also fix `index.html:2062` (`<option>...'+t.title.slice(0,45)+'...`) — same pattern, unescaped option text.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Notion integration always fails due to CORS — no clear user path
**What:** The "Fetch from Notion" button calls `https://api.notion.com/v1/blocks/...` directly from the browser; Notion's CORS policy rejects all browser-originated requests. The code itself acknowledges this (`index.html:8943-8951`) with an inline workaround message — but the button still exists and still fails every time.  
**Where:** `index.html:8916-8955` (`fetchFromNotion`)  
**Why it matters:** Every user who tries to connect Notion hits a wall with a confusing error. The suggested workaround (export to Markdown and paste) is buried in the error state and never shown proactively.  
**Effort:** M  
**Suggested fix:**
- Add a `GET /api/notion-proxy?pageId=...` Vercel serverless function (`api/notion-proxy.js`) that makes the Notion API call server-side (Vercel Functions are free on Hobby/Pro). Takes `pageId` + `token` from request headers.
- Alternatively, remove the fetch attempt entirely and replace the button with a labeled textarea and clear manual-paste instructions shown upfront instead of after failure.

---

### 6. PWA users on June 8 bug fixes — SW cache never bumped
**What:** The service worker cache key is `'task-os-20260530'` (set May 30), but four bug fixes shipped June 8. PWA-installed users are served the buggy May 30 build.  
**Where:** `sw.js:1`  
**Why it matters:** Anyone who installed the app before June 8 continues to see: broken backdrop close, discomfort ladder crashes, blank wins titles, and broken Givelink swipe — the exact issues commits #51-54 fixed. They won't get the fixes until the cache name changes.  
**Effort:** S  
**Suggested fix:**
- Bump `CACHE = 'task-os-20260608'` (or `20260621` today) to force clients to download the current build.
- Long-term: automate by injecting a build timestamp into `sw.js` at deploy time via a Vercel build script or a `sed` one-liner in `package.json`.

---

### 7. Finance and Health goals are hardcoded to personal targets
**What:** Three goal labels are hardcoded strings: `"goal: €25K"` for annual income, `"goal: €300"` for monthly passive income, and `"goal: 12%"` for body fat. They cannot be changed in Settings.  
**Where:** `index.html:4199` (body fat), `index.html:4299` (income), `index.html:4300` (passive income), `index.html:10771`, `index.html:10973`  
**Why it matters:** The goals embedded in the UI appear as designed targets rather than user-configured numbers. For anyone other than the original developer, the Finance view shows meaningless progress bars. Also makes the Health & Finance sections feel like placeholder UI rather than real tools.  
**Effort:** S  
**Suggested fix:**
- Add three fields to `S`: `finGoalAnnualIncome`, `finGoalMonthlyPassive`, `healthGoalBodyFat`, with the current hardcoded values as defaults.
- Expose as number inputs in Settings → Finance / Health section.
- Replace the hardcoded references with `S.finGoalAnnualIncome` etc.

---

### 8. Supabase sync fires on every save with the full state blob
**What:** Every `save()` call schedules `_sbScheduleSync()`, which pushes the full `S` JSON (potentially 100KB+ as data accumulates) to Supabase after 2.5 seconds. There is no dirty-bit check — if you check off 3 habits rapidly, 3 upload timers are queued/debounced, but each one still uploads the full object.  
**Where:** `index.html:8633-8639` (`_sbScheduleSync`), `index.html:2105` (`_sbScheduleSync()` call in `save()`)  
**Why it matters:** On mobile connections, frequent full uploads drain battery and bandwidth. Users on spotty connections will see the "Synced ⬆" indicator flicker constantly.  
**Effort:** M  
**Suggested fix:**
- Add a `let _sbDirty = false` flag. Set it to `true` in `save()`. In `_sbScheduleSync`'s timeout, only call `sbPush()` if `_sbDirty`, then reset `_sbDirty = false`.
- This reduces uploads from "every action" to "once per 2.5-second burst of activity."

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. Slack in CSP `connect-src` but zero Slack code exists
**What:** `vercel.json:14` whitelists `https://hooks.slack.com` in `connect-src`, but searching the entire codebase finds no `fetch` calls to Slack anywhere.  
**Where:** `vercel.json:14`  
**Why it matters:** Unnecessary network permission that slightly widens the attack surface and confuses future readers who search for Slack integration.  
**Effort:** S  
**Suggested fix:** Remove `https://hooks.slack.com` from `connect-src`.

---

### 10. `unsafe-inline` in `script-src` makes the XSS CSP toothless
**What:** Because all JavaScript is inline in `index.html`, the CSP must allow `'unsafe-inline'`, which bypasses all XSS script injection protection.  
**Where:** `vercel.json:14`, architectural constraint of `index.html`  
**Why it matters:** The Content-Security-Policy provides real protection against reflected XSS only when inline scripts are disallowed. With `unsafe-inline`, any injected `<script>` tag runs freely.  
**Effort:** L  
**Suggested fix:**
- As a near-term improvement, extract the ~7,000-line JS block into a separate `app.js` file — no build tooling required, just a `<script src="app.js">`.
- This allows removing `'unsafe-inline'` from `script-src` and using `'self'` alone, which meaningfully hardens the CSP against reflected XSS.

---

### 11. `givelink.html` has near-zero accessibility markup
**What:** The entire `givelink.html` — 1,755 lines of interactive sprint board, kanban columns, task cards, and modal dialogs — contains exactly 1 ARIA attribute (the hamburger `aria-label`). All interactive elements are invisible to screen readers and keyboard navigation.  
**Where:** `givelink.html` — throughout  
**Why it matters:** Sprint board as a team-facing product (per the "team sprint planning" manifest description) needs basic accessibility to comply with WCAG 2.1 AA. Keyboard users cannot navigate kanban columns or open tasks.  
**Effort:** M  
**Suggested fix:**
- Add `role="list"` to kanban columns and `role="listitem"` to task cards.
- Add `aria-label` to the `+` FAB (`aria-label="Add task"`), status checkboxes (`aria-label="Mark complete"`), and the sprint progress bar (`role="progressbar" aria-valuenow="..." aria-valuemax="100"`).
- Ensure all modal close buttons have `aria-label="Close"`.

---

### 12. `S` object grows unboundedly; storage only checked on hard failure
**What:** The ~40 arrays in `S` (habitLogs, deepWorkSessions, healthLogs, etc.) accumulate entries indefinitely. `localStorage.setItem` is only checked for `QuotaExceededError` after it fails; there is no proactive size warning.  
**Where:** `index.html:2036` (S defaults), `index.html:2099-2103` (save/catch)  
**Why it matters:** After 6-12 months of daily use, `S` can exceed 5MB (the localStorage limit). The app shows a toast on failure but has no way to recover — the data is already full, and the toast appears too late to export cleanly.  
**Effort:** M  
**Suggested fix:**
- Add a `_checkStorageSize()` helper: `const usage = new Blob([JSON.stringify(S)]).size; if (usage > 4_000_000) toast('⚠️ Data approaching 5MB limit — export a backup.', 8000)`.
- Call it once daily (gate with a `localStorage` date key).
- Add a one-click "Archive completed tasks older than 90 days" button to the Settings modal.

---

## 💡 P3 — Nice to have

### 13. Givelink brand accent is blue, not the specified purple
**What:** `givelink.html` uses `--accent:#3b82f6` (Tailwind blue-500) as its primary accent color. The Givelink brand palette (per brief) calls for purple `#5718CA` as the primary and pink `#E353B6` as the secondary.  
**Where:** `givelink.html:17` (`--accent`), `manifest-givelink.json:8` (`"theme_color":"#3b82f6"`)  
**Why it matters:** The sprint board is the primary Givelink-branded surface. Current blue matches neither the Givelink identity nor differentiates it visually from generic productivity tools.  
**Effort:** M  
**Suggested fix:**
- Replace `--accent:#3b82f6` → `#5718CA`; add `--accent2:#E353B6` for secondary highlights.
- Update `theme_color` in `manifest-givelink.json` to `#5718CA`.
- Audit all pillar-color variables (`--np`, `--pr`, `--op`) against no-pink-on-purple rule: ensure `--pr:#f472b6` (pink) is never used as text on a `--op:#a78bfa` (purple) background.

---

### 14. Impact model `peopleImpacted` ignores user-edited `avgSize`
**What:** `peopleImpacted` is calculated as `totalDonations / 50` (hardcoded 50), but `totalDonations` itself already incorporates the user-editable `avgSize` input. The division should use `avgSize`, not `50`.  
**Where:** `index.html:7506` (`const peopleImpacted=Math.round(totalDonations/50)`)  
**Why it matters:** If a user changes the average donation size to $100, the model still divides by $50, double-counting the donation size and showing an inflated impact number. The 1M People model is the Givelink dashboard's hero metric.  
**Effort:** S  
**Suggested fix:**
- Change `Math.round(totalDonations/50)` → `Math.round(avgSize > 0 ? totalDonations/avgSize : 0)`.
- The guard against `avgSize === 0` is already present in the growth-rate branch (`if(growthRate>0&&avgDon>0&&avgSize>0)`) — apply the same pattern here.
