# Arete — Improvement Plan
_Generated 2026-09-29_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Hardcoded "Panos" name shown to all new users
- **What**: Every new user's greeting reads "Good morning, Panos 👋" and AI prompts reference "Panos" by name, framing advice around his specific startup and personal goals.
- **Where**: `index.html:2519` (`let profileName=...||'Panos'`), `index.html:1070` (greeting), `index.html:5647,5920,7319,7477,7849,7850,8604` (AI prompts)
- **Why it matters**: Every non-Panos user sees a stranger's name in their greeting and receives AI advice framed around "Greek founder building Givelink" — breaks trust instantly and makes the app feel unshipped.
- **Effort**: S
- **Suggested fix**:
  - Change the `profileName` default to `''` and render the greeting as "Good morning 👋" when no name is set.
  - Replace all hardcoded `Panos` references in AI prompt strings with `${profileName||'you'}` (or a `getAboutMe()` context block that only describes the user when they've filled it in).
  - Prompt for name during first-run flow if it isn't set.

---

### 2. Push notification shows a broken icon
- **What**: The service worker sends push notifications with icon path `./icons/icon-192.png` — a directory that does not exist.
- **Where**: `sw.js:47-48`
- **Why it matters**: On iOS/Android, every reminder notification shows a broken icon placeholder instead of the app icon — degrades trust in a critical re-engagement channel.
- **Effort**: S
- **Suggested fix**:
  - Change `icon:'./icons/icon-192.png'` → `icon:'./icon-192.png'` (and `badge` on the same line).
  - After fixing, bump the `CACHE` name in `sw.js:1` so clients pick up the corrected worker.

---

### 3. Service worker cache name is stale — deploys aren't reaching users
- **What**: `CACHE = 'arete-20260723'` is hardcoded to July 23, 2026 — two months in the past. Any deployment since that date serves the old cached version to returning users unless they manually clear storage.
- **Where**: `sw.js:1`
- **Why it matters**: Bug fixes and new features shipped after July 23 are invisible to returning users still served the stale cache, silently regressing them.
- **Effort**: S
- **Suggested fix**:
  - Replace the hardcoded date string with a build-time value, e.g. inject it via Vercel's `VERCEL_GIT_COMMIT_SHA` in a build step, or simply keep a `package.json` version bump as the trigger.
  - Simplest short-term fix: update to `arete-20260929` now; add a process to update on every deploy.

---

### 4. Claude API key stored in the synced `S` state object
- **What**: `S.claudeKey` is part of the main state object, which is serialized to `localStorage` and synced to Supabase. Any sync event pushes the API key to the cloud row.
- **Where**: `index.html:2517` (S definition includes `claudeKey:''`), `index.html:9917` (`S.claudeKey=k`), `index.html:5022` (key used in direct API call)
- **Why it matters**: The user's Anthropic API key (billing credential) is stored in the cloud row. A Supabase RLS misconfiguration or future admin access could expose it. It also appears in exported JSON (`Export my data`).
- **Effort**: M
- **Suggested fix**:
  - Move `claudeKey` out of `S` and store it separately in `localStorage` only (like `taskos_readwise_key` and `taskos_notion_key` already do).
  - Strip it from any Supabase push: add it to a `PRIVATE_KEYS` exclude-list in `sbPush()`.
  - Exclude it from the `Export my data` JSON, or document that it's included so users know.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. `.g4` 4-column grid has no mobile breakpoint — overflows on phones
- **What**: The `.g4` CSS class (4 equal columns) is used on several views and has no responsive rule — it stays 4 columns at any viewport width.
- **Where**: `index.html:108` (`.g4` definition); no matching `@media` rule anywhere in the file
- **Why it matters**: On a 375px phone, each column is ~78px — text truncates and tappable targets are ~18px wide, making those views completely unusable on mobile.
- **Effort**: S
- **Suggested fix**:
  - Add to the existing `@media(max-width:900px)` block: `.g4{grid-template-columns:repeat(2,1fr);}`.
  - Add to the existing `@media(max-width:768px)` block: `.g4{grid-template-columns:1fr;}`.

---

### 6. `aiProxy` is empty — no AI features work out of the box
- **What**: `APP_CONFIG.aiProxy = ''` means all AI features gate on the user entering their own Anthropic API key in Settings. There is no self-service path to get a key from inside the app.
- **Where**: `index.html:9959`
- **Why it matters**: The app's core value prop ("AI that plans your day") is invisible to 100% of new users who land without a key. Conversion from signup → first AI use is near zero.
- **Effort**: M
- **Suggested fix**:
  - Deploy the existing `api/claude.js` serverless function to Vercel and set `ANTHROPIC_API_KEY` in the project environment.
  - Set `aiProxy: '/api/claude'` in `APP_CONFIG`.
  - Remove the "Add API key in Settings" gates for primary flows (triage, plan day); keep them only for the direct-browser fallback path.

---

### 7. New users in hosted mode never see the first-run onboarding
- **What**: `_startFirstRun()` is only triggered inside `sbSyncNow()` when the cloud row is empty AND `arete_fr_done` is unset AND `!S._welcomed`. If the sync completes before `_startFirstRun` can fire, the condition is never met again.
- **Where**: `index.html:10431-10433`
- **Why it matters**: New hosted-mode signups land in an empty app with no guidance. Without onboarding, they churn before forming a habit.
- **Effort**: M
- **Suggested fix**:
  - Set `arete_fr_done` only after all steps of the first-run flow complete (not just on close).
  - In `_welcomeSeed()`, schedule `_startFirstRun()` unconditionally when `!localStorage.getItem('arete_fr_done')`.
  - Add an integration test: log in with a fresh account, verify onboarding slides appear.

---

### 8. `givelink.html` brand palette clashes with Arete's brand
- **What**: Givelink uses blue (`--accent:#3b82f6`) and pink (`--pr:#f472b6`) — neither matches the brand purple palette. `theme-color` is also blue.
- **Where**: `givelink.html:16-19`
- **Why it matters**: Givelink is a separate product living in the same domain. Its divergent color system signals an unfinished product and confuses users who see both.
- **Effort**: S
- **Suggested fix**:
  - Replace `--accent:#3b82f6` with `#6a58ee` (Arete brand purple) in givelink.html.
  - Replace `--pr:#f472b6` (pink-on-dark) with `#a78bfa` (lighter purple variant, or choose a non-pink indicator color).
  - Update `theme-color` meta from `#3b82f6` to `#0a0a0f`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. AI prompts hardcode personal founder context for all users
- **What**: Prompts at lines 5647, 5920, 7319, 7477, 7849, 8604 include static context like "Greek founder building Givelink", "SF move", "nonprofit fundraising SaaS" regardless of who is signed in.
- **Where**: `index.html:5647,5920,7319,7477,7849,8604`
- **Why it matters**: Every user gets advice framed around Panos's situation. AI quality degrades for all non-Panos users, and suggestions become actively misleading.
- **Effort**: M
- **Suggested fix**:
  - All these prompts already call `getAboutMe()` — ensure that function returns a generic fallback (`"a productivity-focused professional"`) when the user hasn't filled in the "About Me" field.
  - Strip all hardcoded `Panos`/`Givelink`/`SF move` references from the static prompt strings; they belong only in `getAboutMe()` output when the user sets them.

---

### 10. No rate limiting on the AI proxy — a single account can run up the bill
- **What**: `api/claude.js` validates a Supabase session but has no per-user call limit or token budget.
- **Where**: `api/claude.js:13` (comment acknowledges this)
- **Why it matters**: One user can programmatically call `/api/claude` thousands of times per day, burning the entire Anthropic budget. Noted as a known issue since the file was created.
- **Effort**: M
- **Suggested fix**:
  - Add a sliding-window rate limit keyed on `_SB.uid` using Upstash Redis (free tier covers ~10k req/day).
  - Alternatively, add a hard daily token cap per UID tracked in a Supabase table.
  - At minimum, add a request size gate: reject payloads where `prompt.length > 4000` (the current 20,000 char limit is generous).

---

### 11. `seed()` function contains the owner's personal tasks — shown to self-hosted deployers
- **What**: The `seed()` function populates ~80 tasks with personal goals, Givelink metrics, and specific life decisions (e.g. "Jim Rohn Academy California") for new installs in non-hosted mode.
- **Where**: `index.html:4557-4932`
- **Why it matters**: Anyone self-hosting (or running locally) sees Panos's personal backlog as demo data. It's confusing and undermines the app's credibility as a standalone product.
- **Effort**: M
- **Suggested fix**:
  - Replace the `seed()` content with a generic demo dataset (3-5 tasks per bucket that showcase the app's features without personal context).
  - Alternatively gate `seed()` behind a flag (`DEMO_MODE=true`) so it only runs in a controlled environment.

---

### 12. `save()` silently drops all data on `QuotaExceededError` after the warning
- **What**: When localStorage is full, `save()` catches the error and shows a toast — but the in-memory `S` object continues to accumulate new data that never gets written. On next reload, the user loses everything since the quota was hit.
- **Where**: `index.html:2578-2588`
- **Why it matters**: Users who hit quota (common for heavy users with large photo/body logs) lose all edits after the first warning toast, with no additional indication.
- **Effort**: M
- **Suggested fix**:
  - After the toast, set a module-level `_saveFailed=true` flag and show a persistent banner (not just a toast) until the user exports or cleans up.
  - In `save()`, if `_saveFailed`, re-attempt only a slimmed version of `S` (e.g., tasks + goals, stripping large log arrays).

---

## 💡 P3 — Nice to have

### 13. Accessibility: most interactive elements lack ARIA labels
- **What**: The entire 14,926-line app has only ~90 `aria-*` attributes. Icon-only buttons (FAB, close buttons, checkboxes) have no accessible names.
- **Where**: `index.html` throughout (FAB at line 256, close buttons at ~209, checkboxes at ~157)
- **Why it matters**: Screen-reader users get no usable label for the primary action buttons (add task, close modal, complete task). Violates WCAG 2.1 SC 4.1.2.
- **Effort**: M
- **Suggested fix**:
  - Add `aria-label` to all icon-only `<button>` elements (FAB, `.mc`, `.ic`, `.ck`).
  - Add `role="dialog"` and `aria-modal="true"` to all `.mo` and `.modal-bg` overlays.
  - Add `aria-checked` to `.ck` checkboxes that toggle task completion.

---

### 14. Missing `unhandledrejection` global handler — promise errors are silent
- **What**: There is a `window.addEventListener('error')` boot safety net (line 10647) but no `unhandledrejection` handler. Rejected promises from AI calls or sync errors disappear silently in production.
- **Where**: `index.html:10647`
- **Why it matters**: Hard to debug production issues without a way to catch and report promise rejections.
- **Effort**: S
- **Suggested fix**:
  - Add `window.addEventListener('unhandledrejection', e => { try{track('unhandled_rejection',{reason:String(e.reason)});}catch(_){} });` near the existing error handler.
  - If PostHog is configured, this surfaces as an event for investigation.

---

### 15. `og:url` and `canonical` point to the Vercel preview URL, not a custom domain
- **What**: `og:url` in index.html and `<link rel="canonical">` in landing.html both point to `https://task-management-beige-eight.vercel.app/`.
- **Where**: `index.html:24`, `landing.html:11`
- **Why it matters**: When the app moves to a custom domain, all social shares and SEO signals will point to the wrong URL, splitting link equity and confusing link previews.
- **Effort**: S
- **Suggested fix**:
  - Move the canonical URL into a Vercel environment variable (`VITE_CANONICAL_URL` or similar) and inject it at build time, or accept it as a manual update when the domain changes.
  - For now, update both to the final domain once confirmed.
