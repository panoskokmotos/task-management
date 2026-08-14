# Weekly Triage — 2026-08-14

## 📊 Week at a glance
- Commits this week (Aug 7–14): **0**
- Last commit: `b38d4bb` on 2026-07-22 ("Landing growth: analytics, SEO foundation, and comparison table")
- Files changed in last 7 days: **0** (no code activity)
- High-churn files (last 30 days): `index.html`, `landing.html`, `givelink.html` (all 3 modified in every recent commit)

> No commits this week means no churn-related debt to triage. The scan below covers debt markers found across the full codebase, focused on the most recently touched files.

---

## 🚨 Needs immediate attention

### 1. `givelink.html:448` — Unguarded `JSON.parse` on localStorage load
Introduced: `b38d4bb` (or earlier — present across all recent commits)
```js
function load(){const d=localStorage.getItem('givelink_sprint');if(d){const p=JSON.parse(d);S={...S,...p};}}
```
**Why this matters**: Any corrupt or truncated write to localStorage (storage quota, partial write) will throw an uncaught exception that crashes the entire Sprint Board on page load, with no recovery path. `index.html` has this handled correctly (`try/catch` at line 2598). This is a silent data-loss risk.

---

### 2. `givelink.html:1488` — Off-by-one in standup "yesterday" window
Introduced: givelink.html standup feature (present since feature landed)
```js
const yesterday=new Date(now);yesterday.setDate(now.getDate()-2);
```
**Why this matters**: The standup generator's "YESTERDAY COMPLETED" section looks back 48 hours instead of 24. Every standup generated will report "Nothing completed yet" even when tasks were completed yesterday. The AI output is wrong, silently.

---

### 3. `sw.js:48-49` — Push notification icon references non-existent path
Introduced: push notification handler (present in current codebase)
```js
icon: './icons/icon-192.png',
badge: './icons/icon-192.png',
```
**Why this matters**: The `icons/` subdirectory does not exist — files are at `./icon-192.png`. All push notifications (reminders, nudges) arrive iconless. On iOS this causes the notification to use a generic placeholder that looks unpolished.

---

### 4. `givelink.html:1358-1387` — CRM modal bakes button presence at first open
Introduced: NP CRM feature
```js
m.innerHTML = `... ${editNpId ? '<button ...>Delete</button>' : ''} ...`
```
**Why this matters**: Modal HTML is written once with `editNpId` evaluated at that moment. If the first open is "Add", Delete/Log/Advance buttons are never rendered in subsequent Edit sessions — the core CRM mutation operations silently disappear until page reload.

---

### 5. `givelink.html:1131` + `givelink.html:1264` — API key in browser network tab
Present in current codebase; no recent change addressed it.
```js
headers: { 'x-api-key': apiKey, 'anthropic-dangerous-direct-browser-access': 'true' }
```
**Why this matters**: Both `runAiSprintPlanner()` and `callClaudeGL()` call the Anthropic API directly from the browser, exposing the key in DevTools Network. The `api/claude.js` proxy exists for exactly this reason but is not wired up in `givelink.html`.

---

## 🧹 Cleanup opportunities

### 6. `givelink.html:732`, `givelink.html:1424` — `confirm()` for destructive actions
```js
function delCur(){if(!editId||!confirm('Delete?'))return;...}
function deleteNP(){if(!editNpId||!confirm('Delete this org?'))return;...}
```
`index.html` already ships `showConfirm()`. These two calls should use it — native `confirm()` is suppressed in PWA standalone mode on Android, making deletes unblockable.

---

### 7. `givelink.html:1431` — Activity logging via `window.prompt()`
```js
const note=window.prompt('Log activity (what happened?):');
```
Same PWA issue as `confirm()`. The primary CRM data-entry path (logging a call, email, or meeting) is broken on Android PWA. Replace with an inline input inside the modal.

---

### 8. `givelink.html:666` — Raw priority key shown instead of label
```js
<span class="badge ${PRI[t.priority]?.cls||'pri-med'}">${t.priority||'medium'}</span>
```
`goalHTML` correctly uses `PRI[t.priority]?.l` (capitalized). Task cards show lowercase "high"/"medium"/"low". Minor inconsistency that's easy to miss in code review.

---

### 9. `api/claude.js:35` — `max_tokens` proxy cap truncates at 2000
```js
const max_tokens = Math.min(parseInt(body.max_tokens) || 1000, 2000);
```
Haiku 4.5 supports 8192 output tokens. Sprint planner responses with large backlogs get truncated, breaking JSON parsing downstream. Should raise to 8192 or make model-aware.

---

### 10. `givelink.html:874-879` — Escape handler doesn't reset `editNpId`
```js
if(e.key==='Escape'){document.querySelectorAll('.mo:not(.hidden)').forEach(m=>m.classList.add('hidden'));editId=null;}
```
`editNpId` is not reset on Escape. Closing the NP modal via keyboard leaves stale CRM state — reopening "Add Org" from the "+" button may trigger edit mode for the previously viewed org.

---

## 🤔 Worth a second look

### 11. `index.html:9957-9958` — Supabase credentials in source
```js
supabaseUrl : 'https://bgvddpkdsftgynxyhnoc.supabase.co',
supabaseAnon: 'sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M',
```
The comment says this is intentionally public (RLS-protected). That's architecturally sound, but these values are now in git history permanently and will appear in any source diff or search. Confirm RLS policies on the Supabase dashboard cover all tables (especially `tasks` and `goals`) before assuming this is safe.

---

### 12. `sw.js:1` — Cache key hardcoded to a date
```js
const CACHE = 'arete-20260723';
```
23 days old. If any HTML, JS, or asset changed since July 22 without a cache bust (i.e. without bumping this string), returning PWA users may serve stale code. The last commit was July 22 and matches the cache date — but if givelink.html or index.html are deployed with changes, this needs to be bumped immediately.

---

### 13. `givelink.html:883-1072` — Production build ships with 100+ real org/contact details in seed data
The `seed()` function contains real company names, contact names, deal notes ("Meet w/ immigration specialist completed — next steps cleared"), and financial figures. If `givelink.html` is publicly accessible at the Vercel deployment URL, this is an inadvertent disclosure. Verify the file is gated or strip PII from seed before next deploy.

---

_Triage complete — 13 items (0 from this week's commits, 13 from accumulated codebase debt). No urgent regression risk from new code this week since no new code shipped._
