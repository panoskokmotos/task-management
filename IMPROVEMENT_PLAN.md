# Improvement Plan — Arete / Task OS

_Generated: 2026-07-25_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Every user is addressed as "Panos" — default name never replaced
- **What**: `profileName` is initialised to the hard-coded string `'Panos'` and is only overwritten during the new-account welcome path; any returning user whose `taskos_name` key is absent sees "Good morning, Panos 👋" and has their document title set to "Arete — Panos".
- **Where**: `index.html:2519` (`let profileName=localStorage.getItem('taskos_name')||'Panos'`), `index.html:1070` (static greeting HTML)
- **Why it matters**: First interaction with the app for any real user is someone else's name. Immediate trust-breaker and sign of an unfinished product.
- **Effort**: S
- **Suggested fix**:
  - Change the fallback to `'there'` (→ "Good morning, there 👋") so unset names still read naturally
  - Add a prompt during the guest first-run to capture a preferred name; persist it to `taskos_name`

---

### 2. AI prompts hardcode "Panos / Givelink" for every user regardless of About Me
- **What**: At least four AI feature prompts bypass `getAboutMe()` and hardcode the developer's identity: relationship coaching ("Who should **Panos** reach out to…Consider his **Givelink** fundraising platform"), newsletter writer ("Write a personal weekly newsletter for **Panos**, a startup founder"), task extraction, and the About-Me-populated context string that still contains "Panos — Greek founder in his 20s building Givelink" as the default fallback.
- **Where**: `index.html:7849` (About Me fallback), `index.html:5647`, `7477`, `8604` (hardcoded instructions)
- **Why it matters**: Any user who opens the app and hits an AI feature gets coaching about the developer's startup, SF move, and financial goals. This is actively misleading. The `getAboutMe()` function exists and is correctly wired in most places — these four are outliers.
- **Effort**: S
- **Suggested fix**:
  - Replace every hardcoded `"Panos"` / `"Givelink"` reference in AI prompt strings with dynamic values from `getAboutMe()`
  - Update the fallback in `getAboutMe()` / `index.html:7849` to a neutral placeholder: `"a focused individual trying to do their best work"`

---

### 3. Push notification icons are 404-ing on every device
- **What**: Service worker references `./icons/icon-192.png` for push notification icon and badge, but no `icons/` subdirectory exists — images live at the repo root.
- **Where**: `sw.js:46-47`
- **Why it matters**: Every push notification sent to users arrives with a broken icon, degrading trust and making the reminders feature look broken. Silent failure — no error thrown.
- **Effort**: S
- **Suggested fix**:
  - Change `icon:'./icons/icon-192.png'` → `icon:'./icon-192.png'`
  - Change `badge:'./icons/icon-192.png'` → `badge:'./icon-192.png'`

---

### 4. AI proxy has no rate limiting — one account can drain the Anthropic budget
- **What**: The Claude proxy in `api/claude.js` forwards all authenticated requests to Anthropic without any per-user or per-day quota. The code itself flags this with a comment.
- **Where**: `api/claude.js:12-14` (the comment), full handler
- **Why it matters**: A single abusive or compromised account can run up an unlimited Anthropic bill in minutes. There is no circuit-breaker.
- **Effort**: M
- **Suggested fix**:
  - Add a simple Upstash Redis counter keyed to the authenticated user's UID with a daily cap (e.g. 50 requests/day)
  - Return HTTP 429 with a `Retry-After` header when the cap is hit
  - Log overages so spikes are visible before they become a billing event

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. `givelink.html` calls Anthropic API directly from the browser; key stored in localStorage
- **What**: `givelink.html` fetches `https://api.anthropic.com/v1/messages` directly using `window.prompt()` to collect the API key, then stores it in `localStorage`. The header `anthropic-dangerous-direct-browser-access: true` is used to bypass CORS protection.
- **Where**: `givelink.html:1131-1138`, `givelink.html:1264-1267`, `givelink.html:1086` (prompt call)
- **Why it matters**: The API key is visible in DevTools Network tab, stored unencrypted in localStorage (readable by any XSS), and potentially saved in browser autofill history. The `dangerous-direct-browser-access` header name is Anthropic's own warning label that this pattern should not be used in production.
- **Effort**: S
- **Suggested fix**:
  - Route all Anthropic calls in `givelink.html` through the existing `api/claude.js` proxy endpoint
  - Remove the `window.prompt()` key collection and the localStorage key storage
  - Remove `anthropic-dangerous-direct-browser-access` header entirely

---

