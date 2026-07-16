# Task OS — Improvement Plan
_Generated 2026-07-16 by automated codebase scan_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP in `vercel.json` blocks Google Fonts — Inter never loads in production
- **What**: The `Content-Security-Policy` header omits `https://fonts.googleapis.com` from `style-src` and `https://fonts.gstatic.com` from `font-src`, silently blocking the Inter stylesheet the entire app depends on.
- **Where**: `vercel.json:14`
- **Why it matters**: Every user in production falls back to the OS system font. The entire typography system (Inter weights 400–800, -0.006em tracking) collapses. This has been live since the CSP was added.
- **Effort**: S
- **Suggested fix**:
  - Add `https://fonts.googleapis.com` to `style-src`
  - Add `https://fonts.gstatic.com` to `font-src`
  - Alternatively, self-host Inter via `fontsource/inter` and drop the Google dependency entirely (better for privacy + no CSP risk)

---

### 2. Push notification icons are 404 — notifications appear blank
- **What**: Both the service worker and the inline `Notification` constructor reference `'./icons/icon-192.png'`, a path that doesn't exist. The actual file is `./icon-192.png` (no `icons/` subdirectory).
- **Where**: `sw.js:41–42`, `index.html:10769`
- **Why it matters**: Every push notification (habit reminders, streak nudges) shows without an icon and badge, breaking the visual identity on mobile home screens. iOS and Android both fall back to a generic bell.
- **Effort**: S
- **Suggested fix**:
  - Change `'./icons/icon-192.png'` → `'./icon-192.png'` in both locations
  - Add an integration smoke-test: register a SW in a test page and verify the icon resolves with a 200

---

### 3. Dark-mode PWA chrome flashes the wrong brand color
- **What**: `applyTheme(false)` (dark mode) sets `<meta name="theme-color">` to `#58a6ff` (blue), but the app's brand accent is `#8b7cff` (violet). The initial `<meta>` in `<head>` is correctly `#8b7cff`, but `applyTheme()` overwrites it to blue on every theme switch.
- **Where**: `index.html:2437` (`if(mc)mc.content=light?'#f5f5f0':'#58a6ff'`)
- **Why it matters**: On Android Chrome and iOS Safari, the browser chrome (status bar / address bar area) shows the wrong blue whenever the user is in dark mode or switches themes. Jarring visual mismatch on every PWA install.
- **Effort**: S
- **Suggested fix**:
  - Change line 2437: `mc.content=light?'#f5f5f0':'#8b7cff'`
  - While there: the light-mode value `#f5f5f0` is also off — the light brand is `#5a49e0`; use that instead

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. AI proxy has no per-user rate limiting — one user can exhaust the Anthropic budget
- **What**: `api/claude.js` accepts any valid Supabase session and forwards the request to Anthropic with no call counting, no per-user cap, and no time-window throttle. The code itself warns about this in comment on line 13.
- **Where**: `api/claude.js:13–48` (entire handler)
- **Why it matters**: A single power user running AI triage, plan-my-day, sequence-tasks, and automations back-to-back can fire 10+ Anthropic calls in seconds, each up to 2000 tokens. At scale this is an uncapped cost center. The proxy is effectively public to anyone who signs up.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate-limit middleware (the code comment already suggests this): `@upstash/ratelimit` — 20 calls/user/hour is a safe starting point
  - Return `429` with a `Retry-After` header; the client already handles 429 with a friendly toast (line 4884)
  - Log `user_id` per call to Vercel logs so you can audit usage before setting limits

---

### 5. `aiProxy` is empty in `APP_CONFIG` — all AI features silently fail for hosted users
- **What**: `APP_CONFIG.aiProxy` is `''` (line 9812), so `callClaude()` falls back to requiring users to paste their own Anthropic key. In hosted mode, new signups who don't know this just see "Add Claude API key in Settings" and give up.
- **Where**: `index.html:9812`, `callClaude()` at `index.html:4862–4890`
- **Why it matters**: Every AI feature (triage, plan-my-day, reply-to-act, AI workflow builder) is dead on arrival for hosted users until someone notices and wires the proxy URL. This is a silent onboarding failure.
- **Effort**: S
- **Suggested fix**:
  - Deploy the Vercel proxy from `api/claude.js` and fill in `aiProxy` with the deployed URL
  - Add a banner on the Settings page when `aiProxy` is empty and no `claudeKey` is set: "AI features need setup — contact support"
  - Track `auth_*` events already fire; add a `feature_ai_blocked` event on the `callClaude` no-proxy no-key path to measure impact

---

