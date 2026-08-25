# Arete — Improvement Plan
_Generated 2026-08-25 · 15 items across 4 tiers_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Hardcoded "Panos" in AI prompts — breaks for every other user
- **What**: Dozens of AI prompts hardcode the name "Panos", his biography, and "Givelink fundraising SaaS" context; other users get AI responses about someone else's life.
- **Where**: `index.html` lines 5647, 5920, 7319, 7477, 7849, 8604, 9807, 11415, 11516, 11672, 11734; default name at line 2519 (`||'Panos'`)
- **Why it matters**: Any user who signs up gets AI telling them about Panos's San Francisco move and Givelink SaaS — instantly destroys trust and makes the core AI value-prop useless for them.
- **Effort**: M
- **Suggested fix**:
  - Replace all hardcoded `Panos` with `profileName` (variable already exists at line 2519) or `getAboutMe()`
  - Change line 2519 default from `'Panos'` to `''` (fall through to neutral copy)
  - Move Givelink-specific AI prompts to a personal-config block, not shared code

### 2. `APP_CONFIG.aiProxy` is empty — AI features silently fail for users without a personal API key
- **What**: The proxy URL is intentionally blank (`aiProxy: ''`), so AI falls back to direct Anthropic calls that require users to add their own key in Settings.
- **Where**: `index.html` line 9959; `api/claude.js` is deployed but the URL is never wired up.
- **Why it matters**: First-time users hit "Add Claude API key in Settings" on every AI tap — the app's headline value prop (AI planning) is dead on arrival.
- **Effort**: S
- **Suggested fix**:
  - Deploy `/api/claude.js` to Vercel, paste the resulting URL into `aiProxy`
  - Add Upstash rate limiting (see item 3) before going live
  - Optionally remove the per-user key fallback once the proxy covers all traffic

### 3. No rate limiting on `/api/claude.js` — one user can drain the Anthropic bill
- **What**: The proxy has no per-user request cap; any signed-in account can call every AI workflow in a tight loop.
- **Where**: `api/claude.js` line 13 (the comment literally warns "For production add per-user rate limiting")
- **Why it matters**: A single power user (or automated test) can generate uncapped API costs with no circuit breaker.
- **Effort**: S
- **Suggested fix**:
  - Add Upstash Redis rate limiter: 15 req/user/minute, return 429 with `Retry-After`
  - `callClaude` already handles 429 gracefully (line 5028) — it just needs the signal

### 4. Morning reminder hardcodes "Panos" in push notification text
- **What**: The default reminder template at line 11254 sends "Good morning Panos!" to every user who enables notifications.
- **Where**: `index.html` line 11254
- **Why it matters**: Every notification-enabled user gets a push referencing someone else by name — immediate credibility loss at the most visible touchpoint.
- **Effort**: S
- **Suggested fix**:
  - Change to `` `Good morning${profileName ? ' ' + profileName : ''}!` ``
  - Apply same pattern to any other reminder messages with hardcoded names

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Seed data contains personal tasks that new users see on first open
- **What**: Default task seed includes "Unsubscribe from things I don't want (Superhuman for panagiotis email?)" and a Givelink-specific metric task.
- **Where**: `index.html` lines 4629, 4653
- **Why it matters**: New users' first view shows someone else's personal to-dos — destroys the "this is my space" first-impression moment.
- **Effort**: S
- **Suggested fix**:
  - Replace with 4–5 relatable generic starter tasks ("Finish the Q3 deck", "Book dentist", "Plan next week")
  - Remove all `panagiotis`, `Givelink`, and personal email references from seed data

### 6. Expired Supabase token silently drops AI auth — no re-login prompt
- **What**: `_sbToken()` is called with `.catch(()=>'')` in `callClaude`; when the refresh token expires the proxy gets an empty Bearer, returns 401, and the user sees only "Please sign in again" toast — no gate.
- **Where**: `index.html` line 5013; `callClaude` error handler line 5028
- **Why it matters**: Users with stale sessions lose all AI features until they figure out they need to log out and back in — there's no prompt.
- **Effort**: S
- **Suggested fix**:
  - On 401 from the proxy specifically, call `_showAuthGate()` instead of a plain toast
  - Or detect token expiry (`_SB.exp < Date.now()`) before the request and gate proactively

### 7. Service worker caches a removed file (`manifest-givelink.json`) and has wrong icon path
- **What**: Two bugs in `sw.js`: (a) still caches `manifest-givelink.json` even though Givelink was split off (commit d635d06); (b) push notification `icon` path is `./icons/icon-192.png` but the file lives at `./icon-192.png`.
- **Where**: `sw.js` lines 3 and 47–48
- **Why it matters**: (a) Generates a 404 on SW install for every visitor; (b) all push notifications show a broken icon.
- **Effort**: S
- **Suggested fix**:
  - Remove `'./manifest-givelink.json'` from the `STATIC` array
  - Change `./icons/icon-192.png` → `./icon-192.png` in both `icon` and `badge` fields

