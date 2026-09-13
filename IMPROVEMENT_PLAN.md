# Improvement Plan — Arete Task OS
_Generated: 2026-09-13_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. XSS via unescaped task/goal titles in Weekly Review wizard
- **What**: `renderWizPanel()` injects `${t.title}` and `${g.title}` raw into `innerHTML` — a task named `<img src=x onerror=alert(1)>` executes arbitrary JS.
- **Where**: `index.html:3594`, `3601`, `3603` (renderWizPanel); `index.html:3716` (tcHTML — affects every task list rendered into innerHTML)
- **Why it matters**: Any imported CSV, shared template payload, or self-typed title containing `<script>` / event-handler attributes executes code in the app. The `esc()` helper exists at line 11776 but is inconsistently applied — it's used for goal titles in tooltip attributes (line 3723) but forgotten for the visible text.
- **Effort**: S
- **Suggested fix**:
  - In `renderWizPanel` (lines 3594, 3601, 3603): replace every `${t.title}` / `${g.title}` with `${esc(t.title)}` / `${esc(g.title)}`
  - In `tcHTML` (line 3716): change `<span class="tt">${t.title}</span>` → `<span class="tt">${esc(t.title)}</span>`
  - Audit the remaining 20+ `innerHTML` template strings for other user-supplied fields (notes, goal titles, habit names) and wrap each with `esc()`

### 2. Service worker registration silently fails with no error handling
- **What**: `navigator.serviceWorker.register('./sw.js').then(...)` at line 10693 has no `.catch()` — if registration fails (e.g. HTTPS not available, SW parse error), the PWA install prompt and offline mode break silently.
- **Where**: `index.html:10693–10701`
- **Why it matters**: Users on non-HTTPS origins or with strict browser policies get a broken offline experience with zero feedback; the install-prompt path also silently dies.
- **Effort**: S
- **Suggested fix**:
  - Add `.catch(err => console.warn('SW registration failed:', err))` after the `.then()` block
  - Optionally suppress the update banner and install prompt when registration is known to have failed

