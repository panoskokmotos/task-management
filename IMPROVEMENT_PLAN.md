# Improvement Plan — Arete / Givelink
*Generated 2026-07-27 by automated codebase review.*

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP header blocks Google Fonts — Inter never loads in production
**What:** The `vercel.json` Content-Security-Policy sets `style-src 'self' 'unsafe-inline'` and `font-src 'self'`, which silently blocks both the `fonts.googleapis.com` stylesheet and `fonts.gstatic.com` font files that `index.html` loads. Every production user falls back to system fonts, breaking the Inter typography the whole design depends on.

**Where:** `vercel.json:15`, `index.html:14-16`

**Why it matters:** The app looks materially different in production than in dev/review, and the design investment in typography is completely wasted. CORS errors appear in the browser console for every user, which also triggers false positives for anyone monitoring for errors.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src` in the CSP.
- Add `https://fonts.gstatic.com` to `font-src`.
- OR self-host Inter (download from Google Fonts, serve from `/fonts/`) to keep the strict CSP.

---

### 2. Push notification icon path is wrong — notifications show no icon
**What:** `sw.js` references `./icons/icon-192.png` for both `icon` and `badge` in push notifications. The actual file lives at `./icon-192.png` (no `icons/` subdirectory). Every push notification is sent with a broken icon URL, so it renders without branding.

**Where:** `sw.js:47-48`

**Why it matters:** Push notifications are the retention hook for reminders. Unbranded notifications look like spam and get dismissed or disabled.

**Effort:** S

**Suggested fix:**
- Change `'./icons/icon-192.png'` → `'./icon-192.png'` on both lines in the `push` event handler.
- Add a STATIC list check to confirm the icon path is in the cached asset list.

---

### 3. Givelink CRM delete button never appears when "Add" is opened first
**What:** `_showNPModal()` creates the modal DOM lazily on first call and bakes `${editNpId ? '<button ...>Delete</button>' : ''}` into the template at creation time. If `openAddNP()` runs first (the common case for any new user), `editNpId` is `null` and the delete button is never inserted. All subsequent `openEditNP()` calls reuse the already-created modal with no delete button — organizations can never be deleted through the UI.

**Where:** `givelink.html:1358-1388`

**Why it matters:** Editing a CRM entry and finding no way to delete it is confusing. The only workaround is clearing localStorage.

**Effort:** S

**Suggested fix:**
- Always include the delete button in the modal HTML template.
- In `_showNPModal(np)`, show/hide it with `el.style.display = editNpId ? '' : 'none'`.
- Remove the conditional template literal so the DOM is always complete.

---

### 4. Givelink sprint seed dates expired — new users see "0 days left"
**What:** The seeded sprint (`S.sprint`) has `start:'2026-03-28', end:'2026-04-11'`. Today is 2026-07-27, which is 107 days past the end date. Every new user opens Givelink to see "0 days left," a 100%-elapsed time bar, and burndown data that is nonsensical. `daysLeft()` returns 0 and `sprintPct()` returns 100.

**Where:** `givelink.html:437-438`

**Why it matters:** First impressions are irreversible. A new user sees a broken, expired sprint and has no reason to trust the tool manages sprints correctly.

**Effort:** S

**Suggested fix:**
- Compute sprint dates dynamically in the seed: `start: new Date().toISOString().slice(0,10)`, `end` = 14 days later.
- Or gate the seed behind `if(!S.seeded)` and set dates relative to the call time (which the code already does — just update the static strings to dynamic expressions).

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. PostHog analytics key is empty — zero funnel visibility
**What:** `APP_CONFIG.posthogKey` in `index.html` is `''`, and the landing page script also has `var POSTHOG_KEY = '';`. The #83 commit explicitly added PostHog infrastructure "gated on a key you paste," but the key was never pasted. Every `track()` call is a silent no-op in production. You have no data on signup rates, CTA clicks, or which features get used.

**Where:** `index.html:9960`, `landing.html:703`

**Why it matters:** You can't improve what you can't measure. The landing → signup funnel is completely dark. Growth work without analytics is guesswork.

**Effort:** S (5 minutes of setup)

**Suggested fix:**
- Create a free PostHog project at posthog.com (the free tier is generous).
- Paste the `phc_...` key into `APP_CONFIG.posthogKey` in `index.html` and into `var POSTHOG_KEY` in `landing.html`.
- The same key for both files connects the landing→signup funnel automatically (already designed for this).

---