### 6. `_sbToken()` has no concurrency lock — two expired-token callers fire duplicate refresh requests
- **What**: `sbSyncNow()` calls `sbPull()` and `sbPush()` sequentially, each calling `_sbToken()`. But `_sbToken()` only checks a local timestamp and makes a live `fetch` — it doesn't mark itself inflight. If `_sbToken()` is called twice before the first response returns (e.g., from a background sync race), both hit Supabase's refresh endpoint; the second refresh invalidates the first token and can lock out the user.
- **Where**: `index.html:9875–9879` (`_sbToken()` function)
- **Why it matters**: On a slow connection, the 900ms startup sync and an immediate user action can overlap, causing an auth failure that forces a full re-login. The user sees the auth gate reappear with no explanation.
- **Effort**: S
- **Suggested fix**:
  ```js
  let _tokenRefreshPromise = null;
  async function _sbToken() {
    if (!_SB.refresh) throw new Error('not connected');
    if (_SB.access && Date.now() < _SB.exp - 60000) return _SB.access;
    if (!_tokenRefreshPromise) {
      _tokenRefreshPromise = _sbAuth('refresh_token', {refresh_token: _SB.refresh})
        .then(j => { _sbStoreSession(j); return j.access_token; })
        .finally(() => { _tokenRefreshPromise = null; });
    }
    return _tokenRefreshPromise;
  }
  ```

---

### 7. `importData` fires immediately on file-pick with no confirmation — instant data loss risk
- **What**: `importData()` calls `Object.assign(S, d); save(); refresh()` the moment a file is selected, before the user can review what they're importing. There is no "Replace all data?" confirmation step.
- **Where**: `index.html:2508–2519`
- **Why it matters**: An accidental file selection — wrong file, wrong date backup, old export — immediately overwrites the current state. In hosted mode with cloud sync, this also pushes the overwrite to the server 2.5 seconds later. Recovery requires the user to re-import or re-sync from another device.
- **Effort**: S
- **Suggested fix**:
  - Parse the file first, then call `showConfirm()` with a summary (`d.tasks.length` tasks, export date from filename)
  - Only call `Object.assign` / `save()` inside the confirmed callback
  - Bonus: snapshot `S` before import so a single-click "undo" is possible for 30 seconds

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 8. `toast()` passes caller strings through `innerHTML` — latent XSS surface
- **What**: `toast(msg)` at line 2666 does `el.innerHTML = msg`. Most call sites are safe (developer-controlled strings), but `toast('AI error: '+e.message)` at line 4889 inserts a network error message raw into the DOM. A malformed Anthropic API response with `<script>` in its error payload would execute.
- **Where**: `index.html:2666` (toast function), `index.html:4889` (AI error path)
- **Why it matters**: Low probability today, but the pattern grows riskier as more API integrations are added (Readwise, Slack, ntfy, Notion are all in the CSP `connect-src`). Any of them returning unexpected content in error messages hits the same sink.
- **Effort**: S
- **Suggested fix**:
  - Split into two functions: `toast(msg)` uses `textContent` (safe); `toastHTML(html)` uses `innerHTML` (explicit opt-in for emoji/markup)
  - Convert all error-message callers to `toast()` and all icon-toast callers to `toastHTML()`

---

### 9. `showConfirm()` uses `innerHTML` inconsistently across call sites
- **What**: `showConfirm(msg, cb)` renders `msg` via `document.getElementById('confirm-msg').innerHTML = msg` (line 2684). Some callers wrap in `esc()` (line 3697), others pass raw HTML strings (line 1960: `'This <strong>cannot be undone</strong>.'`).
- **Where**: `index.html:2684`, call sites at lines 1960, 3697, 3980
- **Why it matters**: Inconsistent escape discipline makes auditing difficult. If any call site ever gets a task title into `msg` without `esc()`, it's a stored-XSS via user data.
- **Effort**: S
- **Suggested fix**:
  - Accept a structured argument: `showConfirm({text: 'Are you sure?', html: '…optional…'}, cb)` — only render `innerHTML` when `html` is explicitly passed
  - Audit all 9 call sites and ensure any user-data interpolation goes through `esc()`

---

### 10. Critical auth and sync paths swallow errors with empty `catch` blocks
- **What**: Several core flows catch exceptions and discard them silently with `catch(e){}` or `catch(e){}`:
  - `index.html:9975` — `sbSyncNow(true)` failure after login is silent
  - `index.html:9976` — `refresh()` failure after login is silent; user sees a blank dashboard with no indication
  - `index.html:9102` — AI action parse failure becomes a no-op
  - `index.html:2860` — `_stripH1Emoji()` failure is silenced
- **Where**: `index.html:9975–9976`, `9102`, `2860`
- **Why it matters**: When these fail in production, there's no signal. A sync failure after login means data may diverge silently; a render failure means a blank view with no error state shown to the user.
- **Effort**: S
- **Suggested fix**:
  - Replace `catch(e){}` with `catch(e){ console.warn('[taskos] path failed', e); }` at minimum
  - For auth/sync catches, surface the error: `catch(e){ _sbSetStatus('⚠ '+e.message); }`

