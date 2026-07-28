# Arete — Improvement Plan
_Generated 2026-07-28. Max 20 items, ordered by ROI within each tier._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Google Fonts blocked by own CSP — Inter never loads
- **What**: `vercel.json` CSP sets `style-src 'self' 'unsafe-inline'` and `font-src 'self'`, but `index.html` loads Inter from `fonts.googleapis.com` / `fonts.gstatic.com`. The external stylesheet is blocked; every user sees fallback system fonts.
- **Where**: `vercel.json:15` (CSP header), `index.html:14–16` (font preconnect + stylesheet link)
- **Why it matters**: The entire visual identity is built on Inter. Without it, the app looks broken and unprofessional to every user on every visit.
- **Effort**: S
- **Suggested fix**:
  - Add `fonts.googleapis.com` to `style-src` and `fonts.gstatic.com` to `font-src` in the CSP, **or**
  - Self-host the Inter subset (download from `google-webfonts-helper`) and serve from `/fonts/` — eliminates the third-party dependency entirely
  - Preferred: self-host; eliminates the CSP complexity and removes a third-party SPOF

---

### 2. Claude API key synced to Supabase in plaintext
- **What**: `S.claudeKey` is part of the main state blob `S` which gets synced to the Supabase `user_data` table on every `save()` call. Users' personal Anthropic API keys are stored unencrypted server-side.
- **Where**: `index.html:2517` (S definition, `claudeKey:''`), `index.html:9917` (`S.claudeKey=k; save();`), `index.html:5022` (usage in direct API calls)
- **Why it matters**: An API key in the database is a credential leak waiting to happen. If the Supabase project is ever misconfigured or breached, every user who entered their own key is compromised.
- **Effort**: S
- **Suggested fix**:
  - Move `claudeKey` out of `S` — store and read it directly from `localStorage` using a key like `taskos_api_key`, same pattern as `taskos_readwise_key` and `taskos_notion_key`
  - Remove `claudeKey` from the S initializer so it never enters the sync blob

---

### 3. Starter seed tasks are Panos-specific and shown to every new user
- **What**: The default first-run seed tasks (lines 4546–4629) include "Nonprofits Board Follow Ups", "Greek Nonprofits Board (Make-A-Wish etc)", "Run Greece competitor checks + systems" — highly personal Givelink/Panos tasks. The default `profileName` is `'Panos'`, so every new user is greeted with "Good morning, Panos 👋".
- **Where**: `index.html:2519` (profileName default), `index.html:4540–4635` (seed task block)
- **Why it matters**: New users see someone else's tasks and name. This breaks the "magic moment" onboarding and signals the app is personal rather than a real product.
- **Effort**: S
- **Suggested fix**:
  - Change `profileName` default from `'Panos'` to `'You'` or `''` (prompt on first run)
  - Replace Givelink/Panos-specific seed tasks with generic demo tasks ("Write the project proposal", "Call dentist", "Read for 30 minutes") that resonate with any user
  - Keep the Givelink-category seed only if Givelink-mode is detected (e.g. visiting `/givelink`)

---

### 4. `aiProxy` is empty — AI features are completely broken for real users
- **What**: `APP_CONFIG.aiProxy` is `''` at `index.html:9959`. Every AI function checks `!S.claudeKey&&!APP_CONFIG.aiProxy` and shows "Add your Claude API key in Settings". The serverless proxy at `api/claude.js` is implemented but its URL is never configured.
- **Where**: `index.html:9959` (`aiProxy: ''`), `api/claude.js` (proxy implementation, never deployed/referenced)
- **Why it matters**: AI triage, day planning, Reply-to-Act, and 20+ other AI features are the core product differentiator. Every new user who doesn't know what an Anthropic API key is (i.e., most users) gets zero AI features.
- **Effort**: M
- **Suggested fix**:
  - Deploy `api/claude.js` on Vercel (already in the repo, just needs `ANTHROPIC_API_KEY` env var set)
  - Set `aiProxy` to the deployed URL (e.g. `'https://task-management-beige-eight.vercel.app/api/claude'`)
  - Add per-user rate limiting (see P1 item 5 below) before deploying to prevent cost runaway

---

