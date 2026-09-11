# Weekly Triage — 2026-09-11

## 📊 Week at a glance
- Commits: **0** in the last 7 days | Files changed: 0 | Debt markers added: 0
- Last commit: `5cd9437` (2026-08-22) — README update only
- High-churn files: none this week

> No commits landed this week. Triage is based on a full static scan of the current codebase against patterns that carry production risk.

---

## 🚨 Needs immediate attention

### 1. Claude API key uploaded to Supabase cloud in plaintext
- **File**: `index.html:9917` + `index.html:10408`
- **Introduced by**: `0e19b15` (PLG guest mode, #77) — `S.claudeKey` has lived in the synced state object since at least then
- **Why this matters**: Every user who connects cloud sync is silently uploading their Anthropic API key. A DB breach or misconfigured RLS exposes all keys at once. This is a P0 security bug.

### 2. `aiAutoTriage` and `aiPlanDay` leak `_aiLock` on Claude error
- **File**: `index.html:5048–5060` and `index.html:5126–5136`
- **Introduced by**: `fb63461` (#78 — PLG Tier 2, first appearance of `_aiLock` mechanism); unlock was placed in happy-path only
- **Why this matters**: Any network error or Anthropic 5xx leaves the two most-used AI features permanently dead for the session. User has to reload to recover "Plan my day" and "Triage Inbox".

### 3. Google Fonts blocked by Content-Security-Policy
- **File**: `vercel.json:15` (CSP), `index.html:14–16` (font link tags)
- **Introduced by**: `72d9c68` (#81 — brand consistency) — CSP was tightened but `fonts.googleapis.com` / `fonts.gstatic.com` were not added to `style-src` / `font-src`
- **Why this matters**: In strict CSP browsers, Inter falls back to system fonts. The brand gradient text on splash and logo may render incorrectly. Affects all users.

### 4. "Good morning, Panos" shown to all new users
- **File**: `index.html:1070` (static HTML), `index.html:2519` (JS default), `index.html:11810` (relationship AI prompt)
- **Introduced by**: `0c1d32d` (#80 — rebrand) — name was hardcoded throughout
- **Why this matters**: New signups see someone else's name in the greeting for 1–3 seconds on load; AI-generated messages address them as "Panos" even after they set their own name.

---

## 🧹 Cleanup opportunities

### 5. Givelink product artifacts not removed after product split
- **Files**: `givelink.html` (entire file), `sw.js:16`, `vercel.json:4`, `index.html:8618` (`renderGivelinkDash`, ~130 lines), `index.html:9569` (nav entry), `index.html:4375` (day planner block), `index.html:2503` (`CATS.givelink`)
- **Introduced by**: Separation commit `d635c06` (#73) removed the link but not the implementation
- **Why this matters**: The `/givelink` route still serves a functional sprint board. The SW caches the file on every install. Dead code inflates the already 14,924-line `index.html`.

### 6. Owner-specific seed data shown to new users
- **File**: `index.html:4532–4610` (`seed()`), `index.html:4924–4980` (`seedGoals()`)
- **Introduced by**: Bootstrapped data from early dev, never genericised
- **Why this matters**: New self-hosted or guest users see "Nonprofits Board Follow Ups", "Financial Independency w/ Givelink", "6+ Months in SF" as their starting tasks/goals. Confusing and erodes trust.

### 7. No PostHog key configured — all analytics calls are silent no-ops
- **File**: `index.html:9960`
- **Introduced by**: `b38d4bb` (#83 — landing growth / analytics SEO) — posthogKey placeholder added but never populated
- **Why this matters**: The app fires `track()` on every key action (task created, onboarding, auth, triage applied) but none are recorded. There's zero product data to make decisions with.

### 8. Service worker cache name hardcoded with a date that won't auto-increment
- **File**: `sw.js:1` (`const CACHE = 'arete-20260723'`)
- **Introduced by**: `59abf2d` (#82) — last time cache was manually bumped
- **Why this matters**: Deployments that don't update this string serve stale assets to PWA users silently. Currently 50 days stale.

---

## 🤔 Worth a second look

### 9. No rate limiting on the Claude proxy — acknowledged but unresolved
- **File**: `api/claude.js:12–13`
- **Why it looks suspicious**: The comment says "For production add per-user rate limiting" but the proxy endpoint is live with no protection. If the app gains users, a single account could exhaust the Anthropic budget with no circuit breaker.

### 10. `sbPush` pushes entire `S` object (unbounded growth)
- **File**: `index.html:10408`
- **Why it looks suspicious**: `S` accumulates `taskPairs`, `contextLog`, `securityAuditLog`, `challengeLogs`, and other append-only arrays with no pruning. Supabase `jsonb` has a practical per-row limit; large `S` objects will eventually cause silent push failures.

### 11. `manifest-givelink.json` still in the repo and cached by SW
- **File**: `sw.js:7` + `manifest-givelink.json`
- **Why it looks suspicious**: The manifest references `icon-gl.svg` and app name "Givelink". If a user installs the PWA from `/givelink` they get a Givelink-branded app installed on their device — even though the product is supposedly separate.

### 12. Notion integration makes direct browser API calls — will always fail
- **File**: `index.html:10940`
- **Why it looks suspicious**: Notion's API does not support browser-side CORS requests. The Settings panel accepts a Notion integration token and lets users enter a page URL, but all calls will be blocked by Notion's CORS policy. The feature is currently broken for 100% of users.

### 13. `_sbToken()` has no retry on network failure during token refresh
- **File**: `index.html:10022–10026`
- **Why it looks suspicious**: If the Supabase token refresh fails once (flaky network), any subsequent AI call that needs auth will throw, and the error surfaces as a confusing "AI error: auth 0" toast. A single retry with a short delay would mask 90% of these.

### 14. `aiSocialAudit`, `aiKTPatterns`, `aiBioLongevity`, `aiWheelInsight`, `aiBreakdownGoal`, `aiImproveTask`, `aiTaskHealthCheck`, `runPriorityAudit`, `aiDailyPicks`, `aiExtractTasksFromNotes`, `aiGenerateNewsletter` — none use `_aiLock`
- **File**: `index.html:7141`, `7312`, `7472`, `7556`, `7671`, `7716`, `7757`, `8150`, `8602`, `8940`, `9804`
- **Why it looks suspicious**: These functions can be called multiple times in parallel (e.g. user double-taps), resulting in duplicate Claude requests, doubled API costs, and racing UI updates. While lower-severity than P0-2, the pattern should be consistent.
