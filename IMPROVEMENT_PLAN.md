# Givelink / Task OS — Improvement Plan

> Generated: 2026-06-08 | Codebase: vanilla JS SPA, ~14 650 lines across `index.html` + `givelink.html`

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. XSS via unescaped user data in innerHTML
- **What:** Task titles, goal names, and category values are interpolated directly into `innerHTML` without escaping, allowing stored XSS.
- **Where:** `index.html:2046`, `index.html:2062`, `index.html:2885–2894`; `givelink.html:1087+`
- **Why it matters:** Any user who types `<img src=x onerror=alert(1)>` as a task title executes arbitrary JS — including stealing the Anthropic/Supabase keys stored in localStorage.
- **Effort:** M
- **Suggested fix:**
  - An `esc()` helper already exists in the codebase — apply it consistently to every user-supplied string interpolated inside a template-literal `innerHTML` assignment.
  - Audit all `element.innerHTML = \`...\`` patterns with a one-liner: `grep -n 'innerHTML=\`' index.html`.
  - Consider switching high-frequency render loops to `textContent` / `createElement` where layout allows.

---

### 2. Silent Supabase sync failures (empty catch blocks)
- **What:** Ten-plus `catch(e){}` blocks swallow errors during cloud sync, API calls, and nav-state restoration — users receive no feedback when data fails to save.
- **Where:** `index.html:8652`, `8670`, `9305`, `10049`; `givelink.html:2950`
- **Why it matters:** A user could lose an hour of work, switch devices, and find nothing synced — with no warning ever shown.
- **Effort:** S
- **Suggested fix:**
  - Replace each empty catch with at minimum `console.error(label, e)` so errors surface in DevTools.
  - For `sbPull` / `sbPush` specifically (`index.html:8592–8606`), call `_sbSetStatus('Sync failed — ' + e.message)` inside the catch so the status badge turns red.
  - Add a `window.addEventListener('unhandledrejection', e => console.error('Unhandled rejection:', e.reason))` at startup to catch any stragglers.

---

### 3. Claude AI call hangs with no timeout or error feedback
- **What:** `_callClaude()` fires a fetch to `api.anthropic.com` but has no timeout, no abort controller, and only a bare `r.status` check — network stalls leave the loading spinner running forever.
- **Where:** `index.html:4131–4150`
- **Why it matters:** AI features are the highest-value part of the product; a hung call looks like a crash and trains users to stop using them.
- **Effort:** S
- **Suggested fix:**
  - Add `AbortController` with a 30 s timeout: `setTimeout(() => controller.abort(), 30000)`.
  - On abort or non-200 response, show a user-visible toast (not a console message) with the error and a Retry button.
  - Surface the 429 rate-limit case explicitly: "Claude is rate-limited — try again in 60 s."

---

### 4. localStorage quota exceeded causes silent data loss
- **What:** `save()` writes the entire state object to localStorage with no try/catch; if quota is exceeded (common after importing Readwise books), the write silently fails and the next app reload reverts to the previous snapshot.
- **Where:** `index.html:448` (`load()` / `save()` pair); `index.html:2107` (partial protection only on load)
- **Why it matters:** Users who import hundreds of book highlights can silently exceed the ~5 MB limit and lose all subsequent task edits on page refresh.
- **Effort:** S
- **Suggested fix:**
  - Wrap the `localStorage.setItem` call in `save()` with a try/catch and show a toast: "Storage full — enable cloud sync to keep saving."
  - Consider storing large blobs (book highlights, note cache) under separate keys that can be evicted independently.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. `prompt()` for API key on first run in Givelink
- **What:** `givelink.html` uses the native browser `prompt()` dialog to collect the Anthropic API key on first visit — halts the page, looks broken on mobile, and provides no validation or explanation.
- **Where:** `givelink.html:1085–1086`
- **Why it matters:** First impressions matter most; a raw browser prompt is the single highest-friction moment in the onboarding flow and signals "unfinished product."
- **Effort:** S
- **Suggested fix:**
  - Replace with an inline settings modal (already present in `index.html`) — reuse or port that pattern.
  - Add format validation: check the key starts with `sk-ant-` before saving.
  - Show helper text: "Your key is stored only in this browser and never sent to our servers."

---

### 6. API keys readable by any browser extension via localStorage
- **What:** Anthropic, Readwise, Notion, and Supabase tokens are persisted as plaintext in localStorage, accessible to every browser extension running on the page.
- **Where:** `index.html:2036`, `8483`, `8508`, `8509`; `givelink.html:1085`
- **Why it matters:** A compromised extension (common in the developer tooling space) can exfiltrate all API keys silently. The Anthropic key in particular has real dollar cost.
- **Effort:** M
- **Suggested fix:**
  - Short-term: move to `sessionStorage` for the active-session copy so keys don't persist across browser restarts.
  - Ideal path: proxy Claude calls through a thin Vercel Edge Function (`/api/claude`) so the key never leaves the server; this eliminates client-side exposure entirely and is ~30 lines of code given the existing `vercel.json`.
  - Add a note in the settings modal explaining the security model so power users can make an informed choice.

