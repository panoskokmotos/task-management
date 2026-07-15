# Task OS / Givelink — Improvement Plan

*Generated 2026-07-15. Max 20 items, ordered within tier by ROI.*

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Broken push-notification icon (silent fail in production)
- **What**: The service worker and a reminder handler both reference `./icons/icon-192.png`, a path that doesn't exist — the file lives at `./icon-192.png`.
- **Where**: `sw.js:41-42`, `index.html:10769`
- **Why it matters**: Every in-app reminder and push notification silently shows a broken/missing icon. On iOS/Android the OS falls back to a generic icon or shows nothing — this hurts trust and makes the PWA look unfinished.
- **Effort**: S
- **Suggested fix**:
  - Change `./icons/icon-192.png` → `./icon-192.png` in both files.
  - Add a CI check: `grep -r 'icons/' sw.js index.html` should return empty.

---

### 2. XSS in task-title dropdown (data flows directly into innerHTML)
- **What**: `fillBlockerDrop()` builds a `<select>` by concatenating raw task titles into HTML with no escaping.
- **Where**: `index.html:2430`
- **Why it matters**: A task titled `"><script>alert(document.cookie)</script>` would execute in every user's browser when they open the "blocked by" picker. This is a stored-XSS vector.
- **Effort**: S
- **Suggested fix**:
  - Wrap with the existing `esc()` helper: `esc(t.title).slice(0, 45)`.
  - Audit every other `innerHTML` assignment that lacks `esc()` — there are ~354 total; the ones using template literals with user data are the risk surface.

---

### 3. XSS in `toast()` via `innerHTML`
- **What**: `toast(msg)` sets `el.innerHTML = msg`, so any caller that echoes external data (e.g., `'AI error: ' + e.message`) could inject HTML if a malicious server returns crafted error text.
- **Where**: `index.html:2666` (toast), `index.html:2684` (confirm modal `innerHTML`)
- **Why it matters**: The Anthropic/Supabase proxied error path already echoes `e.message` and `err.error?.message` verbatim. A MITM or rogue error response could exfiltrate the stored auth token.
- **Effort**: S
- **Suggested fix**:
  - Change `el.innerHTML = msg` → `el.textContent = msg` in the toast function (emoji in toasts renders fine as text).
  - For `confirm-msg` (which legitimately renders `<strong>`), sanitize with `DOMPurify` or restrict to a whitelist tag set.

---

### 4. `aiProxy` not wired up — all AI features dead for new hosted users
- **What**: `APP_CONFIG.aiProxy` is an empty string (`''` at line 9812) while `/api/claude` is a working deployed endpoint. Every AI feature silently gates on a per-user Claude API key that no new user has.
- **Where**: `index.html:9812`, `api/claude.js` (the proxy exists and works)
- **Why it matters**: "AI does the task", day planning, auto-triage, reply-to-act — every flagship AI feature is broken for anyone using the hosted app without their own key. This is the biggest conversion-killing issue.
- **Effort**: S
- **Suggested fix**:
  - Set `aiProxy: 'https://<your-vercel-app>.vercel.app/api/claude'` in `APP_CONFIG`.
  - Verify Supabase auth token is forwarded (already done at `index.html:4869`) so the proxy gates on a valid session.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Hardcoded "Panos" name shown to every new user
- **What**: Three separate places default the app to "Panos": the HTML title tag, the default `profileName`, and the greeting HTML.
- **Where**: `index.html:17` (`<title>Task OS — Panos</title>`), `index.html:2406` (`||'Panos'`), `index.html:951` (greeting HTML)
- **Why it matters**: New sign-ups see "Good morning, Panos" and their browser tab says "Task OS — Panos" until they manually rename. This is confusing and unprofessional.
- **Effort**: S
- **Suggested fix**:
  - Change `||'Panos'` → `||'You'` (or derive from email on first load).
  - Update `<title>` to `Task OS` (no name) and set it dynamically from `profileName` on init.
  - Clear the static greeting from the HTML; `renderDash()` already writes the correct greeting.

---

### 6. Silent sync failure on login — user sees "Welcome" but data doesn't load
- **What**: `_afterAuth()` swallows sync errors completely: `try{await sbSyncNow(true);}catch(e){}` and `try{refresh();}catch(e){}`.
- **Where**: `index.html:9975-9976`
- **Why it matters**: If the first sync fails (network blip, quota, schema mismatch), the user lands on an empty app with a success toast. They may think their data is gone and churn. This is especially risky for new signups who expect to see their local data.
- **Effort**: S
- **Suggested fix**:
  - Change the sync call to surface failures: `try{await sbSyncNow(true);}catch(e){toast('⚠️ Sync failed: '+e.message, 4000);}`.
  - Show a "Retry sync" button in the pill if the initial post-login sync errors.

---

