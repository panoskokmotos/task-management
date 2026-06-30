# Givelink / Task OS — Improvement Plan

**Scope note:** This repo is a single-user "Life OS" personal dashboard (`index.html`, 12,893 lines) with a "Givelink" sub-section (`givelink.html`, a personal startup-idea tracker, not a live donation/checkout product). There is no Stripe integration, no checkout flow, no PostHog analytics wiring (the only "PostHog" hit in the codebase is a personal to-do item, "PostHog sticker check"), and no defined purple/pink brand palette anywhere in the CSS — all checked by grep before writing this plan. Those parts of the original brief don't apply to what's actually here, so this plan is grounded in the real codebase instead of guessed findings.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Both "Export" buttons leak the plaintext Claude API key
- **What**: Clicking either backup button dumps the entire app state — including the live Anthropic API key — into a downloadable JSON file.
- **Where**: `index.html:2108-2113` (`exportData`, button at `index.html:1548`) and `index.html:2156-2162` (`exportFullJSON`, button at `index.html:1552`); the key lives at `S.claudeKey` (`index.html:2036`).
- **Why it matters**: Backing up data is the one action every user of this app will eventually do (the README/commits emphasize "auto-snapshots" and offline-first backup). Any file shared to a cloud drive, sent for help, or attached to a bug report hands over a live API key that can run up the owner's Anthropic bill.
- **Effort**: S
- **Suggested fix**:
  - In both export functions, serialize `{...S, claudeKey: undefined}` (or an explicit denylist of secret fields) instead of raw `S`.
  - Add a one-line warning under the export buttons noting the file excludes API keys.

### 2. Claude API key is held in localStorage and sent straight from the browser
- **What**: The Anthropic key is read from `localStorage`/`S.claudeKey` and sent client-side with `anthropic-dangerous-direct-browser-access: true`.
- **Where**: `index.html:4133-4149` (the `callClaude`-style fetch wrapper), key persisted via `S` at `index.html:2036`, set in `saveSettings()` at `index.html:8505-8506`.
- **Why it matters**: Any XSS, malicious browser extension, or shared/public device exposes the key directly — the header name itself ("dangerous-direct-browser-access") is Anthropic's own warning label for this pattern.
- **Effort**: M
- **Suggested fix**:
  - Since the app already deploys on Vercel (`vercel.json`), add a small serverless/Edge Function that holds the key server-side and proxies `/v1/messages` calls.
  - Until then, at minimum scope the CSP/export fix in item #1 so the key can't leave the device via backups.

