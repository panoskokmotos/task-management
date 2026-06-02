# Givelink / Task OS — Improvement Plan

_Generated 2026-06-02. Based on full static analysis of `index.html` (12 888 lines),
`givelink.html`, `sw.js`, and `vercel.json`._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. Notion "Pull from Notion" button silently fails for every user

**What:** The Notion integration calls `api.notion.com` directly from the browser, which Notion blocks with CORS. Every click on "Pull from Notion" ends in a failure toast or a confusing inline workaround message.

**Where:** `index.html:8924–8945` (`fetchFromNotion`), `index.html:12097` (button), `index.html:1544` (settings key field)

**Why it matters:** The Settings panel has a "Notion Integration Token" input and there is a dedicated "Pull from Notion" button in the Import modal — both imply the feature works. Users enter a real token, get a CORS error they don't understand, and lose trust in the product.

**Effort:** S

**Suggested fix:**
- Remove the "Pull from Notion" button entirely; replace with a "Paste Notion content" textarea + copy-paste instructions (the workaround already exists at 8942–8945 — promote it as the primary UX).
- Hide the "Notion Integration Token" field in Settings, or replace it with a non-functional placeholder until a server-side proxy is available.
- Add a one-sentence note: _"Notion requires a server-side proxy — paste your page content here for now."_

---

### 2. Claude API fetch hangs forever, locking every AI button

**What:** `callClaude()` has no timeout or `AbortController`. If the Anthropic API is slow or the network stalls, all AI feature buttons stay disabled indefinitely — the spinner never clears and the button never re-enables.

**Where:** `index.html:4133–4145` (`callClaude`)

**Why it matters:** Every AI feature (inbox triage, task improvement, goal suggestions, AI sequences) uses `callClaude`. A single network hiccup permanently disables all AI until the page is reloaded.

**Effort:** S

**Suggested fix:**
- Add an `AbortController` with a 30-second timeout in `callClaude`:
  ```js
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 30_000);
  const res = await fetch(url, { ...opts, signal: ac.signal });
  clearTimeout(tid);
  ```
- Add a `finally { clearTimeout(tid); }` block so timeouts always clean up.
- Show `toast('AI request timed out — try again')` on `AbortError`.

---

### 3. Social profile URL `javascript:` scheme allows self-XSS

**What:** Social profile URLs are HTML-escaped with `esc()` but not scheme-validated. A URL like `javascript:alert(document.cookie)` passes through `esc()` unchanged and executes when the user clicks the "↗" link.

**Where:** `index.html:6207` (relationships card render)

**Why it matters:** Any user who pastes a malicious link into a social profile (or imports a backup file with one) can execute arbitrary JavaScript in the app's origin, which can read and overwrite all of localStorage including the Claude API key.

**Effort:** S

**Suggested fix:**
- Add a `_safeUrl(url)` helper that returns the URL only if it starts with `https://` or `http://`; otherwise returns `''`:
  ```js
  function _safeUrl(u){ return /^https?:\/\//i.test(u)?u:''; }
  ```
- Apply it everywhere a user-supplied URL is rendered as an `href`: lines 6207, 10325, 10430.
- The same check also prevents `data:`, `vbscript:`, and similar schemes.

---

### 4. `_sbScheduleSync` bypasses the busy lock, racing with `sbSyncNow`

**What:** `_sbScheduleSync` fires `sbPush()` directly after a 2.5-second debounce without checking `_sbBusy`. If `sbSyncNow()` is mid-pull at that moment, two concurrent `sbPush` calls run in parallel, potentially overwriting a newer remote record with a locally stale one.

**Where:** `index.html:8628–8634` (`_sbScheduleSync`), `index.html:8607–8626` (`sbSyncNow`)

**Why it matters:** On a multi-device setup, a save on device A can overwrite task completions that were synced from device B one second earlier. Completely silent — no error, no indicator.

**Effort:** S

**Suggested fix:**
- Add `if(_sbBusy)return;` as the first line of the `_sbTimer` callback in `_sbScheduleSync`.
- Set `_sbBusy=true` / `_sbBusy=false` around the `sbPush()` call in `_sbScheduleSync` the same way `sbSyncNow` does.

---

### 5. XSS in Weekly Review wizard — `t.title` and `g.title` injected raw into `innerHTML`

