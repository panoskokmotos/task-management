# Weekly Triage — 2026-05-25

## 📊 Week at a glance
- **Commits:** 3 | **Files changed:** 2 | **Debt markers added:** 0 (no TODO/FIXME/console.log introduced)
- **High-churn files:** `index.html` (3/3 commits), `sw.js` (3/3 commits) — only two files in the whole repo, both hit every commit
- **No test files exist.** All 3 commits shipped features/fixes with zero test coverage. The fix commit (`23e1e16`) patching mobile sidebar and broken task objects is a signal the feature pace is outrunning validation.
- **Volume concern:** `index.html` is a 789 KB / 11,595-line monolith. Round 8 alone added 2,174 lines and 20 new AI functions in one commit.

---

## 🚨 Needs immediate attention

**1. `S.leverageLog` name collision — two AI functions stomp each other's history**
- `index.html:10419` — `aiEudaimonia` writes `{type: undefined, aiAnalysis}` to `S.leverageLog`, capping history at **4** entries
- `index.html:10430` — `aiLeverageFinder` also writes to `S.leverageLog`, capping at **9** entries
- Introduced: `0e8dc99`
- Why it matters: Eudaimonia analyses silently purge Leverage Finder history (and vice versa). The two features share a log key by accident. One run of either function corrupts the other's data permanently.

**2. `aiAntiGoals` — `null` result rendered without guard, name hardcoded**
- `index.html:9895` — `esc(out)` is called where `out` is the raw return of `callClaude()`. `callClaude` returns `null` on API error (rate limit, wrong key). Calling `esc(null)` will render the literal string `"null"` in the UI.
- Same line: prompt hardcodes `"for Panos"` instead of using `getAboutMe()` — every other AI function uses the fallback pattern `getAboutMe() || 'Panos...'`. This one skips the check entirely.
- Introduced: `0e8dc99`
- Why it matters: Any user who hits a rate limit sees "null" rendered as their anti-goals. The hardcoded name breaks if the about-me field is filled in with a different name.

**3. Batch of 16 new AI functions save `null` to state on API failure**
- `index.html:10341–10343`, `10400–10402`, `10409–10411`, `10418–10420`, `10430–10432`, `10525–10530` (and more)
- Pattern: `const result = await callClaude(…); S.someLog = [...S.someLog.slice(-N), {aiAnalysis: result}]; save();`
- No null check between `callClaude` and `save()`.
- Introduced: `0e8dc99` (20 functions) and `c1facf8` (earlier batch)
- Why it matters: A failed API call silently persists `{aiAnalysis: null}` into localStorage. On next render, code that does `log.aiAnalysis` will get `null`, potentially breaking display logic or causing a later `esc(null)` render.

**4. XSS via task title in `onclick` attribute — incomplete escaping**
- `index.html:8808` — EOD step 2 quick-pick:
  ```js
  onclick="document.getElementById('eod-mit').value='${t.title.replace(/'/g, "\\'")}'"
  ```
  Only single-quotes are escaped. A task title containing `"` or `</div><img src=x onerror=alert(1)>` breaks out of the attribute or the HTML context.
- Introduced: prior to this week but still present in `0e8dc99`
- Why it matters: Since `S.tasks` is user-editable, a crafted task title achieves stored XSS. Low severity in a single-user local app; higher if the export/import flow lets someone share a poisoned task list.

**5. `aiSecurityAudit` writes to existing log entry without null guard**
- `index.html:10525` — when a prior audit log exists, it does `logs[logs.length-1].aiAnalysis = result` directly — even when `result` is `null`. Unlike most other AI functions which at least create a new entry, this overwrites the last good audit result with `null` on failure.
- Introduced: `0e8dc99`
- Why it matters: Security audit is the one log users are most likely to re-run on an unstable connection. A failed run silently destroys the previous analysis with no undo.

---

## 🧹 Cleanup opportunities

**6. `getAboutMe()` fallback string is inconsistent across the codebase (9+ variants)**
- Lines `3922`, `4036`, `4290`, `5285`, `5660`, `5948`, `7401`, `8969`, `9715` — each has a slightly different hardcoded Panos bio as the fallback string ("20s founder", "Greek founder", "B2B SaaS", "nonprofit fundraising SaaS")
- Introduced: accumulated across `c1facf8` and `0e8dc99`
- Why it matters: Claude gets inconsistent context depending on which feature triggers first. One authoritative constant would fix this.

