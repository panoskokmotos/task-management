# Weekly Triage — 2026-10-02

## 📊 Week at a glance

- **Commits this week:** 0 — last commit was `160f0d8` on 2026-09-12 (20 days ago)
- **Files changed this week:** 0
- **Debt markers added this week:** 0 (nothing new — existing debt catalogued below)
- **High-churn files (last 30 days):** `givelink.html` (changed in #84), `index.html` (changed in #84), `.github/workflows/supabase-keepalive.yml` (added in #85)

> No commits landed in the past 7 days. This triage covers the two most recent PRs (#84, #85) and existing debt in the changed files.

---

## 🚨 Needs immediate attention

### 1. CSP blocks Inter font — production app renders in system font
**File:** `vercel.json:15` / `index.html:14-16`
**Introduced by:** `b38d4bb` (Landing growth, #83) — CSP header added; font-src was never updated
**Why this matters:** `font-src 'self'` in the CSP header blocks `fonts.gstatic.com`. Inter, the app's primary font, fails to load in production. The app has rendered in system fallback fonts since at least PR #83 was deployed.
**Fix:** Add `https://fonts.gstatic.com` to `font-src` in `vercel.json`.

---

### 2. Broken push notification icon — all push notifications show no icon
**File:** `sw.js:46-47`, `index.html:11289`
**Introduced by:** original project setup (never fixed)
**Why this matters:** Both files reference `'./icons/icon-192.png'`, but the file is at `'./icon-192.png'` (no `icons/` directory exists). Every push notification is missing its icon. On Android this looks broken; on iOS it may prevent the notification from displaying entirely.
**Fix:** `s/\.\/icons\/icon-192\.png/\.\/icon-192\.png/g` in both files.

---

### 3. "Panos" hardcoded as default profile name — every new user greeted as Panos
**File:** `index.html:2519`
**Introduced by:** early project setup; not fixed in `72e03fe` despite a comment at line 10458 noting the intent
**Why this matters:** Any new user who doesn't go through the full onboarding flow sees "Good morning, Panos". This is a first-impression breaking bug for all new signups.
**Fix:** Change `||'Panos'` → `||''` and update the greeting render to handle an empty name.

---

### 4. `givelink.html` stat cards duplicate on every task toggle
**File:** `givelink.html:1625`
**Introduced by:** `72e03fe` (Givelink bug fixes and This Week view, #84) — the velocity stats render was added or modified
**Why this matters:** `el.innerHTML +=` appends stat cards on each `refresh()` call instead of replacing them. Every time the user toggles a task done, two more stat cards appear. After a few toggles the UI is broken.
**Fix:** Change `el.innerHTML +=` → `el.innerHTML =` on line 1625.

---

### 5. Standup generator reports tasks from two days ago, not yesterday
**File:** `givelink.html:1561`
**Introduced by:** `72e03fe` (Givelink bug fixes and This Week view, #84) — standup feature introduced
**Why this matters:** `yesterday.setDate(now.getDate()-2)` sets the cutoff to 2 days ago, not 1. A Monday standup will report nothing done if all work was done on Friday.
**Fix:** `getDate()-2` → `getDate()-1`.

---

## 🧹 Cleanup opportunities

### 6. `window.prompt()` for iOS PWA — 3 uses in givelink.html
**File:** `givelink.html:1155`, `givelink.html:1330`, `givelink.html:1504`
**Introduced by:** original project setup
**Why this matters:** iOS in standalone PWA mode silently blocks `window.prompt()` and returns `null`. The CRM "Log Activity" feature will appear to succeed but save nothing on iOS. `index.html` already has a custom `_promptModal()` helper (line 2817) for this exact problem.
**Fix:** Replace all `window.prompt()` calls in `givelink.html` with a modal equivalent.

---

### 7. Duplicate API key resolution logic in `givelink.html`
**File:** `givelink.html:1144–1170` (getApiKey) and `givelink.html:1320–1340` (callClaudeGL)
**Introduced by:** `72e03fe` (#84) — `callClaudeGL` was added alongside the existing `getApiKey` without refactoring
**Why this matters:** Both functions try to read the API key from different localStorage paths in a different order. When the key needs to be found/invalidated, it must be updated in two separate places.
**Fix:** Remove the inline key lookup from `callClaudeGL`; call `getApiKey()` at the top of that function.

---

### 8. `api/claude.js` model name hardcoded — no env override
**File:** `api/claude.js:44`
**Introduced by:** original setup
**Why this matters:** When `claude-haiku-4-5-20251001` is deprecated, all server-side AI features silently fail. No way to upgrade without a code deploy.
**Fix:** `const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';`

---

### 9. Supabase keepalive workflow commits credentials in plaintext
**File:** `.github/workflows/supabase-keepalive.yml:23-24`
**Introduced by:** `160f0d8` (#85) — the workflow was intentionally written with the values inline
**Why this matters:** The anon key is rotatable but having it in git history makes rotation painful. Future contributors may copy this pattern for actual secrets.
**Fix:** Move `SUPABASE_URL` and `SUPABASE_ANON_KEY` to GitHub Actions secrets; reference as `${{ secrets.SUPABASE_URL }}`.

---

### 10. `console.warn` calls swallow errors in all init hooks
**File:** `index.html:10656-10665`
**Introduced by:** ongoing pattern throughout the codebase
**Why this matters:** Seven startup functions (`load`, `seed`, `resetRecurring`, `quests`, `wrapped`, `sidebarSwipe`, `autoSnapshot`) log warnings on failure but provide no user feedback. If any critical startup function throws, the user sees a blank dashboard with no explanation.
**Fix:** For `load()` and `resetRecurring()`, escalate to `toast()` on failure; the others can stay as `console.warn`.

---

## 🤔 Worth a second look

### 11. `aiProxy` is empty — all AI calls go direct to Anthropic with user's key
**File:** `index.html:9959` — `aiProxy: ''`
**Introduced by:** unknown (the proxy in `api/claude.js` exists but is not wired up)
**Why this matters:** The serverless proxy at `/api/claude` is deployed but `APP_CONFIG.aiProxy` points to `''`, so `callClaude()` always uses the direct path with the user's key. If the intent was for hosted users to use the proxy (no key required), this is broken by omission. If this is intentional (key-only mode), the `api/claude.js` file is dead code.
**Recommendation:** Decide: hosted-proxy mode or key-only mode. If hosting for users, set `aiProxy: '/api/claude'` in `APP_CONFIG`. If key-only, document that `api/claude.js` is unused.

---

### 12. `givelink.html` seeds ~100 personal tasks including real contact names
**File:** `givelink.html:1791` — `load();seed();`
**Introduced by:** original project setup
**Why this matters:** `seed()` in `givelink.html` unconditionally seeds the sprint board with personal tasks containing real company names and personal notes. Unlike `index.html` which guards against seeding in hosted mode, `givelink.html` has no such guard. Any user opening `/givelink` on a shared deployment will see this data.
**Recommendation:** Add a guard: `if(!S.seeded){seed(); S.seeded=true; save();}` — or better, remove the seeding for production.

---

### 13. `givelink.html` calls Anthropic API using `claude-opus-4-5` for sprint planning
**File:** `givelink.html:1209`
**Introduced by:** original setup (or an earlier unnamed commit)
**Why this matters:** Sprint planning uses `claude-opus-4-5`, which is significantly more expensive than Haiku. The outreach generator (line 1734) correctly uses Haiku. Every sprint plan generation call costs ~10–50× what the other AI features cost.
**Recommendation:** Switch the sprint planner to `claude-haiku-4-5-20251001` to match the rest of the app, or add a visible cost warning.

---

_13 items total. Items 1–5 could bite in production. Items 6–10 are cleanup. Items 11–13 are judgment calls._