### 6. AI features unusable for new users — `aiProxy` is not configured
**What:** `APP_CONFIG.aiProxy` is `''` in `index.html`. All three AI features (inbox triage, day planner, command bar) fall through to "Add your Claude API key in Settings." The landing page promises "AI that clears your inbox and plans your day" as a free, zero-setup feature. The proxy serverless function (`/api/claude.js`) is already written and deployed on Vercel but is never called.

**Where:** `index.html:9959`, `api/claude.js`

**Why it matters:** AI is the primary differentiator called out on the landing page. A new user who opens the app, tries "Triage my inbox," and gets "Add API key in Settings" has a jarring experience that directly kills the conversion promise.

**Effort:** M

**Suggested fix:**
- Set `ANTHROPIC_API_KEY` as a Vercel environment variable in the project settings.
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars if you want to gate to signed-in users only (optional; see `api/claude.js` comment).
- Paste the deployed proxy URL (`https://[your-project].vercel.app/api/claude`) into `aiProxy` in `index.html`.
- Consider adding a per-user rate limit (e.g., Upstash Redis) before going wide — the file itself warns about this.

---

### 7. Givelink AI uses `window.prompt()` for API key — broken on mobile / iframes
**What:** `getApiKey()` and `callClaudeGL()` in `givelink.html` use `window.prompt('Enter your Anthropic API key:')` as the only way to configure the AI. `prompt()` is blocked in cross-origin iframes, many mobile browsers suppress it silently, and it's a jarring UX that looks like a phishing attempt.

**Where:** `givelink.html:1086`, `givelink.html:1261`

**Why it matters:** The AI Sprint Planner and AI Outreach Generator are the highest-value features in Givelink. They're currently unreachable on any mobile device or embedded context, and the desktop experience is embarrassing.

**Effort:** M

**Suggested fix:**
- Add an API Key field to the Sprint Settings modal (`sm`), saving to `localStorage('taskos_api_key')`.
- Replace both `prompt()` calls with a check for the stored key, falling back to `openSprintSettings()` with a toast: "Add your API key in Sprint Settings."
- Share the stored key with index.html by using the same `taskos_api_key` key (already done — just remove the fallback `prompt()`).

---

### 8. Sidebar nav items in Givelink are `<div>` — keyboard and screen reader inaccessible
**What:** All sidebar navigation in `givelink.html` uses `<div onclick="nav(...)">` elements. Divs are not focusable, not reachable by Tab, and not announced as interactive by screen readers. The keyboard shortcut `n` to add a task is the only keyboard affordance; there is no way to navigate sections without a mouse.

**Where:** `givelink.html:233-244`

**Why it matters:** Keyboard users and screen reader users can't use the product. Accessibility issues are also a legal risk for a tool used by nonprofits.

**Effort:** S

**Suggested fix:**
- Change all sidebar `<div class="ni" onclick="nav(...)">` elements to `<button class="ni" onclick="nav(...)">`.
- Add CSS `button.ni { background: none; border: none; width: 100%; text-align: left; }` to preserve appearance.
- Add `role="navigation"` to the `<nav class="sb">` element (already present as a `<nav>` tag — verify it has an `aria-label`).

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. Givelink `renderVelocityStats()` uses `innerHTML +=` — causes DOM re-parse
**What:** `renderVelocityStats()` appends extra stat cards with `el.innerHTML += '...'`. The `+=` operator serializes the entire existing DOM to HTML, concatenates new HTML, and re-parses the whole thing. Any event listeners attached to child elements of `ov-stats` are lost. It also fires twice per overview render.

**Where:** `givelink.html:1551`

**Why it matters:** Performance and correctness. As the stats section grows, this becomes increasingly expensive, and it's a latent bug if event listeners are ever added to those elements.

**Effort:** S

**Suggested fix:**
- Build the complete stats HTML in `renderOverview()` before setting `el.innerHTML`.
- Pass a `velocityStats` flag into the stats HTML builder, or merge `renderVelocityStats()` into `renderOverview()` directly.

---

### 10. Duplicate AI caller implementations (`callClaude` vs `callClaudeGL`) with diverging behavior
**What:** `index.html` defines `callClaude(prompt, maxTokens)` (lines ~5005–5035) which supports both proxy and direct API modes. `givelink.html` defines `callClaudeGL(prompt, maxTokens, model)` which only supports direct API with a different key lookup chain. Bug fixes in one are never reflected in the other.

**Where:** `index.html:5005-5035`, `givelink.html:1256-1272`

