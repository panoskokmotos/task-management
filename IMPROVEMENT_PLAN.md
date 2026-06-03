# Givelink / Task OS — Improvement Plan

Scanned: `index.html` (12,888 lines), `givelink.html` (1,755 lines), `sw.js` (109 lines), `vercel.json`, `manifest.json`.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. Supabase cloud sync is silently blocked by CSP

**What:** The `connect-src` directive in the CSP header does not include `*.supabase.co`, so every Supabase API call is blocked by the browser before it leaves the machine.

**Where:** `vercel.json:14`

**Why it matters:** Any user who configures cloud sync (Settings → Supabase) gets zero syncing with no error shown — their data appears to save locally but never reaches the cloud. A core premium feature is completely broken in production.

**Effort:** S

**Suggested fix:**
- Add `https://*.supabase.co` to the `connect-src` directive in `vercel.json:14`
- Also add `wss://*.supabase.co` if realtime subscriptions are planned
- Test with a real Supabase project before shipping

---

### 2. `callClaudeGL` silently eats API errors — standup and outreach generators give no diagnosis

**What:** `callClaudeGL` calls `res.json()` without first checking `res.ok`. On a 401 (bad key), 429 (rate limit), or 500, `data.content` is undefined, the function returns `null`, and the caller shows the generic message "Could not generate. Check your API key." — even on a rate limit where the key is fine.

**Where:** `givelink.html:1263–1271`

**Why it matters:** Users can't distinguish a bad key from a rate limit from a real API outage. They either abandon the feature or rotate their key unnecessarily.

**Effort:** S

**Suggested fix:**
- After `await fetch(...)`, add `if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(res.status === 429 ? 'Rate limit — wait a moment' : res.status === 401 ? 'Invalid API key' : \`AI error ${res.status}\`); }` (mirror the pattern already in `runAiSprintPlanner` at `givelink.html:1145`)
- Surface the error message in the UI panel rather than via `toast()` so it doesn't disappear

---

### 3. `window.prompt()` is blocked in iOS standalone (installed PWA) mode — AI features unusable

**What:** `givelink.html:1086` and `1261` both call `window.prompt()` to collect the Anthropic API key. Safari blocks all JavaScript dialogs (`alert`, `confirm`, `prompt`) when a PWA runs in standalone mode on iOS. The call silently returns `null`, every AI feature fails immediately.

**Where:** `givelink.html:1086`, `givelink.html:1261`

**Why it matters:** Any user who installs the Givelink PWA on iPhone cannot use sprint planning, standup generation, or outreach emails. `index.html` already solved this with a custom modal at line 2300 — `givelink.html` just never adopted it.

**Effort:** S

**Suggested fix:**
- Remove both `window.prompt()` calls and replace with a small inline modal (copy the `promptModal` pattern from `index.html:2300–2360`)
- On success, store the key in `localStorage` under the same `taskos_api_key` key that `index.html` already reads — no schema change needed

---

### 4. Push notification icon is a 404 — notifications render broken on all devices

**What:** `sw.js:38–39` sets `icon` and `badge` to `./icons/icon-192.png`. That path doesn't exist; only `icon.svg` and `icon-gl.svg` are in the repo root.

**Where:** `sw.js:38–39`

**Why it matters:** Every push notification (reminders, daily nudges) shows a broken image placeholder on Android. On some devices the notification is suppressed entirely.

**Effort:** S

