# Givelink & Arete — Improvement Plan
_Generated 2026-08-17 · Max 20 items ordered by ROI within tier_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. Anthropic API key exposed in browser localStorage and sent directly to Anthropic
- **What**: `givelink.html` calls `https://api.anthropic.com/v1/messages` directly from the browser, storing the key in `localStorage` in plain text.
- **Where**: `givelink.html:1075–1088` (key retrieval via `window.prompt`), `givelink.html:1131–1144` (direct fetch with `anthropic-dangerous-direct-browser-access: true`), `givelink.html:1256–1271` (`callClaudeGL` utility used by Standup and Outreach)
- **Why it matters**: Any user who opens DevTools can steal the key and run up an unlimited bill. A compromised localStorage (XSS, browser extension, physical access) has the same effect. The `/api/claude.js` proxy already exists and solves this.
- **Effort**: S
- **Suggested fix**:
  - Route all three callers (`runAiSprintPlanner`, `callClaudeGL`) through `POST /api/claude.js` instead of calling Anthropic directly.
  - Remove `anthropic-dangerous-direct-browser-access` header entirely.
  - Delete the `getApiKey()` / `window.prompt` flow; the proxy holds the key server-side.

---

### 2. CRM modal Delete / Log Activity / Advance Stage buttons never appear
- **What**: The Add/Edit Nonprofit modal HTML is generated once on first open (guarded by `if(!m)`). The Delete and action buttons are rendered with a conditional on `editNpId` at creation time — if the modal is first opened via `openAddNP()` (where `editNpId=null`), those buttons are absent from the DOM permanently, even on all subsequent edit calls.
- **Where**: `givelink.html:1358–1401` (`_showNPModal`), specifically lines 1379–1386
- **Why it matters**: Users who open "Add Org" first can never delete or advance a nonprofit they've already won — the buttons simply aren't there.
- **Effort**: S
- **Suggested fix**:
  - Move button visibility to runtime toggle: always include the elements in the modal HTML but hide/show them in `_showNPModal` based on `editNpId` (e.g. `el.style.display = editNpId ? '' : 'none'`).
  - Alternatively, rebuild the modal footer HTML each time it's opened rather than caching.

---

### 3. Daily Standup generator's "yesterday" window is 2 days ago, not 1
- **What**: `yesterday.setDate(now.getDate()-2)` is off by one day — tasks completed yesterday never appear in the standup.
- **Where**: `givelink.html:1488`
- **Why it matters**: The standup always reports "nothing completed yet" even if tasks were finished yesterday — destroys trust in the AI feature.
- **Effort**: S
- **Suggested fix**:
  - Change `now.getDate()-2` to `now.getDate()-1`.
  - Add `yesterday.setHours(0,0,0,0)` to catch everything completed since midnight yesterday.

---

### 4. Push notification icon path is wrong — notifications show broken icons
- **What**: The service worker references `'./icons/icon-192.png'` for push notification icon and badge, but no `icons/` subdirectory exists — the file is at `./icon-192.png`.
- **Where**: `sw.js:48–49`
- **Why it matters**: Any push notification (scheduled reminders, etc.) will render with a broken icon on all platforms. On Android this can cause the notification to fail silently on some OS versions.
- **Effort**: S
- **Suggested fix**:
  - Change both references to `'./icon-192.png'`.
  - Bump the `CACHE` version string so the new SW activates for existing users.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. PostHog key is blank on landing — zero funnel data being collected
- **What**: `landing.html` initialises PostHog with `var POSTHOG_KEY = ''`, so no events fire. The commit that added it (b38d4bb) explicitly documents the key as intentionally blank pending setup — but without it there is no data on which CTA drives signups, scroll depth, or demo visibility.
- **Where**: `landing.html:702`
- **Why it matters**: The landing was just rebuilt for growth. Without analytics, there is no way to tell if the new comparison table, demo, or CTA placement is working. Every day without data is a day of lost learning.
- **Effort**: S
- **Suggested fix**:
  - Paste the same PostHog project key used in `index.html`'s `APP_CONFIG.posthogKey` into `POSTHOG_HOST` / `POSTHOG_KEY` here (same key = same project = the landing→signup funnel appears automatically in PostHog).
  - Verify `landing_cta_click`, `landing_scroll`, and `landing_demo_seen` events are arriving.

