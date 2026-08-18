# Givelink / Arete Improvement Plan
_Generated 2026-08-18_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Burndown chart renders "false" text in SVG
- **What**: String concatenation bug produces literal `"false"` inside the SVG when no snapshot points exist yet
- **Where**: `givelink.html:771`
- **Why it matters**: Every new sprint shows a corrupt SVG on the Overview page, visible to every user immediately after sprint creation
- **Effort**: S
- **Suggested fix**:
  - Change `(actualPts.length?'<circle.../>') +` to `(actualPts.length?'<circle.../>':'') +`
  - The `?` ternary without a falsy branch evaluates to `false` in string context

### 2. Standup "Yesterday" goes back 2 days, not 1
- **What**: `yesterday.setDate(now.getDate()-2)` subtracts 2 days, so the generated standup always says nothing was completed yesterday
- **Where**: `givelink.html:1488`
- **Why it matters**: The standup is a key daily feature; incorrect context makes the AI output wrong, eroding trust in the tool
- **Effort**: S
- **Suggested fix**:
  - Change `-2` to `-1` on line 1488
  - Optionally widen the window to the past 36h to catch late-evening completions

### 3. Service worker push-notification icon 404s on all devices
- **What**: `sw.js` references `./icons/icon-192.png` in push notification handler, but the actual file is at `./icon-192.png` (no `icons/` directory)
- **Where**: `sw.js:46-47` vs `sw.js:6` (`STATIC` array)
- **Why it matters**: Every push notification displays a broken/missing icon — on iOS this can silently fail to show the notification at all
- **Effort**: S
- **Suggested fix**:
  - Change `icon:'./icons/icon-192.png'` to `icon:'./icon-192.png'`
  - Also fix `badge` on the same line

### 4. Anthropic API key stored and entered via `prompt()` — security + mobile breakage
- **What**: `getApiKey()` stores the API key in plain `localStorage` and prompts via `window.prompt()`, which is blocked in Safari on iOS in standalone PWA mode
- **Where**: `givelink.html:1075-1088`, `givelink.html:1259-1261`
- **Why it matters**: (a) PWA users on iOS cannot use any AI feature; (b) the key is visible to any script with `localStorage` access (XSS exposure)
- **Effort**: M
- **Suggested fix**:
  - Replace `window.prompt()` with a proper modal input (reuse the existing `.mo` modal pattern)
  - The key can stay in `localStorage` short-term, but show it masked and allow deletion
  - Long-term: route all AI calls through `/api/claude` proxy so users never need their own key

### 5. `callClaudeGL` swallows API errors silently — no rate-limit or auth feedback
- **What**: When the Anthropic API returns 401/429/500, the function catches no status error — it returns `null` and the UI shows "Could not generate. Check your API key." for all failure types
- **Where**: `givelink.html:1264-1272`
- **Why it matters**: A rate-limited user thinks their key is wrong and re-enters it repeatedly, burning quota and creating frustration
- **Effort**: S
- **Suggested fix**:
  - Add `if(!res.ok) throw new Error(HTTP ${res.status}: $(await res.text()));` after the fetch
  - Surface the actual error code in the `toast()` call

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. PostHog analytics disabled on landing page — zero CTA tracking
- **What**: `var POSTHOG_KEY = '';` — the entire analytics block is a no-op; CTA clicks, scroll depth, and demo-seen events never fire
- **Where**: `landing.html:702`
- **Why it matters**: You can't see which CTA converts, how far visitors scroll, or whether the hero demo drives signups — blind on the page that drives all acquisition
- **Effort**: S
- **Suggested fix**:
  - Paste the same PostHog project key from `index.html`'s `APP_CONFIG.posthogKey` into `POSTHOG_KEY`
  - Verify events appear in PostHog dashboard within minutes of deploying

### 7. Landing page canonical URL points to dev/staging domain
- **What**: `<link rel="canonical" href="https://task-management-beige-eight.vercel.app/">` — Google indexes the Vercel preview URL, splitting PageRank from any custom domain
- **Where**: `landing.html:11`
- **Why it matters**: All SEO equity from the recent blog/GEO push and backlinks goes to the wrong origin; switching to a custom domain later will require a recovery period
- **Effort**: S
- **Suggested fix**:
  - Update the canonical, OG `og:url`, and Twitter card URL to the production domain
  - Also update `sitemap.xml` and the `robots.txt` `Sitemap:` directive to match

