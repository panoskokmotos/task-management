# Givelink Improvement Plan

> Generated: 2026-07-01 | Scope: `index.html` (12 893 lines), `givelink.html` (1 755 lines), `sw.js`, `supabase-setup.sql`
> Max 20 items, ordered by ROI within tier.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. iOS PWA: `window.prompt()` silently returns `null` — API key and activity logging completely broken

**What**: `window.prompt()` is used to collect the Anthropic API key and to log activities; on iOS in standalone PWA mode the browser swallows the dialog and returns `null` without any user-visible hint, leaving users unable to use any AI feature.

**Where**: `givelink.html:1086` (`getApiKey`), `givelink.html:1431` (`logActivityNP`)

**Why it matters**: Any iOS user who added the app to their Home Screen (the primary mobile install path) cannot enter their API key and cannot log activities — two of the app's core interactions are completely dead.

**Effort**: S

**Suggested fix**:
- Replace both `window.prompt()` calls with an in-app modal; `index.html` already has a `showPrompt(label, placeholder)` utility at line 2301 — copy that function into `givelink.html`
- Store the returned key in the same `localStorage` path (`taskos → claudeKey`) as the existing code expects
- Add a toast on `null` return: "Tap Settings to enter your API key"

---

### 2. `generateStandup` reports the wrong day — "yesterday" window starts 48 h ago

**What**: `yesterday.setDate(now.getDate() - 2)` looks back two full days instead of one, so tasks completed yesterday afternoon fall outside the filter window and are silently omitted from the standup.

**Where**: `givelink.html:1488`

**Why it matters**: The standup generator is the primary async-comms tool for teams; a mismatch between what it says and what was actually done yesterday erodes trust in the feature within the first use.

**Effort**: S (one character fix)

**Suggested fix**:
- Change `-2` → `-1` at line 1488
- Add a unit test (or at minimum a console assertion) that `yesterday` is always `now - 1 day`

---

### 3. XSS injection: AI-extracted task titles written directly into `onclick` HTML

**What**: `aiExtractTasksFromNotes()` interpolates AI-generated task titles (which come from a Claude API response and ultimately from user notes) directly into an `onclick` attribute string with only single-quote escaping, leaving backtick injection, `)` + `;` sequences, and template-literal payloads unguarded.

**Where**: `index.html:6410`

**Why it matters**: Malicious content in notes (or a prompt-injected Claude response) can execute arbitrary JavaScript in the user's session — full read/write access to `S`, including the Claude API key stored in `S.claudeKey`.

**Effort**: S

**Suggested fix**:
- Store AI-extracted tasks in a module-level array `window._extractedTasks = []` after the API call
- Render buttons with `data-idx` attributes: `<button data-idx="0" onclick="addExtractedTask(0)">+ Add</button>`
- In `addExtractedTask(i)`, look up `window._extractedTasks[i]` — zero user-content touches the DOM as executable code

---

### 4. `generateTweet()` acquires `_aiLock` but never releases it on success — all AI features freeze

**What**: `generateTweet()` calls `_aiLock('tweet')` at the start but has no `_aiUnlock` call in the success path, only in the `catch` block. After the first successful tweet generation, every other `_aiBtn`-gated function in the app refuses to run ("AI is busy").

**Where**: `index.html:5046` (`generateTweet`), cross-referenced with `_aiBtn` at `index.html:2258`

**Why it matters**: The freeze is invisible — buttons just do nothing. Users who generate a tweet then find AI coaching, wheel insights, and daily picks silently stopped working will likely blame the API key and churn.

**Effort**: S

**Suggested fix**:
- Wrap the full function body in `try { ... } finally { _aiUnlock('tweet'); }` instead of only unlocking in `catch`
- Audit all other AI functions that use `_aiLock` directly (not via `_aiBtn`) for the same missing `finally` pattern: `aiWheelInsight` (line 6049), `showBatchSuggestions` (line 5021)

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Root CSS palette is GitHub-dark blue (`--brand:#58a6ff`) — entire app is off-brand

