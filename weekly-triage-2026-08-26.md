# Weekly Triage — 2026-08-26

## 📊 Week at a glance

- **Commits this week**: 1 (`5cd9437`)
- **Files changed**: 1 (`README.md`)
- **Debt markers added this week**: 0 (no code files touched)
- **High-churn files**: N/A — only 1 commit this week
- **Feature commits without tests**: N/A — README-only week

The last meaningful code commit was `b38d4bb` (landed >7 days ago). This triage therefore broadens scope to flag pre-existing issues in files recently touched across the last few active sprints, since there is no new code churn to isolate.

---

## 🚨 Needs immediate attention

### 1. Push notification icon 404 — breaks notifications on Android
- **File**: `sw.js:46-47`, `index.html:11289`
- **Commit that introduced it**: `1fb177a` ("Rebrand app icon + logo to violet, add a launch splash") — the icons were moved from `icons/` to the root but sw.js was not updated.
- **Why this matters**: `icons/icon-192.png` does not exist. Push notifications sent to installed PWA users will have no icon. On Android, a failed icon fetch can suppress the notification.

### 2. XSS: checklist item text is raw in innerHTML
- **File**: `index.html:2529`
- **Commit that introduced it**: Appears to predate the last 7 days — present since the checklist feature was added.
- **Why this matters**: `c.text` (user-typed checklist text) goes directly into a `innerHTML` concatenation. A crafted payload can execute JavaScript and steal the Supabase `access_token` from localStorage.

### 3. XSS: task title unescaped in option elements
- **File**: `index.html:2543`
- **Commit that introduced it**: Pre-existing.
- **Why this matters**: Same class of vulnerability as #2. `t.title.slice(0,45)` goes into `innerHTML` without `esc()`. A title like `</option><script>` breaks the dependency picker DOM.

### 4. "Panos" hardcoded as default profile name — ships to all users
- **File**: `index.html:2519`
- **Commit that introduced it**: `0c1d32d` ("Rebrand to Arete + first-run magic moment…") — this is the personal-use codebase where the name made sense, but it now ships as a product.
- **Why this matters**: Every new user whose `taskos_name` localStorage key is absent sees "Good morning, Panos ☀️" throughout the dashboard. Immediate trust-killer in a public product.

### 5. AI proxy not wired up — all AI features silently dead for users
- **File**: `index.html:9959`
- **Commit that introduced it**: Appears never to have been configured (always empty string in `APP_CONFIG`).
- **Why this matters**: `APP_CONFIG.aiProxy = ''` means AI triage, day planning, AI commands all require the user to paste their own Claude API key. The feature is effectively hidden for 99% of visitors.

---

## 🧹 Cleanup opportunities

### 6. Givelink category and seeded tasks survive "Remove Givelink" commit
- **File**: `index.html:2503`, `index.html:4546–4605`
- **Commit**: `d635c06` ("Remove Givelink from Task OS (fully separate the two products) (#73)") — the UI entry points were removed but `CATS.givelink` and 8+ Givelink-specific seeded tasks remain.
- **Why this matters**: New users get tasks like "Nonprofits Board Follow Ups" and "Greek Nonprofits Board (Make-A-Wish etc.)" as starter data. Confusing and off-brand.

### 7. `S.givelinkMetrics` and `S.givelinkHistory` in the synced state blob
- **File**: `index.html:2517` (the `let S = {...}` state definition)
- **Commit**: Same as #6.
- **Why this matters**: Every user's Supabase sync payload includes `givelinkMetrics` and `givelinkHistory` keys — dead weight that inflates the sync blob and confuses future developers.

### 8. `_editChecklist` global array not reset between task opens
- **File**: `index.html:2520`
- **Commit**: Pre-existing; the checklist feature.
- **Why this matters**: Opening Task A, adding a checklist item, then opening Task B without saving leaves the stale items in `_editChecklist`. Saving Task B silently attaches Task A's checklist items to it.

### 9. Service worker cache version is a hardcoded date (`arete-20260723`)
- **File**: `sw.js:1`
- **Commit**: Last bumped in a prior sprint; not updated this week.
- **Why this matters**: Forgetting to bump this string on deploy means installed PWAs run stale JavaScript. Has already drifted — cache string says July 23 but codebase was updated after that.

### 10. `S.claudeKey` syncs to Supabase — API key in the cloud DB
- **File**: `index.html:2517`, `index.html:10408`
- **Commit**: Pre-existing.
- **Why this matters**: Users who opt to enter their own Claude API key have it stored in the `data` JSONB column of Supabase's `app_state` table. Any Supabase admin or future RLS gap exposes the key.

---

## 🤔 Worth a second look

### 11. `_sbToken()` does not handle concurrent refresh races
- **File**: `index.html:10022-10026`
- **Why**: If two calls to `callClaude()` fire simultaneously (e.g., "Plan My Day" + "AI Triage" both triggered quickly), both call `_sbToken()` concurrently. Both see an expired token, both call `_sbAuth('refresh_token', ...)`. The second refresh invalidates the first token. The second call then fails on the next API call with a 401. Unlikely in practice but worth a single-flight guard.
- **Suggested look**: Wrap the refresh in a cached promise (`let _sbRefreshPromise = null`) and reuse it if already in flight.

### 12. `toast()` accepts raw HTML strings and is called with dynamic content
- **File**: `index.html:2789` (`el.innerHTML = msg`), `index.html:2596` (caller with `onclick` attribute in the string)
- **Why**: The guest nudge toast at line 2596 inserts an `onclick` attribute into the toast HTML string — intentional, but the pattern means any future `toast(someUserContent)` is a stored XSS vector. The callsites that pass AI-error messages (`toast('AI error: '+e.message)`) are currently safe because `e.message` is a browser Error string, not user data, but this is fragile.
- **Suggested look**: Document which toast callers are "HTML-safe by design" vs. which should use `textContent`. Consider adding a `toast.text(msg)` variant.

### 13. `exportData()` uses `a.click()` on a dynamically-created anchor — no fallback
- **File**: `index.html:2601-2603`
- **Why**: On iOS Safari, programmatic `a.click()` on a blob URL is sometimes blocked. Users may see nothing happen when they tap "Download backup". There's no fallback (e.g., opening the blob URL in a new tab).
- **Suggested look**: Wrap in a user-gesture check or use `window.open(URL.createObjectURL(blob))` as a fallback for Safari.

---

*Triage kept under 30 items — quality over completeness. Items #1-5 are production bugs; #6-10 are cleanup from the Givelink separation; #11-13 are speculative risks worth a code review pass.*
