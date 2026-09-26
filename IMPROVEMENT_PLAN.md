# Givelink / Arete — Improvement Plan

_Generated: 2026-09-26_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notifications show a broken icon
**What:** Service worker references `./icons/icon-192.png` but that directory does not exist; the actual file is `./icon-192.png`.
**Where:** `sw.js:43` (icon) and `sw.js:44` (badge) — both point to `./icons/icon-192.png`.
**Why it matters:** Every push notification arrives with a broken image, which looks like a buggy or spammy app on the lock screen — users turn off notifications and you lose the re-engagement channel.
**Effort:** S
**Suggested fix:**
- Change both `icon` and `badge` in `sw.js:43-44` from `'./icons/icon-192.png'` to `'./icon-192.png'`.
- Bump the `CACHE` version string so the new SW activates for existing installs.

---

### 2. Givelink: API key collected via `window.prompt()`, then sent directly to Anthropic from the browser
**What:** `getApiKey()` in `givelink.html:1144-1156` falls back to `window.prompt()` to collect the Anthropic key. Both `openAiSprintPlanner()` (line 1200) and `callClaudeGL()` (line 1333) call `api.anthropic.com` directly with `x-api-key` in the request headers, making the key trivially visible in DevTools.
**Where:** `givelink.html:1144-1156`, `1200-1210`, `1325-1340`
**Why it matters:** `window.prompt()` is a jarring, broken-looking UX that many browsers block in PWA mode. Sending the raw key from the browser exposes it in network traffic and browser storage — an easy leak vector. This blocks the entire AI sprint-planner feature.
**Effort:** M
**Suggested fix:**
- Route all Givelink AI calls through the existing `/api/claude.js` proxy (same one used by `index.html`).
- Replace `window.prompt()` with a proper settings UI input (model: the `set-claude-key` input already in `index.html:2029`).
- Remove the `anthropic-dangerous-direct-browser-access` header once the proxy is wired up.

---

### 3. Landing/sitemap hardcode the Vercel deploy URL as canonical, breaking SEO on any domain change
**What:** `landing.html:11,16,17,21` and `sitemap.xml:4` hardcode `https://task-management-beige-eight.vercel.app/` as the canonical URL and OG/Twitter image base. This is a staging URL with no brand value.
**Where:** `landing.html:11,16,17,21` · `sitemap.xml:4`
**Why it matters:** Google uses the canonical tag to decide which URL to rank. With the staging URL canonicalized, any real custom domain gets treated as a duplicate and won't rank. Social previews also point to the staging domain.
**Effort:** S
**Suggested fix:**
- Replace every instance of `task-management-beige-eight.vercel.app` with the production domain in both files.
- Add a `vercel.json` redirect or rewrite rule to ensure the staging domain permanently redirects (301) to the canonical one.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Hosted users hit "Add your Claude API key" for all AI features because `aiProxy` is blank
**What:** `APP_CONFIG.aiProxy` is `''` in `index.html:9959`. Every AI call (`_aiCmd`, `runPriorityAudit`, `aiPlanMyDay`) guards with `if(!S.claudeKey&&!APP_CONFIG.aiProxy)` and shows a toast that dead-ends the user.
**Where:** `index.html:9959`, `4328`, `5047`, `5111`
**Why it matters:** "Plan My Day" and "Priority Audit" are the primary conversion hooks for the AI tier. A hosted user's first tap on them hits a wall instead of a magic moment — directly suppressing upgrade intent.
**Effort:** S
**Suggested fix:**
- Deploy `/api/claude.js` on Vercel and paste its URL into `APP_CONFIG.aiProxy`.
- Wire the Supabase auth check in that proxy (env vars `SUPABASE_URL` + `SUPABASE_ANON_KEY`) so only signed-in users can call it.
- Add Upstash rate limiting (the proxy already notes this as needed — `api/claude.js:12`).

---

