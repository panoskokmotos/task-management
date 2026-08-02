# Arete / Givelink Improvement Plan

_Generated: 2026-08-02_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. AI features completely dark for all users
- **What**: `APP_CONFIG.aiProxy` is an empty string — every AI call falls through to "Add your Claude API key in Settings" toast.
- **Where**: `index.html:9959` (`aiProxy: ''`)
- **Why it matters**: Triage-inbox, plan-my-day, and reply-to-act are the core differentiators. Every user who tries them hits a dead end unless they own an Anthropic account. The proxy (`/api/claude`) exists and works — it just isn't wired up.
- **Effort**: S
- **Suggested fix**:
  - Set `aiProxy: 'https://<your-vercel-app>.vercel.app/api/claude'` in `APP_CONFIG`.
  - Ensure `ANTHROPIC_API_KEY` is set in Vercel environment variables.
  - The auth gate already guards the proxy; no other changes needed.

---

### 2. Push notification icon is a 404
- **What**: Service worker shows `./icons/icon-192.png` for push notifications but the file lives at `./icon-192.png` (no `icons/` subdirectory).
- **Where**: `sw.js:46-47`
- **Why it matters**: Push notifications appear without branding on Android (broken icon) and silently fail icon load on iOS. Users can't identify the notification as coming from Arete.
- **Effort**: S
- **Suggested fix**:
  - Change `icon: './icons/icon-192.png'` → `icon: './icon-192.png'`
  - Change `badge: './icons/icon-192.png'` → `badge: './icon-192.png'`

---

### 3. Anthropic API key stored in localStorage, entered via `window.prompt()`
- **What**: Givelink's AI features prompt users for their Anthropic key, store it in `localStorage`, and call the Anthropic API directly from the browser.
- **Where**: `givelink.html:1086` (`getApiKey()`), `givelink.html:1261` (`callClaudeGL()`), `givelink.html:1131-1144` (direct fetch to api.anthropic.com)
- **Why it matters**: (1) Any XSS vulnerability exposes the API key. (2) `window.prompt()` is a modal dialog that blocks the UI and can't be styled — terrible UX. (3) Two separate functions with slightly different key-retrieval logic will silently diverge.
- **Effort**: M
- **Suggested fix**:
  - Route Givelink AI calls through the same `/api/claude` proxy. The proxy already handles Supabase auth gating.
  - Replace `getApiKey()` and inline `callClaudeGL()` with a single `callProxy(prompt, maxTokens)` function.
  - Add a proper key-input UI inside the Settings modal instead of `window.prompt()`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. PostHog analytics never fires — conversion funnel is invisible
- **What**: PostHog key is blank in both the landing page and the app, so no events are tracked.
- **Where**: `landing.html:699` (`POSTHOG_KEY = ''`), `index.html:9960` (`posthogKey: ''`)
- **Why it matters**: Commit #83 explicitly built `landing_cta_click`, `landing_scroll`, `landing_demo_seen`, and `landing_view` tracking — then left the key empty. Without it there's no data to know which CTA converts, how far people read, or whether the hero demo is being seen.
- **Effort**: S
- **Suggested fix**:
  - Paste the PostHog project key (same key in both places, as the commit comment instructs).
  - Verify events appear in PostHog Live Events after deploy.
  - Add `app_ai_used` and `app_task_created` events in `index.html` to track core feature engagement.

---

### 5. No rate limiting on `/api/claude` — single user can drain the bill
- **What**: The Claude proxy accepts any valid Supabase token without per-user request limits.
- **Where**: `api/claude.js:1-49` (comment on line 12 acknowledges the gap)
- **Why it matters**: One malicious or buggy client loop can run up hundreds of dollars in Anthropic charges. The proxy comment explicitly flags this as missing.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (free tier) — 10 requests per user per minute.
  - Return HTTP 429 with a user-friendly `{ error: 'Rate limit exceeded, try again in 60s' }`.
  - Alternatively enforce a hard monthly token cap per `user_id` in the Supabase `app_state` row.

---

### 6. Givelink AI Sprint Planner uses `claude-opus-4-5` (most expensive model)
- **What**: Sprint task suggestions are generated with Opus ($15/M input) instead of Haiku ($0.25/M).
- **Where**: `givelink.html:1140` (`model: 'claude-opus-4-5'`)
- **Why it matters**: 60× cost premium for listing 10 tasks from a backlog — a task Haiku handles equally well. The standup and outreach generators already correctly use Haiku.
- **Effort**: S
- **Suggested fix**:
  - Change `model: 'claude-opus-4-5'` → `model: 'claude-haiku-4-5-20251001'` in `runAiSprintPlanner()`.
  - If suggestion quality drops noticeably, try `claude-sonnet-5` as a middle ground (still 10× cheaper than Opus).

---

