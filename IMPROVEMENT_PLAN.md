# Arete — Improvement Plan (2026-07-18)

Scanned: `index.html` (14,924 lines), `landing.html`, `sw.js`, `api/claude.js`. All 20 items are
concrete, file-specific, and ordered by user/business impact within each tier.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Hardcoded "Panos" as default name — every new user is greeted as someone else
- **What**: `profileName` falls back to `'Panos'`, and the static HTML pre-renders "Good morning, Panos 👋" before JS loads.
- **Where**: `index.html:2519` (`let profileName=…||'Panos'`), `index.html:1070` (`<h1 id="greeting">Good morning, Panos 👋</h1>`)
- **Why it matters**: Every user who hasn't explicitly set their name sees "Good morning, Panos" on the most-visited screen. Destroys the "this app is mine" first impression.
- **Effort**: S
- **Suggested fix**:
  - Change the fallback at line 2519 to `'there'` or `''` so the greeting reads "Good morning 👋".
  - Change the static HTML at line 1070 to omit the name until JS resolves it (or render it blank).
  - Also change the settings placeholder at line 2014 from `placeholder="e.g. Panos"` to a generic example.

---

### 2. AI prompts still hardcoded to "Panos" / "Givelink" — AI outputs are wrong for every other user
- **What**: Commit #73 was supposed to genericise AI prompts, but 7 functions still embed hardcoded personal context.
- **Where**:
  - `index.html:5445` — `aiSuggestAutomations`: "Focus on personal productivity, Givelink B2B SaaS for nonprofits…"
  - `index.html:5647` — `aiRelNudge`: "Who should **Panos** reach out to this week? Consider his **Givelink** fundraising platform…"
  - `index.html:5920` — `aiDiscomfortInsight`: "give **Panos**… the resilience he needs for the **SF move** and **Givelink** growth"
  - `index.html:7155` — `aiWheelInsight`: "tie actions to **Givelink** traction or financial freedom where relevant"
  - `index.html:7319` — `aiSocialAudit`: "Audit **Panos**'s brand presence (**Panos** is a Greek founder in his 20s building **Givelink**…)"
  - `index.html:7477` & `7582` — `aiExtractTasksFromNotes` / `aiDailyPicks`: "Prioritize tasks that drive **Givelink** revenue"
  - `index.html:7849` — `_renderAIBriefing` fallback: "Panos — Greek founder in his 20s building Givelink"
- **Why it matters**: Every AI feature gives outputs tailored to a specific person's startup. Users receive coaching about moving to San Francisco and growing a nonprofit SaaS they've never heard of.
- **Effort**: M
- **Suggested fix**:
  - Replace every hardcoded `Panos` / `Givelink` string with `${profileName}` / `${getAboutMe()||'a focused individual'}`.
  - The `getAboutMe()` helper already exists and returns the user's self-described context — use it everywhere.
  - The corrected fallback text in `_renderAIBriefing` should match the neutral copy already in `_wfAbout()` (line 5454).

---

### 3. `aiProxy` URL left empty — AI features are broken for all hosted/signed-in users
- **What**: `APP_CONFIG.aiProxy` is `''` (line 9959). The server-side proxy that would let users access AI without their own API key exists at `api/claude.js` but is never wired up.
- **Where**: `index.html:9959` (`aiProxy : ''`)
- **Why it matters**: AI is prominently marketed (daily picks, auto-triage, plan my day). Signed-in users who skip the API key step — the majority of new signups — get no AI features at all. All the PLG work this week relies on AI being available.
- **Effort**: S
- **Suggested fix**:
  - Set `aiProxy: 'https://<your-vercel-app>.vercel.app/api/claude'` in APP_CONFIG.
  - Confirm `ANTHROPIC_API_KEY` is set in Vercel environment variables.
  - The proxy already validates Supabase sessions, so only signed-in users can call it.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. OG / Twitter meta tags point to old Vercel project URL — social shares look broken
