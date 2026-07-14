# Task OS / Givelink — Improvement Plan
_Generated 2026-07-14. Based on full codebase review of `index.html`, `givelink.html`, `api/claude.js`, and `sw.js`._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Claude API key synced to Supabase in plain text
**What:** `S.claudeKey` lives inside the main state object `S`, which is pushed verbatim to Supabase via `sbPush()`.  
**Where:** `index.html:9770` (key stored in S), `index.html:10056` (`data:S` sent to DB), `index.html:2404` (S declaration includes `claudeKey:''`)  
**Why it matters:** Every user's Anthropic API key is stored in your Supabase `app_state` table. A DB leak or misconfigured RLS policy exposes all keys. Users' billing accounts are at risk.  
**Effort:** S  
**Suggested fix:**
- Strip sensitive fields before pushing: in `sbPush()`, spread `S` and delete `claudeKey` from the payload before `JSON.stringify`.
- Store `claudeKey` only in `localStorage` (separate from the synced `S` object), and read it back from there on load — never include it in `S`.
- Verify that `save()` to `localStorage` also excludes the key, or accept it there (browser-only, same-origin access) while keeping Supabase clean.

---

### 2. Hardcoded "Panos" persona in AI prompts — all non-Panos users get wrong AI output
**What:** Every AI workflow (week planner, relationship radar, discomfort coach, brand auditor, weekly review) falls back to `'Panos — Greek founder building Givelink...'` when "About Me" is empty. Several prompts hardcode "Panos" even when About Me _is_ filled.  
**Where:** `index.html:5300, 5310, 5507, 5780, 7179, 7337, 7421, 7709` (10+ occurrences)  
**Why it matters:** Every new hosted user gets AI advice tailored to Panos's specific situation (SF move, Givelink fundraising, etc.), making the AI features seem broken or creepy. Kills trust on the first AI interaction.  
**Effort:** S  
**Suggested fix:**
- Replace the `'Panos — Greek founder...'` fallback with a generic: `'A professional focused on productivity and personal growth.'`.
- Do a global search for `Panos` in `index.html` and replace hardcoded name references inside prompt strings with `${profileName}` or `the user`.
- One-liner audit: `grep -n "Panos" index.html | grep "prompt\|return \`"`.

---

### 3. Sign-in wrong password silently triggers account creation
**What:** `sbConnect()` catches any sign-in failure and immediately attempts `signup`. An existing user who types the wrong password gets "email already registered" instead of "wrong password".  
**Where:** `index.html:9891–9896`  
**Why it matters:** Users with the wrong password are stuck: they can't log in and the error message ("Sign-in/up failed") gives no actionable hint. Essentially locks people out.  
**Effort:** S  
**Suggested fix:**
- Separate the sign-in and sign-up paths. Try sign-in; if it fails, surface the specific Supabase error message (e.g. `'Invalid login credentials'` vs. `'Email not confirmed'`).
- Only auto-create an account if the user explicitly clicked a "Sign up" button, not on sign-in failure.
- Mirror the pattern already in the hosted `authSubmit()` function at line 9925 — it correctly branches on `_agMode`.

---

### 4. Auth boot failure is silently swallowed — users see a blank/broken state
**What:** The top-level boot sequence wraps `_authBoot()` in `try{...}catch(e){}` with no logging or user feedback. If auth fails (network down, Supabase rate limit, RLS mismatch), the app silently shows the main UI without user data.  
**Where:** `index.html:13253`  
**Why it matters:** Silent auth failures mean data loss events look like bugs to users. Support tickets with "my tasks disappeared" are impossible to debug.  
**Effort:** S  
**Suggested fix:**
- Log to `console.warn('Auth boot failed:', e)` at minimum.
- If `_hostedMode()` is true and boot fails, show the auth gate (`_showAuthGate()`) rather than an empty app.
- Add a visible "Could not connect — retrying…" sync status via `_sbSetStatus('⚠ Boot failed — tap to retry')`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. AI features silently broken for all hosted users — aiProxy is empty by default
**What:** `APP_CONFIG.aiProxy` is set to `''`. Without it, all AI features show a toast telling users to "Add Claude API key in Settings" — a dead end for users who don't have an Anthropic account.  
**Where:** `index.html:9812`  
**Why it matters:** AI is the core differentiator of the app. New hosted users discover it doesn't work on their first tap. Conversion-killing first impression.  
**Effort:** S  
**Suggested fix:**
- Set `aiProxy: 'https://<your-vercel-app>.vercel.app/api/claude'` as the deployed default — the proxy already exists in `api/claude.js`.
- If intentionally leaving it empty for dev, add a Settings UI callout: a yellow banner in the AI section explaining the setup steps, with a link to the docs.
- Gate the AI workflow buttons with a visual disabled state + tooltip rather than a post-click toast.