**What:** Three `body.innerHTML` template literals in the weekly review wizard render task titles and goal titles without calling `esc()`. A title containing `<img src=x onerror="...">` executes in the wizard.

**Where:**
- `index.html:2885` — Completed tasks step: `${t.title}`
- `index.html:2892` — Backlog promotion step: `${t.title}` (also in `mvB` button `onclick` string)
- `index.html:2894` — Goal progress step: `${g.title}`
- `index.html:2062` — Task blocking `<select>`: `'+t.title.slice(0,45)+'` (no esc)

**Why it matters:** The Weekly Review is used regularly. Task titles pasted from external sources (Notion, email, AI output) or imported from a JSON backup can contain HTML that disrupts the wizard UI.

**Effort:** S

**Suggested fix:**
- Wrap every bare `${t.title}` and `${g.title}` in these four locations with `${esc(t.title)}` and `${esc(g.title)}`.
- At line 2062: `'>'+esc(t.title.slice(0,45))+'</option>'`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 6. Claude API key is included in the Supabase cloud sync payload

**What:** `S.claudeKey` lives inside the main `S` state object. `sbPush()` serializes the entire `S` object and uploads it to Supabase. Enabling cloud sync means the plaintext Anthropic API key leaves the device.

**Where:** `index.html:2036` (S initializer, `claudeKey:''`), `index.html:8603` (`body:JSON.stringify({...data:S...})`)

**Why it matters:** Anthropic API keys have direct billing impact. Storing them in a database column — even one protected by Supabase RLS — dramatically increases the blast radius if Supabase credentials leak.

**Effort:** S

**Suggested fix:**
- Move `claudeKey` out of `S`: replace `S.claudeKey` with a dedicated `localStorage.getItem('taskos_claude_key')` wherever it is read/written (only ~6 call sites).
- Before `sbPush`, pass a copy of `S` with sensitive fields stripped: `const payload = {...S}; delete payload.claudeKey;`.
- Do the same for any other per-device secrets (ntfy topic if it contains auth tokens).

---

### 7. Cloud sync silently discards local changes when remote timestamp wins

**What:** `sbSyncNow` applies the remote state wholesale when `remote.ms > localMs` with no conflict indicator, no undo, and no merge. A second device that auto-synced moments earlier has a higher timestamp, so it silently overwrites whatever the user just saved on the current device.

**Where:** `index.html:8613–8618`

**Why it matters:** Users enabling cloud sync across devices will eventually see tasks they just completed reappear, or tasks they just added disappear — with no explanation. This erodes trust in the core data layer.

**Effort:** M

**Suggested fix:**
- After applying the remote state, count what changed: `const delta = countDiff(S, remote.data)`.
- Show an informative toast: `toast('⬇ Cloud sync applied — ${delta} changes merged')` with a "↩ Undo" action that restores a snapshot taken before the merge.
- Long-term: merge arrays by ID rather than full-replace; use `_updatedAt` per task.

---

### 8. Import JSON only validates `tasks` array — malformed data corrupts live state

**What:** `importData()` checks `d.tasks && Array.isArray(d.tasks)` then immediately calls `Object.assign(S, d)`. Any JSON file with an array named `tasks` passes validation, including files with missing task IDs, invalid bucket strings, or overwritten system fields.

**Where:** `index.html:2115–2124`

**Why it matters:** A single bad import can corrupt the entire app state in an unrecoverable way (since `save()` is called immediately after). The user has no warning and no rollback.

**Effort:** S

**Suggested fix:**
- Snapshot S before import: `const rollback = JSON.stringify(S);`
- Validate each task has at minimum `id` (string), `title` (string), `status` (one of the valid enum values), and `bucket` (valid enum).
- On validation failure, restore the snapshot and show a descriptive error listing how many records failed and why.

---

### 9. `p.bio` rendered without `esc()` in the Relationships view

**What:** The social profile card renders `${p.bio?p.bio.slice(0,50)+'…':''}` directly inside an `innerHTML` template. A bio containing HTML breaks the card layout; one containing `<img onerror="...">` runs code.

**Where:** `index.html:6207`

**Why it matters:** Bios are free-text fields frequently pasted from LinkedIn, Twitter, or other sources that may contain angle brackets or HTML entities. Broken cards in a CRM view are a visible regression.

