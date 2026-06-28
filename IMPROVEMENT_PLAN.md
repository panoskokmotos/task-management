# Givelink — Improvement Plan
_Generated: 2026-06-28 | Scope: index.html (12,893 lines), givelink.html (1,755 lines), sw.js, supabase-setup.sql, vercel.json_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Claude API key lives in the browser — exposed to any XSS or extension

- **What**: `callClaude()` sends the user's Anthropic key in a request header with `anthropic-dangerous-direct-browser-access: true`; the key is stored unencrypted in `localStorage` (`taskos_api_key`) and serialised into the main `S` state blob.
- **Where**: `index.html:4136-4139`, `givelink.html:1086-1131`
- **Why it matters**: Any injected script, malicious browser extension, or XSS payload in a task note can silently exfiltrate the key. The `anthropic-dangerous-direct-browser-access` header is a temporary escape hatch, not a production pattern.
- **Effort**: M
- **Suggested fix**:
  - Route all Claude calls through a thin Vercel Edge Function (`/api/ai`) that holds the key in an environment variable and proxies requests.
  - Drop the `anthropic-dangerous-direct-browser-access` header entirely.
  - Remove `claudeKey` from the serialised `S` object so it never touches `localStorage` or Supabase.

---

### 2. Supabase `updated_at` column is never updated after insert — sync conflict resolution is broken

- **What**: The SQL schema sets `updated_at default now()` at row creation but has no `BEFORE UPDATE` trigger. The multi-device sync logic (`sbSyncNow`) compares `remote.ms` (derived from this column) to `S._updatedAt` — but the column never changes after the first write, so the remote timestamp is always stale.
- **Where**: `supabase-setup.sql:10`, `index.html:8618`
- **Why it matters**: On a second device, the pull always sees `remote.ms < localMs`, so it always pushes instead of pulling. Two devices in use simultaneously will silently overwrite each other's data.
- **Effort**: S
- **Suggested fix**:
  - Add a trigger to `supabase-setup.sql`: `CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER app_state_updated_at BEFORE UPDATE ON public.app_state FOR EACH ROW EXECUTE FUNCTION set_updated_at();`
  - Also add `CREATE INDEX ON public.app_state (updated_at);` for efficient freshness checks.

---

### 3. Brand colour system is blue everywhere — not the specified purple palette

