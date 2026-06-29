# Task OS — Improvement Plan

> Generated 2026-06-29. Based on full static analysis of `index.html` (12,893 lines), `sw.js`, `vercel.json`, and `givelink.html`.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP in `vercel.json` silently breaks Google Fonts and Supabase sync in production

**What**: Three CSP directives in `vercel.json` are too restrictive, blocking the Inter font and all Supabase API calls for every deployed user.

**Where**: `vercel.json:14`

**Why it matters**: Inter is the only font the app uses; without it, every screen falls back to the browser's default serif/sans-serif. Supabase sync — a headline feature — silently fails for every user who has configured it.

**Effort**: S

**Suggested fix**:
- Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src`
- Add `https://*.supabase.co` to `connect-src` (Supabase project URLs vary per user)
- Current broken line for reference: `"style-src 'self' 'unsafe-inline'; … font-src 'self';"`

```json
"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://api.anthropic.com https://*.supabase.co https://hooks.slack.com https://ntfy.sh https://readwise.io https://api.notion.com;"
```

---

### 2. `nav()` crashes the entire app when navigating to a view whose DOM element doesn't exist

**What**: `document.getElementById('v-'+v)` at line 2443 returns `null` for any unknown view name; the next line immediately calls `.classList.add()` on that null, throwing a `TypeError` that leaves the app frozen with a blank active-view area and no recovery path.

**Where**: `index.html:2443–2444`

**Why it matters**: Any stale `localStorage.getItem('taskos_lastview')` value, a typo in an `onclick` attribute, or a future nav call to a renamed view will hard-freeze the app. Recovery requires clearing `localStorage` manually.

**Effort**: S

**Suggested fix**:
- Add a null guard: `if(!_vEl){ console.warn('nav: unknown view', v); return; }`
- Alternatively reset to `'dashboard'` on null: `if(!_vEl){ nav('dashboard'); return; }`
- Wrap the entire `nav()` body in a `try/catch` with a `nav('dashboard')` fallback

---

### 3. `importData` applies a structurally invalid backup file without deep validation, permanently corrupting `S`

**What**: The import guard at line 2121 only checks `d.tasks` exists and is an array — it does not validate task object shapes. A backup where `d.tasks` is `["string1","string2"]` passes the guard, `Object.assign(S, d)` replaces all state, and `save()` immediately persists the corrupted data.

**Where**: `index.html:2115–2126`

**Why it matters**: One import of a wrong file (e.g. a CSV accidentally read as JSON) wipes the user's entire task database and goals. There's no undo path other than a previous manual export.

**Effort**: S

**Suggested fix**:
- Validate that at least the first few tasks are objects with a `title` string before committing
- Create a snapshot to `localStorage` under a recovery key before `Object.assign`, so the user can roll back
- Toast a count summary with an "Undo import" option using the existing `undoDelete` pattern

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Supabase sync silently discards render errors after a remote pull, leaving the user on stale UI

**What**: After applying remote state at line 8619–8622, the re-render call is wrapped in `try{refresh();}catch(e){}` — any render failure (e.g. malformed remote data) is swallowed, and the user sees a "Synced ⬇" status with unchanged UI.

**Where**: `index.html:8624`

**Why it matters**: The user believes their data was synced when actually the new data can't render. They may continue editing against stale state, then push that state back, winning against the remote they couldn't see.

**Effort**: S

**Suggested fix**:
- Replace the silent catch with `catch(e){ _sbSetStatus('⚠ Render failed after sync'); toast('⚠ Sync applied but view failed to refresh — reload the page'); }`
- Log `e` at minimum so the bug is diagnosable

---

### 5. Storage-full error gives no recovery action — user is stuck

**What**: When `localStorage` quota is exceeded (line 2101–2103), a toast fires: "⚠️ Storage full! Export your data before adding more." The toast auto-dismisses in 5 seconds. There is no inline "Export Now" button and no way to export while the quota is full (the export itself reads from `S`, not `localStorage`, so it actually would work).

**Where**: `index.html:2100–2104`

**Why it matters**: A user who hits the quota limit and dismisses the toast thinking "I'll do it later" has no obvious recovery path. They will try adding tasks, see nothing happen, assume a bug, and potentially abandon the app.

**Effort**: S

**Suggested fix**:
- In the `QuotaExceededError` handler, pass an HTML toast that includes an inline export link: `toast('⚠️ Storage full! <a href="#" onclick="exportData();return false;" style="color:var(--accent);font-weight:700;">Export now →</a>', 10000)`
- Increase the timeout to 10 s since this requires an action