---

### 11. Supabase credentials hardcoded in source — wrong for anyone who forks or self-hosts
- **What**: `APP_CONFIG.supabaseUrl` and `APP_CONFIG.supabaseAnon` are hardcoded with the owner's Supabase project URL and anon key (lines 9810–9811). These values are correct for production, but they're also public in the git repo.
- **Where**: `index.html:9810–9811`
- **Why it matters**: Anyone who clones the repo and opens `index.html` locally will be writing to the production Supabase database. The Supabase anon key with RLS is technically safe if RLS policies are correct, but it conflates the dev and prod environments and puts all users' data on the owner's Supabase bill.
- **Effort**: M
- **Suggested fix**:
  - Replace hardcoded values with a build-time injection step (even a simple `envsubst` or a 5-line `build.js` that reads `.env` and writes `dist/index.html`)
  - Add `.env.example` with placeholder values and document the setup
  - Keep the current values in a `.env` file that's already in `.gitignore`

---

### 12. `index.html` is a 984 KB, 14 401-line monolith — zero test surface, dangerous to edit
- **What**: All CSS (~650 lines), all HTML (~900 lines), and all application JS (~12 900 lines) live in one file. Every change is a merge conflict risk; there are no unit tests; the only way to verify a change is to reload the page and click around manually.
- **Where**: `index.html` (entire file)
- **Why it matters**: At this size, regressions are invisible until a user reports them. Two recent bug-fix commits (#69, #70) both touched `index.html`; if they'd landed in parallel they'd have conflicted. The 10 most recent commits all touch `index.html`.
- **Effort**: L
- **Suggested fix**:
  - This is a roadmap item, not a sprint task — but an incremental path exists:
    1. Extract the `<style>` block into `style.css` (no behaviour change, immediate diff reduction)
    2. Move each major feature's JS into a `<script type="module" src="...">` file, starting with the lowest-dependency ones (theme, toast, confirm, persist)
    3. Add a single Vitest smoke test per extracted module before moving on

---

## 💡 P3 — Nice to have

### 13. Icon-only interactive elements lack `aria-label` — screen readers are blind
- **What**: The FAB (`+`), sidebar toggle (hamburger), `×` close buttons on modals, and several icon-only action buttons have no `aria-label`, `aria-expanded`, or `role` attributes.
- **Where**: `index.html` — `.fab` (line 240), `.ham-btn` (mobile header), `.mc`/`.ic` close buttons across modals
- **Why it matters**: Users relying on screen readers or keyboard-only navigation cannot identify or activate these controls. VoiceOver reads "button" with no label.
- **Effort**: S
- **Suggested fix**:
  - Add `aria-label="Add task"` to the FAB; `aria-label="Open navigation"` to `.ham-btn`; `aria-label="Close"` to all `.mc`/`.ic` close buttons
  - Add `aria-expanded` toggling to collapsible sidebar sections

---

### 14. `givelink.html` uses a different brand palette than `index.html`
- **What**: `givelink.html` uses `--accent: #3b82f6` (Tailwind blue-500) while the Task OS app uses `--accent: #8b7cff` (violet). The two apps share a navigation shortcut (`⌘2` switches to Givelink), but the visual language is completely different.
- **Where**: `givelink.html:16`, `index.html:31`
- **Why it matters**: Users switching between Task OS and Givelink experience a jarring palette change. As the apps become more integrated (shared keyboard shortcut, shared PWA service worker), brand fragmentation will feel like a bug.
- **Effort**: M
- **Suggested fix**:
  - Align `givelink.html` to use the same CSS custom property names as `index.html`
  - Either port the violet palette or define a shared `tokens.css` both apps import
  - The Givelink product may legitimately want its own identity — but at minimum the sidebar/nav chrome should share the palette

---

### 15. `_sbScheduleSync` debounce window extends indefinitely under rapid saves
- **What**: `_sbScheduleSync()` calls `clearTimeout(_sbTimer)` and resets to 2500ms on every `save()`. If the user is on a slow 3G connection and rapidly edits tasks, the debounce keeps resetting — the sync never fires until 2.5s after the _last_ edit. There's no maximum wait cap.
- **Where**: `index.html:10104–10113`
- **Why it matters**: On slow connections, data can stay local for minutes while the user believes it's syncing (the pending indicator is visible but no sync ever completes). If they close the tab, the last edits are lost.
- **Effort**: S
- **Suggested fix**:
  - Track `_sbFirstPendingAt` when the first pending edit fires; if `Date.now() - _sbFirstPendingAt > 10000`, bypass the debounce and flush immediately
  - Or switch to a leading+trailing debounce: fire once immediately, then once more after the burst ends
