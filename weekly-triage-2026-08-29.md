# Weekly Triage — 2026-08-29

## 📊 Week at a glance
- **Commits (last 7 days):** 1 | **Files changed:** 1 (`README.md`) | **Code debt markers added:** 0
- **High-churn files:** N/A — only one commit this week, touching only documentation
- **Note:** The sole commit this week was a README update (`5cd9437`, 2026-08-22). No application code was modified in the last 7 days. The triage below covers standing debt found in the current codebase.

---

## 🚨 Needs immediate attention

### 1. `givelink.html:1551` — `renderVelocityStats()` appends, doesn't replace
- **Commit introduced:** Not added this week; pre-existing. Most recent touching commit: `72d9c68` (brand cleanup, 2026-07-17).
- **Why it matters:** Every click of the Overview tab duplicates the "tasks/day" and "On Track" stat cards. After 5 clicks the overview shows 10 extra cards. This is visible, reproducible UI corruption on the primary view.

### 2. `givelink.html:1140` — Invalid Claude model `claude-opus-4-5`
- **Commit introduced:** `0c1d32d` (rebrand, 2026-07-17) — the AI Sprint Planner was part of that commit.
- **Why it matters:** The AI Sprint Planner calls `model: 'claude-opus-4-5'`. This model ID does not exist in the Anthropic API; valid IDs include `claude-opus-5`, `claude-opus-4-7`, `claude-haiku-4-5-20251001`. Every "✨ Generate" click returns an API error. The feature is 100% broken.

### 3. `givelink.html:448` — `JSON.parse` in `load()` has no try/catch
- **Commit introduced:** Pre-dates the last 20 commits; foundational data layer.
- **Why it matters:** A corrupted or partial `givelink_sprint` localStorage value (partial write, browser bug, storage quota hit) throws an uncaught exception that crashes the entire app on load. No error message, no recovery — the user sees a blank page.

### 4. `givelink.html:1131, 1264` — Direct Anthropic API calls from browser with localStorage key
- **Commit introduced:** Present since `0c1d32d` / `f883adf` (AI feature additions, 2026-07-17).
- **Why it matters:** Both `runAiSprintPlanner()` and `callClaudeGL()` call `api.anthropic.com` directly and store the API key in `localStorage` under `taskos_api_key`. The `/api/claude` proxy at `api/claude.js` exists specifically to avoid this pattern and is not being used by `givelink.html`.

### 5. `sw.js:46-47` — Push notification icon path `./icons/icon-192.png` does not exist
- **Commit introduced:** Pre-dates the last 20 commits.
- **Why it matters:** The actual icon file is `./icon-192.png` (no `icons/` directory). Every push notification arrives without a brand icon. Visible on any device that receives a reminder.

---

## 🧹 Cleanup opportunities

### 6. `givelink.html:1086-1088` and `1257-1262` — Duplicate API key resolution
- **Commit:** Both blocks likely from `0c1d32d`.
- `getApiKey()` checks `d.apiKey`; `callClaudeGL()` checks `p.claudeKey` — different keys, so they don't share the same stored value. A user who entered their key via one flow may not have it accessible via the other. Consolidate into a single `resolveApiKey()` or, ideally, remove both and use the proxy.

### 7. `givelink.html:1488` — Standup "yesterday" offset is `-2` (should be `-1`)
- **Commit:** `0c1d32d` or adjacent; standup feature was added in the rebrand batch.
- `yesterday.setDate(now.getDate() - 2)` looks 48 hours back. Every morning standup says "Yesterday: nothing completed" because completed tasks from the actual prior 24 hours are out of the window.

### 8. `landing.html:702` — PostHog key is empty string `''`
- **Commit:** `b38d4bb` (analytics, 2026-07-22) — the analytics block was added but the key was left blank.
- The `if(POSTHOG_KEY)` guard makes every `track()` a no-op. Landing funnel, scroll depth, and demo-seen events produce zero data.

### 9. Repo root — Missing `.env.example`
- `api/claude.js` requires three Vercel env vars. There is no `.env.example`. The three-line setup comment in the file is the only documentation. A new contributor or Vercel deploy will hit unexplained 500 errors.

---

## 🤔 Worth a second look

### 10. `givelink.html:1380` — NP modal delete button rendered via string interpolation
The "Delete" button HTML is inlined as `${editNpId?...:''}`; this is evaluated when `_showNPModal` renders the innerHTML the first time the element is created. Because the modal DOM is cached (`if(!m){...}`), subsequent opens skip the innerHTML assignment — the `editNpId` check is only applied once. In practice the modal re-populates fields via `document.getElementById` on subsequent opens, and the delete button's visibility is controlled by re-rendering the `mf` footer... actually this path does NOT re-render the footer on subsequent calls. This means: if you open "Add Org" first (no delete button), close it, then open "Edit Org", the delete button is absent. Verify in a browser.

### 11. `givelink.html:1724-1731` — SW update banner fires on `'activated'` state
```js
nw.addEventListener('statechange', () => {
  if (nw.state === 'activated') showUpdateBanner();
});
```
This fires whenever the new worker activates, including on a fresh install (first visit, no prior SW). Users may see an "App updated!" banner on their very first load. Cross-check with `navigator.serviceWorker.controller !== null` before showing the banner.

### 12. `landing.html:634` — Footer SVG uses `url(#lg)` from nav SVG
The `<linearGradient id="lg">` is defined inside the nav `<svg>`. The footer `<svg>` references it as `stroke="url(#lg)"`. This works in Chrome (global SVG ID lookup) but silently fails in Firefox (ID scoped to the SVG element), rendering the footer logo with no stroke/colour.

---

*3 high-churn files (none this week — quiet week). 5 items need immediate attention (all pre-existing). No new debt markers introduced in the past 7 days.*