---

### 6. Notion CORS error message references "instructions below" that don't exist in the UI

**What**: When Notion blocks the request due to CORS (line 8945), the toast reads `'Notion blocked browser access (CORS). See instructions below.'` There is no "below" — no element in the DOM contains Notion CORS setup instructions at the time the toast fires.

**Where**: `index.html:8944–8946`

**Why it matters**: A user who needs Notion sync hits this error, looks "below" for guidance, finds nothing, and concludes the feature is broken. This is a dead end for a non-trivial integration.

**Effort**: S

**Suggested fix**:
- Change the toast copy to be self-contained: `'Notion requires a server-side proxy to avoid CORS. Set up a Vercel function or use the browser extension method. See README for details.'`
- Or open a help modal with step-by-step Notion integration instructions directly from the error handler

---

### 7. 76+ interactive `<div>` elements are keyboard-inaccessible

**What**: The dashboard stat cards, task rows, habit checkboxes, and nav items are rendered as `<div onclick="...">` rather than `<button>` elements. Examples: lines 2489–2493 (dashboard stats), 3558 (habit checkboxes), throughout `renderBuckets`, `renderGoals`, `renderRelationships`. This makes the entire app unusable by keyboard and screen-reader users.

**Where**: `index.html:2489–2493`, `3558`, `4765`, and ~70 other locations

**Why it matters**: Fails WCAG 2.1 SC 2.1.1 (Keyboard). Any user relying on Tab/Enter navigation — or testing on a keyboard — cannot interact with the app's core features.

**Effort**: M

**Suggested fix**:
- Replace `<div onclick="...">` with `<button class="..." onclick="...">` for all interactive elements (grep pattern: `<div.*onclick=`)
- Reset button browser defaults in CSS (`button { background: none; border: none; cursor: pointer; text-align: left; }`) to preserve existing styles
- Tackle the highest-traffic views first: dashboard stats, task rows, habit checkboxes

---

### 8. All AI features (including complex planning) use `claude-haiku` — weakest model tier

**What**: `callClaude()` at line 4139 hardcodes `claude-haiku-4-5-20251001` for every AI call, including `aiSequenceTasks`, `aiWeeklyReview`, `aiGoalPlan`, and the decision-coaching flows — tasks that benefit significantly from a more capable model.

**Where**: `index.html:4139`

**Why it matters**: Users pay for Claude API access and expect quality AI coaching. Haiku is the fastest/cheapest tier but produces noticeably shallower planning output on complex prompts, reducing perceived value of the AI features.

**Effort**: S

**Suggested fix**:
- Accept an optional `model` parameter in `callClaude(prompt, maxTokens=1000, model='claude-haiku-4-5-20251001')`
- Pass `'claude-sonnet-4-6'` for high-stakes calls like `aiWeeklyReview`, `aiGoalPlan`, `renderMorningBriefing`
- Keep haiku for fast/cheap calls like badge text, quick suggestions, and auto-categorization

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. `renderView()` has no error boundary — one bad render silently freezes the active view

**What**: `renderView(v)` at line 2456 calls each render function directly with no `try/catch`. If any render function throws (malformed data, missing DOM element, undefined field), the error propagates to the caller but produces no user-visible feedback — the view just shows whatever partial HTML was written before the throw.

**Where**: `index.html:2456–2457`

**Why it matters**: Hard to debug in production; a bad data migration or new feature bug manifests as a mysteriously blank view with no error message.

**Effort**: S

**Suggested fix**:
```javascript
function renderView(v) {
  try {
    ({dashboard: renderDash, /* ... */})[v]?.();
  } catch(e) {
    document.getElementById('v-'+v).innerHTML =
      `<div class="empty" style="color:var(--red)">⚠️ Failed to render this view.<br>
       <small style="color:var(--muted)">${esc(e.message)}</small><br>
       <button class="btn bp sm" style="margin-top:12px" onclick="nav('dashboard')">← Dashboard</button></div>`;
    console.error('renderView error', v, e);
  }
}
```

---

### 10. `toast()` uses `innerHTML` — XSS vector if any user-owned string ever reaches a toast message

**What**: Line 2273: `el.innerHTML = msg`. Toast is currently only called with hardcoded strings or developer-controlled interpolations, so there's no active exploit. But several call sites interpolate task titles or error messages (e.g. `toast('✅ Imported '+d.tasks.length+' tasks!')`) — one future call with a user-controlled string would execute arbitrary HTML.

