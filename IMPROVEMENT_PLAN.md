# Givelink Codebase — Improvement Plan
> Generated: 2026-08-21 · Scope: `givelink.html`, `index.html`, `api/claude.js`, `sw.js`, `landing.html`, `vercel.json`

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icon silently 404s
- **What**: Service worker references a non-existent icon path for push notifications.
- **Where**: `sw.js:46,50` — `'./icons/icon-192.png'` (note: `/icons/` subdirectory) vs actual location `./icon-192.png`
- **Why it matters**: Every push notification arrives without an icon, degrading trust and the perceived quality of the PWA on mobile.
- **Effort**: S
- **Suggested fix**:
  - Change `'./icons/icon-192.png'` → `'./icon-192.png'` on both lines 46 and 50 in `sw.js`
  - Bump the `CACHE` constant so devices pick up the new SW

---

### 2. AI Sprint Planner calls a non-existent model ID
- **What**: The AI Sprint Planner sends requests to `claude-opus-4-5`, which is not a valid current model identifier.
- **Where**: `givelink.html:1143` — `model:'claude-opus-4-5'`
- **Why it matters**: Every click of "✨ Generate" returns a model-not-found API error. The feature is completely broken for users.
- **Effort**: S
- **Suggested fix**:
  - Replace `'claude-opus-4-5'` with `'claude-haiku-4-5-20251001'` (same model used in `callClaudeGL`) or `'claude-sonnet-5'`
  - Consider routing through `api/claude.js` proxy instead of calling Anthropic directly from the browser

---

### 3. API key captured via `window.prompt()` and stored in `localStorage`
- **What**: Anthropic API key is collected via the native `prompt()` dialog and persisted in `localStorage['taskos_api_key']`.
- **Where**: `givelink.html:1086` (`getApiKey`), `givelink.html:1261` (`callClaudeGL`)
- **Why it matters**: (a) `window.prompt()` is blocked in PWA standalone mode and some mobile browsers, silently breaking all AI features. (b) The key is readable by any injected script on the page. (c) UX is jarring and looks broken.
- **Effort**: M
- **Suggested fix**:
  - Add a small inline settings modal with a proper `<input type="password">` field for the key
  - Better: route all AI calls through the existing `api/claude.js` Vercel proxy so users never need to enter a key
  - Remove `localStorage.setItem('taskos_api_key', k)` pattern; store encrypted or not at all

---

### 4. Seed sprint dates are 5 months in the past for all new users
- **What**: The default seed data hard-codes `start:'2026-03-28', end:'2026-04-11'` as the current sprint dates.
- **Where**: `givelink.html:437`
- **Why it matters**: Every new user opens the app to a sprint that ended 5 months ago. The sprint bar shows negative days left, the burndown chart is meaningless, and the ETA chips show "Stalled" across all goals. First impression is broken.
- **Effort**: S
- **Suggested fix**:
  - Compute the sprint window dynamically from `new Date()` in the `seed()` function: start = today, end = today + 14 days
  - Or prompt the user to set a sprint on first open via a lightweight onboarding step

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. `window.confirm()` and `window.prompt()` break delete and log-activity in PWA mode
- **What**: Task deletion uses `confirm()`, activity logging uses `prompt()` — both are suppressed in standalone PWA mode on iOS/Android.
- **Where**: `givelink.html:732` (`delCur`), `givelink.html:1432` (`logActivityNP`), `givelink.html:1424` (`deleteNP`)
- **Why it matters**: Users who installed the app to their home screen (the primary PWA use case) cannot delete tasks or log nonprofit activity. These flows silently do nothing.
- **Effort**: M
- **Suggested fix**:
  - Replace `confirm('Delete?')` with a confirmation step inside the existing task modal (already has a Delete button)
  - Replace `prompt('Log activity...')` with a small inline text input in the NP modal footer
  - Both can reuse existing `.mo` / `.md` modal markup already in the file

---

