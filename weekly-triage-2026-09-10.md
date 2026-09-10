# Weekly Triage — 2026-09-10

## 📊 Week at a glance
- **Commits this week**: 0 — no commits in the last 7 days
- **Files changed this week**: 0
- **Debt markers added this week**: 0
- **High-churn files (last 5 commits)**: `index.html`, `landing.html`, `sw.js`

> _No code was committed in the 7 days ending 2026-09-10. The triage below covers standing debt from the prior active sprint (commits b38d4bb through 5cd9437), which touched 14 files and added ~1,147 lines. These items carry forward as unresolved debt._

---

## 🚨 Needs immediate attention

### 1. API key stored in `localStorage` — security regression from recent split
**File**: `givelink.html:1085–1088`
**Commit**: `d635c06` ("Remove Givelink from Task OS") — Givelink was decoupled but still reads `taskos_api_key` from localStorage and calls Anthropic directly from the browser via the `anthropic-dangerous-direct-browser-access` header.
**Why it matters**: Any XSS or injected script on the page can steal the Anthropic API key and drain billing. The proxy at `/api/claude` exists for this exact reason and is unused by Givelink.

---

### 2. `callClaudeGL()` swallows non-2xx errors silently
**File**: `givelink.html:1264–1270`
**Commit**: Present since at least `0c1d32d` ("Rebrand to Arete + first-run magic moment")
**Why it matters**: Rate-limit errors (429) and invalid-key errors (401) return `null` to callers, causing every AI feature (standup, outreach, sprint planner) to display "Check your API key" regardless of the real error. Users churn at the first AI friction point.

---

### 3. Service worker push icon path is wrong — `./icons/icon-192.png` doesn't exist
**File**: `sw.js:48–49`
**Commit**: `72d9c68` ("Brand consistency: rebrand update banner + purge stray old-brand colors") — SW was updated but the push notification icon path wasn't corrected.
**Why it matters**: Every push notification shows a broken image instead of the app icon. Push is a key re-engagement channel; broken icons erode trust.

---

### 4. CSP blocks Inter font loading (`font-src 'self'` missing `fonts.gstatic.com`)
**File**: `vercel.json` (headers block)
**Commit**: Present since `b38d4bb` ("Landing growth: analytics, SEO foundation") — CSP was tightened but Google Fonts was omitted from `font-src`.
**Why it matters**: `index.html` loads Inter via Google Fonts. The CSP silently blocks the font files from `fonts.gstatic.com`, falling back to system font. Every user sees the wrong typography.

---

### 5. `api/claude.js` — no rate limiting, flagged as missing in its own comment
**File**: `api/claude.js:12–13`
**Commit**: Original; not updated in recent sprints despite being noted as missing.
**Why it matters**: If the proxy is deployed with a server API key, any authenticated Supabase user has unlimited AI usage. Anthropic bills accrue against the operator's account.

---

## 🧹 Cleanup opportunities

### 6. `claude-opus-4-5` bare model alias (no date suffix)
**File**: `givelink.html:1140`
**Introduced by**: Present since CRM/AI feature additions. The shared helper `callClaudeGL` uses the dated `claude-haiku-4-5-20251001`; the sprint planner inline fetch uses the undated `claude-opus-4-5`.
**Why it matters**: When Anthropic deprecates the short alias, the sprint planner silently fails with a 400.
**Fix**: Replace with `claude-opus-4-5-20241205` (or current Opus model ID).

---

### 7. Burndown chart uses hardcoded `W=280, H=100` pixel values
**File**: `givelink.html:763`
**Introduced by**: Original implementation. Recent mobile polish commits (`e0b0a00`, `92c6188`) improved layout generally but missed this SVG.
**Why it matters**: On mobile viewports the chart clips and looks broken.
**Fix**: Use `viewBox` with `width="100%"` for fluid scaling.

---

### 8. Task badge renders raw lowercase priority value ("high" not "High")
**File**: `givelink.html:666`
**Introduced by**: Original `taskHTML()` implementation. Status badge uses the label lookup correctly; priority does not.
**Why it matters**: Visual inconsistency on every task row — "high" in a badge vs "Todo" next to it.
**Fix**: `${PRI[t.priority]?.l||'Medium'}` instead of `${t.priority||'medium'}`.

---

