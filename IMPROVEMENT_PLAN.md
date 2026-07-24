# Arete Improvement Plan
_Generated 2026-07-24. Max 20 items, ordered by ROI within tier._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. AI prompts hardcode "Panos" and "Givelink" for every user
- **What**: Five AI functions (`aiDailyPicks`, `_fetchAIBriefing`, `aiRelNudge`, `autoProcessInbox`, `aiDiscomfortInsight`) bake in `"Panos"` (developer name) and `"Givelink"` (developer's startup) as the user persona — so every user receives AI coaching framed around someone else's life and business.
- **Where**: `index.html:5647, 7580–7582, 11672, 11734, 5920`
- **Why it matters**: The AI's #1 job is personalized advice. Today it tells every user to prioritize tasks that "drive Givelink revenue/nonprofits" — a severe trust and quality failure for anyone who isn't Panos.
- **Effort**: S
- **Suggested fix**:
  - Replace all hardcoded `"Panos"` references with `profileName` (already a global)
  - Replace hardcoded `"Givelink"` goal framing with `getAboutMe()` — the function already exists and returns user-defined context
  - Grep: `grep -n '"Panos"\|Givelink' index.html | grep -v CATS` to find all sites

### 2. Hardcoded fallback name "Panos" displayed to every new user
- **What**: `let profileName = 'Panos'` at `index.html:2519` and the static HTML greeting placeholder (`index.html:1070`) both default to the developer's first name. Any user who hasn't set a name in Settings sees "Good morning, Panos 👋" on the dashboard.
- **Where**: `index.html:2519` (JS default), `index.html:1070` (HTML placeholder)
- **Why it matters**: It's the first thing a new user sees. Being greeted by a stranger's name destroys onboarding trust instantly.
- **Effort**: S
- **Suggested fix**:
  - Change `let profileName = 'Panos'` → `let profileName = 'you'` (or `''` and handle blank in greeting)
  - Update the static HTML to `Good morning 👋` (no name) until the JS resolves it
  - The `_welcomeSeed()` function already derives a name from the user's email — confirm it runs before the greeting renders

### 3. Seed data contains personal medical records and private business data
- **What**: The `seed()` function (populates data for guest/local users) includes verbatim personal tasks: Greek-language medical appointments (`'Ακτινογραφία στα γόνατα'` = knee X-ray, `'Πνευμολογικές εξετάσεις'` = pulmonology tests), 30+ tasks tagged `category:'givelink'` for a specific company's CRM pipeline, and a `€245` personal finance entry.
- **Where**: `index.html:4543–4722`
- **Why it matters**: Every guest user's first experience is a task list full of someone else's private health records and startup sales tasks. This is both a privacy risk (personal data shipped in source) and a terrible first impression.
- **Effort**: M
- **Suggested fix**:
  - Replace the personal seed tasks with 10–15 generic, persona-neutral demos that showcase features (capture, buckets, goals, AI triage, habits)
  - Remove all tasks with `category:'givelink'`, Greek-language text, and personal health/finance entries from the `seed()` function
  - Keep the structure (tasks across buckets, various categories) but use fictional names and generic scenarios

### 4. Push notification icons reference a missing `icons/` directory
- **What**: The service worker uses `icon: './icons/icon-192.png'` for push notifications, but that path doesn't exist — the file is at `./icon-192.png`. Every push notification is broken.
- **Where**: `sw.js:44–45`
- **Why it matters**: Notifications are a core retention loop (reminders, accountability, daily planning). They show a blank icon or fail silently on some browsers.
- **Effort**: S
- **Suggested fix**:
  - Change `icon: './icons/icon-192.png'` → `icon: './icon-192.png'`
  - Change `badge: './icons/icon-192.png'` → `badge: './icon-192.png'`
  - Bump the `CACHE` version string in `sw.js` to force a re-install

### 5. Stored XSS: task titles rendered unescaped into `innerHTML`
- **What**: `t.title` is interpolated directly into `innerHTML` template literals in at least 8 render functions. The `esc()` helper exists at `index.html:11776` but is not applied to task titles in most views.
- **Where**: `index.html:3159, 3223, 3274, 3306, 3594, 3601, 3716` (and in `renderWizPanel`, `renderEisenhower`, `renderAll`)
- **Why it matters**: Any task title containing `<img onerror=...>` executes in the browser. The template import feature (PLG #79) pulls tasks from a cloud URL — a malicious template can own the session.
- **Effort**: M
- **Suggested fix**:
  - Run `grep -n '${t\.title}' index.html` — replace every instance inside template literals assigned to `.innerHTML` with `${esc(t.title)}`
  - Same for `t.notes`, `p.name`, goal titles, and any other user-controlled string rendered via innerHTML

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. `aiProxy` is empty — hosted AI features are broken for all users
- **What**: `APP_CONFIG.aiProxy` is `''` in the shipped code. Every AI feature (triage, day planning, NL capture) falls back to requiring the user's own Claude API key.
- **Where**: `index.html:9959`
- **Why it matters**: "AI that plans your day" is the hero promise on the landing page. New hosted users hit a dead end immediately and see "Add your Claude API key in Settings" — a confusing off-brand failure.
- **Effort**: S
- **Suggested fix**:
  - Set `aiProxy: 'https://<your-vercel-app>.vercel.app/api/claude'` and confirm `ANTHROPIC_API_KEY` is set in Vercel project settings
  - Inject the value via a Vercel env var at build time rather than hardcoding the URL in source

### 7. PostHog analytics collecting zero data
- **What**: `APP_CONFIG.posthogKey` is `''` and `POSTHOG_KEY` in `landing.html` is `''` — PostHog never initializes on either surface.
- **Where**: `index.html:9960`, `landing.html:702`
- **Why it matters**: The landing was explicitly built as a "measurable growth surface" (commit #83) but the entire funnel (view → signup → first-run) is invisible. No data = no feedback loop.
- **Effort**: S
- **Suggested fix**:
  - Set the PostHog project key (safe to expose — it's a public-side key) in both files
  - Verify that `landing_view`, `signup`, `firstrun_started`, and `firstrun_organized` events appear in PostHog after a test run

### 8. Post-login sync failure is silently discarded — user sees blank/stale state
- **What**: `try{await sbSyncNow(true);}catch(e){}` in `_afterAuth()` swallows any sync error. If the cloud pull fails, the user lands on a dashboard with zero tasks and no explanation.
- **Where**: `index.html:10131`
- **Why it matters**: Data loss perception on login is the highest-churn moment. Silent failures look like bugs to users who don't know their data is actually safe.
- **Effort**: S
- **Suggested fix**:
  - Replace the empty catch with `catch(e){ toast('⚠ Sync failed — your saved data could not be loaded. Check your connection.', 6000); }`
  - Mark the sync pill as errored so users have a visible signal

### 9. "Givelink" category and dashboard exposed to all users
- **What**: `CATS.givelink` shows "Givelink" as a task category in every user's dropdown; `renderGivelinkDash` is a full live view exposing MRR/ARR/pipeline; a hardcoded focus block labels itself "Givelink Outreach."
- **Where**: `index.html:2503, 2507, 2984, 4375, 8618–8750`
- **Why it matters**: New users see a random startup's metrics dashboard and a category named after it. The view is accessible to anyone via the nav router (`renderView('givelink-dash')`).
- **Effort**: M
- **Suggested fix**:
  - Rename `CATS.givelink` to `CATS.business` (label: `'Business'`) and update all references
  - Gate `renderGivelinkDash` behind a feature flag or remove it from the public router
  - Change the hardcoded focus block label (`index.html:4375`) to `'Outreach'` or derive it from the user's top goal

### 10. Landing page canonical URL is a Vercel preview domain
- **What**: All canonical, OG, Twitter, and schema.org URLs in `landing.html` point to `https://task-management-beige-eight.vercel.app/` — a Vercel auto-generated preview URL.
- **Where**: `landing.html:11–27`
- **Why it matters**: Search engines index the ugly preview URL. Any future domain migration breaks all indexed pages and backlinks. Directly undermines the SEO work in commit #83.
- **Effort**: S
- **Suggested fix**:
  - Replace all instances of `task-management-beige-eight.vercel.app` with the intended production domain
  - Update `sitemap.xml` to match
  - Or inject `SITE_URL` as a Vercel env var at deploy time

### 11. No per-user rate limiting on AI proxy
- **What**: `api/claude.js` has a comment explicitly flagging missing rate limiting ("a single account can't run up your Anthropic bill") but it was never implemented.
- **Where**: `api/claude.js:12–13`
- **Why it matters**: One abusive or compromised account can exhaust a month's Anthropic budget in minutes across all AI features.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (`@upstash/ratelimit`): 20 req/min per `uid` extracted from the Supabase JWT
  - Return HTTP 429 with a clear message; the front-end already handles 429 correctly (`index.html:5028`)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 12. Task checkboxes have no ARIA role — keyboard and screen reader inaccessible
- **What**: Every task's done/undone toggle is a `<div class="ck" onclick="...">` with no `role`, `aria-checked`, `aria-label`, or `tabindex`. Screen readers cannot find or operate them; keyboard-only users cannot tab to them.
- **Where**: `index.html:3221` (JS-generated template, used throughout all list views)
- **Why it matters**: Core interactions are completely invisible to assistive technology. Fails WCAG 2.1 AA checkboxes criterion.
- **Effort**: M
- **Suggested fix**:
  - Add `role="checkbox"` `tabindex="0"` `aria-checked="${t.status==='done'}"` `aria-label="Mark ${esc(t.title)} done"` to the `.ck` element in `tcHTML()`
  - Add `onkeydown="if(event.key==='Enter'||event.key===' '){toggleDone('${t.id}');event.preventDefault()}"` for keyboard support

### 13. 71 empty `catch(e){}` blocks make production debugging impossible
- **What**: ~71 bare `catch(e){}` blocks throughout — including around critical boot operations like `_autoSnapshot`, nav state restore, and template application.
- **Where**: `index.html:956, 2587, 2983, 3031, 3868, 10633, 10681` (and ~64 more)
- **Why it matters**: When something breaks silently at boot, there is no signal — not in the console, not for the user. Production issues become invisible.
- **Effort**: M
- **Suggested fix**:
  - Audit each site: add `console.warn('[context]', e)` for non-critical paths (haptics, confetti, analytics)
  - Add `toast()` error for any catch in a user-initiated flow
  - Keep truly intentional no-ops (e.g. haptic vibrate) but document them with a comment

### 14. Supabase credentials hardcoded in source — rotation requires a redeploy
- **What**: `APP_CONFIG.supabaseUrl` and `APP_CONFIG.supabaseAnon` are committed as literal strings. While the anon key is "publishable," it's permanently in git history and indexed by GitHub code search.
- **Where**: `index.html:9957–9958`
- **Why it matters**: Key rotation (after a security incident, project migration) requires a code change + full redeploy instead of a single env-var update. Every fork of the repo carries live credentials.
- **Effort**: M
- **Suggested fix**:
  - Replace with placeholder strings (`'__SUPABASE_URL__'`, `'__SUPABASE_ANON__'`) that a build step substitutes from Vercel env vars
  - Or load them from a `config.json` that is excluded from version control

### 15. Readwise and Notion fetches have no timeout — can hang indefinitely
- **What**: `_rwFetch` and the Notion blocks fetch use bare `fetch()` with no `AbortController` timeout. If the external API is slow or down, the loading spinner shows forever with no way to cancel.
- **Where**: `index.html:10819–10823` (Readwise), `index.html:10940` (Notion)
- **Why it matters**: On mobile or spotty connections, users are stuck on a permanent spinner with no escape.
- **Effort**: S
- **Suggested fix**:
  - Wrap both fetches with `signal: AbortSignal.timeout(10_000)`
  - On timeout, show a user-facing error with a "Retry" button

### 16. `renderDash()` is 162 lines — one function controls the entire dashboard
- **What**: A single function renders the greeting, five stat cards, XP animation, Top 3, Daily Picks, upcoming tasks, review banner, book insight, morning briefing, streak row, life score, network health, wheel widget, and compact toggle. Any uncaught error blanks the entire dashboard.
- **Where**: `index.html:2988–3149`
- **Why it matters**: No fault isolation. A null reference in the life-score widget kills the task list too. The function is also unsearchable — any bug report pointing to "dashboard" requires reading 162 lines.
- **Effort**: M
- **Suggested fix**:
  - Extract each widget into its own `_renderDash*()` function
  - Wrap each call in a try/catch in the top-level `renderDash()` so one widget failure degrades gracefully rather than blacking out everything

---

## 💡 P3 — Nice to have

### 17. `manifest-givelink.json` still cached by service worker post-rebrand
- **What**: The SW explicitly caches `./manifest-givelink.json` (old Givelink brand PWA manifest), wasting SW storage on every installed device.
- **Where**: `sw.js:4`, `/manifest-givelink.json`
- **Effort**: S
- **Suggested fix**: Remove from the STATIC array; delete the file unless `/givelink` route needs its own PWA manifest, in which case update it to Arete branding.

### 18. `sbSyncNow` uses last-write-wins — offline conflicts are silently lost
- **What**: When two devices are both offline and make changes, whichever syncs second overwrites the first's data with no warning.
- **Where**: `index.html:10412–10444`
- **Effort**: L
- **Suggested fix**: Detect the collision case and at minimum toast a warning. Longer term, move to task-level patches rather than full-state replace.

### 19. No `.env.example` documenting required deployment variables
- **What**: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` are required for the API proxy but only documented inline in source comments.
- **Where**: `api/claude.js:3–6`
- **Effort**: S
- **Suggested fix**: Create `.env.example` listing all vars with descriptions; reference from README.

### 20. `<noscript>` fallback missing on both app and landing
- **What**: Users with JS disabled see a blank page on both `index.html` and `landing.html`.
- **Where**: Both files, immediately after `<body>`
- **Effort**: S
- **Suggested fix**: Add `<noscript><p style="padding:2rem;font-family:sans-serif;">Arete requires JavaScript. Please enable it to continue.</p></noscript>` to both files.
