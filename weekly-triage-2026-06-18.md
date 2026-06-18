# Weekly Triage — 2026-06-18

## 📊 Week at a glance
- Commits: **0** (last 7 days) | Files changed: 0 | Debt markers added: 0
- High-churn files: `index.html` (4 of the last 5 commits touched only this file)
- Last activity: June 8 — four bug-fix commits in rapid succession (PRs #51–#54)

> No code was merged this week. The triage below targets the files from the most recent active week (June 8 commits) because that's what's actually in production today.

---

## 🚨 Needs immediate attention

### 1. Stored XSS via unescaped `t.title` in primary task card templates
**File**: `index.html:2694`, `3006`, `3014` | **Introduced**: core codebase (predates tracked commits)

`tcHTML()` and `inboxHTML()` inject `t.title` directly into `innerHTML`. The import flow (`importData`, line 2115) accepts arbitrary JSON, so a malicious shared backup file can run JS on load. The Claude API key (`S.claudeKey`) is reachable from that context.

The `esc()` function exists at line 9773 and is already used in `gsearch` (line 2346) and `ifThen` display (line 3016) — the fix is two characters per callsite. *See IMPROVEMENT_PLAN.md P0 item #1.*

---

### 2. `openAdd()` defaults to 'givelink' category — affects every new task
**File**: `index.html:3031` | **Introduced**: commit `1d3ea98` (PR #49, "North Star Cockpit + Givelink OS")

```js
document.getElementById('t-cat').value='givelink';
```

This fires every time a user creates a task — from the FAB, from `N` shortcut, from inbox capture. The 'givelink' default is correct only in Givelink-specific flows. Every personal task creation requires an extra interaction to switch categories.

---

### 3. Push notification icon path does not exist on disk
**File**: `sw.js:38–39` | **Introduced**: commit `67de902` (PR #50, Supabase cloud sync) or earlier

```js
icon:'./icons/icon-192.png',
badge:'./icons/icon-192.png',
```

No `/icons/` directory exists. Affects all users who have granted push permission (ntfy integration). On Android PWA the broken icon image shows as a grey square. *See IMPROVEMENT_PLAN.md P0 item #2.*

---

### 4. Unescaped `t.title` / `g.title` in Weekly Review wizard — committed in PR #48
**File**: `index.html:2888`, `2895`, `2897` | **Introduced**: commit `d3a28fb` (PR #48)

The `renderWizPanel` function added in PR #48 renders task and goal titles via template literals without `esc()` in steps 0, 2, and 3. PR #54 fixed a display bug (`w.text||w.title`) in the wins view but left these XSS surfaces untouched.

---

## 🧹 Cleanup opportunities

### 5. Hardcoded financial targets non-configurable
**File**: `index.html:2852`, `4299`, `5139` | **Pattern**: magic numbers

```js
const targets={income:25000,passive:3600};
```
Appears three times; one also has a hardcoded label "goal: €25K" in the rendered HTML. These are personal income targets for one user embedded as constants. Should be `S.financeTargets` in state with a settings UI. *See IMPROVEMENT_PLAN.md P1 item #10.*

---

### 6. Service worker cache key last bumped 2026-05-30 — hasn't been updated for June deploys
**File**: `sw.js:1` | **Deployed**: at least with commit `67de902` (May 29)

```js
const CACHE = 'task-os-20260530';
```
Four commits landed June 8 with no corresponding SW cache bump. PWA-installed users who haven't cleared storage are running the May 30 cached HTML against the June 8 JS. The `vercel.json` no-cache headers mitigate this for browser users but not for home-screen installs.

---

### 7. `renderView()` no-ops silently on unknown view names
**File**: `index.html:2456` | **Pattern**: silent failure

With 40+ registered views, a nav link typo shows a blank screen. A one-line guard (`console.warn` + `toast`) would surface this immediately in development. *See IMPROVEMENT_PLAN.md P2 item #13.*

---

### 8. Claude API key serialized into every export
**File**: `index.html:2108–2162` | **Pattern**: secret leakage

Both `exportData()` and `exportFullJSON()` serialize `S` in full. `S.claudeKey` is in `S`. The Supabase sync also writes the full `S` to the remote database, meaning the API key is stored server-side in the `data` JSONB column. *See IMPROVEMENT_PLAN.md P1 item #6 and P2 item #16.*

---

## 🤔 Worth a second look

### 9. Four bug-fix commits in one day (June 8) signals instability
**Commits**: `eeb9b8f`, `70d4241`, `7b27281`, `0b54845` — all on June 8, all fixing bugs

The pattern (four fixes in rapid succession, all to one file) suggests features are being shipped without manual QA on the primary flows. PR #54's fix message lists: backdrop close stuck, ladder crash on null discomfortLogs, wins showing blank title from field name mismatch. These are three independent surfaces that weren't caught before merge.

*Why it matters*: The bugs were caught quickly, but the fix cadence suggests the next batch of features (PR #49 added 1,300+ lines) will also land with residual issues. A smoke-test checklist for the five most-used flows (capture, daily dashboard, weekly review, habit check-in, Givelink dash) before each merge would break the cycle.

---

### 10. Givelink CRM kanban: 6-column grid with no mobile responsive override
**File**: `givelink.html:197` | **Pattern**: mobile layout gap

`.crm-kanban{grid-template-columns:repeat(6,1fr)}` — the mobile media query (lines 155–175) handles sidebar, modals, and pillar cards but not the CRM kanban. On a 375px screen, each column is ~43px wide. This view is completely unusable on mobile. *See IMPROVEMENT_PLAN.md P0 item #4.*

---

### 11. `dashWidgetOrder` in state references `'daily-picks'` — no widget by that ID is rendered
**File**: `index.html:2036`

The default `dashWidgetOrder` array includes `'daily-picks'` but the dashboard render function doesn't appear to have a section with that exact ID. If the widget ordering logic skips unknown IDs, users who haven't customized their dashboard may be missing a widget silently.

*Why this matters*: This is the type of silent breakage that would only be caught by a user noticing a widget is gone — hard to trace back to the ordering array.

---

### 12. `givelink.html` uses `#3b82f6` (blue) for all brand accent points — off-brand
**File**: `givelink.html:6`, `17`, `manifest-givelink.json`

The Givelink product brand palette is purple/pink. The entire sprint board renders in generic blue. All interactive elements, active states, sprint names, and the PWA chrome (Android browser bar) display in Tailwind blue-500. *See IMPROVEMENT_PLAN.md P1 item #5.*

---

*13 items total — all sourced from files touched in the last active week or in active production.*