### 5. No "forgot password" recovery path in the auth gate
**What:** The auth modal (`index.html:870-890`) has Login, Signup, Magic Link, and Google OAuth — but no "Forgot password?" link. A user who forgets their password and doesn't see magic link has no obvious escape.
**Where:** `index.html:870-890` (auth gate HTML)
**Why it matters:** Password resets are a standard expectation. Without it, locked-out users churn rather than recover — especially likely for users who signed up, left for a week, and came back.
**Effort:** S
**Suggested fix:**
- Add a "Forgot password?" link below the login form.
- Supabase supports password reset via `/auth/v1/recover` with an email param — one `fetch` POST plus a toast is sufficient.
- Route the recovery link email back to the app URL so the reset token is handled.

---

### 6. `sbSyncNow` last-write-wins merge silently drops local changes on multi-device use
**What:** `sbSyncNow` at `index.html:10421` does `S={...S,...remote.data}` (shallow spread overwrites local state) whenever `remote.ms > localMs`. Any task edits made offline or on a second device between syncs are silently discarded.
**Where:** `index.html:10418-10432`
**Why it matters:** A user who edits tasks on their phone while offline, then opens the laptop, will silently lose the phone edits — the worst possible data-loss scenario for a task manager.
**Effort:** M
**Suggested fix:**
- Merge at the task level: diff `S.tasks` by `id`, keeping whichever task has the newer `updatedAt` (or a per-task vector clock).
- Alternatively, track per-entity dirty sets and only push/pull changed records to reduce conflict surface.
- At minimum, if `remote.ms > localMs` but `localMs > 0`, prompt: "Cloud has newer data — overwrite local changes?" before clobbering.

---

### 7. PostHog key is blank — no analytics in production
**What:** `posthogKey: ''` in `APP_CONFIG` (`index.html:9960`). PostHog `init` silently no-ops. All `track()` calls throughout the app are no-ops.
**Where:** `index.html:9960`, `10392`
**Why it matters:** No data means no way to know where users drop off, which features they use, or whether the first-run flow converts. Every growth experiment is flying blind.
**Effort:** S
**Suggested fix:**
- Create/retrieve the project's PostHog key from app.posthog.com and paste it into `APP_CONFIG.posthogKey`.
- Verify `_phIdentify()` fires correctly after sign-in (it already calls `posthog.identify` — it just needs a non-empty key to work).

---

### 8. Magic link auth gives no actionable error feedback on failure
**What:** `authMagic()` at `index.html:10101-10106` catches any network or API error and shows the generic message "Could not send the link — try again in a moment", discarding the actual server error.
**Where:** `index.html:10100-10107`
**Why it matters:** If the Supabase project is paused (see keep-alive workflow), if the user's email is invalid, or if the user hits a rate limit, they see the same useless message and have no way to know what went wrong.
**Effort:** S
**Suggested fix:**
- Parse the Supabase error response body: `const j=await r.json().catch(()=>({})); throw new Error(j.msg||j.error_description||'Could not send the link');`
- Show the parsed message in `_agErr(...)` so the user can act on it (e.g. "Email rate limit exceeded — try in 60 seconds").

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. `index.html` is a 14,926-line monolith
**What:** The entire app — HTML, CSS (~800 lines), 12,000+ lines of JavaScript, and all templates — lives in one file.
**Where:** `index.html` (entire file)
**Why it matters:** A single file has no module boundaries, no tree-shaking, and makes it hard to review PRs, run targeted tests, or onboard contributors. Every diff touches hundreds of unrelated lines.
**Effort:** L
**Suggested fix:**
- Extract CSS into `styles.css` as a first step (no logic change, immediate diff reduction).
- Move each major feature area (sync, auth, AI, tasks, review wizard) into ES module files loaded with `<script type="module">`.
- Use Vite or a simple esbuild config to bundle back to a single deployable file with source maps.

---

### 10. `/api/claude.js` proxy has no rate limiting (acknowledged in its own comment)
**What:** The comment at `api/claude.js:12` explicitly flags "For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill." This has not been addressed.
**Where:** `api/claude.js:12-14`
**Why it matters:** One user (or a compromised session token) can call the proxy in an unbounded loop. There is no spending cap, no per-user quota, and no circuit breaker — a single bad actor can drain the Anthropic budget.
**Effort:** M
**Suggested fix:**
- Add Upstash Redis rate limiting: `@upstash/ratelimit` with a sliding window of e.g. 20 requests/user/hour.
- Use the Supabase `uid` (extracted from the already-verified JWT) as the rate limit key.
- Return HTTP 429 with a `Retry-After` header so the client can surface a friendly message.

