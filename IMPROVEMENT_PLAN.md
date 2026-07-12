# Task OS — Improvement Plan
_Generated 2026-07-12_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push and in-app notification icons return 404
**What:** Both the service-worker push handler and the in-app reminder scheduler reference `./icons/icon-192.png`, but the file sits at `./icon-192.png` (no `icons/` subdirectory).
**Where:** `sw.js:41-42`, `index.html:10769`
**Why it matters:** Every push notification and every reminder fires with a broken icon. On Android and iOS the missing icon displays a blank/grey tile; on some browsers the notification is dropped silently.
**Effort:** S
**Suggested fix:**
- In `sw.js` change lines 41-42: `icon:'./icon-192.png'`, `badge:'./icon-192.png'`
- In `index.html:10769` change `'./icons/icon-192.png'` → `'./icon-192.png'`
- Bump the SW cache key (`CACHE`) after the fix so the corrected worker deploys immediately

---

### 2. AI features are completely non-functional in hosted mode
**What:** `APP_CONFIG.aiProxy` is set to `''` (empty string) in the committed source, so every AI call falls through to the "Add your Claude API key in Settings" error — even though hosted users can't add an Anthropic key themselves.
**Where:** `index.html:9812`, also `index.html:4184, 4863-4864, 4903, 4967`
**Why it matters:** Auto-triage, Plan My Day, AI commands, and task-reply-with-AI — all the headline features in the hosted tier — silently fail at the first click. This is the biggest conversion killer for new signups.
**Effort:** S
**Suggested fix:**
- Set `aiProxy: 'https://<your-vercel-domain>/api/claude'` in `index.html:9812`
- The Vercel proxy already exists and is wired up (`api/claude.js`) — it just needs the URL
- If the proxy URL varies per environment, inject it at deploy time (Vercel env var `NEXT_PUBLIC_AI_PROXY` + a build step, or a `/_config.js` endpoint)

---

### 3. No per-user rate limiting on the AI proxy — single account can drain the bill
**What:** `api/claude.js` forwards every authenticated request to Anthropic with no token budget per user or per day. The file itself notes "for production add per-user rate limiting."
**Where:** `api/claude.js:12-13` (comment), entire handler
**Why it matters:** A single compromised session token, a runaway client loop, or an intentionally abusive user can exhaust the Anthropic API budget with no circuit-breaker. Financial exposure is unbounded.
**Effort:** M
**Suggested fix:**
- Add Upstash Redis rate-limit (5 req/min per UID, 200 req/day per UID) in the handler before calling Anthropic
- Return HTTP 429 with `Retry-After` on breach
- Log rate-limit hits to a Vercel log drain for visibility

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. `authLogout()` and `sbDisconnect()` don't invalidate the server-side session
**What:** Both functions delete the local tokens from `localStorage` but never call `POST /auth/v1/logout` on Supabase, leaving the refresh token valid on the server until it naturally expires (~1 week).
**Where:** `index.html:9966-9970` (`authLogout`), `index.html:9906-9908` (`sbDisconnect`)
**Why it matters:** Anyone who steals the refresh token (e.g. via a compromised device) can continue to authenticate for up to a week after the user "signs out." On a shared device, this is a real privacy risk.
**Effort:** S
**Suggested fix:**
- In `authLogout`, call `fetch(${_SB.url}/auth/v1/logout, {method:'POST', headers:{apikey:_SB.anon, Authorization:'Bearer '+_SB.access}})` before clearing localStorage
- Same in `sbDisconnect`; wrap in `try/catch` so a network failure doesn't block the local sign-out

---

### 5. `authMagic()` sends duplicate requests and has no loading feedback
**What:** The "Email me a magic link" button has no `disabled` state and no loading indicator. A user who taps it twice sends two back-to-back OTP requests; on mobile, a double-tap is easy to do.
**Where:** `index.html:9950-9959`
**Why it matters:** Supabase OTP has a per-email cooldown that kicks in on the second request, showing users a confusing "rate limited" error right after they think they've requested a magic link.
**Effort:** S
**Suggested fix:**
- Disable the magic-link button on click (`btn.disabled=true; btn.textContent='Sending…'`) just as `authSubmit` does for the password button (see pattern at `index.html:9930`)
- Re-enable the button on success or catch, update text to "Resend link"

