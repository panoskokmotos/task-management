# Arete — Improvement Plan
*Generated 2026-07-22 by automated codebase review*

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Notification icon path is broken — push/reminder notifications show no icon
- **What**: `sw.js` and `index.html` reference `./icons/icon-192.png` for notification icons, but the file lives at `./icon-192.png` (no `icons/` subdirectory). Every push notification and scheduled reminder shows a broken or missing icon; on strict iOS PWA builds a missing icon can silently suppress the notification.
- **Where**: `sw.js:46-47`, `index.html:11289`
- **Why it matters**: Reminders are a core retention feature. A broken icon signals an unreliable app and can prevent notifications from appearing on some browsers.
- **Effort**: S
- **Suggested fix**:
  - Change `'./icons/icon-192.png'` → `'./icon-192.png'` in both `sw.js:46-47` and `index.html:11289`.
  - Bump the SW cache name (`CACHE = 'arete-20260723'` → today's date) so the fix reaches all installed users.

---

### 2. XSS: task/goal titles injected into `innerHTML` without `esc()` in weekly review
- **What**: The weekly review wizard renders `t.title` and `g.title` directly into `innerHTML` template literals without calling the app's own `esc()` helper. A title like `<img src=x onerror=alert(1)>` stored in localStorage (or synced from Supabase) will execute in the user's session.
- **Where**: `index.html:3594` (step 0 — completed tasks), `index.html:3601` (step 2 — backlog), `index.html:3603` (step 3 — goal progress), `index.html:2543` (dependency selector `<option>` tags — title not escaped before injecting into HTML attribute)
- **Why it matters**: Self-XSS allows privilege escalation if data is ever injected server-side (e.g. a compromised Supabase sync). It also breaks the review UI when task titles contain `<` or `&`.
- **Effort**: S
- **Suggested fix**:
  - In each template literal, replace bare `${t.title}` / `${g.title}` with `${esc(t.title)}` / `${esc(g.title)}`.
  - Line 2543: wrap `t.title.slice(0,45)` with `esc(t.title.slice(0,45))`.
  - Search for other `innerHTML` usages that reference user-supplied fields (`.title`, `.name`, `.notes`) and apply `esc()` consistently.

---

### 3. AI features silently broken in hosted mode — `aiProxy` is empty
- **What**: `APP_CONFIG.aiProxy` is `''` (line 9959). In hosted mode this means every AI feature (Plan My Day, Auto-Triage, AI Commands, Morning Briefing) immediately bounces with a toast: *"Add your Claude API key in Settings"*. There is no guide in the UI for how to get one, and new users have no expectation they need to supply infrastructure credentials.
- **Where**: `index.html:9959`, `index.html:4328`, `index.html:5047`, `index.html:5111`
- **Why it matters**: AI is the product's main differentiator and is featured on the landing page. Every user who hits an AI button in a hosted deployment and gets a settings toast is a conversion-killing dead end.
- **Effort**: M
- **Suggested fix**:
  - Deploy `/api/claude.js` on Vercel (or wherever the app is hosted) with `ANTHROPIC_API_KEY` set as an environment variable.
  - Set `aiProxy: '/api/claude'` (relative URL, works on any domain) in `APP_CONFIG`.
  - In the interim, update the fallback toast to explain the gap: *"AI features require a Claude key — contact support or add yours in Settings."*

---

### 4. `/api/claude` has no rate limiting — single user can drain Anthropic budget
- **What**: The serverless proxy explicitly notes *"for production add per-user rate limiting (e.g. Upstash)"* but has no implementation. Any authenticated user (or bot that obtains a valid token) can issue unlimited Claude API calls at the operator's expense.
- **Where**: `api/claude.js:12-13`, `api/claude.js:38-48`
- **Why it matters**: A single abusive account or a leaked session token can generate thousands of dollars in Anthropic API charges overnight. This is a direct financial risk.
- **Effort**: M
- **Suggested fix**:
  - Add [Upstash Rate Limit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) (free tier covers ~10k req/day): check `uid` from the verified Supabase session against a sliding window (e.g. 20 requests/hour per user).
  - Return 429 with a human-readable error (`"You've hit today's AI limit — try again later"`) so the app can surface a useful toast.
  - Until Upstash is wired, at minimum add a `max_tokens` hard cap at 2000 (already present) and log each call to Vercel logs for monitoring.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. OG tags and canonical URLs point to the Vercel staging domain
- **What**: Both `landing.html` and `index.html` hardcode `task-management-beige-eight.vercel.app` in `<link rel="canonical">`, `og:url`, `og:image`, and `twitter:image` meta tags. Social shares, Google indexing, and Open Graph previews all show the raw Vercel URL instead of a real brand domain.
- **Where**: `landing.html:10,15-16`, `index.html:23-24,31`
- **Why it matters**: Users who share the app via the built-in share flows will spread a URL that reads as a prototype. Google may index the wrong URL, splitting PageRank if a custom domain is later added.
- **Effort**: S
- **Suggested fix**:
  - Register a real domain (e.g. `userarete.com`) and update all hardcoded URLs in one pass.
  - Until then, set the canonical to `/` (root-relative) and use a relative `/og-image.png` for OG image to avoid baking in the wrong hostname.

---

### 6. Three inline 4-column grids with no mobile override — horizontal overflow on phone
- **What**: `proj-stats` (line 1573), the weekly review step-4 habit grid (line 3621), and `content-kanban` (line 14385) each use `style="display:grid;grid-template-columns:repeat(4,1fr);"` as inline styles. The app's responsive CSS at line 343 that collapses `.g4` to 1 column on ≤768px cannot override inline `style` attributes.
- **Where**: `index.html:1573`, `index.html:3621`, `index.html:14385`
- **Why it matters**: On a 375px iPhone screen these grids overflow the viewport horizontally, breaking the layout of the Projects, Review, and Content views — all key features.
- **Effort**: S
- **Suggested fix**:
  - Replace the inline `style="display:grid;grid-template-columns:repeat(4,1fr)"` with a CSS class (e.g. `.g4`) that already has the correct responsive rule.
  - Or wrap each grid in `<div style="overflow-x:auto;">` as an interim measure.

---

### 7. Auth: signup success with email-confirmation required shows confusing UI state
- **What**: When `SUPABASE_AUTH` requires email confirmation, `authSubmit()` (signup branch, line 10084) shows an error-styled message: *"Almost there — check your email to confirm, then log in."* The button re-enables but stays labeled "Sign up", leaving users on the auth gate with no visual progress indicator.
- **Where**: `index.html:10084`
- **Why it matters**: Signup confirmation is a high-abandonment moment. Showing an error-red message for a success state causes users to think something went wrong.
- **Effort**: S
- **Suggested fix**:
  - Use a distinct success state (green, different icon) when the confirmation email was sent.
  - Disable the form fields and show *"Check your inbox — confirmation sent to \<email\>"* with a resend link.
  - Switch the button label to "Resend email" and trigger the OTP flow on click.

---

### 8. `aiProxy` empty + no Claude key means AI features silently skip — no discoverability
- **What**: In self-hosted mode (no aiProxy), if the user hasn't added a Claude key, all AI buttons (`Plan My Day`, `Auto-Triage`) silently toast and return. There is no empty state guiding users toward the Settings → Claude API Key field.
- **Where**: `index.html:4328`, `index.html:5047`, `index.html:5111`
- **Why it matters**: AI is shown on the dashboard and in the feature tour. New self-hosters will click these expecting them to work and bounce when they don't, with no path to resolution shown.
- **Effort**: S
- **Suggested fix**:
  - Replace the generic toast with a mini-modal or inline callout: *"Set up AI in Settings → Claude API Key"* with a direct "Open Settings →" button that scrolls to the key field.
  - Add a subtle lock icon to AI buttons when `!S.claudeKey && !APP_CONFIG.aiProxy` so users know upfront they need configuration.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. 15,000-line monolith HTML — one typo breaks the entire app
- **What**: `index.html` is a single 14,924-line file containing all CSS, HTML structure, and JavaScript. There is no module boundary, no bundler, no lint step, and no tree-shaking. A misplaced `}` in any function silently kills the full script.
- **Where**: `index.html` (entire file)
- **Why it matters**: Velocity is already limited by the file size — every PR diff is unreviable. Any uncaught syntax error breaks all app functionality globally. This is the root cause of many bugs being hard to isolate.
- **Effort**: L
- **Suggested fix**:
  - Extract CSS into `style.css` and JS into `app.js` as a first step (no bundler needed — just `<link>` and `<script src>`).
  - Move the large data structures (seed tasks, CATS, WIZ_STEPS, challenge data) into separate `data.js` files.
  - Consider Vite or Parcel for a zero-config bundler step to enable ES modules and tree-shaking long-term.

---

### 10. State object `S` has 80+ untyped fields — sync is all-or-nothing
- **What**: `let S = {tasks:[], goals:[], values:[], ...}` (line 2517) has ~80+ fields. The entire object is serialized to localStorage and synced to Supabase as a single JSON blob. Last-write-wins means concurrent edits on two devices silently lose data. There is no schema validation on read.
- **Where**: `index.html:2517`, `index.html:10412` (`sbSyncNow`)
- **Why it matters**: As the app grows, the risk of silent data loss on multi-device use increases. Corrupt or partial JSON (e.g. from a quota-exceeded localStorage write) silently falls back to defaults and loses all data.
- **Effort**: L
- **Suggested fix**:
  - Add a lightweight schema check on `load()` — validate that critical fields (`tasks`, `goals`) are arrays before using them.
  - Add a `S._version` field and migrate shape on version bump.
  - Long-term: move to per-entity sync (sync tasks individually, not the full blob) to support conflict resolution.

---

### 11. Service worker caches `givelink.html` and `manifest-givelink.json` unnecessarily
- **What**: `sw.js:16` includes `'./givelink.html'` in the HTML cache list, even though `givelink.html` is a separate product (Givelink Sprint Board) that was explicitly separated from Arete in commit `d635c06`. Both files are still cached on every Arete PWA install.
- **Where**: `sw.js:13-18`
- **Why it matters**: Adds ~100KB to the Arete SW install payload. If `givelink.html` is later removed from the repo, the SW install will fail on that asset (currently guarded by `Promise.allSettled`, but still noisy).
- **Effort**: S
- **Suggested fix**:
  - Remove `'./givelink.html'` and `'./manifest-givelink.json'` from the `HTML` array in `sw.js`.
  - Bump the cache name so existing clients get the trimmed SW.

---

### 12. Silent `catch(e){}` blocks in non-trivial paths — errors are invisible
- **What**: Dozens of critical-path functions swallow errors in empty catch blocks with no logging, no user feedback, and no telemetry. Examples: guest nudge (`line:2587`), nav collapse state (`line:2949`), review draft banner (`line:3031`), and ~10 others in the init sequence.
- **Where**: `index.html:2587, 2949, 2983, 3031, 3583, 8066, 8071, 10120, 10134` (and more)
- **Why it matters**: When something breaks silently (e.g. the weekly review draft doesn't restore, the onboarding fails to trigger), there's no way to know. PostHog gets no signal and no error reaches the console.
- **Effort**: S
- **Suggested fix**:
  - For non-trivial catches: add at minimum `console.warn('context', e)` so errors appear in Vercel function logs and in the browser console during development.
  - For truly trivial UI-polish catches (haptic, confetti, toast), silence is acceptable — add a comment explaining why.

---

## 💡 P3 — Nice to have

### 13. `api/claude.js` uses `anthropic-version: 2023-06-01` — may miss newer features
- **What**: The Claude API proxy sends the oldest supported `anthropic-version` header. This won't break anything today but locks you out of Claude 4+ model features (extended thinking, computer use, interleaved tool calls) without a header change.
- **Where**: `api/claude.js:40`
- **Why it matters**: Low risk today. Will matter when upgrading to newer models with new capabilities.
- **Effort**: S
- **Suggested fix**: Update to `'anthropic-version': '2025-01-01'` and test that existing triage/planning prompts still parse correctly.

---

### 14. Accessibility: ~90 ARIA attributes across 15K lines of interactive UI
- **What**: The app has 90 total `aria-*` attributes across ~15K lines of HTML, meaning the vast majority of interactive elements (task cards, modals, dropdown menus, filter chips) have no keyboard role, `aria-pressed`, `aria-expanded`, or focus management.
- **Where**: Throughout `index.html` — notable gaps: `.tc` task cards (no `role="button"`), `.slash-menu` items (no `role="menuitem"`), `.mo` modals (no `aria-modal`, no focus trap)
- **Why it matters**: Screen reader users cannot use the app. Keyboard-only users cannot navigate modals or complete core flows. WCAG 2.1 AA compliance is required in many markets.
- **Effort**: L
- **Suggested fix**:
  - Start with the highest-traffic elements: add `role="button" tabindex="0"` to all `.tc` cards with keyboard (`Enter`/`Space`) event handlers.
  - Add focus traps to all `.mo` modals using a lightweight helper.
  - Add `aria-label` to all icon-only buttons (close `×`, FAB `+`, etc.).

---

### 15. Landing page `canonical` and OG image use HTTP not HTTPS-relative paths
- **What**: `landing.html:8` uses `href="/icon.svg"` (root-relative, correct) but OG image at line 15 bakes in the full `https://task-management-beige-eight.vercel.app/og-image.png`. If the site moves to a new domain, all existing social shares show the old domain's OG image indefinitely (until cache expires).
- **Where**: `landing.html:15,16,20`
- **Why it matters**: Low urgency now, becomes painful during a domain migration.
- **Effort**: S
- **Suggested fix**: Use an environment variable or a build-time substitution for the base URL across all OG meta tags, so a domain change requires one update.
