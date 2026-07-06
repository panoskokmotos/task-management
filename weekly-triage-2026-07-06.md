# Weekly Triage — 2026-07-06

## 📊 Week at a glance
- Commits: 13 | Files changed: 8 | Debt markers added: 0 (no TODO/FIXME/HACK found)
- High-churn files: **index.html** (11/13 commits), sw.js (2), manifest.json (2)
- Test commits: **0** — every commit was a feature or fix with no test coverage
- Service worker bumped manually twice this week (commits `42775fc`, `1fb177a`)

---

## 🚨 Needs immediate attention

**1. TDZ init bug was fixed but left a structural trap** — `index.html:9228`
- Commit `c32b2ef` fixed a temporal-dead-zone crash where `initReminders()` was called before `DEFAULT_REMINDERS` was declared, silently killing reminders, checklists, pull-to-refresh, and task completion.
- The fix was to move all boot calls to the very end of a 13,433-line file. There is no guard; anyone adding a call before line 9228 reintroduces the bug instantly, and there are no tests to catch it.

**2. Claude API key transmitted in plain sight from the browser** — `index.html:4392`
- `callClaude()` sends `x-api-key: S.claudeKey` directly from the browser with `anthropic-dangerous-direct-browser-access: true`. Any user can open DevTools → Network and copy the key. The key is also stored unencrypted in `localStorage` under the main state blob.
- Introduced in `acf71ac`. Acceptable for a personal tool; a serious risk if shared with others or demoed on a public machine.

**3. Window globals used as AI result state — clobbered by concurrent calls** — `index.html:9539, 10072, 10808, 10913, 11011`
- Five separate AI features store their results on `window._csvTasks`, `window._highlightTasks`, `window._blAiItems`, `window._wishAiItems`, `window._projAiItems`. If a user triggers two of these before the first resolves (or triggers the same one twice), the second call overwrites the first and the `onclick` handlers silently act on the wrong data.
- Pattern was present before this week but expanded with new AI features in `bdbb8cd`.

**4. Snooze modal bakes timestamps at render time, not at click time** — `index.html:3406`
- The `openSnooze` modal inlines `new Date(${d.getTime()})` into the `onclick` HTML at the moment the modal opens (commit `42c090d`). If the modal stays open across midnight, or the user opens it and doesn't click for hours, "Tomorrow 9am" resolves to a time in the past. `snoozeTask` does not validate that the target date is in the future before setting `snoozedUntil`.

**5. Zero automated tests across 13 feature commits** — repo-wide
- A TDZ crash shipped to production and was only caught in the same session it was introduced. No jest/vitest/playwright setup exists. New features this week: snooze picker, keyboard shortcuts (60+ bindings), life-area filter, reply-to-act, task drawer, mobile swipe gestures — all untested.

---

## 🧹 Cleanup opportunities

**6. Silent empty `catch` blocks swallow failures** — multiple
- `index.html:2602` — nav-collapse localStorage write fails silently (`catch(e){}`). Corrupt `taskos_nav_collapsed` would leave the sidebar in a wrong state with no user feedback.
- `index.html:2635` — `_stripH1Emoji()` wrapped in a bare catch; if the DOM isn't ready, fails silently and leaves H1 emoji visible.
- `index.html:2684` — draft-banner render fails silently; banner never shows.
- `index.html:3066` — `renderReview` wizard-restore fails silently; in-progress review draft is lost.
- `index.html:9190` — bare `catch(e){}` with no context at all. Commit `07213ad` area (Supabase sync).

**7. Hardcoded personal financial targets scattered in 4 places** — `index.html:3041, 4323, 4553, 5397`
- `25000` (annual income target) and `3600` (passive income target) appear as magic numbers in goal templates, dashboard rings, progress bars, and `_NS_TARGETS`. `_NS_TARGETS` also hardcodes `bodyfat:12, weight:75`. These should live in one config object or in user settings.
- Introduced progressively; `_NS_TARGETS` at line 5397 and the `targets` object at line 3041 are parallel copies that can drift apart.

**8. Splash screen hides on a fixed 2500ms timer regardless of load state** — `index.html:12294`
- `setTimeout(_hideSplash, 2500)` is a safety net, but it also runs unconditionally. On a slow connection the app might not have painted yet; on a fast PWA cache hit the 2500ms is dead UX time. The `requestAnimationFrame` path at line 12293 already handles the fast case — the 2500ms fallback should only fire if the rAF path hasn't run.
- Added in `1fb177a`.

**9. Service worker cache name requires a manual bump on every deploy** — `sw.js:1`
- `const CACHE = 'task-os-20260705'` is hand-edited. The fact that it had to be bumped twice this week (commits `42775fc` and `1fb177a`) shows this is already causing friction. A hash derived from the build or a CI-injected timestamp would remove the need to remember.

**10. `_gTimer` keyboard-prefix timer not cleared on navigation** — `index.html:3871`
- The Superhuman "g·" prefix key (commit `93d8c86`) sets `window._gTimer` with `clearTimeout` on repeat, but never clears it when the user navigates away. If the timer fires after navigation, `_gPending` remains `true`, which could misroute the next keypress in the new view.

---

## 🤔 Worth a second look

**11. `taskReply` fallback parses AI JSON with a regex, discards parse errors silently** — `index.html:8411`
- `act=JSON.parse((raw.match(/\{[\s\S]*\}/)||[])[0])` with `catch(e){}` means malformed AI output shows "Hmm — could not read that" with no logging. Fine for UX, but makes debugging AI response failures invisible. Added `bdbb8cd`.

**12. `window._snoozeId` race between touch-swipe and button tap** — `index.html:3397`
- `_snoozeId` is a module-level `let`. If a user taps a snooze button on task A while a swipe gesture on task B is still in flight (uncommon but possible on touch), the wrong task ID wins. The snooze modal re-renders on every `openSnooze` call so the displayed options are correct, but the `onclick` inline handlers close over `_snoozeId` by reference — they'll use whichever value is current at click time. In practice safe; worth knowing if the gesture handler is made async.

**13. `anthropic-dangerous-direct-browser-access` header signals a CSP bypass** — `index.html:4393`
- Anthropic requires this header for browser-side API calls to opt out of their CORS policy. The header is intentional. However, `vercel.json` `connect-src` only allows `api.anthropic.com` — if the API endpoint ever changes (e.g. `api2.anthropic.com`), calls will fail with an opaque CORS error that looks like a network error, not an API error. Worth pinning explicitly.

**14. Morning briefing silently returns stale cache on key rotate** — `index.html:10184`
- `_renderAIBriefing(d, el)` is called from a `try{const d=JSON.parse(cached)}catch(e){...}` block. If the user rotates their Claude key, the cached briefing from the old key will keep rendering until TTL expires or localStorage is cleared. No staleness indicator is shown. Added `bdbb8cd`.

**15. `_NS_TARGETS` and `targets` are parallel config objects that will drift** — `index.html:3041, 5397`
- `const _NS_TARGETS={...,income:25000,passive:3600}` (line 5397) and `const targets={income:25000,passive:3600}` inside `_renderWeekByGoal` (line 3041) are independent. If the user's income goal is updated in one, the other won't reflect it. Both should read from the same source (ideally `S.givelinkMetrics.impactModel` or a dedicated user-preference field).