---

### 6. Page title and greeting flash "Task OS — Panos" for all new users
**What:** The HTML `<title>` is hardcoded `Task OS — Panos` and the greeting `<h1>` is `Good morning, Panos 👋`, both visible before JavaScript runs and before localStorage is read.  
**Where:** `index.html:17` (title), `index.html:951` (h1 greeting)  
**Why it matters:** Every new user's first impression is an app configured for someone else. Browser history, bookmarks, and PWA launchers all show "Panos". Non-trivially confusing for a multi-user hosted product.  
**Effort:** S  
**Suggested fix:**
- Change `<title>` to `Task OS` and update it dynamically after name loads: `document.title = 'Task OS — ' + profileName`.
- Change the static h1 to `Good morning 👋` and let the JS update it as it already does at line 2886 (the update function exists; the initial HTML just needs to be neutral).

---

### 7. Givelink Sprint Board uses blue accent — brand diverged after violet rebrand
**What:** `givelink.html` has `--accent:#3b82f6` (blue), `theme-color: #3b82f6`, and `logo-main` text in blue, while `index.html` was rebranded to violet (`#8b7cff`) in commit #67.  
**Where:** `givelink.html:6` (theme-color), `givelink.html:17` (`--accent`), `givelink.html:26` (`color:var(--accent)` on logo)  
**Why it matters:** Switching between Task OS and the Sprint Board feels like two different products. The Givelink brand is specifically violet — having its own Sprint Board use a completely different color is confusing.  
**Effort:** S  
**Suggested fix:**
- Update `:root` variables in `givelink.html`: set `--accent:#8b7cff` to match the main app's violet.
- Update `<meta name="theme-color" content="#8b7cff">`.
- The pillar colors (green/blue/pink/yellow/purple) can stay as-is — only the primary accent needs to match.

---

### 8. SVG used as apple-touch-icon in Givelink — blank icon on iOS Home Screen
**What:** `givelink.html` sets `<link rel="apple-touch-icon" href="icon-gl.svg">`. iOS does not support SVG for home screen icons; it silently shows a blank white square.  
**Where:** `givelink.html:11`  
**Why it matters:** PWA home screen icon is blank when users add Givelink to their iPhone. The `apple-touch-icon.png` already exists in the repo.  
**Effort:** S  
**Suggested fix:**
- Change `href="icon-gl.svg"` to `href="apple-touch-icon.png"` (the 180×180 PNG already present).
- Ideally create a givelink-specific `apple-touch-icon-gl.png` with violet branding, but the existing PNG is an immediate fix.

---

### 9. No rate limiting on the AI proxy — one user can drain the entire Anthropic bill
**What:** `api/claude.js` explicitly notes _"for production add per-user rate limiting (e.g. Upstash)"_ but it's not implemented. Any authenticated user can make unlimited calls.  
**Where:** `api/claude.js:13`  
**Why it matters:** A single power user running the AI Workflows hub in a loop (or a malicious actor who gets a valid session token) can run up thousands of dollars in Anthropic API costs with no circuit breaker.  
**Effort:** M  
**Suggested fix:**
- Add Upstash Redis rate limiting: ~10 requests/user/minute, 200/user/day. Upstash has a Vercel integration and a free tier.
- Alternatively, use Vercel's built-in edge middleware with a simple in-memory sliding window (acceptable for low concurrency).
- Return `429 Too Many Requests` with a `Retry-After` header and surface it as a user-friendly toast in the client.

---

