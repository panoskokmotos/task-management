# Givelink / Arete Improvement Plan

_Generated 2026-09-18 by automated codebase scan._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Service worker update banner never fires in main app

**What:** `index.html` listens for `nw.state==='activated'` to show the update banner, but `activated` fires *after* `skipWaiting()` + `clients.claim()`, so the page the user is reading has already been replaced and the banner is shown in a dead context.

**Where:** `index.html:10697`

**Why it matters:** Users running a stale cached build will never see the "Update available" banner, meaning they silently run old code indefinitely. This was explicitly fixed in `givelink.html` (commit 72e03fe) but the same fix was not ported to the main app.

**Effort:** S

**Suggested fix:**
- Change `if(nw.state==='activated')` → `if(nw.state==='installed'&&navigator.serviceWorker.controller)` to match the givelink fix.
- `installed` fires while the old SW is still serving the current page, which is exactly when you want to prompt.

---

### 2. AI proxy is unconfigured — all AI features require a personal API key

**What:** `APP_CONFIG.aiProxy` is an empty string in production code, so every AI call falls through to the direct Anthropic path, which requires users to paste their own API key. The server-side proxy in `api/claude.js` exists but is never wired up.

**Where:** `index.html:9959` (`aiProxy: ''`), `api/claude.js`

**Why it matters:** New users who hit any AI feature (Plan my day, AI triage, etc.) immediately get a "Add Claude API key" toast with no clear next step. This is a hard drop-off point for activation.

**Effort:** S

**Suggested fix:**
- Set `aiProxy: '/api/claude'` (relative URL works on Vercel).
- The proxy already validates Supabase JWT when `SUPABASE_URL` env var is set, so only authenticated users can call it.
- Add `ANTHROPIC_API_KEY` to Vercel environment variables.

---

### 3. No per-user rate limiting on the AI proxy

**What:** `api/claude.js` has no rate limiting. A comment on line 12 explicitly calls this out: "For production add per-user rate limiting". A single signed-in account can run unlimited AI calls and exhaust the Anthropic bill.

**Where:** `api/claude.js:12-48`

**Why it matters:** If the proxy is ever enabled (P0 item above), this becomes an immediate financial risk — especially with no cap on `max_tokens` beyond the 2000 hard ceiling.

**Effort:** M

**Suggested fix:**
- Add Upstash Redis rate limiting: 20 AI calls/user/day is generous for free tier.
- Alternatively, use Vercel KV (built-in) with a sliding window: `if (count > 20) return 429`.
- Minimum: add an IP-based rate limit until per-user is wired.

---

### 4. `givelink.html` AI calls expose Anthropic API key in browser

**What:** `callClaudeGL()` (and `runAiSprintPlanner()`) call `https://api.anthropic.com/v1/messages` directly from the browser using a key stored in `localStorage`. The key is visible to any script on the page.

**Where:** `givelink.html:1200-1213`, `givelink.html:1333`

**Why it matters:** Any XSS or malicious browser extension can exfiltrate the key. Anthropic keys have no domain restriction.

**Effort:** M

**Suggested fix:**
- Route `givelink.html` AI calls through the same `/api/claude` proxy as the main app.
- Use the Supabase token already available via `localStorage.getItem('taskos_sb_refresh')` for auth.
- `runAiSprintPlanner` can switch to Haiku (currently uses `claude-opus-4-5` at ~15× the cost of Haiku).

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. "Sync to Task OS" silently no-ops for most users

**What:** `syncToTaskOS()` reads from `localStorage.getItem('taskos_profiles')` — a key only written by Task OS multi-profile setups. For all single-profile users (the vast majority), `profiles` is empty, so the function shows "No Task OS profile found" toast.

**Where:** `givelink.html:1275-1319`

**Why it matters:** The Sync button in the sprint header is prominently placed and visually implies it works. Silent failure makes users doubt data integrity.

**Effort:** S

**Suggested fix:**
- Fall back to reading `localStorage.getItem('taskos')` directly when `taskos_profiles` is empty (single-profile path).
- Or: hide the button entirely when no Task OS data exists, with a tooltip explaining the prerequisite.

---

### 6. Week view 7-column grid is unreadable on mobile

**What:** `renderWeekPlan()` in `givelink.html` renders a `grid-template-columns:repeat(7,1fr)` grid. The mobile resize check (`if(window.innerWidth<600)`) runs once at render time and is not responsive to orientation changes or window resize.

**Where:** `givelink.html:672-686`

**Why it matters:** On any phone the 7-column grid is ~40px per column — task titles overflow or are invisible. This is a new view added in the last commit (72e03fe) and is currently broken on mobile.

**Effort:** S

