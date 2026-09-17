# Arete + Givelink — Improvement Plan

> Generated 2026-09-17. Max 20 items, ordered within each tier by ROI.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. OAuth error hash swallowed — expired magic links show blank auth gate

**What**: `_authBoot()` in `index.html` only handles `access_token=` in the URL hash; when Supabase returns `#error=access_denied` (expired link, denied Google consent, email not confirmed) the error is silently discarded and the user sees the auth gate with no explanation.

**Where**: `index.html:10364-10386` — `_authBoot()` function. Landing.html correctly passes `#error=` to the app (line 33-35), but the app's handler stops at `if(h.includes('access_token='))` with no else-if for errors.

**Why it matters**: A user who clicks an expired magic link lands on a blank sign-in screen with no feedback. They'll retry, hit the same wall, and churn. This affects every OAuth and magic-link user.

**Effort**: S

**Suggested fix**:
- Add `else if(h.includes('error='))` branch in `_authBoot()` to parse `p.get('error_description')` and call `_agErr(message)`.
- Clear the error hash from the URL with `history.replaceState()` so a page reload doesn't re-show it.
- Map known Supabase error codes to friendly copy ("Link expired — request a new one").

---

### 2. `sbConnect` auto-creates an account when the user types the wrong password

**What**: When sign-in via password fails (any reason, including a typo), `sbConnect` immediately falls through to a signup call using the same credentials.

**Where**: `index.html:10036-10051` — the inner `try/catch` around `_sbAuth('password', ...)` silently swallows the failure and calls `fetch(.../auth/v1/signup, ...)`.

**Why it matters**: A returning user who misremembers their password accidentally creates a second account. They see "confirm your email" and can't access their existing data. Support burden + confusion.

**Effort**: S

**Suggested fix**:
- Remove the auto-signup fallback from `sbConnect`. On sign-in failure, show the error directly.
- The signup path should only be taken when the user explicitly clicks "Sign up" (the hosted auth gate already separates login/signup modes correctly via `_agMode`).

---

### 3. Unescaped task titles in `innerHTML` — stored XSS

**What**: Task titles and notes are interpolated directly into `innerHTML` strings in more than a dozen places without calling `esc()`, while the `esc()` helper exists at line 11776.

**Where**: `index.html:3159,3223,3274,3594,3601,3716,3844,4421` (and others) — all render `${t.title}` in template literals assigned to `.innerHTML`. The delete toast at line 3844 is especially notable: `<strong>${t.title.slice(0,30)}</strong>` is passed to a `toast()` that also uses `innerHTML` (line 2789).

**Why it matters**: A task title like `<img src=x onerror="...">` executes in the browser. On a shared account (e.g., two team members both using the app) this is cross-user XSS. Even single-user, a malicious import/paste attack could inject scripts.

**Effort**: M

**Suggested fix**:
- Globally replace `${t.title}` and `${t.notes}` in HTML contexts with `${esc(t.title)}` / `${esc(t.notes)}`.
- Audit `toast()` call sites that pass user data; switch those callers to `textContent`-based construction or pre-escape before calling `toast()`.
- Consider making `toast()` accept a plain text message and use `textContent` instead of `innerHTML` by default; add a separate `toastHTML()` for the few places that legitimately need markup.

---

### 4. No rate limiting on `/api/claude.js` AI proxy

**What**: The Claude proxy accepts any valid Supabase session with no per-user request limit or cost cap. The comment at line 13 acknowledges this: "For production add per-user rate limiting."

**Where**: `api/claude.js:13,43-50`

**Why it matters**: One abusive or compromised account can saturate the Anthropic API quota, breaking AI features for all users and running up an unlimited bill. No observability means this goes undetected until invoice arrives.

**Effort**: M

**Suggested fix**:
- Add a simple sliding-window counter per `uid` in Vercel KV or Upstash Redis (e.g. 50 requests/hour/user).
- Return HTTP 429 with a `Retry-After` header when the limit is hit.
- Log the `uid` on every request so abusive patterns are visible in Vercel logs.

---

### 5. Personal seed data in public repository

**What**: `seed()` at `index.html:4532` contains the owner's personal tasks in Greek and English (knee x-ray, blood test, Etoro account, Vodafone phone) and private company tasks. These ship in the public source.

**Where**: `index.html:4538-4900`

**Why it matters**: The repo is public on GitHub. The owner's personal medical, financial, and business tasks are readable by anyone who views the source. Also confuses anyone forking the repo.

**Effort**: S