---

### 7. No online/offline indicator — sync failures are invisible
- **What:** When the user goes offline or Supabase is unreachable, the app continues accepting edits with no banner or badge change, and those edits silently queue (or drop).
- **Where:** Sync logic `index.html:8592–8640`; no `navigator.onLine` listener anywhere in the file
- **Why it matters:** Users on spotty connections (flights, cafés) will lose data or be confused by stale content after reconnecting.
- **Effort:** S
- **Suggested fix:**
  - Listen to `window.addEventListener('online' / 'offline')` and toggle a subtle "Offline — changes saved locally" banner.
  - On reconnect, auto-trigger `sbPush()` and show "Synced" confirmation.

---

### 8. Brand palette mismatch — app uses blue (#58a6ff) not Givelink purple/pink
- **What:** The app's accent color is GitHub-blue `#58a6ff` with a blue-to-purple gradient; the Givelink brand palette is purple `#5718CA` / `#6B3FA0` and pink `#E353B6` / `#C2185B`. These are never used.
- **Where:** `index.html:19–34` (CSS variables block); `index.html:22` (hardcoded gradient); `index.html:187` (hardcoded `rgba(124,108,255,.45)` shadow)
- **Why it matters:** Brand inconsistency between the product and marketing materials erodes trust and makes the app look like a fork, not a product.
- **Effort:** S
- **Suggested fix:**
  - Update `--accent` in `:root` to `#5718CA` (dark) / `#6B3FA0` (light).
  - Replace the hardcoded gradient on line 22 with `var(--accent-gradient)` and define it in the vars block.
  - Search-replace `#58a6ff` and `rgba(124,108,255` for any residual hardcoded color values.
  - Ensure pink (`#E353B6`) is never placed on a purple background — audit any `.badge` / `.tag` combos.

---

### 9. No loading state during initial app paint
- **What:** `index.html` is a 280–400 KB file with no loading indicator — users see a blank white/black screen during parse and first render, which looks like a broken page on slow connections.
- **Where:** `index.html:1–50` (document `<head>` and opening `<body>`)
- **Why it matters:** Perceived performance is conversion performance; a blank screen for >300 ms triggers "is this working?" anxiety.
- **Effort:** S
- **Suggested fix:**
  - Add a CSS-only skeleton splash (`<div id="splash">` with a centered spinner) in the raw HTML that the JS `init()` function removes on first render.
  - This is pure CSS — no JS required and adds <1 KB.

---

### 10. Multi-tab data race — last write wins, no conflict resolution
- **What:** The global `S` object is read from localStorage on open, mutated in memory, and flushed back on every change. Two open tabs overwrite each other's changes with no merge logic.
- **Where:** `index.html:2030` (global `S` mutation); `save()` function (~line 448)
- **Why it matters:** Power users (and anyone with the app pinned as a PWA) habitually open it in multiple tabs and will experience intermittent, unreproducible data loss.
- **Effort:** M
- **Suggested fix:**
  - Use `localStorage`'s `storage` event to detect changes from other tabs and prompt: "Another tab updated your data — reload to get the latest?"
  - Longer term, move to a `BroadcastChannel` so tabs coordinate before writing.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `index.html` is 12 888 lines — single-file architecture blocks all collaboration
- **What:** The entire app — HTML structure, 200+ CSS rules, and ~11 000 lines of JS — lives in one file. There is no build step.
- **Where:** `/home/user/task-management/index.html` (entire file)
- **Why it matters:** Any contributor editing the file risks merge conflicts on every PR; features can't be developed in parallel; the file can't be tree-shaken or minified.
- **Effort:** L
- **Suggested fix:**
  - Extract CSS into `style.css` and JS into `app.js` as a first pass — no bundler needed, just `<link>` and `<script src>` tags. This alone cuts the file to ~200 lines and makes diffs readable.
  - When ready to add a bundler, Vite is the lowest-friction choice for vanilla JS.
  - Do not attempt a full component-framework rewrite until the file is split.

---

### 12. `console.warn` left in production (8 instances)
- **What:** Eight `console.warn` calls emit to DevTools in production, leaking error details and internal state paths to any user who opens the console.
- **Where:** `index.html:2092`, `2107`, `3023`, `9283`, `9327`, `9428`, `9656`; `givelink.html:2950`
- **Why it matters:** Leaks implementation details; also trains the team to ignore the console, making real errors harder to spot.
- **Effort:** S
- **Suggested fix:**
  - Replace with a thin `log(level, msg, data)` wrapper that is a no-op when `location.hostname !== 'localhost'`.
  - Wire critical-path warnings (sync failures, AI errors) to the existing toast system instead.

---

### 13. `parseInt()` without NaN guard on form inputs
- **What:** Several form fields call `parseInt(element.value)` without checking for `NaN`, then pass the result directly into task/metric objects where a number is expected.
- **Where:** `index.html:3046`, `3101`; `givelink.html:721–727`
- **Why it matters:** A user clearing a numeric input and saving corrupts the stored object with `NaN`, which then propagates silently (e.g. progress bars render as 0%, sort order breaks).
- **Effort:** S
- **Suggested fix:**
  - Use `parseInt(value, 10) || 0` for fields where 0 is a valid default, or validate before save: `if (isNaN(val)) { showError('Must be a number'); return; }`.
  - The `||null` pattern already used in some places is fine for optional fields — standardise on it.

