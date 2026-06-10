# Givelink / Task OS — Improvement Plan

> Generated 2026-06-10 | Codebase: `index.html` (12,893 lines) + `givelink.html` (1,755 lines) + `sw.js`

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP silently blocks Supabase cloud sync and Google Fonts
**What**: `vercel.json` `Content-Security-Policy` is missing `*.supabase.co` in `connect-src` and `fonts.googleapis.com`/`fonts.gstatic.com` in `style-src`/`font-src` — both features are blocked in production with no error shown to the user.  
**Where**: `vercel.json:14`  
**Why it matters**: Cloud sync shipped in commit #50 and is immediately broken in production for every user who configures it (fetch silently CSP-blocked by the browser). Inter font also fails to load, falling back to the OS sans-serif and breaking the visual design.  
**Effort**: S  
**Suggested fix**:
- Add `https://*.supabase.co` to `connect-src`
- Add `https://fonts.googleapis.com` to `style-src`; add `https://fonts.gstatic.com` to `font-src`
- Resulting value: `connect-src 'self' https://api.anthropic.com https://hooks.slack.com https://ntfy.sh https://readwise.io https://api.notion.com https://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com`

---

### 2. `_sbApplying` flag can get permanently stuck after storage error
**What**: In `sbSyncNow()`, `_sbApplying` is set to `true`, then `save()` is called, then set back to `false` — but there is no `finally` block, so a `QuotaExceededError` (which `save()` can throw) leaves `_sbApplying=true` for the rest of the session.  
**Where**: `index.html:8619–8623`  
**Why it matters**: Once stuck, `_sbScheduleSync()` skips every subsequent auto-save (it guards on `_sbApplying`), meaning the user's changes are never pushed to the cloud for the rest of the session — data loss on next device switch.  
**Effort**: S  
**Suggested fix**:
- Wrap lines 8619–8623 in a `try/finally` that resets `_sbApplying=false`
- Alternatively extract a helper `_withApplying(fn)` that guarantees cleanup

---

### 3. Push notification icon is a broken reference
**What**: `sw.js` references `./icons/icon-192.png` for push notification icon and badge — this path does not exist in the repository (icons are `icon.svg` and `icon-gl.svg`).  
**Where**: `sw.js:39–40`  
**Why it matters**: Every push notification (ntfy.sh reminders, daily digests) shows a broken image badge on iOS/Android. On some Android versions a missing icon causes the notification to not display at all.  
**Effort**: S  
**Suggested fix**:
- Either add an `icons/icon-192.png` to the repo (export from existing SVG) and add it to `STATIC` in sw.js
- Or change the reference to `'./icon.svg'` which already exists

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Givelink brand palette is wrong — blue instead of brand purple
**What**: `givelink.html` uses `--accent:#3b82f6` (Tailwind blue-500) throughout, while the Givelink brand palette specifies purple (`#5718CA`/`#6B3FA0`) as the primary brand colour. Every interactive element — buttons, active states, sprint progress bar, sidebar active indicator — renders blue.  
**Where**: `givelink.html:17–20`  
**Why it matters**: Givelink is a B2B SaaS product shown to nonprofit prospects and partners. Brand-inconsistent UI undermines credibility in demos and screenshots.  
**Effort**: S  
**Suggested fix**:
- Replace `--accent:#3b82f6` with `--accent:#5718CA`; add `--accent-light:#6B3FA0` for hover states
- Replace `--prog:#3b82f6` (Kanban in-progress badge) with the same
- Verify `--pr:#f472b6` (pink product-pillar badge) does not appear on any purple background (violates the no-pink-on-purple rule); swap to `--pr:#E353B6` or a neutral if it does

---

### 5. Force-sync button silently does nothing when sync is in flight
**What**: `sbSyncNow(force=true)` returns without any feedback when `_sbBusy` is `true`.  
**Where**: `index.html:8613–8614`  
**Why it matters**: User clicks "Sync Now", nothing happens, and they don't know if their data was saved. In a last-write-wins system this creates anxiety about data loss.  
**Effort**: S  
**Suggested fix**:
- Show a toast: `if(_sbBusy){toast('Sync in progress…');return;}`
- Alternatively queue the force-sync request and run it once `_sbBusy` clears

---

### 6. AI briefing body uses unescaped `innerHTML` with Claude response text
**What**: `_renderAIBriefing()` builds `lines` from raw Claude API response fields (`d.PRIORITY_1`, `d.PRIORITIES`, etc.) and sets `body.innerHTML = lines.join('<br><br>')` without escaping the content.  
**Where**: `index.html:9693–9701`  
**Why it matters**: The CSP `unsafe-inline` in `script-src` means injected `<script>` tags could execute. If the Anthropic API were ever MitM'd, a proxy API key service were used, or the model were jailbroken to return HTML, this would be a live XSS vector.  
**Effort**: S  
**Suggested fix**:
- Wrap each `d.*` field with `esc()` before inserting: `lines.push(\`🎯 <strong>\${esc(d.PRIORITY_1)}</strong>\`)`
- Same fix needed at `index.html:9695–9698` for all four fields