### 7. No rate limiting on `/api/claude` proxy — single account can drain the Anthropic bill
- **What**: The proxy comment itself says: *"For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."* No rate limiting exists.
- **Where**: `api/claude.js:12-13` (the acknowledged gap)
- **Why it matters**: Any signed-in user can call `/api/claude` in a loop indefinitely. A single motivated user or a bug in the client (e.g., retry loop) could generate thousands of Claude API calls.
- **Effort**: M
- **Suggested fix**:
  - Add [Upstash Redis rate limiting](https://upstash.com/docs/oss/sdks/ts/ratelimit/overview): 20 req/user/minute via the Supabase uid from the verified token.
  - Alternatively, add a `max_tokens` hard cap (current limit of 2000 is fine) and a daily per-user quota check in a Supabase edge function.

---

### 8. Dark-mode `theme-color` meta tag set to blue, not brand purple
- **What**: `applyTheme()` sets `theme-color` to `#58a6ff` (blue) for dark mode, but the actual brand color is `#8b7cff` (purple).
- **Where**: `index.html:2437`
- **Why it matters**: On Android, the browser chrome/status-bar color is wrong — it shows blue instead of brand purple. On iOS PWA the splash/nav bar tint is wrong. Subtle but visible on every dark-mode visit.
- **Effort**: S
- **Suggested fix**:
  - Change `'#58a6ff'` → `'#8b7cff'` on line 2437.
  - Also fix the inline `color:#58a6ff` on the Week Theme label (line 1002) to `color:var(--accent)`.

---

### 9. `givelink.html` uses wrong brand palette (blue instead of purple)
- **What**: Givelink Sprint Board's `theme-color` and `--accent` CSS variable are set to `#3b82f6` (Tailwind blue), not the Givelink brand purple.
- **Where**: `givelink.html:6` (theme-color meta), `givelink.html:17` (--accent CSS variable)
- **Why it matters**: The nav badge for Givelink in `index.html` uses `#a78bfa` (purple), but clicking through to `givelink.html` shifts everything to blue. Brand inconsistency is immediately visible when switching workspaces.
- **Effort**: S
- **Suggested fix**:
  - Change `theme-color` to `#6b3fa0` and `--accent` to `#a78bfa` to match the Task OS "Givelink purple" used in the sidebar badge and workspace switcher.
  - Update `--prog`, `--np` status colors accordingly so they don't clash.

---

### 10. Auth token stored in `localStorage` — XSS exfiltration risk
- **What**: Supabase `access_token` and `refresh_token` are stored in plain `localStorage`, making them readable by any injected script (the XSS risks in P0 compound this).
- **Where**: `index.html:9870-9873` (`_sbStoreSession()`), `index.html:10023-10025` (OAuth redirect handler)
- **Why it matters**: If XSS is exploited (see items 2–3), an attacker can trivially exfiltrate auth tokens and impersonate the user against Supabase. For a personal-data app, this is a critical trust issue.
- **Effort**: M
- **Suggested fix**:
  - Fix the XSS issues (P0 items 2–3) first — they're the real attack surface.
  - For the tokens: use `sessionStorage` for the access token (shorter window) while keeping the refresh token in `localStorage` (already standard Supabase JS SDK behavior). Full httpOnly cookie approach would require a server component.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. 14,401-line monolithic `index.html` — every PR is a merge nightmare
- **What**: The entire app — 807 lines CSS, ~13,500 lines JS, and all HTML — lives in one file.
- **Where**: `index.html` (entire file)
- **Why it matters**: Every PR touches the same file, causing constant conflicts. It's impossible to code-review a specific subsystem, and the browser parses and re-executes the entire script on every reload.
- **Effort**: L
- **Suggested fix**:
  - Extract CSS to `app.css`, JavaScript to `app.js` (no bundler needed — plain `<script src>`).
  - This alone cuts PR diff noise by ~60% and makes git blame useful again.
  - Don't attempt to split JS into modules yet — that can come later.

---

### 12. Widespread silent `catch(e){}` — errors are invisible in production
- **What**: At least 15 empty catch blocks across init, sync, render, and auth paths silently swallow exceptions.
- **Where**: `index.html:2826, 2860, 9975, 9976, 10026, 10033, 10072, 10131, 13251-13254` (partial list)
- **Why it matters**: When something breaks silently (wrong DOM id, race condition, parsing failure), there's no trace — not in PostHog, not in the console in production. Bugs become reproducible only by accident.
- **Effort**: M
- **Suggested fix**:
  - Replace `catch(e){}` with at minimum `catch(e){console.warn('[context]', e);}`.
  - For the top-level boot catches (`13251-13254`), add `track('boot_error', {fn: 'xxx', msg: e.message})` so PostHog captures them once it's wired up.

---

### 13. `anthropic-version: '2023-06-01'` — pinned to a 3-year-old API version
- **What**: Both the direct browser call and the Vercel proxy use `anthropic-version: '2023-06-01'`.
- **Where**: `index.html:4878`, `api/claude.js:41`
- **Why it matters**: Anthropic may deprecate old API versions. The current version also lacks access to newer features (extended thinking, improved tool use). Low urgency but risks a silent breakage on deprecation.
- **Effort**: S
- **Suggested fix**:
  - Update to `anthropic-version: '2024-01-01'` or the current latest in both files.
  - Test the response shape hasn't changed (it hasn't for basic messages).

