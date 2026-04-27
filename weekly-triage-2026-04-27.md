# Weekly Triage — 2026-04-27

> **Note on window:** No commits landed in the strict 7-day window (Apr 20–27). This report covers the most recent sprint (Apr 6–13, 13 commits) — the last meaningful burst of activity before the current quiet period.

---

## 📊 Week at a Glance

- **Commits:** 13 | **Files changed:** 3 | **Debt markers added:** 0 explicit (no TODOs/FIXMEs), but 8 substantive issues found below
- **High-churn files (all three are tied at the top):**
  1. `index.html` — 10 commits (303 KB monolith)
  2. `sw.js` — 10 commits (cache key bump every commit)
  3. `givelink.html` — 8 commits (150 KB monolith)
- **Commit health:** 1 WIP commit merged without follow-up squash; 3 fix/hotfix commits in the window (23% of commits are fixes); 0 test commits; no test files exist in the repo at all

---

## 🚨 Needs Immediate Attention

### 1. Two AI calls in `givelink.html` skip `res.ok` — will silently corrupt on API errors
- `givelink.html:2185` — retro auto-fill (`autoFillRetro`) calls Claude but never checks `res.ok`; tries to destructure `data.content[0].text` even on a 4xx/5xx, producing a `TypeError` that surfaces as a generic toast instead of the actual API error message.
- `givelink.html:2211` — standup generator (`generateStandup`) has the same pattern.
- **Contrast:** `givelink.html:1754` and `1845` (sprint planner and goal breakdown) correctly check `if(!res.ok){throw new Error(err);}`.
- **Why it matters:** API key errors, quota exhaustion, and 429s will silently fail or crash with a misleading message; debugging will be blind.
- Introduced: `dc7c2b5` (AI Sprint Closer), `385a4c8` (standup generator)

### 2. WIP commit was never squashed or cleaned — partial state shipped
- `84e113a` (author: Claude, Apr 13) — commit message explicitly says "WIP: partial implementation of 9 features… slot… slot…". The follow-up `ed12a2c` completed these features, but the WIP commit is still in main's history, making `git bisect` unreliable and signalling that the branch is treated like a scratch pad.
- **Why it matters:** If a rollback is needed to `84e113a`, you get a half-wired UI with empty dashboard slots.

### 3. `sw.js:1` — cache key is a hardcoded timestamp, manually bumped
- `const CACHE = 'task-os-20260413-174350';` — the key has been bumped 5+ times in 3 days, each time by hand. There is no CI step or build script that automates this.
- **Why it matters:** If a developer forgets to bump the key on a deploy, users get stale HTML from the old cache. This already happened across multiple commits this sprint (`ed12a2c`, `84e113a`, `23d3020` all changed `sw.js` just to update the timestamp).
- Introduced: every commit touching `sw.js`

### 4. `getApiKey()` in `givelink.html:1685` falls back to `window.prompt()` for missing API key
- If no key is found in any localStorage slot, the function calls `prompt('Enter your Anthropic API key…')`. Chrome/Firefox block `prompt()` in many contexts (iframes, PWA standalone mode, some security policies).
- **Why it matters:** In PWA/standalone mode (this app has a manifest), `prompt()` is silently swallowed — the function returns `null`, and the AI call errors without a clear user-facing explanation.
- Introduced: `385a4c8`

---

## 🧹 Cleanup Opportunities

### 5. `givelink.html:1672` and `1681` — silent `catch(e){}` blocks swallow localStorage parse errors
```js
try{const tos=JSON.parse(localStorage.getItem('taskos')||'null');...}catch(e){}
try{...profile iteration...}catch(e){}
```
- These are in `getApiKey()`. A corrupted localStorage entry will silently return no key, causing all AI features to fail with no diagnostic path.
- **Why it matters:** Corruption happens (quota exceeded, partial write). At minimum, log to console.
- Introduced: `385a4c8`

### 6. `givelink.html:1905` and `1910` — two more silent catches in `syncToTaskOS()`
- `profiles` and `tosData` both fall back silently on parse failure. If a profile's data is corrupt, the sync quietly skips it.
- **Why it matters:** Data loss goes undetected during cross-app sync.
- Introduced: `385a4c8`

### 7. Mixed model usage across AI calls — Opus vs Haiku with no apparent logic
- `givelink.html:1749` and `1843` — sprint planner and goal breakdown use `claude-opus-4-5` (expensive, slow)
- `givelink.html:2185`, `2214`, `index.html:2291`, `4214` — all other features use `claude-haiku-4-5-20251001`
- **Why it matters:** Sprint planner calls will cost ~20× more per call than the haiku calls. If users spam "Regenerate", costs spike unpredictably. Likely an oversight from different commits, not intentional tiering.
- Introduced: `dc7c2b5` (Opus), `cf2b0f0` (Haiku)

### 8. `anthropic-version: '2023-06-01'` hardcoded in all 6 AI fetch calls
- `givelink.html:1745`, `1842`, `2185`, `2213` | `index.html:2290`, `4213`
- **Why it matters:** When Anthropic sunsets this version, all six AI features break simultaneously. No single place to update.
- Introduced: spread across `dc7c2b5`, `385a4c8`, `cf2b0f0`

### 9. `givelink.html:1811` — `seed()` is 391 lines; `renderOverview()` at line 674 is 121 lines
- These are the longest functions in the file. `seed()` appears to be demo/onboarding data seeding — unlikely to be tested, easy to diverge from the real data schema as new fields are added.
- **Why it matters:** New state fields added to `S` (`commitments`, `oneThing`, `contextLog` etc.) are not reflected in `seed()` — users who trigger the seed flow get stale demo data missing new fields.
- Introduced: `d343ab2`, grown across subsequent commits

---

## 🤔 Worth a Second Look

### 10. `anthropic-dangerous-direct-browser-access: true` on every AI call
- `givelink.html:1746`, `1842`, `2185`, `2213` | `index.html:2290`, `4213`
- This is expected for a no-backend SPA, but it means the API key is transmitted in plain browser requests visible in DevTools. Any XSS vulnerability would immediately expose the key.
- **Why it matters:** Low risk with good CSP, high risk without. There is no CSP header visible in the repo (no middleware config). Worth verifying Vercel headers in `vercel.json` cover this.
- Introduced: `dc7c2b5`

### 11. `index.html:2291` uses `claude-haiku-4-5-20251001` (versioned model ID) while `givelink.html:1749` uses `claude-opus-4-5` (unversioned alias)
- Versioned IDs are pinned and will not auto-update to new minor versions; unversioned aliases will. Mixing the two strategies means the two apps diverge silently on model behaviour after a model update.
- Introduced: `cf2b0f0`, `dc7c2b5`

### 12. `vercel.json` exists but no `README`, no `.env.example`, no deploy docs
- The project is a fully browser-local PWA (no server env vars needed today), but the presence of `vercel.json` and API calls to Anthropic suggests a backend proxy is a plausible future direction. If it ever lands, there will be no scaffold for env var documentation.
- **Why it matters:** Low-urgency now, but a 5-minute `.env.example` prevents a future scramble.

---

*Triage generated: 2026-04-27. Branch scanned: main (HEAD `537b01a`). No test suite exists — no test coverage column is possible.*
