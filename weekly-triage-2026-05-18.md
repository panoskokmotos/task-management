# Weekly Triage — 2026-05-18

## 📊 Week at a glance
- Commits: 9 | Files changed: 4 | Debt markers found: 14
- High-churn files: `index.html` (8 commits), `sw.js` (4 commits), `givelink.html` (1 commit)
- Zero test files exist in the repo — all 8 feature commits landed with no test coverage

---

## 🚨 Needs immediate attention

**1. Orphaned localStorage key makes AI briefing silently skip**
`index.html:7209` — commit `76d794a`
```js
if(!S.claudeKey&&!localStorage.getItem('taskos_api_key'))return;
```
`taskos_api_key` is never written anywhere in the codebase. The app stores the key in `S.claudeKey` (persisted inside the `taskos` blob). If `S.claudeKey` is somehow falsy (e.g. after a state reset), the fallback lookup always returns null and the briefing silently aborts with no feedback. Either remove the dead `taskos_api_key` branch or wire it up.

**2. AI prompts hardcode "Panos" — Settings name is ignored**
`index.html:7211`, `6954`, `7055`, `7063`, `7273` — commits `76d794a`, `ffe5e4a`
```js
const prompt=`You are the personal chief-of-staff for Panos, founder of Givelink...`
```
`profileName` is the variable that reflects the user's configured name, but every AI prompt bypasses it with a literal string. A user who changes their name in Settings still gets briefings addressed to "Panos". Five separate prompts need this fix.

**3. Default reminder message hardcodes personal name**
`index.html:6793` — commit `32788b1`
```js
{msg:'Good morning Panos! Check your One Thing and start focused work.'}
```
This is the seeded default reminder that fires at 08:00 daily. Any new-user seed will push this message unchanged. Should use `profileName` or a generic fallback.

**4. Model ID hardcoded as inline string — no single place to update**
`index.html:3402` — commit `5b82b20`
```js
body:JSON.stringify({model:'claude-haiku-4-5-20251001',...})
```
`callClaude()` is the single AI entry point used by all 20+ AI features, but the model string is baked in with no constant. Upgrading the model requires a grep-and-replace rather than a one-line config change.

**5. `94fca67` "Fix JS syntax error breaking app on all devices" — what broke it?**
`index.html` — commit `94fca67`
A hotfix mid-week suggests a bad deploy reached production. There's no guard (lint, CI, syntax check) preventing a repeat. The app is 8,592 lines of minified JS in one HTML file — even a small typo breaks everything silently.

---

## 🧹 Cleanup opportunities

**6. Silent catch swallows Notification API errors in reminder loop**
`index.html:6830` — commit `32788b1`
```js
}catch(e){}
```
The surrounding `try` fires `new Notification(...)`. On browsers where the Notification API is unavailable or permission is denied, the error is eaten with no log. At minimum, log to console so failures are diagnosable.

**7. Two more silent catches in AI briefing cache path**
`index.html:6975`, `7203` — commit `76d794a`
```js
try{const json=text.match(/\{[\s\S]*\}/)?.[0];parsed=json?JSON.parse(json):null;}catch(e){}
try{const d=JSON.parse(cached);_renderAIBriefing(d,el);}catch(e){}
```
A malformed cache entry at 7203 will silently not render the briefing; the user sees a blank widget with no explanation. Log or clear the bad cache entry.

**8. Two silent catches around ntfy push notifications**
`index.html:6852`, `6874` — commit `32788b1`
```js
try{await _ntfyPost(...);}catch(_){}
}catch(_){}
```
Push notification failures (network down, bad topic, ntfy rate-limit) are swallowed. If the user set up ntfy and reminders stop firing, there's no indication why.

**9. Seeded tasks contain personal Greek-language to-dos**
`index.html:2936–2992` — commit `32788b1`
```js
mk('Ακτινογραφία στα γόνατα','this-week','health',...)
mk('Πνευμολογικές εξετάσεις','this-week','health',...)
mk('245€ in investments from seminaria...')
```
Personal medical appointments and financial notes are seeded as default tasks. Any new user who triggers the seed flow gets Panos's personal agenda. Separate personal seed data from demo/default seed data.

**10. `S.claudeKey` stored inside the main state blob — exported in JSON**
`index.html:1707` — commits `32788b1`, `ffe5e4a`
The API key lives inside `S` (the global state object) which is what the export/import feature serialises. An exported JSON file contains the Claude API key in plaintext. Consider stripping secrets from export payloads.

---

## 🤔 Worth a second look

**11. Service worker cache version is a hardcoded date string**
`sw.js:1` — commit `ffe5e4a`
```js
const CACHE = 'task-os-20260516';
```
Cache-busting requires a manual edit to sw.js on every deploy. If forgotten, returning users get stale HTML from the old cache. Tie this to a build step or the app version instead.

**12. Readwise pagination strips query params but not host — fragile split**
`index.html:6406` — commit `c7078ee`
```js
url='/highlights/?'+data.next.split('?')[1];
```
`data.next` from Readwise is the full absolute URL. The split assumes exactly one `?`; if Readwise ever encodes a `?` inside a param value, `split('?')[1]` silently drops data. Use `new URL(data.next).search` instead.

**13. AI briefing prompt leaks user's full context to the model every load**
`index.html:7211–7240` — commit `76d794a`
The briefing prompt sends top tasks, goal names, people names, habit completion, finance data, and due dates to the Claude API in plaintext on every dashboard load. No indication in the UI that this data is being transmitted — worth a privacy notice or an explicit opt-in.

**14. `initQuickCapture()` is an empty stub**
`index.html:6303` — commit `32788b1`
```js
function initQuickCapture(){} // bar already in HTML, no extra setup needed
```
Benign if intentional, but looks like scaffolding that was never cleaned up. If the HTML always handles setup, remove the function; if setup was planned, it's half-finished.

**15. No tests anywhere — churn risk multiplies with every feature round**
All commits this week.
8 feature commits, 0 test commits. `index.html` was touched in 8 of 9 commits this week; with no automated checks, any of the 20+ new features could silently regress something that was working. Even a smoke-test harness (playwright, puppeteer) would catch the kind of syntax error that needed `94fca67`.
