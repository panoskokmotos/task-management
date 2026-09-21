# Givelink / Arete — Improvement Plan

_Generated 2026-09-21_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Claude API key synced to Supabase database
- **What**: `S.claudeKey` lives inside the `S` state blob that `sbPush()` sends verbatim to Supabase — user API keys end up stored server-side in plaintext.
- **Where**: `index.html:9917` (stored into S), `index.html:10408` (`body:[{…data:S…}]`)
- **Why it matters**: Anthropic API keys provide billing access. Any Supabase compromise, misconfigured RLS, or support-ticket DB inspection leaks real money-spending credentials. This is a P0 even for a single-user app.
- **Effort**: S
- **Suggested fix**:
  - Strip credentials before push: `const {claudeKey, ...syncable} = S; sbPush(syncable)`
  - Store `claudeKey` in `localStorage` under its own key (`taskos_claude_key`) outside the synced blob.
  - Same pattern for `readwiseKey`, `notionKey` — none of these belong in the sync payload.

---

### 2. Push notification icons point to non-existent path
- **What**: Service worker references `./icons/icon-192.png` for notification icon/badge, but the `icons/` directory does not exist; the file is at `./icon-192.png`.
- **Where**: `sw.js:46-47`
- **Why it matters**: All push notifications land with no icon, silently degrading the reminder feature. `showNotification` silently ignores a 404 path, so this is invisible in dev.
- **Effort**: S
- **Suggested fix**:
  - Change both lines to `'./icon-192.png'`.
  - Add a smoke test: `fetch('./icon-192.png').then(r=>console.assert(r.ok,'icon missing'))` inside the SW install handler.

---

### 3. XSS — task title injected into toast HTML without escaping
- **What**: The delete toast at line 3844 uses `t.title.slice(0,30)` directly inside an HTML template literal rendered via `innerHTML`.
- **Where**: `index.html:3844`
- **Why it matters**: A task title like `<img src=x onerror=alert(1)>` will execute JavaScript. The same user who set the title triggers it, so it's self-XSS now; it becomes shared XSS if any multi-user sharing lands (accountability invites, shared goals).
- **Effort**: S
- **Suggested fix**:
  - Replace `${t.title.slice(0,30)}` with `${esc(t.title.slice(0,30))}` — `esc()` is already defined at line 11776.
  - Audit all other `toast()` calls that interpolate user data (line 2596, 3893) for the same pattern.

---

### 4. XSS — task/goal titles unescaped in weekly review wizard
- **What**: `renderWizPanel()` builds HTML strings with `${t.title}` and `${g.title}` inserted bare into `body.innerHTML`.
- **Where**: `index.html:3594` (completed tasks), `index.html:3601` (backlog), `index.html:3603` (goal progress)
- **Why it matters**: Same attack surface as #3. The weekly review is a high-engagement surface; any malicious title crafted before a review session fires.
- **Effort**: S
- **Suggested fix**:
  - Replace each `${t.title}` / `${g.title}` with `${esc(t.title)}` / `${esc(g.title)}`.
  - Check `tcHTML()` and `goalHTML()` helper functions for the same pattern — they are rendered into `innerHTML` in many places.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Claude API key included in user data export
- **What**: `exportData()` dumps `JSON.stringify(S)`, which includes `S.claudeKey`. A user sharing their backup file (e.g. for support) leaks their API key.
- **Where**: `index.html:2599-2604`
- **Why it matters**: Users don't expect that "export my tasks" means "export my API key". This is also a customer support liability.
- **Effort**: S
- **Suggested fix**:
  - Build the export blob with credentials stripped: `const {claudeKey, ...exportable} = S; JSON.stringify(exportable)`.
  - Show a warning in the export UI: "API keys are not included in the export."

---