### 7. SW cache key is a hardcoded date — stale cache after deploys
- **What**: `const CACHE = 'arete-20260723'` must be manually bumped or users see stale HTML.
- **Where**: `sw.js:1`
- **Why it matters**: The landing page was last updated on 2026-07-22. If the cache key wasn't bumped, returning users are seeing the pre-#83 landing. Any future deploy without bumping this string silently serves old content.
- **Effort**: S
- **Suggested fix**:
  - Replace with a build-time hash: inject `const CACHE = 'arete-__BUILD_HASH__'` via a Vercel build step, or
  - Use a version string driven by `package.json` or `APP_CONFIG.version`.
  - Cheapest option: set `CACHE = 'arete-' + Date.now()` on the activate event so the SW self-invalidates on load (slight trade-off: more network hits).

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 8. Duplicate API-key retrieval logic in `givelink.html`
- **What**: `getApiKey()` (line 1075) and `callClaudeGL()` (line 1256) both independently probe `localStorage` keys in different orders and prompt separately.
- **Where**: `givelink.html:1075-1088` and `givelink.html:1256-1272`
- **Why it matters**: If either path caches the key differently, AI features silently break for specific users. Already slightly diverged: `getApiKey` checks `taskos_profiles`, `callClaudeGL` checks `taskos` raw JSON.
- **Effort**: S
- **Suggested fix**: Extract a single `_getClaudeKey()` utility used by both callers. Or better, route everything through the proxy (P0 fix #3) and delete both functions entirely.

---

### 9. `syncToTaskOS()` matches tasks by title — fragile sync
- **What**: Givelink→Task OS sync finds the matching Task OS task via `tt.title.toLowerCase() === gt.title.toLowerCase()`.
- **Where**: `givelink.html:1223`
- **Why it matters**: A one-character title edit in either app silently duplicates the task rather than updating it. The sync also only pushes backlog tasks as `category: 'givelink'` with no way to pull Task OS completions back.
- **Effort**: M
- **Suggested fix**:
  - Store a `givelinkId` field on Task OS tasks at first sync.
  - Reverse-lookup by ID on subsequent syncs.
  - Surface a sync error toast when a match fails rather than silently duplicating.

---

### 10. Anthropic API version pinned to `2023-06-01`
- **What**: Both the proxy and Givelink's direct calls use `anthropic-version: '2023-06-01'`.
- **Where**: `api/claude.js:41`, `givelink.html:1135`, `givelink.html:1266`
- **Why it matters**: This locks out streaming responses, the web search tool, tool_choice, and all newer prompt caching features. Streaming alone would make AI plan-my-day feel instant instead of showing a spinner for 3–5 s.
- **Effort**: S
- **Suggested fix**: Update to `anthropic-version: '2025-01-01'` (or latest). Test each AI flow — no breaking changes expected for basic messages.

---

### 11. `window.prompt()` for CRM activity logging
- **What**: "Log Activity" in the Nonprofit CRM opens a native browser prompt dialog for the note.
- **Where**: `givelink.html:1431`
- **Why it matters**: `window.prompt()` is modal, unstyled, one-line only, and breaks muscle memory mid-workflow. Users writing multi-line follow-up notes can't do it here.
- **Effort**: S
- **Suggested fix**: Add a small inline textarea row that expands when "Log Activity" is clicked, styled consistently with the existing `.fc` form inputs.

---

### 12. `index.html` is >1MB / ~13,000 lines in one file
- **What**: The entire Arete app — styles, HTML, and all JavaScript — lives in a single HTML file.
- **Where**: `index.html` (entire file)
- **Why it matters**: No IDE autocomplete/linting works reliably at this scale; git diffs are unreadable; every feature collision risks breaking an unrelated flow. Cold-start parse time on low-end Android devices is measurable (>200ms script parse estimate).
- **Effort**: L
- **Suggested fix**:
  - Short-term: at minimum extract the `<style>` block to `app.css` and load it via `<link>`.
  - Medium-term: split logical modules (AI, Supabase sync, PWA, views) into separate `<script src>` files.
  - Long-term: move to a build step (Vite/esbuild) that bundles minified chunks with hash-based cache busting.

---

## 💡 P3 — Nice to have

### 13. Landing footer SVG depends on document-scoped gradient definition
- **What**: The footer's `<svg>` contains `<path stroke="url(#lg)">` but no `<defs>` — it borrows `#lg` from an SVG element earlier on the page.
- **Where**: `landing.html:634`
- **Why it matters**: Works in all current browsers (SVG defs are document-scoped) but breaks silently if the footer is ever server-rendered or the hero is removed. No visual regression now, but a trap for future editors.
- **Effort**: S
- **Suggested fix**: Duplicate the `<defs><linearGradient id="lg">...</linearGradient></defs>` block inside the footer SVG, or replace it with a hardcoded stroke color from the CSS variable.

---

### 14. Burndown chart gives no actionable feedback before 2 snapshots
- **What**: A new sprint shows "Complete tasks to see burndown progress" with no explanation.
- **Where**: `givelink.html:758-775` (`renderBurndown()`)
- **Why it matters**: New users don't know what a "snapshot" is or that they have to complete a task first. On day 1 of a sprint the chart is useless.
- **Effort**: S
- **Suggested fix**: Replace the empty message with a projected ideal line (tasks over sprint days) even before any real data exists, and add a tooltip: "Mark tasks done to track actual vs projected burndown."

---

### 15. FAB button in Givelink has no `aria-label`
- **What**: `<button class="fab" onclick="openAdd()">+</button>` has no accessible label.
- **Where**: `givelink.html:303`
- **Why it matters**: Screen readers announce it as "plus" or "button" — not actionable. The hamburger button correctly has `aria-label="Menu"` (line 218); the FAB should match.
- **Effort**: S
- **Suggested fix**: Add `aria-label="Add task"` to the FAB element.