### 5. XSS via unescaped task/goal titles in weekly review wizard HTML
- **What**: The weekly review wizard injects `t.title` and `g.title` directly into `innerHTML` strings without calling `esc()`. A task title containing `<img src=x onerror=alert(document.cookie)>` would execute JavaScript when the user opens the review.
- **Where**: `index.html:3594` (completed tasks step), `index.html:3601` (backlog promotion step), `index.html:3603` (goal progress step)
- **Why it matters**: A user who shared their board or syncs across devices could inadvertently trigger stored XSS. As the app grows to real multi-user use, this becomes a real attack surface.
- **Effort**: S
- **Suggested fix**:
  - Wrap every `${t.title}`, `${g.title}`, `${t.name}` that appears inside a backtick-template assigned to `innerHTML` with `esc()`: `${esc(t.title)}`
  - A grep for `innerHTML.*\$\{t\.title` will find all instances; there are ~5 in the wizard and a few more across `renderWizPanel()`

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. PostHog keys are empty on both landing and app — zero analytics
- **What**: `landing.html:700` has `var POSTHOG_KEY = '';` and `index.html:9960` has `posthogKey: ''`. All `track()` calls are silent no-ops. The landing→signup funnel, feature usage, and conversion metrics are invisible.
- **Where**: `landing.html:700`, `index.html:9960`
- **Why it matters**: Without analytics you're flying blind on acquisition (which CTA converts?), activation (do users complete onboarding?), and retention (which views get visited?). The whole analytics scaffolding was built in #83 — it just needs the key.
- **Effort**: S
- **Suggested fix**:
  - Create a PostHog project (free tier), copy the project key
  - Set the same key in both files: `landing.html:700` and `index.html:9960`
  - Optionally set it via an env var baked at deploy time if sensitive

---

### 7. No rate limiting on `/api/claude` proxy — unbounded API cost risk
- **What**: `api/claude.js` explicitly warns "For production add per-user rate limiting (e.g. Upstash)" at line 12, but it was never implemented. Any authenticated user can fire unlimited AI requests.
- **Where**: `api/claude.js:12–48` (entire proxy, no rate limiting code)
- **Why it matters**: Once `aiProxy` is configured (P0 item 4), a single power-user or bot could run up hundreds of dollars in Anthropic API costs in minutes. The bill lands on the product.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (free tier covers ~10k requests/day): check [user-id + day] → allow 50 calls/user/day
  - Extract the Supabase user ID from the JWT header (already partially done in auth check) to use as the rate-limit key
  - Return `429` with a user-friendly message if the limit is hit

---

### 8. Guest users can lose all data — no persistent save path until 9 tasks
- **What**: The account save CTA ("Save your work") only appears in the sidebar chip after a guest has 9+ active tasks (line 2593). Before that, guests have no visible way to protect their data. If they clear browser storage, everything is gone.
- **Where**: `index.html:2592–2596` (guest nudge threshold logic), `index.html:10146–10149` (account chip guest CTA)
- **Why it matters**: A user who invests 30 minutes building their task list and then loses it on a browser clear will never come back. Early save-CTA visibility directly protects activation.
- **Effort**: S
- **Suggested fix**:
  - Lower nudge threshold to 3–4 tasks (line 2593: change `<9` to `<4`)
  - Add a persistent "Save your work" banner at the top of the dashboard for guests with any tasks, not just in the sidebar chip

---

### 9. `givelink.html` old product still publicly served at `/givelink`
- **What**: `vercel.json:4` routes `/givelink` → `givelink.html`, which is an entirely separate blue-themed Givelink sprint board app. It shows "Givelink — Sprint Board" in the title and has no Arete branding.
- **Where**: `vercel.json:4`, `givelink.html` (entire file, 1755 lines)
- **Why it matters**: Any user who follows an old link or bookmarks `/givelink` sees a completely different product. Brand confusion and a confusing dead end. Crawlers also index it.
- **Effort**: S
- **Suggested fix**:
  - If `/givelink` is for internal use only, add a password or IP restriction, or move it to a separate private deployment
  - If it's no longer needed, remove the rewrite from `vercel.json` and add a 301 redirect to `/`
  - If it must stay, update it with the Arete brand (or at minimum add a "← Back to Arete" link)

---

