# Weekly Triage — 2026-07-30

## 📊 Week at a glance
- **Commits this week (Jul 23–30):** 0 (last commit was Jul 22 — `b38d4bb`)
- **Files changed this week:** 0
- **Debt markers added this week:** N/A (no new commits)
- **High-churn files (last 30 days):** `index.html` (touched in 15+ commits), `landing.html` (rebuilt from scratch in #82), `sw.js` (cache version bumps in 3 commits)

> **Context:** The team shipped heavily Jul 16–22 (8 commits across PLG features, rebrand to Arete, and landing page uplift). This triage therefore focuses on residue from that burst — the half-finished patterns, debt markers, and risky code left behind.

---

## 🚨 Needs immediate attention

### 1. Direct browser→Anthropic API calls with localStorage key
- **File:** `givelink.html:1131–1144, 1264–1271`
- **Commit introduced:** `0c1d32d` (Rebrand to Arete, Jul 17) — `callClaudeGL` was present before but was wired up to new features here
- **Why this matters:** The Anthropic API key is stored in `localStorage('taskos_api_key')` and sent directly from the browser. Any XSS, devtools access, or malicious extension can steal it. The server-side proxy at `/api/claude.js` exists but is completely bypassed by `givelink.html`.

### 2. AI Sprint Planner calls invalid model `'claude-opus-4-5'`
- **File:** `givelink.html:1141`
- **Commit introduced:** pre-existing, visible in current HEAD
- **Why this matters:** Anthropic requires date-suffixed model IDs (`claude-opus-4-5-20251001`). Every click of "Generate" in the AI Sprint Planner returns a 400, making the feature dead on arrival.

### 3. sw.js push notification icon 404
- **File:** `sw.js:48–49`
- **Commit introduced:** `0c1d32d` or earlier — `icons/` subdirectory never existed
- **Why this matters:** All push notifications show a broken icon. File is `./icon-192.png`, not `./icons/icon-192.png`. Cosmetically breaks the feature for every notification recipient.

### 4. Nonprofit CRM delete button never renders
- **File:** `givelink.html:1380` inside `_showNPModal`
- **Commit introduced:** predates last 7 days, but surfaced as a regression risk from recent CRM work
- **Why this matters:** The modal HTML is created once. The delete button is templated with `${editNpId?...}` at creation time (always null for first open = "Add"). Result: nonprofits can never be deleted via UI.

---

## 🧹 Cleanup opportunities

### 5. `callClaudeGL` silently returns null on API errors
- **File:** `givelink.html:1269–1271`
- **Commit introduced:** pre-existing pattern, not changed in recent commits
- **Why this matters:** 401, 429, 503 all surface as "Check your API key" — a misleading message that sends users on a wild goose chase. The actual `data.error` object is never shown.

### 6. Canonical and OG URLs still point to Vercel staging hostname
- **File:** `landing.html:11,16–21`, `index.html:24–32`
- **Commit introduced:** `59abf2d` (Elevate landing page, Jul 18) — new OG tags added with staging URL
- **Why this matters:** `https://task-management-beige-eight.vercel.app/` is indexed by Google and shared on social. Every social share from the app advertises the staging URL. SEO credit goes to staging instead of production.

### 7. `pastSprints` archived data grows unbounded
- **File:** `givelink.html:828–848` (`confirmNewSprint`)
- **Commit introduced:** pre-existing
- **Why this matters:** No pruning or size check. After 10+ sprints, the full JSON blob can overflow mobile localStorage (~2MB limit on some browsers). Saves silently fail. Users lose data with no warning.

### 8. `seed()` guard is `S.seeded` only — localStorage wipe re-seeds
- **File:** `givelink.html:883–884`
- **Commit introduced:** pre-existing
- **Why this matters:** If a user clears site data (common for troubleshooting), the 100+ seeded tasks overwrite whatever they had saved. Should also check `S.tasks.length === 0`.

### 9. Three mismatched accent colors across the two products
- **File:** `givelink.html:17` (`#3b82f6`), `landing.html:48` (`#5a49e0`), `index.html:47` (`#8272f2`)
- **Commit introduced:** `72d9c68` (Brand consistency pass, Jul 17) — purged old-brand colors but left givelink.html blue
- **Why this matters:** The brand consistency commit missed `givelink.html`. The Sprint Board looks like a different product from Arete.

---

## 🤔 Worth a second look

### 10. `runAiSprintPlanner` calls Opus-class model for 10-task selection
- **File:** `givelink.html:1141`
- **Why it looks suspicious:** The standup generator and outreach generator both correctly use `claude-haiku-4-5-20251001` (cheap, fast). The sprint planner alone requests Opus. For structured JSON output (10 tasks from a list), Haiku is more than capable. Either this was intentional for quality, or it's a copy-paste mismatch. Worth an explicit decision.

### 11. `syncToTaskOS` title-matching could silently corrupt Task OS data
- **File:** `givelink.html:1220–1228`
- **Why it looks suspicious:** Matching tasks by `.toLowerCase()` title across two independent apps. With seeded task names like "Follow Up" or "Send reminders", any Task OS task with the same name gets marked done. No confirmation prompt, no dry-run, no rollback. Worth adding a `glId` stable key before the backlog grows further.

### 12. `sw.js:84` — HTML fetch strategy uses request mode `navigate` check but also `Accept: text/html`
- **File:** `sw.js:84`
- **Why it looks suspicious:** Both conditions are ORed: `e.request.mode === 'navigate' || e.request.headers.get('accept')?.includes('text/html')`. This is correct for most browsers but could match XHR requests that happen to send `Accept: text/html`. Probably fine, but worth a note if the app ever adds server-rendered partials.

### 13. `generateStandup` sets `yesterday` to `now - 2 days` at 6am
- **File:** `givelink.html:1487–1488`
- **Why it looks suspicious:** `yesterday.setDate(now.getDate()-2)` is intentionally `-2` not `-1`, plus it sets to 6am. The comment says this is to catch tasks completed "yesterday" generously. But tasks completed 48h ago will show as "yesterday" in standups — confusing if a task was marked done Sunday morning and shows up in Monday's standup as "yesterday" (Saturday). Worth validating the intent here.

---

_30-item cap enforced; items ranked by production-risk severity. Quality over quantity._