**Effort:** S

**Suggested fix:**
- Change to `${p.bio?esc(p.bio.slice(0,50))+'…':''}`.
- While here, also confirm that `p.platform` and `p.handle` are already escaped (they are — line 6207 — but double-check after any refactor).

---

### 10. No user-facing indicator when Readwise sync is running

**What:** The Readwise "Sync Highlights" button triggers an async `fetch` chain but provides no visual feedback that a request is in flight. Users click, see nothing for several seconds, and click again — triggering duplicate API calls.

**Where:** `index.html:8800–8845` (`fetchReadwise`, `_fetchReadwisePage`)

**Why it matters:** Duplicate Readwise syncs can hit the API rate limit and result in double-imported highlights, degrading the signal quality of the Books section.

**Effort:** S

**Suggested fix:**
- Wrap the sync trigger button with `_btnLoading(btn, true)` at the start and `_btnLoading(btn, false)` in a `finally` block — the helper already exists at `index.html:2322`.
- Optionally add `if(btn._aiRunning)return;` guard like other AI buttons.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `toast()` and `showConfirm()` accept raw HTML by default

**What:** Both `toast(msg)` (line 2273) and `showConfirm(msg, …)` (line 2291) use `el.innerHTML = msg`. Every caller must remember to escape user content or pass trusted HTML — one missed call is a DOM injection.

**Where:** `index.html:2273`, `index.html:2291`

**Why it matters:** New features added to the codebase will copy the `toast(…)` call pattern. Without a safe-by-default API, XSS surface area grows with every feature commit.

**Effort:** M

**Suggested fix:**
- Change `toast(msg)` to use `el.textContent = msg` by default.
- For the few callers that intentionally render HTML (e.g., bold task names), add a second parameter: `toast(msg, ms, {html: true})`.
- Audit ~15 call sites and classify each as plain-text or intentional-HTML.

---

### 12. No cross-feature Claude API rate throttle — rapid-fire calls burn quota

**What:** `_aiLock` (line 2256) prevents concurrent calls to the _same_ function, but a user can trigger `aiSequenceTasks`, `aiImproveTask`, and `aiSuggestAutomations` in rapid succession, firing three concurrent Claude calls with no inter-call delay.

**Where:** `index.html:2256–2257` (`_aiLock`/`_aiUnlock`), all `_aiBtn` callers

**Why it matters:** Burst usage hits Anthropic's per-minute rate limit, returns 429s, and leaves multiple AI panels in error state simultaneously. Each 429 is a paid API call the user is charged for.

**Effort:** S

**Suggested fix:**
- Add a module-level `let _aiLastCallMs = 0;` and enforce a minimum 1-second gap at the top of `callClaude`: `if(Date.now()-_aiLastCallMs < 1000){toast('⏱ One moment…');return null;}`.
- Set `_aiLastCallMs = Date.now()` on each successful dispatch.

---

### 13. Service worker pre-caches 892 KB HTML on install — redundant with network-first strategy

**What:** `sw.js:16` calls `c.addAll([...HTML, ...STATIC])` during install, eagerly downloading and caching `index.html` and `givelink.html`. The fetch handler for HTML pages already uses network-first with a cache fallback — so the install pre-cache is never used as the _primary_ serving path; it's a wasted 892 KB download on every SW install.

**Where:** `sw.js:2–16`

**Why it matters:** On mobile connections every new deploy forces an extra ~900 KB download at install time, slowing the first meaningful paint and burning mobile data.

**Effort:** S

**Suggested fix:**
- Remove `HTML` from `c.addAll()` in the install handler; keep only `STATIC`.
- The network-first handler will still warm the HTML cache on the first navigation after install.

---

### 14. `_sbScheduleSync` pushes `S` without stripping sensitive keys

**What:** Even after fixing P1 item #6, the scheduled auto-push path in `_sbScheduleSync` (line 8633) calls `sbPush()` which serializes the full `S` object. Sensitive keys added back accidentally (e.g., during a merge) will silently upload to Supabase.

**Where:** `index.html:8633`, `index.html:8600–8605` (`sbPush`)

**Why it matters:** Security properties must be enforced at the serialization boundary, not only where the key is stored. A single future refactor that moves a secret back into `S` would re-introduce the leak.

