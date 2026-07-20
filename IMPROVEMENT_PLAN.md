# Arete — Improvement Plan
> Generated 2026-07-20. Covers `index.html` (14 924 lines), `landing.html`, `givelink.html`, `sw.js`, `api/claude.js`, `vercel.json`.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icon is 404 on every device
**What:** The service worker references `'./icons/icon-192.png'` for push notifications but the actual file lives at `./icon-192.png` (no `icons/` subdirectory).  
**Where:** `sw.js:46–47`  
**Why it matters:** Every user who enables reminders sees a broken icon (or the platform default). The ntfy.sh reminder loop — a key retention feature — looks unpolished on all platforms.  
**Effort:** S  
**Suggested fix:**
- Change both `icon` and `badge` from `'./icons/icon-192.png'` → `'./icon-192.png'`
- Bump the cache name (`CACHE = 'arete-20260723'`) so the patched SW is picked up on next load

---

### 2. CSP header blocks Google Fonts — Inter never loads in production
**What:** `vercel.json` sets `style-src 'self' 'unsafe-inline'` and `font-src 'self'`, excluding `fonts.googleapis.com` and `fonts.gstatic.com`. Browsers block the Inter stylesheet and font files; all text falls back to system sans-serif.  
**Where:** `vercel.json:15`  
**Why it matters:** The app's entire visual identity depends on Inter. In production every user sees the "wrong" font. The CSP was written correctly for security but missed the external font CDN.  
**Effort:** S  
**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src`
- Add `https://fonts.gstatic.com` to `font-src`
- Example: `"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"`
- Alternatively: self-host Inter via `@font-face` in a local CSS file to eliminate the CDN dependency entirely

---

### 3. XSS: `toast()` renders user task titles as raw HTML
**What:** `toast()` sets `el.innerHTML = msg` (line 2789). Multiple callers pass unescaped task titles directly into the HTML string — e.g., `` `🗑 "<strong>${t.title.slice(0,30)}</strong>"` `` and `'✅ Completed: ' + t.title`. Under the current `'unsafe-inline'` CSP, a task title like `<img src=x onerror=alert(1)>` executes.  
**Where:** `index.html:2789` (toast function); callers at lines `3844`, `4283`, `4292`, `4306`, `4348`  
**Why it matters:** Currently self-XSS only (users attacking their own browser), but any future template-sharing or collaborative feature would make this cross-user. The `unsafe-inline` CSP means no script-execution protection catches it.  
**Effort:** S  
**Suggested fix:**
- Split into `toast(htmlMsg)` (existing callers that deliberately use `<strong>`, `<span onclick>`) and a new `toastText(plainMsg)` that sets `textContent`
- Replace all callers that pass `t.title`, `title`, or other user-sourced strings with `toastText()`
- Or: escape user data inline with the existing `esc()` helper before concatenating into toast HTML strings

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Social share card still says "Task OS", not "Arete"
**What:** `_drawStatsCard()` draws `fillText('Task', …)` then `fillText('OS', …)` in the canvas share card. The rebrand in commit #80 missed this canvas drawing code.  
**Where:** `index.html:10214–10215`  
**Why it matters:** Every user who shares their progress card advertises the old brand. This is the highest-reach viral surface in the app (explicitly promoted in the account menu).  
**Effort:** S  
**Suggested fix:**
- Replace the two `fillText` calls with a single `fillText('Arete', 170, 124)` in the brand color
- Update the card footer at line 10232 to use the canonical domain once it's set (see item 5)

---

### 5. Every referral link, OG tag, and canonical URL points to the dev subdomain
**What:** The Vercel project subdomain `task-management-beige-eight.vercel.app` is hardcoded in seven places: OG/Twitter meta tags in both `index.html` and `landing.html`, the `canonical` link in `landing.html`, the `_APP_URL` constant, and the share-card footer text.  
**Where:** `index.html:24–32, 10180, 10232`; `landing.html:11, 16–17, 21`  
**Why it matters:** Every social share, every referral invite, every Google search result shows the ugly dev URL. When the app moves to a custom domain, all existing referral links break and SEO equity is split.  
**Effort:** S  
**Suggested fix:**
- Extract the canonical URL as a single constant at the top of each file: `const SITE_URL = 'https://yourdomain.com'`
- Replace all hardcoded occurrences — `index.html` (3 occurrences) and `landing.html` (4 occurrences)
- OG tags in HTML should use the same constant via a `<script>` data injection or a build-time substitution

---

