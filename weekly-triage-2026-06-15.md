# Weekly Triage — 2026-06-15

## 📊 Week at a glance
- **Commits:** 4 | **Files changed:** 1 (`index.html` only) | **Debt markers added:** 0
- **High-churn files:** `index.html` (touched in all 4 commits — only file in repo)
- **Pattern:** Every commit this week was a bug fix. 4 commits fixing 10 bugs total across backdrop-close, ladder crash, wins blank title, modal-open guard, and three Givelink dashboard bugs. No feature commits, no test commits.

---

## 🚨 Needs immediate attention

### 1. CSP blocks Inter — font never loads on Vercel
- **File:** `vercel.json:14` and `index.html:12-14`
- **Commit introduced:** predates this week (in `vercel.json` from initial deploy)
- **Why this matters:** `font-src 'self'` and `style-src 'self' 'unsafe-inline'` block Google Fonts. Every Vercel-hosted user sees system fonts. The `<link>` tags at lines 12-14 are silently ignored.

### 2. Claude API key serialised into JSON backup
- **File:** `index.html:2108-2113`
- **Commit introduced:** predates this week (`exportData()` unchanged)
- **Why this matters:** `exportData()` dumps `JSON.stringify(S)` which contains `S.claudeKey`. A shared backup file leaks the API key to anyone who opens it.

### 3. Unescaped `${t.title}` / `${g.title}` in `innerHTML` (Weekly Review Wizard)
- **File:** `index.html:2888`, `2895`, `2897`
- **Commit introduced:** `67de902` (cloud sync commit added wizard; wizard uses innerHTML template literals)
- **Why this matters:** Task/goal titles from AI extraction or imported backups are rendered as HTML. `esc()` exists at line 9773 but is not applied in the wizard render functions.

### 4. Bug-churn pattern: 4 "fix N bugs" commits in one week on a single file
- **Files:** `index.html` (all 4 commits: `0b54845`, `7b27281`, `70d4241`, `eeb9b8f`)
- **Why this matters:** Fixing bugs in a 12,893-line monolith without tests generates regression cycles. This week's 4 fix commits may themselves have introduced subtle regressions in the same areas (backdrop, ladder, modals). No test commit followed any feature or fix commit this week.

---

## 🧹 Cleanup opportunities

### 5. `try{refresh();}catch(e){}` — empty catch after Supabase sync
- **File:** `index.html:8624`
- **Commit introduced:** `67de902` (Optional offline-first Supabase cloud sync)
- **Why this matters:** If `refresh()` throws post-sync (e.g. after a new field is added), the error is swallowed silently. User sees stale UI with no feedback.

### 6. `const CACHE = 'task-os-20260530'` — manually-dated cache key
- **File:** `sw.js:1`
- **Commit introduced:** `67de902` (last sw.js update)
- **Why this matters:** Cache key is a hardcoded date. Must be bumped manually on every deploy. This week had 4 deploys. PWA users would only get the latest if the key was updated.

### 7. Two AI functions use manual `btn.disabled` instead of `_aiBtn` / `_aiLock`
- **File:** `index.html:5051-5058`
- **Commit introduced:** predates this week
- **Why this matters:** These functions bypass the `_aiInFlight` Set, so double-clicking the button fires two concurrent Claude requests. All other AI buttons correctly use `_aiBtn(this, fn)`.

### 8. Push notification icon points to missing PNG
- **File:** `sw.js:42` — `icon: './icons/icon-192.png'`
- **Commit introduced:** predates this week
- **Why this matters:** `/icons/icon-192.png` does not exist in the repo. Push notifications on Android show a broken icon.

---

## 🤔 Worth a second look

### 9. `importData()` does `Object.assign(S, d)` after only checking `d.tasks`
- **File:** `index.html:2115-2126`
- **Why this looks suspicious:** The merge overwrites `claudeKey`, `ntfy`, and Supabase config from the imported file. Likely intentional (to allow full restores), but means importing a partially malformed backup can silently change sensitive settings without user awareness.

### 10. `_sbApplying` flag is set inside the `try` block but errors in `save()` won't propagate
- **File:** `index.html:8619-8623`
- **Why this looks suspicious:** `save()` catches `QuotaExceededError` internally and does NOT rethrow, so `_sbApplying = false` at line 8623 is always reached. Looks like it could deadlock but doesn't. Worth adding a comment to document this invariant so a future refactor doesn't accidentally break it.

### 11. Morning briefing uses `innerHTML` for AI-generated content
- **File:** `index.html:~9527` and `~9661`
- **Why this looks suspicious:** The result of a Claude call is inserted via `innerHTML` rather than `textContent`. Low risk since this is a personal tool and Claude is unlikely to return malicious HTML, but inconsistent with using `textContent` in `showAiOut()`.

### 12. `let profileName = ... || 'Panos'` — developer name as default
- **File:** `index.html:2038`
- **Why this looks suspicious:** Hardcoded fallback to the developer's first name. Any new installation (fresh browser, incognito, shared device) shows "Good morning, Panos". Likely never triggered in day-to-day use but is a code smell if the app is ever shared.
