# Weekly Triage — 2026-08-03

## 📊 Week at a glance

- **Commits this week:** 0 (last commit: `b38d4bb` on 2026-07-22 — 12 days ago)
- **Files changed:** 0 in the last 7 days
- **Debt markers added this week:** 0 (no files changed)
- **High-churn files:** N/A — no activity

> The repo has been quiet for 12 days. The items below come from a static scan of the existing codebase — they're carry-overs from recent commits rather than fresh regressions.

---

## 🚨 Needs immediate attention

### 1. Push notification icon is a broken 404

**File:** `sw.js:46-47`
**Commit introduced:** `0c1d32d` (2026-07-17, "Rebrand to Arete + first-run magic moment")
**Why:** `./icons/icon-192.png` is referenced for push notification icon and badge. The directory `icons/` doesn't exist — the real file is `./icon-192.png`. Every push notification delivered to a user shows a broken image icon on Android/Chrome.

---

### 2. CSP blocks Google Fonts — app renders in system fonts

**File:** `vercel.json` (CSP header), `index.html:14-16`
**Commit introduced:** Vercel headers were likely set in `#59` or `#68` era; Google Fonts link is in `index.html` for much longer.
**Why:** `font-src 'self'` and `style-src 'self' 'unsafe-inline'` both lack `https://fonts.gstatic.com` and `https://fonts.googleapis.com`. The browser silently blocks Inter. Users see Times New Roman or Helvetica.

---

### 3. AI proxy endpoint exists but is not wired up

**File:** `index.html:9959`
**Commit introduced:** `api/claude.js` added in an earlier commit; `APP_CONFIG.aiProxy` left empty ever since.
**Why:** `aiProxy: ''` means `callClaude()` always requires the user's personal Claude API key. Since no new user has one, every AI feature (auto-triage, plan-my-day, reply-to-act) fails with a settings toast. The core differentiator is invisible.

---

### 4. Session expiry silently breaks sync — no re-auth prompt

**File:** `index.html:10022-10026`, `10439`
**Commit introduced:** Supabase sync infrastructure first landed in commit `#59` era.
**Why:** When the Supabase refresh token expires, `sbSyncNow` shows "Sync error — retry" indefinitely. There's no code path to re-present the auth gate or prompt logout. Users lose sync silently.

---

## 🧹 Cleanup opportunities

### 5. `seed()` contains ~80 personal owner tasks in Greek

**File:** `index.html:4532-4800`
**Commit introduced:** Accumulated across many early commits; unchanged since at least `#69`.
**Why:** The seed function contains personal task data including "Ακτινογραφία στα γόνατα", "245€ in investments from seminaria", "Γενέθλια Σοφίας". Any user in non-hosted mode (or a developer cloning the repo) gets these as their starter tasks. Should be replaced with 8-10 generic placeholder tasks.

---

### 6. Hardcoded personal goals in render functions

**File:** `index.html:5223`, `5323-5324`, `6163`
**Commit introduced:** Finance/Health view, likely commit `#55`-`#57` era.
**Why:** `renderHealth()` embeds `"goal: 12%"` (body fat) and `renderFinance()` embeds `"goal: €25K"` and `"goal: €300/mo"` directly in HTML string interpolation. `_NS_TARGETS` at line 6163 hardcodes numeric benchmarks used for progress bar widths. Every new user sees the owner's personal financial goals as their own.

---

### 7. "Givelink Outreach" hardcoded in AI day-planning output

**File:** `index.html:4375`
**Commit introduced:** Focus/planning feature, likely commit `#61`-`#63` era.
**Why:** `{id:'fp-block-2', time:'11–12pm', label:'Givelink Outreach', task:top.find(t=>t.category==='givelink')}` — this block appears in every user's AI-generated daily schedule. It's a personal business venture hard-baked into a generic feature.

---

### 8. "Givelink" is a global task category for all users

**File:** `index.html:2503`, `2507`
**Commit introduced:** Category system added in the early Givelink era; not cleaned up after rebrand.
**Why:** `CATS = {givelink:{l:'Givelink', e:'🟣'}, ...}` — "Givelink" appears in every user's category dropdown and in the Wealth life-area bucket. New users have no idea what this means.

---

### 9. PostHog key not configured — all analytics are silent no-ops

**File:** `index.html:9960`, `landing.html:701`
**Commit introduced:** Analytics scaffolding added in `b38d4bb` (2026-07-22).
**Why:** `posthogKey: ''` means the `track()` calls throughout the app fire into nothing. The landing page added in the most recent commit (`b38d4bb`) also has `var POSTHOG_KEY = '';`. The instrumentation is complete but zero data is collected.

---

### 10. API proxy has no rate limiting — open bill exposure

**File:** `api/claude.js:12-13`
**Commit introduced:** Proxy added in an early commit; never updated.
**Why:** The file itself flags it: _"for production add per-user rate limiting."_ No limits exist. A single session can make unlimited Anthropic API calls. This becomes urgent once the proxy is wired up (item 3 above).

---

## 🤔 Worth a second look

### 11. `_sbToken()` is not safe for concurrent calls

**File:** `index.html:10022-10026`
**Why suspicious:** If two `callClaude()` calls fire concurrently and the token is near expiry, both check `Date.now() < _SB.exp - 60000` at the same time, both fail the check, and both call `_sbAuth('refresh_token', ...)`. Supabase one-time refresh tokens don't tolerate double-use — the second call gets a 400 and the session becomes permanently broken. Likely intentional (single user, single tab) but mobile background tabs can trigger this.

---

### 12. `callClaude()` silently returns `null` on all errors

**File:** `index.html:5007-5034`
**Why suspicious:** Every caller does `if(!raw) return;` — this treats a network timeout, a 401, a 429, and a JSON parse error identically. No caller ever retries or adjusts UI state on failure. The error information from the catch block is shown as a toast but not preserved anywhere. This is probably fine for the current single-user scale but makes support debugging hard.

---

### 13. Supabase anon key and URL are in the committed source

**File:** `index.html:9957-9958`
**Why suspicious:** The Supabase anon key (`sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M`) and project URL are committed to the repo. The comment notes this is safe (publishable key, RLS-protected). This is correct for Supabase anon keys by design — but worth confirming RLS is correctly configured on the `tasks` table before user count scales.

---

### 14. Claude API key is included in the synced Supabase data blob

**File:** `index.html:2517` (state definition), `index.html:9917`
**Why suspicious:** `S.claudeKey` is part of the main state object and synced to Supabase via `sbPush()`. While RLS protects it, API keys in a general-purpose data table is a code smell. If a future bug in sync logic or a misconfigured RLS policy exists, a user's Claude key could be readable by others.
