# Weekly Triage — 2026-10-01

## 📊 Week at a glance
- Commits this week: **0** (last activity: Sep 12, 2026 — 19 days ago)
- High-churn files in the Sep 12 release: `index.html`, `givelink.html`
- Debt markers added in last active week: **0** new TODOs/FIXMEs

_No commits landed in the 7-day window ending 2026-10-01. The analysis below covers the most recent active week (Sep 5–12) and the current codebase state._

---

## 🚨 Needs immediate attention

### 1. Stored XSS — task titles injected into `innerHTML` without escaping
- **File**: `index.html:3594`, `index.html:3601`, `index.html:3603`
- **Commit introduced**: `72e03fe` (Givelink bug fixes and This Week view, Sep 12)
- **Why this matters**: `t.title` and `g.title` are rendered directly into `innerHTML` inside `renderWizPanel()`. A task named `<img src=x onerror="fetch('/steal?d='+encodeURIComponent(localStorage.getItem('taskos')))">` runs on every Weekly Review open. This is self-XSS today; becomes a real attack surface the moment task sharing or collaboration is added.

### 2. AI proxy not deployed — AI features fail for 100% of new users
- **File**: `index.html:9959` — `aiProxy: ''`
- **Commit introduced**: pre-existing; never deployed
- **Why this matters**: The AI triage, day plan, AI commands, and morning briefing all check `APP_CONFIG.aiProxy` first. With an empty string, they fall back to asking the user for their own Anthropic API key. New users see a Settings popup instead of the AI feature they signed up for.

### 3. No rate limiting on Claude proxy — Anthropic bill exposure
- **File**: `api/claude.js:12–13`
- **Commit introduced**: `b38d4bb` (Landing growth, Sep 2026) — proxy existed before; TODO was always there
- **Why this matters**: Once `aiProxy` is deployed (see #2), any authenticated user can call it in a tight loop. The only guard is `max_tokens: 2000`; there's no per-user request cap. A single script could cost $50+ in minutes.

---

## 🧹 Cleanup opportunities

### 4. `seed()` — 391 lines of personal Givelink tasks injected for every new user
- **File**: `index.html:4532–4923`
- **Commit**: unchanged across all recent commits
- **Why this matters**: Every self-hosted user's first-run experience shows 60+ personal tasks about Givelink outreach, "panagiotis email", etc. This is dead weight shipped to real users and confuses first-run activation metrics.

### 5. Hardcoded brand URL `task-management-beige-eight.vercel.app` in 11 locations
- **Files**: `index.html` (5×), `landing.html` (5×), `sitemap.xml` (1×)
- **Commit introduced**: `59abf2d` (landing elevation, Sep 2026); never updated post-rebrand
- **Why this matters**: Share cards, OG tags, structured data, and the referral link all point to the internal Vercel slug. Word-of-mouth traffic lands on a URL that undermines the "Arete" brand.

### 6. `_drawStatsCard()` canvas renders "TaskOS" as brand name
- **File**: `index.html:10215`
- **Commit introduced**: pre-rebrand
- **Why this matters**: Shared progress images say "TaskOS" even though the brand is Arete. Every user-generated share is old-brand marketing.

### 7. `esc()` helper doesn't escape single quotes
- **File**: `index.html:11776`
- **Commit introduced**: original implementation
- **Why this matters**: Readwise book titles with apostrophes (e.g. `It's Complicated`) silently break the `onclick` handler at `10848`. A crafted title could inject JS into an onclick attribute. Low exploit probability (user's own data) but a real parse bug today.

---

## 🤔 Worth a second look

### 8. `givelink.html` uses `window.prompt()` for API key collection
- **File**: `givelink.html:1155`, `givelink.html:1330`
- **Commit**: `72e03fe` (givelink fixes, Sep 12) — not introduced here but not addressed either
- **Why this matters**: `window.prompt()` is blocked in iOS PWA mode (`standalone` display mode) and in some enterprise Chrome policies. The key is stored under `taskos_api_key`, separate from the main app's `claudeKey`. Silently fails for any iOS user running the app from the home screen.

### 9. `authMagic()` button has no loading / disabled state
- **File**: `index.html:10097–10108`
- **Commit**: pre-existing
- **Why this matters**: The Supabase OTP call takes 1–3 seconds. Users click "Email me a magic link" again, triggering a second call and receiving two emails. The adjacent login button IS correctly disabled during auth; the magic link button is not.

### 10. Supabase keep-alive workflow pings every 2 days but Supabase's pause threshold is 7 days
- **File**: `.github/workflows/supabase-keepalive.yml`
- **Commit**: `160f0d8` (Sep 12)
- **Why this matters**: The workflow fires every 2 days — more frequent than needed but not harmful. Larger concern: if the workflow's GitHub Actions cron misses a run (GitHub Actions cron can delay 1–2 hours), and the project was already at 6.9 days idle, it could still pause. Consider a daily ping for safety with minimal overhead.

---

_End of triage. 3 items need immediate production action: XSS (#1), AI proxy (#2), rate limiting (#3). The rest are cleanup and observability work._
