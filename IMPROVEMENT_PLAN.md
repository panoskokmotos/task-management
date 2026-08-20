# Arete / Givelink — Improvement Plan

_Generated 2026-08-20 from a full audit of `index.html`, `landing.html`, `givelink.html`, `sw.js`, `api/claude.js`, `supabase-setup.sql`._

Scope notes
- The app is one 14,924-line `index.html` (inline CSS + ~11k lines of JS), plus a landing page, a Givelink sub-view, a Vercel serverless Claude proxy, and a service worker.
- No commits in the last 7 days, so this pass is a full-repo triage, not a delta.
- Brand rule from the ask (purple `#6B3FA0/#5718CA`, pink `#C2185B/#E353B6`, no pink on purple) does **not** match what ships: actual tokens are `--brand:#5a49e0`, `--brand2:#8b5ce6`. Reconciled as item **P1 #13** below — one of these has to move.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `authLogout()` wipes local data before pending sync flushes → silent data loss
- **Where**: `index.html:10116-10121`
- **Why it matters**: If a user signs out (or a session expires) while `_sbPending===true` or the network is down, `localStorage.removeItem('taskos')` runs at :10120 without awaiting a final `sbPush()`. Every edit since the last successful push is gone with no recovery.
- **Effort**: S
- **Fix**:
  - Await `sbSyncNow(true)` (push-only) before clearing local storage; only clear on success.
  - On push failure, keep the local blob and surface a persistent "sign-out held — unsynced changes" state.

### 2. `sbSyncNow()` shallow-merges remote and clobbers offline edits
- **Where**: `index.html:10418-10422`
- **Why it matters**: When a second device wrote more recently, the `remote.ms > localMs` branch does `S = {...S, ...remote.data}` — a shallow spread that fully replaces `S.tasks/goals/reviews/…` with the remote snapshot. Anything the user edited while offline vanishes with no toast.
- **Effort**: M
- **Fix**:
  - Before adopting remote, check `_sbPending`; if true, push-first or prompt.
  - Merge per-collection by `id` and `_updatedAt`, not by whole-object spread.

### 3. Multi-device concurrent edits silently overwrite each other
- **Where**: `index.html:10409` (`sbPush` — full-blob upsert with `Prefer: resolution=merge-duplicates`, no ETag/If-Match)
- **Why it matters**: Two devices editing the same day → whichever pushes last wins the entire state blob. There is no per-field merge, no conflict UI. Works today only because one user is on one device; the day a second device is used mid-flight, hours of work vanish.
- **Effort**: M (short-term), L (long-term)
- **Fix**:
  - Short: fetch remote `updated_at` immediately before push; if `remote.ms > lastPulledMs`, run the pull-merge from item #2, then push.
  - Long: split the single `app_state` row into per-record rows (one per task/goal) so Supabase can upsert with field-level merges under RLS.

### 4. Debounced cloud sync is never flushed on tab close
- **Where**: `index.html:10606-10616`
- **Why it matters**: A user edits a task then closes the tab (or backgrounds the PWA) inside the 2.5s debounce → the pending `setTimeout` is dropped on unload. The cloud row stays stale; the edit only survives on that one device.
- **Effort**: S
- **Fix**:
  - On `visibilitychange === 'hidden'` and `pagehide`, cancel the debounce and call `sbPush()` immediately.
  - Or use `navigator.sendBeacon` against the Supabase REST endpoint as a fallback path.

### 5. "Restore from backup" silently overwrites everything with no confirm
- **Where**: `index.html:2631-2643` (called from sync menu at :9995)
- **Why it matters**: `Object.assign(S, d)` replaces goals/wheel/reviews/finance instantly and inherits `S._updatedAt` from the imported file. On the next sync tick either the cloud is newer and overwrites the restore, or the restore is older and gets replaced by cloud — the imported data is lost either way, with no dialog and no undo.
- **Effort**: S
- **Fix**:
  - Show a confirm dialog naming what's about to be replaced (tasks/goals/reviews).
  - After applying, force `S._updatedAt = Date.now()` and push-first before allowing pull.