### 8. Backlog → Task OS sync loses priority on all transferred tasks
- **What**: `syncToTaskOS()` hard-codes `urgency:'low'` for every synced task regardless of the Givelink task's `priority` field
- **Where**: `givelink.html:1239`
- **Why it matters**: High-priority Givelink tasks (e.g., "Pay Gerald", "Wholesale supplier") land in Task OS as low-urgency, undermining the sync's value proposition
- **Effort**: S
- **Suggested fix**:
  - Map Givelink priorities: `high→'high'`, `medium→'medium'`, `low→'low'` for both `urgency` and `importance`
  - Also set `bucket:'today'` for `in-progress` tasks and `bucket:'inbox'` for `todo`

### 9. `NP` modal delete button rendered only in edit mode but still references wrong variable scope
- **What**: `_showNPModal` builds the modal HTML including the Delete button using `editNpId`, but the button innerHTML is built at modal-create time via template literal — if `editNpId` is null when the modal is first created and later set, the button may or may not appear depending on creation order
- **Where**: `givelink.html:1380`
- **Why it matters**: Users editing nonprofits may not see the Delete button, making deletion impossible without a workaround
- **Effort**: S
- **Suggested fix**:
  - Move the Delete button out of the inner HTML template; always include it but toggle `style.display` in `_showNPModal()` based on `editNpId`, same as the task modal's `del-btn`

### 10. `confirm()` / `prompt()` UI dialogs — inaccessible, iOS-blocked in PWA mode
- **What**: Three UI interactions use native browser dialogs: task delete (`confirm` at line 732), NP delete (`confirm` at line 1424), and activity logging (`prompt` at line 1433)
- **Where**: `givelink.html:732, 1424, 1433`
- **Why it matters**: All three are blocked in Safari standalone PWA mode (no dialog appears, action silently fails); keyboard-only and screen-reader users cannot use them
- **Effort**: M
- **Suggested fix**:
  - Replace `confirm()` delete dialogs with the existing modal pattern (small confirmation modal with Cancel/Delete buttons)
  - Replace `prompt()` in `logActivityNP` with an inline input in the NP modal itself

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Duplicate Anthropic API fetch — Sprint Planner bypasses proxy, uses expensive model
- **What**: `runAiSprintPlanner` (line 1131) makes a direct browser→Anthropic call using `claude-opus-4-5`, while `callClaudeGL` (line 1264) is a second nearly-identical fetch function — the `/api/claude` proxy is never used from `givelink.html`
- **Where**: `givelink.html:1097-1161` vs `givelink.html:1256-1272`; `api/claude.js`
- **Why it matters**: (a) Opus costs ~15× more than Haiku for sprint planning; (b) two code paths to maintain; (c) the proxy's rate-limiting notes are ignored
- **Effort**: M
- **Suggested fix**:
  - Consolidate all AI calls behind `callClaudeGL`, which already abstracts the fetch
  - Switch Sprint Planner to `claude-haiku-4-5-20251001` (or at most Sonnet) — the structured JSON output doesn't need Opus

### 12. `_text` property stored on live DOM node — fragile copy-to-clipboard
- **What**: Both the standup and outreach modals store generated text as `element._text` on the DOM node; if the element is re-rendered, the property is lost and `copyStandup()` falls back to `textContent` with unintended whitespace
- **Where**: `givelink.html:1519, 1621`
- **Why it matters**: Silent clipboard corruption — user pastes wrong or garbled text without knowing
- **Effort**: S
- **Suggested fix**:
  - Store generated text in module-level variables (`let _standupText = ''`, `let _outreachText = ''`) instead of on DOM nodes

### 13. `api/claude.js` proxy has no per-user rate limiting (noted in code, never shipped)
- **What**: The comment at line 13 says "add per-user rate limiting e.g. Upstash" — this has never been done. Any signed-in user can make unlimited API calls
- **Where**: `api/claude.js:13`
- **Why it matters**: A single user (or compromised session token) can generate unlimited Anthropic spend with no circuit breaker
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis with a sliding window: e.g., 20 requests / user / hour
  - Return 429 with `Retry-After` header when exceeded
  - Costs ~$0/month for hobby usage