### 3. App can crash on load for returning users after any view is renamed or removed
- **What**: On boot, the last-viewed tab is read from `localStorage` and passed straight into `nav()`, which does `document.getElementById('v-'+v).classList.add(...)` with no null check.
- **Where**: `index.html:8678-8679` (init) calling into `index.html:2435-2440` (`nav`).
- **Why it matters**: This project renames/removes views frequently (50+ feature commits in the last weeks alone, e.g. dashboard restructuring in #46/#47). Any returning user whose stored `taskos_lastview` points to a view that no longer exists hits an uncaught `TypeError` on the very first line of `nav()`, leaving them on a stale, unhydrated dashboard with no error message — looks like the app silently broke.
- **Effort**: S
- **Suggested fix**:
  - In `nav(v)`, guard: `const _vEl=document.getElementById('v-'+v); if(!_vEl){v='dashboard';/* re-resolve */}` before touching `classList`.
  - Clear/ignore `taskos_lastview` if it doesn't resolve to a known view.

### 4. Editing a task that no longer exists silently discards the edit
- **What**: `saveTask()` looks up the task by id via `findIndex`; if it's not found (`-1`), the edit is written to a phantom `-1` property instead of any real task, and the user still sees a normal "saved" close with no error.
- **Where**: `index.html:3115` — `const i=S.tasks.findIndex(t=>t.id===editT);S.tasks[i]={...S.tasks[i],...d};`
- **Why it matters**: Reachable any time the task being edited is deleted (or undone) in another tab/device while the edit modal is still open — a real scenario given this app supports Supabase multi-device sync. The user believes their edit saved; it's gone.
- **Effort**: S
- **Suggested fix**: `if(i<0){toast('That task no longer exists');closeM('tm');refresh();return;}` before the assignment.

---

## ⚡ P1 — High ROI (UX friction blocking daily use)

### 5. The entire sidebar is unreachable by keyboard or screen reader
- **What**: All navigation items and section-collapse toggles are plain `<div>`/`<span>` with `onclick` only — no `tabindex`, `role`, or key handler.
- **Where**: `index.html:538-590` (`.ni` nav items, e.g. line 538), `index.html:545` (`.ns` group toggle, `_toggleNsGroup`).
- **Why it matters**: This is a single-page app where the sidebar is the only way to reach any feature (tasks, goals, health, finance, etc.). Keyboard-only and screen-reader users currently cannot navigate past the dashboard at all.
- **Effort**: S
- **Suggested fix**:
  - Add `tabindex="0" role="button"` to `.ni` and `.ns`, plus one shared `onkeydown` handler (Enter/Space → trigger click) applied via a delegated listener on the sidebar container.

### 6. Mobile sidebar overlay has no keyboard dismiss path
- **What**: The mobile sidebar backdrop is a bare `<div onclick="toggleSB()">` with no keyboard equivalent.
- **Where**: `index.html:525` (`.s-ov`). The global Escape handler at `index.html:3644` only closes modals/command palette, not the sidebar.
- **Why it matters**: On mobile-with-keyboard or assistive tech, opening the sidebar can leave the user stuck unable to close it.
- **Effort**: S
- **Suggested fix**: Extend the Escape handler at `index.html:3644` to also close `.sidebar.open` + `#s-ov`.

### 7. Core daily-interaction checkboxes are below comfortable tap size
- **What**: The checkboxes used for the app's most frequent actions are smaller than the ~44px touch-target guideline: task `.ck` 26px (`index.html:100`), habit `.habit-ck` 22px (`index.html:331`), bucket-list `.bl-check` 24px (`index.html:468`).
- **Where**: `index.html:100,331,468`
- **Why it matters**: Checking off a task/habit is the single most repeated action in the app; mis-taps on mobile cause wrong-item completions and daily friction.
- **Effort**: S
- **Suggested fix**: Keep the visual checkbox size but expand the clickable hit-area via padding or a transparent `::before` pseudo-element to ~44×44px.

### 8. Three divergent modal-close implementations
- **What**: There are three separate code paths for dismissing a dialog — `closeM()` (`index.html:3391`), `closeModal()` (`index.html:10584`), and a third inline handler inside the global Escape listener that targets `.mo` elements directly (`index.html:3644`) — each with different focus-restoration behavior.
- **Where**: `index.html:3391, 10584, 3644`
- **Why it matters**: Recent commits (#51, #52) already had to patch backdrop-close and modal-open-guard bugs — a sign this surface keeps regressing because there's no single source of truth for "how a dialog closes." New dialogs are likely to inherit whichever pattern was copy-pasted, perpetuating inconsistent Escape/backdrop/focus behavior.
- **Effort**: M
- **Suggested fix**: Pick one close function, route all modal markup through it, and delete the other two.

### 9. `givelink.html` duplicates index.html's design system in a second file
- **What**: `givelink.html` (1,755 lines) re-implements its own sidebar, card, badge, and modal CSS that closely mirrors `index.html`'s, rather than sharing it.
- **Where**: `givelink.html:13-150` vs `index.html:16-518`
- **Why it matters**: Any visual fix or accessibility fix (including items #5-#8 above) has to be applied twice or it silently drifts out of sync between the two pages.
- **Effort**: M
- **Suggested fix**: Extract the shared design tokens/components into a `shared.css` both pages `<link>`, even before any larger refactor.

### 10. Reminder delivery failures are invisible to the user
- **What**: `postToNtfy(r)` is called fire-and-forget inside the reminder-firing loop with no `await`/`.catch`.
- **Where**: `index.html:9289` (reminder dispatch loop, function defined around `index.html:9270-9300`)
- **Why it matters**: If the ntfy.sh push fails (network blip, bad topic), the reminder silently never arrives and the user has no indication anything went wrong — defeats the purpose of a reminder system.
- **Effort**: S
- **Suggested fix**: `postToNtfy(r).catch(()=>toast('⚠️ Reminder push failed — check ntfy topic'))`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `index.html` is a 12,893-line monolith (CSS + ~9,700 lines of JS + markup, one file)
- **Where**: `index.html` entire file (`<style>` 16-518, `<script>` 2029-11759), 625 function definitions.
- **Why it matters**: No module boundaries, no build step; any new contributor must load the whole file mentally to make a safe change, and diffs/PRs are unreviewable at a glance.
- **Effort**: L
- **Suggested fix**: Incrementally extract self-contained domains (e.g. health, finance, AGI-prep) into separate `<script type="module">` files first — doesn't require a bundler to start paying off.

### 12. One global `S` object holds ~80 unrelated top-level keys
- **What**: `S` mixes tasks, goals, finance, biomarkers, AGI-prep, Givelink metrics, social profiles, gamification, decision logs, etc. in a single mutable object.
- **Where**: `index.html:2036`
- **Why it matters**: No separation of concerns — a bug in one domain's mutation logic can corrupt unrelated state, and `JSON.stringify(S)` (used everywhere from save() to exports) keeps growing unbounded as features are added.
- **Effort**: L
- **Suggested fix**: Not a rewrite — start by namespacing new feature areas under sub-objects (`S.finance.*` already exists in spirit; formalize it) instead of more flat top-level keys.

### 13. localStorage read/parse/catch boilerplate is duplicated 6+ times
- **What**: The same `try{JSON.parse(localStorage.getItem(k)||'{}')...}catch(e){}` shape is hand-written repeatedly instead of a shared helper.
- **Where**: `index.html:2107` (`load`), `2433` (`_toggleNsGroup`), `2501` & `2877` (review wizard draft, duplicated), `8675` (nav init), `9176` (checkbox-state Set).
- **Why it matters**: Inconsistent fallback values and error handling across call sites; any future change (e.g. handling quota-exceeded) means hunting down 6+ copies.
- **Effort**: S
- **Suggested fix**: Add `function storageGetJSON(key, fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch(e){return fallback;}}` and migrate call sites.

### 14. 748 inline `onclick=` handlers, zero event delegation
- **Where**: throughout `index.html` (748 occurrences).
- **Why it matters**: Every interactive element re-derives its handler string at render time via template literals; a stray quote/HTML-escaping bug in dynamic content (task titles, notes) can break the handler attribute silently. It also blocks any future CSP tightening (`script-src` currently needs `'unsafe-inline'` in `vercel.json:12` specifically because of this pattern).
- **Effort**: L
- **Suggested fix**: No big-bang rewrite needed — for new code going forward, prefer `data-action`/`data-id` attributes + one delegated listener per view, and tighten CSP once coverage is high enough.

### 15. Zero automated tests anywhere in the repo
- **Where**: repo-wide (`find . -iname "*test*"` returns nothing).
- **Why it matters**: The riskiest logic in the app — `load()`/`save()` state merge (`index.html:2107` area), the Claude API wrapper (`index.html:4133-4149`), and the Supabase last-write-wins sync (`index.html:8551-8609`) — all run with zero regression coverage, exactly the kind of code that's broken and re-fixed across the "Fix 3/4 bugs" commits already in the git log (#51, #54).
- **Effort**: M
- **Suggested fix**: Start with a handful of `vitest`/plain-Node unit tests for `load()`'s merge behavior and the export functions (verifying secrets are stripped, per item #1) — highest risk-to-effort ratio.

### 16. `supabase-setup.sql` has no schema for the ~80-key state it's syncing
- **What**: The SQL schema defines a single generic JSONB blob table (`public.app_state`), with no per-domain structure or versioning, while `index.html` syncs the entire 80-key `S` object into it.
- **Where**: `supabase-setup.sql` (53 lines) vs `S` definition at `index.html:2036`.
- **Why it matters**: Acceptable for now as a deliberate "schema-free" tradeoff for a single-user app, but it means there's no migration story if the sync ever needs partial/selective writes or conflict resolution beyond last-write-wins.
- **Effort**: S (to document the tradeoff explicitly in the SQL file's comments so it's a choice, not an oversight)

---

## 💡 P3 — Nice to have

### 17. A few views render nothing when their data is empty, instead of a guided empty state
- **What**: `renderFocusRecs()` and `renderFocusHabits()` produce blank output when there's no data, unlike `renderHabits()` (`index.html:4750`) which already has a proper empty state to copy from.
- **Where**: `index.html` around `3549-3583`
- **Why it matters**: New users (or anyone clearing data) see blank cards with no hint of what to do next.
- **Effort**: S
- **Suggested fix**: Reuse the `renderHabits()` empty-state pattern (`index.html:4750`) in the two Focus-view renderers.

### 18. Several "decision journal" feature fields in `S` are defined but never synced
- **What**: `antiGoals`, `deadEnds`, `pitsOfDoom`, `treasureChests` are initialized in `S` (`index.html:2036`) with render/save logic but aren't part of the Supabase hydrate path the way other fields are.
- **Where**: `index.html:2036` (init), `~11437-11551` (render logic)
- **Why it matters**: Minor — these are personal-use features, but the dead surface area adds to the cognitive load of an already 80-key state object.
- **Effort**: S
- **Suggested fix**: Either wire them into the sync path or remove if abandoned — a 15-minute audit either way.

### 19. Some empty-state copy assumes prior context
- **What**: e.g. "add your core values to guide goal decisions" — unclear to a first-time/returning-after-a-break user what "values" means in this app's framework.
- **Where**: `index.html:2825`
- **Why it matters**: Minor onboarding friction; low-traffic surface since this is a single-user tool.
- **Effort**: S
- **Suggested fix**: One-line tooltip or sub-copy explaining the Goals↔Values link the first time the section is empty.