- **What**: All social preview metadata is hardcoded to `task-management-beige-eight.vercel.app`.
- **Where**: `index.html:24-32`, `landing.html:11-21` (og:url, og:image, twitter:image, canonical)
- **Why it matters**: Every link shared on X/LinkedIn/Slack shows the wrong domain. The canonical tag signals the wrong URL to search engines. Both files affected — meaning every entry point to the app has this problem.
- **Effort**: S
- **Suggested fix**:
  - Replace all 7 hardcoded URL occurrences with the real production domain (e.g. `https://arete.app` or whatever the live domain is).
  - Set `og:image` to an absolute path off the real domain.

---

### 5. `_APP_URL` and canvas share image embed old domain — referral links and share cards are wrong
- **What**: The referral URL generator (`_refUrl()`) and the canvas-drawn progress share card use `task-management-beige-eight.vercel.app`.
- **Where**: `index.html:10180` (`const _APP_URL='https://task-management-beige-eight.vercel.app/'`), `index.html:10232` (canvas `fillText`)
- **Why it matters**: Every "Invite a friend" share and every generated progress card promotes the wrong URL. The PLG features shipped this week (referrals, share-the-win) are the primary acquisition channel — they're distributing a dead-end link.
- **Effort**: S
- **Suggested fix**:
  - Update `_APP_URL` at line 10180 to the real production URL.
  - Update the canvas `fillText` at line 10232 to use `_APP_URL` (strip the protocol) rather than a hardcoded string.
  - Same fix applies at line 10279 where template share links use `_APP_URL`.

---

### 6. Push notification icon path broken — in-app and push notifications show no icon
- **What**: Both the service worker and inline `Notification` constructor reference `./icons/icon-192.png`, but the file lives at `./icon-192.png` (no `icons/` subdirectory).
- **Where**: `sw.js:46-47` (push notification icon/badge), `index.html:11289` (in-app reminder notification)
- **Why it matters**: Every notification arrives with a blank icon on iOS/Android, which reduces trust and dismissal rates. On some platforms a missing icon makes the notification look like spam.
- **Effort**: S
- **Suggested fix**:
  - Change `./icons/icon-192.png` → `./icon-192.png` in `sw.js` lines 46 and 47.
  - Change `./icons/icon-192.png` → `./icon-192.png` at `index.html:11289`.

---

### 7. `givelink.html` still cached by the service worker under `HTML` list
- **What**: `sw.js` caches `./givelink.html` as an HTML page (line 17). While the file exists, it is a separate-product workspace that should never be part of the Arete app's offline cache.
- **Where**: `sw.js:17`
- **Why it matters**: The SW bundles and serves a product that was explicitly separated this week. If `givelink.html` is ever deleted or moved, the next SW install will fail non-atomically (one failed `c.add()`) and silently leave clients with a partial cache.
- **Effort**: S
- **Suggested fix**:
  - Remove `'./givelink.html'` from the `HTML` array in `sw.js`.
  - Remove `'./manifest-givelink.json'` from the `STATIC` array (line 4) for the same reason.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 8. Givelink OS view still registered in the router — navigable dead route
- **What**: `renderView` at line 2984 maps `'givelink-dash'` to `renderGivelinkDash`, which renders a full personal business metrics dashboard (Givelink KPIs, nonprofit count, ARR, pipeline).
- **Where**: `index.html:2984`, `index.html:8618-8748`
- **Why it matters**: Any user who crafts a URL with `#givelink-dash` (e.g. from a cached bookmark or referral) gets a personal founder dashboard with the creator's business metrics. Not a security issue (data is local) but a confusing and broken surface.
- **Effort**: M
- **Suggested fix**:
  - Remove `'givelink-dash': renderGivelinkDash` from the router.
  - Redirect any attempt to navigate to that view to `'dashboard'`.
  - The `renderGivelinkDash` function and `openGivelinkMetrics` modal can be removed in a follow-up (they are substantial — ~130 lines).

---

### 9. Tweet generator exposes "Givelink startup" as an angle option for all users
- **What**: The tweet generator modal has a hardcoded `angles` object containing `givelink: 'startup progress building B2B SaaS for nonprofits'` as a selectable angle.
- **Where**: `index.html:6077`
- **Why it matters**: Any user who opens the tweet generator sees "Givelink" as an option in the angle dropdown. When selected, the AI prompt frames their tweet as if they run a nonprofit SaaS.
- **Effort**: S
- **Suggested fix**:
  - Remove the `givelink` key from the `angles` object.
  - The remaining angles (`founder`, `growth`, `health`) are appropriately generic.

