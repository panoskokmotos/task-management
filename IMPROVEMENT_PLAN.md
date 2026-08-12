# Improvement Plan — Arete Task OS
_Generated 2026-08-12_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icons 404 every time
- **What**: Service worker references `./icons/icon-192.png` and `./icons/icon-192.png` for the notification badge, but no `icons/` directory exists — the real files are `./icon-192.png` and `./icon-512.png` at the root.
- **Where**: `sw.js:47-48`
- **Why it matters**: Every push notification (reminders, ntfy, daily kickoff) is delivered without an icon and may silently fail on stricter browsers. This kills trust in the notification system.
- **Effort**: S
- **Suggested fix**:
  - Change `./icons/icon-192.png` → `./icon-192.png` and `./icons/icon-192.png` → `./icon-192.png` in the push handler.
  - Add `icon-512.png` as the badge instead of repeating 192.

---

### 2. Google Fonts blocked by the production CSP
- **What**: `vercel.json` sets `style-src 'self' 'unsafe-inline'` and `font-src 'self'`, which blocks the Google Fonts stylesheet (`fonts.googleapis.com`) and the actual font files (`fonts.gstatic.com`) at the CDN level.
- **Where**: `vercel.json:15` (CSP header) · `index.html:14-16` (Google Fonts `<link>` tags)
- **Why it matters**: Inter never loads in production — the app renders in the OS fallback sans-serif. Every screenshot and social share looks wrong compared to marketing assets.
- **Effort**: S
- **Suggested fix**:
  - Add `https://fonts.googleapis.com` to `style-src` in the CSP.
  - Add `https://fonts.gstatic.com` to `font-src`.
  - Alternatively, self-host Inter (download the WOFF2 subset, drop it in the repo, remove the Google dependency entirely — also fixes the connection-privacy issue).

---

### 3. AI features are dead on arrival for all new users
- **What**: `APP_CONFIG.aiProxy` is an empty string (line 9959). The landing page's headline promise is "AI that clears your inbox and plans your day," but every AI button hits the `Add Claude API key in Settings` toast until a user pastes their own key — a friction wall most won't clear.
- **Where**: `index.html:9959` · `index.html:5006-5033` (`callClaude`) · all ~25 `callClaude` call sites
- **Why it matters**: The #1 conversion argument is broken. Guest users trying "triage inbox" or "plan my day" get an error toast, not a wow moment. This is the biggest conversion killer in the product.
- **Effort**: M
- **Suggested fix**:
  - Deploy `api/claude.js` to Vercel and set the `ANTHROPIC_API_KEY` environment variable. Point `aiProxy` to the deployed endpoint.
  - For unauthenticated guests, expose a limited daily quota (e.g. 5 AI calls) behind the proxy instead of hard-blocking.
  - As a quick workaround: update the empty-proxy toast to say "Connect cloud sync to unlock AI" and route users to the sign-in flow, rather than showing a technical error.

---

### 4. `aiAutoTriage` and `aiPlanDay` leak the AI lock on early exit
- **What**: Both functions call `_aiLock` then use `_aiUnlock` without a `try/finally` block. If the `callClaude` call internally throws an uncaught rejection (possible if the fetch stack is interrupted), the lock key stays in `_aiInFlight` permanently — the button is dead for the rest of the session.
- **Where**: `index.html:5048 + 5060` (`aiAutoTriage`) · `index.html:5126 + 5136` (`aiPlanDay`)
- **Why it matters**: The "Triage Inbox" and "Plan my day" buttons silently stop working mid-session. Newer functions already use `try/finally` correctly (e.g. `aiSequenceTasks` at line 5206).
- **Effort**: S
- **Suggested fix**:
  - Wrap the body of `aiAutoTriage` from after `_aiLock` through the end in `try { … } finally { _aiUnlock('aiAutoTriage'); }`.
  - Do the same for `aiPlanDay`.

---

### 5. New users see "Good morning, Panos 👋" — not their own name
- **What**: `profileName` defaults to `'Panos'` (line 2519). Any new user who lands on the app before setting their name — including all guests and magic-link signups before the greeting is overwritten — sees the greeting addressed to the developer.
- **Where**: `index.html:2519` · `index.html:11254` (reminder text also hardcodes "Panos")
- **Why it matters**: Instantly breaks the "this is yours" feeling. Reported by at least one user in the early-access cohort. Also means shared referral links show the wrong name to the invitee.
- **Effort**: S
- **Suggested fix**:
  - Change `let profileName = localStorage.getItem('taskos_name') || 'Panos';` → `|| 'friend'` (or `|| ''` and omit the name from the greeting).
  - In `initReminders()` line 11254, replace the hardcoded string with `profileName || 'you'`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. OG/canonical URLs point to the ugly dev Vercel slug