### 6. Service-worker "Reload" banner fires on every brand-new visitor's first load
- **Where**: `index.html:10692-10704` combined with `sw.js:26,35`
- **Why it matters**: `sw.js` calls `skipWaiting()` + `clients.claim()`, so the very first install triggers both `updatefound → activated` and `controllerchange`. Both handlers unconditionally call `showUpdateBanner()`. New users see a red "A new version is ready — Reload" banner on their first ever page load — the opposite of the "calm start" the onboarding promises.
- **Effort**: S
- **Fix**:
  - Only show the banner if `navigator.serviceWorker.controller` existed **before** this event (i.e. it's an update, not a first install).
  - Wait for `reg.waiting` on the update path before showing the CTA.

### 7. Landing router traps returning users — marketing pages become unreachable
- **Where**: `landing.html:37-40`
- **Why it matters**: Anyone who has ever logged in (or picked "guest") is auto-redirected to `/index.html` the moment they hit `/`. They can't get back to the pricing page or the FAQ, and they can't show a friend the site from their own machine. Directly hurts share / referral (the whole PLG bet from #76-#83).
- **Effort**: S
- **Fix**:
  - Only auto-redirect when the URL carries an auth hash (magic link / OAuth callback).
  - Otherwise render the landing with a "Continue to app →" button in the nav.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 8. XSS surface across ~10 render paths (review wizard, task titles, AI output)
- **Where**: Review textareas at `index.html:9041-9048, 9075-9078`; `value="${…}"` unescaped at `:9049, 9077, 9038`; task-title interpolations at `:2543, 3594, 3603, 3844`; AI briefing/triage at `:11698, 11704, 11766`; Readwise title at `:10866`; plus `esc()` at `:11776` never escapes `'`, breaking any `onclick="…('${esc(x)}')"` builder (e.g. `:10886, 12289, 12394, 12492`).
- **Why it matters**: Anyone typing `</textarea><img src=x onerror=…>` in a review (or importing a backup that contains it, or getting an AI response that echoes HTML) gets script under the app's origin — which can read `taskos_sb_access`, the stored Claude key at `S.claudeKey`, and the Notion/Readwise tokens. Also today: any Readwise book title with a `'` (e.g. "It's Not Personal") makes the "Add to Library" button silently throw when clicked.
- **Effort**: M
- **Fix**:
  - Extend `esc()` to also escape `'` and `` ` ``; wrap every `${…}` in interpolated HTML with it.
  - Prefer `textContent =` / `dataset` + `addEventListener` over building `onclick="…"` strings in HTML.
  - Treat all AI and third-party API strings as untrusted; escape at the boundary.

### 9. Hardcoded "Givelink" surfaces shipped to every Arete user
- **Where**: Nav item `index.html:9569`; dashboard widget `_renderGivelinkToday()` at `:11917-11945`; category constant `CATS.givelink` at `:2503`; full "Givelink OS" view at `:14310-14324`.
- **Why it matters**: After the Arete rebrand (commit `0c1d32d`), every new signup still lands on the app and finds a purple "Givelink" entry in the sidebar's Work group, plus a "Givelink Today" widget on their dashboard, plus a `🟣 Givelink` category label. Broadcasts "this app is not really for you" on the first screen.
- **Effort**: S
- **Fix**:
  - Gate the nav item, widget, and view behind `S._founderMode` / `hostedMode` owner-only.
  - Rename `CATS.givelink` to a generic slot ("Focus Project", user-configurable) and migrate seed data + AI prompts.

### 10. Onboarding tour promises AI features the user often can't use
- **Where**: Tour step 3 at `index.html:9455-9459` vs. AI gate at `:5008` and `:5047`.
- **Why it matters**: The tour tells new users to hit "Plan my day" and "Triage Inbox". If `APP_CONFIG.aiProxy` isn't set and `S.claudeKey` is empty, both features immediately toast "Add Claude API key in Settings first" and do nothing. Right at the magic-moment step, the app tells the new user to go configure something.
- **Effort**: S
- **Fix**:
  - Add a "Optional — connect AI" tour step with a direct button that opens the Settings AI field.
  - When AI is not configured, gray out the CTAs in Today with a tooltip instead of tapping-then-failing.

### 11. AI failures show a 3-second toast and leave the calling surface empty
- **Where**: `callClaude` catch at `index.html:5033`; callers `aiAutoTriage :5063`, `aiPlanDay`, morning briefing.
- **Why it matters**: A user who blinks past the toast sees nothing happen after tapping "Plan my day" — the flagship feature feels broken and they don't know why or that they can retry.
- **Effort**: S
- **Fix**:
  - Render an inline error slot in each AI surface with the message and a "Retry" button.
  - `posthog.capture('ai_error', {surface, status})` so drop-off becomes measurable.

### 12. AI prompts hardcode "Panos / Givelink" identity for every user
- **Where**: 13+ prompt strings across `index.html:9806, 11133, 12186, 13289, 13533, 13542, 13551, 13612, 13622, 13631, 13642, 13651, 13657, 13735` — all with the literal fallback `Panos — Greek founder in his 20s building Givelink (nonprofit fundraising SaaS), targeting financial freedom and a move to San Francisco.`
- **Why it matters**: Any Arete user who taps an AI feature without filling "About Me" gets Claude responding as if they were the founder. Immediate, unrecoverable trust break on the app's most-marketed feature.
- **Effort**: S
- **Fix**:
  - Change every fallback to `''` (or "a busy person managing tasks and goals").
  - Prompt users to fill About Me on first AI use.

### 13. Brand palette in code doesn't match the brand rules
- **Where**: Actual tokens `--brand:#5a49e0`, `--brand2:#8b5ce6` (`index.html:47,55`); `manifest.json:9`. The stated palette (`#6B3FA0/#5718CA/#C2185B/#E353B6`) has **zero** matches across the repo. Also six drifting pink shades: `#ff8fab :710`, `#f783ac :8649, :9847`, `#ec4899 :12193`, `#f472b6 :13211` (+ `givelink.html:18`), `#d1568f :58`, `#f79ac0 :50`.
- **Why it matters**: Marketing decks and the shipped product show different violets → weaker brand memory across surfaces. The pink drift is what makes the "no pink on purple" rule impossible to enforce today.
- **Effort**: S
- **Fix**:
  - Pick one source of truth. If the stated palette is canon, global find-replace `#5a49e0`/`#8b5ce6` and derive new gradient/glow rgba pairs.
  - Collapse the six pinks to `--pink` and `--pink-2` tokens; delete legacy hex.

### 14. Primary accent buttons fail WCAG AA contrast
- **Where**: `index.html:426` (`.rel-avatar`, black on accent purple ~3.35:1) and `:14030` (`#install-btn`, same combo on the PWA install CTA).
- **Why it matters**: Relationships initials are hard to read for everyone; the "Add to Home Screen" install button — the single highest-value CTA for a PWA — fails contrast and loses installs.
- **Effort**: S
- **Fix**:
  - Change both to `color:#fff` (~6.4:1) — matches the `body.light .bp{color:#fff}` fix already applied to other purple buttons at `:61`.

### 15. Auth inputs have no labels; "Create an account" toggle isn't keyboard-accessible
- **Where**: `index.html:877-878` (`#ag-email`, `#ag-pass` placeholder-only, no label, no `aria-label`); `:883` (`<a onclick="_agToggleMode()">` with no `href`, no `role="button"`, no `tabindex`). Same missing-label pattern on `#capi :1229`, `#srch :1285`, `#gsearch-input :14830`, `#qc-input :14036`.
- **Why it matters**: Sign-in is the highest-value screen in the app; keyboard/screen-reader users can neither identify the fields nor tab to the sign-up toggle.
- **Effort**: S
- **Fix**:
  - Add `aria-label="Email"` / `aria-label="Password"` (or visually-hidden `<label for>`) to each input above.
  - Replace the `<a>` toggle with `<button type="button" class="ag-textlink-btn">`.

### 16. Weekly calendar forces 560px min-width on every phone
- **Where**: `index.html:14435` (`<div id="cal-week-grid" style="min-width:560px;">` inside an `overflow-x:auto` wrapper).
- **Why it matters**: Every phone viewport (390 / 375 / 360px) is forced to horizontally scroll the calendar. Feels broken on the ~50% mobile share.
- **Effort**: S
- **Fix**:
  - Under `@media (max-width: 640px)`, switch `#cal-week-grid` to a single-column stacked day list (`grid-template-columns:1fr`).

### 17. Touch users can't snooze / star / delete from a task row
- **Where**: `index.html:641-646` — `.tc-actions{opacity:0}` reveals only on `:hover`, then `@media(hover:none)` hides them entirely. `.tc-act` tap targets are 26×26 (< 44×44).
- **Why it matters**: The single most-used surface in the app has zero visible row actions on touch. Users must open the drawer or discover the swipe gesture — a large discoverability tax.
- **Effort**: S
- **Fix**:
  - On touch, render a persistent trailing "⋯" button (44px) that opens a bottom-sheet with Snooze / Star / Delete.
  - Bump `.tc-act` to 36×36 and the row action strip to 44px min-height.

### 18. Push-notification icon path points at a non-existent folder
- **Where**: `index.html:11289`, `sw.js:46-47` reference `./icons/icon-192.png`; the real file is `./icon-192.png` (no `icons/` directory exists).
- **Why it matters**: Every reminder and web-push notification renders without an app icon; on Android some deliveries may fail entirely. Undermines the "installed native-app feel" the PWA path depends on.
- **Effort**: S
- **Fix**:
  - Change both paths to `./icon-192.png` (and `./icon-512.png` for the large badge).

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 19. 76 empty `catch (e) {}` blocks silently swallow production errors
- **Where**: `index.html` — 76 occurrences; representative sites `:2587, 2949, 3031, 3868, 3971, 4443, 8066, 10131 (_afterAuth), 10306, 10382, 10424, 10453, 10589, 10633, 10681`, plus the whole startup chain `:13764-13776`.
- **Why it matters**: Real production errors (auth-refresh 401s, `localStorage` quota, corrupt cloud JSON, `navigator.share` unsupported) vanish with no console line and no telemetry. `_afterAuth :10131` is the worst — a login can silently drop into local-only mode and the next push overwrites the cloud with stale data.
- **Effort**: S–M
- **Fix**:
  - Add one central `_swallow(label, e)` that pushes into an in-memory ring buffer and (when enabled) `posthog.capture('error', {label, msg:e.message})`.
  - Replace every `catch(e){}` with `catch(e){_swallow('scope',e)}`. Start with `_afterAuth`, `save()`, and the sync path.

### 20. Task object literal duplicated in 15 places and already drifting
- **Where**: `index.html:3205, 3822, 3828, 4241, 4347, 5528, 6934, 7506, 7710, 10269, 10332, 10445, 10805, 11038, 11475, 11943, 14279`
- **Why it matters**: Each site re-lists ~20 fields; several have already dropped `depth`, `checklist`, `read`, `blockedBy`, `linkedPeople`, `ifThen`, `bundledWith`. Missing fields cause "invisible" tasks (no `read` → no unread badge) and null-guard bugs downstream. Adding a new task field is a 15-place edit.
- **Effort**: S
- **Fix**:
  - One `_newTask(partial)` factory that spreads `{...TASK_DEFAULTS, ...partial, id:uid(), createdAt:new Date().toISOString()}`; replace every `S.tasks.push({id:uid(), …})`.
  - Add `_migrateTask(t)` inside `load()` to back-fill defaults on older rows.