**Suggested fix:**
- Either add a `./icons/icon-192.png` (192×192 PNG generated from the SVG) to the repo and update `manifest.json` to reference it
- Or change `sw.js:38–39` to `icon: './icon.svg', badge: './icon.svg'` — SVG works in modern Chrome/Firefox push notifications

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. givelink.html uses blue (#3b82f6) as primary — zero brand consistency

**What:** The entire Givelink sprint board defines `--accent: #3b82f6` (blue). Every primary button, active nav item, logo, and sprint name renders in blue. The brand palette is purple (`#6B3FA0`, `#5718CA`) with accent pink (`#C2185B`, `#E353B6`).

**Where:** `givelink.html:17` (CSS custom property), all downstream references

**Why it matters:** This is the board shown to nonprofit partners and potentially investors. It looks like a generic app, not a branded product. The disconnect from `index.html`'s brand colors signals an unfinished product.

**Effort:** S

**Suggested fix:**
- Change `--accent: #3b82f6` → `--accent: #6B3FA0` and `--prog: #3b82f6` → `--prog: #5718CA` at `givelink.html:17–19`
- Update `<meta name="theme-color">` at `givelink.html:6` from `#3b82f6` to `#6B3FA0`
- Spot-check that no pillar color collides with the new accent (the purple pillar `--op: #a78bfa` may need to shift to avoid pink-on-purple)

---

### 6. Claude API key stored in plaintext `localStorage` — visible in DevTools with one click

**What:** The Anthropic API key is stored under `localStorage['taskos_api_key']` and `localStorage['taskos_data_<id>'].apiKey`. Any browser extension, XSS, or person with DevTools access can read it instantly.

**Where:** `givelink.html:1086`, `givelink.html:1261`, `index.html:4135`

**Why it matters:** For a founder demoing the product to nonprofits or investors on a shared machine, one DevTools inspection exposes a live Anthropic key that controls billing. A key leak = runaway charges with no easy recovery short of rotation.

**Effort:** M

**Suggested fix:**
- The minimum viable fix is a thin Vercel serverless function (`/api/ai`) that holds the key server-side and proxies Claude calls — the browser sends only the prompt, never sees the key
- If browser-direct must stay, at least mask the key in the Settings UI (already done for Supabase anon key at `index.html:1575`) and add a prominent warning banner

---

### 7. givelink.html has 1 ARIA attribute in 1,755 lines — keyboard and screen-reader users hit a wall

**What:** A global search finds 1 `aria-*` attribute in `givelink.html` versus 81 in `index.html`. No modals have `role="dialog"` or `aria-modal`. No icon-only buttons have `aria-label`. The CRM table has no `role="table"` or column headers. Focus is not trapped in modals.

**Where:** `givelink.html` — entire file, especially modal templates at lines ~380–430 and CRM render at lines ~1299–1380

**Why it matters:** The product targets nonprofit staff who may use assistive technology. WCAG 2.1 AA compliance is often a procurement requirement for nonprofits. Currently the app fails the most basic checks.

**Effort:** M

**Suggested fix:**
- Add `role="dialog" aria-modal="true" aria-labelledby="<title-id>"` to each modal overlay
- Add `aria-label="<action>"` to every icon-only button (there are ~15)
- On modal open, move focus to the first interactive element; on close, return focus to the trigger

---

### 8. Standup and outreach email generators allow duplicate concurrent AI calls

**What:** Both generators lack button-disabling during generation. The sprint planner disables its button at `givelink.html:1101` while awaiting the API, but the standup (`~line 1480`) and outreach email (`~line 1620`) generators do not.

**Where:** `givelink.html` — standup generator function (around line 1480–1515), outreach email generator (around line 1615–1666)

**Why it matters:** A user who double-clicks "Generate Standup" fires two API calls in parallel, burns double tokens, and gets a race condition where the second response overwrites the first mid-render.

**Effort:** S

**Suggested fix:**
- Follow the pattern from `runAiSprintPlanner:1100–1101` and `1160`: disable the button before `await callClaudeGL(...)` and re-enable in `finally`
- Optionally replace button text with "⏳ Generating..." during the call

---

### 9. CRM pipeline stage colors use off-brand hardcoded hex values

**What:** `CRM_STAGE_COLOR` at `givelink.html:1279` maps stages to `#60a5fa` (blue), `#fbbf24` (yellow), `#a78bfa` (light purple), `#22c55e` (green), `#ef4444` (red). None of these match the brand palette. The "contacted" stage uses the same blue as the (currently off-brand) accent — visually indistinguishable.

**Where:** `givelink.html:1279`

**Why it matters:** The CRM is the highest-value view for the business team. Off-brand status colors undermine trust and make stage badges look like a prototype.

**Effort:** S

**Suggested fix:**
- Remap to semantically appropriate brand-adjacent colors: `lead` → `#64748b` (neutral, keep), `contacted` → `#6B3FA0` (brand purple), `meeting` → `#C2185B` (brand pink), `proposal` → `#5718CA`, `won` → `#22c55e` (green is acceptable for success), `lost` → `#ef4444` (red is acceptable for failure)
- Avoid pink text on a purple background — if a card background is `#5718CA`, use white text not `#E353B6`

---

### 10. Deprecated `document.execCommand('copy')` used as clipboard fallback

**What:** Both clipboard copy handlers fall back to `document.execCommand('copy')` at `givelink.html:1521` and `givelink.html:1621`. `execCommand` is removed from the spec and has been non-operational in Firefox since 2022.

**Where:** `givelink.html:1521`, `givelink.html:1621`

**Why it matters:** On Firefox (and future Chrome releases), the fallback silently does nothing. Users who copy their standup text or outreach email draft on Firefox get no feedback and lose the content.

**Effort:** S

**Suggested fix:**
- Replace the fallback with a graceful failure: if `navigator.clipboard.writeText()` rejects, show a toast with "Press Ctrl+C / Cmd+C to copy" and optionally `window.getSelection()` / `selectAllChildren()` to pre-select the text
- Remove the `textarea` + `execCommand` code entirely

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. Three separate Claude API call patterns in givelink.html — any auth change requires triple edits

**What:** API key retrieval and Claude calls are implemented three different ways within 200 lines: `getApiKey()` + inline `fetch` at `1075–1144`, `callClaudeGL()` at `1256–1272`, and the sprint planner's own inline fetch with its own error handling. Header construction is duplicated verbatim.

**Where:** `givelink.html:1075–1088`, `givelink.html:1131–1144`, `givelink.html:1256–1272`

**Why it matters:** When the `anthropic-version` header needs bumping, or when the API key source changes, all three call sites must be found and updated. The sprint planner has proper `res.ok` checking; the shared helper doesn't — so correctness diverges over time.

**Effort:** S

**Suggested fix:**
- Delete `getApiKey()` and the inline fetch inside `runAiSprintPlanner`; route both through `callClaudeGL`
- Add the `res.ok` check to `callClaudeGL` (see P0 item 2) so all callers benefit
- The sprint planner currently uses `claude-opus-4-5` while the helper defaults to `claude-haiku-4-5-20251001` — make this an explicit parameter so it's visible at each call site

---

### 12. Service worker cache key is a hardcoded date — stale HTML served silently after deploys

**What:** `sw.js:1` sets `const CACHE = 'task-os-20260530'`. When the app is deployed without also updating this string, the service worker keeps serving the old HTML from cache. Users see yesterday's build until the cache is manually invalidated.

**Where:** `sw.js:1`

**Why it matters:** Silent stale-content bugs are the hardest to diagnose. A user reporting a "bug" may be running code deployed weeks ago. Given the `must-revalidate` cache policy on Vercel, the SW cache is the only layer that can serve stale HTML — and it currently does.

**Effort:** S

**Suggested fix:**
- Inject the cache key at deploy time: add a build step (even a one-line shell script) that writes `const CACHE = 'task-os-<git-sha-or-timestamp>'` into `sw.js` before Vercel picks it up
- Alternatively, use a Workbox approach or remove HTML from the SW cache entirely — `vercel.json` already sets `max-age=0, must-revalidate` on HTML, so the SW cache for HTML adds complexity without benefit

---

### 13. `unsafe-inline` in CSP provides no XSS protection for a script-injection-heavy architecture

**What:** `vercel.json:14` sets `script-src 'self' 'unsafe-inline'`. Because both apps are monolithic inline scripts, this was unavoidable — but it means the CSP header advertises a security control that does nothing. An XSS attack via injected content (e.g., a malicious task title rendered via `innerHTML`) is not blocked.

**Where:** `vercel.json:14`

**Why it matters:** The apps do render user-controlled content through `innerHTML` in several places (e.g., task titles in rendered cards). `unsafe-inline` means a stored XSS in a task title would execute. The current `esc()` function is the only defense, and it has to be applied correctly at every render site.

**Effort:** M

**Suggested fix:**
- Audit all `innerHTML` assignments in `index.html` and `givelink.html` to confirm `esc()` is applied to every user-controlled string — this is the critical short-term fix
- Long-term: extract JavaScript to external `.js` files (removing the need for `unsafe-inline`) and add a nonce or hash-based CSP

---

### 14. Empty catch blocks silently swallow state corruption — users see a broken app with no error

**What:** At `givelink.html:1083` and multiple locations in `index.html` (lines 2430, 2498, 2874, 3227, 8619, 8652), `catch(e){}` silently discards errors from `JSON.parse(localStorage...)`. If localStorage is corrupted or full, the app degrades silently.

**Where:** `givelink.html:1083`, `index.html:2430`, `2498`, `2874`, `3227`, `8619`, `8652`

**Why it matters:** localStorage is quota-limited (~5MB on most browsers). A power user with months of journal entries, tasks, and CRM data could silently hit the quota. Saves start failing; the user sees stale data and can't tell why.

**Effort:** S

**Suggested fix:**
- Replace silent `catch(e){}` blocks with at minimum `catch(e){ console.warn('State parse error:', e); }` so errors are visible in DevTools
- On `localStorage.setItem`, catch `QuotaExceededError` and show a persistent toast: "Storage nearly full — export your data or enable cloud sync"

---

### 15. No error monitoring — production bugs are invisible until users report them

**What:** There is no Sentry, PostHog error capture, or CSP violation reporting endpoint. The only signal that something is broken is a user complaint or a manual check of Vercel logs.

**Where:** No error monitoring in either `index.html` or `givelink.html`

**Why it matters:** The apps have 50+ async AI calls, a complex state machine, and localStorage as the sole data store. Silent failures (quota errors, API timeouts, SW serving stale HTML) could affect users for days unnoticed.

**Effort:** S

**Suggested fix:**
- Add PostHog (already planned per product direction) error capture: `window.onerror` and `window.onunhandledrejection` handlers that send the error to PostHog with `posthog.capture('js_error', { message, stack })`
- Alternatively, a free Sentry DSN with 5 lines of setup catches unhandled exceptions automatically

---

### 16. `index.html` is 12,888 lines — IDE navigation, testing, and onboarding are all broken

**What:** The entire app — all CSS, all JavaScript (~700 functions), and all HTML — lives in a single file. There is no module system, no build step, and no way to run a subset of the code in isolation.

**Where:** `index.html` (entire file)

**Why it matters:** Any new contributor has to scroll through 13k lines to find a function. There is no way to write unit tests for any business logic. The file takes 2–3 seconds to open in VS Code on average hardware.

**Effort:** L

**Suggested fix:**
- Start incrementally: extract the largest self-contained sections first (AI functions at lines 4130–4146+, Supabase sync at 8522–8660) into separate `<script src="...">` files
- No build system needed initially — native ES modules work in all modern browsers and Vercel serves static files with no config
- Each extracted file enables isolated testing without touching the monolith

---

## 💡 P3 — Nice to have

---

### 17. Real business data included in Claude prompts without a visible consent indicator

**What:** The sprint planner sends actual sprint task titles and pillar names to Claude (`givelink.html:1112–1121`). The standup generator sends task titles and blocked item notes (`givelink.html:1492–1501`). The outreach generator sends the nonprofit's full name, contact, city, and mission statement (`givelink.html:1641–1647`).

**Where:** `givelink.html:1112–1121`, `1492–1501`, `1641–1647`

**Why it matters:** If a nonprofit staff member ever uses this tool, their org's data is sent to Anthropic's API with no visible notice. At minimum, a one-time "AI features send data to Anthropic" disclosure should appear before the first API call.

**Effort:** S

**Suggested fix:**
- Add a one-time consent toast or modal before the first `callClaudeGL` call per session
- Store acceptance in `localStorage['gl_ai_consent']` so it doesn't repeat
- Link to Anthropic's privacy policy

---

### 18. No empty states for CRM, velocity, and pillar card views — first-time users see blank panels

**What:** When `S.nonprofits` is empty (new user, pre-seed), `renderCRM()` renders a blank `<div>`. The velocity monitor shows zeroes with no contextual guidance. Pillar cards show `0/0 done`.

**Where:** `givelink.html:1299` (start of `renderCRM`), `givelink.html` velocity render (~line 1528), pillar card render (~line 1580)

**Why it matters:** The first impression of the CRM is an empty panel with no call-to-action. New users don't know if the app is loading, broken, or waiting for input. Seed data helps for demos but isn't shown to real users.

**Effort:** S

**Suggested fix:**
- In `renderCRM()`, when `S.nonprofits.length === 0`, render a centered empty-state card: icon + "No nonprofits yet" + "Add your first nonprofit →" button
- Add similar empty states to the backlog view and the velocity section

---

### 19. `manifest.json` provides only an SVG icon — PWA install quality suffers on iOS and older Android

**What:** `manifest.json:13–19` provides a single `icon.svg` with `purpose: "any maskable"`. iOS Add-to-Home-Screen ignores the manifest entirely and looks for `<link rel="apple-touch-icon">`. Older Android browsers need a 192×192 PNG.

**Where:** `manifest.json:13–19`, `givelink.html` `<head>` (missing `apple-touch-icon`)

**Why it matters:** When a nonprofit staff member installs the PWA on iPhone, the home-screen icon is a generic blank square. For a product trying to establish brand trust, this is a visible polish miss.

**Effort:** S

**Suggested fix:**
- Generate `icon-192.png` and `icon-512.png` from the SVG (Inkscape, ImageMagick, or any online converter)
- Add `{ "src": "icon-192.png", "sizes": "192x192", "type": "image/png" }` to `manifest.json`
- Add `<link rel="apple-touch-icon" href="icon-192.png">` to both `index.html` and `givelink.html` `<head>`
- This also fixes the sw.js push notification icon (P0 item 4)

---

### 20. No `.env.example` or developer setup docs — onboarding a contributor takes trial and error

**What:** There is no `package.json`, no `.env.example`, no `README.md` with setup instructions. The Supabase SQL setup is referenced in `index.html:1585` (`supabase-setup.sql`) but the file does not exist in the repo.

**Where:** Repo root — missing files

**Why it matters:** Anyone cloning the repo (a future hire, a contractor, or the founder on a new machine) has to read 13k lines of HTML to discover that they need a Supabase project, an Anthropic key, and a specific SQL schema. The referenced `supabase-setup.sql` is a 404.

**Effort:** S

**Suggested fix:**
- Create `supabase-setup.sql` with the `app_state` table DDL (it's implied by `index.html:8593–8604`)
- Add a `README.md` with: what the app is, how to run it locally (`open index.html`), what credentials are needed (Anthropic key, optional Supabase), and how to deploy to Vercel
