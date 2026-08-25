# Weekly Triage — 2026-08-25

## 📊 Week at a glance
- Commits: 1 | Files changed: 1 | Debt markers in changed files: 0
- High-churn files: none (quiet week — only README updated)
- The improvement plan (`IMPROVEMENT_PLAN.md`) was generated this session and covers the persistent debt items below

---

## 🚨 Needs immediate attention

These were not introduced this week but are production risks found in the codebase scan:

### 1. Hardcoded "Panos" ships to every user in AI prompts and push notifications
- **File**: `index.html:5647, 11254, 2519`
- **Introduced by**: Multiple commits (core app code, not this week)
- **Why this matters**: Any user who signs up gets AI responses and morning push notifications mentioning someone else by name. This is a live multi-tenancy bug that fires for every new account.

### 2. Push notification icon path is wrong (`./icons/icon-192.png` → `./icon-192.png`)
- **File**: `sw.js:47–48`
- **Introduced by**: Likely commit c32b2ef ("Mobile polish + fix load-time init bug") when assets were reorganized
- **Why this matters**: Every push notification shows a broken icon for all users with notifications enabled — silent degradation.

### 3. `manifest-givelink.json` still in SW cache list after Givelink removal
- **File**: `sw.js:3`
- **Introduced by**: Commit d635d06 ("Remove Givelink from Task OS") removed the product but didn't clean up sw.js
- **Why this matters**: Generates a 404 on service worker install for every visitor (caught by `allSettled` but still a noise item in DevTools and a stale entry in cache).

---

## 🧹 Cleanup opportunities

### 4. Seed data references `panagiotis` and Givelink — visible to all new users
- **File**: `index.html:4629, 4653`
- **Commit that last touched seed**: Buried in early commits
- **Why this matters**: New user's first task list includes "Superhuman for panagiotis email?" — jarring and unpolished.

### 5. Default profile name fallback is `'Panos'` not empty string
- **File**: `index.html:2519`: `let profileName=localStorage.getItem('taskos_name')||'Panos'`
- **Why this matters**: Any user who skips the name-setup step gets addressed as Panos everywhere in the UI.

### 6. `givelink.html` is still in the repo — dead file after product split
- **File**: `givelink.html`, referenced in `sw.js:16`
- **Commit**: d635d06 ("Remove Givelink from Task OS") was meant to clean this up
- **Why this matters**: Creates confusion about what the product is; inflates SW cache.

---

## 🤔 Worth a second look

### 7. `ai/claude.js` is deployed to Vercel but `APP_CONFIG.aiProxy` is empty
- **File**: `index.html:9959`, `api/claude.js`
- **Why suspicious**: The proxy exists and works, but its URL is never wired up. Either this is intentional (forcing per-user keys) or it was overlooked during deployment.

### 8. `callClaude` called in ~20 places; null-check discipline varies
- **File**: `index.html:5502, 6053, 6079, 7160, 7491` (and more)
- **Why suspicious**: Some callers guard `if(!result)return`, others don't. No single crash now, but a failed AI call in an unguarded path leaves the UI in an indeterminate state.

### 9. No `CHANGELOG.md` or migration notes — the `5cd9437` README update added "install" steps but the project has no package.json
- **File**: `README.md`, `5cd9437`
- **Why suspicious**: The README now mentions install steps, implying this may be moving toward a more structured project layout, but there's no `package.json` yet.

---

_Triage scope: files changed in the last 7 days + persistent risks surfaced by codebase scan. See `IMPROVEMENT_PLAN.md` for the full prioritized list._