### 6. AI errors show a generic "Check your API key" regardless of actual cause
- **What**: `callClaudeGL` and `runAiSprintPlanner` display misleading error messages when requests fail due to rate limits, invalid model, or server errors.
- **Where**: `givelink.html:1145,1157-1159` (`runAiSprintPlanner`), `givelink.html:1271` (`callClaudeGL`)
- **Why it matters**: A rate-limited or server-side error tells the user to "check their API key" — which is fine and working. Users waste time re-entering valid keys.
- **Effort**: S
- **Suggested fix**:
  - Parse the error response body in `callClaudeGL`: `if(!res.ok){ const e=await res.json(); toast('AI error: '+(e.error?.message||res.status)); return null; }`
  - In `runAiSprintPlanner`, surface the HTTP status in the error div rather than a raw `e.message`

---

### 7. Backlog → Task OS sync uses fragile title-matching and creates silent duplicates
- **What**: `syncToTaskOS()` matches sprint tasks to Task OS tasks by lowercased title. A single renamed or slightly rephrased task creates a duplicate on next sync.
- **Where**: `givelink.html:1220-1248`
- **Why it matters**: Over a sprint cycle the Task OS inbox fills with stale duplicates. Sync is a trust-building feature; unreliable sync destroys trust faster than no sync.
- **Effort**: M
- **Suggested fix**:
  - Add a `glinkId` field when writing tasks to Task OS (`tosData.tasks.push({..., glinkId: gt.id})`)
  - On subsequent syncs, match by `glinkId` instead of title
  - Show a sync status count breakdown (updated / added / skipped) in the toast

---

### 8. Givelink brand accent (#3b82f6 blue) diverges from documented brand palette
- **What**: `givelink.html` uses `--accent:#3b82f6` (Tailwind blue) as the primary brand color. The specified brand palette is purple `#6B3FA0`/`#5718CA` with pink accent `#C2185B`/`#E353B6`.
- **Where**: `givelink.html:17` (`:root` block)
- **Why it matters**: When donors or nonprofit staff see Givelink marketing (purple) and then open the app (blue), the disconnect signals an unfinished product. Brand consistency is a direct trust signal in the nonprofit/philanthropy space.
- **Effort**: M
- **Suggested fix**:
  - Update `--accent` to `#5718CA`, add `--accent-soft:rgba(87,24,202,.15)`
  - Update pillar pip colors to harmonize: Growth → keep green `#4ade80`, Product → shift from pink `#f472b6` to a purple-adjacent tone to avoid pink-on-purple rendering
  - Test contrast ratios on the dark background `#070d1a` (WCAG AA requires 4.5:1 for text)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. `givelink.html` is a 1756-line monolith with 6+ unrelated features
- **What**: Sprint board, Nonprofit CRM, AI standup, AI email generator, velocity monitor, and impact widget are all in a single HTML file with no separation.
- **Where**: `givelink.html` (entire file)
- **Why it matters**: Any edit to the CRM risks accidentally breaking the sprint board. Features can't be tested in isolation. File takes 3+ seconds to parse in DevTools.
- **Effort**: L
- **Suggested fix**:
  - Extract `<script>` sections into separate `.js` files (`crm.js`, `ai.js`, `pwa.js`) and load via `<script src>` or a bundler
  - Keep the data model (`S`) and persistence (`save`/`load`) in a shared `data.js`
  - No need for a full build system — even unbundled `<script src>` files improve readability and debuggability

---

### 10. Serverless proxy (`api/claude.js`) exists but is never used by Givelink
- **What**: The repo ships a Vercel serverless function that proxies Anthropic calls through a server-side key with optional Supabase auth — but `givelink.html` ignores it and calls `api.anthropic.com` directly from the browser.
- **Where**: `givelink.html:1131`, `api/claude.js` (entire file)
- **Why it matters**: The proxy was built to prevent key exposure, but the Givelink page makes it redundant. Users still need their own key, the proxy is dead code, and CORS headers for `api.anthropic.com` are only allowed because of `'anthropic-dangerous-direct-browser-access':'true'`.
- **Effort**: M
- **Suggested fix**:
  - Update `callClaudeGL` to POST to `/api/claude` with `{prompt, max_tokens}`
  - Gate with Supabase session header if desired (already supported in the proxy)
  - Remove the `getApiKey()` function and all `localStorage` key storage

