# Weekly Triage — 2026-08-21

## 📊 Week at a glance
- **Commits:** 0 | **Files changed:** 0 | **Debt markers added:** 0
- **High-churn files:** none (no activity this week)
- **Last commit:** `b38d4bb` — "Landing growth: analytics, SEO foundation, and comparison table (#83)"

> No code was merged this week. The triage below is a static debt snapshot of the current `main` branch, focused on items most likely to bite in production.

---

## 🚨 Needs immediate attention

### 1. AI Sprint Planner calls non-existent model `claude-opus-4-5`
- **File:** `givelink.html:1143`
- **Introduced by:** cannot determine from commit history (pre-existing)
- **Why it matters:** Every click of "✨ Generate" returns a model-not-found error. The feature is broken for 100% of users who try it. Current valid haiku model in the same file is `claude-haiku-4-5-20251001`; this should be aligned.

### 2. Push notification icon path 404s in service worker
- **File:** `sw.js:46,50`
- **Why it matters:** `'./icons/icon-192.png'` does not exist; the actual file is `'./icon-192.png'`. Every push notification delivered to an installed PWA appears without an icon — looks like spam.

### 3. API key captured and persisted via `window.prompt()` + `localStorage`
- **File:** `givelink.html:1086, 1261`
- **Why it matters:** `window.prompt()` is suppressed in PWA standalone mode (iOS Safari, some Android browsers). All AI features silently refuse to start with no user feedback. Key is also stored plaintext in `localStorage`, readable by any XSS vector. The proxy at `api/claude.js` exists precisely to avoid this but is never used by Givelink.

### 4. `window.confirm()` / `window.prompt()` suppress in PWA standalone mode
- **File:** `givelink.html:732` (delete task), `givelink.html:1424` (delete nonprofit), `givelink.html:1432` (log activity)
- **Why it matters:** On home-screen-installed PWA builds (the marketed use case), these native dialogs return `null`/`false` immediately. Task deletion and activity logging are silently broken for installed users.

### 5. Seed sprint dates are 5 months in the past
- **File:** `givelink.html:437`
- **Why it matters:** All new users see a sprint that ended 2026-04-11 — 133 days ago. Sprint bar shows "0 days left", burndown is empty, ETA chips show "Stalled". The app looks broken on first open.

---

## 🧹 Cleanup opportunities

### 6. Non-standard DOM property for AI text passthrough
- **File:** `givelink.html:1510, 1519, 1663, 1664`
- **Pattern:** `body._text = text` — writing to a non-spec DOM property to pass state to event handlers
- **Why it matters:** If the container element is re-rendered (e.g., by a Regenerate click mid-flight), `_text` is gone and "Copy" silently copies the loading placeholder. Introduce two module-level `let` variables instead.

### 7. `callClaudeGL` silently swallows API errors
- **File:** `givelink.html:1269-1271`
- **Pattern:** `return data.content?.[0]?.text||null` — if `res.ok` is false, `data.content` is undefined, returns `null`, callers show "Could not generate. Check your API key."
- **Why it matters:** Rate limit errors, invalid model errors, and server errors all present identically to a missing key. Parse and surface `data.error.message`.

### 8. Duplicate `callClaudeGL` / `getApiKey` pattern
- **File:** `givelink.html:1075-1088, 1256-1272`
- **Pattern:** `getApiKey()` and `callClaudeGL()` both independently search `localStorage` for the API key with slightly different fallback logic (`taskos_profiles` array vs `taskos` object).
- **Why it matters:** If the key storage key changes in `index.html`, the two lookups in `givelink.html` diverge and one silently stops working. Consolidate into a single function.

### 9. Hardcoded impact goal of 1,000,000 people
- **File:** `givelink.html:1577`
- **Pattern:** `const goal=1000000` — magic number inline in `renderImpactWidget()`
- **Why it matters:** When the mission goal changes, this number lives invisibly inside a function. Make it a named constant at the top of the file near `PILLARS` / `STATUS`.

### 10. Sprint settings "Close Sprint →" button flow skips validation
- **File:** `givelink.html:381`
- **Pattern:** `onclick="closeM('sm');openCloseSprint()"` — closes Sprint Settings modal then opens Close Sprint modal, but any unsaved sprint name changes are silently discarded
- **Why it matters:** User types a new sprint name, clicks "Close Sprint →" expecting to rename-and-close — the rename is lost. At minimum, save sprint data before switching modals.

---

## 🤔 Worth a second look

### 11. Service worker caches both `'./'` and `'./landing.html'` separately
- **File:** `sw.js:13-18`
- **Why suspicious:** `vercel.json` rewrites `/` → `/landing.html` at the CDN layer. Offline, the SW returns the cached `'./'` root — but there is no `index.html` rewrite at the SW layer, so offline root navigation may serve a blank response.
- **Is it intentional?** Possibly — the HTML fetch handler falls back to cache. Worth testing offline from `/` on a real mobile device.

### 12. `callClaudeGL` uses `window.prompt()` as a third fallback key source
- **File:** `givelink.html:1261`
- **Why suspicious:** The function has three key sources in order: `taskos_api_key`, `taskos.claudeKey`, then `window.prompt()`. The `taskos.claudeKey` lookup (`JSON.parse(localStorage.getItem('taskos')||'{}')`) parses a key called `'taskos'` — but `index.html` stores the Claude key under `'taskos_data_'+profileId` inside the profile object, not at `taskos.claudeKey`. This fallback likely never finds a key, making `window.prompt()` the de-facto second attempt.

### 13. CRM `seedNonprofits()` is called on every `renderCRM()` instead of once
- **File:** `givelink.html:1300-1301`
- **Why suspicious:** `seedNonprofits()` guards against re-seeding only if `S.nonprofits.length > 0`. After a user deletes all their CRM orgs, the next `renderCRM()` call re-seeds with the demo data, overwriting their empty state.

### 14. Burndown snapshots accumulate unboundedly in `localStorage`
- **File:** `givelink.html:743-752` (`_recordSnapshot`)
- **Why suspicious:** Each call to `toggleDone()` appends a dated snapshot to `S.snapshots`. There is no pruning. After 6 months of daily use, `S.snapshots` could hold 180+ entries. `localStorage` has a 5–10MB quota; combined with all tasks and CRM data, this is an eventual crash risk.
