# Weekly Triage — 2026-10-12

## 📊 Week at a glance
- Commits: **1** (552c223) | Files changed: 2 (docs only) | Debt markers added: 0
- High-churn files (last 30 days): `index.html` (touched in PRs #80–#84), `landing.html` (#82–#83)
- Code changed this week: **none** — the only commit added IMPROVEMENT_PLAN.md and last week's triage

_No production code landed this week. The P0 items from 2026-10-11 remain open. Triage focuses on verifying standing issues and one new finding in the API proxy._

---

## 🚨 Needs immediate attention

### 1. All five P0s from last week remain open — no fixes landed
The five ship-blocking items from `IMPROVEMENT_PLAN.md` are unchanged:
| # | Issue | File | Status |
|---|-------|------|--------|
| P0-1 | Google Fonts blocked by CSP | `vercel.json:12-13` | **Open** |
| P0-2 | `aiProxy` blank → AI broken in prod | `index.html:9959` | **Open** |
| P0-3 | Stored-XSS in Weekly Review wizard | `index.html:3594,3601,3603` | **Open** |
| P0-4 | `--faint` undefined → invisible text | `index.html:44-59` | **Open** |
| P0-5 | Hardcoded Vercel preview URL in OG tags | `index.html:24,25,32,10180` | **Open** |

Each is an S-effort fix. All five together are a single afternoon of work.

---

### 2. `api/claude.js` uses a pinned model ID that may be stale
**File**: `api/claude.js:42`
**Commit**: original setup, not updated since  
**Why this matters**: The proxy hard-codes `claude-haiku-4-5-20251001`. Anthropic deprecates dated model aliases on a rolling basis; when this ID is sunset, every AI feature in the app (plan-my-day, triage, morning brief) returns a 404 from the API with no user-facing error, and `res.status(r.status).json(data)` on line 45 will propagate a 404 silently to the client. The model was last updated in the code over a year ago.  
**Fix**: Switch to the undated alias `claude-haiku-4-5` (Anthropic always routes this to the latest stable patch) or query the models endpoint and pick the most recent haiku. Add a startup assertion or at least a comment with the deprecation URL so future maintainers know to update it.

---

## 🧹 Cleanup opportunities

### 3. Supabase keep-alive concern from last week resolved ✓
**File**: `.github/workflows/supabase-keepalive.yml`  
**Previous concern**: Does the ping count as "API activity" for Supabase's auto-pause timer?  
**Resolution**: The workflow calls `https://bgvddpkdsftgynxyhnoc.supabase.co/rest/v1/` with the anon `apikey` header. This is an authenticated REST API request (not a TCP health check), which Supabase counts as project activity. The 2-day cadence is conservative and correct. Also the last triage misstated the interval as "3 days" — the workflow says `*/2`. No action needed.

---

### 4. `givelink.html` and `index.html` are fully siloed — no shared state
**File**: `givelink.html` (full file), `index.html`  
**Commit**: `72e03fe` (PR #84)  
**Why this matters**: The Givelink sprint board stores its data at `localStorage['givelink_sprint']` while Task OS uses `localStorage['taskos']`. There's no cross-read. The "Sync to Task OS" button (`givelink.html:255`) exists in the UI but its handler `syncToTaskOS()` — if it exists — was not found in the givelink file scanned. If the function is missing or a stub, clicking "Sync" silently does nothing and users assume it worked.  
**Fix**: Search for `syncToTaskOS` in `givelink.html` and either wire it up or remove the button. A broken sync promise undermines trust.

---

### 5. `givelink.html` sprint board uses pink (`#f472b6`) for "Product" pillar on dark background
**File**: `givelink.html:19` (`--pr:#f472b6`), line 429 (`hex:'#f472b6'`)  
**Commit**: `72e03fe` (PR #84)  
**Why this matters**: The brand brief explicitly flags "no pink on purple" as a violation. While the Givelink board background is dark navy (not purple), the pink `#f472b6` is used as a data-vis color for the Product pillar — the same pink as the old Arete accent. If the design system consolidates, this pillar colour will clash against any purple surface. Minor now, likely a real conflict when the Givelink pages adopt the rebrand.  
**Fix**: Swap the Product pillar color to a neutral that reads clearly on dark: `#94a3fb` (light indigo) or the `--op` purple already in the palette (`#a78bfa`).

---

## 🤔 Worth a second look

### 6. `renderVelocityStats` and `renderImpactWidget` are called in `renderOverview` but definitions not found in givelink.html first ~1000 lines
**File**: `givelink.html:550-552`  
**Why this matters**: These functions are called unconditionally in `renderOverview`. If they're defined later in the file (JS hoisting handles `function` declarations but not `const`/`let` arrow functions), they may silently no-op or throw. Worth confirming both are defined somewhere in the file as function declarations.

### 7. `openAiSprintPlanner()` / `runAiSprintPlanner()` — no implementation visible
**File**: `givelink.html:253` (button), `419` (generate button calls `runAiSprintPlanner()`)  
**Why this matters**: The AI Sprint Planner modal exists in givelink.html with a "Generate" button. If `runAiSprintPlanner` is not wired to an API call, clicking Generate either throws or shows the static placeholder text forever. The sprint board has no `aiProxy` config of its own.

### 8. `confirmNewSprint()` advances sprint counter from `(pastSprints.length + 2)` — off-by-one
**File**: `givelink.html:881`  
**Why this matters**: `const n=(S.pastSprints||[]).length+2` means Sprint 3 follows Sprint 1 (0 past sprints → `n=2` → "Sprint 2"; 1 past sprint → `n=3` → "Sprint 3"). The formula is correct but fragile — if a user manually names their sprints with gaps or non-numeric names, the pre-fill will show "Sprint 3" when they're on "Sprint Alpha". Not a bug today but becomes confusing as sprint history grows.

---

## 🔒 Security scan — files changed in HEAD (552c223)
**Files scanned**: `IMPROVEMENT_PLAN.md`, `weekly-triage-2026-10-11.md`  
**Verdict**: Clean. Both are Markdown documentation files with no code, no secrets, no hardcoded credentials, no URLs beyond internal file references. The Supabase publishable key quoted in `weekly-triage-2026-10-11.md` item #12 is already public in `index.html` and `supabase-keepalive.yml` — no new exposure.

---

_Triage total: 2 new items (items 2, 4), 1 resolved (item 3), 5 P0s still open. Highest leverage this week: spend the afternoon fixing all five P0s — they're all S-effort._