### 14. `seedNonprofits()` re-seeds after user deletes all nonprofits
- **What**: `if((S.nonprofits||[]).length)return;` — if a user manually removes all 6 seeded nonprofits and revisits the CRM, the seed data reappears
- **Where**: `givelink.html:1281`
- **Why it matters**: Phantom data reappearing breaks trust in the tool for users who are actively managing real nonprofits
- **Effort**: S
- **Suggested fix**:
  - Add a separate `S.nonprofitsSeeded` flag (like `S.seeded` for tasks) and check that instead of the array length

### 15. `index.html` is ~15,000 lines in a single file
- **What**: The main Task OS app is a 14,924-line monolith with all CSS and JS inline — no build step, no modules
- **Where**: `index.html` (whole file)
- **Why it matters**: (a) No incremental loading; (b) a single typo in a 15k file can break the whole app; (c) cannot tree-shake, minify, or test individual components
- **Effort**: L
- **Suggested fix**:
  - Extract JS into a `<script src="app.js">` and CSS into `<link rel="stylesheet" href="app.css">` as a first step (no bundler needed)
  - Long-term: consider Vite + vanilla-JS modules with a thin HTML shell

---

## 💡 P3 — Nice to have

### 16. Landing page demo animation has no `prefers-reduced-motion` bypass for CTA
- **What**: The `reduce` check (`prefers-reduced-motion`) skips animation but renders both panels visible simultaneously; the `demo-cta` button style is inconsistent between states
- **Where**: `landing.html:671-672`
- **Why it matters**: Minor visual glitch for ~5-10% of users with reduced motion enabled
- **Effort**: S
- **Suggested fix**: In the reduced-motion branch, set `show-org` on the wrapper and hide the dump panel directly

### 17. Sprint board `theme-color` is blue, clashes with Givelink brand
- **What**: `<meta name="theme-color" content="#3b82f6">` on `givelink.html` sets the browser chrome to blue; the main app uses the brand purple
- **Where**: `givelink.html:6`
- **Why it matters**: Minor brand inconsistency on mobile PWA; the address bar color differs between the two apps
- **Effort**: S
- **Suggested fix**: Change to `#5718CA` or `#6B3FA0` to match brand palette

### 18. CRM "Log Activity" overwrites existing note rather than appending
- **What**: `logActivityNP` sets `np.lastActivityNote = note` replacing the previous note; `activityLog` array is updated correctly but `lastActivityNote` always shows only the most recent
- **Where**: `givelink.html:1435-1437`
- **Why it matters**: Previous interaction context is lost in the main card view; users can't see the note history without opening `activityLog`
- **Effort**: S
- **Suggested fix**: Show the last N log entries in the NP modal (already stored in `activityLog`) instead of just `lastActivityNote`

### 19. Outreach modal regenerates email only if `np.outreachDraft` is falsy — no "force refresh"
- **What**: If an outreach draft was previously generated and saved, opening the modal shows the old draft with no way to regenerate against an updated stage/note without clicking the "↺ Regenerate" button that isn't always visible at first
- **Where**: `givelink.html:1625-1630`
- **Why it matters**: After a pipeline stage advance (e.g., lead → meeting), the draft is stale but silently re-used
- **Effort**: S
- **Suggested fix**: Show a "Draft from [date]" label and automatically regenerate if the draft is >3 days old or the stage changed since `outreachDraftAt`

### 20. `sw.js` cache name `'arete-20260723'` is hardcoded — manual update required on every deploy
- **What**: The service worker cache key must be changed manually for users to get fresh assets; there's no CI hook or build step to bump it
- **Where**: `sw.js:1`
- **Why it matters**: If forgotten, users stay on stale cached HTML/JS after a deploy (the update banner requires the new SW to activate first, which requires the cache key to differ)
- **Effort**: S
- **Suggested fix**: Inject a build timestamp via a deploy script: `sed -i "s/arete-[0-9]*/arete-$(date +%Y%m%d)/g" sw.js` in the Vercel build command, or use the SW's own `updatefound` event reliably
