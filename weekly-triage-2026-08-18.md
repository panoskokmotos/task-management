# Weekly Triage — 2026-08-18

## 📊 Week at a glance
- **Commits this week**: 0 (last commit was b38d4bb — see note below)
- **Files changed this week**: 0
- **Debt markers added this week**: N/A (no new code)
- **High-churn files**: None this week

> **Note**: No commits landed in the 7 days prior to 2026-08-18. The items below come from a fresh audit of the current codebase. The last active development burst was the PLG/landing/rebrand push (commits #74–#83), which touched `landing.html`, `index.html`, `givelink.html`, and `sw.js`. This triage focuses on residue from that burst.

---

## 🚨 Needs immediate attention

### 1. SVG burndown chart renders literal "false"
- **File**: `givelink.html:771`
- **Commit**: b38d4bb (burndown was added in an earlier commit; the bug survived the landing push)
- **Why this matters**: Every new sprint user sees `false` text painted into the SVG burndown chart immediately on the Overview page — visible corruption on the first screen they land on

### 2. `yesterday` in standup is actually 2 days ago
- **File**: `givelink.html:1488`
- **Commit**: present in codebase prior to the rebrand push; not fixed in #80
- **Why this matters**: `setDate(now.getDate()-2)` — "completed yesterday" tasks are never found. The AI standup reports 0 completed tasks even on an active sprint. Panos notices this every morning.

### 3. Push notification icon references non-existent `./icons/` directory
- **File**: `sw.js:46-47` (`icon:'./icons/icon-192.png'`)
- **Commit**: icon path has never matched — `STATIC` array on `sw.js:6` uses `'./icon-192.png'`
- **Why this matters**: Push notifications silently fail to render an icon on Android; on iOS the notification may not show at all in some configurations

### 4. `window.prompt()` / `window.confirm()` blocked in Safari standalone PWA mode
- **Files**: `givelink.html:732, 1086, 1261, 1424, 1433`
- **Commit**: These patterns were in place before the rebrand push; the PWA manifest for givelink was present since early sprints
- **Why this matters**: On iOS (the primary mobile target), `window.prompt()` and `window.confirm()` return `null`/`false` immediately when the app is running in standalone (Add to Home Screen) mode. AI features and delete actions are completely broken for iPhone users in PWA mode.

---

## 🧹 Cleanup opportunities

### 5. PostHog key left blank on landing page
- **File**: `landing.html:702` — `var POSTHOG_KEY = '';`
- **Commit**: b38d4bb "Landing growth: analytics, SEO foundation, and comparison table"
- **Why this matters**: This commit's entire purpose was adding analytics, but the key was never pasted in. All the `track()` calls are no-ops. The PR shipped broken analytics.

### 6. Canonical URL still points to Vercel preview domain
- **File**: `landing.html:11` — `https://task-management-beige-eight.vercel.app/`
- **Commit**: b38d4bb (added in the SEO push)
- **Why this matters**: Google is being told the canonical URL is the preview deployment. Any custom domain added later will split SEO equity until this is corrected and Google re-crawls.

### 7. Duplicated Anthropic API fetch — two independent implementations
- **Files**: `givelink.html:1131-1144` (`runAiSprintPlanner`) and `givelink.html:1264-1272` (`callClaudeGL`)
- **Commit**: `callClaudeGL` was added in an earlier commit; `runAiSprintPlanner` predates it and was never refactored to use the shared utility
- **Why this matters**: Sprint Planner uses `claude-opus-4-5` directly from the browser (not the proxy, not Haiku). This is ~15× more expensive per call than the Haiku model used everywhere else. Also exposes the key in a second code path.

### 8. `_text` stored on DOM node — fragile clipboard
- **Files**: `givelink.html:1519` (`body._text=text`), `givelink.html:1621` (`body._text=np.outreachDraft`)
- **Commit**: standup and outreach features added in commits before #76
- **Why this matters**: If the modal HTML is ever re-rendered (e.g., closing and reopening), the `_text` property is silently lost and `copyStandup()` pastes raw `textContent` with extra whitespace.

### 9. `seedNonprofits()` re-seeds if user deletes all entries
- **File**: `givelink.html:1281` — `if((S.nonprofits||[]).length)return;`
- **Commit**: CRM feature added in the PLG sprint push
- **Why this matters**: A user who clears their CRM to start fresh will have the 6 seed orgs reappear on the next CRM view. This is particularly jarring since the seed data includes real org names.

### 10. Service worker cache key is a hardcoded date — must be manually bumped
- **File**: `sw.js:1` — `const CACHE = 'arete-20260723';`
- **Commit**: sw.js was last touched in the rebrand push; the date was set to 20260723
- **Why this matters**: If a deploy ships without updating this string, all users stay on stale cached HTML until a hard refresh. The update banner requires the new SW to activate, which requires the cache key to differ. This is easy to forget.

---

## 🤔 Worth a second look

### 11. `advanceStageNP()` calls `calcTotalImpact()` before and after stage change — but `prevPeople` is captured before `save()`
- **File**: `givelink.html:1446-1453`
- **Why**: The milestone check compares pre- and post-advancement impact. If `save()` fails (e.g., `localStorage` quota exceeded), the stage is already mutated in memory and the milestone toast fires, but the data isn't persisted. On reload the org reverts to the previous stage but the milestone was already celebrated. Unlikely but possible if the user has a lot of data.

### 12. Guest-mode localStorage redirect in `landing.html` could loop
- **File**: `landing.html:37` — `if(localStorage.getItem('taskos_sb_refresh') || localStorage.getItem('taskos_guest')==='1'){ location.replace('/index.html'+s+h); return; }`
- **Why**: If `index.html` errors out and redirects back to `/` (e.g., Supabase misconfiguration), and `taskos_guest` is still set, the user is caught in an infinite redirect loop with no way out except clearing storage. Worth adding an error-fallback path in `index.html` that clears the guest flag before redirecting to landing.

### 13. `runAiSprintPlanner` sends backlog data (potentially sensitive) directly to Anthropic from the browser
- **File**: `givelink.html:1112-1128`
- **Why**: The prompt includes raw task titles from the backlog. If any task title contains a customer name, financial figure, or personal note (several seed tasks have names like "Pay Gerald", "O1 Application", "Fanos Meeting"), this goes directly to Anthropic's API without proxy or scrubbing. Not necessarily a problem, but worth a conscious decision about what data is sent.