### 9. Givelink accent color is blue (#3b82f6) — off-brand after rebrand commits
**File**: `givelink.html:6,17`
**Introduced by**: `d635c06` ("Remove Givelink from Task OS") — Givelink was split out but the CSS wasn't updated to use the Givelink purple brand palette.
**Why it matters**: Givelink and Arete are being positioned as separate products; blue Givelink looks like an unfinished fork.
**Fix**: Set `--accent:#5718CA` (or `#6B3FA0`); update `theme-color` meta.

---

### 10. `givelink.html` missing Inter font link — system font fallback
**File**: `givelink.html:21`
**Introduced by**: Same split in `d635c06`. Arete loads Inter; Givelink doesn't.
**Why it matters**: Navigating from Arete to Givelink triggers a jarring font switch.
**Fix**: Add the same Inter `<link>` tag as in `index.html:14–16`.

---

### 11. `save()` has no quota error handling — silent data loss
**File**: `givelink.html:447`
**Introduced by**: Original implementation. The seed data alone (150+ tasks) puts pressure on the 5MB localStorage limit.
**Why it matters**: When quota is exceeded, `localStorage.setItem` throws synchronously but nothing catches it — the user sees no error and their change is lost.
**Fix**: Wrap in `try/catch`, show a toast on `QuotaExceededError`.

---

### 12. `runAiSprintPlanner()` duplicates the `callClaudeGL()` fetch implementation
**File**: `givelink.html:1097–1161` vs `1256–1272`
**Introduced by**: Sprint planner predates the shared helper; never refactored.
**Why it matters**: Error handling improvements to one path don't propagate to the other.
**Fix**: Replace the inline fetch in `runAiSprintPlanner()` with a `callClaudeGL()` call after fixing that helper (see item 2 above).

---

### 13. Service worker cache key hardcoded to date: `arete-20260723`
**File**: `sw.js:1`
**Introduced by**: `72d9c68` — the cache key was updated with that commit's date but is not updated automatically on subsequent deployments.
**Why it matters**: Users may remain on a stale cached version after deploy if the SW cache key doesn't change.
**Fix**: Stamp the cache key during the CI/deploy step (e.g. via a build script replacing `__CACHE_KEY__` with the commit hash).

---

### 14. No `.env.example` for required API environment variables
**File**: None — file is missing
**Introduced by**: `api/claude.js` has always referenced env vars without a companion example file.
**Why it matters**: New contributors deploying the proxy will miss `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`.
**Fix**: Create `.env.example` with all three keys as commented placeholders.

---

## 🤔 Worth a second look

### 15. `window.prompt()` used for API key collection — may be intentional but is a UX red flag
**File**: `givelink.html:1086, 1261`
**Why it looks suspicious**: Native browser prompts look like phishing dialogs; the API key is only prompted once and then cached. This feels like a temporary workaround. If the proxy is the intended path (see `api/claude.js`), these prompts should never appear.
**Action**: Confirm whether direct-browser API calls are the intended long-term architecture, or whether the proxy is and these prompts should be removed.

---

### 16. `syncToTaskOS()` matches tasks by title (case-insensitive) — fragile deduplication
**File**: `givelink.html:1223–1234`
**Why it looks suspicious**: Title matching is used to avoid pushing duplicate tasks to Task OS. If a task title changes slightly (e.g. trailing space, emoji), the sync pushes a duplicate. With 150+ tasks this could create significant noise in the Task OS inbox.
**Action**: Consider adding a stable `givelink_id` field to synced Task OS tasks so deduplication is ID-based.

---

### 17. CRM `seedNonprofits()` is called on every `renderCRM()` call
**File**: `givelink.html:1299–1301`
**Why it looks suspicious**: `seedNonprofits()` is guarded by `if((S.nonprofits||[]).length) return` — safe but the guard runs on every CRM render. If `S.nonprofits` is ever set to an empty array (e.g. all orgs deleted), the seed re-fires unexpectedly, repopulating test data in production.
**Action**: Gate the seed behind a `S.nonprofitsSeeded` flag (like the `S.seeded` flag used for tasks) rather than checking array length.

---

_Triage complete. 17 items total: 5 need immediate attention, 9 are cleanup, 3 need a second look. Zero items added this week (no commits). All items are carry-forward from the prior sprint._
