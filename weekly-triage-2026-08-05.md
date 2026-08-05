# Weekly Triage — 2026-08-05

## 📊 Week at a glance
- **Commits this week**: 0 (last commit was `b38d4bb` on 2026-07-22, two weeks ago)
- **Files changed**: 0
- **Debt markers added this week**: N/A (no commits in scope)
- **High-churn files**: None — repo was quiet this week

_No commits landed in the 7-day window ending 2026-08-05. The triage below covers standing debt in the codebase, prioritised by the risk of biting in production._

---

## 🚨 Needs immediate attention

### 1. `aiProxy` is empty — AI features broken for all users
- **File**: `index.html:9959`
- **Introduced**: `b38d4bb` (2026-07-22) — key was never set
- **Why it matters**: Every AI call (Plan My Day, Auto-Triage, AI Lab, Reply-to-Act) shows "Add your Claude API key in Settings." The core value proposition is non-functional for any user who hasn't entered their own API key. This is the single biggest conversion blocker in the product.

### 2. Push notification icon path broken
- **File**: `sw.js:47–48`
- **Introduced**: At least since `b38d4bb`
- **Why it matters**: `./icons/icon-192.png` doesn't exist — the real file is `./icon-192.png`. Android push notifications show a broken icon. Affects every user with reminders enabled.

### 3. Personal seed tasks shipped as the new-user experience
- **File**: `index.html:4537–4856` (`seed()` function)
- **Introduced**: Present across multiple commits; not cleaned up after rebrand
- **Why it matters**: New guests see "Nonprofits Board Follow Ups", "Dex CRM", "Givelink Outreach" etc. as their starter tasks. Destroys product credibility and first-run relevance for anyone who isn't the app's author.

### 4. PostHog key is `''` — zero analytics
- **File**: `index.html:9960`, `landing.html:699`
- **Introduced**: Key was never configured
- **Why it matters**: All `track()` calls are silent no-ops. No funnel data, no error signals, no way to know if any recent change improved or hurt conversion.

---

## 🧹 Cleanup opportunities

### 5. `Givelink` category still in `CATS` after rebrand
- **File**: `index.html:2503, 2507, 2984`
- **Commit**: `72d9c68` ("Brand consistency: rebrand update banner + purge stray old-brand colors") — this pass missed the `CATS` map and `renderView` dispatch table
- **Why it matters**: "Givelink" appears in every task category dropdown. `renderGivelinkDash` is still registered in the view router — if somehow navigated to, it will throw or render garbage.

### 6. Dual Claude API key storage paths
- **File**: `index.html:11670`
- **Commit**: Leftover from a key migration — exact commit unclear
- **Why it matters**: Both `S.claudeKey` and `localStorage.getItem('taskos_api_key')` are checked. The `taskos_api_key` path is a dead branch. Users who set the key before the migration may have it in the old location and experience broken AI silently.

### 7. Service worker caches abandoned `givelink.html`
- **File**: `sw.js:17`
- **Commit**: `d635c06` ("Remove Givelink from Task OS") removed the product but didn't clean the SW cache manifest
- **Why it matters**: Every Arete PWA install downloads ~50KB of a deprecated product page on install. Slows install and wastes offline storage.

### 8. `profileName` defaults to `'Panos'`
- **File**: `index.html:2519`
- **Commit**: Early personalisation that was never generalised
- **Why it matters**: New users see "Good morning, Panos 👋" — immediately signals this is a personal tool, not a product for them.

### 9. Hardcoded `og:url` and `canonical` pointing to Vercel dev subdomain
- **File**: `index.html:24`, `landing.html:11, 17`
- **Commit**: Present since earliest commits
- **Why it matters**: Social shares and search indexing reference `task-management-beige-eight.vercel.app`, not a branded domain. May split SEO link equity.

---

## 🤔 Worth a second look

### 10. `api/claude.js` has no per-user rate limiting (explicitly flagged in its own comments)
- **File**: `api/claude.js:12`
- **Why it matters**: The comment says "For production add per-user rate limiting." Once `aiProxy` is set (which it must be to fix item 1), any authenticated user can call Claude without limit. This is intentional for a solo/early product but becomes a real risk the moment the app has more than a handful of active users or if shared publicly.
- **Pattern**: Looks intentional as a deferred TODO, but needs to land before the AI proxy goes live.

### 11. `_frOrganize` shows "Organizing your day…" animation but uses a local heuristic (no AI)
- **File**: `index.html:10521–10564`
- **Why it matters**: The animation implies AI is running. The actual implementation is a fast, local date-parser heuristic. This is deliberate design (works offline, zero latency) but the copy is misleading and sets a false expectation for subsequent AI features that _do_ require API key setup.
- **Pattern**: Looks intentional but the copy should be updated.

### 12. `taskos_frog_` and `taskos_premortem_` keys use date strings as localStorage keys
- **File**: `index.html:6019, 6678`
- **Why it matters**: Each unique date creates a new `localStorage` key (e.g., `taskos_frog_2026-08-05`). Over time (months of daily use), this can accumulate hundreds of dead keys. Not a production blocker today but eventually creates subtle `localStorage.setItem` failures on quota-limited browsers (iOS is ~5MB).
- **Pattern**: Looks intentional (per-day deduplication) but should be migrated to a rolling array in `S` to avoid unbounded key accumulation.

### 13. `renderView` dispatch table at `index.html:2984` — `givelink-dash` still registered
- **File**: `index.html:2984`
- **Why it matters**: `renderGivelinkDash` is registered in the view router. If this view name is navigated to (e.g., from a saved view or a link), the function may not exist or may render stale Givelink-specific data. Could throw a runtime error.
- **Pattern**: Likely an oversight from `d635c06`. Low risk (the navigation item was removed) but a latent crash vector.

### 14. `S` state object has 50+ top-level fields including `pitsOfDoom`, `treasureChests`, `maslowLog`
- **File**: `index.html:2517`
- **Why it matters**: Fields like `pitsOfDoom`, `treasureChests`, `deadEnds`, `impossiblePeople`, and `lifeFrameworksLog` appear to be stub arrays (`[]`) that are never written to by any render function in the codebase. They inflate the localStorage serialised state blob on every `save()`. Not harmful today, but their presence suggests half-built features that may never ship.
- **Pattern**: Intentional stubs or abandoned prototypes — worth a review to delete or document.

---

_30-item cap; 14 items found, quality over quantity. No commits landed in the 7-day window — all findings are standing debt, not regressions from this week._