### 10. `profileName` hardcoded to 'Panos' — every user greeted as Panos
- **What**: `let profileName=localStorage.getItem('taskos_name')||'Panos'` means any user who hasn't explicitly set a name sees "Good morning, Panos 👋" on the dashboard.
- **Where**: `index.html:2519`
- **Why it matters**: Immediate trust-breaker. A first-time user seeing someone else's name thinks the app is broken or pre-filled with demo data.
- **Effort**: S (1-line fix)
- **Suggested fix**:
  - Change default to `'friend'` or derive from email: `email.split('@')[0]`
  - For hosted mode, auto-populate `profileName` from the Supabase user's email on first login (already partially done at line 10156, just not persisted to `localStorage('taskos_name')`)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Givelink-specific state schema still in S — polluting every user's sync
- **What**: The global `S` object includes `givelinkMetrics`, `givelinkHistory`, `givelinkHistory`, `brandAuditResult`, `givelinkMetrics.impactModel` etc. (line 2517). These are personal to Panos's Givelink startup, not product features for Arete users.
- **Where**: `index.html:2517` (S initializer), multiple render functions (`renderGivelinkDash`, etc.)
- **Why it matters**: Every user's localStorage and Supabase row carries ~1KB of Givelink data they'll never use. More importantly, `renderGivelinkDash` appears in the view router (line 2984), meaning a nav link to it would show Panos's personal metrics to anyone.
- **Effort**: M
- **Suggested fix**:
  - Remove Givelink-specific fields from the default S object and the Supabase schema
  - Keep `givelink.html` / `renderGivelinkDash` in a private branch or behind an env flag
  - Delete or replace the Givelink seed tasks in the first-run sequence

---

### 12. `index.html` is 14,924 lines — unmaintainable single-file app
- **What**: The entire app — 700+ lines of CSS, all HTML views, and ~13,000 lines of JavaScript — lives in one file with no module system, no tests, and no way to tree-shake.
- **Where**: `index.html` (entire file)
- **Why it matters**: Every change risks breaking an unrelated feature. New contributors can't navigate it. The browser parses all 13,000 lines of JS on every cold load with no code splitting.
- **Effort**: L (ongoing refactor)
- **Suggested fix**:
  - Phase 1 (quick win): extract CSS into `styles.css`, inline JS into `app.js` — still one script but separated from HTML
  - Phase 2: extract Supabase auth into `auth.js`, AI functions into `ai.js` using ES modules with `<script type="module">`
  - Phase 3: move view render functions into their own files — each view becomes independently reviewable

---

### 13. Missing loading states on several AI functions
- **What**: `aiSuggestAutomations`, `aiWheelInsight`, `aiRelNudge`, `aiPreMortem`, and 6+ other AI functions call `callClaude()` without first showing any loading indicator. The button appears to do nothing for 2–5 seconds.
- **Where**: `index.html:5438` (`aiSuggestAutomations`), `index.html:7141` (`aiWheelInsight`), `index.html:5640` (`aiRelNudge`), `index.html:6696` (`aiPreMortem`)
- **Why it matters**: Users double-click thinking the first click failed, sending duplicate requests. Or they leave thinking the feature is broken.
- **Effort**: S per function (M total)
- **Suggested fix**:
  - Before every `callClaude()` call, call `_aiBtn(btn, async()=>{...})` (the pattern already exists at line 2774) or at minimum `toast('⏳ AI thinking…')`
  - `aiAutoTriage` already does this correctly (line 5049) — copy the pattern

---

### 14. Supabase sync silent fail: empty catch swallows auth errors and triggers unwanted signup
- **What**: In `sbConnect()` (line 10036–10044), a try/catch attempts login; on ANY failure it falls through to a signup attempt. A network timeout or 5xx server error would silently try to create a new account.
- **Where**: `index.html:10038–10044`
- **Why it matters**: A user with an existing account who hits a temporary server error might trigger "Account created — confirm via email" toast, confusing them about whether their account still exists.
- **Effort**: S
- **Suggested fix**:
  - Only fall through to signup if the sign-in returns a 4xx status (specifically 400/422) meaning "bad credentials"
  - Check `r.status === 400 || r.status === 422` before attempting `signup`; rethrow on network errors and 5xx

---

