# Weekly Triage — 2026-08-11

## 📊 Week at a glance
- **Commits this week:** 0 (last commit: `b38d4bb` on 2026-07-22 — 20 days ago)
- **Files changed this week:** 0
- **Debt markers added:** N/A (no new code shipped)
- **High-churn files:** N/A — no churn this week
- **Status:** Repository has been quiet for nearly 3 weeks. No active development detected.

---

> _Because there were zero commits in the past 7 days, the automated debt scan was run against the most-recent working state of the repo instead of diff-only. Items below represent pre-existing technical debt in the current codebase that would affect the next shipping cycle._

---

## 🚨 Needs immediate attention

### 1. SW push notification icons point to non-existent path
**File:** `sw.js:46–47`, `index.html:11289`
**Commit introduced:** `0c1d32d` (Rebrand to Arete — 2026-07-17) — icon paths were changed but `./icons/` subdirectory was never created.
**Why this matters:** Every push notification silently shows no icon. On iOS this causes the notification to render incorrectly; on some Android OEMs it causes the notification to be silently dropped. This breaks the primary retention mechanism (reminders).

### 2. XSS via raw `t.title` in `innerHTML` — multiple sites
**Files:** `index.html:3223`, `3594`, `3601`, `3844`
**Commit introduced:** Pre-existing across multiple PRs; `3844` (the toast case) was introduced in `f883adf` (PLG Tier 1 — 2026-07-17).
**Why this matters:** A task titled `<script>…</script>` or `<img onerror=…>` executes in the user's browser. Since tasks sync to Supabase, a malicious task title could affect every device the user is signed into.

### 3. AI proxy (`/api/claude`) is not wired into the app
**File:** `index.html:9959`
**Commit introduced:** `b38d4bb` (Landing growth — 2026-07-22) — the proxy endpoint exists and is deployed, but `aiProxy` was never set.
**Why this matters:** Every AI button in the product hits a dead end for users who haven't manually added a Claude API key in Settings. The core differentiating feature is effectively disabled.

---

## 🧹 Cleanup opportunities

### 4. 20+ AI prompts hardcode "Panos" / "Givelink" / "SF move"
**Files:** `index.html:5647`, `7849`, `8604`, `9806`, `11254`, `11672`, `11810` (and ~13 others)
**Commit introduced:** Scattered across `0c1d32d`, `f883adf`, `7c260f5` (Onboarding / PLG / AI additions in July)
**Why this matters:** The `profileName` variable and `getAboutMe()` function exist for exactly this purpose but weren't applied consistently. Any user who isn't "Panos" receives AI coaching tailored to a Greek founder's startup — jarring and trust-breaking.

### 5. Default `profileName` fallback is "Panos"
**File:** `index.html:2519`
**Commit introduced:** `0c1d32d`
**Why this matters:** New users who skip the name-setting step see "Good morning, Panos 👋" in the dashboard header. Should be a neutral fallback (`'there'` or similar).

### 6. Seed data contains ~80 owner-specific backlog tasks
**File:** `index.html:4546–4900`
**Commit introduced:** Accumulated across multiple commits; Givelink/nonprofit tasks date back to at least `f883adf`.
**Why this matters:** New users who trigger seeding get "Greek Nonprofits Board (Make-A-Wish etc)" and "Song on Givelink" in their task list. This is the first experience of the product for any real user — it needs to be generic getting-started tasks.

### 7. `manifest-givelink.json` still cached by service worker
**File:** `sw.js:4, 16`
**Commit introduced:** `0c1d32d` (rebrand) — the old manifest was not removed from the cache list.
**Why this matters:** The SW fetches and caches this file on every install. If the file still reads "Givelink" it can confuse PWA installations. Also wastes a cache slot on an artifact that no current flow uses.

### 8. Stale `givelink` task category visible to users
**File:** `index.html:2503`
**Commit introduced:** Pre-rebrand; not cleaned up in `72d9c68` (Brand consistency commit).
**Why this matters:** The category picker shows "🟣 Givelink" as a first-class option to all users. Meaningless for anyone who isn't the owner.

---

## 🤔 Worth a second look

### 9. `toast()` renders arbitrary HTML — latent injection
**File:** `index.html:2789`
**Why suspicious:** The function always uses `el.innerHTML=msg`. Most callers pass safe strings or template literals. But callers at lines `3844`, `3893`, `3896` pass user-controlled content. The pattern is dangerous because future callers will assume it's safe (since it works today) and pass raw user data without escaping.

### 10. No rate limiting on Claude proxy
**File:** `api/claude.js:12`
**Why suspicious:** The comment explicitly says "add per-user rate limiting" but this is acknowledged and not implemented. Not a regression from this week, but worth tracking as a pre-ship requirement if the app gets any real traffic. A single automated script hitting `/api/claude` can run up the Anthropic bill without bound.

### 11. `_sbAuth()` called without error handling in the sign-up flow
**File:** `index.html:10081–10086`
**Why suspicious:** The sign-up path calls `_sbAuth('password', …)` after a separate sign-up fetch. If the sign-up succeeds but `_sbAuth` fails, the user account exists but is not logged in, with no clear error surfaced. The `catch(e)` at line 10039 covers the outer try, but the inner sign-up + re-auth sequence has two failure modes that produce the same "Sign-in/up failed" message.

---

_Triage complete. No code was changed this week — all items are pre-existing. Next action: address P0 items from `IMPROVEMENT_PLAN.md` before shipping the next feature._