---

### 6. AI features prompt for the API key via `window.prompt()` with zero context
- **What**: When a user clicks "✨ Generate" in the AI Sprint Planner or any standup/outreach feature, they get a raw browser `prompt()` dialog asking for their "Anthropic API key" with no explanation of what that is or where to get it.
- **Where**: `givelink.html:1086` (`getApiKey`) and `givelink.html:1261` (`callClaudeGL`)
- **Why it matters**: This is the first impression of every AI feature. It immediately signals "this is unfinished" and most non-technical users will abandon. With the proxy fix in P0 item #1, this dialog disappears entirely — the two items are coupled.
- **Effort**: S (resolved by P0 #1; S on its own if the proxy isn't landed first)
- **Suggested fix**:
  - Fix P0 #1 first — routes through the proxy and the key prompt disappears completely.
  - If the proxy approach isn't viable, replace `window.prompt` with an inline input field inside the AI modal with a link to `console.anthropic.com`.

---

### 7. Sprint bar overflows on mobile — three buttons invisible or clipped
- **What**: The sprint bar contains three full-label buttons (🤖 AI Sprint Planner, 📋 Standup, 🔗 Sync to Task OS) with no overflow or wrapping handling at small widths.
- **Where**: `givelink.html:252–254`
- **Why it matters**: On any phone ≤375px wide, these buttons either clip outside the viewport or stack-wrap over the sprint name/dates, making both unreadable. These are the three main power actions in the app.
- **Effort**: S
- **Suggested fix**:
  - Collapse to icon-only buttons on `max-width: 768px` (the media query already exists).
  - Or move all three into a `⋯` overflow popover.

---

### 8. CRM, Nonprofits, Ops, Past Sprints unreachable from mobile bottom nav
- **What**: The fixed bottom nav (`<nav class="bnav">`) shows only 5 items: Overview, Growth, Product, Execute, Backlog. CRM, Nonprofits, Execution, Ops, Past Sprints, and Sprint Settings require opening the hamburger sidebar.
- **Where**: `givelink.html:306–312`
- **Why it matters**: CRM (the nonprofit pipeline) is a primary workflow. On mobile — where the app is likely to be used between calls — it requires two taps to find and one more to access on every visit.
- **Effort**: M
- **Suggested fix**:
  - Replace one of the lower-priority bottom-nav slots with a "More" item that opens a half-sheet listing all remaining sections.
  - Or use a swipeable bottom tab strip with scroll.

---

### 9. `callClaudeGL` swallows HTTP errors — users see wrong error messages
- **What**: `callClaudeGL` never checks `res.ok`. On a `429 Too Many Requests` (rate limit) or `401 Unauthorized` (bad key), it calls `data.content?.[0]?.text` which is `undefined`, returns `null`, and the caller shows "Could not generate. Check your API key." — the wrong message for a rate limit.
- **Where**: `givelink.html:1264–1271`
- **Why it matters**: Users burn time rotating their API key when they're actually just rate-limited. This undermines trust in the AI features.
- **Effort**: S
- **Suggested fix**:
  - After `const data = await res.json()`, check `!res.ok` and surface `data.error?.message` or a human-readable status (401 = "Invalid API key", 429 = "Rate limited — try again in a minute").

---

### 10. Givelink `theme-color` is blue (#3b82f6) — wrong brand color on mobile
- **What**: `<meta name="theme-color" content="#3b82f6">` sets the browser/OS chrome to blue when Givelink is installed as a PWA or opened on mobile Safari/Chrome.
- **Where**: `givelink.html:6`
- **Why it matters**: Brand colour is purple (`#6B3FA0`/`#5718CA`). The blue chrome looks mismatched and signals a different, unbranded product. The entire CSS uses `--accent:#3b82f6` (blue) throughout — this is a wholesale colour inconsistency vs the Givelink brand.
- **Effort**: M
- **Suggested fix**:
  - Set `theme-color` to `#5718CA` (brand purple).
  - Update `--accent` in `:root` from `#3b82f6` to `#5718CA` and check all `.np` / `--np` colour references (currently `#60a5fa` blue) to verify they should stay blue or shift to brand.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `index.html` is a 14,924-line monolithic file
- **What**: The entire Arete app — styles, HTML structure, all JavaScript, all feature modules — lives in one file. There is no build step, no module system, no tests.
- **Where**: `index.html` (all 14,924 lines)
- **Why it matters**: A bug introduced anywhere can only be found by `grep` + line count. New feature work requires loading the entire file into context. Refactoring a component means editing a 15K-line file. This is the main reason velocity will slow as the product grows.
- **Effort**: L
- **Suggested fix**:
  - Short term: break out feature modules into `<script src="...">` includes during development and inline at deploy time using a simple build step (esbuild, Vite, or even a Makefile `cat` concat).
  - Medium term: adopt a thin component model — each view/module as its own `.js` file, compiled to one bundle.

---

### 12. 120+ real sprint tasks hardcoded as seed data in `givelink.html`
- **What**: The `seed()` function (givelink.html:882–1072) contains 120+ real in-flight business tasks, contact notes, and org-specific context hard-coded in HTML. On any new browser/device, these seed as "current sprint" tasks.
- **Where**: `givelink.html:882–1072`
- **Why it matters**: A fresh install always overwrites the user's real tasks with stale hardcoded data (the `if(S.seeded)return` guard only works in the same browser). Sharing the URL with anyone gives them full read access to every task, assignee, and business note. Business data leaks via the public GitHub repo.
- **Effort**: M
- **Suggested fix**:
  - Strip seed tasks to a small neutral example dataset (3-5 placeholder tasks per pillar).
  - Real sprint data should live in localStorage / Supabase, not in source code.

---

### 13. `/api/claude.js` proxy has no rate limiting
- **What**: The Claude proxy has no per-user or per-IP request throttling. A single account can make unlimited requests, running up the Anthropic bill. The code comment at line 13 explicitly acknowledges this and defers it.
- **Where**: `api/claude.js:13`
- **Why it matters**: The proxy is designed to let all app users share one server-side API key. Without rate limiting, one power user (or a scripted attack if auth is bypassed) can exhaust the monthly budget in hours.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting per authenticated user ID (Vercel + Upstash have a documented integration).
  - Alternatively, add a simple in-memory counter per IP with a 1-minute sliding window as a quick stop-gap.

---

### 14. Google Fonts loaded from CDN — blocks offline use and first paint
- **What**: `index.html` loads Inter via `<link href="https://fonts.googleapis.com/...">`. Despite marketing itself as "offline-first", the app renders with system font fallbacks offline and the font `<link>` tags are render-blocking on slow connections.
- **Where**: `index.html:16–18`
- **Why it matters**: First meaningful paint is delayed on slow connections. On the first offline load after a cache, fonts render differently than expected, which can shift layout.
- **Effort**: S
- **Suggested fix**:
  - Self-host the Inter subset (woff2 files) in the repo and add them to the SW cache list in `sw.js`.
  - Or use `font-display: swap` and `rel="preload"` to unblock rendering while fonts load.

---

### 15. Dynamically created modals leave orphan event listeners on CRM modal close
- **What**: `_showNPModal`, `openStandup`, and `openOutreachGenerator` each create a modal element on first call via `document.createElement` and append it to `<body>`. The close button uses `onclick="closeM('np-modal')"` which only adds `hidden` class — it never removes the element. Activity log entries are pushed to `np.activityLog` on every `logActivityNP()` call without bounds.
- **Where**: `givelink.html:1358–1401`, `1467–1523`, `1600–1667`
- **Why it matters**: The activity log array grows unboundedly in `localStorage`, which has a ~5MB cap. A heavily-used CRM record will eventually fill storage and silently break all `save()` calls.
- **Effort**: S
- **Suggested fix**:
  - Cap `activityLog` to the last 50 entries on each push: `np.activityLog = [...np.activityLog.slice(-49), {date, note}]`.
  - Trim old snapshots in `_recordSnapshot` similarly.

---

## 💡 P3 — Nice to have

---

### 16. Canonical URL is a Vercel subdomain, not a brand domain
- **What**: `landing.html:11` sets canonical to `https://task-management-beige-eight.vercel.app/`. All OG tags, sitemap, and structured data reference this URL.
- **Where**: `landing.html:11–21`, `sitemap.xml`
- **Why it matters**: The Vercel subdomain is unfriendly in share previews and hurts SEO (domain age, branding signal). Setting up `arete.app` or equivalent would consolidate link equity.
- **Effort**: S (domain + Vercel custom domain config)
- **Suggested fix**: Add a custom domain in Vercel, update all canonical/OG/sitemap URLs in one pass.

---

### 17. Missing `aria-label` on interactive elements in `givelink.html`
- **What**: Hamburger button has `aria-label="Menu"` but most other clickable elements (pillar cards, task checkboxes, close buttons) have no labels.
- **Where**: `givelink.html:218` (the one that exists), ~30 other interactive elements throughout
- **Why it matters**: Screen reader users navigating the sprint board cannot identify what most buttons and cards do.
- **Effort**: M
- **Suggested fix**: Add `aria-label` to `.ck2` checkboxes, `.gcheck` goal checks, `.mc` modal close buttons, and `.pcard` pillar cards. Start with the most-used actions (checkbox toggle, modal close).

---

### 18. `document.execCommand('copy')` deprecated fallback still in use
- **What**: Both the standup copy and outreach copy use `navigator.clipboard.writeText` as primary path but fall back to `document.execCommand('copy')`, which is deprecated and removed in some browsers.
- **Where**: `givelink.html:1521`, `givelink.html:1621`
- **Why it matters**: The deprecated path will silently stop working. The modern path requires HTTPS (which the app uses), so the fallback is only needed in very old browsers.
- **Effort**: S
- **Suggested fix**: Remove the `execCommand` fallback. If the clipboard write fails, show `toast('Copy failed — select the text manually')` instead.

---

### 19. Landing hero demo CTA pulse animation ignores `prefers-reduced-motion`
- **What**: The `demoPulse` animation on the "Organize my day ✨" button fires regardless of the user's motion preference setting. The demo scene transition does check `prefers-reduced-motion` and skips correctly, but the CTA pulse animation does not.
- **Where**: `landing.html:676–682`
- **Why it matters**: For users with vestibular disorders who have set reduced-motion, unexpected animation on a CTA button can cause discomfort.
- **Effort**: S
- **Suggested fix**: Guard the CTA pulse: `if (!reduce) { cta.classList.add('pulse'); }`.

---

### 20. `vercel.json` missing security headers (CSP, CORP, X-Frame-Options)
- **What**: `vercel.json` has only a rewrite rule for the `/api/` directory. There are no HTTP security headers configured.
- **Where**: `vercel.json`
- **Why it matters**: Without `X-Frame-Options: DENY` / `Content-Security-Policy: frame-ancestors 'none'`, the app can be embedded in an iframe and used for clickjacking. Without `X-Content-Type-Options: nosniff`, MIME-sniffing attacks are possible.
- **Effort**: S
- **Suggested fix**: Add a `headers` block in `vercel.json` with `X-Frame-Options`, `X-Content-Type-Options`, and a permissive-but-explicit CSP that blocks unexpected script sources.