- **What**: Every social share — from both the app and the landing page — shows `task-management-beige-eight.vercel.app` in the preview card URL and canonical tag.
- **Where**: `index.html:24-32` · `landing.html:11-21` · `index.html:10180` (`_APP_URL`) · `index.html:10232` (share card footer text)
- **Why it matters**: Every share and every referral link advertises a dev URL. Kills credibility when users share "their progress" cards on social media. Referral tracking also points at the wrong origin.
- **Effort**: S
- **Suggested fix**:
  - Register a real domain (e.g. `arete.so` or `myarete.app`), set it as the Vercel custom domain.
  - Do a grep-and-replace for `task-management-beige-eight.vercel.app` across all HTML files and `_APP_URL`.
  - Move `_APP_URL` to `APP_CONFIG` so it's one touch point.

---

### 7. Share progress card shows "Task OS" branding, not "Arete"
- **What**: The canvas share card (line 10214-10215) renders the text "Task" + "OS" in different colors — the old brand name. Users sharing on social are promoting a product name that no longer exists.
- **Where**: `index.html:10214-10215`
- **Why it matters**: Every shared progress card is a brand impression. Showing the old brand confuses new users clicking into the link.
- **Effort**: S
- **Suggested fix**:
  - Replace the `fillText('Task', ...)` + `fillText('OS', ...)` split with a single `fillText('Arete', ...)` styled with the brand gradient.
  - Update the footer at line 10232 to use the correct domain once P1-6 is done.

---

### 8. "Givelink" appears as a UI category visible to all users
- **What**: `CATS` at line 2503 defines `givelink: {l:'Givelink', e:'🟣'}` as a first-class task category shown in every task form and filter. A dedicated `renderGivelinkDash` view is reachable via `nav('givelink-dash')`. Seeded tasks mention "Givelink" by name. For any user who isn't the founder this is a confusing dead-end.
- **Where**: `index.html:2503` (CATS) · `index.html:2984` (renderView map) · `index.html:4546-4871` (seed data)
- **Why it matters**: New users see "Givelink" in their category picker with no context. If Arete is meant to go public, leaking a founder-specific company as a built-in category erodes polish.
- **Effort**: M
- **Suggested fix**:
  - Remove the `givelink` key from the global `CATS` constant. It can be a user-defined custom category.
  - Remove `renderGivelinkDash` from the public nav map, or guard it behind a feature flag / `_hostedMode` check.
  - Strip personal/Givelink seed tasks; keep generic onboarding examples.

---

### 9. AI prompts are hardcoded with personal context ("Panos", "Greek founder", "Givelink")
- **What**: At least 12 `callClaude` prompts fall back to personal context strings like `"Panos — Greek founder in his 20s building Givelink"` when `getAboutMe()` returns empty. Any new user who hasn't filled out the About Me section gets AI output that references the founder's life.
- **Where**: `index.html:5647` · `5920` · `7849` · `9806` · `11415` · `11524` · `11672` · `12945` and more
- **Why it matters**: Users get AI insights about someone else's startup and life circumstances. Trust-breaking if noticed.
- **Effort**: M
- **Suggested fix**:
  - Replace all `|| 'Panos — Greek founder…'` fallbacks with a generic `|| 'a goal-oriented professional'`.
  - Prompt the user to fill out About Me during first-run onboarding rather than using a hardcoded default.

---

### 10. Morning reminder hardcodes "Panos" in the notification body
- **What**: `initReminders()` seed at line 11254: `msg: 'Good morning Panos! Check your One Thing and start focused work.'`
- **Where**: `index.html:11254`
- **Why it matters**: Any user who enables morning reminders gets a notification addressed to the wrong person — immediate unsubscribe moment.
- **Effort**: S
- **Suggested fix**: Change to `'Good morning! Check your One Thing and start focused work.'` or interpolate `profileName`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `index.html` is a 14,924-line monolith
- **What**: The entire app — styles, HTML, and ~12,000 lines of JavaScript — lives in a single file. One bad regex can corrupt the whole file. IDE search is slow. Every PR diff is unreadable.
- **Where**: `index.html` (entire file)
- **Why it matters**: Velocity slows as the file grows. It's already at the point where AI-assisted edits frequently break unrelated sections.
- **Effort**: L
- **Suggested fix**:
  - Extract CSS into `styles.css`, loaded as a `<link>`.
  - Split JS into modules: `app-core.js`, `ai.js`, `sync.js`, `render-*.js`. Use `<script type="module">` or a simple bundler.
  - Keep HTML thin — just structure and the `APP_CONFIG` block.

---

