# Givelink / Arete — Improvement Plan
> Generated 2026-08-29 · Codebase: `index.html` (>1 MB), `givelink.html` (1 756 lines), `landing.html`, `api/claude.js`, `sw.js`

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. `renderVelocityStats()` duplicates stat cards on every Overview render
- **What**: `ov-stats.innerHTML +=` appends two extra cards (tasks/day, on/off-track) rather than replacing them, so each click of the Overview tab multiplies the stat row.
- **Where**: `givelink.html:1551`
- **Why it matters**: Every founder visit to the Overview shows an increasingly broken, doubled stat section — visible corruption on the flagship view.
- **Effort**: S
- **Suggested fix**:
  - Render the velocity cards inside `renderOverview()` directly, folded into the `ov-stats.innerHTML` assignment at line 518.
  - Remove the standalone `renderVelocityStats()` call at line 544.
  - Alternatively, give the velocity stat cells explicit IDs and update via `textContent` instead of `innerHTML +=`.

---

### 2. `load()` has no error handling — corrupted localStorage crashes the whole app
- **What**: `JSON.parse(localStorage.getItem('givelink_sprint'))` throws if data is malformed; there is no try/catch, killing the app on load.
- **Where**: `givelink.html:448`
- **Why it matters**: A partial browser write, a storage migration edge case, or a browser update corrupting the key leaves the user staring at a blank page with no recovery path.
- **Effort**: S
- **Suggested fix**:
  - Wrap the `JSON.parse` in try/catch; on error, log to console and proceed with the default `S` object (effectively a fresh start).
  - Optionally show a one-time toast: "Restored from default — previous data could not be read."

---

