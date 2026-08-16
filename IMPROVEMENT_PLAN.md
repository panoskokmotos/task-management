# Arete — Improvement Plan

> Generated 2026-08-16. Based on static analysis of the repo at commit `b38d4bb`.
> Max 20 items, ordered by ROI within each tier.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. CSP blocks Google Fonts — every user sees wrong fonts

**What:** The Content-Security-Policy in `vercel.json` does not include `https://fonts.googleapis.com` in `style-src` or `https://fonts.gstatic.com` in `font-src`, so the Inter font load is blocked by the browser in production.

**Where:** `vercel.json:17` (`style-src 'self' 'unsafe-inline'`); `index.html:14-16` (Google Fonts preconnect + stylesheet link)

**Why it matters:** Every user on the deployed app sees system fonts instead of Inter. The design degrades visibly and the landing page looks unprofessional. All SEO screenshots and social previews use system fonts too.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src` in `vercel.json`.
- Add `https://fonts.gstatic.com` to `font-src` in `vercel.json`.
- Alternatively, self-host Inter (download and serve from `/`) and drop the external dependency entirely — eliminates this CSP issue and is faster.

---

### 2. `aiProxy` config is empty — all AI features fail for every new user

**What:** `APP_CONFIG.aiProxy` is set to `''`, but the deployed `/api/claude` proxy exists and is ready. Result: `callClaude()` takes the direct-browser path and prompts users to "Add Claude API key in Settings first" — a friction wall that blocks every first-time user from using any AI feature.

**Where:** `index.html:9959` (`aiProxy : ''`); `api/claude.js` (the working proxy endpoint)

**Why it matters:** Every AI feature (auto-triage, day plan, AI commands, daily picks, etc.) is blocked behind a manual API key entry step that most users will abandon. The product's core value prop is AI — this is a conversion killer.

**Effort:** S