### 6. Analytics are implemented but the key is blank — zero funnel visibility
- **What**: PostHog is wired up in both `landing.html` and `index.html`, but both `POSTHOG_KEY` and `APP_CONFIG.posthogKey` are empty strings. No events are firing.
- **Where**: `landing.html:702` (`var POSTHOG_KEY = ''`), `index.html:9960` (`posthogKey: ''`)
- **Why it matters**: The landing→signup funnel is invisible. Commit #83 specifically added scroll-depth, CTA-click, and landing_view tracking, but none of it is recording. You cannot measure what's working on the growth surface.
- **Effort**: S
- **Suggested fix**:
  - Paste the PostHog project key into both locations (same key — same origin means the funnel connects automatically)
  - Verify `landing_view`, `landing_cta_click`, and `guest_started` events appear in PostHog after one test visit

---

### 7. Entire primary accent color palette is off-spec
- **What**: The app uses `#5a49e0` (light) / `#8272f2` (dark) as its primary accent — a blue-leaning indigo. The brand spec calls for `#6B3FA0` (light) / `#5718CA` (dark), which is a deeper amethyst-violet. Every button (`.bp`), active nav state, progress bar, badge, and FAB uses the off-spec color.
- **Where**: `index.html:46`, `54` (CSS variables `--accent`), `landing.html:48`, `73`
- **Why it matters**: The entire visual identity of the app is built on the wrong purple. This affects every single screen and diverges from any brand material (social posts, landing page, print) that uses the spec colors.
- **Effort**: S (two variable changes cascade everywhere)
- **Suggested fix**:
  - Set `--accent:#6B3FA0` in light mode and `--accent:#5718CA` in dark mode in the CSS variable block
  - Verify all button/badge contrast ratios after the change (darker purple may improve or hurt contrast on white text depending on mode)

---

### 8. Task and goal titles rendered unescaped via innerHTML in Weekly Review
- **What**: Three panels in `renderWizPanel()` inject `t.title` and `g.title` directly into `innerHTML` without calling `esc()`.
- **Where**: `index.html:3594` (Completed this week), `index.html:3601` (Backlog promotion), `index.html:3603` (Goal progress); also `toast()` at `index.html:3844`, `4283`, `4292`
- **Why it matters**: Self-XSS within the user's own session now; becomes cross-user XSS the moment a template import or sharing feature allows another user to write task titles. `esc()` exists at line 11776 and is used elsewhere — this is an omission, not a missing capability.
- **Effort**: S
- **Suggested fix**:
  - Replace every `${t.title}` / `${g.title}` in innerHTML templates with `${esc(t.title)}` / `${esc(g.title)}`
  - Do the same in `toast()` calls that include task title content

---

