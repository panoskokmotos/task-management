# Givelink Codebase — Improvement Plan
_Generated 2026-09-10_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Anthropic API key exposed client-side via localStorage + dangerous header
**What**: Users' Anthropic API keys are stored in plaintext localStorage and sent from the browser using the `anthropic-dangerous-direct-browser-access: true` header — the name itself is a red flag.
**Where**: `givelink.html:1075–1088` (`getApiKey`), `givelink.html:1131–1137` (`runAiSprintPlanner` fetch), `givelink.html:1264–1266` (`callClaudeGL`)
**Why it matters**: Any XSS, browser extension, or devtools session can read `localStorage.getItem('taskos_api_key')` and steal the key. The key controls billing on the user's Anthropic account.
**Effort**: M
**Suggested fix**:
- Route all Anthropic calls through the existing `/api/claude` proxy instead of calling `api.anthropic.com` directly from the browser.
- Remove `getApiKey()` from `givelink.html` entirely; authenticate via Supabase session token which the proxy already supports.
- Delete `taskos_api_key` from localStorage on next load to clear leaked keys.

---

### 2. `save()` has no error handling — silent data loss on localStorage quota exceeded
**What**: Every mutation calls `localStorage.setItem('givelink_sprint', JSON.stringify(S))` with no try/catch. With 150+ seed tasks plus CRM records and sprint history, the payload easily grows past 2–4 MB; a QuotaExceededError is thrown silently and data changes are lost.
**Where**: `givelink.html:447`
**Why it matters**: Users think their task updates saved — they didn't. Closing the tab loses the work with no warning.
**Effort**: S
**Suggested fix**:
- Wrap `localStorage.setItem(...)` in try/catch and call `toast('Storage full — some data may not be saved.', 5000)` on error.
- Prune `S.snapshots` to the last 30 entries and archived task bodies before saving.

---

### 3. Service worker push notification icon path is wrong — broken icon on every notification
**What**: `sw.js:48–49` references `./icons/icon-192.png` (inside an `icons/` subdirectory) but the file lives at `./icon-192.png`. Every push notification shows a broken image.
**Where**: `sw.js:48, 49`
**Why it matters**: Push notifications are a retention mechanic; showing a broken icon on every one degrades trust.
**Effort**: S
**Suggested fix**:
- Change both `icon` and `badge` in `sw.js:48–49` from `./icons/icon-192.png` to `./icon-192.png`.

---

### 4. CSP in `vercel.json` blocks Inter font — users see system font fallback
**What**: `vercel.json` sets `style-src 'self' 'unsafe-inline'` (missing `https://fonts.googleapis.com`) and `font-src 'self'` (missing `https://fonts.gstatic.com`). `index.html` loads Inter via a `<link>` tag from Google Fonts. The CSP silently blocks it, so all users see the system font stack instead of Inter.
**Where**: `vercel.json` (headers block), `index.html:14–16`
**Why it matters**: The entire Arete UI was designed and pixel-polished with Inter. Every user sees a degraded experience. Also masks any future font-related performance wins.
**Effort**: S
**Suggested fix**:
- Add `https://fonts.googleapis.com` to `style-src` in `vercel.json`.
- Add `https://fonts.gstatic.com` to `font-src` in `vercel.json`.

---

### 5. `callClaudeGL()` swallows API errors — AI features fail silently
**What**: `callClaudeGL()` at line 1264 does not check `res.ok` before accessing `data.content[0].text`. A 401 (bad key), 429 (rate limit), or 529 (overload) returns a JSON body with an `error` field, not a `content` array. The access to `data.content?.[0]?.text` silently returns `null`, and downstream callers like `generateStandup()` display "Could not generate. Check your API key." for any error — masking rate limits, invalid models, and billing issues.
**Where**: `givelink.html:1256–1272` (contrast with the correct pattern in `runAiSprintPlanner` at line 1145)
**Why it matters**: Users can't diagnose failures. A rate-limited user thinks their key is wrong and re-enters it in a loop.
**Effort**: S
**Suggested fix**:
- Add `if (!res.ok) { toast('AI error ' + res.status + ': ' + (data.error?.message || res.statusText)); return null; }` after `const data = await res.json()`.
- Surface the error type in the UI (e.g. "Rate limit hit — try again in 30s" for 429).

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. `window.prompt()` for API key breaks the UX — looks like phishing
**What**: Two code paths — `getApiKey()` and `callClaudeGL()` — use `window.prompt()` to collect the Anthropic API key from the user. This triggers the browser's native dialog, which is styled by the OS, not the app, interrupts flow, and looks indistinguishable from an actual phishing prompt.
**Where**: `givelink.html:1086, 1261`
**Why it matters**: Sophisticated users (the target audience) will refuse to enter their API key in a native browser prompt. First-time AI feature use is the activation moment; this kills it.
**Effort**: M
**Suggested fix**:
- Add a styled in-app modal (reusing `.mo` / `.md`) with an API key field, a link to console.anthropic.com, and an explanation sentence before any AI feature runs.
- Better still: route through the `/api/claude` proxy so no user key is needed at all (see P0 item 1).