---

### 6. Account chip (`#account-chip`) is a `<div>` — keyboard and screen-reader inaccessible
**What:** The account chip (sign-out, rename) is rendered as a `<div onclick>` with no `tabindex` or `role`, so it cannot be reached via Tab key and announces as nothing to screen readers.
**Where:** `index.html:941`, styles at `index.html:757-763`
**Why it matters:** Keyboard-only and assistive-technology users cannot access sign-out. Any security audit will flag this immediately.
**Effort:** S
**Suggested fix:**
- Change the element to `<button>` (or add `tabindex="0" role="button" aria-label="Account options"`)
- Add `onkeydown="if(event.key==='Enter'||event.key===' ')_openAcctMenu(event)"` alongside the existing `onclick`

---

### 7. `sbConnect()` silently creates a new account when login fails
**What:** In the self-hosted Supabase flow, if password login returns an error (e.g. wrong password), the code immediately attempts a signup with those same credentials. A user who misremembers their password will have a second, blank account created without warning.
**Where:** `index.html:9891-9896`
**Why it matters:** Creates orphaned accounts and confuses users who then can't find their data. This is the "Settings → Connect Sync" flow, used by power users setting up their own Supabase.
**Effort:** S
**Suggested fix:**
- Separate the two actions: show the auth error from the login attempt and let the user choose "Create account instead" via an explicit button, rather than auto-falling through
- Or: check the Supabase error code — `invalid_credentials` → wrong password, don't try signup; `user_not_found` → explicitly ask the user to confirm they want to create an account

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 8. Service-worker cache version must be hand-bumped on every deploy
**What:** `sw.js:1` has `const CACHE = 'task-os-20260711'` as a hardcoded string. If a developer forgets to update it, users continue running the old cached app for weeks.
**Where:** `sw.js:1`
**Why it matters:** Already happened once — commit #60 ("Bump service-worker cache to force PWA update") exists purely because this was missed. One forgotten bump = silent regression for all installed PWA users.
**Effort:** S
**Suggested fix:**
- Generate the cache key at build time (e.g. `const CACHE = 'task-os-BUILD_ID'` replaced by a Vercel build hook or a simple shell script that writes the ISO date)
- Or use a `version.js` file imported by both `sw.js` and `index.html` so they're always in sync

---

### 9. Anthropic model ID is hardcoded in two different files
**What:** `claude-haiku-4-5-20251001` appears in both `api/claude.js:42` (the proxy) and `index.html:4879` (the direct-key path). When the model is updated, both must be changed or they silently diverge.
**Where:** `api/claude.js:42`, `index.html:4879`
**Why it matters:** The proxy and client-side path would serve different model versions to different users depending on their setup, causing inconsistent AI output quality with no visible signal.
**Effort:** S
**Suggested fix:**
- In the proxy, expose `model` as a passthrough parameter (the client already sends `max_tokens` and `prompt`)
- Let the client decide the model; the proxy just enforces a cap/allowlist
- Or: centralise the model name in an env var `AI_MODEL` and read it in both places

---

### 10. PostHog analytics key is empty — zero production visibility
**What:** `APP_CONFIG.posthogKey: ''` means PostHog is a no-op. Every `track()` call silently does nothing; there is no data on which features are used, where users drop off, or whether the #68 hosted-signup flow converts.
**Where:** `index.html:9813`
**Why it matters:** Without analytics, all product decisions about AI usage, auth conversion, and churn are guesses. Especially relevant now that the app is live for external signups.
**Effort:** S
**Suggested fix:**
- Add `posthogKey` and `posthogHost` to the Vercel environment and inject them the same way `aiProxy` should be injected
- Alternatively, use the PostHog snippet directly (already partially present at `index.html:10039`) with the key set at deploy time

---