---

### 7. Weekly Review wizard has no "resume draft" prompt on return
**What**: `_wizSave()` stores a draft to `taskos_wiz_draft` (line 2953) but `renderReview()` never reads it to prompt the user on re-entry, so partially-completed 7-step reviews are silently abandoned.  
**Where**: `index.html:2878–2953` (renderWizPanel, _wizSave), `index.html:2808` (renderGoals entry point for review)  
**Why it matters**: The Weekly Review is a high-value ritual that builds the habit loop. Losing a draft mid-flow (phone call, tab close) means the user has to start over and will skip it next week.  
**Effort**: M  
**Suggested fix**:
- In `renderReview()`, check for `localStorage.getItem('taskos_wiz_draft')` and if the draft's `date` is today or within 24h, show a banner: "You have an unfinished review from [date]. Continue →"
- Add a "Discard draft" option next to it

---

### 8. Claude API key saved without format validation or visibility toggle
**What**: `saveSettings()` saves any string as `S.claudeKey` with no validation and the input field is `type="text"` (key is visible in cleartext on screen).  
**Where**: `index.html:8502–8506`  
**Why it matters**: A malformed key causes a `401 Invalid API key` toast on every AI feature, with no guidance. Visible key in settings is a security concern on shared/recorded screens.  
**Effort**: S  
**Suggested fix**:
- Validate the format: Anthropic keys start with `sk-ant-` — show an inline error if the trimmed value doesn't match `/^sk-ant-/` and the field isn't empty
- Change the input to `type="password"` and add a show/hide toggle button

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. Two parallel soft-delete implementations that can diverge
**What**: There is a generic `softDelete(collection, id, renderFn, label)` at line 2259 used by people/wins/bucket/wishlist/projects, and a completely separate `delTask()` + `_undoDelete()` at lines 3123–3141 for tasks. They use different state variables (`window._lastDeleted` vs `_undoTask`), different toast markup, and different restore logic.  
**Where**: `index.html:2259–2260`, `index.html:3123–3141`  
**Why it matters**: Any bugfix to one (e.g. animation, undo timing) must be applied twice. A subtle behavior difference already exists: `softDelete` splices at the original `idx`, while `delTask` pushes to the end on restore (line 3136).  
**Effort**: M  
**Suggested fix**:
- Migrate `delTask` to use `softDelete('tasks', id, ()=>{refresh();updIBadge();}, 'Task')`
- Remove `_undoTask`, `_undoTimer`, and `_undoDelete()`
- Add an optional `animEl` parameter to `softDelete` to handle the fade-out animation

---

### 10. All 38 render functions fail silently — no error boundary
**What**: `renderView(v)` dispatches to render functions via optional chaining `?.()` (line 2456). If any render function throws, the view goes blank with no feedback. The `try{refresh()}catch(e){}` after sync pulls (line 8624) swallows render errors entirely.  
**Where**: `index.html:2456–2457`, `index.html:8624`  
**Why it matters**: A single undefined read in a render function (e.g. accessing a property of a newly-added but null object) produces a completely blank view. Users have no way to report the error, and you have no visibility.  
**Effort**: M  
**Suggested fix**:
- Wrap the dispatch in `renderView`: `try{ ({...})[v]?.(); } catch(e){ document.getElementById('v-'+v).innerHTML = _empty('⚠️','Something went wrong', e.message, ''); console.error('renderView:'+v, e); }`
- Remove the silent `catch(e){}` from line 8624 and let the outer catch in `sbSyncNow` handle it

---