**Where**: `index.html:2273`

**Why it matters**: The `esc()` helper exists (line 9773) and is used correctly in render functions; this is an inconsistency that creates a latent XSS path as the codebase grows.

**Effort**: S

**Suggested fix**:
- Change toast to use `el.textContent = msg` by default
- Add a separate `toastHtml(msg, ms)` function for the intentional HTML cases (undo link, export link, error badges) to make the distinction explicit

---

### 11. Service worker push notification references a missing icon file

**What**: `sw.js:39` uses `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'` in `showNotification()`. The repository contains no `icons/` directory — only `icon.svg` and `icon-gl.svg` at the root.

**Where**: `sw.js:37–40`

**Why it matters**: Push notifications (via ntfy integration) will render with a broken icon on Android and fail silently on iOS. ntfy is listed as a configured integration so users who've enabled it hit this every time.

**Effort**: S

**Suggested fix**:
- Either generate/add a `icons/icon-192.png` (can be exported from `icon.svg`)
- Or update the references to use the existing SVG: `icon: './icon.svg', badge: './icon.svg'`

---

### 12. Six `catch(e){}` empty blocks swallow real errors across critical paths

**What**: Six distinct catch blocks have an empty body, silently discarding exceptions:
- `index.html:2433` — nav collapsed state persistence
- `index.html:3230` — haptic feedback
- `index.html:4516` — XP award after workflow
- `index.html:8657` — `_autoSnapshot` (see P3 #16)
- `index.html:9310` — ntfy push notification send
- `index.html:10054` — XP award after end-of-day log

**Where**: Listed above

**Why it matters**: Silent failures make the app impossible to debug; when users report "XP didn't go up" or "notifications aren't working," there's no logged evidence of what failed.

**Effort**: S

**Suggested fix**:
- At minimum, add `console.warn('[context]', e)` to each
- For `ntfy` (9310) and `_autoSnapshot` (8657), add a visible error state — these are user-facing features

---

### 13. `esc()` is defined at line 9773 but used in render functions starting from ~line 3049

**What**: `function esc(s){...}` at line 9773 is a function declaration (hoisted), so it works correctly at runtime. However, it creates a fragile dependency on JavaScript hoisting that breaks the moment someone refactors it to `const esc = s => ...` or moves it to a module.

**Where**: `index.html:9773` (definition), `index.html:3049` (first use)

**Why it matters**: This is a "works until it doesn't" pattern. When the file is eventually modularized (which is inevitable given its size), any file-order change will produce `ReferenceError: esc is not defined` in all render functions simultaneously.

**Effort**: S

**Suggested fix**:
- Move `esc()` to the UTILS section at line 2253, immediately before the other utility functions
- While there, add `escAttr()` for safe attribute interpolation (single-quote contexts aren't covered by the current `esc`)

---

### 14. `callClaude` hardcodes `anthropic-version: 2023-06-01` — will silently break when deprecated

**What**: Line 4138 sends `'anthropic-version': '2023-06-01'` on every Claude API request. Anthropic periodically deprecates old API versions; when `2023-06-01` is retired, all AI calls will return 400/404 errors with no indication to users of what changed.

**Where**: `index.html:4138`

**Why it matters**: All AI features will break simultaneously with no code change. Users will see generic "AI error" messages and have no way to know the fix is a version header bump.

**Effort**: S

**Suggested fix**:
- Bump to the current stable version (`2023-06-01` is still valid but aging; use `2023-06-01` or whatever is listed at the time as current in the Anthropic docs)
- Extract to a constant at the top of the AI section: `const CLAUDE_API_VERSION = '2023-06-01';`
- Consider adding the version to the Settings panel so it can be updated without a code deploy

---

### 15. `_autoSnapshot` silently fails, causing the Givelink Pace Engine to show flat/missing trend charts

**What**: The `_autoSnapshot` function (lines 8643–8657) captures a daily snapshot of Givelink metrics to power the historical trend charts. Its entire body is wrapped in `try{...}catch(e){}`. Any error in the snapshot logic (missing property, date parsing failure) is silently discarded, so the history array stops growing with no feedback.

**Where**: `index.html:8643–8657`

**Why it matters**: The Pace Engine and "runway" charts are key to Givelink's sprint board value proposition. A user whose snapshots silently stopped accumulating 2 weeks ago will see a flat chart and assume the feature is broken.

**Effort**: S

**Suggested fix**:
- Replace the catch with `catch(e){ console.warn('_autoSnapshot failed', e); }` at minimum
- Surface a small warning badge in the Givelink dashboard if no snapshot has been taken in >1 day

---

## 💡 P3 — Nice to have

### 16. Magic numbers scattered throughout should be named constants

**What**: Business-logic numbers are scattered as literals: `25*60` (Pomodoro duration), `21` (habit streak threshold), `7*864e5` (one week in ms), `30*864e5` (one month in ms), `1000`/`2500`/`5000` (XP level thresholds). These appear in at least 12 different locations.

**Where**: `index.html:2167–2168` (week/month), `3230` (haptic), `4139` (max tokens), and ~9 other locations

**Why it matters**: When someone wants to change the Pomodoro to 20 minutes or adjust the streak window, they have to hunt through 12,893 lines of code rather than changing one constant.

**Effort**: M

**Suggested fix**:
- Add a `const CONFIG = { POMODORO_SEC: 25*60, HABIT_STREAK_DAYS: 21, WEEK_MS: 7*864e5, MONTH_MS: 30*864e5 }` block immediately after the existing `const S = ...` state object
- Replace all magic-number sites with `CONFIG.XXX`

---

### 17. Google Fonts are not cached by the service worker — offline mode shows fallback fonts

**What**: `sw.js` handles external requests with network-only (`fetch(e.request).catch(() => new Response('', {status: 503}))`). Google Fonts CSS and font files are external, so they are never cached. After the first load, going offline (common for a PWA) renders the app in the browser's fallback font.

**Where**: `sw.js:90–93`

**Why it matters**: Task OS is installable as a PWA and marketed for offline use. The visual regression from Inter → system font is jarring and looks like a broken app to mobile users who go offline on the train.

**Effort**: S

**Suggested fix**:
- Add Google Fonts URLs to `STATIC` pre-cache list in `sw.js`, or
- Use a cache-first strategy for `fonts.googleapis.com` and `fonts.gstatic.com` requests specifically inside the fetch handler

---

### 18. `uid()` prefix is timestamp-based — rapid sequential calls produce IDs with identical prefixes

**What**: `uid()` at line 2254 returns `Date.now().toString(36) + Math.random().toString(36).slice(2)`. In practice this is fine for single-user manual task entry. However, the bulk seed functions (`seed()`, `seedGoals()`) call `uid()` in a tight loop, meaning many IDs share the same `Date.now()` prefix and differ only in the random suffix.

**Where**: `index.html:2254`

**Why it matters**: Low-probability collision risk during bulk import. Not a current user-facing bug, but worth a note before any import-from-CSV bulk creation feature is added.

**Effort**: S

**Suggested fix**:
- Use a monotonic counter suffix: `let _uidSeq=0; function uid(){ return Date.now().toString(36)+(_uidSeq++).toString(36)+Math.random().toString(36).slice(2); }`

---

### 19. CSP `img-src 'self' data:` blocks external avatar/OG images if ever added

**What**: `vercel.json:14` restricts `img-src` to `'self'` and `data:`. Any future feature that shows external images (user avatars, book covers from Readwise, Notion page thumbnails) will be blocked by the CSP with no visible error — images just silently fail to load.

**Where**: `vercel.json:14`

**Why it matters**: Not a current bug, but Readwise already syncs book data with potential cover art, and any social/avatar feature would hit this immediately.

**Effort**: S

**Suggested fix**:
- Add `https:` to `img-src` to allow any HTTPS image source, which is the standard permissive setting for apps that render user-provided content: `img-src 'self' data: https:`

---

### 20. No visual loading state during initial app boot — blank white flash before JS executes

**What**: `index.html` has no `<noscript>` fallback and no skeleton/spinner shown before the JS block executes at line 2029. On slow connections or low-end devices, the user sees a blank page for 1–3 seconds.

**Where**: `index.html:1–2028` (the pre-script HTML)

**Why it matters**: A blank first-load screen looks like a crash. This is especially bad for the PWA install flow where users are evaluating the app for the first time.

**Effort**: S

**Suggested fix**:
- Add a full-screen skeleton loader in the `<body>` before the main app markup: a dark background with a centered spinner and "Loading Task OS…" that the JS removes on first `renderDash()` call
- Takes ~10 lines of inline CSS + HTML at the top of `<body>`