**7. Magic number `86400000` (ms per day) used 12+ times, inconsistently written**
- Lines `2149`, `2362`, `3658`, `4399`, `4633`, `5626`, `5628`, `5978`, `6003`, `6312`, `6342`, `6361` — sometimes written as `86400000`, sometimes as `86400e3`, sometimes as `864e5`, sometimes as `1000*60*60*24`
- Introduced: accumulated across multiple commits
- Why it matters: Four spellings of the same constant — one source of truth (`const MS_PER_DAY = 86_400_000`) would make any off-by-one bugs obvious.

**8. Service worker cache key manually versioned — fragile**
- `sw.js:1` — `const CACHE = 'task-os-20260523b'`
- Introduced: `0e8dc99` (sw.js touched in all 3 commits this week)
- Why it matters: Developers have to remember to bump the date string on every deploy. Stale cache is hard to debug. A hash-based or build-time key would be safer.

**9. `renderView()` dispatch table silently ignores unknown views**
- `index.html:2182` — uses `[v]?.()` which swallows a missing render function with no warning. If a nav link points to a view not in the table, the page goes blank with no error.
- Introduced: `0e8dc99` (the dispatch table was significantly expanded)
- Why it matters: Round 8 added 10+ new views. One typo in a view name produces a silent blank screen.

**10. `aiSmartRoute` and `aiSuggestMentors` — no loading state visible to user**
- `index.html:10185` (`aiSmartRoute`), `index.html:10070` (`aiSuggestMentors`) — these functions call `callClaude()` (which can take 5–15 seconds) without setting any loading indicator before the await.
- Introduced: `0e8dc99`
- Why it matters: Users will click the button, see nothing happen, and click again — triggering duplicate API calls. The `_aiBtn` wrapper handles the button state, but there's no in-page feedback for where the result will appear.

---

## 🤔 Worth a second look

**11. Claude API key sent directly from browser with `anthropic-dangerous-direct-browser-access`**
- `index.html:3641` — the header name itself is Anthropic's signal that this is an unusual pattern. The key lives in `S.claudeKey` (localStorage).
- Introduced: prior commits, present throughout
- Why it matters: The key is exposed in browser devtools, exported in `exportFullJSON()`, and included in any bug report that includes localStorage. Acceptable for a personal tool; worth noting if Givelink ever goes multi-user.

**12. `renderCalendar()` has no error boundary — DOM element missing = silent failure**
- `index.html:10083–10088` — `renderCalendar` calls `_renderCalGrid()` which accesses `document.getElementById('cal-week-grid')`. If the calendar section HTML isn't rendered yet (e.g., race condition on first nav), the function fails silently.
- Introduced: `0e8dc99`
- Why it matters: All the other new render functions have `if(!el)return` guards. Calendar is the only one missing it.

**13. `_renderEodStep` / EOD step 2 — task titles rendered unescaped inside `<div>` body**
- `index.html:8808` — `${t.title}` in the visible div text (separate from the onclick value). The `esc()` function is used everywhere else in the file for display; this spot was missed.
- Introduced: prior to this week but still present
- Why it matters: Paired with item #4 above — same spot, two separate injection vectors.

**14. `aiLeverageFinder` and `aiAgentAudit` write to `S.leverageLog` — is this intentional?**
- `index.html:10430` (`aiLeverageFinder`) and check `aiAgentAudit` at `10433` — given the `aiEudaimonia` collision (item #1), worth verifying `aiAgentAudit` isn't also writing to the same key.
- Introduced: `0e8dc99`
- Why it matters: Three separate features sharing one log key means each one sees the other's history entries when it slices the array.

**15. `fixmobile` commit (`23e1e16`) patched "incomplete task objects" — root cause unclear**
- The fix commit message says "incomplete task objects" but no validation was added to `addTask()` or task creation paths to prevent future incomplete objects.
- Introduced: `23e1e16` (fix itself), root cause in earlier commit
- Why it matters: Without a schema check at creation time, the same bug can recur silently the next time a new task property is added.
