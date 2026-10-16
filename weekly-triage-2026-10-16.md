# Weekly Triage — 2026-10-16

## 📊 Week at a glance
- Commits: **1** | Files changed: **2** (plan docs only, no code) | Debt markers added: **0**
- High-churn files (last 30 days): `index.html` (touched in PRs #83, #84 — unchanged this week)
- **⚠️ P0 items from last week's plan: 0 of 5 addressed**

_The only commit this week was `552c223` — adding `IMPROVEMENT_PLAN.md` and `weekly-triage-2026-10-11.md`. No production code changed. All five P0 bugs identified last week remain open._

---

## 🚨 Needs immediate attention

### 1. AI features still silently broken — `aiProxy` is still `''`
**File**: `index.html:9959`
**Commit that introduced it**: `72e03fe` (PR #84 — 10 days ago)
**Why this matters**: `APP_CONFIG.aiProxy` is still an empty string. Every call to `callClaude` (auto-triage, plan-my-day, morning briefing) fails with a toast error for every user who hasn't pasted in a personal Claude API key. The proxy endpoint `/api/claude` is deployed and works — this is a one-character config fix that unlocks the core product for all users.

**Fix**: Set `aiProxy: '/api/claude'` at `index.html:9959`. Verify `ANTHROPIC_API_KEY` is set in Vercel env.

---

### 2. Inter font still fails to load — CSP blocks Google Fonts
**File**: `vercel.json` (CSP `font-src` and `style-src` lines)
**Commit that introduced it**: `b38d4bb` (PR #83 — 10 days ago)
**Why this matters**: `style-src` and `font-src` only allow `'self'`. Chromium enforces CSP strictly; `fonts.googleapis.com` and `fonts.gstatic.com` are both blocked. Every first-time visitor sees the browser's default sans-serif. The app's landing and first-run impressions are degraded for 100% of new users.

**Fix**: Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` in `vercel.json`.

---

### 3. `--faint` CSS variable undefined — invisible task counts and hints
**File**: `index.html` `:root` block (~line 44–59); used at lines 144, 301, 917, 6267, 6268
**Commit that introduced it**: Pre-existing; not caught by rebrand cleanup in `0c1d32d` / `72d9c68`
**Why this matters**: Five elements use `var(--faint)` which falls back to `transparent` — goal-group task counts (`.gg-ct`), the capture hint, and goal-linked task count chips are completely invisible. Users lose context about task quantities throughout the app.

**Fix**: Add `--faint: rgba(255,255,255,.28);` to `:root` and `--faint: rgba(0,0,0,.28);` to `body.light`.

---

### 4. Stored XSS in Weekly Review wizard — `t.title` / `g.title` unescaped
**File**: `index.html:3594`, `3601`, `3603`
**Commit that introduced it**: Pre-existing in review wizard
**Why this matters**: `renderWizPanel()` sets `body.innerHTML=` with raw `${t.title}` and `${g.title}`. The `esc()` helper exists at line 11776 and is used correctly in every other context. A task titled `<img src=x onerror=alert(1)>` fires when the Weekly Review opens. Self-XSS today; escalation path if the sync backend is ever made multi-tenant.

**Fix**: Replace bare `${t.title}` → `${esc(t.title)}` and `${g.title}` → `${esc(g.title)}` in all three `body.innerHTML=` assignments.

---

### 5. `profileName` defaults to `'Panos'` for every new user
**File**: `index.html:2519`
**Commit that introduced it**: Original personal build; missed in Arete rebrand PR #80
**Why this matters**: New signups see `Good morning, Panos 👋` on their dashboard until they set a name in Settings. Immediate trust-breaker — the app appears unfinished and calling them by the developer's name is an uncanny-valley moment at exactly the wrong time (first session).

**Fix**: Change default to `''` or `'Friend'`. Prompt for name during first-run onboarding.

---

## 🧹 Cleanup opportunities

### 6. Hardcoded preview Vercel URL in OG tags and share flows
**File**: `index.html:24`, `25`, `32`, `10180`
**Commit**: Unchanged through rebrands #80–#84
**Why this matters**: All `og:url`, `og:image`, and share-card URLs point to `task-management-beige-eight.vercel.app`. Every social share, iMessage preview, and install banner references the wrong domain. Should have been updated before any PLG/share features shipped.

### 7. No per-user rate limiting on `/api/claude`
**File**: `api/claude.js:13` (comment literally says "For production add per-user rate limiting")
**Commit**: Initial setup
**Why this matters**: Once `aiProxy` is wired (item #1 above), any signed-in user can make unlimited Anthropic API calls. No rate limit = uncapped spend risk. This is the reason `aiProxy` should stay empty until rate limiting is in place — but the consequence is that the core product is broken for all users.

### 8. `S.claudeKey` included in data exports — API key leaks in JSON backup
**File**: `index.html:2517`
**Commit**: Original design, predates cloud sync
**Why this matters**: `exportData()` dumps the full `S` object. Users sharing a debug export or JSON backup are unknowingly leaking their Anthropic API key in plaintext.

---

## 🤔 Worth a second look

### 9. Supabase keep-alive: ✅ resolved concern from last week
**File**: `.github/workflows/supabase-keepalive.yml`
**Status**: The cron is `*/2` (every 2 days), not `*/3` as noted in the previous triage. The 2-day interval gives comfortable margin under the 7-day pause threshold. The ping hits the authenticated REST endpoint with the anon key, which counts as project activity. No action needed.

### 10. `toast()` renders the guest-nudge CTA as HTML — fragile conversion path
**File**: `index.html:2594`
**Commit**: `0e19b15` (PR #77 — still unaddressed)
**Why this matters**: `_maybeGuestNudge()` embeds `<span onclick="openAuthGate()">Sign up free</span>` inside a `toast()` call. If `toast()` ever switches to `textContent` rendering (the safer pattern), the CTA disappears as literal HTML text and the guest conversion drops to zero with no visible error.