**Suggested fix:**
- Replace the JS `window.innerWidth` check with a CSS media query on the inline style: `grid-template-columns: repeat(7, minmax(120px, 1fr))` with `overflow-x: auto` on the container, so it becomes a horizontal scroll on narrow screens.
- Or: collapse to a vertical list (one day per row) at `<600px`.

---

### 7. Task drawer/modal has no ARIA role on task card list items

**What:** Task cards (`.tc` elements) are plain `div` elements with `onclick` handlers. They have no `role="button"`, `tabindex`, or keyboard activation (`Enter`/`Space`). The same applies to `.tc2` in `givelink.html`.

**Where:** `index.html` throughout task list renders (e.g. line ~3714), `givelink.html:726-738`

**Why it matters:** Keyboard-only users and screen reader users cannot access individual tasks, which is the core interaction of the app. WCAG 2.1 Level A failure.

**Effort:** M

**Suggested fix:**
- Add `role="button" tabindex="0"` to task card divs.
- Add `onkeydown="if(e.key==='Enter'||e.key===' ')openTask(id)"` or delegate via a single keydown listener on the task list container.
- Checkbox (`.ck`) already has click; also add keyboard handler to toggle with `Space`.

---

### 8. PostHog analytics key is not configured — conversion funnel is invisible

**What:** `APP_CONFIG.posthogKey` is an empty string. `track()` calls are wired everywhere (view opens, task created, auth events, onboarding steps, share events), but none of them fire because `posthog.init` is never called.

**Where:** `index.html:9960`, `index.html:10390`

**Why it matters:** You cannot see where users drop off (first-run → triage → plan-day funnel) or which features drive retention. The tracking code exists and is well-instrumented — it just needs a key.

**Effort:** S

**Suggested fix:**
- Create a PostHog project and add the key: `posthogKey: 'phc_...'`.
- Enable session replay on the free tier for the first 5k sessions/month to see real user flows through checkout/onboarding.

---

### 9. Landing page always redirects returning users, bypassing the pitch for referral visits

**What:** The front-door router in `landing.html` checks for `taskos_sb_refresh` OR `taskos_guest=1` and immediately bounces to `index.html`. This means a signed-in user who clicks a referral link (e.g. shared to a friend using the same browser) is sent to their own app, not the landing.

**Where:** `landing.html:30-39`

**Why it matters:** Referral links are a core PLG mechanic (commit 32e7288). When the referred user is a returning user in a different context (or the same browser), the landing pitch is never seen and the conversion intent is lost.

**Effort:** S

**Suggested fix:**
- Add a `?ref=` param check: if `location.search.includes('ref=')`, show the landing regardless of auth state.
- Let referral context override the redirect logic.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `index.html` is 14,926 lines — a single-file monolith

**What:** The entire app (CSS, HTML, and ~12,000 lines of JS) lives in one file. There is no module system, no build step, and no way to tree-shake or code-split.

**Where:** `index.html` (entire file)

**Why it matters:** Each new feature grows this file, making it increasingly hard to navigate, debug, and maintain. Initial parse time for the JS is significant on low-end mobile (all 14k lines parse synchronously).

**Effort:** L

**Suggested fix:**
- Short-term: extract the ~700 lines of CSS into `app.css` and the main JS into `app.js`. Vercel serves them with proper caching headers.
- Medium-term: adopt a lightweight bundler (Vite + vanilla JS, no framework needed) with code splitting per view.
- Don't do this until a test harness exists — splitting without tests risks regressions.

---

### 11. Duplicate CSS class namespace between `index.html` and `givelink.html`

**What:** Both files define `.badge`, `.ns`, `.ni`, `.fc`, `.btn`, `.bp`, `.bg`, `.bd`, `.sm`, `.fab`, `.tc`, `.modal`, `.mo`, `.md`, `.mh` etc. independently. They have diverged (e.g. `.btn` padding and `.bp` color are different).

**Where:** `index.html:182-187`, `givelink.html:109-113`

**Why it matters:** Any future shared component (a task card, a button) requires two separate edits to stay in sync. Already diverged in several places.

**Effort:** M

**Suggested fix:**
- Extract a `shared.css` with design tokens and base components.
- Both pages `<link>` to it and override only what differs.

---

### 12. `sbSyncNow` uses last-writer-wins with no conflict resolution

**What:** `sbSyncNow` compares `remote.ms` to `S._updatedAt`. If remote is newer it overwrites the entire local state. If local is newer it pushes. There is no merge — a brief connectivity gap where edits happen on two devices simultaneously will silently lose one side.

**Where:** `index.html:10412-10455`

**Why it matters:** For a productivity app where users add tasks offline then sync, data loss on reconnect would be catastrophic for trust.

**Effort:** M

**Suggested fix:**
- At minimum, deep-merge tasks arrays by `id` (union, with `completedAt` taking precedence over `status`).
- A full CRDT is overkill; a per-task `updatedAt` timestamp with union merge handles 95% of real conflicts.