---

### 11. Pervasive silent `catch(e){}` makes production debugging impossible
**What:** There are dozens of empty catch blocks throughout `index.html` (representative sample: lines 2587, 2949, 3031, 3868, etc.) that swallow all errors with no logging.
**Where:** `index.html` — at least 50+ occurrences of `catch(e){}` or `catch(_){}` with no body.
**Why it matters:** When a user reports "AI planning isn't working" or "my tasks didn't save", there is no error trail to follow. The silent catches hide crashes that could be surfaced via PostHog or `console.error`.
**Effort:** M
**Suggested fix:**
- Audit the silent catches: keep them only where failure is truly expected and benign (e.g. `localStorage.getItem` on a restricted browser).
- For all others, replace `catch(e){}` with `catch(e){ console.error('[context]',e); }` at minimum.
- Wire a `window.onerror` / `window.onunhandledrejection` handler that sends to PostHog as an error event.

---

### 12. `givelink.html` hardcodes "Panos Evangelou" and company context in AI prompts
**What:** The standup generator at `givelink.html:1566` and the email drafter at `givelink.html:1711` hardcode the founder's name and Givelink's product description in the prompt strings.
**Where:** `givelink.html:1566`, `1711`
**Why it matters:** Any team member or alternate account using the sprint board gets AI output that says "from Panos Evangelou". More importantly, these prompts can't adapt to different roles or products without a code edit.
**Effort:** S
**Suggested fix:**
- Pull `name` from `localStorage.getItem('taskos_name')` (already used elsewhere for the greeting) and inject it into the prompt.
- Move company/product context to a user-editable settings field so the AI can be personalized without a code change.

---

## 💡 P3 — Nice to have

### 13. Documented brand palette doesn't match implementation colors
**What:** The brand palette referenced in planning docs (`#6B3FA0/#5718CA` purple, `#C2185B/#E353B6` pink) does not match what's actually used in the app (`#5a49e0/#9268e6` violet, pink is not used). The actual app palette is internally consistent but the documentation mismatch causes confusion in design reviews.
**Where:** `index.html:45-60` (`:root` CSS vars), `landing.html:48`
**Why it matters:** New designers or contributors will use the wrong hex values, creating subtle inconsistencies over time.
**Effort:** S
**Suggested fix:**
- Update any brand reference docs / MARKETING.md to reflect the actual `--accent: #5a49e0` palette.
- Define the palette as named CSS variables (`--brand-primary`, `--brand-secondary`) at the top of both files so there's a single source of truth.

---

### 14. `landing.html` canonical URL still points to Vercel staging hostname
**What:** (See P0 item 3.) Once the production domain is confirmed, the landing page's Open Graph tags, Twitter card, and `<link rel="canonical">` should all be updated in one pass.
**Where:** `landing.html:11-22`, `sitemap.xml:4`
**Why it matters:** Social previews and SEO consolidation depend on a stable, real domain.
**Effort:** S
**Suggested fix:** Covered by P0 item 3 — included here as a reminder to also update OG/Twitter tags, not just the canonical.

---

### 15. `sbConnect()` leaves Supabase URL and anon key visible in the settings form after connecting
**What:** After `sbConnect()` succeeds at `index.html:10053`, the password field is cleared (`document.getElementById('set-sb-pass').value=''`) but the URL and anon key inputs are not cleared.
**Where:** `index.html:10053`
**Why it matters:** Low risk since these are already in `localStorage`, but a user who walks away from a shared device with Settings open exposes their Supabase credentials to anyone looking at the screen.
**Effort:** S
**Suggested fix:**
- After a successful connect, also clear or mask the `set-sb-anon` field.
- Consider showing only the last 6 characters of the key in the input after it's saved (like `••••••••VndetA`).
