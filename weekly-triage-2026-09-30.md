# Weekly Triage — 2026-09-30

## 📊 Week at a glance
- **Commits this week**: 0 (last commit was 160f0d8 on 2026-09-12, 18 days ago)
- **Files changed**: 0 this week
- **Debt markers added**: 0 (TODO/FIXME/HACK/XXX: 0 found in codebase)
- **High-churn files**: N/A — no activity this week

> The codebase is in a stable holding period. Triage below covers the two most recent merges and a full debt scan.

---

## 🚨 Needs immediate attention

### 1. AI proxy disabled — all AI features dead in production
- **File**: `index.html:9959`
- **Commit**: 0c1d32d (rebrand/boot fixes)
- **Why**: `aiProxy: ''` in APP_CONFIG means every AI feature silently requires users to enter their own API key. No hosted user will do this. Core product value proposition is unreachable. The proxy (`api/claude.js`) is ready and just needs to be wired up — but see item #2 first.

### 2. AI proxy has no rate limiting — wiring P0-1 creates unbounded spend
- **File**: `api/claude.js:12-13`
- **Commit**: Comment is self-documenting — "add per-user rate limiting (e.g. Upstash)"
- **Why**: Enabling the proxy without rate limiting first means any authenticated user can exhaust the Anthropic quota. Must be addressed before P0-1 goes live.

### 3. Personal founder context leaks into AI prompts for all users
- **File**: `index.html:7849`, `index.html:9806`, `index.html:12186`
- **Commit**: Likely introduced in f883adf (templates/PLG) or fb63461 (shareable cards)
- **Why**: Three AI call sites use `"Panos — Greek founder in his 20s building Givelink..."` as fallback instead of the generic string used by the other 6+ call sites. Every hosted user without a filled profile gets AI outputs shaped around the founder's personal context.

### 4. Post-login sync failure silently swallowed
- **File**: `index.html:10131`
- **Commit**: Present in auth refactor (0c1d32d or earlier)
- **Why**: `catch(e){}` with no feedback means users land on an empty dashboard with no indication that their data failed to load. High churn risk on first login with a bad network.

---

## 🧹 Cleanup opportunities

### 5. 23 console statements in production code
- **File**: `index.html` — run `grep -n "console\." index.html` to list all
- **Most notable**: `console.error` at line 10689: `"initial render failed; falling back to dashboard"` — this is a real error that should be surfaced to the user, not just logged
- **Fix**: Gate behind `const DEBUG = new URLSearchParams(location.search).has('debug');`

### 6. Hardcoded personal financial targets (€25,000 / €300)
- **File**: `index.html:5323-5324`, `index.html:3558`
- **Why**: Finance view shows the founder's personal income targets to all users. The `targets` object `{income:25000, passive:3600}` should be user-configurable settings.

### 7. Model ID duplicated across two files
- **File**: `api/claude.js:42`, `index.html:5023`
- **Fix**: One `const AI_MODEL` in a shared location; will save a painful split-brain upgrade when the next model ships.

---

## 🤔 Worth a second look

### 8. "This Week" view ships without an empty state
- **File**: `givelink.html` — the week-grid in the This Week view (commit 72e03fe)
- **What**: When no tasks have `plannedDate` set, 7 empty day columns render with no hint about how to assign tasks to days. The unscheduled section shows tasks but doesn't prompt users to drag/assign them.
- **Verdict**: Likely intentional MVP shipping, but first-time users will be confused.

### 9. `plannedDate` field written in givelink.html but absent from index.html
- **File**: `givelink.html:639,640,774,793` vs `index.html` (absent)
- **What**: The field exists in the data model and givelink.html's UI, but users can't view or set it from index.html's task modal. Cross-app field is silently orphaned.
- **Verdict**: Probably a known gap, but worth tracking to avoid data confusion.

### 10. Three meaningful empty catch blocks (not just haptic/confetti)
- **File**: `index.html:2587`, `index.html:9242`, `index.html:10131`
- **Of the ~20 empty catch blocks**, most correctly suppress non-critical errors (haptic feedback, confetti animation, localStorage collapse state). These three are in data paths.
- **Line 2587**: Likely a render function — failure here silently renders nothing.
- **Line 9242**: Supabase query path — silent failure means stale data shown.
- **Line 10131**: Post-login sync (see item #4 above — most critical).

---

## ✅ Clean (no action needed)

- **Supabase keep-alive** (160f0d8): Clean implementation. Pings public REST endpoint every 2 days. No debt.
- **Supabase anon key in source**: The publishable key in APP_CONFIG (`index.html:9957-9958`) is intentionally client-side per Supabase's design. RLS protects data. No secrets exposed.
- **No hardcoded API secrets found**: grep for `sk_live`, `pk_live`, `sk-ant`, `rk_live` returned 0 results in source (only a safe `placeholder` attribute string).
- **No `@ts-ignore` or `eslint-disable`** anywhere in the codebase.
- **No TODO/FIXME/HACK/XXX comments** anywhere in the codebase.

---

_10 items | 4 needs-attention | 3 cleanup | 3 second-look_