---

### 13. Seed data in `givelink.html` contains personal notes and real org names

**What:** The `seed()` function in `givelink.html` (line ~952) embeds real nonprofit names, internal status notes ("Meeting with immigration specialist completed — next steps cleared"), real assignee names ("Panos, Fanos"), and target metrics.

**Where:** `givelink.html:952-990` (seed function tasks array)

**Why it matters:** This data is visible to anyone who loads `givelink.html` for the first time. It also leaks strategic priorities publicly if the repo or deployed URL is discovered.

**Effort:** S

**Suggested fix:**
- Replace real org names and personal notes with generic placeholders ("Partner Org A", "Follow up with potential partner").
- Move the seeded sprint data to a private `givelink-seed.json` loaded only in development.

---

### 14. Service worker push notification icon path is wrong

**What:** `sw.js` push handler references `./icons/icon-192.png` (line 44) but the actual asset is at `./icon-192.png` (no `icons/` directory exists).

**Where:** `sw.js:44-45`

**Why it matters:** Push notifications will display with no icon (broken image fallback). Not critical until push notifications are actively sent, but the code path is wired up.

**Effort:** S

**Suggested fix:**
- Change `./icons/icon-192.png` → `./icon-192.png` in both `icon` and `badge` fields of the push notification payload.

---

## 💡 P3 — Nice to have

### 15. Landing page has no dark-mode support

**What:** `landing.html` hardcodes `--bg:#f7f6f3` (cream white) with no `@media (prefers-color-scheme: dark)` override. Users who prefer dark mode get a jarring bright landing page before being redirected to the dark app.

**Where:** `landing.html:45-65`

**Effort:** S

**Suggested fix:** Add a dark mode CSS block matching the app's `--bg:#0a0a0f` palette under `@media (prefers-color-scheme: dark)`.

---

### 16. `givelink.html` uses blue accent (#3b82f6) while main app uses purple (#5a49e0) — intentional but undocumented

**What:** Givelink Sprint Board has its own color system (`--accent:#3b82f6`, `--pr:#f472b6`) completely separate from the Arete brand palette. The pink `--pr` is used for the Product pillar dot on a dark background — this is the only potential violation of the no-pink-on-purple rule, but since the background here is `--bg:#070d1a` (dark navy, not purple) it technically passes contrast.

**Where:** `givelink.html:15-20`

**Effort:** S (documentation only)

**Suggested fix:** Add a comment block at the top of `givelink.html` documenting that this is an intentionally separate brand/design for the internal sprint board, not subject to Arete brand guidelines.

---

### 17. `callClaudeGL` in `givelink.html` silently returns `null` on non-OK HTTP responses

**What:** `callClaudeGL()` (line 1338) calls `res.json()` regardless of `res.ok`. On a 401/429/500 the JSON body is an error object, not a Claude response, but the function returns `data.content?.[0]?.text||null` which will be `null` with no user-facing error toast (unlike `callClaude` in index.html which checks `res.ok` and shows a toast).

**Where:** `givelink.html:1332-1341`

**Effort:** S

**Suggested fix:**
- After `const data=await res.json()`, add `if(!res.ok){toast('AI error '+res.status+': '+(data?.error?.message||res.statusText));return null;}`.

---

### 18. No `.env.example` for contributors

**What:** The server-side proxy (`api/claude.js`) requires `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` env vars, but there is no `.env.example` or contributor documentation explaining what to set.

**Where:** `api/claude.js:6-8`, repo root

**Effort:** S

**Suggested fix:** Add `.env.example` with placeholder values and a one-line comment per variable.

---

### 19. `givelink.html` `callClaudeGL` prompts user for API key via `window.prompt()`

**What:** When no API key is found, `callClaudeGL` calls `window.prompt('Enter Anthropic API key:')`. This is a jarring browser-native dialog mid-flow, stores the key in `localStorage` under `taskos_api_key` without any warning, and bypasses the normal Settings UI.

**Where:** `givelink.html:1330`

**Effort:** S

**Suggested fix:** Replace the `window.prompt` with a redirect to the settings modal, or show a styled inline prompt using the existing modal system.

---

### 20. `og:url` and `canonical` point to the `vercel.app` subdomain, not a custom domain

**What:** `index.html:24` and `landing.html` use `https://task-management-beige-eight.vercel.app/` as the canonical URL. If a custom domain is ever added, this will cause duplicate content SEO issues without a code change.

**Where:** `index.html:24-25`, `landing.html:11`

**Effort:** S

**Suggested fix:** Move the canonical URL to a single constant or use relative canonical tags. Set up a Vercel redirect from the `.vercel.app` subdomain to the custom domain once one is added.