---

### 14. `sbSyncNow()` has no backoff or conflict resolution beyond last-write-wins
- **What**: Cloud sync pushes the entire JSON blob on every save. Last-write-wins by `_updatedAt`. If a user has two tabs open simultaneously, one tab's changes can be silently overwritten.
- **Where**: `index.html:10060-10084` (`sbSyncNow()`)
- **Why it matters**: Multi-tab usage (desktop + phone) is a stated goal. Silent data loss on concurrent edits is a trust-destroying bug.
- **Effort**: M
- **Suggested fix**:
  - Before pushing, check if the remote `updated_at` is newer than the local push baseline (not the current `S._updatedAt`).
  - Show a "Conflict detected — which version do you want to keep?" prompt with timestamps when a concurrent write is detected.

---

### 15. Missing loading/error states on `callClaude()` when proxy is returning 5xx
- **What**: `callClaude()` handles 429 and 401 with specific messages but returns `null` for all other errors — the AI button re-enables but the result area stays empty with no feedback.
- **Where**: `index.html:4882-4889`
- **Why it matters**: A 502 or 503 from the Vercel edge shows the user nothing. They click the AI button again, same result, then conclude AI is "broken".
- **Effort**: S
- **Suggested fix**:
  - The existing `toast(msg)` path at line 4884 should also fire for non-429/401 errors.
  - Add a generic fallback: `toast('AI unavailable — check your connection and try again')` when `res.ok` is false and status isn't 429/401.

---

## 💡 P3 — Nice to have

### 16. No service-worker update notification — stale PWA users get confused
- **What**: The SW caches aggressively with `skipWaiting()` and `clients.claim()`, silently updating all tabs. Users on stale versions get mismatched state.
- **Where**: `sw.js:21` (install), `sw.js:30` (activate)
- **Why it matters**: After a major deploy (e.g., data model change), users with the old SW may see broken behavior until they manually hard-refresh. Low urgency but worth fixing before the user base grows.
- **Effort**: S
- **Suggested fix**:
  - In the main script, listen for `navigator.serviceWorker.addEventListener('controllerchange', ...)` and show a toast: *"App updated — tap to reload"* with `location.reload()` on confirm.

---

### 17. PostHog key is empty — zero product analytics in production
- **What**: `posthogKey: ''` means no events are captured despite `track()` being called throughout the codebase.
- **Where**: `index.html:9813`
- **Why it matters**: There's no data to inform prioritization. Zero visibility into which features are actually used, where users drop off, or whether auth is succeeding.
- **Effort**: S
- **Suggested fix**:
  - Create a free PostHog project, paste the key into `APP_CONFIG.posthogKey`.
  - Start by tracking: `auth_login`, `auth_signup`, `task_added`, `ai_called`, `sync_error`.

---

### 18. `givelink.html` — `<select>` option text not escaped
- **What**: Similar to item 2, `givelink.html` uses a pattern of inserting user-controlled strings into HTML without escaping in several places.
- **Where**: `givelink.html` — specific lines need audit once `index.html` XSS is resolved
- **Why it matters**: Givelink stores goal and task data; same XSS risk applies.
- **Effort**: S
- **Suggested fix**:
  - Add the same `esc()` function to `givelink.html` and apply it to all innerHTML templating.

---

### 19. No keyboard-accessible close on sidebar overlay (mobile)
- **What**: The `.s-ov` overlay closes the sidebar on click but has no `role`, `aria-label`, or `tabindex`. Screen-reader and keyboard users can't close the mobile sidebar.
- **Where**: `index.html:854` (`<div class="s-ov" id="s-ov" onclick="toggleSB()">`)
- **Why it matters**: Basic ARIA accessibility gap. Any WCAG audit would flag this.
- **Effort**: S
- **Suggested fix**:
  - Add `role="button" tabindex="0" aria-label="Close menu"` and a `keydown` handler for Enter/Space.

---

### 20. `vercel.json` — no CSP header configured
- **What**: There are no `Content-Security-Policy` headers in `vercel.json`, leaving the app open to script injection from external sources.
- **Where**: `vercel.json`
- **Why it matters**: Combined with the XSS vulnerabilities above, a missing CSP means any injected script can freely exfiltrate data. A restrictive CSP would contain the blast radius.
- **Effort**: M
- **Suggested fix**:
  - Add a strict CSP: `default-src 'self'; script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com; connect-src 'self' https://*.supabase.co https://api.anthropic.com https://us.i.posthog.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com`.
  - Note: `'unsafe-inline'` is required while JS is inline in the HTML. Extracting to `app.js` (item 11) is a prerequisite for removing it.