**Suggested fix**:
- Replace the personal seed data with generic illustrative tasks (or none at all).
- The `_welcomeSeed()` / `_seedStarter()` paths that run for new hosted users are already separate — `seed()` only runs in non-hosted mode (`!_hostedMode()`), so removing personal items from it has zero UX impact for real users.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. Expired session silently breaks AI features — no re-auth prompt

**What**: When the Supabase access token has expired and the refresh fails, `_sbToken()` throws but is caught with `.catch(()=>'')` in the AI call path. The request then proceeds with an empty bearer token.

**Where**: `index.html:5013` — `const tok=_sbEnabled()?await _sbToken().catch(()=>''):'';`

**Why it matters**: The AI proxy returns 401 but the user sees a generic "AI error" toast, not "your session expired — log in again." They lose trust in the AI feature without understanding why.

**Effort**: S

**Suggested fix**:
- Replace `.catch(()=>'')` with `.catch(err=>{toast('Session expired — please sign in again');throw err;})`.
- Optionally auto-redirect to the auth gate on a 401 response from the proxy.

---

### 7. Last-write-wins sync silently drops data on two-device conflict

**What**: `sbSyncNow()` compares `_updatedAt` timestamps and keeps the newer blob whole, discarding the other. Two edits made offline on phone vs desktop within the same sync window result in one being deleted permanently with no warning.

**Where**: `index.html:10412-10441` — `sbSyncNow()` function.

**Why it matters**: A user who edits tasks on their phone while offline, then syncs on desktop, may silently lose a full session of work. This is the #1 trust-destroying event for a productivity app.

**Effort**: L

**Suggested fix**:
- Short-term: before overwriting local data with the remote, show a toast "Updated from another device — X tasks may differ" and log the diff to a recoverable `_syncConflictLog` in localStorage.
- Medium-term: move to per-task `updatedAt` timestamps and merge at the task-array level rather than replacing the whole blob.
- Keep the current full-blob sync as fallback for non-task objects.

---

### 8. `givelink.html` sprint board has no mobile view

**What**: The sprint board has a fixed-width sidebar (`width:216px`) with no mobile bottom nav, no hamburger, and no responsive breakpoint that hides or collapses it on small screens.

**Where**: `givelink.html:22-36` — sidebar CSS. Unlike `index.html` which has a full mobile bottom nav (`@media(max-width:768px)` with `.mob-bar`), givelink.html has none.

**Why it matters**: The standup generator and sprint board are team tools often checked on phones in the morning. On a 375px screen the sidebar eats ~58% of the width.

**Effort**: M

**Suggested fix**:
- Add a `@media(max-width:768px)` block: hide the sidebar, show a fixed bottom tab bar with the 4–5 primary nav items (Board, Goals, This Week, Standup, Metrics).
- Mirror the pattern from `index.html:278-280` bottom nav.

---

### 9. Auth error messages are misleading on login failure

**What**: When a login attempt fails (wrong password), `_agErr` shows "Wrong email or password — or confirm your email first." But the ambiguous "or confirm your email first" causes users who have confirmed their email to panic and re-request a confirmation link unnecessarily.

**Where**: `index.html:10093`

**Why it matters**: Support friction. Users try magic link, confirm again, then give up. Better copy would cut confusion.

**Effort**: S

**Suggested fix**:
- On a 400/422 from Supabase, inspect the error code (`invalid_credentials` vs `email_not_confirmed`) and show distinct messages.
- "Wrong email or password" for `invalid_credentials`; "Check your inbox to confirm this email" for `email_not_confirmed`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. Supabase credentials hardcoded in `APP_CONFIG` — no env var support

**What**: The live production Supabase URL and anon key are hardcoded in `index.html:9957-9958`. There is no mechanism to configure different credentials for staging vs. production without editing the source.

**Where**: `index.html:9956-9962`

**Why it matters**: Hardcoding real credentials in source means no dev/staging environment isolation. Every code change requires manual credential substitution if branching. The credentials are also in the GitHub keep-alive workflow file.

**Effort**: M

**Suggested fix**:
- Use a build step (even a simple `sed` in a Makefile or Vercel build command) to inject `__SUPABASE_URL__` and `__SUPABASE_ANON__` placeholders from environment variables.
- Or move config to a generated `config.js` file excluded from git, with a `config.example.js` checked in.

---

### 11. `api/claude.js` hardcodes model ID and API version header

**What**: The model `'claude-haiku-4-5-20251001'` is a string literal (line 44) and the `anthropic-version: '2023-06-01'` header (line 46) points to an old API version.

**Where**: `api/claude.js:44,46`

**Why it matters**: Upgrading the model or API version requires a code change and redeploy. The `2023-06-01` version string will eventually be deprecated.

**Effort**: S

