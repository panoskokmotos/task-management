# Weekly Triage — 2026-09-29

## 📊 Week at a glance
- Commits: 1 | Files changed: 1 | Debt markers added: 0
- High-churn files: none (only 1 file touched this week)

---

## 🚨 Needs immediate attention

### 1. Service worker cache name is stale — deploys not reaching users
- **File**: `sw.js:1`
- **Commit**: `160f0d8` (indirectly affected — the keepalive workflow was added but the cache string was never bumped after that deploy)
- **Why this matters**: `CACHE = 'arete-20260723'` is hardcoded to July 23, 2026 — now over two months ago. Returning users are being served the July 23 snapshot of all HTML, JS, and assets via the service worker cache. Every fix and feature shipped since that date is invisible to them on repeat visits unless they manually clear site data. This is silently regressing the entire user base.

### 2. Supabase anon key is committed directly in the keepalive workflow
- **File**: `.github/workflows/supabase-keepalive.yml` (line 22)
- **Commit**: `160f0d8 Add Supabase keep-alive workflow to prevent auto-pause (#85)`
- **Why this matters**: The anon key `sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M` is hardcoded in the workflow YAML and committed to the repo. The commit message argues this is safe because it's a "publishable" key already embedded client-side — that's true for the app, but committing it to the workflow creates an unnecessary copy in git history that can't be easily rotated without a history rewrite. Recommend moving it to a GitHub Actions secret (`SUPABASE_ANON_KEY`) so it can be rotated without a code change if needed. The keepalive PR was also shipped in the previous commit period (Sept 12) so it's 17 days old, but the concern remains.

---

## 🧹 Cleanup opportunities

### 3. `seed()` seeds personal owner data for all self-hosted installs
- **File**: `index.html:4557–4932`
- **Introduced**: Pre-dating this week, but touched via `72e03fe` (Givelink bug fixes)
- **Why this matters**: ~80 tasks including "Jim Rohn Academy California", personal Givelink metrics, and SF-move planning tasks are seeded for any user running a non-hosted deploy. Self-hosters and OSS evaluators see the owner's personal backlog as demo data. A generic demo dataset (5–10 curated showcase tasks) would remove the confusion.

### 4. `profileName` defaults to `'Panos'`
- **File**: `index.html:2519`
- **Commit**: Pre-dating this week, present in `72e03fe` (last touched index.html)
- **Why this matters**: All new users see "Good morning, Panos 👋" on the dashboard (line 1070). The default is never reset during the hosted-mode onboarding flow unless the user explicitly sets a name. A new signup will keep seeing "Panos" until they open Settings.

### 5. Multiple AI prompt strings hardcode "Panos" and Givelink context
- **File**: `index.html:5647, 5920, 7319, 7477, 7849, 7850, 8604`
- **Commit**: Pre-dating this week, present in `72e03fe`
- **Why this matters**: Prompts for relationship nudge, discomfort insight, brand audit, task extraction from notes, and decision suggestions are all written for a specific person. Users get AI advice framed around "Panos, Greek founder building Givelink, targeting SF move." These should use `getAboutMe()` output only, with no hardcoded personal context.

---

## 🤔 Worth a second look

### 6. Supabase keepalive workflow pings every 2 days — but the free-tier pause threshold is 7 days
- **File**: `.github/workflows/supabase-keepalive.yml` (cron: `0 6 */2 * *`)
- **Commit**: `160f0d8`
- **Why this matters**: Pinging every 2 days is 3.5× more frequent than necessary. This is fine — it provides margin — but it means 15 Anthropic-billed Actions minutes per month for a no-op health check. Consider `0 6 */5 * *` (every 5 days) for the same safety margin at 40% of the cost.

### 7. SW push notification icon path will 404 in production
- **File**: `sw.js:47-48`
- **Why this matters**: `icon:'./icons/icon-192.png'` references a non-existent `icons/` subdirectory. The actual file is `./icon-192.png`. Push notifications will render with a broken/missing icon on Android and iOS. This is likely intentional-looking (it's been there a while) but is definitely wrong.

---

_Triage scope: repository `panoskokmotos/task-management`, commits from 2026-09-22 to 2026-09-29._
_Static analysis covered all files changed in the last 7 days plus debt markers in index.html and sw.js._