---

### 10. Inline hardcoded hex colors in JS-generated HTML — breaks dark/light theming
- **What**: Multiple places in JS-rendered HTML use hardcoded hex values instead of CSS variables, so they don't adapt when the user switches themes.
- **Where**: `index.html:5672` (`color:#58a6ff`), `index.html:5673` (`color:#22d3ee`); `CAT_COLORS` at line 6375 (`givelink:'#a78bfa'`, `health:'#69db7c'`, etc.); several inline `style="color:#..."` strings across render functions.
- **Why it matters**: In light mode these colors are often unreadable (dark blue on white). The design system invested in CSS variables specifically to prevent this — the rendered charts and stats cards are visually broken in light mode.
- **Effort**: M
- **Suggested fix**:
  - Map `CAT_COLORS` to CSS variables defined in `:root` so they respect the current theme.
  - Replace `style="color:#58a6ff"` with `style="color:var(--bs)"` (or the relevant semantic variable).
  - Add a lint rule or comment noting that JS-rendered markup must not use raw hex.

---

### 11. Weekly challenge pool contains a Givelink-specific challenge
- **What**: The predefined challenge at line 6361 reads "Learn one new skill or concept relevant to Givelink" — surfaced to all users in the daily challenge generator.
- **Where**: `index.html:6361`
- **Why it matters**: New users have a 1-in-N chance of being challenged to learn something for a company they don't work for. Small but jarring.
- **Effort**: S
- **Suggested fix**:
  - Replace with a generic equivalent: "Learn one new skill or concept directly relevant to your top goal this week."

---

### 12. Wheel of Life AI coaching hardcodes Givelink context in the prompt
- **What**: `aiWheelInsight` injects "tie actions to Givelink traction or financial freedom where relevant" into every Wheel of Life coaching output.
- **Where**: `index.html:7155`
- **Why it matters**: The Wheel of Life is a self-reflection tool for all users. The AI coaching response will always steer toward "Givelink traction" regardless of the user's actual goals.
- **Effort**: S
- **Suggested fix**:
  - Replace the hardcoded phrase with a dynamic reference: use the user's top-3 goals (already available as `S.goals.filter(g=>g.isTop3).map(g=>g.title)`) so the coaching aligns with the user's real North Stars.

---

## 💡 P3 — Nice to have

### 13. `givelinkMetrics` state object and Life OS KPI cards remain for all users
- **What**: The global state object `S` carries `givelinkMetrics` (nonprofit count, ARR, MRR, pipeline, impact model) and the Life OS tab renders four Givelink KPI stat cards.
- **Where**: `index.html:2517` (state), `index.html:8631-8648` (KPI cards in Life OS)
- **Why it matters**: Every user's localStorage snapshot carries this schema. The Life OS tab shows four empty Givelink KPI widgets to non-Givelink users. It wastes space and looks like a broken feature.
- **Effort**: L
- **Suggested fix**:
  - Extract the Givelink KPI cards into an opt-in "startup metrics" widget behind a toggle.
  - Remove `givelinkMetrics` and `givelinkHistory` from the default state (requires a migration for existing localStorage).

---

### 14. Social brand audit AI prompt hardcodes the creator's full personal profile
- **What**: `aiSocialAudit` contains a detailed personal backstory in the prompt fallback.
- **Where**: `index.html:7319` ("Audit Panos's brand presence (Panos is a Greek founder in his 20s building Givelink…)")
- **Why it matters**: This function is accessible from the sidebar. Any user who runs it gets a brand audit for someone they've never met, with suggestions about a Greek SaaS founder's X presence.
- **Effort**: S
- **Suggested fix**:
  - Replace the hardcoded backstory with `getAboutMe()` or `profileName`.
  - If `getAboutMe()` is empty, prompt the user to fill in their About Me before running the audit.

---