**Effort:** S

**Suggested fix:**
- Create a `_sanitizeForSync(state)` function that returns a copy of `S` with an explicit blocklist of keys stripped (`claudeKey`, any future credential field).
- Call it inside `sbPush` rather than relying on call sites to remember.

---

### 15. SW `CACHE` version string requires a manual date bump on every deploy

**What:** `sw.js:1` hardcodes `const CACHE = 'task-os-20260530'`. The activate handler deletes all caches with a different name, which is correct — but if a developer forgets to bump the date on a new deploy, cached static assets (icons, manifests) are served stale indefinitely.

**Where:** `sw.js:1`

**Why it matters:** A missed version bump means users on the old SW see the old icon or manifest even after a brand refresh. It's a manual step with no automated enforcement.

**Effort:** S

**Suggested fix:**
- Replace the hardcoded string with a build-time injection from a CI step, or use a content hash appended at deploy time.
- As a zero-tooling stopgap: add a comment above it: `// IMPORTANT: bump this string on every deploy` and include it in a pre-deploy checklist.

---

## 💡 P3 — Nice to have

---

### 16. `uid()` should use `crypto.randomUUID()` for collision safety

**What:** The `uid()` function (used for every task, goal, habit, and person ID) combines `Date.now()` and `Math.random()`. The collision probability per pair is ~10⁻¹², which is fine for hundreds of tasks but drifts as state grows. `crypto.randomUUID()` is available in all target browsers and is cryptographically guaranteed unique.

**Where:** `index.html` — `uid()` definition and ~40 call sites

**Effort:** S

**Suggested fix:**
- Replace `function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2)}` with `function uid(){return crypto.randomUUID();}`.
- No call sites need to change; UUID strings are still valid in all data contexts.

---

### 17. Keyboard shortcuts are undiscoverable — no help overlay

**What:** The app has 15+ keyboard shortcuts (Cmd+K, Cmd+1/2, Cmd+/, Cmd+Shift+N, `t` for timer, etc.) but there is no help modal, no tooltip, and no documentation surface. Power users miss most of them.

**Where:** `index.html:8656–8659` (keyboard handler), command-palette section

**Effort:** S

**Suggested fix:**
- Add a `?` keydown listener that opens a simple "Keyboard Shortcuts" modal listing all shortcuts in a two-column layout.
- Alternatively, add a persistent `?` icon button in the header that opens the same modal.

---

### 18. `unsafe-inline` in CSP makes all other XSS mitigations weaker

**What:** `vercel.json` sets `script-src 'self' 'unsafe-inline'`. This allows any `<script>` or inline event handler injected via DOM manipulation to execute, which largely negates the protective value of the CSP.

**Where:** `vercel.json` (Content-Security-Policy header)

**Effort:** L

**Suggested fix:**
- This is a large refactor: move all `onclick=` attributes in HTML to `addEventListener` calls in a bundled `app.js`, then switch CSP to `script-src 'self'`.
- Interim step: audit the highest-risk inline handlers (those that accept user input) and move them to a separate file first.

---

### 19. Missing `rel="noopener"` on Relationships profile link

**What:** The social profile "↗" link at line 6207 opens with `target="_blank"` but lacks `rel="noopener noreferrer"`. The other user-URL links at lines 10325 and 10430 already include it correctly.

**Where:** `index.html:6207`

**Effort:** S

**Suggested fix:**
- Add `rel="noopener noreferrer"` to the anchor tag at 6207 to match the existing pattern on all other external links.

---

### 20. Readwise sync fetches all highlights on every sync — no delta/cursor support

**What:** `_fetchReadwisePage` paginates through all highlights every time the user syncs, with no "last synced at" cursor. A user with 500+ highlights re-downloads their entire library on each sync.

**Where:** `index.html:8800–8845`

**Why it matters:** Slow syncs degrade the Books section UX and can hit Readwise API rate limits for heavy users.

**Effort:** M

**Suggested fix:**
- Store the last sync timestamp in `localStorage` (`taskos_readwise_last_sync`).
- Pass `?updated_after=<ISO timestamp>` to the Readwise `/highlights` endpoint on subsequent syncs.
- Only merge the delta into `S.books` rather than replacing it.
