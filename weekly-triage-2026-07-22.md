# Weekly Triage — 2026-07-22

## 📊 Week at a glance
- **Commits**: 12 | **Files changed**: 34 unique file-touches | **Debt markers added**: 0 (no TODO/FIXME/HACK in changed files)
- **High-churn files** (touches this week):
  1. `index.html` — 11 commits (every PR touched it; entire app logic lives here)
  2. `sw.js` — 10 commits (cache name bumped with each release)
  3. `landing.html` — 2 commits (#80, #82)
- **Commits flagged**: No "wip", "temp", or "revert" messages. Two same-day PRs on 2026-07-17 (#79, #80) touched the same file with no clear test commit following either.

---

## 🚨 Needs immediate attention

### 1. Push notification icon path is wrong — every notification shows a broken icon
- **File**: `sw.js:46-47`, `index.html:11289`
- **Introduced by**: `0c1d32d` (2026-07-17, "Rebrand to Arete + first-run magic moment + landing + boot/timezone fixes")
- **Why this matters**: The rebrand moved icons to the repo root (`./icon-192.png`) but the notification code still references `./icons/icon-192.png` (a non-existent subdirectory). Every scheduled reminder and push notification either shows a broken image or silently fails on strict iOS PWA installs. The file that is cached in sw.js (`./icon-192.png`) is correct — the notification paths are just wrong.

### 2. No rate limiting on `/api/claude` — financial risk from unbounded AI calls
- **File**: `api/claude.js:12-13` (inline comment), `api/claude.js:38-48` (handler body)
- **Introduced by**: The proxy has had this note since before the week's commits, but this week's PLG features (#77 guest mode, #79 templates, #78 share) all add new entry points that drive more users to AI features.
- **Why this matters**: Any authenticated user (or bot with a valid session token) can issue unlimited Claude API calls at the operator's expense. This week's guest mode (#77) and template imports (#79) significantly expand the potential abuse surface — guest users can now reach AI features without signing in.

### 3. XSS: unescaped task/goal titles injected into `innerHTML` in weekly review
- **File**: `index.html:3594, 3601, 3603`
- **Introduced by**: Present before this week, but the weekly review wizard was not modified this week — so this is carry-over technical debt surfaced now.
- **Why this matters**: A task title containing `<script>` or `<img src=x onerror=...>` executes in the user's app session. With Supabase sync now live, a malicious actor who could write to a user's synced data could escalate to code execution in their browser. The app has an `esc()` helper at line 11776 — it's just not applied consistently.

### 4. `APP_CONFIG.aiProxy` is empty — all AI features are broken for hosted users
- **File**: `index.html:9959`
- **Introduced by**: `0c1d32d` (2026-07-17) — the rebrand added the hosted Supabase config but left `aiProxy: ''`.
- **Why this matters**: The landing page and the in-app tour both prominently feature AI. Any user who signs up via the hosted deployment and hits "Plan My Day" or "Auto-Triage" immediately sees *"Add your Claude API key in Settings"* — with no explanation that this is an infrastructure setup step. This is the most conversion-damaging bug introduced this week.

---

## 🧹 Cleanup opportunities

### 5. Service worker caches `givelink.html` + `manifest-givelink.json` post-separation
- **File**: `sw.js:16-17`
- **Introduced by**: `d635c06` (2026-07-16, "Remove Givelink from Task OS") — the JS was split but sw.js was not cleaned up.
- **Why this matters**: The SW still forces every Arete PWA install to download and cache the Givelink sprint board. Adds unnecessary install payload; if `givelink.html` is removed from the repo later, SW install will throw a fetch error for that asset.

### 6. `landing.html` and `index.html` both hardcode `task-management-beige-eight.vercel.app`
- **File**: `landing.html:10,15-16`, `index.html:23-24`
- **Introduced by**: `a8586f3` (2026-07-16, "Marketing: social-share previews") and refined in `59abf2d` (2026-07-18, "Elevate landing page").
- **Why this matters**: Social share previews and Google Search will surface this Vercel preview URL in perpetuity. All `og:url`, `canonical`, and `twitter:image` should use the production domain, or at minimum be relative URLs that survive a domain change.

### 7. `og-image.png` baked into git — regeneration is manual
- **File**: `og-image.png` (binary, touched in commit `a8586f3`, re-touched in `0c1d32d`)
- **Introduced by**: `a8586f3` (2026-07-16)
- **Why this matters**: The OG image is committed as a binary and updated manually. With the brand name now "Arete", the OG image should reflect that — verify the current `og-image.png` shows "Arete" not the old brand name. Not visible in code review; requires visual spot-check.

---

## 🤔 Worth a second look

### 8. `sbSyncNow()` called without `await` in two boot paths
- **File**: `index.html:10666` (`setTimeout(()=>{try{if(_sbEnabled())sbSyncNow();}catch(e){}},900)`) and `index.html:10381`
- **Introduced by**: Present before this week; not regressed but not fixed either.
- **Why this matters**: `sbSyncNow` is async. Calling it without `await` means sync errors are swallowed silently (the surrounding `try/catch` won't catch async throws). The intent appears to be fire-and-forget, which is acceptable — but the 900ms delay on boot is also arbitrary and means the first 900ms of app usage runs on potentially stale data.

### 9. `_welcomeSeed()` only fires for new accounts — returning guest conversion loses welcome state
- **File**: `index.html:10456` (`_welcomeSeed()`) vs `index.html:10128-10134` (`_afterAuth()`)
- **Introduced by**: `0e19b15` (2026-07-16, "Optimize acquisition: instant try-without-account guest mode")
- **Why this matters**: When a guest user signs up, `_afterAuth()` runs. The `wasGuest` flag removes the guest marker, but `_justWelcomed` is only set inside `_welcomeSeed()`. If `_welcomeSeed` is only called for brand-new accounts (not guest→convert), returning guest users who sign up won't see the onboarding tour. The flow path needs a targeted test: sign up as guest → create tasks → sign up with email → verify onboarding shows.

### 10. `callClaude()` direct browser access uses `anthropic-dangerous-direct-browser-access` header
- **File**: `index.html:5022`
- **Introduced by**: Before this week; not changed this week.
- **Why this matters**: When `APP_CONFIG.aiProxy` is empty and the user provides their own key, the app calls `api.anthropic.com` directly from the browser with `anthropic-dangerous-direct-browser-access: true`. This header tells Anthropic's API to bypass its CORS restrictions for browser-based calls. This is only acceptable for personal/dev use — the key is visible in localStorage and in network requests. This pattern is not safe for a production hosted app where users supply their own keys, as the key is trivially extractable from DevTools.

---

*Generated from: `git log --since="2026-07-15"` (12 commits) + static analysis of changed files*
*Scope: `index.html`, `sw.js`, `landing.html`, `api/claude.js`*