### 6. `importData()` silently overwrites all user data — no confirmation, no backup
**What:** `importData()` calls `Object.assign(S, d)` immediately on file selection with no warning dialog, no "are you sure?", and no auto-export of the current state before overwriting.  
**Where:** `index.html:2636–2638`  
**Why it matters:** A single misclick (wrong file in the file picker) irreversibly destroys all tasks, goals, and habits. Supabase sync only helps if the user is signed in *and* the cloud copy is newer — otherwise the overwrite is permanent.  
**Effort:** S  
**Suggested fix:**
- Show a `showConfirm()` dialog before applying: "This will replace all your current data. Export a backup first?"
- Add a "Download backup + Import" button path that calls `exportData()` then triggers the import
- Validate that `d.tasks` is an array of objects with at least an `id` field before `Object.assign`

---

### 7. AI proxy has no per-user rate limiting — single account can exhaust the Anthropic budget
**What:** `api/claude.js` proxies every request straight to Anthropic with no per-user quota. The file's own comment at line 13 says "For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."  
**Where:** `api/claude.js:1–49`  
**Why it matters:** Any signed-in user can loop the AI features (Plan Day, Triage, etc.) and generate unbounded API spend. As user count grows, one bad actor or a buggy client loop can spike the bill overnight.  
**Effort:** M  
**Suggested fix:**
- Add an Upstash Redis rate-limit check (free tier covers the use case): e.g., 20 AI calls per user per hour keyed by `uid`
- Reject with `429` and a human-readable message when over the limit
- Alternatively: track call count in Supabase with an RLS-protected `ai_calls` table — no extra service needed

---

### 8. All export filenames still use the old "taskos-" brand prefix
**What:** `exportData()`, `exportICS()`, `exportCSV()`, and `exportMarkdown()` download files named `taskos-backup-…`, `taskos-tasks-…`, etc. The share card PNG is `taskos-progress.png`.  
**Where:** `index.html:2602, 2628, 2652, 2668, 10243, 10247`  
**Why it matters:** Users who export their data see "taskos" in their Downloads folder, not "arete". Small but visible brand inconsistency that undermines the rebrand and confuses support conversations.  
**Effort:** S  
**Suggested fix:**
- Do a targeted find-and-replace: `'taskos-backup-'` → `'arete-backup-'`, `'taskos-tasks-'` → `'arete-tasks-'`, `'taskos-'` prefix in all download filename strings, `'taskos-progress.png'` → `'arete-progress.png'`

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. Last-write-wins sync silently discards local edits when the remote timestamp is newer
**What:** `sbSyncNow()` compares `remote.ms > localMs` and, when true, replaces all local state with the remote blob — no merge, no diff, no conflict UI. If a user edits on device A while device B completes a sync, device A's unsaved work vanishes on next sync.  
**Where:** `index.html:10418–10423`  
**Why it matters:** Users who work across devices (the main value proposition of cloud sync) can lose tasks silently. The issue compounds because the local clock drives `S._updatedAt`, so clock drift can cause unexpected overwrites.  
**Effort:** L  
**Suggested fix:**
- Short-term: before overwriting, check if `S.tasks.length > remote.data.tasks.length` and show a conflict warning with "Keep mine / Use cloud" options
- Long-term: move to a CRDT or operation-log model; Supabase's realtime subscription can drive incremental merges instead of last-write-wins blobs

---

### 10. `_sbToken()` silently fails on refresh-token expiry — user loses sync with no prompt
**What:** When the Supabase refresh token expires (default 7-day rotation), `_sbToken()` throws and all subsequent sync calls silently show "⚠ Sync error". There is no re-auth prompt — the user doesn't know they've been logged out of sync.  
**Where:** `index.html:10022–10026`  
**Why it matters:** Users who don't open the app daily will eventually find their data out of sync with no actionable error. The sync pill shows "Sync error — retry" but retrying a bad refresh token just repeats the failure.  
**Effort:** S  
**Suggested fix:**
- In the `catch` block of `_sbToken()`, check if the error is a 401 and call `_showAuthGate()` with a message like "Your session expired — log in again to keep syncing"
- Alternatively, attempt a silent re-login using stored credentials before giving up

---

### 11. No `.env.example` — local setup requires reading prose in `api/claude.js`
**What:** The repo has no `.env.example` or `.env.local.example`. Environment variables (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) are only documented in a comment block inside `api/claude.js:1–13`.  
**Where:** repo root (missing file)  
**Why it matters:** Anyone contributing to the project or deploying a fork has to reverse-engineer the required env vars from comments. A missing variable causes a cryptic 500 on the first AI call.  
**Effort:** S  
**Suggested fix:**
- Add `.env.example` with the three required variables and their descriptions, matching the comment in `api/claude.js`
- Add `.env.example` and `.env.local` to `.gitignore` (currently only `.claude/` is ignored)

---

### 12. Google Fonts loaded without `display=swap` — invisible text during slow loads (FOIT)
**What:** The Google Fonts `<link>` in `index.html` does not include `&display=swap`. On slow connections or first load, the browser hides all text until Inter downloads (Flash of Invisible Text), instead of showing system fonts immediately.  
**Where:** `index.html:16`  
**Why it matters:** Users on mobile or slow connections see a blank white app for 1–3 seconds before any text appears. This is especially bad for the first impression / onboarding flow.  
**Effort:** S  
**Suggested fix:**
- Change the Google Fonts URL to include `&display=swap`:  
  `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap`
