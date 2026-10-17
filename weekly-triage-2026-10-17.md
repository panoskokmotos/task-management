# Weekly Triage — 2026-10-17

## 📊 Week at a glance
- Commits: **1** | Files changed: **2** | Debt markers added: **0**
- High-churn files: none this week (only doc files touched)
- Last functional commit: `72e03fe` — "Givelink bug fixes and This Week view" (11 days ago)

The only commit this week (`552c223`) added `IMPROVEMENT_PLAN.md` and the prior weekly triage. No code changed. All items from the Oct-11 triage remain outstanding and are reproduced below with updated status and new findings from a closer read of `vercel.json` and `api/claude.js`.

---

## 🚨 Needs immediate attention

### 1. CSP in `vercel.json` blocks Google Fonts — confirmed from source
**File**: `vercel.json:15`
**Commit that last touched it**: `b38d4bb` (PR #83)
**Why this matters**: `style-src 'self' 'unsafe-inline'` and `font-src 'self'` — neither includes `fonts.googleapis.com` or `fonts.gstatic.com`. Confirmed by reading `vercel.json` directly. Inter never loads for any non-cached visitor on Chromium/Firefox. The carefully tuned 800-weight logo and tight letter-spacing look broken.
**Status**: Outstanding — not fixed since first identified

---

### 2. `aiProxy` is blank — AI features broken for every user without a personal key
**File**: `index.html:9959`
**Commit**: never set, present since initial deploy
**Why this matters**: `APP_CONFIG.aiProxy: ''`. The `/api/claude` serverless function is deployed and working, but the frontend never calls it. "Plan my day", auto-triage, the morning briefing, and AI workflows all fail silently. This is the core value proposition.
**Status**: Outstanding — not fixed since first identified

---

### 3. `--faint` CSS variable used in 5 places but never declared
**File**: `index.html:144`, `301`, `917`, `6267–6268`; not in `:root` block at `44–59`
**Commit**: introduced during rebrand cleanup `72d9c68` (purged old palette) — `--faint` was not added as a replacement
**Why this matters**: Goal-group task counts (`.gg-ct`), capture hint text, and goal-linked task previews render transparent/invisible. Affects every user every session.
**Status**: Outstanding — not fixed since first identified

---

### 4. Unescaped user data in Weekly Review wizard innerHTML
**File**: `index.html:3594`, `3601`, `3603`
**Commit**: pre-existing, `renderWizPanel` code
**Why this matters**: Three `body.innerHTML=` assignments inject task and goal titles without `esc()`. `esc()` exists and is used everywhere else. A task title like `<img src=x onerror=alert(1)>` executes on every Weekly Review open. Low cross-user risk (localStorage), but self-XSS fires reliably.
**Status**: Outstanding — not fixed since first identified

---

### 5. `profileName` defaults to `'Panos'` for all new users
**File**: `index.html:2519`
**Commit**: original codebase, survived rebrand commits `0c1d32d` and `72d9c68`
**Why this matters**: Any new user who hasn't renamed themselves is addressed as "Panos" in the morning briefing, dashboard greeting, and personalised AI prompts. Immediate trust-breaking moment on first load.
**Status**: Outstanding — not fixed since first identified

---

## 🧹 Cleanup opportunities

### 6. `/api/claude` proxy has no rate limiting (explicitly noted in source)
**File**: `api/claude.js:12–13`
**Commit**: initial setup
**Why this matters**: A comment in the file reads: _"Note: this is a minimal proxy. For production add per-user rate limiting"_. This is a self-acknowledged gap. Without it, setting `aiProxy` (fixing item #2 above) exposes the Anthropic key to unlimited spend.
**One-line fix path**: Add Upstash Redis middleware; 10 req/user/hour; return `429` with retry-after.

---

### 7. `/api/claude` has no CORS headers and no OPTIONS preflight handler
**File**: `api/claude.js:15–49`
**Commit**: initial setup
**Why this matters**: Any developer testing locally against a deployed instance gets a CORS error with no explanation. Blocks contribution workflow described in README.
**One-line fix**: Add `Access-Control-Allow-Origin` and an early `OPTIONS` return.

---

### 8. Supabase anon key and URL hardcoded in both `index.html` and workflow YAML
**File**: `index.html:9957–9958`, `.github/workflows/supabase-keepalive.yml:27`
**Commit**: `160f0d8` (workflow), original (index.html)
**Why this matters**: Low security risk (anon keys are public by design), but rotation requires two code deploys. The workflow comment correctly notes they're public, but having them duplicated in two places means they drift. Move to `APP_CONFIG` pulled from a build-time env injection.

---

### 9. `_maybeGuestNudge` embeds HTML inside `toast()` — fragile conversion CTA
**File**: `index.html:2594`
**Commit**: `0e19b15` (PR #77)
**Why this matters**: The guest→account conversion toast contains `<span onclick="openAuthGate()">` as raw HTML. If `toast()` ever switches to `textContent` (XSS-safer), the clickable CTA disappears silently. The guest nudge fires when a user has ≥9 tasks — the highest-intent conversion moment in the whole funnel.

---

### 10. Hardcoded Vercel preview URL in OG tags and `_APP_URL`
**File**: `index.html:24`, `25`, `32`, `10180`
**Commit**: unchanged through multiple rebrands
**Why this matters**: `task-management-beige-eight.vercel.app` in OG image URLs and share-card logic. All social shares point to the dev preview URL, not the production domain.

---

## 🤔 Worth a second look

### 11. Supabase keep-alive pings REST root — does this count as activity?
**File**: `.github/workflows/supabase-keepalive.yml`
**Commit**: `160f0d8`
**Status update**: The workflow correctly pings every **2 days** (not 3 as the prior triage said — `cron: '0 6 */2 * *'`), which is well under the 7-day pause threshold. The question remains: does a `GET /rest/v1/` with an anon key count as "API activity" for the pause timer? Per Supabase docs, REST API requests do count. Likely fine, but worth testing by checking the project's "last active" timestamp in the Supabase dashboard.

### 12. `callClaude` direct-API path stores the key in `S.claudeKey` inside the sync blob
**File**: `index.html:2517` (default state), `2578–2580` (save), `2598` (load)
**Why this matters**: `exportData()` serialises the full `S` object including `claudeKey`. Any shared debug export contains the user's Anthropic key. Once `aiProxy` is wired up (item #2), this field should be removed from the synced blob and stored in a separate `localStorage` key.

### 13. Pink (#f472b6) used for the "health" area color in renderMentors
**File**: `index.html:13213`
**Why this matters**: `areaColors.health = '#f472b6'` is used as a background tint and border color in mentor cards. This pink is outside the brand palette (purple `#8272f2`/`#5718CA`). Low visibility but violates the no-pink-on-purple rule when a mentor card appears against an accented background.

---

_Triage generated by automated scheduled run — 2026-10-17_