**Why it matters:** The key retrieval in `callClaudeGL` tries 3 different localStorage keys in a confusing order. When the proxy is eventually wired up for Givelink, this function will need a full rewrite. Tech debt compounds.

**Effort:** M

**Suggested fix:**
- Extract a shared `_callAnthropic(prompt, opts)` function into a shared script tag or standalone JS file.
- Both apps include it and call it with consistent key/proxy options.
- Short term: at least align the localStorage key used (`taskos_api_key` in both, consistently).

---

### 11. JSON.parse of `undefined` in AI response parsing
**What:** Three locations use the pattern `JSON.parse((raw.match(/pattern/)||[])[0])`. If the regex doesn't match, `[0]` is `undefined`, and `JSON.parse(undefined)` throws. The `try/catch` wrapping it catches the error, but the user sees a generic error message ("Could not interpret that command") with no useful context.

**Where:** `index.html:4344`, `index.html:5138`, `index.html:9242`

**Why it matters:** These are in the ⌘K command handler and AI day planner — high-value features. Silent failures feel like the AI "just doesn't work" to users.

**Effort:** S

**Suggested fix:**
- Guard the parse: `const m = raw.match(/\{[\s\S]*\}/); if(!m) { toast('AI returned an unexpected format'); return; } const act = JSON.parse(m[0]);`
- Consider logging the raw response in the catch block (at least in dev mode) to diagnose future format issues.

---

### 12. Service worker cache name must be manually bumped or users stay on stale builds
**What:** `sw.js` uses `const CACHE = 'arete-20260723'`. When assets change but the cache name doesn't, the SW serves stale files. The update banner only fires on SW `statechange`, which requires manually changing the cache name to trigger a new SW install.

**Where:** `sw.js:1`

**Why it matters:** Stale asset bugs are the hardest to debug because they're invisible to developers who never see the cached version. Users report "it's broken" for issues that are already fixed.

**Effort:** S

**Suggested fix:**
- Add a comment: `// BUMP THIS on every deploy that changes cached assets`.
- Better: inject the build timestamp at deploy time via a Vercel build hook that runs `sed -i "s/arete-[0-9]*/arete-$(date +%Y%m%d%H%M)/" sw.js`.
- Or switch to a content-hash-based strategy (each file cached individually with its hash).

---

## 💡 P3 — Nice to have

### 13. Landing hero demo uses generic tasks — missed positioning opportunity
**What:** The animated demo in `landing.html` shows "Finish the Q3 deck, Call the dentist tomorrow, Reply to Sam, Gym Friday, Book flights for the trip." These are too generic to demonstrate Arete's specific strengths (goals linkage, AI triage, Wheel of Life).

**Where:** `landing.html:666-668`

**Why it matters:** The demo is the highest-attention moment on the landing page. Generic tasks make Arete feel like any other to-do app.

**Effort:** S

**Suggested fix:**
- Replace with tasks that showcase Arete's differentiators: "Grow my wealth: review portfolio," "Health: Gym at 7am," "Reply to the investor intro from Sarah" — so the organized output shows goal grouping by category.
- Add a third panel after "Here's your day" that shows the goal linkage view.

---

### 14. `index.html` missing `<link rel="canonical">`
**What:** `landing.html` correctly sets `<link rel="canonical" href="https://task-management-beige-eight.vercel.app/">` but `index.html` has no canonical tag. Search engines may index the app URL and create duplicate content issues.

**Where:** `index.html` (missing, should be near line 12)

**Why it matters:** Minor SEO impact. Low effort to fix.

**Effort:** S

**Suggested fix:**
- Add `<link rel="canonical" href="https://task-management-beige-eight.vercel.app/index.html">` to `index.html` head.

---

### 15. `copyStandup()` uses deprecated `document.execCommand('copy')` as fallback
**What:** When `navigator.clipboard.writeText()` fails, both `copyStandup()` and the outreach copy handler fall back to `document.execCommand('copy')`, which is deprecated and removed in some browsers.

**Where:** `givelink.html:1521`, `givelink.html:1621`

**Why it matters:** The copy fallback silently fails in modern browsers that have removed `execCommand`. The toast "📋 Copied!" fires even when nothing was copied.

**Effort:** S

**Suggested fix:**
- Remove the `execCommand` fallback.
- If clipboard API fails, show a textarea with the text pre-selected so the user can manually copy.
- Or use the clipboard API with `{ type: 'text/plain', data: text }` Blob approach as a secondary fallback.

---

*Total items: 15 (4 P0, 4 P1, 4 P2, 3 P3). Ordered within each tier by estimated ROI.*