### 3. AI Sprint Planner uses an invalid Claude model ID (`claude-opus-4-5`)
- **What**: `runAiSprintPlanner()` requests model `claude-opus-4-5`, which is not a valid Anthropic model ID — valid variants are `claude-opus-5`, `claude-opus-4-7`, etc.
- **Where**: `givelink.html:1140`
- **Why it matters**: Every click of "✨ Generate" fails silently with a 400-class error. The AI Sprint Planner is completely non-functional.
- **Effort**: S
- **Suggested fix**:
  - Change the model string to `claude-haiku-4-5-20251001` (already used correctly in `callClaudeGL`) to keep cost low, or `claude-sonnet-5` for higher quality.
  - Better: route through the existing `/api/claude` proxy (see P0 #4) so the model is controlled server-side.

---

### 4. `givelink.html` bypasses the Claude proxy — directly exposes/prompts for API key
- **What**: `runAiSprintPlanner()` and `callClaudeGL()` hit `api.anthropic.com` directly from the browser, storing the key in `localStorage` and surfacing it via `window.prompt()`.
- **Where**: `givelink.html:1086-1088` (`getApiKey`), `1131` (`runAiSprintPlanner`), `1264` (`callClaudeGL`)
- **Why it matters**: (a) `window.prompt()` is blocked in many PWA/fullscreen contexts, making AI features silently inaccessible. (b) The API key in `localStorage` is readable by any JavaScript on the page (XSS risk). (c) `api/claude.js` exists specifically to proxy these calls but is ignored here.
- **Effort**: M
- **Suggested fix**:
  - Replace all direct `fetch('https://api.anthropic.com/...')` calls in `givelink.html` with `fetch('/api/claude', { method: 'POST', body: JSON.stringify({ prompt, max_tokens }) })`.
  - Remove `getApiKey()` and the `taskos_api_key` localStorage path entirely.
  - Gate `api/claude.js` on Supabase auth (already implemented) so the proxy is safely shared.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. PostHog key is blank on the landing page — no funnel data at all
- **What**: `POSTHOG_KEY = ''` in the analytics block; every `track()` call is a silent no-op.
- **Where**: `landing.html:702`
- **Why it matters**: The landing → app CTA funnel is completely dark. You can't see scroll depth, hero demo views, or which CTA button drives signups — the exact metrics needed to optimise conversion.
- **Effort**: S
- **Suggested fix**:
  - Paste the same PostHog project key used in `index.html`'s `APP_CONFIG.posthogKey` into `POSTHOG_KEY`.
  - The same key + same origin means landing → signup events auto-join in PostHog funnels with zero extra config.

---

### 6. Standup generator "yesterday" looks 48 h back instead of 24 h
- **What**: `yesterday.setDate(now.getDate() - 2)` subtracts two days, so tasks completed yesterday don't show up in the standup.
- **Where**: `givelink.html:1488`
- **Why it matters**: The Daily Standup AI feature produces output that misses the most recent work — "Yesterday: nothing completed" is the likely result every morning, destroying trust in the feature.
- **Effort**: S
- **Suggested fix**:
  - Change `-2` to `-1`.
  - For robustness, use `Date.now() - 86_400_000` instead of calendar-date arithmetic.

---

### 7. No rate limiting on the `/api/claude` proxy
- **What**: Any authenticated user can call `/api/claude` unlimited times; the file's own comment flags this gap.
- **Where**: `api/claude.js:13`
- **Why it matters**: A single account (or compromised session token) can exhaust the Anthropic API budget overnight. As user count grows this becomes a real cost risk.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting: 20 requests per user per hour (one `npm install @upstash/ratelimit` + 5 lines).
  - Alternatively, track call count in Supabase using the existing `app_state` table.
  - Return `429 Too Many Requests` with a `Retry-After` header.

---

### 8. Footer SVG logo has no gradient in Firefox (broken ID cross-reference)
- **What**: The footer SVG (`landing.html:634`) references `stroke="url(#lg)"` but `<linearGradient id="lg">` is only defined inside the nav SVG. Firefox isolates SVG IDs to their element; the footer logo renders with no stroke/color.
- **Where**: `landing.html:634`
- **Why it matters**: The footer logo is invisible or black on Firefox — brand presentation degrades on a significant browser segment.
- **Effort**: S
- **Suggested fix**:
  - Add a `<defs>` block with the same gradient inside the footer SVG element, or
  - Define the gradient once in a hidden `<svg>` at the top of `<body>` and reference it from both places.

---

### 9. Push notifications show no icon (wrong path in service worker)
- **What**: The push event handler sets `icon: './icons/icon-192.png'` but the actual file lives at `./icon-192.png` (no `icons/` subdirectory).
- **Where**: `sw.js:46-47`
- **Why it matters**: Every push notification the app sends arrives without an icon, looking like a generic browser notification with no brand identity.
- **Effort**: S
- **Suggested fix**:
  - Change `'./icons/icon-192.png'` → `'./icon-192.png'` in both the `icon` and `badge` fields.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `index.html` exceeds 1 MB — the entire app in one file
- **What**: The main Task OS app is a single >1 MB HTML file mixing CSS, HTML structure, and JS.
- **Where**: `index.html` (entire file)
- **Why it matters**: Parse/eval time impacts first load on low-end devices; the file is too large to read in one editor window; any change requires verifying nothing else in 1 MB broke. Diff reviews are noise-heavy.
- **Effort**: L
- **Suggested fix**:
  - Extract CSS into `styles.css` and JS into `app.js` as a first step (already cache-busted by the SW via the `CACHE` key).
  - Consider splitting into feature modules (tasks, goals, habits) loaded on demand.
  - No framework required — a simple `<script src="app.js">` split reduces effective complexity immediately.

---

### 11. `givelink.html` is 1 756 lines — all logic inline
- **What**: Sprint board, CRM, AI features, PWA logic and seed data are all one file with no separation.
- **Where**: `givelink.html` (entire file)
- **Why it matters**: Five distinct features (Sprint, CRM, Standup, Velocity, Outreach) sharing one file makes debugging and iteration slow; it's already past the 300-line review threshold.
- **Effort**: M
- **Suggested fix**:
  - Extract `SEED_DATA` to a separate `givelink-seed.js` (reduces file by ~300 lines).
  - Move `callClaudeGL` and the three AI feature functions to `givelink-ai.js`.
  - Leave the render/state core in the main file.

---

### 12. Duplicate API key resolution logic in two places
- **What**: `getApiKey()` (`givelink.html:1075`) and `callClaudeGL()` (`givelink.html:1257`) both independently walk `taskos_profiles` / `taskos` / `taskos_api_key` with slightly different fallback chains.
- **Where**: `givelink.html:1075-1088` and `1257-1262`
- **Why it matters**: Key retrieval diverged — `getApiKey()` checks `d.apiKey`, `callClaudeGL` checks `p.claudeKey`. A key stored under one name isn't found by the other. Silent failure: AI features break for some users depending on which storage path their key landed in.
- **Effort**: S
- **Suggested fix**:
  - Consolidate into a single `resolveApiKey()` function that covers all paths once (or, better, remove both and route via the proxy per P0 #4).

---

### 13. No `.env.example` — new contributors can't set up the proxy
- **What**: `api/claude.js` requires `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` in Vercel env vars. There is no `.env.example` or documentation of this in the repo root.
- **Where**: `api/claude.js:8-10` (setup comment), repo root (missing file)
- **Why it matters**: A contributor or new Vercel deploy will get a 500 error with no hint of why; the three-step setup comment in the file is the only breadcrumb.
- **Effort**: S
- **Suggested fix**:
  - Add `.env.example` with: `ANTHROPIC_API_KEY=sk-ant-...`, `SUPABASE_URL=https://xxx.supabase.co`, `SUPABASE_ANON_KEY=eyJ...`
  - Reference it from the README.

---

## 💡 P3 — Nice to have

### 14. `window.prompt()` for API key is blocked in PWA / fullscreen mode
- **What**: When `givelink.html` is installed as a PWA or runs in standalone display mode, `window.prompt()` may be blocked or suppressed by the browser.
- **Where**: `givelink.html:1086, 1261`
- **Why it matters**: Installed users (the target audience for the PWA) silently get no AI features with no explanation.
- **Effort**: S (if proxy route from P0 #4 is done, this becomes moot)
- **Suggested fix**:
  - If not routing via proxy: replace `window.prompt()` with a small inline modal (reuse the existing `.mo` / `.md` pattern) for key entry.

---

### 15. `landing.html` nav links hidden on mobile — no hamburger menu
- **What**: `.nav-links { display: none }` at `< 760px` (`landing.html:291`) hides Features / FAQ / Privacy links with no alternative navigation.
- **Where**: `landing.html:291`
- **Why it matters**: Mobile visitors (likely >50% of landing traffic) can't navigate sections without scrolling. The hero "See how it works" scroll anchor is the only escape.
- **Effort**: S
- **Suggested fix**:
  - Add a minimal hamburger that toggles a full-screen nav overlay, reusing the same CSS pattern already implemented in `givelink.html` (`.ham-btn` / `.sb-ov`).

---

### 16. Seed data in `givelink.html` runs silently every first load
- **What**: If `S.seeded` is absent (new user, manual reset, or partial localStorage), ~120 sample tasks are injected without any opt-in.
- **Where**: `givelink.html:883-1072`
- **Why it matters**: A returning user who cleared storage loses their blank-slate expectation; the seeded data looks like a demo, not their own work. Confusion lowers trust.
- **Effort**: S
- **Suggested fix**:
  - On first load, show a welcome modal with "Start with a demo sprint" vs. "Start blank". Only call `seed()` on explicit opt-in.

---

### 17. Landing page `<link rel="canonical">` points to the Vercel preview URL
- **What**: `<link rel="canonical" href="https://task-management-beige-eight.vercel.app/">` (`landing.html:11`) uses the auto-generated Vercel preview hostname instead of the production domain.
- **Where**: `landing.html:11`
- **Why it matters**: If the product ever moves to a custom domain (e.g., `givelink.io` or `arete.app`), all SEO equity stays split between two URLs; Google may canonicalize the wrong one.
- **Effort**: S
- **Suggested fix**:
  - Replace the canonical URL and all `og:url` / `og:image` absolute URLs with the real production domain.
  - Parameterise via a build step or Vercel edge config if the domain isn't yet final.

---

### 18. `supabase-setup.sql` missing delete policy for `app_state`
- **What**: RLS policies cover `select`, `insert`, and `update` but not `delete`. A user cannot delete their own row (e.g., full account wipe / GDPR request).
- **Where**: `supabase-setup.sql:16-30`
- **Why it matters**: GDPR "right to erasure" can't be honored via the app if the row-level delete policy is absent; deletion requires a service-role bypass.
- **Effort**: S
- **Suggested fix**:
  - Add: `create policy "app_state delete own" on public.app_state for delete using (auth.uid() = user_id);`

---

*Total: 18 items across 4 tiers. All P0 items are S or M effort and unblock active user flows.*
