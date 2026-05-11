# Weekly Triage — 2026-05-11

## 📊 Week at a glance
- Commits: 20 | Files changed: 4 | Debt markers added: 0 (TODO/FIXME/HACK)
- Lines added / removed: +2046 / -18 — nearly all net-new code
- Empty catch blocks added this week: **5**
- High-churn files: `index.html` (11/20 commits), `sw.js` (1), `vercel.json` (1)
- Fix/hotfix ratio: **8 of 20 commits were bug fixes** — 40% of week in repair mode

---

## 🚨 Needs immediate attention

### 1. Reminder silently marks fired before checking if Notification succeeded
`index.html:5182–5188` · commit `83daeac`

```js
r.lastFired = today; save();       // ← set BEFORE the try block
try { new Notification(...) }
catch(e) {}                        // ← swallowed silently
```
If `Notification.permission !== 'granted'` (very common on first load), the constructor throws. The reminder is permanently marked as fired for the day; the user never sees it and it won't retry. Data is silently lost once per day indefinitely.

---

### 2. Notion direct API is always blocked by CORS — feature is broken in production
`index.html:4829` · commit `ba9856b` / merged `ace56d1`

Notion's API does not set `Access-Control-Allow-Origin` for browser clients. The fetch call will throw a `TypeError: Failed to fetch` 100% of the time in production. The inline workaround ("Export → Markdown → paste") is correct, but the primary code path is dead on arrival. The feature should either be removed or replaced with a paste-only flow upfront.

---

### 3. `toast()` renders `innerHTML` and receives raw server error messages
`index.html:1579` (toast definition) · callers added in `ba9856b`, `cf5423c`

```js
function toast(msg) { t.innerHTML = msg; }   // ← innerHTML, not textContent
...
toast('❌ Network error — ' + e.message);    // ← e.message from external API
toast('❌ ' + e.message);                    // line 5220
```
Any API that returns HTML in its error body (Readwise, ntfy.sh) would have it rendered in the toast. Low-probability but a real XSS surface at a system boundary. Fix: `t.textContent = msg` or sanitize before passing.

---

### 4. `_renderAIBriefing` inserts unescaped Claude API response into `innerHTML`
`index.html:~5606` · commit `83daeac`

```js
body.innerHTML = lines.join('<br><br>');
// lines includes d.PRIORITIES, d.RELATIONSHIP, d.WARNING — raw Claude text
```
The Claude API key is user-controlled and the data is from their own prompt, so the practical risk is low. However if the model ever returns `<script>` or `<img onerror=...>`, it executes. All four `d.*` fields should pass through `esc()`.

---

### 5. Stale dead-code guard hides AI briefing failures
`index.html:5559` · commit `83daeac`

```js
if (!S.claudeKey && !localStorage.getItem('taskos_api_key')) return;
```
`taskos_api_key` is **never written anywhere** in the codebase — `callClaude()` only reads/writes `S.claudeKey`. This condition can never be true-via-fallback. If `S.claudeKey` is empty (e.g. cleared on storage migration), the briefing silently skips with no user feedback. Remove the dead fallback and add a `toast('Add Claude key in Settings')` path.

---

## 🧹 Cleanup opportunities

### 6. Two sequential commits patching the same toggleDone bug
Commits `e7b0d1d` then `f102342` (both: "Fix toggleDone: …badge")

The first fix was incomplete and required an immediate follow-up with nearly identical description. Signals no smoke-test after the first commit. Worth a light review of the badge-update paths — `updateChecklistBadge()` and `updateInboxBadge()` — to confirm the second commit actually closed the loop.

---

### 7. Empty catch swallowed in `saveNtfySettings` verification POST
`index.html:5232` · commit `cf5423c`

```js
try {
  const res = await _ntfyPost(...);
  S.ntfy.subscribed = res.ok; save();
} catch(_) {}                          // ← silent network failure
toast('✅ Saved! Check your ntfy app ...');
```
If the POST throws (network error, DNS failure), `S.ntfy.subscribed` stays `false` but the user sees a success toast. They'll believe push is configured when it isn't. At minimum: surface the error or set `S.ntfy.subscribed = false` and toast a warning.

---

### 8. AI prompts hardcode "Panos" / "Givelink" — ignore `profileName` setting
`index.html:5312, 5406, 5621` · commits `83daeac`, `ba9856b`

The Settings page has `set-name` (saves to `taskos_name`), and line 1544 reads it:
```js
let profileName = localStorage.getItem('taskos_name') || 'Panos';
```
But every AI prompt hardcodes `"Panos"` and `"Givelink"` directly — `profileName` is never referenced in the prompts. Three AI features (`synthesizeWeeklyNotes`, `extractHighlightTasks`, `autoProcessInbox`) all have this. The setting does nothing for AI personalization.

---

### 9. Readwise highlights silently truncated at 1000
`index.html:4759` · commit `ba9856b`

```js
// fetch up to 2 pages (1000 highlights max)
for (let i = 0; i < 2; i++) { ... if (!data.next) break; }
```
No UI indicator when the loop hits the cap. Users with prolific annotation habits get partial data and have no way to know. Add a `toast(\`Loaded first 1000 highlights\`)` when `data.next` is set after page 2.

---

### 10. Notion fetch only retrieves the first 100 blocks
`index.html:4829` · commit `ba9856b`

`page_size=100` is the Notion API's max per page, but there's no pagination loop — only the first page is fetched. Long weekly-notes pages silently truncate. (Doubly moot given item #2 above, but fix is needed if CORS is ever resolved via a proxy.)

---

### 11. Readwise pagination URL parsing is fragile
`index.html:4762` · commit `ba9856b`

```js
url = '/highlights/?' + data.next.split('?')[1];
```
Strips Readwise's base URL and reconstructs the path. If Readwise changes their base path (they've done it before), this breaks with an empty-results response and no error. Store the cursor token instead, or pass the full `data.next` URL to `fetch()` with the auth header.

---

## 🤔 Worth a second look

### 12. Claude API key exposed in browser network tab by design
`index.html:2729` · commit pre-week (long-standing)

```js
headers: { 'x-api-key': S.claudeKey, 'anthropic-dangerous-direct-browser-access': 'true' }
```
The header name makes this opt-in and intentional. Acceptable for a personal single-user tool. Becomes a problem if the app is ever shared or if the codebase is forked for multi-user use — the key is trivially exfiltrated from DevTools. Worth a comment explaining the conscious tradeoff.

---

### 13. `seedGoals()` is 77 lines and contains hardcoded sample data
`index.html:2644` · commit `6063b3b`

Largest function added this week. Contains hardcoded personal goal/task content (Givelink milestones, personal fitness goals) used for onboarding. If this is seed data meant to be customisable per user, it should be a config object or JSON, not inline logic. Currently any update to the defaults requires editing the middle of a 77-line function.

---

### 14. `postToNtfy(r)` is called unconditionally after the silent-catch Notification block
`index.html:5190` · commit `cf5423c`

```js
try { new Notification(...) } catch(e) {}
postToNtfy(r);                    // ← runs even when Notification threw
```
This is likely intentional (ntfy is a fallback for when native notifications are blocked). But if it IS intentional, the relationship should be documented — right now it looks like ntfy fires redundantly on top of every successful native notification too.

---

### 15. `vercel.json` CSP `connect-src` lists `https://readwise.io` not `https://readwise.io/api`
`vercel.json` · commit `6407046`

Minor: the CSP origin `https://readwise.io` is a valid but overly broad directive (covers all subpaths and ports). Not a security issue since Readwise is a trusted domain, but worth tightening to `https://readwise.io/api/v2/` to match actual usage.