### 15. 14,924-line monolithic `index.html` — every change touches everything
- **What**: The entire application (CSS, HTML, JavaScript logic) lives in a single file with no module system, no component boundaries, and no test harness.
- **Where**: `index.html` (entire file)
- **Why it matters**: Every PR touches index.html. Merge conflicts are unavoidable. There are no automated tests, so regressions are only caught by manual review. The file is already past the threshold where most editors struggle with code navigation.
- **Effort**: L
- **Suggested fix**:
  - Start by extracting CSS into `styles.css` and the service-worker registration into a small `boot.js`.
  - Adopt a minimal build step (Vite or esbuild) that concatenates a few logical modules: `state.js`, `views/*.js`, `ai.js`.
  - This doesn't require a framework — even vanilla JS modules would halve the surface area of every future diff.

---

### 16. `manifest-givelink.json` still in the SW `STATIC` cache list
- **What**: The service worker attempts to pre-cache `manifest-givelink.json` (sw.js line 4). This is the PWA manifest for the separate Givelink product.
- **Where**: `sw.js:4`
- **Why it matters**: The file exists now, but if it's ever removed from the repo, the SW install will fail silently (one rejected `Promise.allSettled` item) and leave clients without a clean install.
- **Effort**: S
- **Suggested fix**:
  - Remove `'./manifest-givelink.json'` from the `STATIC` array.
  - Verify `./icon-gl.svg` (also in STATIC, line 6) is still needed for the Arete brand; if not, remove it too.

---

### 17. `aiExtractTasksFromNotes` hardcodes Givelink as extraction priority
- **What**: The "Extract tasks from notes" AI function instructs Claude to prioritize "tasks that drive Givelink revenue/nonprofits or unlock financial freedom".
- **Where**: `index.html:7477`, `index.html:7582`
- **Why it matters**: The extracted tasks will always be skewed toward nonprofit fundraising regardless of what the user's notes say. Low-urgency since few users may find this feature, but it adds noise.
- **Effort**: S
- **Suggested fix**:
  - Replace the hardcoded Givelink instruction with `their top goals` derived from `S.goals.filter(g=>g.isTop3).map(g=>g.title).join(', ')`.

---

### 18. No rate-limit protection on the Claude proxy endpoint
- **What**: `api/claude.js` has no per-user rate limiting. The comment acknowledges this ("For production add per-user rate limiting").
- **Where**: `api/claude.js:14`
- **Why it matters**: Once `aiProxy` is wired up (P0 item #3), a single user or bad actor can make unlimited Claude calls, running up the Anthropic bill without any circuit breaker.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (the proxy comment already names this): 20–50 requests/user/day is reasonable for a free tier.
  - Alternatively, add a `max_tokens` cap of `2000` (already done) and an IP-based rate limit at the Vercel Edge config level for a zero-dependency solution.

---

### 19. Auto-suggest AI prompt in `aiSuggestAutomations` is scoped to the creator's context
- **What**: The automation ideas prompt always mentions "Givelink B2B SaaS for nonprofits, and content creation" as the target domain.
- **Where**: `index.html:5445`
- **Why it matters**: Users get automation suggestions about nonprofit outreach instead of suggestions relevant to their own work.
- **Effort**: S
- **Suggested fix**:
  - Replace the hardcoded domain with: `My top goals: ${S.goals.filter(g=>g.isTop3).map(g=>g.title).join(', ')||'productivity and focus'}.` This makes the output immediately relevant to whoever is running the feature.

---

### 20. `sfTimeline` state object surfaces a personal life event to all users
- **What**: The global state object carries `sfTimeline` (a structured tracker for a San Francisco relocation: target date, duration, budget, milestones, network). It is not visible in the UI directly but serialised into every user's localStorage snapshot.
- **Where**: `index.html:2517`
- **Why it matters**: Low impact now (hidden), but wastes storage and creates confusion for any future contributor who sees `sfTimeline` in the state shape.
- **Effort**: S
- **Suggested fix**:
  - Remove or rename to a generic `majorMoveTimeline` or `lifeEventTimeline` — a feature many people could actually use.
  - If no one is using it, remove it in the next state schema migration.