### 15. No CSP coverage for Google Fonts — also missing Anthropic CDN in `connect-src`
- **What**: `vercel.json:15` CSP omits `fonts.googleapis.com` from `style-src` and `fonts.gstatic.com` from `font-src`. While the `connect-src` covers `api.anthropic.com`, it's worth auditing against all actual fetch targets.
- **Where**: `vercel.json:15`
- **Why it matters**: Tied to P0 item 1 (fonts don't load). Also a defense-in-depth gap — the CSP is meant to reduce XSS blast radius but `unsafe-inline` in `script-src` largely neutralizes it for scripts.
- **Effort**: S
- **Suggested fix**:
  - If self-hosting fonts (preferred): no change needed for font-src
  - If keeping Google Fonts: add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src`
  - Long-term: replace `'unsafe-inline'` in `script-src` with a strict nonce policy to actually benefit from CSP

---

## 💡 P3 — Nice to have

### 16. `sitemap.xml` only lists the root — missing `/index.html` and `#sections`
- **What**: `sitemap.xml` has only one URL (`/`). Section anchors like `#features`, `#faq`, `#templates` and the app itself (`/index.html`) are not listed.
- **Where**: `sitemap.xml`
- **Why it matters**: Minor SEO gap; Google won't discover the FAQ/features sections as distinct landing targets.
- **Effort**: S
- **Suggested fix**: Add entries for `/#features`, `/#how`, `/#faq`, `/#compare` with appropriate `priority` values (`0.8`, `0.7`, etc.)

---

### 17. `IntersectionObserver` in landing demo never disconnects
- **What**: The landing page demo animation (`landing.html:687–692`) sets `seen=true` to prevent double-start but never calls `io.unobserve(wrap)`. The observer stays alive indefinitely.
- **Where**: `landing.html:687–692`
- **Why it matters**: Minor memory leak; 1 observer kept alive after it's done its job. No user-visible impact.
- **Effort**: S (1 line)
- **Suggested fix**: Add `io.unobserve(wrap)` inside the `if(e.isIntersecting && !seen)` block after `loop()`

---

### 18. Last-write-wins sync has no conflict UI — silent data loss on multi-device offline edits
- **What**: Comment at `index.html:9940`: "Last-write-wins by `S._updatedAt`". If a user works offline on two devices and syncs them both, the earlier-syncing device's changes are silently discarded.
- **Where**: `index.html:9940`, `sbSyncNow()` function
- **Why it matters**: Power users (the most valuable retention cohort) are most likely to use multiple devices. Silent data loss is unrecoverable and trust-destroying.
- **Effort**: M
- **Suggested fix**:
  - When applying a remote state that's newer than local (remote `_updatedAt` > local `_updatedAt`), show a toast: "Synced newer version from cloud — your recent local changes may have been merged"
  - Longer-term: switch to per-task CRDT or at minimum merge arrays by ID rather than replacing the whole blob

---

### 19. Hardcoded Vercel URL in `index.html` — will break if the domain changes
- **What**: `_APP_URL = 'https://task-management-beige-eight.vercel.app/'` at line 10180 is hardcoded. All referral links, OG image paths, and share URLs point to this domain.
- **Where**: `index.html:10180`, OG meta tags at lines 24–32
- **Why it matters**: When the domain is migrated (to `arete.app` or similar), every share link, referral attribution, and OG image breaks.
- **Effort**: S
- **Suggested fix**: Replace `_APP_URL` with `window.location.origin + '/'` so it works on any domain; update OG image paths to use relative references or a canonical domain env var

---

### 20. No empty or error state for the AI workflow output panel
- **What**: The AI Lab workflow output panel (`index.html:5499`) shows a "⏳ Running…" message while waiting but has no dedicated error state — if `callClaude()` returns `null`, the panel stays in the loading state.
- **Where**: `index.html:5496–5540` (`_runWorkflow` function)
- **Why it matters**: A failed AI workflow leaves the panel stuck with a loading message and no way for the user to retry or understand what went wrong.
- **Effort**: S
- **Suggested fix**: After `const text = await callClaude(...)`, check `if(!text)` and render an error state in the output panel with a retry button instead of silently failing

---

_Plan generated from static analysis of the Arete codebase (commit b38d4bb, 2026-07-28). Priority tiers assume the app is moving from personal tool to multi-user product. Items are ordered within each tier by user-visible impact._