**Suggested fix**:
- Extract `MODEL` and `ANTHROPIC_API_VERSION` as named constants at the top of the file, or better, read them from `process.env` so they can be updated via Vercel env vars without a deploy.
- Update `anthropic-version` to the latest stable (`2023-06-01` → check Anthropic docs for the current pinned version).

---

### 12. Supabase keep-alive workflow has no alerting on failure

**What**: `.github/workflows/supabase-keepalive.yml` pings Supabase every 2 days but the `curl` command uses `-o /dev/null` and the workflow doesn't fail the run on a non-2xx response, so a paused project goes undetected.

**Where**: `.github/workflows/supabase-keepalive.yml:22-25`

**Why it matters**: If the project auto-pauses anyway (changed URL, network issue, free-tier policy change), the workflow silently reports success and auth breaks in production.

**Effort**: S

**Suggested fix**:
- Add `--fail` to the `curl` flags so the step fails on HTTP errors: `curl --fail -sS -o /dev/null ...`
- Add a `on.workflow_run` notification step (GitHub email on failure is on by default if the step fails).

---

### 13. `index.html` is a 15,000-line single file

**What**: The entire app — CSS (~1,500 lines), HTML views (~4,000 lines), and JavaScript (~9,000 lines) — is in one file with no module boundaries, build step, or separation of concerns.

**Where**: `index.html` (14,926 lines)

**Why it matters**: Any non-trivial change requires navigating a 15K-line file. No dead-code elimination, no tree-shaking, no isolated tests. Merge conflicts are wide and hard to review. Velocity degrades with every feature added.

**Effort**: L

**Suggested fix**:
- Not a rewrite — introduce a minimal Vite-based build: split into `src/views/*.js`, `src/style.css`, and an `index.html` template. A single `vite build` produces the same single-file output.
- Start by extracting the two largest view modules (AI lab ~800 lines, review wizard ~600 lines) to validate the approach before full extraction.

---

## 💡 P3 — Nice to have

### 14. `givelink.html` uses a blue color palette, not the Givelink brand purple

**What**: `givelink.html` defines `--accent:#3b82f6` (Tailwind blue-500) and `--pr:#f472b6` (pink-400) — neither matching the Givelink brand palette (purple `#6B3FA0`/`#5718CA`, pink `#C2185B`/`#E353B6`).

**Where**: `givelink.html:17-19`

**Why it matters**: The sprint board looks like a generic blue SaaS app, not a Givelink product. Misses brand reinforcement for an internal tool the team sees every day.

**Effort**: S

**Suggested fix**:
- Replace `--accent:#3b82f6` with `#6B3FA0` and update derived colors.
- Replace `--pr:#f472b6` with `#E353B6`.
- Verify no pink-on-purple combinations appear (e.g. pillar badges against a purple background).

---

### 15. Landing page canonical URL points to Vercel preview, not a custom domain

**What**: `landing.html` and `index.html` have OG/Twitter/schema URLs set to `https://task-management-beige-eight.vercel.app/` — a Vercel-generated preview URL that looks unprofessional in social shares.

**Where**: `landing.html:11,16-17` and `index.html:24-32`

**Why it matters**: Social preview cards show the ugly URL. SEO canonical signals go to a Vercel URL. If the project is ever moved to a custom domain, all inbound links break.

**Effort**: S

**Suggested fix**:
- Set a custom domain on Vercel and update all hardcoded URLs in one pass.
- Better: inject the base URL via a build variable so it's maintained in one place.

---

### 16. No `.env.example` file for contributors

**What**: The project has no `.env.example` documenting which environment variables are expected by `api/claude.js` (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`).

**Where**: Repo root (missing file). Variables documented only in inline comments in `api/claude.js:1-11`.

**Why it matters**: Anyone wanting to run or fork the project has no clear starting point for configuration.

**Effort**: S

**Suggested fix**:
- Add `.env.example` with the three variables from `api/claude.js` and the Supabase config variables, with placeholder values.

---

### 17. `toast()` uses `innerHTML` — implicit XSS risk for future callers

**What**: `toast()` at `index.html:2789` assigns the raw `msg` string to `el.innerHTML`, making it easy for future callers to accidentally pass unescaped user data and introduce XSS.

**Where**: `index.html:2789`

**Why it matters**: The current callers are mostly controlled strings, but the pattern creates a "security footgun" for anyone adding a new toast. Line 3844 already passes `t.title` in a `<strong>` tag here.

**Effort**: S

**Suggested fix**:
- Change `toast()` to use `el.textContent = msg` by default.
- Add a `toastRich(html)` variant for the few places (delete undo, XP awards) that legitimately need markup.
- Callers using trusted markup stay on `toastRich`; anything touching user data moves to `toast`.
