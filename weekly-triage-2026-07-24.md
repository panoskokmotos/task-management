# Weekly Triage — 2026-07-24

## 📊 Week at a glance
- **Commits**: 4 | **Files changed**: 13 | **Debt markers added**: 0
- **High-churn files**: `landing.html` (3 commits), `index.html` (2 commits), `manifest.json` (2 commits)
- **Week summary**: Heavy growth/marketing sprint — new landing page, SEO, analytics plumbing, brand cleanup. No test commits. No hotfixes or reverts.

---

## 🚨 Needs immediate attention

### 1. AI functions hardcode developer name and company for every user
- **File**: `index.html:5647, 7580, 11672, 11734, 5920`
- **Commit**: `0c1d32d` (rebrand sprint introduced first-run AI features)
- **Why this matters**: Every user's AI daily picks, morning briefing, discomfort coaching, and relationship nudges are framed around "Panos" and "Givelink." The AI actively tells strangers to prioritize tasks that grow the developer's startup. This is the #1 feature on the landing and it's completely broken for every non-developer user.

### 2. Hardcoded `profileName = 'Panos'` as the JavaScript default
- **File**: `index.html:2519`
- **Commit**: Predates the 7-day window; not cleaned up in `0c1d32d` (rebrand)
- **Why this matters**: Every new user is greeted as "Panos" unless they've set a name. The first-run onboarding was added this week (`0c1d32d`) but doesn't fix the fallback. New signups hit this immediately.

### 3. `aiProxy: ''` — AI features silently dead on hosted deployment
- **File**: `index.html:9959`
- **Commit**: Present in all commits this week; never filled in
- **Why this matters**: The landing page (3 commits this week) prominently advertises AI as the product's core value prop. Every new user who signs up and tries AI sees "Add your Claude API key in Settings" — a dead-end that immediately contradicts the pitch.

### 4. Push notification icons broken — `./icons/` directory doesn't exist
- **File**: `sw.js:44–45`
- **Commit**: `0c1d32d` (sw.js was touched in the rebrand commit)
- **Why this matters**: Icon path references `./icons/icon-192.png`; files live at `./icon-192.png`. Every push notification renders with a broken/missing icon. The ntfy integration (a retention mechanism) was promoted this week.

### 5. PostHog key empty — the analytics infrastructure built this week collects nothing
- **File**: `landing.html:702`, `index.html:9960`
- **Commit**: `b38d4bb` (added PostHog to landing explicitly for "measurable growth surface")
- **Why this matters**: Commit #83 added PostHog, a comparison table, and SEO — all to make the landing measurable. But `POSTHOG_KEY = ''` means zero data flows. The entire analytics investment from this commit is currently inert.

---

## 🧹 Cleanup opportunities

### 6. `manifest-givelink.json` still cached in service worker after rebrand
- **File**: `sw.js:4`
- **Commit**: `0c1d32d` (rebrand commit that touched `sw.js`)
- **Why this matters**: The SW cache still includes the old Givelink PWA manifest. Users who installed the PWA before the rebrand remain on stale branding. Simple line deletion + cache version bump.

### 7. Seed tasks contain personal Greek medical appointments and Givelink CRM data
- **File**: `index.html:4543–4722`
- **Commit**: Predates this week but was not addressed in the rebrand (`0c1d32d`)
- **Why this matters**: Guest/local users are seeded with the developer's personal health records (`'Ακτινογραφία στα γόνατα'` = knee X-ray) and private startup pipeline tasks. These ship in the public source code. Medium cleanup effort with high privacy/trust impact.

### 8. Landing canonical URL is a Vercel preview domain
- **File**: `landing.html:11–27`
- **Commit**: `0c1d32d` (landing created), unchanged in `59abf2d` and `b38d4bb`
- **Why this matters**: Three commits this week improved SEO on the landing without fixing `https://task-management-beige-eight.vercel.app/` as the canonical URL. Search engines are indexing the wrong domain.

### 9. `catch(e) {}` around `sbSyncNow(true)` in post-login handler
- **File**: `index.html:10131`
- **Commit**: Predates this week; not addressed in `0c1d32d`
- **Why this matters**: If the first sync after login fails (bad token, Supabase outage), the user sees a blank task list with no error. This is the highest-stakes moment of the user's session.

---

## 🤔 Worth a second look

### 10. `landing.html` has no front-door router for returning users
- **File**: `landing.html:31–47`
- **Commit**: `0c1d32d` (front-door router was added to `index.html`)
- **Why this matters**: `index.html` routes returning users/auth callbacks correctly. `landing.html` has its own router but only handles `access_token=` hashes and `taskos_sb_refresh` localStorage — it doesn't handle the `taskos_guest` case added in commit `0e19b15` (guest mode, same week). A guest user bookmarking the landing URL might not be routed into the app correctly on return.

### 11. Three commits this week touched `manifest.json` — version drift risk
- **File**: `manifest.json`
- **Commits**: `72d9c68`, `0c1d32d` (2 of the 4 commits this week)
- **Why this matters**: `manifest-givelink.json` still exists alongside `manifest.json`. Two PWA manifests with different icons and names can cause browser confusion about which install is "the app." The old manifest being in the SW cache compounds this.

### 12. `robots.txt` and `sitemap.xml` updated in `b38d4bb` — verify domain matches
- **File**: `robots.txt`, `sitemap.xml`
- **Commit**: `b38d4bb` (this week)
- **Why this matters**: Both files were updated as part of the SEO push but if they reference `task-management-beige-eight.vercel.app` (the same preview domain as the canonical issue above), the SEO benefit is negated. Worth a one-line check.

### 13. No rate limiting on the Anthropic proxy despite an explicit TODO comment
- **File**: `api/claude.js:12–13`
- **Commit**: Predates this week (proxy not touched recently)
- **Why this matters**: With new users signing up from the landing (goal of this week's growth work), each new account has full unrestricted access to the proxy. The TODO explicitly says this will run up the bill. Low probability, high cost if triggered.