**Suggested fix:**
- Set `aiProxy: '/api/claude'` in `APP_CONFIG` (relative URL works with Vercel's routing).
- Set the `ANTHROPIC_API_KEY` environment variable in Vercel → Project → Settings → Environment Variables.
- Verify the proxy works end-to-end for a signed-in user before deploying.

---

### 3. Service worker push notification uses wrong icon path

**What:** `sw.js:46-47` references `./icons/icon-192.png` for push notification icons. No `icons/` subdirectory exists; the actual file is at `./icon-192.png`. Every push notification shows a broken image.

**Where:** `sw.js:46-47`

**Why it matters:** Push notifications (reminders, recurring tasks) show a broken image on every device that has notifications enabled. This looks unprofessional and erodes trust in the product's quality.

**Effort:** S

**Suggested fix:**
- Change `sw.js:46-47` to `icon: './icon-192.png'` and `badge: './icon-192.png'`.
- Also update the CACHE version string (`arete-20260723` → today's date) to force the service worker to reinstall.

---

### 4. 15+ AI prompts hardcode "Panos" — wrong identity for every other user

**What:** Multiple `async function ai*` calls embed the literal string "Panos", "Greek founder", "Givelink", and "SF move" directly in the prompt, bypassing `profileName` and `getAboutMe()`. Any other user gets AI advice addressed to and calibrated for the app developer.

**Where:** `index.html:5647` (`aiRelNudge`), `5920` (`aiDiscomfortInsight`), `7319` (`aiSocialAudit`), `7477` (`aiExtractTasksFromNotes`), `7849` (`aiSuggestDecisions`), `9806` (`aiKTPatterns`), `11415`, `11516`, `11524`, `11672` — at minimum 10 callsites.

**Why it matters:** Any user who isn't "Panos building Givelink" receives AI output that is explicitly and incorrectly personalized. This makes the app feel broken and limits the userbase to one person.

**Effort:** M

**Suggested fix:**
- Replace all hardcoded `"Panos"` occurrences in prompt strings with the template variable `${profileName}`.
- Replace hardcoded context ("Greek founder," "Givelink," "SF move") with `${getAboutMe()||'a founder'}` or `${S.about||''}`.
- Audit every `async function ai*` for hardcoded personal context before the next user-facing deploy.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. AI 401 error shown as "Please sign in again" — wrong CTA for guests

**What:** When a guest (not signed in) calls an AI feature and the proxy returns 401, `callClaude()` shows `'Please sign in again'` (line 5028). But guests aren't "signed in again" — they need to *create an account*. The CTA mismatches the action.

**Where:** `index.html:5028` (the `res.status===401` branch in `callClaude`)

**Why it matters:** This is a conversion moment — a guest tries AI, hits a wall, and the message confuses them instead of routing them to sign-up. Guest-to-signup conversion is lost.

**Effort:** S

**Suggested fix:**
- In the `401` branch, check `_isGuest()`: if true, show `'Create a free account to use AI features'` and call `openAuthGate()`.
- If the user is already signed in, then show `'Session expired — please sign in again'`.

---

### 6. OG image and canonical URL hardcoded to Vercel dev subdomain

**What:** `og:url` (`line 24`) and `og:image` (`lines 25-26, 31-32`) point to `https://task-management-beige-eight.vercel.app/`. Every link share (Slack, Twitter, iMessage) shows the wrong domain and fetches the image from the dev URL, which may be cached forever.

**Where:** `index.html:24-26, 29-32`

**Why it matters:** Social sharing is a core PLG acquisition channel (referral links, share-the-win moments, goal accountability invites). Every shared link previews the dev domain, which reduces trust and click-through rate.

**Effort:** S

**Suggested fix:**
- Replace the hardcoded domain with the production URL (e.g. `https://arete.app` or whatever the canonical domain is).
- Replace the `og:image` URL similarly, or use a relative path if the CDN supports it.
- Add a `/sitemap.xml` canonical URL update at the same time.

---

### 7. Stats grid: 5 items in a 2-column mobile layout orphans the 5th card

**What:** The `.stats` grid on the dashboard has 5 stat cards. On mobile, `grid-template-columns: repeat(2,1fr)` creates a 2×3 layout where the 5th card spans half the row — visually misaligned and looks like a missing card slot.

**Where:** `index.html:338` (mobile `@media` CSS for `.stats`), `index.html:113` (`.stats` definition with 5 columns on desktop)

**Why it matters:** The dashboard is the first screen users see after login. A visually broken stats row immediately signals low quality and hurts engagement with the daily-use core loop.

**Effort:** S

**Suggested fix:**
- Change mobile `.stats` to `grid-template-columns: repeat(2,1fr)` and hide one less-critical stat card on mobile (e.g., the "in progress" count), OR
- Use `repeat(3,1fr)` at ≥360px and `repeat(2,1fr)` at <360px, which leaves 3+2 = no orphan.
- Alternatively, collapse all stats into a horizontal scroll row on mobile (already done for `.ph .row`).

---

### 8. `profileName` defaults to 'Panos' — new users greeted as someone else

**What:** `let profileName = localStorage.getItem('taskos_name') || 'Panos'` at line 2519. Before any profile is set, every new guest or new account sees "Good morning, Panos 👋" on the dashboard.

**Where:** `index.html:2519` (module-level variable initialization), `index.html:1070` (static HTML default), `index.html:3009` (greeting render)

**Why it matters:** It's the first thing a new user reads after landing. Seeing someone else's name immediately breaks the "this is mine" feeling and looks like a bug, not a product.

**Effort:** S

**Suggested fix:**
- Change the fallback to `'there'` (→ "Good morning, there") or prompt for a name on first run.
- After first-run completes, save the chosen name from the life-area chip selection context or from the sign-up email.
- The `_afterAuth` handler already personalizes from the email (line 10458) — the gap is for guests before sign-up.

---

### 9. No rate limiting on the AI proxy — one user can exhaust the API budget

**What:** `api/claude.js:12-13` includes a comment that explicitly flags the missing rate limit: "For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill." This is unimplemented.

**Where:** `api/claude.js:12-13`, the `handler` function

**Why it matters:** Once `aiProxy` is wired up (P0 item #2), a single user — or a scripted attacker who discovers the endpoint — can call the proxy in a tight loop and exhaust the monthly Anthropic budget. This is a business-continuity risk.

**Effort:** M

**Suggested fix:**
- Add Upstash Redis rate limiting: `npm install @upstash/ratelimit @upstash/redis`, then gate on `userId` from the Supabase token (already decoded in the handler).
- Limit to e.g. 50 requests per user per day. Return `429` if exceeded.
- Alternatively, check the Supabase JWT claims to get the user ID without a separate Upstash dependency.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 10. 15,000-line monolithic HTML file

**What:** `index.html` is a single file containing ~500 lines of CSS, ~8,000 lines of HTML templates, and ~6,500 lines of JavaScript with no module boundaries, imports, or build step.

**Where:** `index.html` (entire file, 14,924 lines)

**Why it matters:** Finding, reviewing, and editing any feature requires grepping a 15k-line file. No dead code detection, no tree-shaking, no tests can hook into individual functions. Every feature PR touches the same file, creating merge conflicts.

**Effort:** L

**Suggested fix:**
- Don't rewrite all at once. Start by extracting the three clearest seams: (a) CSS into `styles.css`, (b) `api/claude.js`-adjacent logic into `ai.js`, (c) Supabase sync into `sync.js`.
- Use `<script type="module">` + native ES modules (no bundler needed for this app pattern).
- Aim for files under 500 lines each.

---

### 11. `.gc{}` CSS rule defined twice — second definition silently overrides first

**What:** The `.gc` class (goal card) is defined at `index.html:242` and again at `index.html:320` with slightly different styles. The second definition wins, making the first invisible and confusing to maintainers.

**Where:** `index.html:242` and `index.html:320`

**Why it matters:** Any developer editing the goal card styles will modify the wrong rule and wonder why the change doesn't work. The CSS payload is also slightly larger than needed.

**Effort:** S

**Suggested fix:**
- Remove the first `.gc{}` block at line 242 (which only has `background`, `border`, `border-radius`, `padding`, `margin-bottom`, `cursor`, `transition`).
- Ensure the second `.gc{}` block at line 320 includes all needed properties including `.gc.top`.

---

### 12. `toast()` accepts raw HTML — XSS footgun pattern

**What:** `toast()` at line 2789 does `el.innerHTML = msg`. Currently all call sites pass trusted internal strings, but the function is called in ~30 places and the pattern invites future bugs where user-controlled text is passed without escaping.

**Where:** `index.html:2789` (toast implementation), `index.html:2775` (the undo-delete toast passes an `<a>` tag)

**Why it matters:** One future `toast(t.title)` call (where `t.title` is user input) creates a stored XSS. The pattern is particularly risky because `toast()` is the most frequently called helper in the file.

**Effort:** S

**Suggested fix:**
- Change `el.innerHTML = msg` to `el.textContent = msg` for the base case.
- For toasts that genuinely need a link (the undo-delete case), pass an action callback instead: `toast('Task deleted', { action: 'Undo', onClick: undoDelete })` and build the link internally.

---

### 13. `manifest-givelink.json` cached in service worker — product is now Arete

**What:** `sw.js:4` lists `./manifest-givelink.json` in the STATIC cache array. The product was rebranded from Givelink to Arete in commit `0c1d32d`. The file still exists but the cache entry is dead weight and misleads future maintainers.

**Where:** `sw.js:4`, `manifest-givelink.json` (file still in repo)

**Why it matters:** Dead assets in the service worker cache slow installs, waste storage quota on user devices, and create confusion about which manifest is authoritative. `manifest.json` (the Arete one) is already listed.

**Effort:** S

**Suggested fix:**
- Remove `./manifest-givelink.json` from the STATIC array in `sw.js`.
- Consider deleting `manifest-givelink.json` from the repo (keep only `manifest.json`) unless the Givelink PWA path at `/givelink` still needs it.
- Bump the cache version string to force reinstall.

---

### 14. `_frEnter` calls `refresh()` twice — redundant nav side-effect

**What:** `_frEnter()` at lines 10587-10588 calls `nav('dashboard')` (which internally calls `renderDash()`) and then immediately calls `refresh()` again. `refresh()` re-renders the current active view, so the dashboard is rendered twice on every first-run completion.

**Where:** `index.html:10587-10588`

**Why it matters:** Double-rendering the dashboard on first-run is a minor performance hit but can cause flicker, and the pattern suggests inconsistency in how view navigation is handled across the codebase.

**Effort:** S

**Suggested fix:**
- Remove the duplicate `try{refresh();}catch(e){}` at line 10588 — `nav('dashboard')` already calls `renderView('dashboard')` internally.

---

## 💡 P3 — Nice to have

---

### 15. PostHog key is empty — product analytics not firing

**What:** `APP_CONFIG.posthogKey = ''` at `index.html:9960`. The PostHog snippet is initialized but `posthog.init()` is skipped when the key is blank, so no events (`firstrun_organized`, `auth_google_start`, `landing_view`, etc.) are tracked in production.

**Where:** `index.html:9960`, `index.html:10390-10392`

**Why it matters:** Without analytics, there's no data on funnel conversion, feature usage, or error frequency. PostHog events like `firstrun_organized` and `guest_to_signup` are wired up and ready — they're just firing into the void.

**Effort:** S

**Suggested fix:**
- Create a PostHog project (free tier covers this scale).
- Set `posthogKey: 'phc_xxxxxxxx'` in `APP_CONFIG` with the project API key.
- Consider also enabling `capture_pageview: true` to track landing → app flow automatically.

---

### 16. Calendar view state (`_calMonth`, `_calSel`) resets on every navigation

**What:** `_calMonth` and `_calSel` are module-level variables (lines 3473-3474) that reset when the user navigates away from the All Tasks view and back. The user's calendar position is lost every time they open a task.

**Where:** `index.html:3473-3474`

**Why it matters:** A user browsing tasks in calendar view, opening one to edit it, then going back lands on the current month instead of where they were. Disorienting in a workflow that involves rapid task review.

**Effort:** S

**Suggested fix:**
- Persist `_calMonth` to `sessionStorage` in `_calShift()` (line 3473) and restore it in `renderAll()`.
- Or store it on the `S` (state) object — already serialized to localStorage.

---

### 17. Inline hardcoded hex colors in dynamic styles bypass the theme system

**What:** Dozens of inline `style=` attributes across views use literal hex values like `#ff6b6b`, `#69db7c`, `#fbbf24` instead of CSS custom properties. These values are correct in dark mode but would need different values in light mode.

**Where:** `index.html:5232, 5334, 5582, 5594, 5876, 5924, 5951, 5991` (representative sample)

**Why it matters:** If a new theme is added, or if any of the semantic color values change, all these inline styles need to be hunted down manually. They also bypass the `body.light` theme override system.

**Effort:** M

**Suggested fix:**
- Map the recurring inline colors to CSS vars: `#ff6b6b` → `var(--q1)`, `#69db7c` → `var(--bb)`, `#fbbf24` → `var(--bm)`.
- Add a `color-scheme-aware` CSS class for conditional coloring rather than JS-side logic.

---

### 18. Missing ARIA roles on most interactive elements

**What:** Sidebar navigation items (`.ni`, `.ns`), the FAB button, bottom nav items (`.bni`), and most dialog close buttons lack `role`, `aria-label`, or `aria-current` attributes. Screen reader users cannot navigate the app.

**Where:** `index.html:73` (`.ns` section headers), `index.html:78` (`.ni` nav items), `index.html:256` (`.fab`), `index.html:353` (`.bni` bottom nav)

**Why it matters:** WCAG 2.1 AA compliance is increasingly a legal and commercial requirement, especially for enterprise or EU markets. Keyboard-only and screen reader users get no useful information from the navigation.

**Effort:** M

**Suggested fix:**
- Add `role="navigation"` and `aria-label="Main navigation"` to the sidebar.
- Add `aria-current="page"` to the active `.ni` item in `nav()`.
- Add `aria-label` to `.fab` (`"Add task"`), the hamburger button, and all icon-only buttons.
- Add `role="status"` to the sync pill (already present on `#toast-stack` — extend the pattern).