### 11. `_autoSnapshot` silently swallows all errors — Pace Engine gets stale data
**What**: The entire `_autoSnapshot()` function body at line 8643 is wrapped in `try{...}catch(e){}` with no error handling.  
**Where**: `index.html:8643–8658`  
**Why it matters**: The Pace Engine (commit #49) depends on `S.givelinkHistory` for trend lines. Silent failures (e.g. storage full, corrupted data) mean the snapshot was skipped but `taskos_autosnap` was already written as `today` (line 8656), so no retry happens — the gap in history is permanent.  
**Effort**: S  
**Suggested fix**:
- Move `localStorage.setItem('taskos_autosnap', today)` to after the successful `save()` call, not before
- Replace bare `catch(e){}` with `catch(e){ console.warn('autoSnapshot failed:', e); }` so at minimum the error is visible in DevTools

---

### 12. `renderView` dispatch is an unreadable 300-character single-line object literal
**What**: The entire view router (mapping 38 view names to render functions) is compressed to a single minified line 2456, making it impossible to diff, review, or extend without touching that line.  
**Where**: `index.html:2456`  
**Why it matters**: Every new view requires editing this one line — merge conflicts on every parallel feature. In the current velocity (4+ features per commit) this is a recurring pain point.  
**Effort**: S  
**Suggested fix**:
- Expand to a formatted multi-line const: `const VIEW_RENDERERS = { dashboard: renderDash, capture: renderCapture, ... };`
- Replace the dispatch with `VIEW_RENDERERS[v]?.();`

---

### 13. `deadcode` — `localStorage.getItem('taskos_api_key')` is a read-only orphan
**What**: `_fetchAIBriefing()` at line 9667 guards on `!S.claudeKey && !localStorage.getItem('taskos_api_key')`, implying a second storage path for the API key. But `saveSettings()` only ever writes to `S.claudeKey`. The `taskos_api_key` key is never written anywhere in the codebase.  
**Where**: `index.html:9667`, `index.html:8506`  
**Why it matters**: The guard passes for users who have `taskos_api_key` set (from some prior migration?), `callClaude()` is invoked, which then shows "Add Claude API key in Settings first" — a confusing error for a user who believes they already set it. The second key path is dead but could trigger a bad UX.  
**Effort**: S  
**Suggested fix**:
- Remove `&& !localStorage.getItem('taskos_api_key')` from line 9667
- If backward compatibility is needed, in `load()` check for `localStorage.getItem('taskos_api_key')` and migrate it into `S.claudeKey`

---

### 14. Monolithic 12,893-line `index.html` — no module, no tooling, no tests
**What**: The entire application — HTML structure, 500 lines of CSS, and ~12,000 lines of JavaScript — lives in one file. There are zero automated tests.  
**Where**: `index.html` (entire file)  
**Why it matters**: No tree-shaking, no LSP support (no type checking, no autocomplete), git history is a single-file diff that can't be reviewed section-by-section. A single syntax error anywhere breaks the entire app. Critical paths (save/load, Supabase sync, AI calls) are completely untested.  
**Effort**: L  
**Suggested fix**:
- As a low-risk first step: extract the `<style>` block into `styles.css` and the `<script>` block into `app.js` — no behavior change, immediate win for tooling
- Longer term: introduce a minimal build step (Vite/Rollup) and split into logical modules: `state.js`, `render.js`, `ai.js`, `sync.js`
- Add at minimum 3 unit tests: `esc()`, `_parseNLDate()`, `softDelete()` — these are pure functions with no DOM deps

---

## 💡 P3 — Nice to have

### 15. `theme-color` meta is hardcoded blue — doesn't follow dark/light toggle
**What**: `<meta name="theme-color" content="#58a6ff">` at line 6 is static; switching to light mode (which uses `--accent:#2563eb`) doesn't update the PWA chrome colour.  
**Where**: `index.html:6`  
**Why it matters**: On Android PWA, the task-switcher and status bar stay blue even in light mode. Minor polish issue.  
**Effort**: S  
**Suggested fix**:
- Add a `<meta name="theme-color" content="#0d1117" media="(prefers-color-scheme: dark)">` and a light-mode counterpart
- Or update it dynamically in `applyTheme()`: `document.querySelector('meta[name=theme-color]').content = isLight ? '#f5f5f0' : '#0d1117'`

---

### 16. Service worker doesn't cache Google Fonts — FOUC on repeat cold loads
**What**: `sw.js` only caches `HTML` and `STATIC` assets (manifests + SVGs). The Inter font loaded from `fonts.gstatic.com` is always a network request — on slow connections or offline, the app renders in system font until the font loads.  
**Where**: `sw.js:2–12`, `sw.js:57–73`  
**Why it matters**: Causes a visible flash of unstyled text (FOUC) on every cold load on a slow network. The Inter typeface is load-bearing for the UI aesthetic.  
**Effort**: S  
**Suggested fix**:
- Add a `FONTS` array with the fonts.googleapis.com stylesheet and fonts.gstatic.com woff2 URL
- Cache them in the `install` handler with `{mode: 'no-cors'}` for the opaque gstatic responses
- Or self-host Inter using `@fontsource/inter` (eliminates the CSP issue entirely)

---

### 17. Undo state for tasks is never expired — stale `_undoTask` persists across navigations
**What**: `_undoTask` is set in `delTask()` (line 3125) and only cleared on successful undo (line 3137). If the user dismisses the toast without clicking Undo, `_undoTask` holds a reference to the deleted task indefinitely.  
**Where**: `index.html:3122–3141`  
**Why it matters**: Low-priority memory leak. The stale reference also means a keyboard shortcut accidentally calling `_undoDelete()` much later would silently re-insert an old task. More importantly, the 4500ms toast timeout is not paired with any `_undoTask = null` cleanup.  
**Effort**: S  
**Suggested fix**:
- In `delTask()`, schedule `setTimeout(() => { _undoTask = null; }, 5000)` to clear the reference after the toast expires
- Mirror the same pattern in `softDelete()` for `window._lastDeleted`
