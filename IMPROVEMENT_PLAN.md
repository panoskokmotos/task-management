# Arete Improvement Plan
_Generated: 2026-08-19_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. API proxy has no rate limiting — anyone can drain your Anthropic budget
- **What**: `/api/claude.js` has zero per-user rate limiting; a leaked or brute-forced endpoint URL lets anyone call it indefinitely at your expense.
- **Where**: `api/claude.js:12–48` (the entire handler)
- **Why it matters**: A single automated script can burn hundreds of dollars before you notice. The code itself says _"Note: this is a minimal proxy. For production add per-user rate limiting."_ This is shipped production code.
- **Effort**: M
- **Suggested fix**:
  - Add a Redis/Upstash counter keyed on `uid` (from the validated Supabase token). Reject with 429 after N requests per user per rolling window (e.g., 20 calls/hour).
  - As an immediate band-aid, check `SUPABASE_URL` is set so unauthenticated calls are always rejected (currently the guard is optional).
  - Add an `allowedOrigins` check so only your domain can POST to the route.

---

### 2. XSS: task titles and goal titles rendered raw in innerHTML across the weekly review
- **What**: Three `innerHTML` assignments in `renderWizPanel()` inject `t.title` and `g.title` without calling `esc()`.
- **Where**: `index.html:3594`, `index.html:3601`, `index.html:3603`
- **Why it matters**: A task named `<img src=x onerror="…">` executes arbitrary JS in the user's session. More practically, any title containing `&`, `<`, or `>` (e.g., "Pay rent & utilities") renders broken HTML in the weekly review — a visible rendering bug that erodes trust.
- **Effort**: S
- **Suggested fix**:
  - Wrap every `${t.title}` and `${g.title}` inside these three strings with `esc(…)`.
  - Also fix `index.html:3844` (delete toast: `${t.title.slice(0,30)}`), `index.html:5557` (`p.name`, `p.why`), `index.html:5593` (`p.notes`), and `index.html:3531` (`v` in values list) — same pattern.

---

### 3. Push notification icon path is broken
- **What**: `sw.js` sends push notifications with `icon: './icons/icon-192.png'`, but that path doesn't exist; the actual file is `./icon-192.png` (no `icons/` subdirectory).
- **Where**: `sw.js:46–47`
- **Why it matters**: Every push notification (habit nudges, reminders) shows a broken icon. On some Android browsers, a broken icon silently drops the notification.
- **Effort**: S
- **Suggested fix**:
  - Change `./icons/icon-192.png` → `./icon-192.png` on both `icon` and `badge` fields.
  - Same fix on `badge: './icons/icon-192.png'` on the same line.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. AI features require users to paste their own Claude API key — kills activation
- **What**: `APP_CONFIG.aiProxy` is blank (`''`), so every user hits a "Add your Claude API key in Settings" gate before AI triage, day planning, or workflows work.
- **Where**: `index.html:9959` (`aiProxy: ''`)
- **Why it matters**: AI is the core differentiation. Requiring a personal Anthropic API key destroys activation for non-technical users (which is most users). The proxy infrastructure already exists in `/api/claude.js` — it just needs to be wired up.
- **Effort**: S
- **Suggested fix**:
  - Deploy `/api/claude.js` with `ANTHROPIC_API_KEY` + `SUPABASE_URL` on Vercel, then set `aiProxy: 'https://your-app.vercel.app/api/claude'`.
  - Remove the "Add Claude API key" prompt for users in hosted mode (when `_hostedMode()` is true).

---

