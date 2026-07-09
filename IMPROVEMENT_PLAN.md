# Givelink OS — Improvement Plan
_Generated 2026-07-09_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Data leak: logout doesn't wipe localStorage, so the next user inherits the previous user's tasks
- **What**: `authLogout()` removes session tokens but leaves the full app state (`taskos` key) in localStorage; the next person to log in on the same browser gets their empty cloud row overwritten with the previous user's data.
- **Where**: `index.html:9966–9970` (`authLogout` function)
- **Why it matters**: Any new signup on a shared device (or the owner's own browser) will have ~389 of the owner's private tasks pushed to their cloud row on first sync — a privacy and data-integrity bug.
- **Effort**: S
- **Suggested fix**:
  - In `authLogout()`, add `localStorage.removeItem('taskos');` before `location.reload()` (hosted mode only).
  - Ensure `_welcomeSeed()` is triggered cleanly when the next user signs in with an empty cloud row.
  - Consider also resetting the in-memory `S` object to its default state before reload.

---

### 2. Push notification icons are a broken path
- **What**: The service worker hard-codes `./icons/icon-192.png` for push notification icon and badge, but the file lives at `./icon-192.png` (no `icons/` subdirectory).
- **Where**: `sw.js:41–42`
- **Why it matters**: Every push notification (reminders, daily briefing nudges) shows a broken/missing icon on all Android devices; Apple silently ignores it but the badge also fails.
- **Effort**: S
- **Suggested fix**:
  - Change both paths in `sw.js` from `'./icons/icon-192.png'` to `'./icon-192.png'`.
  - Add a smoke-test for push delivery in the dev checklist.

---

### 3. Google Fonts blocked by Content-Security-Policy — Inter never loads in production
- **What**: The CSP in `vercel.json` sets `style-src 'self' 'unsafe-inline'` and `font-src 'self'`, which blocks the `fonts.googleapis.com` stylesheet and `fonts.gstatic.com` font files. The `<link>` to Inter in the `<head>` is silently dropped.
- **Where**: `vercel.json` (CSP header); `index.html:16` (font link)
- **Why it matters**: All users see the OS fallback sans-serif instead of Inter. The typographic brand (tight letter-spacing, weight hierarchy) breaks entirely on platforms where the system font is Helvetica or Roboto.
- **Effort**: S
- **Suggested fix**:
  - Add `https://fonts.googleapis.com` to `style-src` in the CSP.
  - Add `https://fonts.gstatic.com` to `font-src`.
  - Alternatively, self-host the Inter woff2 files and remove the external dependency entirely (better for performance + privacy).

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. New hosted-mode users see AI features that silently do nothing
- **What**: `APP_CONFIG.aiProxy` is an empty string; `aiPlanDay()` and all AI flows fall through to `S.claudeKey` (also empty in hosted mode), then call `toast('Add your Claude API key…')` — an irrelevant instruction for hosted users who were never shown a key setup step.
- **Where**: `index.html:9812` (config), `index.html:4967` (aiPlanDay guard)
- **Why it matters**: "Plan my day", the AI daily briefing, and the AI-reply-to-task features are prominent CTAs on the dashboard. Clicking them and getting an error about an API key is confusing and kills the "wow" moment for new signups.
- **Effort**: M
- **Suggested fix**:
  - Configure the `aiProxy` URL (`https://<your-domain>/api/claude`) in `APP_CONFIG`.
  - Update the error toast to distinguish "proxy not configured" (your infrastructure problem) from "no key" (user setup problem).
  - Alternatively, grey out the AI buttons with a tooltip until the proxy is wired up.

---

### 5. `givelink.html` prompts for API key with `window.prompt()` — jarring on mobile
- **What**: `callClaudeGL()` calls the Anthropic API directly from the browser and falls back to `window.prompt('Enter Anthropic API key:')` if no key is in localStorage. The AI sprint planner and outreach generator both use this path.
- **Where**: `givelink.html:1261`
- **Why it matters**: `window.prompt()` is a system dialog — it breaks the visual design, is blocked in some mobile browsers, and leaks the raw API key via the URL bar on some implementations. Users new to the Givelink tab hit this with no context.
- **Effort**: M
- **Suggested fix**:
  - Route `callClaudeGL` through the same `/api/claude` proxy as `index.html` does (checking `APP_CONFIG.aiProxy`).
  - Replace the `window.prompt` fallback with an inline sheet that explains the key requirement and links to setup.
  - If the proxy isn't configured, disable the AI buttons and show a one-line notice.

---

### 6. No per-user rate limiting on the Claude proxy — a single account can exhaust the API budget
- **What**: The serverless proxy at `api/claude.js` authenticates the Supabase session but enforces no per-user request cap. The code comment itself says "for production add per-user rate limiting".
- **Where**: `api/claude.js:13` (the TODO comment), lines 17–46 (entire handler)
- **Why it matters**: Any signed-in user can loop requests to drain the Anthropic bill. With "Plan my day" + AI briefings + reply-to-act all hitting the same proxy, a single power user or a malicious account could generate hundreds of requests per hour.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (the standard Vercel stack): 20 requests / user / hour.
  - Or use Vercel's built-in `@vercel/kv` for a simpler in-memory sliding window.
  - Log the `_SB.uid` in each request for visibility.

---

### 7. Auth error messaging is misleading — login failures blame the wrong thing
- **What**: Both wrong-password and unconfirmed-email login failures show the same string: "Wrong email or password — or confirm your email first." The catch block at `index.html:9946` merges two distinct failure modes into one message.
- **Where**: `index.html:9945–9947`
- **Why it matters**: Users who haven't confirmed their email will try re-entering passwords repeatedly instead of checking their inbox. This is a conversion killer for the signup flow.
- **Effort**: S
- **Suggested fix**:
  - Parse the Supabase error body (`j.error_description` or `j.msg`) to distinguish 400/401 cases.
  - Show "Check your email inbox to confirm your account" when the error mentions "Email not confirmed".
  - Show "Incorrect password" for credential failures.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 8. 14,401-line monolithic `index.html` — the entire app in one file
- **What**: All HTML, CSS (≈3,000 lines), JavaScript (≈11,000 lines), and inline data are in a single file with no module boundaries.
- **Where**: `index.html` (entire file)
- **Why it matters**: A simple bug fix requires searching through 14k lines. GitHub diffs are impossible to review; merge conflicts span hundreds of lines. Build tooling (tree-shaking, code splitting, testing) is completely out of reach.
- **Effort**: L
- **Suggested fix**:
  - Begin extracting by concern: `app.css`, `sync.js`, `auth.js`, `ai.js`.
  - A Vite or esbuild build step can bundle them back to a single file for deployment — no server-side change needed.
  - Each extracted module can be tested independently.

---

### 9. 29 empty `catch(e){}` blocks swallow errors in production
- **What**: Across `index.html`, there are 29 catch clauses with an empty body (`catch(e){}`). Errors in sync, auth, rendering, and AI flows disappear silently.
- **Where**: `index.html` (multiple: e.g., lines 9975–9976, 10072, 10102, 13251–13254)
- **Why it matters**: When a user reports "it just stopped working", there is no trail. The `_authBoot`, `sbSyncNow`, and `refresh` calls are all wrapped in silent catches — the three most important flows in the app.
- **Effort**: S
- **Suggested fix**:
  - Replace `catch(e){}` with at minimum `catch(e){console.warn('[TaskOS]', e)}` in development.
  - For critical paths (`_authBoot`, `sbSyncNow`, `refresh`), surface errors to the user via the sync-status pill or a toast.
  - Add a `window.onerror` / `unhandledrejection` handler to PostHog for production visibility.

---

### 10. Supabase URL and anon key hardcoded in the HTML — committed to source
- **What**: `APP_CONFIG.supabaseUrl` and `APP_CONFIG.supabaseAnon` at `index.html:9810–9811` are committed as plaintext. The anon key format (`sb_publishable_...`) is non-standard and doesn't match the expected `eyJ...` JWT.
- **Where**: `index.html:9810–9811`
- **Why it matters**: Anyone with repo access can make authenticated requests to this Supabase project. The non-standard key format may indicate a misconfiguration or staging key accidentally committed. In future, adding any private config to `APP_CONFIG` near these lines risks committing secrets.
- **Effort**: S
- **Suggested fix**:
  - Move credentials to environment variables injected at build time (Vercel env vars → replace tokens in a build script).
  - Or use a `config.js` file that's in `.gitignore`, with a `config.example.js` committed instead.
  - Rotate/verify the anon key format with the Supabase dashboard.

---

### 11. `_hostedMode()` always returns `true` — `seed()` and `seedGoals()` never run locally
- **What**: `_hostedMode()` returns `true` whenever `APP_CONFIG.supabaseUrl` and `supabaseAnon` are truthy. Since both are hardcoded, cloning the repo and opening `index.html` locally always triggers hosted mode, showing the auth gate and skipping the 389-task demo seeding that makes local development useful.
- **Where**: `index.html:9816`, `index.html:10151`
- **Why it matters**: Developers or contributors can't run the app locally without first signing in or blanking the config — a hidden onboarding barrier.
- **Effort**: S
- **Suggested fix**:
  - Add a `devMode` flag or rely on `window.location.hostname === 'localhost'` to bypass hosted-mode requirements locally.
  - Alternatively, use `import.meta.env` or a build-time `__DEV__` constant once a build step exists.

---

### 12. `window.location.href = 'givelink.html'` in keyboard shortcut breaks on subpaths
- **What**: The `Cmd+2` shortcut at `index.html:10137` navigates to `'givelink.html'` as a relative string — it will produce the wrong URL if the app is ever served under a path prefix (e.g., `/app/`).
- **Where**: `index.html:10137`
- **Why it matters**: Low risk today, but if the app is ever moved to a subpath (common in multi-tenant deployments), Cmd+2 will 404.
- **Effort**: S
- **Suggested fix**:
  - Use `window.location.href = new URL('givelink.html', window.location.href).href` or a `nav()` helper that resolves relative to the document's base URL.

---

## 💡 P3 — Nice to have

### 13. Brand divergence: `givelink.html` uses blue (#3b82f6), `index.html` uses violet (#8b7cff)
- **What**: The two apps share the same product family but use entirely different accent palettes — blue for Givelink, violet for Task OS.
- **Where**: `givelink.html:17` (`:root` CSS variables)
- **Why it matters**: Users who open both via Cmd+1/Cmd+2 experience a visual discontinuity that undermines the "unified OS" positioning.
- **Effort**: S
- **Suggested fix**:
  - Align Givelink to the violet brand (`#8b7cff`) or define a shared design token file that both pages import.
  - If Givelink intentionally has its own identity, establish that in the brand guide and enforce it consistently.

---

### 14. PostHog analytics key not configured — flying blind on user behavior
- **What**: `APP_CONFIG.posthogKey` is an empty string; `_initPostHog()` no-ops entirely. No events are captured from production.
- **Where**: `index.html:9813`
- **Why it matters**: There's no visibility into which features are used, where users drop off in auth/onboarding, or whether the "Plan my day" CTA is ever clicked. Conversion optimization is guesswork.
- **Effort**: S
- **Suggested fix**:
  - Add the PostHog project key to `APP_CONFIG` (or inject via env var).
  - Verify that the existing `track()` call sites cover the key events: `auth_signup`, `auth_login`, `auth_logout`, `ai_plan_day`, `task_complete`.

---

### 15. `'unsafe-inline'` in `script-src` weakens XSS protection
- **What**: The CSP uses `script-src 'self' 'unsafe-inline'`, which allows inline `<script>` blocks — the primary XSS vector. While the app has no user-generated HTML rendered as markup today, this leaves a wide attack surface if that ever changes.
- **Where**: `vercel.json` (CSP header)
- **Why it matters**: If any future feature renders user-controlled content (task notes as HTML, webhook payloads, etc.) without escaping, the existing CSP won't mitigate script injection.
- **Effort**: M
- **Suggested fix**:
  - Once a build step exists, move inline scripts to external files and remove `'unsafe-inline'` from `script-src`.
  - Until then, add `'strict-dynamic'` with a nonce to allow the existing inline script while blocking injected ones.
  - Audit all places that set `.innerHTML` to ensure they escape user-controlled strings (see the `esc()` helper — verify it's used consistently).
