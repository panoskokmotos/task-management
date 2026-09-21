# Weekly Triage — 2026-09-21

## 📊 Week at a glance
- **Commits this week:** 0 (last activity: 2026-09-12, 9 days ago — just outside the 7-day window)
- **Commits analyzed:** 2 most-recent commits (`72e03fe`, `160f0d8`) from 2026-09-12
- **Files changed:** 3 (givelink.html +96/-17, index.html +14/-5, .github/workflows/supabase-keepalive.yml new)
- **Debt markers added this sprint:** 0 TODO/FIXME/HACK — clean

**High-churn files (all-time):**
1. `index.html` — 44 commits (main app, expected)
2. `sw.js` — 21 commits (service worker, high for its size)
3. `givelink.html` — 7 commits (sprint board, actively iterated)

---

## 🚨 Needs immediate attention

### 1. Empty catch silently drops API key lookup failure
**`givelink.html:1152`** · Commit `72e03fe`

```js
}catch(e){}
```
Inside `getApiKey()`, an error while reading profile data from localStorage is swallowed with no fallback log or notification. If the profile key is corrupt, the function silently falls through to `prompt()` — surfacing a jarring native browser dialog to users on every AI action. Should at minimum `console.warn` so failures are visible in DevTools.

---

### 2. Week plan mobile layout only runs at render time — breaks on resize
**`givelink.html:682–685`** · Commit `72e03fe`

```js
if(window.innerWidth<600){
  const grid=el.querySelector('div[style*="grid-template-columns:repeat(7"]');
  if(grid)grid.style.gridTemplateColumns='1fr 1fr';
}
```
The 7→2 column collapse fires once during `renderWeekPlan()`. No `window.onresize` or `ResizeObserver` is attached, so rotating a phone or resizing a browser window after navigation leaves the 7-column grid in the wrong layout. Users on tablets near the 600px breakpoint are most likely to hit this. Fix: use a CSS `@media` query or add a resize listener that calls `renderWeekPlan()`.

---

### 3. Standup "yesterday" filter looks back 2 days — naming is misleading
**`givelink.html:1561`** · Commit `72e03fe`

```js
yesterday.setDate(now.getDate()-2);yesterday.setHours(6,0,0,0);
```
The variable is called `yesterday` and the commit message says "Fix: completedAt now correctly set/cleared…so banner fires reliably", but the window is 48+ hours (going back to the morning 2 days prior). On a Monday standup this shows Friday's work (reasonable), but on a Tuesday it silently includes Sunday *and* Monday work in "done yesterday". Either the intent should be documented with a comment, or the window should use `-1` and handle weekends explicitly.

---

## 🧹 Cleanup opportunities

### 4. Hardcoded full name in AI outreach prompt
**`givelink.html:1711`** · Commit pre-dating this sprint (longstanding)

```js
const prompt=`Write a … email from Panos Evangelou, co-founder of Givelink (givelink.io).`;
```
Works fine for a solo-founder tool, but the standup prompt (`givelink.html:1566`) reads "Generate a daily standup for Panos" while settings already store `profileName`. If the name ever changes (e.g. co-founder takes over the tool), this silently sends wrong attribution in AI-drafted emails. Consider pulling from `S.name || 'the founder'`.

---

### 5. Supabase credentials duplicated in workflow file
**`.github/workflows/supabase-keepalive.yml:24–25`** · Commit `160f0d8`

The workflow hardcodes the Supabase project URL and anon key directly in the YAML (the comment correctly notes they're publishable keys, safe client-side). However this creates two places to update when credentials rotate. If Supabase ever invalidates the anon key, the keepalive ping will start returning 401s silently with no Slack/email alert on failure. Consider adding `|| exit 1` to the curl command so GitHub Actions marks the run as failed and sends a notification.

---

### 6. `sw.js` has 21 all-time commits — high churn for a ~100-line file
**`sw.js`** · Not touched in this sprint

Service workers are notoriously easy to break silently (stale caches, update events not firing). 21 revisions to a small file suggests recurring issues. The recent SW fix in `72e03fe` (switching `'activated'` → `'installed'` for the update banner) is the latest in this pattern. Worth a dedicated manual test of the update flow before the next deploy.

---

## 🤔 Worth a second look

### 7. Week plan "unscheduled" shows all non-done sprint tasks — no limit
**`givelink.html:640, 670–676`** · Commit `72e03fe`

```js
const unscheduled=sprintTasks.filter(t=>!t.plannedDate);
```
With a large sprint (20+ tasks), this renders every unscheduled task below the 7-day grid with no pagination or truncation. On mobile, this becomes a very long scroll. Low priority now, but worth adding a `slice(0, 10)` cap with a "show more" toggle once sprint sizes grow.

---

### 8. `closeM()` uses optional chaining for element lookup — potential silent no-op
**`givelink.html:943`** · Commit `72e03fe`

```js
function closeM(id){document.getElementById(id)?.classList.add('hidden');editId=null;…}
```
The `?.` means if `id` doesn't match any element (e.g. a typo in a call site), the close silently does nothing — the modal stays open. Previously this would have thrown, which is actually easier to catch in QA. The fix was warranted (backdrop-click routing), but the optional chaining trades a visible crash for an invisible no-op. Low risk for the current call sites, but worth noting.

---

### 9. `index.html` is 1 MB — entire app ships as one file
**`index.html`** · 44 commits total

At ~13,700 lines and 1 MB, the file is at the boundary where single-file architecture starts costing: harder to diff in PRs, slower grep/review, and a full re-download on every deploy for PWA users. Not an immediate bug, but the 44-commit churn rate means conflicts will become more frequent if a second contributor joins.

---

*Triage by automated Monday scan — 2026-09-21*