### 8. `og:url`, `canonical`, and social images all point to the Vercel preview URL
- **What**: All SEO/OG metadata references `task-management-beige-eight.vercel.app` instead of a custom domain.
- **Where**: `index.html` lines 24–33; `landing.html` lines 11–21
- **Why it matters**: Social shares display the dev URL; SEO canonical will be wrong once you move domains; link previews look unprofessional.
- **Effort**: S
- **Suggested fix**:
  - Register a custom domain (e.g. `arete.so` or similar)
  - Do a single find-replace across both files before pointing DNS

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. 14,924-line monolithic `index.html` — no modules, no tests, increasing parse time
- **What**: The entire app (CSS, HTML, JS) is a single file with no module system, no bundler, and zero automated tests.
- **Where**: `index.html` (entire file)
- **Why it matters**: Feature velocity is slowing — adding anything means searching 15k lines. Merge conflicts are brutal. The browser JS parse time grows with every commit.
- **Effort**: L
- **Suggested fix**:
  - Extract CSS to `style.css` and JS to `app.js` as a first pass — no bundler needed
  - Pull the state layer (`S`, `save`, `load`) into a separate file so it can be unit-tested
  - Don't do it all at once — extract incrementally per feature

### 10. Direct browser-to-Anthropic API calls expose user API keys to network inspection
- **What**: When `aiProxy` is empty, user-entered API keys are sent in browser XHR headers with `anthropic-dangerous-direct-browser-access`.
- **Where**: `index.html` lines 5020–5024
- **Why it matters**: Any browser extension or MITM proxy can capture the API key; Claude keys have no spend scoping — a leaked key charges indefinitely.
- **Effort**: S
- **Suggested fix**:
  - Once the proxy is live (item 2), remove the direct-browser fallback entirely
  - If direct keys must stay for self-hosters, add a Settings warning: "Your key is stored locally and sent from your browser"

### 11. `callClaude` null returns not consistently checked — silent failures in several AI flows
- **What**: Several callers receive null from `callClaude` (on rate limit, network error, etc.) but don't guard against it before rendering.
- **Where**: `index.html` lines 5502, 6053, 6079, 7160, 7491 — missing `if(!result)return` pattern
- **Why it matters**: On failure these features do nothing — the user sees a spinner that never resolves or stale content, with no indication of what went wrong.
- **Effort**: S
- **Suggested fix**:
  - Add consistent `if(!text)return;` after every `await callClaude(...)` (pattern from line 5204 is correct — replicate it)
  - Consider a thin `safeCallClaude` wrapper that always shows a fallback toast on null

### 12. Hardcoded color hex values in inline styles break light/dark theme
- **What**: Dozens of inline styles use raw hex (`color:#69db7c`, `color:#74c0fc`, `color:#fbbf24`) instead of CSS variables.
- **Where**: `index.html` lines 5221–5223 and many other inline `style=` blocks throughout
- **Why it matters**: These colors are fixed regardless of theme — they're unreadable or off-brand in light mode and miss the design system entirely.
- **Effort**: M
- **Suggested fix**:
  - Replace `#69db7c` → `var(--bb)`, `#74c0fc` → `var(--bs)`, `#fbbf24` → `var(--bm)`
  - Run `grep -n 'color:#[0-9a-f]\{6\}' index.html` to find all remaining instances

---

## 💡 P3 — Nice to have

### 13. Schema.org author on landing page is a personal name, not the product
- **What**: The structured data block credits `"author": {"@type": "Person", "name": "Panos"}` as the app's author.
- **Where**: `landing.html` line 25
- **Why it matters**: Minor SEO polish — rich results will surface the founder's name, not the brand.
- **Effort**: S
- **Suggested fix**: Change to `"author": {"@type": "Organization", "name": "Arete"}`

### 14. Empty state missing for Relationships view when no contacts exist
- **What**: The people/relationships section renders a blank panel when `S.people` is empty, with no CTA.
- **Where**: `index.html` — `renderRelationships` function
- **Why it matters**: New users land on a blank screen with no direction — a common activation drop-off point.
- **Effort**: S
- **Suggested fix**: Add an empty state: "Track the people who matter — add your first contact to get nudges before connections go cold" with an Add button

### 15. `givelink.html` is still in the repo and cached by the SW after product separation
- **What**: `givelink.html` is still present and cached, but Givelink was removed from Task OS in commit d635d06.
- **Where**: `givelink.html`; `sw.js` line 16
- **Why it matters**: The file is dead weight, adds confusion about what the product is, and inflates SW cache size.
- **Effort**: S
- **Suggested fix**: Either redirect it to the live Givelink product URL, or delete it and remove from `sw.js` HTML list