### 3. Token refresh loop has no retry or user-visible failure on network error
- **What**: `sbSyncNow()` (line 10412) calls `_sbToken()` which throws if the network is down mid-session; the outer catch at line 10439 sets `_sbStatus='⚠ '+e.message` but never schedules a retry — data written while offline is marked `_sbPending=true` but only synced on the `online` event (line 12591), which fires once and is not re-attempted on failure.
- **Where**: `index.html:10022–10027` (`_sbToken`), `index.html:10412–10441` (`sbSyncNow`), `index.html:12591`
- **Why it matters**: A user who saves tasks while the network flickers may lose writes silently — the pill shows "Sync error" but nothing automatically retries once they're back online if the first `online` event sync also fails.
- **Effort**: M
- **Suggested fix**:
  - In the `online` event listener, wrap the `sbSyncNow()` call in a retry loop (e.g. exponential backoff × 3)
  - Add a "Retry sync" button to the sync-error pill state so users can manually trigger recovery
  - Log the specific error (expired token vs network timeout vs RLS rejection) to aid debugging

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Guest → signup conversion has no persistent nudge after the first dismissed prompt
- **What**: `_maybeGuestNudge()` (line 2587) is guarded by `taskos_guest_nudged` and wrapped in an empty `catch(e){}` — once dismissed it never resurfaces, even after a guest has added 10+ tasks and is clearly invested.
- **Where**: `index.html:2587`, `index.html:10467–10479`
- **Why it matters**: Guest mode is a core acquisition driver (commit #77 "instant try without account"), but there's no re-engagement touchpoint after the initial nudge is dismissed. Invested guests who forget to sign up have no way back to the prompt — they just silently lose data.
- **Effort**: M
- **Suggested fix**:
  - Show a soft banner in the sidebar sync-pill area after a guest accumulates ≥5 tasks and has not been nudged in 24 h
  - Replace the empty `catch(e){}` with `catch(e){console.warn('guest nudge', e)}` so failures are visible
  - Track `track('guest_nudge_dismissed', {task_count})` to measure conversion intent

### 5. Givelink sprint board uses a completely different brand palette
- **What**: `givelink.html` defines `--accent:#3b82f6` (blue), `--pr:#f472b6` (pink), and `--op:#a78bfa` (muted purple) — entirely disconnected from Arete's `--brand:#8272f2` / `--brand-gradient: linear-gradient(135deg,#6a58ee,#9878ea)` palette. Pink (`#f472b6`) appears on dark backgrounds throughout the board.
- **Where**: `givelink.html:14–25` (`:root` color definitions), badge classes `.st-inprog`, `.ck2.on`
- **Why it matters**: If Givelink is a companion product to Arete, the mismatched colors undermine brand recognition. The pink-on-dark background used for progress (`--pr:#f472b6`) is also the explicit "no pink on purple" violation called out in brand guidelines.
- **Effort**: S
- **Suggested fix**:
  - Replace `--accent:#3b82f6` with `#8272f2` and `--pr:#f472b6` with `#a385ee` in `givelink.html`
  - Align `.ck2.on` and `.gcheck.on` to use the Arete accent rather than `var(--done)` (#22c55e green)
  - Consider extracting a shared `brand-tokens.css` included by both pages

### 6. No loading/error state on AI features when Claude key or proxy is absent
- **What**: AI functions (`aiSmartRoute`, `aiDraftManifesto`, `aiSuggestMentors` etc. at lines 13405, 13199, 13290) each individually check for `S.claudeKey || APP_CONFIG.aiProxy` and show a toast, but there's no affordance in the UI indicating AI features are disabled — buttons look identical whether the key is set or not.
- **Where**: `index.html:4328`, `5047`, `5111`, `13112`, `13199`, `13290`, `13405` (and many more)
- **Why it matters**: A new user who hasn't added their API key clicks an AI button, sees a fleeting toast error, and doesn't understand what to fix or where. Drop-off on the AI features is high for first-time users in self-hosted mode.
- **Effort**: M
- **Suggested fix**:
  - Add a subtle "AI not configured" badge or lock icon on AI-gated buttons when `!S.claudeKey && !APP_CONFIG.aiProxy`
  - On click, open Settings directly to the AI section with a focus ring on the key field instead of showing a toast
  - Log `track('ai_blocked', {feature})` so you can measure how often this happens

### 7. `stat` grid on medium screens (480px–768px) cramped at 3 columns
- **What**: `.stats` is `repeat(5,1fr)` at ≥900px, drops to `repeat(3,1fr)` at 900px (line 321), then `repeat(2,1fr)` at 768px (line 338) — but between 768px and 900px on typical Android devices (~360–540px viewport after safe-area) the three-column grid makes the stat numbers too tight.
- **Where**: `index.html:113` (`.stats` definition), `index.html:321` (`@media max-width:900px`), `index.html:338` (`@media max-width:768px`)
- **Why it matters**: The app is mobile-first; crammed stat cards on mid-size Android phones make the dashboard feel broken.
- **Effort**: S
- **Suggested fix**:
  - Add `@media(max-width:600px){.stats{grid-template-columns:repeat(2,1fr);}}` between the 768px and 900px breakpoints
  - Or switch stats to `grid-template-columns: repeat(auto-fill, minmax(90px, 1fr))` to handle all screen widths dynamically

### 8. Weekly Review wizard loses draft silently if tab is closed mid-step
- **What**: `_wizSave()` (line 3659) is triggered on step navigation but not on every keystroke in the review textareas — closing the tab mid-sentence in step 4 ("write your commitment") discards the in-progress text. The draft restoration in `renderReview()` (line 3583) also requires the same calendar date, so a review started late at night and resumed after midnight is lost.
- **Where**: `index.html:3659` (`_wizSave`), `index.html:3583` (`renderReview`), `index.html:3637–3657` (wizard textarea IDs)
- **Why it matters**: The weekly review is a high-engagement feature; losing a half-written reflection is frustrating enough to abandon the habit.
- **Effort**: S
- **Suggested fix**:
  - Add `oninput="_wizSave()"` to each textarea in the wizard HTML
  - Change the date guard in draft restoration from exact `=== today` to within ±2 days (`Math.abs(dayDiff) <= 2`) so reviews started the night before are still resumable

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. 14,926-line monolithic `index.html` with 711 global functions
- **What**: The entire app — CSS, HTML structure, and ~12,000 lines of vanilla JS — lives in one file with no module system. 711 function definitions in global scope means any naming collision silently overwrites behavior.
- **Where**: `index.html` (entire file)
- **Why it matters**: Any new feature requires scrolling thousands of lines; finding a function requires `grep`; refactoring risks are invisible. Build time for Vercel deploys scales with file size unnecessarily.
- **Effort**: L
- **Suggested fix**:
  - Split into: `app.css`, `app-ui.js` (rendering), `app-data.js` (state + sync), `app-ai.js` (AI features), keep `index.html` as a thin shell
  - Use a simple Vite/esbuild bundler with no framework — the existing vanilla JS is already modular in practice
  - Start with the most-edited sections: Supabase sync (lines 9956–10441) and AI features (lines 4328–5538)

### 10. Empty `catch(e){}` blocks swallow errors invisibly in 15+ places
- **What**: Patterns like `catch(e){}` (no logging) appear at lines 2587, 2983, 3031, 3868, 3978, 3979, 3988, 4443, 5536, 10115, 10120, 10131, 10134 — errors in guest nudge, H1 emoji strip, weekly draft restore, confetti, XP award, first-win all vanish silently.
- **Where**: `index.html:2587`, `2983`, `3031`, `3868`, `3978`, `3979`, `3988`, `4443`, `5536`, `10115`, `10120`, `10131`, `10134`
- **Why it matters**: Bugs introduced in future commits affecting these paths will be invisible in the console, making regression debugging very slow.
- **Effort**: S
- **Suggested fix**:
  - Replace every `catch(e){}` with `catch(e){console.warn('[feature-name] failed:', e)}`
  - For production, route `console.warn` through a thin wrapper that also calls `track('js_error', {feature, msg: e.message})` for PostHog visibility

### 11. Habit names injected into `<option>` values without escaping
- **What**: `s.innerHTML='<option ...>'+habits.map(h=>'<option value="'+h+'"...'` at line 4060 puts habit names directly in `value` attributes — a habit named `" onclick="..."` could break the select.
- **Where**: `index.html:4060`
- **Why it matters**: Habits are user-entered strings; while the risk is low in a single-user app, defensive escaping is trivial and prevents edge-case breakage.
- **Effort**: S
- **Suggested fix**:
  - Wrap each `h` with `esc(h)`: `<option value="${esc(h)}"${esc(h)===val?' selected':''}>${esc(h)}</option>`

### 12. `window._procCelebrated` and other window-property state flags
- **What**: Global state is stored on `window` directly (e.g. `window._procCelebrated` at line 4443, `window._justWelcomed` at line 10456, `window.__areteRendered` at line 10686, `window.__phInit` at line 10391) instead of in the `S` state object or a named module-level variable.
- **Where**: `index.html:4443`, `10456`, `10686`, `10391`
- **Why it matters**: `window.*` pollution means any future external script (analytics, chat widget) could accidentally clobber these flags, silently breaking celebrations or analytics init.
- **Effort**: S
- **Suggested fix**:
  - Introduce a single `const _APP = {}` namespace object for all runtime flags
  - Replace `window._procCelebrated` → `_APP.procCelebrated`, `window.__phInit` → `_APP.phInit`, etc.

### 13. No zero-state or error-state in the `renderDash()` crash fallback
- **What**: The catch at line 10689 calls `renderDash()` again — if `renderDash` itself throws, the second call is also in a bare `try/catch` that silently swallows the error. The user sees a blank screen.
- **Where**: `index.html:10686–10692`
- **Why it matters**: Any regression in `renderDash` produces an invisible blank screen with no user feedback.
- **Effort**: S
- **Suggested fix**:
  - Add a final fallback that injects a visible error card: `document.getElementById('v-dashboard').innerHTML = '<div class="card" style="color:var(--q1);">Something went wrong loading the dashboard — try refreshing.</div>';`
  - Track the error via `track('render_crash', {msg: e.message})`

---

## 💡 P3 — Nice to have

### 14. PostHog analytics configured but key is blank — zero product data
- **What**: `posthogKey: ''` in `APP_CONFIG` (line 9960) means `initAnalytics()` exits immediately. All `track()` calls throughout the app are no-ops, so there's no data on feature usage, conversion funnel, or errors.
- **Where**: `index.html:9960`, `10390–10394`
- **Why it matters**: Without analytics, every product decision is made blind. The infrastructure is already wired — it just needs a key.
- **Effort**: S
- **Suggested fix**:
  - Create a PostHog project and paste the key into `APP_CONFIG.posthogKey`
  - Add `capture_exceptions: true` to the PostHog init options to auto-capture JS errors

### 15. `robots.txt` disallows all crawlers — landing page gets zero organic discovery
- **What**: `robots.txt` currently contains `User-agent: * Disallow: /` (checked via file listing) which blocks all search engine indexing including `landing.html`.
- **Where**: `robots.txt`
- **Why it matters**: The landing page (`landing.html`) has been heavily invested in (commits #82, #83 per git log) for SEO, but it's invisible to Google.
- **Effort**: S
- **Suggested fix**:
  - Update `robots.txt` to allow `/landing.html` and the app root while optionally disallowing `/api/`
  - Confirm `sitemap.xml` lists the landing page URL with a `<lastmod>` matching the last landing update

### 16. Supabase anon key duplicated in workflow YAML and `index.html`
- **What**: The same `sb_publishable_...` key appears in both `index.html:9958` and `.github/workflows/supabase-keepalive.yml:25` — changing the key requires updating two places.
- **Where**: `index.html:9958`, `.github/workflows/supabase-keepalive.yml:25`
- **Why it matters**: Harmless today (it's a publishable key), but as the project grows this pattern will repeat for real secrets.
- **Effort**: S
- **Suggested fix**:
  - Move the Supabase URL/key to a GitHub Actions secret (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) and reference `${{ secrets.SUPABASE_ANON_KEY }}` in the workflow — even for public keys, this is the convention that prevents accidental promotion to real secrets later

### 17. `navigator.clipboard` used without fallback in several places beyond the one with a fallback
- **What**: `_wfCopy()` (line 5522) silently fails on error; other clipboard calls at lines 10282, 10283 use `.catch(()=>window.prompt(...))` as fallback but `_wfCopy` just shows "Copy failed" toast — on iOS Safari 15 in non-secure contexts clipboard is blocked.
- **Where**: `index.html:5522`
- **Why it matters**: iOS users in some contexts can't copy AI workflow output, which is a core deliverable of the AI Lab feature.
- **Effort**: S
- **Suggested fix**:
  - Add `execCommand` fallback to `_wfCopy`: `catch(e){ const ta = document.createElement('textarea'); ta.value = _wfLast.text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('📋 Copied'); }`

### 18. `landing.html` has hardcoded `task-management-beige-eight.vercel.app` URL in OG meta
- **What**: `index.html:29–30` og:url and og:image point to `https://task-management-beige-eight.vercel.app/` — the old Vercel preview URL rather than a stable custom domain.
- **Where**: `index.html:29–30`
- **Why it matters**: If the project is moved to a custom domain, OG cards in social shares will point to the wrong URL and may break.
- **Effort**: S
- **Suggested fix**:
  - Replace the hardcoded Vercel URL with the canonical domain (or a `{{ BASE_URL }}` placeholder filled at deploy time via a Vercel env var + build step)
