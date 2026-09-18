# Weekly Triage — 2026-09-18

## 📊 Week at a glance

- **Commits:** 2 | **Files changed:** 3 | **Debt markers added:** 0 (none found via TODO/FIXME scan)
- **High-churn files this week:** `givelink.html` (96 line delta), `index.html` (14 line delta), `.github/workflows/supabase-keepalive.yml` (new)

---

## 🚨 Needs immediate attention

### 1. SW update banner fix from givelink was not ported to `index.html`

**File:line:** `index.html:10697`
**Commit:** `72e03fe` (the fix was applied to `givelink.html:1799` in the same commit, but `index.html` was not updated)
**What it does:** `index.html` still uses `nw.state==='activated'` while the commit message for `72e03fe` explicitly documents "SW update banner: use 'installed' state instead of 'activated' so banner fires reliably". Because `sw.js` calls `self.skipWaiting()` on install, the `activated` event fires in the new SW context after `clients.claim()` — by then the tab is already controlled by the new worker and the banner fires in a stale/already-replaced page. Users never see it.

**Why it matters:** The main app (index.html) serves the vast majority of user traffic. All users on a cached build will silently miss updates.

---

### 2. `givelink.html` makes direct Anthropic API calls from the browser with a stored key

**File:line:** `givelink.html:1200-1213` (`runAiSprintPlanner`), `givelink.html:1332-1340` (`callClaudeGL`)
**Commit:** present before this week; not changed in 72e03fe but the new AI Sprint Planner feature added in this sprint actively uses the direct-call path
**What it does:** Both functions call `https://api.anthropic.com/v1/messages` directly, using a key from `localStorage`. `runAiSprintPlanner` uses `claude-opus-4-5` (the most expensive model) without any cost cap.

**Why it matters:** Any XSS or browser extension can steal the key from localStorage. Model choice amplifies cost risk.

---

### 3. `callClaudeGL` swallows non-OK API responses silently

**File:line:** `givelink.html:1332-1341`
**Commit:** present in current codebase, unchanged in 72e03fe
**What it does:** On HTTP errors (429, 401, 500), `callClaudeGL` calls `res.json()` on the error body, then returns `null` with no `if(!res.ok)` guard and no user-facing toast. Callers receive `null` and silently fail.
**Why it matters:** If the API key expires or rate-limits hit, AI features in givelink fail invisibly — the user sees nothing, not even an error message.

---

### 4. `syncToTaskOS` silently fails for single-profile users

**File:line:** `givelink.html:1276-1280`
**Commit:** unchanged in 72e03fe, but the new "This Week" view added this week surfaces the sprint bar where "Sync to Task OS" is prominently visible, increasing exposure
**What it does:** Reads `taskos_profiles` localStorage key; if empty (single-profile users), shows "No Task OS profile found" toast and returns. The single-profile key is `taskos` (not `taskos_profiles`).
**Why it matters:** The sync button is in the main sprint header — visible on every page load. Most users will hit it and see a dead toast.

---

## 🧹 Cleanup opportunities

### 5. Inline `if(window.innerWidth<600)` grid patch in `renderWeekPlan`

**File:line:** `givelink.html:682-685`
**Commit:** `72e03fe` (new code, this week)
**What it is:** A one-time `window.innerWidth` check at render time that tries to patch a 7-column grid to 2-column on mobile. The check doesn't re-run on resize or orientation change.
**Why it matters:** The new This Week view is broken on mobile portrait. Should be a CSS media query, not JS.

---

### 6. Seed data in `givelink.html` contains real org names and personal notes

**File:line:** `givelink.html:951-990` (seed function)
**Commit:** predates this week but unchanged
**What it is:** Seed tasks include real nonprofit names, assignee names ("Panos", "Fanos"), and internal notes like "Meeting with immigration specialist completed — next steps cleared", "O1 Application under legal processing".
**Why it matters:** This data is visible to any user who loads givelink.html fresh and has never seeded data. It leaks internal business context publicly.

---

### 7. `APP_CONFIG.aiProxy` is empty string — AI is broken for all new users

**File:line:** `index.html:9959`
**Commit:** unchanged this week; the AI proxy in `api/claude.js` exists and was touched in earlier commits but is never wired up
**What it is:** `aiProxy: ''` means `!!APP_CONFIG.aiProxy` is falsy, so all AI flows fall back to requiring a personal Claude API key. New users hitting "Plan my day" immediately get a dead toast.
**Why it matters:** AI is the primary activation hook and differentiation. It is effectively disabled for all new users.

---

### 8. SW push notification icon path mismatch

**File:line:** `sw.js:44-45`
**Commit:** predates this week; no push notification was sent to expose it
**What it is:** `./icons/icon-192.png` path (with `icons/` subdirectory) doesn't exist; the correct path is `./icon-192.png`.
**Why it matters:** All push notifications will render with a broken icon. Low severity until push is actively used.

---

## 🤔 Worth a second look

### 9. `sbSyncNow` last-writer-wins with full state overwrite

**File:line:** `index.html:10412-10455`
**Commit:** predates this week; not touched
**What it looks like:** `if(remote.ms > localMs)` → full overwrite of S with remote data. If a user adds tasks offline on device A, then device B syncs, then device A reconnects, device A's tasks are silently lost.
**Why it matters:** Could look like a data loss bug in production if users work offline on multiple devices. The behavior is intentional (last-write-wins), but the implementation has no per-record granularity.

---

### 10. `givelink.html` `runAiSprintPlanner` uses `claude-opus-4-5` (most expensive model)

**File:line:** `givelink.html:1209`
**Commit:** predates this week (present before 72e03fe)
**What it looks like:** `model:'claude-opus-4-5'` for a sprint planning prompt that takes max 1024 tokens. Opus is 15× the per-token cost of Haiku.
**Why it matters:** Once the API proxy is wired up, every sprint planner run will be significantly more expensive than necessary. Haiku handles structured JSON extraction at this scale equally well.

---

### 11. `canary` check in `landing.html` router: `taskos_guest==='1'` skips landing for all guest users

**File:line:** `landing.html:36`
**Commit:** predates this week
**What it looks like:** Anyone who tried the app in guest mode is immediately bounced to `index.html`, even on a different device or a fresh referral. The referral/PLG share links (from commit 32e7288) are designed to bring users to the landing — but they won't land there if the viewer has ever been a guest.
**Why it matters:** Referral conversion from existing-guest users goes to zero. May be intentional, but it's worth validating with PostHog (once #8 in the improvement plan is addressed).