### 6. AI proxy has no rate limiting — single account can drain Anthropic budget
- **What**: `/api/claude.js` has no per-user or global call limit. The code's own comment acknowledges this: _"For production add per-user rate limiting (e.g. Upstash)"_.
- **Where**: `api/claude.js:12` (comment), entire handler
- **Why it matters**: One abusive (or compromised) account can run thousands of requests, creating an unbounded Anthropic bill. Zero mitigation on a publicly accessible proxy.
- **Effort**: M
- **Suggested fix**:
  - Add [Upstash Ratelimit](https://upstash.com/docs/oss/sdks/ts/ratelimit/overview): sliding window of ~50 requests/user/day keyed by Supabase UID.
  - Add a global daily cap as a second layer (e.g. 1000 total requests/day), alert at 80%.
  - Return `429` with a clear user-facing message when limit is hit.

---

### 7. `givelink.html` collects API key via browser `prompt()` dialog
- **What**: Two call sites in `givelink.html` use `window.prompt('Enter your Anthropic API key:')` to collect the API key, storing it in `localStorage`.
- **Where**: `givelink.html:1155`, `givelink.html:1330`
- **Why it matters**: `prompt()` dialogs are blocked by default in many browsers when called from inside iframes or after interaction. They show no masking (key visible in plain text), have no validation, and feel broken to modern users. This likely causes silent AI feature failures for Givelink users.
- **Effort**: M
- **Suggested fix**:
  - Add a compact inline settings panel (≤10 lines HTML) similar to index.html's settings modal.
  - Use a `type="password"` input with a clear label and save button.
  - Show/hide based on `localStorage.getItem('taskos_api_key')`.

---

### 8. Service worker cache key is 2 months stale
- **What**: `CACHE = 'arete-20260723'` was last updated July 23; today is September 21. Any user who installed the PWA in July is running 2-month-old cached HTML.
- **Where**: `sw.js:1`
- **Why it matters**: Bug fixes and new features (#84 Givelink fixes, #85 keep-alive) are invisible to returning PWA users until they manually clear cache. Bugs that were fixed in September are still live for these users.
- **Effort**: S
- **Suggested fix**:
  - Update `CACHE = 'arete-20260921'` now.
  - Add a comment `// bump this string on every deploy that changes HTML/CSS/JS` and include it in the deploy checklist.
  - Long term: automate cache key with a build timestamp injected via CI.

---

### 9. PostHog analytics key is empty — no conversion data
- **What**: `posthogKey: ''` means `_initPostHog()` returns early and no events are captured — `track('signup',...)`, `track('task_completed',...)` etc. all fire into a void.
- **Where**: `index.html:9960`
- **Why it matters**: PLG motions (templates gallery, referral links, share-the-win, guest mode) have shipped (#76–#79) but there is zero data on whether any of them convert. Guest nudge, first-win celebration, onboarding tour — all invisible without analytics.
- **Effort**: S
- **Suggested fix**:
  - Create/retrieve the PostHog project key and set `posthogKey: 'phc_...'`.
  - Verify the key is working by checking the PostHog Live Events dashboard.
  - Document key rotation procedure.

---

### 10. Last-write-wins sync can silently overwrite data on clock skew
- **What**: `sbSyncNow()` compares `remote.ms` (parsed from a Supabase ISO timestamp) with `S._updatedAt` (a JS `Date.now()` millisecond integer). If the device clock is even slightly ahead, the local data is always treated as newer and pushed — remote changes from another device are lost.
- **Where**: `index.html:10417-10418`
- **Why it matters**: Multi-device sync is a key selling point. A phone and laptop with a ~1s clock skew can silently lose sync. Users will see tasks they added on one device disappear.
- **Effort**: M
- **Suggested fix**:
  - Add a server-timestamp via a Supabase function or the `updated_at` column (which is server-authoritative) as the merge key instead of relying on `Date.now()`.
  - At minimum, add a 30s grace window: only treat remote as newer if `remote.ms > localMs + 30000`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. API key stored inside `S` blob — architectural root cause
- **What**: `S.claudeKey` (and implicitly Notion/Readwise keys in localStorage, but claudeKey is in `S`) is in the same data store as tasks and goals, making it impossible to sync, export, or log the app state without also handling credentials.
- **Where**: `index.html:2517` (S declaration), `index.html:9917`
- **Why it matters**: P0 items #1 and #5 are symptoms of this. As long as the key lives in `S`, every new feature touching state (export, share, snapshot, AI summary) is a new credential leak risk.
- **Effort**: M
- **Suggested fix**:
  - Remove `claudeKey` from the `S` schema.
  - Store it at `localStorage.getItem('taskos_claude_key')` only; access via a `getClaudeKey()` helper.
  - Migration: on app load, if `S.claudeKey` exists, move it to `localStorage('taskos_claude_key')` and delete from `S`.

---

### 12. 15,000-line monolithic HTML file
- **What**: All app logic — 700+ functions, all CSS, all HTML — in one `index.html`. No modules, no tests, no separation of concerns.
- **Where**: `index.html` (entire file)
- **Why it matters**: Diffs are unreadable (a 200-line PR touches 14k context), bugs hide in the noise, and performance suffers as the browser parses the entire script on every load. Review quality is degrading.
- **Effort**: L
- **Suggested fix**:
  - Start extraction with the most self-contained unit: Supabase sync (`~200 lines`, lines 9938–10441) → `sync.js`.
  - Then the AI feature group (`callClaude` + all AI functions, ~400 lines) → `ai.js`.
  - Use `<script type="module" src="sync.js">` — no bundler needed for this codebase.
  - Don't try to do it all at once; extract one module per sprint.

---

### 13. Hardcoded Supabase credentials require code change to rotate
- **What**: `supabaseUrl` and `supabaseAnon` are hardcoded string literals in the JS (not in a separate config file).
- **Where**: `index.html:9957-9958`
- **Why it matters**: Rotating the project (e.g. due to hitting free tier limits) requires a code change + redeploy. Env var injection is not possible in a purely static HTML file without a build step.
- **Effort**: M
- **Suggested fix**:
  - Inject config via a tiny `config.js` served by the same static host: `window.__APP_CONFIG = { supabaseUrl: '...', supabaseAnon: '...' }`.
  - `index.html` reads `window.__APP_CONFIG` with fallback to the hardcoded values (backward compat).
  - Vercel supports static file serving — add `config.js` to `.gitignore` and document it in README.

---

### 14. `_removePasteItem(i)` guard added but callers may pass stale indices
- **What**: Commit `72e03fe` added a bounds check (`if(i<0||i>=_pasteItems.length)return`) but the paste preview renders onclick handlers with indices baked in. If items are reordered between renders, the saved index may silently no-op instead of deleting the intended item.
- **Where**: `index.html:12542`, `index.html:~12560` (paste preview render)
- **Why it matters**: "Remove this item from import" silently fails, leaving unwanted tasks in the import queue. Low-frequency but disorienting when it happens.
- **Effort**: S
- **Suggested fix**:
  - Key the delete button by item `id` (add a temporary `id` to each paste item on parse), not by array index.
  - Re-render the preview after every removal so indices stay fresh.

---

## 💡 P3 — Nice to have

### 15. Pink `#f783ac` hardcoded on Givelink dashboard — off-brand
- **What**: The "Users Reached" stat on the Givelink dashboard uses `color:#f783ac` (a bright pink) while every other stat uses domain-specific colors. Givelink's palette is blue/purple (`--accent: #3b82f6`).
- **Where**: `index.html:8649`
- **Why it matters**: The dashboard feels inconsistent; a founder metric display should feel cohesive.
- **Effort**: S
- **Suggested fix**: Replace with `var(--accent)` or `#a78bfa` (purple, matching the impact-goal card above it).

---

### 16. `api/claude.js` hardcodes model name — can't upgrade without a deploy
- **What**: `'claude-haiku-4-5-20251001'` is a string literal in the proxy.
- **Where**: `api/claude.js:43`
- **Why it matters**: When Haiku is superseded, upgrading requires a code change; there's also no way to A/B test a smarter model on specific flows.
- **Effort**: S
- **Suggested fix**: Read from `process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'`. Set the env var in Vercel per-environment.

---

### 17. No `alt` attributes on app screenshot images in landing page
- **What**: The hero product screenshot (`shot-app.png`) and demo images in `landing.html` have no `alt` text.
- **Where**: `landing.html` (hero section, demo section)
- **Why it matters**: Screen readers describe nothing; also hurts image SEO.
- **Effort**: S
- **Suggested fix**: Add descriptive `alt` text: `alt="Arete task dashboard showing today's plan, goals, and AI inbox triage"`.

---

### 18. AI proxy missing `Origin` / CSRF validation
- **What**: `/api/claude.js` accepts any POST from any origin — no CORS restriction, no origin check.
- **Where**: `api/claude.js` (entire handler)
- **Why it matters**: Combined with #6 (no rate limiting), any site can make users unknowingly burn their API budget via cross-site requests. With SUPABASE_URL unset, there's no auth gate at all.
- **Effort**: S
- **Suggested fix**:
  - Add: `if (req.headers.origin && !req.headers.origin.includes('vercel.app')) { res.status(403).json({error:'Forbidden'}); return; }` (adjust to your actual domain).
  - Or set CORS headers in `vercel.json` to restrict to your domain.

---

_Max 20 items. Ordered within each tier by business impact × fix effort._