**What**: The CSS `:root` block at line 22 of `index.html` defines `--brand:#58a6ff` and `--brand2:#bc8cff` (GitHub's blue/purple), which propagate to buttons, active nav items, focus rings, progress bars, and chart fills throughout the 12 000-line file.

**Where**: `index.html:22` (`:root` variables); `index.html:5244`, `5276`, `5343`, `5370`, `5586`, `6091`, `6253`, `6343`, `6502` (inline recurrences of `#58a6ff` / `rgba(88,166,255,…)`)

**Why it matters**: Every screenshot, demo, and investor deck shows the wrong brand color. Fixing the root variables corrects hundreds of downstream occurrences at once.

**Effort**: M

**Suggested fix**:
- Change `--brand:#58a6ff` → `#6B3FA0` and `--brand2:#bc8cff` → `#5718CA` in `:root`
- Run a find-replace for literal hex occurrences: `#58a6ff` → `#6B3FA0`, `rgba(88,166,255,` → `rgba(107,63,160,`
- Verify the "no pink on purple" rule: ensure `#C2185B`/`#E353B6` never appear as text on a `#6B3FA0` background

---

### 6. `givelink.html` uses Tailwind blue (`--accent:#3b82f6`) — the product's own page has zero brand purple

**What**: `givelink.html:17` declares `--accent:#3b82f6` and uses it for the FAB, active nav indicator, sprint progress bar, update banner, install banner CTA, and `<meta name="theme-color">`. The brand palette (`#6B3FA0` / `#5718CA`) is absent from the file entirely.

**Where**: `givelink.html:17` (CSS variable), `givelink.html:135` (FAB shadow), `givelink.html:1738` (update banner), `givelink.html:1740` (`<meta>` theme-color)

**Why it matters**: The Givelink sprint board — the page that donors and nonprofit users see — advertises the wrong brand on every element. The product pillar's own color (`#f472b6` pink on line 423) also violates the no-pink-on-purple rule.

**Effort**: S

**Suggested fix**:
- Replace `--accent:#3b82f6` → `--accent:#6B3FA0` at `givelink.html:17`
- Replace FAB shadow `rgba(59,130,246,.4)` → `rgba(107,63,160,.4)` at line 135
- Update `<meta name="theme-color" content="#3b82f6">` → `#6B3FA0` at line 1740
- Change `PILLARS.product.hex` from `#f472b6` (pink) to a non-pink distinguishing color (e.g., `#34d399` emerald) at line 423

---

### 7. Givelink dashboard impact metrics use off-brand `#a78bfa` — product's flagship numbers look wrong

**What**: `renderGivelinkDash()` renders the headline nonprofit count, cumulative impact score (48 px display value), progress bars, and impact model section all in `color:#a78bfa` (Tailwind `violet-400`), not the brand `#6B3FA0`.

**Where**: `index.html:5457–5537` (`renderGivelinkDash`); `index.html:5348` (`CAT_COLORS.givelink:'#a78bfa'`)

**Why it matters**: The core Givelink product metric display — the number that represents impact — renders in a color that isn't in the brand guide, undermining credibility in demos and user screenshots.

**Effort**: S

**Suggested fix**:
- Replace `#a78bfa` → `#6B3FA0` and `rgba(167,139,250,` → `rgba(107,63,160,` throughout `renderGivelinkDash()`
- Update `CAT_COLORS.givelink` at line 5348 from `'#a78bfa'` → `'#6B3FA0'`

---

### 8. Daily checklist auto-opens 1.5 s after every page load without user consent

**What**: `initChecklists()` (line 9241) fires `setTimeout(() => openChecklist('daily'), 1500)` on every load when the daily list is <50% complete — no dismissal state, no modal-open guard. On mobile this full-screen overlay covers content the user was actively navigating to.

**Where**: `index.html:9238–9244` (`initChecklists`)

**Why it matters**: An uninvited full-screen modal 1.5 seconds after load is the fastest way to train users to avoid the feature. New users who haven't configured checklists see a mostly-empty modal on their first visit.

**Effort**: S

**Suggested fix**:
- Remove the `setTimeout` auto-open entirely
- Replace with a non-blocking nudge toast: `toast('5 checklist items left today — <u onclick="openChecklist(\'daily\')">Open</u>')` if <50% done
- Add a `S.checklistDismissedDate` flag so explicit closes prevent re-appearance the same day
- Guard any surviving auto-open with `if (document.querySelector('.mo:not(.hidden)')) return;`

---

### 9. Supabase sync blindly overwrites local state with remote — clock skew silently loses recent work

**What**: `sbSyncNow()` at line 8618 does `S = { ...S, ...remote.data }`. If the remote snapshot is slightly older than local (multi-tab or clock skew), every key the remote has — including `tasks`, `goals`, and `reviews` — silently reverts to the older version. There is only a coarse millisecond `_updatedAt` comparison with no per-field conflict resolution.

**Where**: `index.html:8618–8622` (`sbSyncNow`)

**Why it matters**: A user who adds tasks on mobile while offline, then opens the desktop tab before the mobile sync completes, can lose all their mobile work the moment the desktop tab syncs.

**Effort**: M

**Suggested fix**:
- Before the spread, take a backup: `const _backup = JSON.parse(JSON.stringify(S));`
- For array keys (`tasks`, `goals`, `reviews`, `habits`), merge by ID instead of replacing: combine both arrays, dedup by `id`, prefer whichever has a newer `_updatedAt` per item
- Add a toast warning when remote `_updatedAt < S._updatedAt - 5000`: "Sync conflict detected — kept local changes"

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. Task object literal duplicated 8+ times — divergent schemas cause invisible bugs

**What**: The 18-field task object `{ id: uid(), title, status:'todo', priority:'med', … }` is copy-pasted into `doCapture()` (line 2676), `_cmdkCapture()` (line 3459), `_wfAddTasks()` (line 4508), `doQuickAdd()` (line 5845), `_addGoalTask()` (line 6614), `aiExtractTasksFromNotes()` (line 6410), `handleQC()` (line 8794), and `importCSVTasks()` (line 9027).

**Where**: `index.html:2676`, `3459`, `4508`, `5845`, `6410`, `6614`, `8794`, `9027`

**Why it matters**: A field added or renamed in one copy doesn't propagate to the others. Tasks created from CSV import, from the AI extractor, and from quick-add already differ slightly, causing subtle rendering bugs and data inconsistencies.

**Effort**: M

**Suggested fix**:
- Implement `makeTask(title, overrides = {})` factory near the top of `<script>`: returns the canonical object with all defaults
- Replace all 8 inline literals with `makeTask(title, { ... specific overrides ... })`
- Add a `_TASK_SCHEMA_VERSION: 1` field to `makeTask()` output for future migration guards

---

### 11. AI prompts fall back to hardcoded "Panos — Givelink/SF" personal bio for all users

**What**: Multiple AI coaching prompts use `getAboutMe() || 'Panos — 20s founder building Givelink (B2B SaaS for nonprofits), targeting financial freedom and an SF move.'` as the default context. Any user who hasn't filled in "About Me" receives AI responses personalized to the developer's life.

**Where**: `index.html:6053` (`aiWheelInsight`); search for `'Panos'` reveals additional occurrences in wheel, biomarker, and challenge AI prompts

**Why it matters**: Embarrassing on first use for any non-Panos user; makes AI coaching feel broken ("Why is it talking about San Francisco?"). Also surfaces internal product details to users.

**Effort**: S

**Suggested fix**:
- Change the fallback to: `'A person working toward their personal and professional goals'`
- On first AI call when `getAboutMe()` is empty, show a one-time toast: "Add your About Me in Settings for personalized coaching"
- Store this shown-once flag in `S.flags.aboutMeNudge` so it syncs across devices

---

### 12. Claude API key displayed in plaintext `<input type="text">` — visible to shoulder-surfers

**What**: The Settings modal renders the Claude API key in `<input type="text" id="set-claude-key">`, making it fully visible on screen whenever Settings is open.

**Where**: Settings form HTML (search `id="set-claude-key"` in `index.html`, approximately line 1560); populated at `index.html:8486`

**Why it matters**: Anyone glancing at a shared or public screen while the user has Settings open sees the full API key. The key grants full Anthropic API access and billing.

**Effort**: S

**Suggested fix**:
- Change the input attribute to `type="password"` — the value still functions identically but is masked
- Add a show/hide toggle button (eye icon) next to the field, a common pattern that addresses usability without sacrificing security

---

### 13. Supabase password left in input field on connection failure

**What**: `sbConnect()` clears `document.getElementById('set-sb-pass').value = ''` only on the success path. If the connection fails (catch block at line 8590), the password string remains visible in the open Settings modal.

**Where**: `index.html:8590` (catch block), `index.html:8585` (success clear)

**Why it matters**: Failed connections are the common case during initial setup (wrong URL, wrong key, network issue). The password sitting in a visible field after failure is a credential exposure risk.

**Effort**: S

**Suggested fix**:
- Move the `value = ''` clear to a `finally` block wrapping the entire `sbConnect` try/catch, so the field is always cleared regardless of outcome

---

### 14. `profile.name` and `aboutMe` stored outside synced `S` — silently missing on every new device

**What**: `getAboutMe()` reads `localStorage.getItem('taskos_about')` and `profileName` reads `localStorage.getItem('taskos_name')`. Both are set via Settings at lines 8504 and 8525 but live outside `S`, so they are never included in the Supabase sync payload.

**Where**: `index.html:8504` (name save), `index.html:8525` (aboutMe save), `index.html:6053` (aboutMe read in AI prompt)

**Why it matters**: A user who spends time crafting their "About Me" for AI personalization finds it missing every time they switch devices or browsers — effectively resetting their AI coaching context on every new session.

**Effort**: S

**Suggested fix**:
- Move both values into `S.profile = { name, about }` — they then sync automatically via `save()` → Supabase
- Migrate existing `localStorage` values into `S.profile` on first load with a one-time migration guard

---

### 15. `callClaudeGL` and `callClaude` are near-identical wrappers — but only the main-app version checks `res.ok`

**What**: `givelink.html:1256–1272` duplicates `index.html:4133–4149` almost verbatim (same endpoint, same headers, same response parse). The critical difference: `givelink.html`'s version does **not** check `res.ok`, so a 401 (bad key), 429 (rate-limit), or 500 from the Claude API returns `undefined` content with no user-visible error.

**Where**: `givelink.html:1256–1272` (`callClaudeGL`), `index.html:4133–4149` (`callClaude`)

**Why it matters**: When the Anthropic API rate-limits givelink.html (429), users see the AI spinner resolve to an empty output with no error message, making it look like an app bug rather than a quota issue.

**Effort**: S

**Suggested fix**:
- Add `if (!res.ok) { const err = await res.json().catch(() => ({})); toast('AI error ' + res.status + ': ' + (err.error?.message || '')); return null; }` after line 1267 in `givelink.html`
- Long-term: extract `callClaudeGL` / `callClaude` into a single shared snippet injected into both files (or a separate `claude-api.js`) so error handling stays in sync

---

### 16. `renderChecklistBody()` serializes JS functions via `.toString()` into `onclick` — fragile and CSP-incompatible

**What**: At line 9228, checklist action buttons are rendered as `onclick="(${item.action.toString()})();"`, serializing a live function reference to its source string and injecting it into HTML. This breaks if the app is ever minified/bundled, and will fail if CSP is tightened to remove `unsafe-inline`.

**Where**: `index.html:9228` (`renderChecklistBody`)

**Why it matters**: `vercel.json` already ships `script-src 'self' 'unsafe-inline'` — if that is ever hardened (a natural next step), the entire checklist system stops working. Minification (a common perf optimization) would also silently break it.

**Effort**: S

**Suggested fix**:
- Define a lookup table `const CHECKLIST_ACTIONS = { 'nav:capture': () => nav('capture'), 'fn:weeklyDigest': showWeeklyDigest, … }`
- Give each checklist item an `actionId` string key instead of a function reference
- In `renderChecklistBody()`: `onclick="CHECKLIST_ACTIONS['${item.actionId}']?.()"` — single string, no serialization

---

## 💡 P3 — Nice to have

### 17. Service worker cache key is a hardcoded future date — stale cache survives deploys silently

**What**: `sw.js:1` sets `const CACHE = 'task-os-20260530'`. Unless this string is manually changed before every deploy, all users continue serving the old cached files indefinitely.

**Where**: `sw.js:1`

**Why it matters**: A forgotten version bump (the most likely human error in a solo project) means a bug fix or brand color update ships to the server but the browser keeps serving the stale version for months.

**Effort**: S

**Suggested fix**:
- Read the version from `manifest.json` at build time, or use a short content hash injected by a tiny build script: `sed -i "s/CACHE_VERSION/$(date +%Y%m%d%H%M)/" sw.js`
- As a minimum, rename to `'task-os-v__BUILD__'` and add a pre-deploy step that replaces the placeholder

---

### 18. `supabase-setup.sql` recommends disabling email confirmation — leaves project open to unauthorized signups

**What**: `supabase-setup.sql:38` contains the comment "turn OFF 'Confirm email' for the fastest single-user setup." Disabling email confirmation means any email/password combination can create a verified account on the Supabase project.

**Where**: `supabase-setup.sql:38`

**Why it matters**: If the Supabase project's auth settings are set per this doc's advice, a leaked URL lets anyone register, potentially accessing RLS-protected rows or running up database/auth quotas.

**Effort**: S

**Suggested fix**:
- Reword the comment to: "Use magic link (passwordless) login for single-user setup — keeps email confirmation enabled"
- Add a note that if email+password is needed, confirm email should stay ON and only the invited email address should be whitelisted via Supabase's "Restrict signups" setting

---

### 19. `_habitStreak()` and Hebb co-occurrence engine key on task/habit title strings — silent data loss on rename

**What**: `_habitStreak()` at `index.html:4801` builds its streak map with habit name as the key. The Hebb association engine at `index.html:5527` stores pair weights as `a + '|||' + b` where `a` and `b` are task titles. Renaming a habit or task orphans all its historical data.

**Where**: `index.html:4801` (`_habitStreak`), `index.html:5527` (`_hebbRecord`)

**Why it matters**: Users who rename a habit after building a 30-day streak lose the streak display immediately. Hebb suggestions become less accurate over time as task titles are refined.

**Effort**: M

**Suggested fix**:
- Add a stable `id` field to each habit object (same `uid()` pattern used by tasks); key `_habitStreak` on `habit.id`
- Key Hebb pairs on `task.id` rather than `task.title`; store the association map as `S.hebbWeights` (keyed by ID pairs) rather than in a separate localStorage key

---

### 20. `claude-opus-4-5` used for AI Sprint Planner — Opus pricing for a simple JSON-list task

**What**: `givelink.html:1140` sends the sprint planning prompt to `claude-opus-4-5`, which is the most expensive model tier. The task (generate 10 tasks as a JSON array from a brief) is well within Haiku's capabilities.

**Where**: `givelink.html:1140` (`runAiSprintPlanner`)

**Why it matters**: Sprint planning can be triggered repeatedly (the "Regenerate" button). At roughly 10–20× the per-token cost of Haiku, this is an unnecessary spend that accumulates with usage and makes the feature expensive for API-key users.

**Effort**: S

**Suggested fix**:
- Change `model: 'claude-opus-4-5'` → `model: 'claude-haiku-4-5-20251001'` at line 1140
- If quality feels insufficient with Haiku, try `claude-sonnet-4-6` as a middle ground before reaching for Opus