### 10. Sub-prompts hardcode "Panos" even when About Me is filled
**What:** Beyond the fallback issue (item #2), some prompt strings hardcode the name even when `about` is populated: _"Who should **Panos** reach out to this week"_ (line 5507), _"give **Panos**: 1. A 2-sentence analysis"_ (line 5780), _"Audit **Panos**'s brand presence"_ (line 7179).  
**Where:** `index.html:5507, 5780, 7179, 7337`  
**Why it matters:** Even users who fill out "About Me" still get responses addressed to "Panos" — the AI response says "Panos, I recommend..." which is jarring and breaks immersion.  
**Effort:** S  
**Suggested fix:**
- Replace hardcoded `Panos` in prompt body strings with `${profileName}`.
- Example: `'Who should ${profileName} reach out to this week...'`.
- Use the same grep one-liner from item #2 to find all occurrences.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. S state object is a 70-key monolith — root cause of the security bug and data corruption risk
**What:** The `S` object at line 2404 contains 70+ top-level keys including tasks, goals, habits, finance, relationships, AI keys, and now `claudeKey`. It's serialized as a single JSON blob to both localStorage and Supabase.  
**Where:** `index.html:2404`  
**Why it matters:** Any two features adding a key with the same name silently corrupt each other's data. Schema migrations are impossible without breaking existing users. The `claudeKey` security issue exists because secrets are mixed with non-sensitive data in the same bag.  
**Effort:** L  
**Suggested fix:**
- Short-term: Extract `claudeKey` out of `S` immediately (see P0 item #1).
- Medium-term: Split into logical sub-objects: `S.settings`, `S.tasks`, `S.goals`, `S.healthData`, etc., each saved with its own `localStorage` key.
- This allows fine-grained sync (sync only `tasks` when tasks change) and prevents cross-contamination.

---

### 12. AI JSON parsing pattern duplicated 4+ times — should be a utility
**What:** The pattern `try{const s=txt.replace(/```[\w]*\n?/g,'').trim();const j=s.match(/\[[\s\S]*\]/)?.[0];if(j)items=JSON.parse(j);}catch(e){...}` is copy-pasted across four AI response handlers.  
**Where:** `index.html:11765, 11870, 11968, 12047`  
**Why it matters:** One bug fix or format change requires updating four separate places. Currently each catch does something slightly different, making behavior inconsistent.  
**Effort:** S  
**Suggested fix:**
- Extract `function _parseAiArray(txt){try{const s=txt.replace(/```[\w]*\n?/g,'').trim();const j=s.match(/\[[\s\S]*\]/)?.[0];return j?JSON.parse(j):null;}catch(_){return null;}}`.
- Similarly extract `_parseAiObject(txt)` for the `{}` variant used at lines 4200, 4994, 9102.

---

### 13. Silent empty catch blocks in givelink.html hide runtime errors
**What:** `givelink.html` has three empty `catch(e){}` blocks that swallow errors completely, including CRM data parsing failures.  
**Where:** `givelink.html:1083, 1209, 1214`  
**Why it matters:** When the CRM or nonprofit data fails to load, the user sees an empty view with no error message and no way to diagnose the problem.  
**Effort:** S  
**Suggested fix:**
- Replace each with `catch(e){console.warn('[givelink] data parse error:', e);}` at minimum.
- For lines 1209 (`profiles=[]`) and 1214 (`tosData=null`) add a user-visible fallback: `toast('Could not load data — try refreshing')` if the failure affects rendered UI.

---

### 14. Service worker cache version is manually updated — will be forgotten again
**What:** `CACHE = 'task-os-20260711'` is a hardcoded string. Commit #60 was explicitly _"Bump service-worker cache to force PWA update"_ — this is a recurring manual step.  
**Where:** `sw.js:1`  
**Why it matters:** When the cache version isn't bumped after a deploy, PWA users continue serving stale HTML from the service worker cache and see old bugs even after a fix is deployed. This is a production correctness risk.  
**Effort:** S  
**Suggested fix:**
- Auto-generate at build time: if using Vercel, inject `VITE_BUILD_ID` or a similar env var and reference it in `sw.js`. For a no-build setup, use a `?v=` query param pattern on the HTML fetch.
- Alternative: move to a Workbox setup where cache versioning is handled automatically.
- Minimum viable: add a comment in `sw.js` reading `// UPDATE THIS on every deploy: task-os-YYYYMMDD`.

---

### 15. Notion and Readwise API keys stored in localStorage under obvious keys
**What:** Third-party API keys are stored as `taskos_readwise_key`, `taskos_notion_key`, `taskos_notion_page` — plain readable names in localStorage.  
**Where:** `index.html:9752–9781`  
**Why it matters:** While localStorage is same-origin only, any XSS vulnerability or browser extension with broad permissions can enumerate these obvious keys. The pattern of storing multiple API credentials in localStorage compounds risk.  
**Effort:** S  
**Suggested fix:**
- These don't need to move (localStorage is appropriate for browser-only secrets), but they should not be synced to Supabase — verify they're not in `S` object. Currently they appear to use separate `localStorage.setItem()` calls, which is correct.
- Add a comment in settings save function explicitly noting "intentionally NOT in S — not synced to cloud".

---

## 💡 P3 — Nice to have

### 16. No `<meta name="description">` on either page — SEO and social sharing broken
**What:** Neither `index.html` nor `givelink.html` has a `<meta name="description">` tag or Open Graph tags.  
**Where:** `index.html:1–20`, `givelink.html:1–15`  
**Why it matters:** Shared links show blank previews in Slack, iMessage, and Twitter. Search engines show no description snippet.  
**Effort:** S  
**Suggested fix:** Add `<meta name="description" content="Task OS — your personal operating system for productivity, goals, and life design.">` and `<meta property="og:title">`, `<meta property="og:image">` pointing to the 512px icon.

---

### 17. Burndown chart renders off-screen for tasks completed outside sprint dates
**What:** `renderBurndown()` maps snapshot dates to SVG x-coordinates assuming they fall between `sprint.start` and `sprint.end`. Snapshots recorded before the start date or after the end get negative or >280px x values.  
**Where:** `givelink.html:754–775`  
**Why it matters:** The chart silently renders broken polylines (points off-screen or at negative coords) when tasks are toggled outside the sprint window.  
**Effort:** S  
**Suggested fix:** Clamp `dateToX` to `[pad, W-pad]`: `const x = Math.max(pad, Math.min(W-pad, pad + ...))`.

---

### 18. `max_tokens` capped at 2000 in the AI proxy — complex tasks get truncated
**What:** `api/claude.js:35` caps `max_tokens` at 2000 regardless of what the client requests. Some AI workflows (weekly review synthesis, morning briefing) return long-form content that gets cut off.  
**Where:** `api/claude.js:35`  
**Why it matters:** Long AI responses get silently truncated mid-sentence, making the output look broken. Users may assume the AI is bad rather than that a server-side cap is cutting the response.  
**Effort:** S  
**Suggested fix:** Raise the cap to `4096` (or `8192` for claude-haiku-4-5 which supports it). Keep a per-request minimum validation (`max_tokens < 1`) to reject malformed requests.

---

### 19. Push notification icon path is wrong in service worker
**What:** `sw.js:42` sets `icon: './icons/icon-192.png'` (note the `icons/` subdirectory) but the actual file is at `./icon-192.png` (repo root, no subdirectory).  
**Where:** `sw.js:42–43`  
**Why it matters:** Push notifications show no icon (broken image) on Android. This likely affects the reminder notifications triggered from the notification settings.  
**Effort:** S  
**Suggested fix:** Change `./icons/icon-192.png` → `./icon-192.png` to match the actual file path.

---

### 20. Magic link auth has no callback handler — deep link returns to broken state
**What:** `authMagic()` sends a magic link via `/auth/v1/otp`. When the user clicks the link in their email, it navigates to the app URL with a Supabase fragment (`#access_token=...`). There is no code to parse this fragment and call `_afterAuth()`.  
**Where:** `index.html:9950–9959` (magic link send), `index.html:10000+` (missing fragment handler)  
**Why it matters:** Magic link sign-in is exposed in the UI but doesn't work end-to-end — users click the email link, land on the app, and are still logged out. Clicking the link a second time shows "session expired".  
**Effort:** M  
**Suggested fix:**
- On page load, check `window.location.hash` for `access_token` and `refresh_token` parameters (Supabase sends them as a URL fragment).
- If found, parse and call `_sbStoreSession()`, then `_afterAuth()`, then clear the fragment with `history.replaceState(null, '', window.location.pathname)`.
- Supabase's `exchangeCodeForSession` flow or the `@supabase/supabase-js` client handle this automatically — worth evaluating the JS client.