### 12. `givelink.html` and its manifest are still cached by the service worker
- **What**: `sw.js` STATIC/HTML arrays include `./givelink.html` and `./manifest-givelink.json`. Commit #73 removed Givelink from the Task OS but these files and their cache slots remain.
- **Where**: `sw.js:4` (`manifest-givelink.json`) · `sw.js:16` (`./givelink.html`) · `vercel.json:4` (route still exists)
- **Why it matters**: Wastes cache quota. Cache names are now stale; a future SW version bump will force re-download of files nobody navigates to.
- **Effort**: S
- **Suggested fix**:
  - Remove `./givelink.html` and `./manifest-givelink.json` from `STATIC` and `HTML` in `sw.js`.
  - Remove the `/givelink` rewrite from `vercel.json` (or redirect it to the main app with a 301).

---

### 13. `PostHog` analytics key is empty — the funnel is invisible
- **What**: `APP_CONFIG.posthogKey` is `''` (line 9960). Multiple `track(...)` calls are sprinkled throughout the app, but no events are reaching PostHog. The landing page also has PostHog set up conditionally — but again gated on a key.
- **Where**: `index.html:9960` · `landing.html` (PostHog block)
- **Why it matters**: No data on which AI features convert users, where guest→signup funnel drops, or which landing CTA performs. Flying blind.
- **Effort**: S
- **Suggested fix**:
  - Set `posthogKey` to the actual PostHog project API key.
  - Same key in the landing page's PostHog snippet to stitch landing → app funnel.

---

### 14. `console.warn` calls left throughout production code
- **What**: ~17 `console.warn` / `console.error` calls remain in production (e.g. `console.warn('seed', e)`, `console.error('initial render failed…')`, etc.). Not a security issue, but they surface in user bug reports and obscure real errors.
- **Where**: `index.html:2573, 2598, 3659, 3737, 10656, 10660-10665, 10689, 11291, 11335, 11436, 11664, 13764-13770` and others
- **Why it matters**: Makes error triage noisy; important errors get buried in expected-failure noise.
- **Effort**: S
- **Suggested fix**:
  - Replace `console.warn` for expected-failure fallbacks with silent swallows.
  - Keep `console.error` only for genuinely unexpected states.
  - Consider a thin `log(msg)` wrapper that's a no-op in production (`if(!DEV) return`).

---

## 💡 P3 — Nice to have

### 15. Exported files still use `taskos-` prefix, not `arete-`
- **What**: Backup downloads, ICS exports, CSV exports all use `taskos-backup-…`, `taskos-tasks-…`, etc.
- **Where**: `index.html:2602, 2628, 2652, 2668, 2675, 10243, 10247`
- **Why it matters**: Minor brand inconsistency visible to every exporting user.
- **Effort**: S
- **Suggested fix**: Global find-and-replace `taskos-` → `arete-` in download filename strings.

---

### 16. The ntfy topic example still says `taskos-panos-2026`
- **What**: The ntfy setup tooltip (line 11385) suggests `taskos-panos-2026` as an example topic — both old brand and personal name.
- **Where**: `index.html:11385`
- **Why it matters**: Minor, but new users copy example strings verbatim.
- **Effort**: S
- **Suggested fix**: Change example to `arete-yourname-2026`.

---

### 17. Supabase anon key is in-source — add a rotation reminder
- **What**: `APP_CONFIG.supabaseAnon` is committed in plain text (line 9958). The comment says it's safe because RLS protects data — which is true for this key type. But there's no mechanism to rotate it if RLS is ever misconfigured.
- **Where**: `index.html:9957-9958`
- **Why it matters**: Low risk today; medium risk if RLS policies change or a Supabase breach occurs.
- **Effort**: S
- **Suggested fix**: Move `supabaseUrl` and `supabaseAnon` to a non-committed config file or a build-time injection step. At minimum, add a `SUPABASE_ANON_KEY` note in a `.env.example` file so the rotation path is documented.

---

### 18. The `givelink` category in seeds creates ~40 tasks on first load for new (non-hosted) users
- **What**: The `seed()` function creates 40+ tasks in the `givelink` category referencing specific company names, CRMs, and personal projects. Users who self-host without accounts get an inbox pre-filled with a stranger's task list.
- **Where**: `index.html:4546-4905` (seed function body)
- **Why it matters**: Low risk for the hosted product (seeding is gated by `_hostedMode()` check), but confusing for anyone who clones and self-deploys.
- **Effort**: M
- **Suggested fix**: Replace the personal seed data with 5–8 generic demo tasks that illustrate the app's capabilities without referencing real people, companies, or private plans. Move the real personal tasks to a private `import()` template instead.

---

_Total: 18 items across 4 tiers. P0 items 1–5 are production bugs, most fixable in under an hour each. P1 items 6–10 directly affect conversion. P2 items 11–14 are the biggest velocity tax._