### 9. OAuth login silently fails to set UID — leaves user stuck in broken half-logged-in state
- **What**: After a Google OAuth callback, a `fetch('/auth/v1/user')` call retrieves the user's UID and stores it in localStorage. The entire block is wrapped in `catch(e){}` — an empty catch. If the fetch fails, `taskos_sb_uid` is never set, `_sbEnabled()` returns false, and `sbSyncNow()` refuses all syncs with "Connect cloud sync first" — while the user believes they are logged in.
- **Where**: `index.html:10374`
- **Why it matters**: Any OAuth user hitting a transient network error during login ends up in an invisible broken state with no error message and no recovery path other than signing out and back in (which they don't know to do).
- **Effort**: S
- **Suggested fix**:
  - Replace the empty catch with a handler that shows a toast: "Couldn't complete sign-in — tap to retry" with a link to `sbConnect()`
  - Retry the UID fetch once (with 2s delay) before surfacing the error

---

### 10. Hardcoded production URL in structured data and sitemap breaks SEO for any domain change
- **What**: `task-management-beige-eight.vercel.app` is hardcoded in the JSON-LD structured data block and in `sitemap.xml`.
- **Where**: `landing.html:25` (JSON-LD `"url"`), `sitemap.xml:4` (`<loc>`)
- **Why it matters**: Commit #83 was about "SEO foundation." A hardcoded Vercel URL is the foundation's single point of failure at domain-move time — it splits PageRank between two origins.
- **Effort**: S
- **Suggested fix**:
  - Define a single `BASE_URL` constant in `landing.html` or inject via Vercel build-time env var
  - Update both `sitemap.xml` and the JSON-LD `url` field to use it; add `<link rel="canonical">` as belt-and-suspenders

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `index.html` is 14,924 lines — a single file is becoming a merge hazard
- **What**: The entire app — HTML, 3000+ lines of CSS, and 10,000+ lines of JS — lives in one file. Every PR touches it; diffs are unreadable and conflicts are inevitable. Global state variables (`S`, `editT`, `editG`, etc.) can silently collide. Key functions: `renderDash()` is 162 lines, `seed()` is 392 lines.
- **Where**: `index.html` (entire file)
- **Why it matters**: Refactoring a feature requires scrolling through 15k lines. Velocity will slow quadratically as the file grows. Lower-end mobile devices take >1s to parse.
- **Effort**: L
- **Suggested fix**:
  - Extract all `<style>` into `app.css` first (lowest risk)
  - Then extract bounded JS modules: `supabase.js`, `ai.js`, `seed.js` as `<script type="module">`
  - One module per sprint — do not attempt a big-bang refactor

---

### 12. ~735 interactive `onclick` elements but only ~89 accessibility attributes — app is screen-reader dark
- **What**: The entire sidebar navigation (30+ items), all task cards, all action buttons, and all stat cards use `<div onclick>` without `role`, `tabindex`, or `aria-label`. Auth form inputs have no `<label>` elements.
- **Where**: `index.html:999-1057` (sidebar nav), `index.html:877-878` (auth inputs); throughout
- **Why it matters**: The app's primary navigation is entirely inaccessible via keyboard or screen reader. Auth — the first real interaction screen — is inaccessible to assistive technology users.
- **Effort**: M
- **Suggested fix**:
  - Audit the five highest-traffic surfaces: sidebar nav, auth form, task cards, command palette, modals
  - Add `role="button"`, `tabindex="0"`, `aria-label` to all `<div onclick>` elements
  - Add `<label for="...">` to every form input; use `<button>` elements for new components

---

### 13. Token refresh silently swallows errors, masking sync breakage for mobile users
- **What**: AI feature calls use `await _sbToken().catch(()=>'')` — if the Supabase refresh token is expired, the token silently becomes an empty string, the AI proxy gets a 401, and the user sees a vague "Sign in" error while the sync pill still shows "Connected".
- **Where**: `index.html:5013`, `index.html:10023-10027`
- **Why it matters**: Users on mobile with spotty connectivity can lose sync functionality and AI features with no clear recovery path.
- **Effort**: S
- **Suggested fix**:
  - Replace `.catch(()=>'')` with a handler that shows a persistent banner: "Session expired — reconnect in Settings"
  - Add one exponential-backoff retry before surfacing the error

---

## 💡 P3 — Nice to have

### 14. `seed()` / `seedGoals()` contain the developer's real personal medical and financial data
- **What**: The `seed()` function contains Greek-language personal tasks including medical appointments, real contact names ("Dimitra Giannakopoulou (Amazon)"), personal investment figures, and hundreds of backlog tasks. Guarded by `if(!_hostedMode())`, so it doesn't run on the hosted version — but it's committed to public version control.
- **Where**: `index.html:4532-4924`, `4926-4979`
- **Why it matters**: Privacy risk for the developer; deeply confusing for anyone self-hosting or contributing to the open-source repo.
- **Effort**: S
- **Suggested fix**:
  - Replace `seed()` / `seedGoals()` with the same neutral `_seedStarter()` data used for hosted new users
  - Move personal dev data to a git-ignored local config file if needed for local development

### 15. `#ec4899` and off-spec pink category colors violate brand palette
- **What**: The Bucket List "Creative" category uses `#ec4899` (Tailwind pink-500). The task category "birthday" badge uses `--cb:#f79ac0` in dark mode and `#d1568f` in light mode — neither matches spec pinks (`#C2185B`, `#E353B6`). Pink badge `--cb` renders on the purple-tinted dark surface, creating a pink-on-purple combination that violates the explicit brand rule.
- **Where**: `index.html:12193` (`BL_CATS`), `index.html:50,58,179` (`--cb` variable)
- **Effort**: S
- **Suggested fix**:
  - Replace `#ec4899` with `#E353B6` in `BL_CATS.creative`
  - Update `--cb` to `#C2185B` (light) / `#E353B6` (dark)
  - Grep for other Tailwind pink/rose/violet constants: `#ec4899`, `#a855f7`, `#8b5cf6`

### 16. Readwise and Notion integrations have settings fields and CSP entries but no visible functionality
- **What**: Form fields for Readwise Token and Notion Integration Token exist in Settings with no in-app flows that visibly consume these tokens. Both services are in the Vercel CSP `connect-src`.
- **Where**: `index.html:2042-2044` (settings fields), `vercel.json` CSP
- **Effort**: M
- **Suggested fix**:
  - Either implement the Readwise highlights import and Notion weekly-notes sync as working features with visible UI
  - Or remove the settings fields and CSP entries until the integrations are ready to ship

---

_Total: 16 items across 4 tiers. Top priority this sprint: items 1 (wrong name), 2 (AI identity hardcoding), 3 (push icon), 4 (rate limiting), 5 (API key exposure in givelink.html)._
