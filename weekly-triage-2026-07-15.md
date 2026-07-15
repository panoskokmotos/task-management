# Weekly Triage — 2026-07-15

## 📊 Week at a glance
- **Commits this week**: 0 (last commit was 9 days ago — 2026-07-06)
- **Files changed**: N/A
- **Debt markers added**: 0 new this week
- **High-churn files (last 2 weeks)**: `index.html` (touched in all 5 recent commits), `sw.js` (touched in 2 of last 5), `api/claude.js` (introduced in recent sprint)

> ℹ️ No commits landed in the past 7 days. This triage covers the bugs and debt residue left by the July 6-7 shipping burst (#66–#70) since nothing has been patched since.

---

## 🚨 Needs immediate attention

### 1. Push notification icon path is broken — affects every reminder
- **File**: `sw.js:41-42`, `index.html:10769`
- **Commit**: `e0b0a00` ("Personal OS: mobile-native pass, power features, and hosted signup")
- **Why it matters**: `./icons/icon-192.png` doesn't exist — the directory `icons/` was never created. Every push notification and in-app reminder fires with a broken icon. On iOS/Android this silently degrades to the OS default. Confirmed with `ls` — no `icons/` folder.

### 2. XSS — task title injected raw into select dropdown HTML
- **File**: `index.html:2430`
- **Commit**: Pre-existing across the monolith, exposed as surface grew
- **Why it matters**: `t.title.slice(0, 45)` is concatenated directly into an `innerHTML` string with no `esc()`. Any task whose title contains `"` or `<` can break the UI; a title like `"><img onerror=...>` executes code. The `esc()` function exists at line 11256 and is used elsewhere — this was an oversight.

### 3. XSS — `toast()` uses `innerHTML` with externally-sourced error messages
- **File**: `index.html:2666`
- **Commit**: `c32b2ef` ("Mobile Superhuman/Notion polish") — toast was wired to AI error paths here
- **Why it matters**: `toast('AI error: ' + e.message)` — if the Anthropic proxy or Supabase returns a crafted error body, it executes in the DOM. Combined with the auth token in `localStorage`, this is an exfiltration vector.

### 4. `aiProxy: ''` — all AI features blocked for hosted users
- **File**: `index.html:9812`
- **Commit**: `e0b0a00` ("Personal OS: mobile-native pass, power features, and hosted signup")
- **Why it matters**: The hosted sign-up flow was shipped but `aiProxy` was never pointed at `/api/claude`. New users who sign up via the hosted app see the auth gate, log in successfully, then find every AI button either shows "Add API key" or silently does nothing. The proxy endpoint works; it just isn't configured.

### 5. Silent sync failure on first login — user lands on empty app
- **File**: `index.html:9975-9976`
- **Commit**: `9f898e0` ("Fix: new signups must not inherit the owner's seeded data")
- **Why it matters**: After the seeded-data fix, the `_afterAuth()` path silently swallows both `sbSyncNow()` and `refresh()` errors. If the first cloud pull fails for any reason, the user sees a green "Welcome" toast but an empty task list — with no indication that something went wrong.

---

## 🧹 Cleanup opportunities

### 6. Hardcoded "Panos" in three distinct places
- **File**: `index.html:17`, `index.html:951`, `index.html:2406`
- **Commit**: Pre-dates tracked commits; likely hand-built personal setup
- **Why it matters**: New hosted users see the app title, page greeting, and localStorage fallback name all say "Panos". The rename flow exists but isn't triggered on first login.
- **Fix**: Change `||'Panos'` → `||'You'`; strip the name from `<title>` and the static greeting HTML; derive a default name from the sign-up email.

### 7. Dark-mode `theme-color` meta set to blue (`#58a6ff`) not brand purple (`#8b7cff`)
- **File**: `index.html:2437`
- **Commit**: `acf71ac` ("Redesign UI toward Superhuman × Notion × Oura") — color was changed but meta wasn't updated
- **Why it matters**: Android browser chrome and iOS PWA nav bar show the wrong accent color in dark mode.
- **Fix**: One-liner: `'#58a6ff'` → `'#8b7cff'` in `applyTheme()`.

### 8. `givelink.html` accent is Tailwind blue not brand purple
- **File**: `givelink.html:6` (theme-color), `givelink.html:17` (--accent)
- **Commit**: `1fb177a` ("Rebrand app icon + logo to violet") — rebrand was only applied to `index.html`
- **Why it matters**: The workspace switcher in `index.html` uses the purple Givelink badge, but clicking through shows a blue app. Visually jarring.
- **Fix**: Change both `#3b82f6` values to `#a78bfa`.

### 9. Many empty `catch(e){}` blocks — errors swallowed silently
- **File**: `index.html:2826, 2860, 9975, 9976, 10026, 10033, 10072, 10131, 13251-13254` (15+ instances)
- **Commit**: Accumulated across the recent sprint burst
- **Why it matters**: When boot, render, or sync errors happen, there's no trace — not in PostHog (which isn't configured anyway), not in the console in production. Bugs become unfindable.
- **Fix**: At minimum `catch(e){console.warn('[context]', e);}` for each.

---

## 🤔 Worth a second look

### 10. `anthropic-version: '2023-06-01'` — 3 years old
- **File**: `index.html:4878`, `api/claude.js:41`
- **Commit**: `e0b0a00`
- **Why it matters**: The API version is pinned to the initial 2023 release. Anthropic is known to deprecate old versions. Updating now is safe; waiting risks a surprise breakage.
- **Intentional?** Possibly — the author may have wanted a stable baseline. Worth updating to at least `2024-01-01`.

### 11. `sbSyncNow()` — no concurrency guard on simultaneous device pushes
- **File**: `index.html:10060-10084`
- **Commit**: `07213ad` ("Enable Supabase cloud sync in production")
- **Why it matters**: Two tabs open simultaneously each do a pull-then-push race. The `_sbBusy` flag prevents concurrent calls within one tab, but it won't help across two browser windows or desktop + mobile. Last write wins silently.
- **Intentional?** Likely. Acknowledged in `supabase-setup.sql:56` ("Conflict resolution is last-write-wins"). Worth surfacing a UI conflict prompt rather than silent overwrite once multi-device use grows.

### 12. PostHog key is empty — zero product analytics
- **File**: `index.html:9813`
- **Commit**: `e0b0a00` — key placeholder added but never filled
- **Why it matters**: `track()` is called ~25 times throughout auth, AI, and task flows, but all events are silently dropped. There's no data to inform what's broken or what's working after the hosted launch.
- **Intentional?** Possibly waiting for traffic. Should be connected before the first marketing push.

### 13. No rate limiting on `/api/claude` — acknowledged in comments, never acted on
- **File**: `api/claude.js:12`
- **Commit**: `e0b0a00`
- **Why it matters**: The comment says "For production add per-user rate limiting." Any signed-in user can call the endpoint in an infinite loop and run up the Anthropic bill. Low risk while users are few; critical risk once the hosted app has real traffic.
- **Intentional?** Yes, explicitly deferred. Recommend adding Upstash rate limiting before any marketing.
