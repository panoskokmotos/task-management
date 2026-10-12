# Weekly Triage — 2026-10-12

## 📊 Week at a glance
- Commits: **1** | Files changed: **2** | Debt markers added: **0**
- High-churn files: none — only docs changed this week
- Code changes: none (week was docs-only: `IMPROVEMENT_PLAN.md` + last week's triage file)

> _All items from last week's triage (`552c223`, 2026-10-11) remain open. No fixes landed. The section below repeats only the highest-priority ones; see `weekly-triage-2026-10-11.md` for the full list._

---

## 🚨 Needs immediate attention

### 1. `aiProxy` still blank — AI features broken for all non-key users
**File**: `index.html:9959`
**Commit**: `72e03fe` (introduced, Sep 12) — 30 days unaddressed
**Why this matters**: `APP_CONFIG.aiProxy: ''` means every user without a personally entered Claude API key hits a dead end on AI Triage, Daily Plan, and AI Commands — the core differentiating features. The `/api/claude` proxy endpoint exists and is deployed. One-line fix.

---

### 2. Unescaped `t.title` / `g.title` in Weekly Review wizard — stored XSS
**File**: `index.html:3594`, `3601`, `3603`
**Commit**: pre-existing, unaddressed through 2 triage cycles
**Why this matters**: `renderWizPanel()` injects task and goal titles directly into `innerHTML` with no `esc()` call. A task title containing `<img src=x onerror=...>` executes on the Weekly Review screen. `esc()` exists at line 11776 and is used correctly elsewhere; this is a surgical 3-line fix.

---

### 3. `--faint` CSS variable used in 6 places but never declared
**File**: `index.html:144`, `301`, `917`, `6267`, `6268` (and others)
**Commit**: pre-existing, survived both rebrand PRs (`0c1d32d`, `72d9c68`)
**Why this matters**: All UI elements using `var(--faint)` render as transparent. Affected: goal task counts, capture hint text, goal-linked task previews, and the AI workflow hint. Browsers silently fall back to `transparent` when a CSS variable is undefined.

---

### 4. Hardcoded preview Vercel URL in OG tags and `_APP_URL`
**File**: `index.html:24`, `25`, `32`, `10180`
**Commit**: pre-existing, 30+ days unaddressed
**Why this matters**: All social share previews, PWA manifests, and referral links point to `task-management-beige-eight.vercel.app` (a stale preview deploy). Any user who shares the app or gets an invite link lands on the wrong URL.

---

## 🧹 Cleanup opportunities

### 5. `profileName` hardcoded to `'Panos'` for all new users
**File**: `index.html:2519`
**Commit**: pre-existing (predates rebrand)
**Why this matters**: New users are greeted as "Panos" in the morning briefing until they explicitly rename themselves. A blank default or "there" would be less jarring.

---

### 6. Empty catch at `givelink.html:1152` silences save errors
**File**: `givelink.html:1152`
**Commit**: `72e03fe` (Sep 12)
**Why this matters**: `}catch(e){}` with no handling means save failures in that path produce no toast, no log, nothing. User thinks data was saved; it wasn't.

---

### 7. `S.claudeKey` included in data exports — leaks API key
**File**: `index.html:2517` (key stored in `S`), `exportData()`
**Commit**: original design, never addressed
**Why this matters**: Users exporting tasks for backup or sharing a debug snapshot unknowingly include their Anthropic API key in the JSON file.

---

### 8. `api/claude.js` has no CORS headers and no OPTIONS handler
**File**: `api/claude.js:1-49`
**Commit**: initial (unchanged since)
**Why this matters**: Blocks all local development setups. `localhost` origin is rejected with a CORS error; no meaningful error message is surfaced to the developer.

---

## 🤔 Worth a second look

### 9. `_maybeGuestNudge` renders HTML inside `toast()` — fragile CTA
**File**: `index.html:2594`
**Commit**: `0e19b15` (PR #77, guest mode) — still unaddressed
**Why this matters**: The guest-to-signup CTA embeds a `<span onclick=...>` inside the toast body. If `toast()` ever switches to `textContent` for safety, the CTA silently disappears and conversion drops to zero.

---

### 10. Supabase keep-alive workflow — verify ping counts as "activity"
**File**: `.github/workflows/supabase-keepalive.yml`
**Commit**: `160f0d8` (Sep 12, PR #85)
**Why this matters**: The workflow pings a REST endpoint every 3 days. Confirm via Supabase docs that this particular endpoint (not the health check) counts as project activity for the auto-pause timer; a failed ping that doesn't reset the timer would silently break all auth within 7 days.

---

_Items 1–4 are production-affecting today. Items 5–8 are cleanup that reduces user confusion and developer friction. Items 9–10 are risk-if-changed._