### 5. PostHog key is blank — zero analytics visibility into any funnel
- **What**: `APP_CONFIG.posthogKey` is `''`, so every `track()` call throughout the app is a silent no-op. No signup funnel, no feature adoption, no retention data.
- **Where**: `index.html:9960` (`posthogKey: ''`)
- **Why it matters**: There are 100+ `track()` calls covering every meaningful user action. None are firing. You're operating blind on growth, churn, and feature ROI.
- **Effort**: S
- **Suggested fix**:
  - Create a PostHog project (free tier supports ~1M events/month), paste the key.
  - The landing page already has its own PostHog snippet (from commit #83) — verify it uses the same key so landing → signup funnel is connected.

---

### 6. Referral links, share card text, and OG image URLs are hardcoded to the old Vercel subdomain
- **What**: `_APP_URL = 'https://task-management-beige-eight.vercel.app/'` is the constant used for referral links and embedded in the share-card canvas. OG tags in `index.html` also hardcode this URL.
- **Where**: `index.html:10180` (`_APP_URL`), `index.html:10232` (canvas text), `index.html:24–25` (OG tags)
- **Why it matters**: Every social share and referral link points to the un-branded Vercel subdomain instead of your real domain. The share card screenshot users post has this URL burned into it visually.
- **Effort**: S
- **Suggested fix**:
  - Replace `_APP_URL` with `window.location.origin + '/'` so it auto-adapts to whatever domain is deployed.
  - Update OG image URLs to use a relative path or a config-driven hostname.

---

### 7. No "forgot password" path in the auth gate
- **What**: The login form (`#auth-gate`) has email + password, a magic-link button, and Google OAuth — but no "I forgot my password" link/flow.
- **Where**: `index.html:~851–950` (auth-gate HTML block), `index.html:10072–10095` (`authSubmit`)
- **Why it matters**: Users who set a password and forget it see "Wrong email or password" with no recovery path. The magic link is a workaround but isn't labeled as such — most users will bounce.
- **Effort**: M
- **Suggested fix**:
  - Add a "Forgot password?" link that calls `/auth/v1/recover` with the user's email (Supabase has this endpoint built-in).
  - Show a confirmation message; Supabase sends the reset email automatically.

---

### 8. Delete-task toast renders `t.title` as raw HTML, breaking titles with HTML characters
- **What**: `toast(`🗑 "<strong>${t.title.slice(0,30)}</strong>"…`)` — `toast()` uses `el.innerHTML = msg`, so any `<`, `>`, or `&` in the title renders as HTML in the toast.
- **Where**: `index.html:3844`, `index.html:2787–2789` (`toast()` implementation)
- **Why it matters**: A task named "Pay mortgage & utilities" shows as "Pay mortgage " in the delete toast (the `&` and everything after it is parsed as a broken HTML entity).
- **Effort**: S
- **Suggested fix**:
  - Wrap the title in `esc()`: `` `🗑 "<strong>${esc(t.title.slice(0,30))}</strong>"… ``
  - Alternatively, build the toast as a DOM node instead of raw innerHTML so escaping is automatic.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. 14,924-line monolith in a single HTML file
- **What**: The entire application — CSS, HTML structure, ~12,000 lines of JavaScript, inline config — lives in one `index.html` file.
- **Where**: `index.html` (entire file)
- **Why it matters**: Impossible to write meaningful tests. Every PR diff is a wall of noise. Global variable collisions are silent. Lint/type-check tools can't help. Any refactor risks breaking something invisible.
- **Effort**: L
- **Suggested fix**:
  - Minimum viable split: extract JS to `app.js`, CSS to `app.css`, referenced from `index.html`. This alone unlocks linting and makes diffs readable.
  - Longer term: introduce ES modules and a simple Vite/esbuild build step.

---

### 10. App config (Supabase URL + anon key) hardcoded in source, committed to git
- **What**: `APP_CONFIG.supabaseUrl` and `APP_CONFIG.supabaseAnon` are plaintext in the repo.
- **Where**: `index.html:9957–9958`
- **Why it matters**: While the anon key is designed to be public (RLS handles security), hardcoding it means: (a) you can't rotate keys without a full deploy, (b) they appear in git history forever, (c) any fork of this repo exposes your project URL.
- **Effort**: S
- **Suggested fix**:
  - Move to Vercel environment variables injected at build time, or a config endpoint that returns safe public config. For a single-file app, a build step that replaces `%%SUPABASE_URL%%` placeholders is the minimal path.

---

### 11. `givelink.html` is still in the service worker cache despite the product split
- **What**: `sw.js:17` caches `./givelink.html` in the Arete PWA. The `givelink.html` file (1,755 lines) also still exists in the root.
- **Where**: `sw.js:17`, `givelink.html` (entire file)
- **Why it matters**: Commit #73 "Remove Givelink from Task OS" intended to separate the products, but the file and its SW cache entry remain. Every Arete install unnecessarily caches the Givelink page.
- **Effort**: S
- **Suggested fix**:
  - Remove `'./givelink.html'` from the `HTML` array in `sw.js`.
  - Decide whether `givelink.html` should live in this repo at all, or move to its own deployment.

---

### 12. Person names, notes, and values rendered without `esc()` in multiple views
- **What**: `p.name`, `p.why`, `p.notes` (people view), and `v` (values list) inserted raw into `innerHTML`.
- **Where**: `index.html:5557`, `index.html:5593`, `index.html:3531`
- **Why it matters**: Same class of bug as #2. Characters like `&` break display. This will silently corrupt person profile cards any time a name or note contains a special character.
- **Effort**: S
- **Suggested fix**:
  - Wrap each with `esc()`. In the people view: `esc(p.name)`, `esc(p.why)`, `esc(p.notes)`.
  - In the values list: `esc(v)`.

---

### 13. `_APP_URL` constant used for canvas drawing (share card) — breaks if domain changes
- **What**: `index.html:10232` burns the literal string `'Made with Arete · task-management-beige-eight.vercel.app'` into the canvas-drawn share card. This is a separate bug from the `_APP_URL` constant (item #6) — this one is a hardcoded string literal, not a variable reference.
- **Where**: `index.html:10232`
- **Why it matters**: Every share card generated by any user shows the wrong domain. This is visible in any screenshot posted publicly.
- **Effort**: S
- **Suggested fix**:
  - Replace the hardcoded domain with `window.location.hostname` in the canvas draw call.

---

## 💡 P3 — Nice to have

### 14. Landing page has no mobile navigation menu
- **What**: `nav-links` are `display:none` at ≤760px breakpoint but there's no hamburger or mobile menu replacement.
- **Where**: `landing.html:291` (`@media(max-width:760px){.nav-links{display:none}}`)
- **Why it matters**: Mobile visitors (likely 50%+ of landing traffic) can't navigate to the FAQ, comparison, or features sections.
- **Effort**: M
- **Suggested fix**: Add a minimal hamburger that toggles a full-screen nav overlay, or collapse the nav links into a `<details>` element with no JS required.

---

### 15. Share card canvas may not have Inter loaded — falls back to system font
- **What**: Canvas at `index.html:~10220` draws text with `'600 30px Inter, sans-serif'`. Canvas ignores `@font-face` unless the font is pre-loaded and resolved.
- **Where**: `index.html:~10220–10240`
- **Why it matters**: On first load (before Inter is cached), the share card renders in a different font — making it look amateurish vs. the brand.
- **Effort**: S
- **Suggested fix**:
  - Call `document.fonts.load('600 30px Inter').then(…)` before drawing, or use a `FontFace` load promise.

---

### 16. Evening habit nudge runs every minute and uses `setInterval` at the top level
- **What**: `setInterval(…, 60000)` at `index.html:10712` checks the time every minute and fires a toast after 21:00. It runs for the entire browser session, even if the user has closed the app view.
- **Where**: `index.html:10712–10723`
- **Why it matters**: Minor memory/battery drain on mobile. More importantly, the toast fires every time the tab is reactivated after 21:00 (because sessionStorage is checked per-tab, not per-visit).
- **Effort**: S
- **Suggested fix**: Use `setTimeout` to the next 21:00 boundary instead of polling every minute.

---

### 17. `supabase-setup.sql` is referenced in the UI but not linked or downloadable from it
- **What**: The settings modal text says _"run the provided `supabase-setup.sql`"_ but doesn't link to the file.
- **Where**: `index.html:2059`
- **Why it matters**: Self-hosters following the in-app setup instructions have to find the file themselves in the GitHub repo.
- **Effort**: S
- **Suggested fix**: Add a download link: `<a href="./supabase-setup.sql" download>Download supabase-setup.sql</a>` next to the instructions.

---

_Total: 17 items. Ordered by ROI within each tier._