- **What**: Both apps use a GitHub-style blue/cyan theme as their primary brand colour. `index.html` declares `--brand:#58a6ff; --accent:#58a6ff` (dark mode) and `--brand:#2563eb` (light mode). `givelink.html` uses `--accent:#3b82f6` and `<meta name="theme-color" content="#3b82f6">`. None of these match the brand palette (#6B3FA0 / #5718CA purple, #C2185B / #E353B6 pink).
- **Where**: `index.html:19-34`, `givelink.html:6,17`, every CTA button (`.bp`), nav active state (`.ni.active`), FAB, progress bars
- **Why it matters**: Every user-visible interactive element — buttons, active links, focus rings, gradients — renders in the wrong colour. If Givelink is being pitched to donors/nonprofits, the off-brand palette undermines trust immediately.
- **Effort**: S
- **Suggested fix**:
  - In `index.html` `:root`: change `--brand:#6B3FA0; --brand2:#E353B6; --accent:#6B3FA0; --brand-gradient:linear-gradient(135deg,#6B3FA0,#5718CA);`
  - In `body.light`: `--brand:#5718CA; --brand2:#C2185B; --accent:#5718CA;`
  - In `givelink.html` `:root`: `--accent:#6B3FA0;` and update `<meta name="theme-color" content="#6B3FA0">`.
  - Audit for hardcoded hex values (`#58a6ff`, `#2563eb`, `#3b82f6`) used inline in style attributes.

---

### 4. `Content-Security-Policy` allows `unsafe-inline` scripts — XSS protection nullified

- **What**: `vercel.json:14` sets `script-src 'self' 'unsafe-inline'`. Because the entire app is one inline `<script>` block, `unsafe-inline` is required — but it also means any injected script runs without restriction.
- **Where**: `vercel.json:14`
- **Why it matters**: The CSP header is visible to users/auditors as a trust signal, and it currently offers zero XSS protection. For a tool that stores personal health data, finances, and API keys, this is a meaningful risk disclosure.
- **Effort**: L
- **Suggested fix**:
  - Long-term: extract the inline JS to a separate `app.js` file and remove `unsafe-inline`.
  - Short-term: generate a nonce at the Vercel Edge layer, inject it into the `<script>` tag, and set `script-src 'self' 'nonce-{nonce}'`.
  - As a minimum patch: add a `report-uri` directive to at least detect injections in production.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Service worker `skipWaiting()` + `clients.claim()` can serve mismatched versions

- **What**: `sw.js:18` calls `self.skipWaiting()` unconditionally inside `install`, and `sw.js:27` calls `self.clients.claim()` on `activate`. A new SW activates immediately, even if the user has the old HTML open in another tab — resulting in the v1 page being controlled by the v2 SW.
- **Where**: `sw.js:18`, `sw.js:27`
- **Why it matters**: If a deploy changes localStorage key names or the state schema, a user with an open tab gets the new SW serving assets that expect the new schema while the page still holds old state. This can corrupt `S` silently.
- **Effort**: S
- **Suggested fix**:
  - Remove `self.skipWaiting()` from `install`. Let the SW wait.
  - In the page's update banner click handler (`index.html:~8675`), post `{ type: 'SKIP_WAITING' }` to the waiting SW before reloading.
  - Add a `message` listener in `sw.js` that calls `self.skipWaiting()` on receiving that message.

### 6. Offline AI call returns empty 503 — `callClaude()` crashes with SyntaxError instead of graceful toast

- **What**: When offline, `sw.js:91` intercepts Claude API requests and returns `new Response('', { status: 503 })` with no body and no `Content-Type`. `callClaude()` at `index.html:4142` then calls `res.json()` on this empty body, which throws a `SyntaxError`, caught by the outer `catch(e)` block — but the error message shown is `"AI error: Unexpected end of JSON input"` rather than "You appear to be offline."
- **Where**: `sw.js:91`, `index.html:4142-4148`
- **Why it matters**: Users who are offline see a cryptic JSON parse error instead of a clear offline message, causing confusion about whether the key or the app is broken.
- **Effort**: S
- **Suggested fix**:
  - In `sw.js:91`: `return new Response(JSON.stringify({error:'offline'}), { status: 503, headers: {'Content-Type':'application/json'} });`
  - In `callClaude()` at `index.html:4141`: check `if(res.status === 503) { toast('You appear to be offline — AI unavailable'); return null; }`

### 7. Givelink default sprint dates are in the past — burndown shows 0 days left on fresh install

- **What**: `givelink.html:437` hardcodes the default sprint as `startDate: '2026-03-28', endDate: '2026-04-11'`. Today is 2026-06-28. A first-time user opening the app sees a sprint that ended 78 days ago, a burndown at 0, and velocity metrics that make no sense.
- **Where**: `givelink.html:437` (default `S` object)
- **Why it matters**: The first impression for a new Givelink user is broken core UX — the sprint tracker, the centrepiece of the app, is immediately stale.
- **Effort**: S
- **Suggested fix**:
  - Replace hardcoded strings with dynamic defaults: `startDate: new Date().toISOString().slice(0,10)` and `endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0,10)`.
  - Apply the same fix to any seeded sprint in `index.html:seed()`.

### 8. Sidebar nav items are non-focusable `<div>` elements — keyboard users can't navigate

- **What**: Every `.ni` nav item in `index.html` is a `<div onclick="nav('...')">` with no `tabindex`, `role`, or keyboard event handler. The same pattern appears for all sidebar sections.
- **Where**: `index.html` sidebar HTML (all `.ni` elements, approximately lines 570-800); `givelink.html:233-244`
- **Why it matters**: Keyboard-only users (including many power users and users with motor disabilities) cannot navigate to any section of the app. `Tab` skips every nav item.
- **Effort**: M
- **Suggested fix**:
  - Change all `.ni` elements to `<button class="ni" onclick="nav('...')">` or add `tabindex="0" role="button"` and a `keydown` handler.
  - The CSS already handles button resets (`.ni` has no border/background from button defaults); a global `button.ni { all: unset; }` override handles the rest.

### 9. Modals have no `role="dialog"`, `aria-modal`, or focus trap

- **What**: All modal divs (`.mo` class) in both files lack `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`. Focus is not trapped inside them, so screen readers and keyboard users can interact with content behind the modal.
- **Where**: `index.html` task modal, confirm modal, prompt modal (approximately lines 620-660); `givelink.html:317` and all other modals
- **Why it matters**: Screen reader users will not know a modal has opened, and Tab will cycle through the entire page background while the modal is open.
- **Effort**: M
- **Suggested fix**:
  - Add `role="dialog" aria-modal="true" aria-labelledby="modal-title-id"` to each `.mo` element.
  - In the `openAdd()` / modal-open function, after display, run a focus-trap: collect all focusable children, intercept Tab/Shift-Tab to cycle within them, restore focus to the trigger element on close.

### 10. CRM kanban is a 6-column grid with no mobile breakpoint — horizontal scroll trap on phones

- **What**: `givelink.html:197` sets `.crm-kanban { grid-template-columns: repeat(6, 1fr); min-width: 160px }`. On a 375px phone, this forces 960px of content with no column collapse. Users can scroll horizontally but there is no affordance (no scroll indicator, no swipe hint).
- **Where**: `givelink.html:197`
- **Why it matters**: The CRM is the core Givelink feature. On mobile — where nonprofit founders frequently work — it's an unusable horizontal scroll maze.
- **Effort**: S
- **Suggested fix**:
  - Add `@media(max-width:768px) { .crm-kanban { grid-template-columns: 1fr; } }` to collapse to a stacked list on mobile.
  - Alternatively, switch to a horizontal scroll container with `scroll-snap-type: x mandatory` and visible scroll indicators.

### 11. Touch targets below 44px on mobile — ham button and bottom nav items

- **What**: The hamburger button is `38×38px` (`givelink.html:151`) and bottom nav items have only `7px` vertical padding, resulting in effective tap targets of approximately 36px tall — below the WCAG 2.5.5 minimum of 44×44px.
- **Where**: `givelink.html:151` (`.ham-btn`), `givelink.html:172` (`.bni`)
- **Why it matters**: On iOS/Android, sub-44px targets cause frequent mis-taps — a constant micro-friction for mobile users. Apple HIG and Google Material both require 44/48px targets.
- **Effort**: S
- **Suggested fix**:
  - `.ham-btn { width: 44px; height: 44px; }` — the visual icon can stay 38px; use padding to expand the target.
  - `.bni { padding: 10px 6px; }` to reach 44px effective height.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 12. `seed()` function is 394 lines of hardcoded personal tasks — untestable, unmaintainable

- **What**: `index.html:3659` contains a `seed()` function that is 394 lines long, filled with personal tasks in Greek (`τεχνικός`), specific personal financial goals (`€25K`), health targets (`12% body fat`), and named contacts. This runs on every fresh install and cannot be unit-tested without parsing a 13k-line HTML file.
- **Where**: `index.html:3659-4053`
- **Why it matters**: Any change to the task/goal data model requires updating this function manually. New contributors can't reason about it. It also leaks personal data in a public repo.
- **Effort**: M
- **Suggested fix**:
  - Extract seed data to a `seedData.js` (or a `<script type="application/json" id="seed-data">`) block that is declarative JSON, not imperative code.
  - Scrub personal information (specific prices, names, health metrics) and replace with generic illustrative defaults.
  - Gate the seed behind a `localStorage` flag that is checked only on first load.

### 13. SW cache key `task-os-20260530` must be manually bumped on every deploy

- **What**: `sw.js:1` has a hardcoded date-based cache version string. If a developer forgets to update it, all users continue to be served the old cached HTML indefinitely, even after a deploy.
- **Where**: `sw.js:1`
- **Why it matters**: This has likely already happened (the date `20260530` is nearly a month behind today's date `20260628`). Silent stale-cache delivery is invisible until users report "why doesn't my change work?"
- **Effort**: S
- **Suggested fix**:
  - Use Vercel's `VERCEL_GIT_COMMIT_SHA` env var injected at build time: add a build step (e.g. `npm run build` script) that replaces `CACHE_VERSION_PLACEHOLDER` with the commit SHA.
  - Or use a Vercel Edge Middleware to inject the hash into the served `sw.js` response.
  - At minimum, switch to a date that auto-updates: `const CACHE = 'task-os-' + new Date().toISOString().slice(0,10);` — but this would invalidate cache on every deploy, which is acceptable for a personal tool.

### 14. No `DELETE` RLS policy — Supabase users can never delete their own data row

- **What**: `supabase-setup.sql` defines `select`, `insert`, and `update` policies but no `delete` policy. With RLS enabled, absence of a policy means the operation is blocked.
- **Where**: `supabase-setup.sql:14-30`
- **Why it matters**: If a user wants to reset their cloud data (e.g. start fresh, switch accounts), they cannot. The only recourse is to contact the Supabase project admin. For a self-hosted tool, this is a data ownership issue.
- **Effort**: S
- **Suggested fix**:
  - Add to `supabase-setup.sql`: `create policy "app_state delete own" on public.app_state for delete using (auth.uid() = user_id);`
  - Add a "Delete cloud data" button in Settings → Cloud Sync that calls `DELETE /rest/v1/app_state?user_id=eq.{uid}`.

### 15. AI JSON parse pattern duplicated 4+ times — should be a shared helper

- **What**: The same 3-line pattern (`text.replace(/```[\w]*\n?/g,'').trim()` → `match(/\[[\s\S]*\]/)` → `JSON.parse`) appears verbatim at `index.html:10282`, `10387`, `10485`, and `10564`.
- **Where**: `index.html:10282,10387,10485,10564`
- **Why it matters**: Any change to the JSON extraction logic (e.g. handling objects vs arrays, or improving regex) must be made in four places. Each copy has already diverged slightly.
- **Effort**: S
- **Suggested fix**:
  - Extract to `function _parseAiJson(text, fallback) { try { const s = text.replace(/\`\`\`[\w]*\n?/g,'').trim(); const j = s.match(/[\[{][\s\S]*[\]}]/)?.[0]; return j ? JSON.parse(j) : null; } catch(e) { return null; } }`
  - Replace all four call sites.

### 16. `callClaude()` hardcodes `claude-haiku-4-5-20251001` model ID

- **What**: `index.html:4139` embeds the model ID inline in the fetch body. If this model ID is deprecated (as Anthropic regularly deprecates suffixed model IDs), every AI feature in the app silently fails with a 404 response that looks like an auth error.
- **Where**: `index.html:4139`; also `givelink.html:1140,1256,1660`
- **Why it matters**: Silent breakage of the primary AI features (task sequencing, review, coaching) with misleading error messages.
- **Effort**: S
- **Suggested fix**:
  - Define `const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';` as a named constant at the top of the script block.
  - Optionally expose it as a user-configurable setting in the Settings → AI section, defaulting to `claude-haiku-4-5-20251001`.

### 17. SW static asset path matching uses `endsWith()` — can hit unintended paths

- **What**: `sw.js:62` checks `url.pathname.endsWith(s.replace('./', '/'))`. For `./manifest.json`, this matches any URL ending in `/manifest.json` — including `/admin/manifest.json` or `/other-app/manifest.json` on the same origin.
- **Where**: `sw.js:62`
- **Why it matters**: Incorrect cache matches serve stale cached assets to URLs that should bypass the cache, which can cause subtle hard-to-diagnose bugs during iterative development.
- **Effort**: S
- **Suggested fix**:
  - Replace with exact path matching: `const STATIC_PATHS = new Set(['/manifest.json','/manifest-givelink.json','/icon.svg','/icon-gl.svg']);` and `if (isLocal && STATIC_PATHS.has(url.pathname)) { ... }`

---

## 💡 P3 — Nice to have

### 18. No offline fallback page — cache miss on HTML returns `undefined`, causing browser error

- **What**: `sw.js:84` — `.catch(() => caches.match(e.request))` — if the cache also misses (first load while offline), `caches.match()` resolves to `undefined`. `respondWith(undefined)` causes a generic network error in the browser, not a friendly "You're offline" page.
- **Where**: `sw.js:84`
- **Why it matters**: A user who opens the PWA for the first time without network sees a blank browser error page instead of a branded offline state. Low frequency but high friction.
- **Effort**: S
- **Suggested fix**:
  - Cache an `offline.html` page during `install` and return it as the fallback: `.catch(() => caches.match('./offline.html') || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } }))`

### 19. FAB `+` button and modal `×` close button have no accessible label

- **What**: The primary action FAB renders `+` as its only text content. The modal close button uses `×` (the multiplication sign). Screen readers announce these as "plus button" and "times button" or "multiplication sign button".
- **Where**: `index.html` FAB element (approximately line 990, `.fab`); all modal close buttons (`.mc`); `givelink.html:303`
- **Why it matters**: Low impact for the current single-user use case, but a barrier for any user who relies on assistive technology.
- **Effort**: S
- **Suggested fix**:
  - FAB: `<button class="fab" aria-label="Add new item">+</button>`
  - Close buttons: `<button class="mc" aria-label="Close dialog">×</button>`

### 20. Supabase schema lacks `created_at` column and Realtime subscriptions

- **What**: `supabase-setup.sql` has no `created_at` column (so user activation date is unknowable) and no Supabase Realtime channel setup, so two open tabs silently overwrite each other with last-write-wins.
- **Where**: `supabase-setup.sql:7-11`
- **Why it matters**: `created_at` is free to add and unlocks activation cohort analytics. Realtime prevents data loss for power users with multiple devices open simultaneously.
- **Effort**: M
- **Suggested fix**:
  - Add `created_at timestamptz not null default now()` to the `app_state` table definition.
  - In `index.html`, after `sbConnect()` succeeds, subscribe: `supabase.channel('app_state').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'user_id=eq.' + _SB.uid }, () => sbSyncNow()).subscribe()`

---

_Max 20 items shown. Ordered within each tier by ROI. All file references verified against source at time of analysis._

---

## 🔎 Overflow findings (deep scan — didn't fit in top 20)

These were surfaced by a full line-by-line read of `index.html` but were crowded out by higher-priority items. Worth addressing in the next sprint.

### A. 15+ async AI feature functions have no `try/catch` — buttons can lock permanently

- **Where**: `index.html:5021` (`showBatchSuggestions`), `6049` (`aiWheelInsight`), `6216` (`aiSocialAudit`), `6376` (`aiExtractTasksFromNotes`), `6575` (`aiBreakdownGoal`), `6620` (`aiImproveTask`), `6661` (`aiTaskHealthCheck`), `6975` (`runPriorityAudit`), `7427` (`aiGenerateNewsletter`), `9404` (`synthesizeWeeklyNotes`), `9666` (`_fetchAIBriefing`), and ~14 more in `10180–11759`
- **What**: `callClaude()` itself catches and returns `null`, but callers skip try/catch entirely. Any TypeError from operating on a `null` result propagates uncaught. `showBatchSuggestions` sets `btn.disabled=true` before the call and only resets inside the function body — a throw mid-function permanently locks the button. `_fetchAIBriefing` runs on app init, so an uncaught rejection on startup can poison the init chain.
- **Effort**: M
- **Suggested fix**: Wrap every async AI feature function body with `try { ... } finally { _aiUnlock(key); resetButtonState(); }`. Create a shared `_wrapAi(fn)` decorator used by all feature buttons so error handling lives in one place.

### B. `caches.addAll()` in SW install has no error handler — silent install failure

- **Where**: `sw.js:14-17`
- **What**: If any asset in the `[...HTML, ...STATIC]` list returns non-200 (e.g., a deploy that drops `manifest-givelink.json`), `addAll` rejects and the `install` event's `waitUntil` promise rejects — the new SW installation fails silently. The user remains on the old cached version with no notification.
- **Effort**: S
- **Suggested fix**: Wrap `caches.addAll` in a try/catch and cache HTML/STATIC separately so a missing icon doesn't block HTML caching: `await cache.addAll(HTML); try { await cache.addAll(STATIC); } catch(e) { console.warn('Static pre-cache partial fail', e); }`

### C. Supabase refresh-token failure is silently swallowed — user stuck in broken auth

- **Where**: `index.html:8624` (`try{refresh();}catch(e){}`)
- **What**: When the Supabase `refresh_token` expires, `_sbToken()` throws. The outer catch at line 8624 swallows it with no logging or re-auth prompt. Subsequent `sbPush()` calls fail with 401 but show only the generic sync-warning toast. The user has no indication they need to reconnect.
- **Effort**: S
- **Suggested fix**: In the catch at `8624`, check `e.message` for `'auth 401'` / `'not connected'` and call `sbDisconnect()` + `toast('☁️ Session expired — reconnect in Settings')` to guide the user to re-authenticate.
