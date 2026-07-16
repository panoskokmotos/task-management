# Weekly Triage — 2026-07-16

## 📊 Week at a glance
- **Commits this week**: 0 (last commit was 2fa1c76 on 2026-07-06, 10 days ago)
- **Files changed**: N/A
- **Debt markers added**: N/A — no commits to scan
- **High-churn files (last 30 days)**: `index.html` (touched in 16/16 commits), `sw.js` (4 commits)

> The repo has been quiet for 10 days. No active development churn to triage. Items below are persistent debt
> found in the current codebase, prioritized for the next sprint.

---

## 🚨 Needs immediate attention

### 1. Google Fonts blocked by CSP — Inter not loading in production
- **File**: `vercel.json:14`
- **Commit**: `07213ad` (CSP was added when Supabase was enabled; fonts never re-added)
- **Why this matters**: Every deployed user sees system fonts, not Inter. The entire design system relies on Inter weight variants. Silent — no console error if the CSP blocks silently on older Chrome.

### 2. Push notification icon 404s in production
- **File**: `sw.js:41–42`, `index.html:10769`
- **Commit**: `e0b0a00` (habit reminders added) + `2fa1c76` (sw.js touched, path unchanged)
- **Why this matters**: Habit streak notifications and reminder toasts all fire with a broken icon. Every notification the app sends is missing the brand mark.

### 3. Dark-mode `theme-color` set to wrong blue (#58a6ff instead of #8b7cff)
- **File**: `index.html:2437`
- **Commit**: `1fb177a` (rebrand to violet) — rebranded CSS vars but missed the `applyTheme()` hardcode
- **Why this matters**: PWA installs on Android/iOS show a blue status bar in dark mode. The rebrand to violet is visually broken on every dark-mode user's home screen.

---

## 🧹 Cleanup opportunities

### 4. No per-user rate limiting on AI proxy (acknowledged in-code)
- **File**: `api/claude.js:13` — comment reads "For production add per-user rate limiting (e.g. Upstash)"
- **Commit**: `e0b0a00` (proxy introduced)
- **Why this matters**: The TODO has been in the code since the proxy launched. Hosting costs are unbounded.

### 5. `_sbToken()` has no inflight lock — concurrent refresh race
- **File**: `index.html:9875–9879`
- **Commit**: `e0b0a00` (Supabase auth introduced)
- **Why this matters**: The 900ms startup sync and any user-triggered sync that fires before the page fully loads can double-refresh the token. Second refresh invalidates the first, potentially logging the user out.

### 6. `importData` has no confirmation before overwriting
- **File**: `index.html:2508–2519`
- **Commit**: present since early builds; untouched in recent window
- **Why this matters**: Data loss if user accidentally picks the wrong file. Hosted mode syncs the overwrite to cloud 2.5s later.

### 7. `aiProxy` is empty — AI features silently broken for hosted users
- **File**: `index.html:9812`
- **Commit**: `e0b0a00` (hosted signup added) — proxy field left blank
- **Why this matters**: The entire hosted auth/signup flow was shipped in commit #68, but the AI proxy that makes AI features work for hosted users was never wired up. New signups see "Add Claude API key" which is not the intended hosted experience.

---

## 🤔 Worth a second look

### 8. `_afterAuth()` swallows both `sbSyncNow` and `refresh()` failures silently
- **File**: `index.html:9975–9976`
- **Commit**: `e0b0a00` — added in the hosted auth refactor
- **Pattern**: Two back-to-back `try{ await fn(); }catch(e){}` — if either fails, the user sees the auth success toast but may be looking at stale or empty data.
- **Verdict**: Intentional defensiveness, but the empty catch means the auth-complete state is a lie if sync fails.

### 9. Sidebar account chip name derivation never shows verified email
- **File**: `index.html:9986` — `_renderAccountChip()`
- **Commit**: `2fa1c76` (just landed)
- **Pattern**: Name falls back `saved → fromEmail → 'You'`. `fromEmail` is `email.split('@')[0]`, so `panagiotis.kokmotoss@gmail.com` → "Panagiotis Kokmotoss". Looks right, but if the user has a non-name email (e.g., `dev123@gmail.com`) the chip shows "Dev123" without ever prompting to set a real name.
- **Verdict**: Probably acceptable; worth a first-run "What should we call you?" prompt during `_welcomeSeed()` to prevent the fallback from being the permanent state.

### 10. `_welcomeSeed()` seeded tasks are hardcoded to specific task titles
- **File**: `index.html:10095–10101`
- **Commit**: `9f898e0` (new signup seed)
- **Pattern**: The deduplication check (`ex2.has(t.title)`) matches on title strings. If an existing user happens to have a task called "👋 Welcome! Tap a task..." the seed logic treats the account as already seeded.
- **Verdict**: Low risk (the title is distinctive), but the correct check should be `!S._welcomed` before even running seed logic — which it already does. Likely safe; worth noting in case the welcome text changes.
