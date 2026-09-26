# Weekly Triage — 2026-09-26

## 📊 Week at a glance
- **Commits this week:** 0 (last commit was 2026-09-12, 14 days ago)
- **Files changed this week:** 0
- **Debt markers added this week:** 0 (no changed files to scan)
- **High-churn files:** N/A — no activity this week
- **Status:** Codebase is quiet. No active PRs. Last merged work was #85 (Supabase keep-alive) and #84 (Givelink bug fixes + This Week view), both from Sept 12.

---

## 🚨 Needs immediate attention

These are **pre-existing issues** found during the codebase scan that are either in production now or will surface on the next user interaction:

### 1. SW push notifications broken: wrong icon path
**File:** `sw.js:43-44`
**Commit introduced:** `0c1d32d` (Rebrand to Arete) — the `icons/` subdirectory was never created.
**Why this matters:** Every push notification shows a broken image. The `./icons/icon-192.png` path does not exist on disk; the actual file is `./icon-192.png`. Users on mobile will see a broken notification chrome.

### 2. `givelink.html` makes direct API calls with user key in browser headers
**File:** `givelink.html:1200-1210`, `1333-1340`
**Commit introduced:** Predates recent history — present since Givelink was split into its own file (`d635c06`).
**Why this matters:** The Anthropic API key is sent in `x-api-key` headers visible in the browser's DevTools network panel. The fallback path uses `window.prompt()` which is blocked in standalone PWA mode.

### 3. `aiProxy` is blank — all hosted AI features dead-end on a toast
**File:** `index.html:9959`
**Commit introduced:** Never configured — this is a deploy-time gap, not a code regression.
**Why this matters:** The AI features ("Plan My Day", "Priority Audit", etc.) are the primary value prop for the product. With `aiProxy: ''`, every hosted user who taps them hits "Add your Claude API key in Settings" — a wall, not a magic moment.

### 4. Canonical/OG URLs point to the Vercel staging hostname
**File:** `landing.html:11,16,17,21`, `sitemap.xml:4`
**Commit introduced:** `b38d4bb` (Landing growth, SEO foundation) — the canonical was set to the Vercel preview URL and never updated.
**Why this matters:** Google is consolidating SEO equity to `task-management-beige-eight.vercel.app` instead of any production domain. Social shares show the same URL. This actively blocks organic acquisition.

---

## 🧹 Cleanup opportunities

### 5. `posthogKey` is an empty string — no analytics collected
**File:** `index.html:9960`
**Commit:** Appears to have been left blank since `0c1d32d` (Rebrand).
**Why this matters:** All `track()` calls throughout the app no-op. The PostHog init check at line 10392 runs but captures nothing. No data to support any product decision.

### 6. Pervasive empty `catch(e){}` blocks silence all runtime errors
**File:** `index.html` — 50+ occurrences across lines 2587, 2949, 3031, 3583, 3868 (and many more).
**Commit introduced:** Long-standing pattern, not new this week.
**Why this matters:** When something breaks in production, there is no error trail. A `window.onerror` handler or replacing the empty bodies with `console.error` would surface issues immediately in PostHog (once the key is configured).

### 7. `api/claude.js` rate limiting acknowledged but not implemented
**File:** `api/claude.js:12`
**Commit introduced:** `f883adf` (PLG Tier 1) — the proxy was added with a comment noting rate limiting is still needed.
**Why this matters:** A single compromised session or abusive account can make unlimited calls to Anthropic through the proxy, with no per-user quota or circuit breaker.

### 8. `givelink.html` hardcodes founder name in AI prompts
**File:** `givelink.html:1566`, `1711`
**Commit introduced:** `72e03fe` (Givelink bug fixes).
**Why this matters:** The standup generator and email drafter reference "Panos Evangelou" and Givelink's product context literally. Any second user of the sprint board gets output attributing it to someone else.

---

## 🤔 Worth a second look

### 9. `sbSyncNow` uses last-write-wins merge (`S={...S,...remote.data}`)
**File:** `index.html:10421`
**Commit introduced:** `28dc1b8` (Land on Today after login) and earlier sync work.
**Why this matters:** When `remote.ms > localMs`, all local state is replaced wholesale. This is correct for single-device use, but a user who edits tasks offline and then syncs will lose those changes silently. Intentional for now given single-user focus, but worth flagging before multi-device usage grows.

### 10. `_afterAuth()` fires `sbSyncNow(true)` inside a `try{}catch(e){}` with no user feedback on failure
**File:** `index.html:10131`
**Commit introduced:** `28dc1b8`.
**Why this matters:** If the initial sync after login fails (e.g. Supabase is paused), the user lands on the dashboard with stale or empty data and no indication that sync failed. The `_sbRenderPill()` call on line 10132 will show the pill but only after the silent failure.

### 11. SW cache key `arete-20260723` is dated but not auto-bumped on deploy
**File:** `sw.js:1`
**Commit introduced:** `0c1d32d` (Rebrand to Arete).
**Why this matters:** If `index.html` changes but the SW cache name doesn't, users on iOS PWA installs may continue serving the old cached HTML indefinitely (the SW's `install` event won't re-run). Currently mitigated by the network-first strategy for HTML, but a stale static asset cache (images, icons) could still hold old versions. Consider bumping this as part of each release.