- This is also required even when fixing P0-item-2 (CSP) since it applies to self-hosted fonts too

---

### 13. Landing page uses system font stack; app uses Inter — inconsistent first impression
**What:** `landing.html` sets `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` instead of Inter. The app shell (`index.html`) uses Inter throughout. Users see different typography on the pitch page vs. the product.  
**Where:** `landing.html:48–49`  
**Why it matters:** Brand inconsistency reduces perceived quality. Landing → app transitions feel like switching products. Inter is already available via the Google Fonts preconnect tags in `landing.html`.  
**Effort:** S  
**Suggested fix:**
- Add the same Inter `<link>` from `index.html` to `landing.html`'s `<head>` and update the `font-family` rule to `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

---

### 14. `localStorage` key prefix `taskos_` and `taskos` data key not rebranded
**What:** All cloud sync state is stored under `taskos_sb_*` keys (e.g., `taskos_sb_access`, `taskos_sb_uid`). The main data blob key is `'taskos'`. These are not user-visible but appear in browser DevTools and can cause confusion when debugging.  
**Where:** `index.html:9963–9972` (`_SB` getter object), `index.html:2580, 2598` (`save`/`load`)  
**Why it matters:** If the storage key changes in a future release, existing users' data is silently orphaned (the app won't find their stored state). Doing the rename now — with a one-time migration — is cheaper than doing it later with 10× the users.  
**Effort:** M  
**Suggested fix:**
- Rename `'taskos'` → `'arete'` and all `taskos_*` keys → `arete_*`
- On first load after update, check for old `taskos` key, migrate to `arete`, then delete the old key
- Coordinate with the Supabase `app_state` table structure (no change needed there — the Supabase key is per-row by `uid`)

---

## 💡 P3 — Nice to have

### 15. `Math.random()` sort for daily quests produces biased shuffle
**What:** `[...QUEST_TEMPLATES].sort(() => Math.random() - 0.5)` is a statistically biased sort — it doesn't produce a uniform shuffle. Fisher-Yates should be used instead.  
**Where:** `index.html:7806`  
**Why it matters:** Users in practice will see some quests appear more often than others. Low impact — daily quests are supplemental — but easy to fix correctly.  
**Effort:** S  
**Suggested fix:** Replace with a Fisher-Yates shuffle: `for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}`

---

### 16. `landing.html` has no `<meta name="robots">` — crawler behaviour is implicit
**What:** `landing.html` relies on default crawler behaviour (index, follow). There is no explicit `<meta name="robots" content="index, follow">` or sitemap reference.  
**Where:** `landing.html:1–22`  
**Why it matters:** Default is fine, but explicit is better — especially after the domain migration (item 5). Adding a sitemap link and explicit robots tag helps Google index the new domain faster.  
**Effort:** S  
**Suggested fix:**
- Add `<meta name="robots" content="index, follow">` and `<link rel="sitemap" href="/sitemap.xml">` to `landing.html`
- Create a minimal `/sitemap.xml` listing the landing page URL once the canonical domain is set

---

### 17. `supabase-setup.sql` has no `CREATE TABLE IF NOT EXISTS` guards — re-running breaks setup
**What:** The SQL schema uses plain `CREATE TABLE` statements without `IF NOT EXISTS`. Running the script twice on an existing project (e.g., during recovery) would fail with duplicate-table errors.  
**Where:** `supabase-setup.sql` (entire file)  
**Why it matters:** Low risk today, but any contributor or user following the setup docs who re-runs the SQL against an existing project will hit errors and may think setup failed.  
**Effort:** S  
**Suggested fix:** Prefix all `CREATE TABLE` statements with `CREATE TABLE IF NOT EXISTS` and add `CREATE INDEX IF NOT EXISTS` guards on any index creation statements

---

### 18. Progress share card renders the Vercel dev URL in the footer — visible in every shared image
**What:** The canvas share card hard-codes `task-management-beige-eight.vercel.app` as a footer attribution line, not just in meta tags but *burned into the image* that users share to Twitter/LinkedIn.  
**Where:** `index.html:10232`  
**Why it matters:** This is the most visible brand surface — a static image shared externally. Unlike HTML, you can't update it after the fact. Every card already shared carries the dev URL permanently.  
**Effort:** S  
**Suggested fix:**
- Replace the hardcoded URL with the `_APP_URL` constant (which will be fixed by item 5) so the share card always uses whatever canonical URL is configured:  
  `x.fillText('Made with Arete · ' + new URL(_APP_URL).hostname, 96, H-70)`

---

*Total: 18 items across 4 tiers. Items are ordered by ROI within each tier.*