---

### 7. Givelink uses blue (#3b82f6) — fully off-brand from Givelink purple
**What**: `givelink.html` defines `--accent:#3b82f6` (Tailwind blue) and sets `<meta name="theme-color" content="#3b82f6">`. Every interactive element — nav active states, buttons, progress fills, focus rings, task borders on hover — is rendered in blue. The Givelink brand palette is purple (#6B3FA0 / #5718CA).
**Where**: `givelink.html:6` (meta theme-color), `givelink.html:17` (CSS root --accent and --prog)
**Why it matters**: Givelink and Arete (Task OS) are being positioned as separate products. Blue Givelink undermines that separation and signals an unfinished product.
**Effort**: S
**Suggested fix**:
- Replace `--accent:#3b82f6` with `--accent:#5718CA` (or `#6B3FA0` for the lighter variant).
- Update `theme-color` meta to match.
- Check and update `--prog` if it should also be purple. The `--np` (nonprofits) pillar color `#60a5fa` can remain blue for the pillar indicator dots.

---

### 8. Givelink missing Inter font — inconsistent with Arete
**What**: `givelink.html:21` uses the browser default system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`). Arete (index.html) loads and uses Inter from Google Fonts.
**Where**: `givelink.html:21`
**Why it matters**: Side-by-side use (navigating from Arete to Givelink via the "Sprint Board" link) reveals a jarring font switch. Product quality signal.
**Effort**: S
**Suggested fix**:
- Add `<link rel="preconnect" href="https://fonts.googleapis.com">` and the Inter `<link>` tag (same as in index.html) to the `<head>` of `givelink.html`.
- Update the `font-family` in `body` to `'Inter', -apple-system, ...`.

---

### 9. Task priority badge shows raw lowercase value, not the label
**What**: `taskHTML()` at line 666 renders `${t.priority||'medium'}` directly in the badge span — outputting "high", "medium", "low" in lowercase — while `goalHTML()` and other status badges correctly use `STATUS[t.status]?.l` for the display label.
**Where**: `givelink.html:666`
**Why it matters**: Small polish issue visible on every task row. Makes the UI look unfinished, especially next to the cleanly-labeled status badges.
**Effort**: S
**Suggested fix**:
- Replace `${t.priority||'medium'}` with `${PRI[t.priority]?.l||'Medium'}` to output "High", "Medium", "Low".

---

### 10. CRM kanban columns show no empty-state prompt — users don't know what to do
**What**: Empty pipeline stages (e.g. Proposal, Lost) render as blank columns with no visible affordance. The "Add Org" button is only in the page header, not near the empty column.
**Where**: `givelink.html:1317–1337` (kanban column render)
**Why it matters**: New users who add a nonprofit and want to move it through stages get no visual feedback in empty columns — the interaction model is invisible.
**Effort**: S
**Suggested fix**:
- Add `${cards.length === 0 ? '<div style="font-size:11px;color:var(--muted);text-align:center;padding:12px 4px;">No orgs here</div>' : ''}` inside the column render.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `index.html` is a 1MB+ single file — impossible to maintain or review
**What**: The entire Arete app lives in one HTML file exceeding 1 MB. Git diffs for this file span hundreds of lines; code review is effectively impossible; test coverage is zero; every feature gets jammed into one file.
**Where**: `index.html` (entire file)
**Why it matters**: Every new feature adds friction. Bugs introduced in one section can silently affect others. Onboarding a second developer would be extremely hard.
**Effort**: L
**Suggested fix**:
- Split into logical ES modules: `data.js`, `ui.js`, `ai.js`, `sync.js`, `views/*.js`.
- Start with extracting standalone features (AI planner, CRM, standup) into separate `<script type="module" src="...">` files. No framework required.
- Keep the HTML shell thin; each feature module registers itself.

---

### 12. `api/claude.js` has no rate limiting — explicitly flagged as missing
**What**: The proxy comment on line 12–13 explicitly warns: "this is a minimal proxy. For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill." No rate limiting has been added.
**Where**: `api/claude.js:12–13, 33–47`
**Why it matters**: If the proxy is enabled with a server-side key, any authenticated user can make unlimited API calls. With 100 users each running the sprint planner, that's thousands of dollars in Claude costs.
**Effort**: M
**Suggested fix**:
- Add Upstash Redis rate limiting: check a per-user-token counter before proxying, return 429 if over limit (e.g. 20 calls/hour).
- Log usage per user so cost attribution is possible.

---

### 13. Duplicate API call implementations — `runAiSprintPlanner` reimplements `callClaudeGL`
**What**: `runAiSprintPlanner()` (lines 1097–1161) makes a full direct Anthropic API `fetch` with its own headers, error handling, and model config. `callClaudeGL()` (lines 1256–1272) is the shared utility that does the same thing. The sprint planner predates the shared helper but was never refactored to use it.
**Where**: `givelink.html:1097–1161, 1256–1272`
**Why it matters**: Any change to API version, auth headers, or error handling must be made in two places. The sprint planner's error handling is better than the shared helper — divergence guarantees bugs.
**Effort**: S
**Suggested fix**:
- Refactor `runAiSprintPlanner()` to call `callClaudeGL(prompt, 1024, 'claude-opus-4-5')` and remove the inline fetch block.
- Fix `callClaudeGL()` to check `res.ok` first (see P0 item 5), then this refactor is safe.

---

### 14. `claude-opus-4-5` model ID in sprint planner is a legacy/deprecated alias
**What**: `givelink.html:1140` specifies `model: 'claude-opus-4-5'` in the sprint planner fetch. This is not a valid versioned model ID (it lacks a date suffix). Anthropic deprecated short aliases; the correct ID is `claude-opus-4-5-20241205` or the latest Opus model.
**Where**: `givelink.html:1140`
**Why it matters**: When Anthropic drops the alias, the sprint planner silently breaks with a 400 error.
**Effort**: S
**Suggested fix**:
- Replace `'claude-opus-4-5'` with `'claude-opus-4-5-20241205'` (or the intended latest Opus model ID). Use a `const MODEL_FAST` / `MODEL_SMART` pattern at the top of the script so model IDs are centralized.

---

### 15. Burndown SVG has hardcoded pixel dimensions — broken on mobile
**What**: `renderBurndown()` at line 763 sets `W=280, H=100` as fixed pixel constants and generates inline SVG with those values. On mobile (320px wide content area) the chart clips. On wide desktop it looks tiny.
**Where**: `givelink.html:763–775`
**Why it matters**: The burndown chart is the only data visualization in the overview — it's the first thing you see. On mobile it's broken out of the box.
**Effort**: S
**Suggested fix**:
- Use `viewBox="0 0 280 100"` with `width="100%"` and `preserveAspectRatio="none"` instead of fixed `width`/`height` attributes.
- Or read `element.clientWidth` to set `W` dynamically before generating the SVG.

---

## 💡 P3 — Nice to have

### 16. No `.env.example` documents required environment variables
**What**: `api/claude.js` requires `ANTHROPIC_API_KEY`, and optionally `SUPABASE_URL` / `SUPABASE_ANON_KEY`, but there is no `.env.example` in the repo. A new developer or deployment will miss these.
**Where**: `api/claude.js:5–8` (setup comments only)
**Effort**: S
**Suggested fix**: Create `.env.example` with all three vars as commented placeholders.

---

### 17. FAB and modal close buttons have no ARIA labels — screen readers say "button"
**What**: `<button class="fab" onclick="openAdd()">+</button>` (line 303) and `<button class="mc" onclick="closeM('tm')">×</button>` (line 317) have no `aria-label`. Screen readers announce them as "button", not "Add task" or "Close dialog".
**Where**: `givelink.html:303, 317, 363, 373, 411, 414`
**Effort**: S
**Suggested fix**: Add `aria-label="Add task"` and `aria-label="Close"` respectively. Add `role="dialog"` and `aria-labelledby` to modal containers.

---

### 18. Service worker cache key `arete-20260723` is hardcoded — stale caches on deploy
**What**: `sw.js:1` sets `const CACHE = 'arete-20260723'`. This date does not update automatically on deploy. Users who previously cached the app under this key will continue serving the old version even after a new deploy, until the cache key changes.
**Where**: `sw.js:1`
**Effort**: S
**Suggested fix**: Generate the cache key at build time (e.g. via a build script or CI step) so it changes with each deployment. Even a commit-hash suffix (stamped during deploy) would work.

---

### 19. Backlog "→ Sprint" inline button is too small for mobile tap targets
**What**: The "→ Sprint" button in `renderBacklog()` at line 615 uses class `btn bg sm` (padding: 3px 8px, font-size: 11px). On mobile this creates a tap target of roughly 26×20px — well below the WCAG 2.5.5 recommended 44×44px minimum.
**Where**: `givelink.html:615`
**Effort**: S
**Suggested fix**: On mobile viewports, increase button padding to at least `6px 12px` for this button. Or replace with a swipe-to-sprint gesture on mobile.

---

### 20. `supabase-setup.sql` is in the public repo with no RLS policy documentation
**What**: The schema file is public. While the schema itself is not sensitive, there's no accompanying comment or README section explaining which Row Level Security policies must be enabled for the app to be secure — a future contributor could deploy without RLS and expose all user data.
**Where**: `supabase-setup.sql`
**Effort**: S
**Suggested fix**: Add `-- Enable RLS: ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;` comments for each table, and link to the Supabase RLS docs.