### 11. State object `S` has 60+ unvalidated fields serialized to a single localStorage key
**What:** The `S` object declared at `index.html:2404` has over 60 top-level fields, all written to one `localStorage` key via `save()`. There is no schema validation on load — `JSON.parse` can silently rehydrate missing or wrong-typed fields.
**Where:** `index.html:2404` (`let S = {...}`), `index.html:2475` (`load()`)
**Why it matters:** A partial-write corruption (browser killed mid-`setItem`) or a schema mismatch after a deploy can leave users with invisible data loss or broken rendering. The `catch` in `load()` resets to defaults, losing all data.
**Effort:** M
**Suggested fix:**
- Add a lightweight migration layer: on load, check `S._schemaVersion` and apply additive migrations (add missing fields, rename moved ones)
- Short-term: add a defensive `S = {...DEFAULT_S, ...parsed}` merge so missing keys get their defaults rather than `undefined`

---

### 12. `index.html` is 14,400 lines — a single file containing CSS, HTML, and all JS
**What:** The entire application (CSS, layout HTML, and ~12,000 lines of JavaScript) lives in one file with no module boundaries, no component separation, and no way to tree-shake or code-split.
**Where:** `index.html` (entire file)
**Why it matters:** Adding a feature means searching 14k lines for the right insertion point. Debugging a regression requires reading minified-in-spirit inlined code. The file is already too large for LLM context windows to analyse whole. Velocity slows with every feature.
**Effort:** L
**Suggested fix:**
- This is a rewrite risk, so proceed incrementally: extract the CSS into `style.css`, extract the JS into `app.js` as a first pass
- Then split by domain: `auth.js`, `sync.js`, `ai.js`, `tasks.js` — each can be independently edited and tested
- Don't attempt a framework migration at the same time; vanilla JS extraction is safe and reversible

---

## 💡 P3 — Nice to have

### 13. `givelink.html` uses a blue design system that diverges from the Task OS brand
**What:** `givelink.html` is styled entirely in blue (`--accent:#3b82f6`, dark navy background) while Task OS uses violet/purple (`--accent:#8b7cff`). The two apps look like they belong to different companies.
**Where:** `givelink.html:17-19`
**Why it matters:** Undermines the Givelink brand coherence when users switch between the two apps (⌘+2). May be intentional as a separate product, but currently it looks unfinished.
**Effort:** M
**Suggested fix:**
- Decide: is Givelink a sub-brand (keep distinct palette) or part of Task OS (align to violet)?
- If sub-brand: document the deliberate choice so future devs don't "fix" it
- If aligned: port the CSS variable names and update the theme colours to match the violet system

---

### 14. Inline hex colours throughout `index.html` bypass the CSS custom-property theme system
**What:** Dozens of inline `style=` attributes use hardcoded hex values (`#58a6ff`, `#74c0fc`, `#a78bfa`, `#ff6b6b`, etc.) that are not in the `:root` variable set and don't change in light mode.
**Where:** `index.html:5078, 5180, 5532-5534, 5738-5740, 5809-5813` and ~20 other locations
**Why it matters:** The light-mode theme (`body.light`) changes every `--accent`, `--q1`, etc., but inline colours stay dark. Users who switch to light mode see dark stat numbers on light backgrounds with poor contrast.
**Effort:** M
**Suggested fix:**
- Add the missing colours as CSS variables (e.g. `--c-blue:#58a6ff`) in both `:root` and `body.light`
- Replace inline `style="color:#58a6ff"` with `class="c-blue"` or `style="color:var(--c-blue)"`

---

### 15. `authLogout` doesn't clear the PostHog identity — analytics bleed between sessions
**What:** `authLogout()` calls `posthog.reset()` correctly, but `sbDisconnect()` (the non-hosted logout path) does not call `posthog.reset()`, so the next user on the same device inherits the previous user's PostHog identity.
**Where:** `index.html:9906-9908` (`sbDisconnect`)
**Why it matters:** On shared devices (family iPad, demo device), analytics events from a new user are attributed to the previous account. Low severity now since PostHog key is empty, but will matter once analytics is live.
**Effort:** S
**Suggested fix:**
- Add `try{if(window.posthog&&posthog.reset)posthog.reset();}catch(e){}` to `sbDisconnect()`, mirroring the pattern already in `authLogout()`
