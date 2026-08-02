# Weekly Triage — 2026-08-02

_Generated automatically. Branch: `claude/quirky-euler-dacgyw`_

---

## 📊 Week at a glance

| Metric | Value |
|--------|-------|
| Commits in last 7 days | **0** |
| Last commit | `b38d4bb` — 2026-07-22 |
| Last commit message | "Landing growth: analytics, SEO foundation, and comparison table (#83)" |
| Files touched by last 3 commits | `index.html`, `landing.html`, `manifest.json`, `robots.txt`, `sitemap.xml` |
| Open debt markers | 12 items (see below) |

No commits landed this week. The most recently active files are `landing.html` (commit #83) and `index.html`.

---

## 🚨 Needs immediate attention

### 1. AI features silently broken for all users
- **`index.html:9959`** — `aiProxy: ''` in `APP_CONFIG`. Every AI call falls through to "Add your Claude API key in Settings" toast. The proxy (`/api/claude`) exists and is deployed; it just isn't wired up.
- Introduced by: not set in any commit — config value was never populated.
- **Why this matters**: Triage-inbox, plan-my-day, and reply-to-act are core differentiators. Every user who tries them hits a dead end.

### 2. Push notification icon is a 404
- **`sw.js:46-47`** — `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'`. The actual file is at `./icon-192.png` (no `icons/` subdirectory).
- Introduced by: likely original sw.js commit.
- **Why this matters**: Push notifications arrive without the app icon on Android; broken-image on iOS. Users can't identify the notification source.

### 3. PostHog analytics key left blank after commit #83
- **`landing.html:699`** — `var POSTHOG_KEY = '';`
- **`index.html:9960`** — `posthogKey: ''`
- Introduced by: `b38d4bb` (2026-07-22) — built full PostHog tracking but shipped with an empty key.
- **Why this matters**: The entire conversion funnel is invisible. No data exists on CTA clicks, hero-demo visibility, or scroll depth.

### 4. Anthropic API key stored in `localStorage` via `window.prompt()`
- **`givelink.html:1086`** (`getApiKey()`), **`givelink.html:1261`** (`callClaudeGL()`)
- Introduced by: original givelink.html AI features.
- **Why this matters**: (1) Any XSS exposes the key. (2) `window.prompt()` is modal, unstyled, and blocks the UI. (3) Two diverged retrieval paths will silently break for specific users.

### 5. No rate limiting on `/api/claude`
- **`api/claude.js:12`** — comment reads "For production add per-user rate limiting (e.g. Upstash Redis)".
- Introduced by: original api/claude.js.
- **Why this matters**: A buggy client loop or a malicious user can run up hundreds of dollars in Anthropic charges with no safeguard.

---

## 🧹 Cleanup opportunities

### 6. `claude-opus-4-5` in sprint planner (60× cost vs Haiku)
- **`givelink.html:1140`** — `model: 'claude-opus-4-5'` in `runAiSprintPlanner()`. Standup and outreach generators already correctly use Haiku.
- Introduced by: original sprint planner implementation.
- **Why this matters**: $15/M vs $0.25/M for listing 10 tasks from a backlog — a task Haiku handles equally well.

### 7. Hardcoded SW cache key must be manually bumped each deploy
- **`sw.js:1`** — `const CACHE = 'arete-20260723'`. The last deploy was 2026-07-22; if the key wasn't updated, returning users are seeing stale HTML.
- Introduced by: sw.js — maintained manually.
- **Why this matters**: Any future deploy without bumping this string silently serves old content to cached users.

### 8. Anthropic API version pinned to `2023-06-01`
- **`api/claude.js:41`**, **`givelink.html:1135`**, **`givelink.html:1266`** — all use `anthropic-version: '2023-06-01'`.
- Introduced by: original implementations.
- **Why this matters**: Locks out streaming, web search tool, tool_choice, and prompt caching. Streaming alone would make plan-my-day feel instant instead of showing a spinner for 3–5 s.

### 9. Duplicate API key retrieval logic
- **`givelink.html:1075-1088`** (`getApiKey()`) and **`givelink.html:1256-1272`** (`callClaudeGL()`) — both independently probe `localStorage` keys in different orders. Already slightly diverged: `getApiKey` checks `taskos_profiles`, `callClaudeGL` checks `taskos` raw JSON.
- Introduced by: incremental feature additions to givelink.html.
- **Why this matters**: Silent divergence will break AI features for specific users. One function is the right shape.

### 10. `window.prompt()` for CRM activity logging
- **`givelink.html:1431`** — `logActivityNP()` uses a native browser prompt for multi-line follow-up notes.
- Introduced by: original CRM implementation.
- **Why this matters**: `window.prompt()` is modal, one-line only, and can't be styled. Users with multi-line notes can't use this feature.

### 11. FAB button missing `aria-label`
- **`givelink.html:303`** — `<button class="fab" onclick="openAdd()">+</button>` has no accessible label. The hamburger button at line 218 correctly has `aria-label="Menu"`.
- Introduced by: original givelink.html scaffold.
- **Why this matters**: Screen readers announce it as "plus" or "button" — not actionable.

---

## 🤔 Worth a second look

### 12. `syncToTaskOS()` matches tasks by title — fragile sync
- **`givelink.html:1223`** — `tt.title.toLowerCase() === gt.title.toLowerCase()`. A one-character title edit in either app silently duplicates the task instead of updating it.
- Introduced by: original sync implementation.
- **Why this matters**: Data integrity risk for users who rely on Givelink→Task OS sync. Duplicate tasks accumulate silently.

### 13. Burndown chart empty state gives no guidance
- **`givelink.html:758-775`** (`renderBurndown()`) — shows "Complete tasks to see burndown progress" with no explanation of what a "snapshot" is or that a projected ideal line could be shown immediately.
- Introduced by: original burndown implementation.
- **Why this matters**: New users hit a useless chart on day 1 of a sprint with no way to understand what to do.

### 14. Landing footer SVG references gradient from a different element
- **`landing.html:634`** — `<path stroke="url(#lg)">` with no local `<defs>`. It borrows `#lg` from the hero SVG via document scope.
- Introduced by: landing page layout.
- **Why this matters**: Works in all current browsers but breaks silently if the footer is server-rendered or the hero is removed. A trap for future editors.

### 15. Supabase anon key hardcoded in source
- **`index.html:9957-9958`** — `supabaseUrl` and `supabaseAnon` hardcoded in `APP_CONFIG`.
- Note: Supabase anon keys are designed to be public (RLS enforces access control), so this is not a security vulnerability. However, rotating the key requires a code deploy rather than an environment variable change.
- **Why this matters**: Low risk today; worth moving to a build-time env inject if the deployment process allows it.

---

_Triage generated: 2026-08-02. Items 1–5 are actionable this sprint; items 6–11 are low-effort cleanup; items 12–15 need design discussion before touching._
