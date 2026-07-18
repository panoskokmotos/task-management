# Weekly Triage — 2026-07-18

## 📊 Week at a glance
- **Commits**: 11 | **Files changed**: 12 | **Debt markers added**: 0 (`TODO`/`FIXME` scan: none)
- **High-churn files**: `index.html` (11 commits) · `sw.js` (10 commits) · `og-image.png` (2 commits)
- **Theme**: Rebrand to Arete + PLG feature sprint (templates, referrals, share-the-win, guest mode, first-run tour)
- **Risk signal**: The "Remove Givelink" commit (#73) is incomplete — hardcoded personal context remains in 7+ AI functions. The PLG work assumes working AI, but `aiProxy` is still empty.

---

## 🚨 Needs immediate attention

### 1. `aiProxy` is empty — AI features silently unavailable to all signed-in users
- **File**: `index.html:9959`
- **Commit introduced**: `0c1d32d` (Rebrand, #80) — APP_CONFIG was rebuilt but proxy URL was never filled in
- **Why this matters**: All seven PLG commits this week (referrals, share-the-win, first-run tour) lean on AI being available. Users who sign up via the new landing page, go through the first-run tour, and then tap "Plan my day" get a toast saying "Add Claude API key in Settings" — which makes the app feel unfinished immediately after the conversion moment. The proxy endpoint at `api/claude.js` is fully implemented; it just isn't wired up.

### 2. Hardcoded "Panos" in 7 AI prompts — incomplete cleanup from commit #73
- **Files**: `index.html:5445`, `5647`, `5920`, `7155`, `7319`, `7477`, `7582`, `7849`
- **Commit introduced**: These pre-date this week; commit `d635c06` (#73, "Remove Givelink from Task OS") was supposed to fix this but the commit message says only `getAboutMe()` fallback was genericised — the individual prompt bodies were not touched.
- **Why this matters**: The Arete rebrand this week made the app public-facing. AI outputs now tell real users to "consider Panos's Givelink fundraising platform" and coach them on "building resilience for the SF move and Givelink growth." Every AI feature is confidently wrong for every user who isn't the app's creator.

### 3. Default greeting is "Good morning, Panos" — first impression broken for new users
- **File**: `index.html:1070` (static HTML), `index.html:2519` (`profileName` fallback)
- **Commit introduced**: Pre-dates this week; not touched in the rebrand commits despite landing page being rewritten
- **Why this matters**: The first-run tour launched this week (`7c260f5`, #75) is designed to create a "magic moment" for new users. That moment is immediately undercut when the greeting reads "Good morning, Panos 👋" before the user has entered their name.

### 4. Push notification icon path broken — notifications arrive without an icon
- **File**: `sw.js:46-47`, `index.html:11289`
- **Commit introduced**: `a8586f3` (#74, "Marketing: social-share previews") introduced push notification infrastructure; path was wrong from the start
- **Why this matters**: `./icons/icon-192.png` does not exist — the file is at `./icon-192.png`. On iOS/Android the push notifications the reminders feature sends show no icon, which makes them look like system alerts or spam. The in-app `Notification` constructor at line 11289 has the same bug.

### 5. `_APP_URL` and canvas share image hardcoded to old Vercel URL
- **File**: `index.html:10180` (`_APP_URL`), `index.html:10232` (canvas `fillText`), `index.html:10279` (template share links)
- **Commit introduced**: `32e7288` (#76, "referral links") introduced `_APP_URL`; `fb63461` (#78, "shareable progress card") introduced the canvas share image — both used the old URL and neither was updated in the rebrand commit
- **Why this matters**: "Invite a friend" links, share-the-win cards, and template share URLs all distribute `task-management-beige-eight.vercel.app`. The entire PLG acquisition loop sends new users to the old project URL rather than the branded Arete app.

---

## 🧹 Cleanup opportunities

### 6. `'givelink.html'` and `'manifest-givelink.json'` in SW cache list
- **File**: `sw.js:4` (`manifest-givelink.json` in STATIC), `sw.js:17` (`givelink.html` in HTML)
- **Commit**: `d635c06` (#73) removed the Givelink workspace switcher from the sidebar but did not update the SW cache list
- **Why this matters**: Both files belong to the separate Givelink product. `Promise.allSettled` prevents a single failure from breaking the install, but these are unnecessary cache entries. If `givelink.html` is deleted later, the SW will silently fail on that item every install.

### 7. `'givelink-dash'` still registered in the `renderView` router
- **File**: `index.html:2984`
- **Commit**: `d635c06` (#73) removed the sidebar nav item for Givelink OS but left the route in the router
- **Why this matters**: Anyone with a cached link to `#givelink-dash` (including the creator's browser bookmarks) lands on a full founder business dashboard with nonprofit KPIs. Not a blocker, but it's a confusing ghost route in an app that's now public.

### 8. Tweet generator "Givelink" angle option still visible to all users
- **File**: `index.html:6077` (the `angles` object in `generateTweet`)
- **Commit**: `d635c06` (#73) removed Givelink from category dropdowns but missed this one
- **Why this matters**: Any user who opens the tweet generator sees a "Givelink: startup progress building B2B SaaS for nonprofits" option in the angle selector. Low-urgency, but it's a visible brand inconsistency that leaks personal context.

### 9. OG/Twitter meta tags still point to old Vercel URL in both `index.html` and `landing.html`
- **File**: `index.html:24-32`, `landing.html:11-21` (canonical, og:url, og:image, twitter:image)
- **Commit**: `0c1d32d` (#80, Rebrand) rewrote the landing page but didn't update the meta tag URLs
- **Why this matters**: All social previews link back to the old project URL. SEO canonical tag points the wrong domain. Affects both the app and the landing page.

---

## 🤔 Worth a second look

### 10. Seed tasks and goals (lines 4546–4976) contain highly personal Givelink/SF content — but are skipped in hosted mode
- **File**: `index.html:4546-4976`
- **Commit**: `d635c06` (#73) intentionally left these: "seed is skipped in hosted mode."
- **Why this looks suspicious**: `seed()` is only called when `!_hostedMode()` (line 10660). Since `APP_CONFIG.supabaseUrl` and `APP_CONFIG.supabaseAnon` are set, this is always hosted mode in production — seeds never run. BUT: any developer who clones this repo locally without Supabase configured will get ~80 deeply personal Givelink tasks as their starting data. Also, the `CATS` object still includes `givelink` as a first-class category (line 2503) and the `wealth` Life Area still has `'givelink'` in its `cats` array (line 2507) — those **do** affect all users regardless of mode.

### 11. `S.sfTimeline`, `S.givelinkMetrics`, `S.givelinkHistory` in global state for all users
- **File**: `index.html:2517`
- **Commit**: `d635c06` (#73) noted these as "dormant internals" left in place intentionally
- **Why this looks suspicious**: These fields are serialised into every user's localStorage. `givelinkMetrics` in particular has a nested `impactModel` with `targetPeople: 1000000` — a specific business goal hard-baked into the default state of a generic productivity app. Not a bug today, but every new user carries this baggage in their data.

### 12. Landing page front-door router only checks `taskos_sb_refresh` or `taskos_guest` — not `taskos_sb_access`
- **File**: `landing.html:32-33`
- **Why this looks suspicious**: The router checks `localStorage.getItem('taskos_sb_refresh')` to decide if a returning user should bypass the landing. But `_sbEnabled()` in the app checks for `_SB.refresh` AND `_SB.uid` AND `_SB.access`. A user whose access token expired but whose refresh token is present gets routed directly into the app, which then needs to refresh — this is correct, but the `_sbToken()` function's refresh logic should be verified to handle a network failure during the initial boot refresh without showing a broken state.
