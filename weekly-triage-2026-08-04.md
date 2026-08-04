# Weekly Triage — 2026-08-04

## 📊 Week at a glance
- **Commits this week:** 0 (last commit was `b38d4bb` on 2026-07-22, 13 days ago)
- **Files changed:** 0
- **Debt markers added:** 0 (no new code this week)
- **High-churn files this sprint:** `index.html` (touched in every PR — 14K lines, full-file edits)

> No commits landed in the last 7 days. This triage focuses on **open debt in the current codebase** rather than residue from recent commits.

---

## 🚨 Needs immediate attention

### 1. `aiProxy` is hardcoded empty — all hosted AI is dead
**File:** `index.html:9959` · **Commit:** `0c1d32d` (Rebrand/hosted signup, ~13 days ago)

```js
aiProxy: '',   // e.g. 'https://taskos.vercel.app/api/claude'
```

The proxy endpoint (`api/claude.js`) exists and works, but its URL was never pasted into `APP_CONFIG`. Every AI feature shows "Add your Claude API key" to hosted users. This is the top conversion blocker.

**Why it matters:** Core product promise ("AI that plans your day") is completely disabled for any user who doesn't enter a personal Anthropic key.

---

### 2. `taskReply()` never uses the proxy — "Reply to act" silently falls back
**File:** `index.html:9206` · **Commit:** `0e19b15` (guest mode, ~13 days ago)

```js
if(!S.claudeKey){return _taskReplyLocal(id,text);}  // misses APP_CONFIG.aiProxy
```

Even if issue #1 above is fixed and `aiProxy` is set, `taskReply()` will still fall back because it checks only `S.claudeKey`. The local fallback handles only "done / tomorrow / next week / someday" — four patterns. Everything else silently fails.

**Why it matters:** "Reply to a task to do it" is the primary hook in all landing page copy. It must work for hosted users.

---

### 3. CSP in `vercel.json` blocks Google Fonts — Inter never loads
**File:** `vercel.json:15` · **Commit:** unknown (config change in initial deploy)

```
font-src 'self'          // blocks fonts.gstatic.com
style-src 'self' 'unsafe-inline'  // blocks fonts.googleapis.com stylesheet
```

`index.html:14-16` loads Inter from Google Fonts. The CSP headers shipped to Vercel block both the CSS request and the font files. The app falls back to system fonts (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`). The typography looks different on every platform.

**Why it matters:** Every user is seeing a different typeface from the one the UI was designed for. The difference is subtle but consistent.

---

### 4. Push notification icon is a 404
**File:** `sw.js:47-48` · **Commit:** unknown (service worker initial commit)

```js
icon: './icons/icon-192.png',   // directory doesn't exist
badge: './icons/icon-192.png',  // should be './icon-192.png'
```

The `icons/` subdirectory was never created. Push notifications show no icon (or fail on strict platforms).

**Why it matters:** Anyone who has enabled push reminders sees a broken notification appearance.

---

### 5. XSS: weekly review and backlog panels render raw task titles
**File:** `index.html:3594`, `3601`, `2543` · **Commit:** `f883adf` (templates gallery, ~13 days ago)

```js
// Line 3594 — "Completed this week" panel:
`<div class="tt" style="text-decoration:line-through;">${t.title}</div>`

// Line 3601 — "Backlog" panel:
`<div class="tt">${t.title}</div>`

// Line 2543 — blocked-by select:
'>'+t.title.slice(0,45)+'</option>'
```

The `esc()` function exists at `index.html:11776` and is used correctly throughout most of the codebase, but these three render paths were missed. A task title like `<img src=x onerror=eval(atob('...'))>` executes on load if the weekly review opens.

**Attack surface:** Template import (`importData`) reads arbitrary JSON from disk and inserts it directly into `S.tasks`. Anyone who is tricked into importing a malicious template gets XSS executed on their next weekly review.

**Why it matters:** The template sharing feature (`shareTemplate()`) was added in the last sprint. Combined with these unescaped render paths, there is now a complete stored XSS chain.

---

## 🧹 Cleanup opportunities

### 6. `_fetchAIBriefing()` checks a ghost localStorage key
**File:** `index.html:11670` · **Commit:** older than the log window (pre-rebrand)

```js
if(!S.claudeKey && !localStorage.getItem('taskos_api_key')) return;
```

`taskos_api_key` is never written by the current codebase. This was the key name before the settings schema moved the key into `S.claudeKey`. The briefing panel always silently aborts for users who migrated from the old schema.

---

### 7. `api/claude.js` ships without rate limiting — documented technical debt
**File:** `api/claude.js:14` · **Commit:** present since file was added

```js
// Note: this is a minimal proxy. For production add per-user rate limiting
// (e.g. Upstash) so a single account can't run up your Anthropic bill.
```

The file itself admits it's not production-ready. Since Supabase auth is now live, the blast radius of a stolen token is a full Anthropic bill drain.

---

### 8. Off-brand pink values survived the brand purge in commit `72d9c68`
**File:** `index.html:12193`, `13211` · **Commit:** `72d9c68` was supposed to fix these

```js
// Line 12193 — Bucket list categories:
const BL_CATS = { ..., creative: { color: '#ec4899' } };   // hot pink

// Line 13211 — Life wheel area colors:
const areaColors = { ..., health: '#f472b6' };             // pink
```

Both were missed in the brand-consistency pass (`72d9c68: Brand consistency: rebrand update banner + purge stray old-brand colors`).

---

### 9. Service worker `CACHE` key has a hardcoded date
**File:** `sw.js:1` · **Commit:** likely July 23rd deploy

```js
const CACHE = 'arete-20260723';
```

No deploy since July 23rd has bumped this. When the next deployment lands, users with the service worker installed will keep serving the July 23 cached HTML until someone manually clears their cache or the browser evicts it.

---

## 🤔 Worth a second look

### 10. `sbSyncNow()` replaces entire state on version conflict
**File:** `index.html:10418-10425`

```js
if(remote && remote.data && remote.ms > localMs) {
  S = {...S, ...remote.data};  // cloud wins entirely
  save();
}
```

This is a deliberate "last write wins" strategy but it's invisible to the user. On a phone-plus-desktop workflow (what the marketing targets), any data written on the phone while the desktop tab was open will be lost on next desktop sync. The user has no way to tell this happened.

Intentional or forgotten? If intentional, at minimum a toast explaining what happened would reduce confusion.

---

### 11. `_frOrganize()` doesn't use Claude even when the proxy is available
**File:** `index.html:10521-10529`

The first-run "Organize my day" magic moment uses client-side NLP date parsing only — it never calls `callClaude()`. Tasks get bucketed by due-date heuristics, not intent. This is the first impression for every new user, yet it's the one place that doesn't use the AI the app is built around.

Presumably this was intentional (fast, no API required), but worth revisiting now that the proxy exists. A Claude-assisted organize pass would dramatically improve the first-run quality.

---

### 12. `posthogKey` and `posthogHost` are both empty strings
**File:** `index.html:9960-9961`, `landing.html:702`

Analytics infrastructure is fully wired — events for `guest_started`, `auth_login`, `auth_signup`, `firstrun_started`, `firstrun_skipped` are all instrumented. But the key is empty so nothing is captured. The landing page has scroll-depth and CTA-click tracking that's also dark.

This means the recent growth experiments (guest mode, landing redesign, comparison table) have no measurement. Likely intentional while the product stabilizes, but the window to instrument before user numbers pick up is closing.
