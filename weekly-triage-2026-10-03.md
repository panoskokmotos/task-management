# Weekly Triage — 2026-10-03

## 📊 Week at a glance
- Commits this week: **0** | Files changed: **0** | Debt markers added: **0**
- Last active week (Sep 8–12): 2 commits, 3 files changed
- High-churn files (last 30 days): `givelink.html` (touched 1× with 7 sub-fixes), `index.html` (touched 1× with 4 sub-fixes)
- No new TODO/FIXME/console.log/`catch(e){}` added in either active commit

---

## 🚨 Needs immediate attention

### 1. `profileName` defaults to `'Panos'` — all new users greeted as the wrong person
**File:** `index.html:2519` | **Introduced:** pre-existing (not this week's commits)
**Why this matters:** Every new user whose localStorage is empty gets "Good morning, Panos" and AI advice personalized for "Panos — Greek founder in his 20s building Givelink in San Francisco". Destroys trust on first impression.
**Fix:** Change fallback to `''` and handle empty gracefully in the greeting.

### 2. `callClaudeGL()` in givelink.html doesn't check `res.ok` — silent failures on 401/429/500
**File:** `givelink.html:1338` | **Introduced:** predates the Sep 12 commit (not fixed in #84)
**Why this matters:** Any AI call that fails at the HTTP level returns `null` with no user-facing error. The fix was applied to `runAiSprintPlanner()` (line 1214 correctly checks `res.ok`) but `callClaudeGL()` was left behind.
**Fix:** Add `if(!res.ok) throw new Error(data.error?.message || 'API error '+res.status)` after parsing JSON.

### 3. `landing.html` router swallows all exceptions — returning users can't re-enter the app
**File:** `landing.html:27–41` | **Introduced:** predates recent commits
**Why this matters:** The entire session-check block is wrapped in `try{}catch(e){}`. In iOS Safari private mode and some Android browsers, `localStorage.getItem` throws. The catch does nothing, so users with valid sessions who hit a storage error see the landing page indefinitely.
**Fix:** Change `catch(e){}` to `catch(e){ location.replace('/index.html'); }`.

### 4. AI proxy (`api/claude.js`) has no rate limiting
**File:** `api/claude.js:12–13` | **Comment explicitly flags this as TODO**
**Why this matters:** Any authenticated user can POST to the proxy in a loop and drain the Anthropic API budget. The `max_tokens: 2000` cap limits per-call cost but not call volume.
**Fix:** Add Upstash Redis sliding-window rate limit before the Anthropic fetch call.

### 5. Developer's personal tasks ship in `seed()` to all non-hosted installs
**File:** `index.html:4532–4653`
**Why this matters:** "Battery Fix — check insurance too (10:00-18:00 τεχνικός)", "Γενέθλια Σοφίας", "panagiotis email?" and 80+ other personal tasks are seeded for any new local user. The app looks like a leaked personal tool.
**Fix:** Replace personal tasks with 8–10 generic illustrative tasks, or call the existing `_seedStarter()` instead.

---

## 🧹 Cleanup opportunities

### 6. `givelink.html:1152` — empty `catch(e){}` in `getApiKey()`
**Commit:** 72e03fe (Sep 12) touched `getApiKey` but didn't fix the empty catch.
**Context:** If `JSON.parse(localStorage.getItem('taskos'))` throws, the API key slot is silently empty and the user is prompted again via `window.prompt()`.
**Fix:** At minimum log: `catch(e){ console.warn('getApiKey parse error', e); }` then fall through to the prompt.

### 7. `givelink.html` uses `window.prompt()` for API key collection (lines 1155, 1330)
**Commit:** Present in 72e03fe commit's modified code.
**Context:** `window.prompt()` is blocked in iOS WKWebView, some Android WebViews, and cross-origin iframes. The main app has a proper Settings modal for this.
**Fix:** Show a toast with a button: `toast('Add Claude API key in Settings')` and deep-link to the settings section.

### 8. `givelink.html` and `index.html` use different localStorage keys for the Claude API key
**Commit:** Persisted across 72e03fe.
**Context:** `index.html` stores the key in `S.claudeKey` (inside the JSON blob at `localStorage.taskos`). `givelink.html` reads from `localStorage.taskos_api_key` and falls back to parsing `S.claudeKey` via raw JSON.parse. The dual-scheme causes silent "key not found" failures when a key is set in one app but not the other.
**Fix:** Standardize on a single key: `localStorage.taskos_claude_key`, written directly (not nested in `S`).

### 9. `givelink.html:1209` — unversioned `claude-opus-4-5` model ID
**Commit:** 72e03fe (the sprint planner added this; `runAiSprintPlanner` at line 1214 calls Opus).
**Context:** `model:'claude-opus-4-5'` uses an unversioned alias. All other calls in the codebase use `claude-haiku-4-5-20251001`. Opus is ~15× more expensive than Haiku for a task that is simple structured output.
**Fix:** Change to `claude-haiku-4-5-20251001` unless structured sprint planning quality genuinely requires Opus; add the version suffix regardless.

### 10. `serviceWorker.register()` has no `.catch()` in either app
**Files:** `index.html:10693`, `givelink.html:1795`
**Context:** Both apps call `navigator.serviceWorker.register('./sw.js').then(…)` with no `.catch()`. In cross-origin or security-restricted contexts the Promise rejects and produces an uncaught rejection in the console.
**Fix:** Add `.catch(e => console.warn('SW registration failed:', e))`.

---

## 🤔 Worth a second look

### 11. `_APP_URL` hardcodes the Vercel subdomain independently of OG meta tags
**File:** `index.html:10180, 10232`
The `_APP_URL` constant and the OG `<meta>` tags both hardcode `task-management-beige-eight.vercel.app` but as separate strings. A future domain change requires 8+ edits across two files. Looks intentional (no custom domain yet) but worth tracking.

### 12. `supabase-keepalive.yml` hardcodes the production Supabase URL + anon key
**File:** `.github/workflows/supabase-keepalive.yml` (added in 160f0d8)
The workflow comment correctly explains why this is safe (publishable key, RLS), but the URL is now in two places: `index.html:9957` and the YAML. A Supabase project migration requires updating both. Consider using a GitHub Actions secret or repo variable to keep it DRY.

### 13. `sfTimeline` field in the global state schema targets a specific real-world move
**File:** `index.html:2517`
`sfTimeline:{targetDate:'',durationMonths:6,status:'planning',budget:0,milestones:[],network:[],notes:''}` is a structured field for planning a move to San Francisco. It's in every user's default state object and gets cloud-synced. For a general-purpose productivity app this is unexpected and narrows perceived scope.