---

### 11. All Givelink data lives exclusively in `localStorage` with no export
- **What**: Sprint tasks, goals, CRM nonprofits, activity logs, and past sprints all exist only in `localStorage['givelink_sprint']`. No backup, no export, no cloud sync.
- **Where**: `givelink.html:447-448` (`save`/`load`)
- **Why it matters**: One clear-site-data, private browsing session, or browser update can wipe months of CRM pipeline history. For a product managing nonprofit relationships, data loss is reputationally catastrophic.
- **Effort**: L
- **Suggested fix**:
  - Add an "Export JSON" button in Sprint Settings that `JSON.stringify(S)` and triggers a download
  - Long-term: sync `S` to Supabase on every `save()` call using the existing `_SB` infrastructure in `index.html`

---

### 12. Non-standard DOM property pattern for AI-generated text passthrough
- **What**: `body._text = text` writes data to a DOM element property to pass the AI-generated text to the copy button handler. This is not part of the DOM spec and silently fails if the element is replaced.
- **Where**: `givelink.html:1510, 1519` (standup), `givelink.html:1663, 1664` (email generator)
- **Why it matters**: If any DOM re-render replaces the `#standup-body` element, `_text` is gone and "📋 Copy" silently copies placeholder text. A module-level variable is safer and easier to reason about.
- **Effort**: S
- **Suggested fix**:
  - Replace `body._text = text` with a module-scoped `let _standupText = ''` and `let _outreachText = ''`
  - Copy handlers read from the module variable, not the DOM node

---

## 💡 P3 — Nice to have

### 13. Burndown chart missing Y-axis labels and "no data" empty state
- **What**: The burndown SVG has no Y-axis values and the "< 2 snapshots" empty state is only shown after the first task completion.
- **Where**: `givelink.html:754-775` (`renderBurndown`)
- **Why it matters**: New users see an empty white box for their first sprint day with no hint of what the chart will show. The chart also doesn't show total task count on the Y-axis, making the ideal line unreadable.
- **Effort**: S

### 14. No keyboard shortcut to open Givelink from Task OS (dead link context)
- **What**: `index.html` sidebar has an `← Task OS` / `🔗 Sync to Task OS` crosslink but no keyboard shortcut equivalent. Users switching between the two apps must grab the mouse.
- **Where**: `givelink.html:225` (sidebar link), `givelink.html:254` (sync button)
- **Effort**: S

### 15. `landing.html` canonical URL is a Vercel preview domain, not a custom domain
- **What**: `<link rel="canonical">` and all OG/Twitter `og:url` tags point to `task-management-beige-eight.vercel.app`.
- **Where**: `landing.html:11-21`
- **Why it matters**: If/when a custom domain is attached, search engines will index the preview URL, not the canonical one. Fixing after indexing requires waiting for re-crawl.
- **Effort**: S

### 16. ARIA labels missing on task checkboxes and pillar cards
- **What**: `.ck2` checkboxes render as `<div>` elements with no role, no `aria-label`, and no `aria-checked` state. Pillar cards (`pcard`) are `<div>` with `onclick` but no `role="button"`.
- **Where**: `givelink.html:81-83` (`.ck2`), `givelink.html:529` (pillar card divs)
- **Why it matters**: Screen reader users cannot determine which task is being checked or navigate pillar cards via keyboard.
- **Effort**: M

### 17. `Content-Security-Policy` allows `'unsafe-inline'` scripts
- **What**: `vercel.json:15` sets `script-src 'self' 'unsafe-inline'`, permitting inline `<script>` execution site-wide.
- **Where**: `vercel.json:15`
- **Why it matters**: Inline scripts are the primary XSS vector. With `unsafe-inline`, any reflected or stored XSS bypasses the CSP entirely. The codebase uses inline `<script>` blocks extensively, so fixing this requires nonces or hash-based CSP — a meaningful refactor, but the risk compounds as the app grows.
- **Effort**: L
