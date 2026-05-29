# Weekly Triage — 2026-05-29

## 📊 Week at a glance

- **Commits:** 7 | **Files changed:** 13 (touches, not unique) | **Debt markers added:** 12 (7 `console.warn`, 5 empty `catch` blocks)
- **High-churn files:** `index.html` (6 commits), `sw.js` (4 commits), `icon.svg` (1 commit)
- **Pattern:** Rapid-fire UX polish sprints (#38–#44) — all touching the same monolith. No test commits. No rollback commits. One "round 8" iteration commit from earlier in the week.

---

## 🚨 Needs immediate attention

### 1. Five new empty `catch(e){}` blocks swallow real errors silently
- **File:line**: `index.html` — `_toggleNsGroup()` localStorage catch, `renderReview()` draft-restore catch, `_haptic()` vibrate catch, `taskos_nav_collapsed` init catch, and one in the Smart Reschedule flow.
- **Commit**: `9be1edd` and `5e4518b`
- **Why this matters**: When localStorage is corrupted or full, sidebar state, weekly review draft progress, and reschedule preferences all vanish silently. The user sees broken behavior with no error message and no way to diagnose.

### 2. Smart Reschedule swipe gesture (`5e4518b`) has no fallback for non-touch devices
- **File:line**: `index.html` — Smart Reschedule date-pill section (lines near the new `_rescheduleSwipe` handlers)
- **Commit**: `5e4518b`
- **Why this matters**: If the swipe spring-back animation relies on `touchstart`/`touchend` without a pointer-events fallback, desktop users who drag with mouse or use keyboard cannot trigger the date-sheet. The feature silently doesn't exist for them.

### 3. No AbortController on any fetch call — week's new AI features inherit the risk
- **File:line**: `index.html:2090` (Claude), `index.html:6305` (Readwise), `index.html:6416` (Notion), `index.html:6801` (ntfy)
- **Commit**: Inherited; no new fetch calls added a timeout this week either.
- **Why this matters**: Commits `cc36c6f`–`5e4518b` added AI-powered features (morning briefing, notes synthesis) that make additional outbound calls. All of them inherit the hang-forever bug. Each new AI feature adds one more path that can freeze the UI.

### 4. SW cache name is still `task-os-20260530` — today is 2026-05-29
- **File:line**: `sw.js:1`
- **Commit**: `dd16e0c` (changed SW), likely originally `0e8dc99`
- **Why this matters**: The cache name is dated one day in the future and will not change on the next deploy, meaning users on commit `5e4518b`'s new JS may continue being served `dd16e0c`'s cached HTML. Reschedule UI and completion animations from this week may not reach returning users.

### 5. `renderReview()` restores wizard step from localStorage but catches parse errors silently
- **File:line**: `index.html` — `renderReview()` function
- **Commit**: `9be1edd`
- **Why this matters**: If `taskos_wiz_draft` in localStorage is malformed (e.g., partial write from a quota error mid-save), `JSON.parse` throws and the catch silently resets the review wizard to step 0. The user loses their in-progress weekly review with no warning.

---

## 🧹 Cleanup opportunities

### 6. `console.warn('theme media listener', e)` — always-on debug log
- **File:line**: `index.html:64`
- **Commit**: Pre-existing, but 6 more `console.warn` calls added in `9be1edd`–`5e4518b`
- **What they likely meant**: Temporary debugging during development of dark/light theme toggle. Safe to remove or gate behind `localStorage.getItem('taskos_debug')`.

### 7. `console.warn('_wizSave error', e)` — leaks internal function name
- **File:line**: `index.html` — `_wizSave()` function
- **Commit**: `9be1edd`
- **What they likely meant**: Error tracing during Weekly Review wizard development. Replace with the shared gated logger described in the improvement plan.

### 8. `console.warn('fab action', e)` — FAB error logging is too broad
- **File:line**: `index.html` — `_fabDo()` function
- **Commit**: `cc36c6f`
- **What they likely meant**: Catch-all for any FAB action callback failure. The catch masks the real error from the actual FAB action function. Better to let it propagate.

### 9. `console.warn('Notification failed:', e)` — redundant with ntfy failure log
- **File:line**: `index.html` — push notification handler
- **Commit**: `dd16e0c`
- **What they likely meant**: Debugging push notification delivery. Safe to remove; the ntfy failure already has its own warning.

### 10. `console.warn('Morning briefing cache error:', e)` and `'Notes synthesis parse failed:'`
- **File:line**: `index.html` — morning briefing and notes synthesis functions
- **Commit**: `9be1edd`
- **What they likely meant**: Parse-error debugging for AI response JSON extraction. Both should gate on `taskos_debug` or be removed — the `toast()` already notifies the user.

### 11. Commented-out swipe logic remnant in completion fly-out
- **File:line**: `index.html` — completion animation section (from `7c34fc8`)
- **Commit**: `7c34fc8`
- **What they likely meant**: An earlier swipe approach replaced by the spring-back implementation in `5e4518b`. The old code is dead weight.

---

## 🤔 Worth a second look

### 12. Brand identity commit (`dd16e0c`) updated `sw.js` — but only changed 2 lines
- **File:line**: `sw.js` (2 lines changed)
- **Commit**: `dd16e0c`
- **Why it looks suspicious**: A "brand identity" commit touching the Service Worker is unusual. The change may have been a cache-name bump or a push-notification payload tweak — both are easy to get wrong. Verify the SW still handles install/activate/fetch correctly after this change, and that the cache-busting strategy is intentional.

### 13. `World-class UX tier 3` commit (`9be1edd`) adds "NL dates" — natural language date parsing
- **File:line**: `index.html` — task creation and quick-add inputs
- **Commit**: `9be1edd`
- **Why it looks suspicious**: NL date parsing is notoriously edge-case-heavy (timezone handling, locale, "next Monday" semantics). No test commit followed this feature. Manual QA on "next week", "in 3 days", "tomorrow morning" across timezones is strongly recommended before relying on it for scheduled tasks.

### 14. `_haptic(pattern=12)` wraps `navigator.vibrate` in a `try/catch` with no body
- **File:line**: `index.html` — `_haptic()` function
- **Commit**: `9be1edd`
- **Why it looks suspicious**: The `try/catch` catches and discards any exception from `navigator.vibrate`, including `SecurityError` in secure contexts where vibration is blocked by permissions policy. This is probably fine for haptics — but the pattern (silent catch) was copy-pasted into the more critical localStorage and review-restore functions where it is not fine.

### 15. `icon.svg` replaced in `dd16e0c` — old SVG had 31 lines changed
- **File:line**: `icon.svg`
- **Commit**: `dd16e0c`
- **Why it looks suspicious**: A new SVG icon in a PWA affects the home screen icon, splash screen, and favicon. Verify `manifest.json` still references the correct icon paths and that the new SVG renders correctly at 192×192 and 512×512 (the sizes required for PWA install banners).
