# Weekly Triage — 2026-08-13

## 📊 Week at a glance
- **Commits this week**: 0 | **Files changed**: 0 | **Debt markers added**: 0
- **Last commit**: `b38d4bb` — 22 days ago (Jul 22)
- **High-churn files**: n/a (quiet week — no code changed)
- **Note**: No commits landed in the past 7 days. This triage instead covers standing debt in recently-touched files from the last 30-day window (commits #79–#83), which is where new code lives and where bugs are most likely to surface first.

---

## 🚨 Needs immediate attention

### 1. Broken AI model ID — 100% failure rate on Givelink Sprint Planner
- **File**: `givelink.html:1140`
- **Commit**: `d635c06` (#73, "Remove Givelink from Task OS") — model ID was likely set during an early experiment and never corrected
- **Why it matters**: `model:'claude-opus-4-5'` does not exist; the Anthropic API returns a 404 on every call. Every user who clicks "Generate" in the AI Sprint Planner sees an error. This is silent data from PostHog: zero successful AI calls from Givelink.

### 2. Push notification icons are broken — wrong path in service worker
- **File**: `sw.js:48–49`
- **Commit**: Added in an earlier push notification implementation pass
- **Why it matters**: `'./icons/icon-192.png'` points to a directory that doesn't exist; the actual path is `'./icon-192.png'`. Every push notification fires with a broken icon. On Android this shows the generic "no icon" placeholder — looks like spam.

### 3. AI proxy unconfigured — AI features dead for all new users
- **File**: `index.html:9959`
- **Commit**: `0e19b15` (#77, "guest mode") — the proxy field was left empty
- **Why it matters**: `aiProxy: ''` means the `/api/claude` endpoint (which exists and works) is bypassed. New users and guests hit a wall: "Add Claude API key in Settings." The landing page promises AI; the app delivers a configuration screen. Highest-friction drop-off point.

### 4. PostHog analytics key missing on landing page — zero funnel visibility
- **File**: `landing.html:701`
- **Commit**: `b38d4bb` (#83, "Landing growth") — analytics infrastructure was built but the key was intentionally left blank, pending a paste-in step that never happened
- **Why it matters**: All conversion events (`landing_cta_click`, `landing_demo_seen`, scroll depth) are silently no-ops. Two weeks of landing traffic since the revamp generated no data. Every growth decision is a guess.

---

## 🧹 Cleanup opportunities

### 5. `window.prompt()` for API key in Givelink — blocked in iOS PWA mode
- **File**: `givelink.html:1086–1088`, `givelink.html:1261`, `givelink.html:1431`
- **Commit**: present since initial Givelink extraction in `d635c06`
- **Why it matters**: `window.prompt()` is silently suppressed in PWA standalone mode on iOS. Users on mobile who try to use AI features or log CRM activity get no response. Three separate instances — each a separate fix or a shared modal utility.

### 6. `callClaudeGL()` duplicates `callClaude()` — no proxy, no structured error handling
- **File**: `givelink.html:1256–1272` (vs `index.html:5006–5034`)
- **Commit**: `d635c06` (#73) — copied and trimmed during the split
- **Why it matters**: Givelink's wrapper lacks the proxy path, the 429/401 error discrimination, and the fallback parsing that the main app wrapper has. Any future improvement must be applied twice. They've already diverged: one supports proxy, one doesn't.

### 7. Service worker cache version is 22 days stale
- **File**: `sw.js:1`
- **Commit**: Last bumped in `b38d4bb` (Jul 22)
- **Why it matters**: Static assets (icons, manifests) may be served from the `arete-20260723` cache even after subsequent changes. Users on stale installs see ghost behaviour that's hard to reproduce in development.

### 8. Standup "yesterday" window is -2 days, not -1
- **File**: `givelink.html:1488`
- **Commit**: Present since standup feature was added; exact commit unclear (likely #73)
- **Why it matters**: `yesterday.setDate(now.getDate()-2)` means anything completed in the last 24h is excluded from "yesterday's" standup section. Users who completed tasks today but yesterday-relative see "Nothing completed yet." Makes the daily standup feature useless as a daily ritual.

### 9. Impact widget invisible until CRM tab is visited
- **File**: `givelink.html:1573`, `givelink.html:1299–1302` (`renderCRM` → `seedNonprofits`)
- **Commit**: `d635c06` (#73)
- **Why it matters**: The "People Impacted" mission counter is a prime motivational element on the Overview page, but `seedNonprofits()` is only called from `renderCRM()`. Fresh-load of Overview shows an empty widget. Users must navigate to CRM first.

### 10. Google Fonts request blocks offline use and first paint
- **File**: `index.html:15–16`
- **Commit**: Added during the rebrand/polish pass in `0c1d32d` (#80)
- **Why it matters**: Arete promises "works offline." The Inter font load from `fonts.googleapis.com` fails offline (falls back to system font with a flash of unstyled text). System font stack already in the fallback is visually fine and eliminates the request.

---

## 🤔 Worth a second look

### 11. `anthropic-dangerous-direct-browser-access: true` in production browser calls
- **File**: `givelink.html:1137`, `givelink.html:1266`; also `index.html:5022` (fallback path)
- **Commit**: Present in original implementations
- **Why it matters**: This header is specifically documented as "dangerous" by Anthropic — it's intended for local development/demos only. In production it means user API keys (`sk-ant-...`) are sent in a browser-visible request header, readable by anyone with DevTools or a network-inspecting extension. Low risk for technical users; meaningful risk if this is shared broadly. Consider whether the direct-browser path should be removed entirely once the proxy is configured (fixing #3 makes this moot for the main app).

### 12. Givelink brand palette diverged — `--accent:#3b82f6` (blue) vs. app/landing purple
- **File**: `givelink.html:17`
- **Commit**: Set in original extraction from Task OS
- **Why it matters**: Givelink and Task OS are linked ("← Task OS" in the nav). Users who navigate between them see a jarring palette shift. The task requested `#6B3FA0/#5718CA` (purple) — neither the app's `#8272f2` nor the landing's `#5a49e0` matches exactly; all three files use different purple shades. Worth aligning to a single token.

### 13. `seed()` guard only checks `S.seeded` — but `S` is reset on data import
- **File**: `givelink.html:883–884`
- **Commit**: Original implementation
- **Why it matters**: If a user imports fresh data (overwriting localStorage) without the `seeded: true` flag, `seed()` will re-inject all the sample tasks on next page load. This is probably fine for Givelink (intentional demo data), but worth a conscious decision about whether the seed guard should be based on `tasks.length > 0` instead.

---

_Triage generated 2026-08-13. No commits this week. Items 1–4 are production bugs that should be fixed before the next release. Items 5–10 are cleanup with clear owners and small scope. Items 11–13 are design/architecture questions that may be intentional._