---

### 14. Direct browser-to-Anthropic API calls expose key and bypass rate-limit control
- **What:** `_callClaude()` calls `https://api.anthropic.com/v1/messages` directly from the browser, with the key in the `x-api-key` header and the explicit `anthropic-dangerous-direct-browser-access` header that acknowledges this is unsafe.
- **Where:** `index.html:4131–4145`
- **Why it matters:** The key is transmitted in every request visible to browser network inspector and any MITM proxy; there is no server-side rate limiting, so a malicious page could drain the user's API quota.
- **Effort:** M
- **Suggested fix:**
  - Add a Vercel Edge Function at `/api/claude` that reads `ANTHROPIC_API_KEY` from environment and forwards the request body — ~25 lines of code.
  - The `vercel.json` is already present; add a `rewrites` entry to route `/api/*` to the function.
  - Remove the `anthropic-dangerous-direct-browser-access` header entirely once proxied.

---

### 15. No global unhandled-rejection handler
- **What:** Promise rejections from service-worker registration (`index.html:8675`), notification permission (`index.html:9385`), and clipboard (`index.html:1520`) are not caught by any top-level handler.
- **Where:** `index.html:8675`, `9385`; no `window.onunhandledrejection` listener in either file
- **Why it matters:** Uncaught rejections in Chrome/Firefox print as errors in the console and, in some PWA audits, count against reliability scores.
- **Effort:** S
- **Suggested fix:**
  - Add one handler at startup: `window.addEventListener('unhandledrejection', e => { console.error('[unhandled]', e.reason); });`
  - Separately, add `.catch()` to the three specific promise chains noted above.

---

## 💡 P3 — Nice to have

---

### 16. No skeleton loaders for Readwise / Notion async fetches
- **What:** The Readwise and Notion import modals open immediately but display nothing until data arrives — there is no shimmer/skeleton, just an empty modal body.
- **Where:** `index.html:8804` (Readwise fetch); `index.html:8925` (Notion fetch)
- **Why it matters:** Empty modals look broken; users click away or double-trigger imports.
- **Effort:** S
- **Suggested fix:** Render a CSS skeleton row (3 placeholder lines) before the fetch and replace with real content on success.

---

### 17. Supabase schema uses hard deletes with cascade — permanent data loss on account removal
- **What:** `supabase-setup.sql` uses `ON DELETE CASCADE`, meaning if a Supabase auth user is deleted, all their app data is immediately and permanently destroyed.
- **Where:** `supabase-setup.sql:1–53`
- **Why it matters:** If a user accidentally deletes their Supabase account (or an admin does), there is no recovery path.
- **Effort:** S
- **Suggested fix:** Add a `deleted_at TIMESTAMPTZ` column and filter `WHERE deleted_at IS NULL` in queries; keep the row but orphan it so a 30-day grace recovery is possible.

---

### 18. CSP allows `unsafe-inline` scripts — weakens XSS protection
- **What:** `vercel.json` sets `script-src 'self' 'unsafe-inline'`, which means an injected `<script>` tag or inline event handler would execute, partially negating the CSP.
- **Where:** `vercel.json` (headers section)
- **Why it matters:** CSP is most valuable as a defence-in-depth against the XSS issues in P0 item 1; `unsafe-inline` largely defeats that.
- **Effort:** M
- **Suggested fix:** Once the JS is extracted to `app.js` (P2 item 11), remove `unsafe-inline` from `script-src`. Until then, add a `<meta>` nonce or hash-based CSP for the inline block.

---

### 19. No input length limits on task/goal text fields
- **What:** Free-text fields (task title, goal description, journal entries) have no `maxlength` attribute or JS validation, so extremely long inputs are stored and later truncated unpredictably in the UI.
- **Where:** Task creation modal, goal modal — scattered across `index.html:3040–3110`
- **Why it matters:** Low probability, but a very long paste into a title field can break card layout and corrupt sort rendering.
- **Effort:** S
- **Suggested fix:** Add `maxlength="500"` on title inputs, `maxlength="2000"` on description textareas; show a character counter near the limit.

---

### 20. PWA manifest icons are missing — install prompt looks broken
- **What:** `manifest.json` references icon files that may not exist in the repository, causing the PWA install banner to show a broken-image icon.
- **Where:** `manifest.json` (icons array); verify with `ls /home/user/task-management/icons/`
- **Why it matters:** PWA install is a key retention hook; a broken icon signals an unpolished product at the moment users are considering committing to it.
- **Effort:** S
- **Suggested fix:** Export the Givelink logo at 192×192 and 512×512 as `icons/icon-192.png` and `icons/icon-512.png`; add a `maskable` variant for Android adaptive icons.

---

*Total items: 20 | P0: 4 | P1: 6 | P2: 5 | P3: 5*
