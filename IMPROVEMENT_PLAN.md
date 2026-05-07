# Givelink Improvement Plan

Generated: 2026-05-07 | Scope: givelink.html · index.html · sw.js · manifests

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Off-by-one date bug silences standup "yesterday" completions
- **What**: `yesterday.setDate(now.getDate()-2)` calculates *two* days ago, so any task completed yesterday is excluded from the standup and the section always reads "Nothing completed yet."
- **Where**: `givelink.html:1449`
- **Why it matters**: Every daily standup is factually wrong. Founder uses this daily — bad data erodes trust in the tool.
- **Effort**: S
- **Suggested fix**:
  - Change `now.getDate()-2` → `now.getDate()-1`
  - Add a comment explaining the 6 AM cutoff logic (`setHours(6,0,0,0)`) so the next reader doesn't re-break it

---

### 2. `S.discomfortLogs.push()` crash when array is missing from stored state
- **What**: `completeLadderWeek()` calls `S.discomfortLogs.push(...)` without a null-guard; if the user's saved state predates this field, the whole ladder feature crashes with `TypeError`.
- **Where**: `index.html:3216`
- **Why it matters**: Any user who installed the app before `discomfortLogs` was added to the schema gets a hard crash on the Discomfort Ladder — the feature silently breaks for them.
- **Effort**: S
- **Suggested fix**:
  - Change line 3216 to: `if(!S.discomfortLogs) S.discomfortLogs=[];` before the push (same pattern already used at line 2633)
  - Alternatively, add `discomfortLogs: S.discomfortLogs||[]` in the `load()` migration step

---

### 3. Service worker returns empty body for offline API calls — causes silent JSON crash
- **What**: When the device is offline, `sw.js:64` returns `new Response('', {status:503})` for all non-local requests. Both apps then call `res.json()` on the empty body, throwing `SyntaxError: Unexpected end of JSON input` — caught by the generic `catch` which just shows a toast with a cryptic message.
- **Where**: `sw.js:64`, consumed by `givelink.html:1107` and `index.html:2221`
- **Why it matters**: Offline users see a confusing "AI error: Unexpected end of JSON input" instead of "You're offline — connect to use AI features."
- **Effort**: S
- **Suggested fix**:
  - Return a valid JSON error body: `new Response(JSON.stringify({error:{message:'Offline'}}), {status:503, headers:{'Content-Type':'application/json'}})`
  - In `callClaude()` / `callClaudeGL()`, check `res.status === 503` before parsing and show a user-friendly "No internet connection" toast

---

### 4. No double-click guard on AI generation buttons — API quota flooding and state races
- **What**: All AI generation buttons in both apps re-enable only after the fetch completes; but the button is not `disabled` before the `await`, so a user can click multiple times and fire N concurrent API calls that all write to the same DOM target.
- **Where**: `givelink.html:1063–1065` (sprint planner btn), `index.html:3060,3471,4123,4249` (AI feature buttons)
- **Why it matters**: Multiple in-flight requests corrupt the displayed result (last-write wins), waste API tokens, and can exhaust the user's daily Claude quota in one accidental double-tap on mobile.
- **Effort**: S
- **Suggested fix**:
  - Set `btn.disabled = true` *before* the `await`, not just change the label text
  - Add a module-level `let _aiPending = false` guard in each AI function and early-return if already running

---

### 5. `window.prompt()` blocks UI thread for CRM activity logging
- **What**: `logActivityNP()` uses a native `window.prompt()` dialog to capture an activity note.
- **Where**: `givelink.html:1392`
- **Why it matters**: `window.prompt()` is blocked in standalone PWA mode on iOS Safari, silently doing nothing. Android Chrome shows it but it blocks all JS, including timers and network callbacks. The feature is completely broken on iOS when installed as a PWA.
- **Effort**: M
- **Suggested fix**:
  - Replace with an inline textarea that appears in the existing org edit modal (`#np-modal`), using the same pattern as the other modal form fields
  - Add a "Log Activity" section with a `<textarea id="np-quick-note">` and a "Save Note" button that calls the same save logic

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. Both apps use blue as their accent color — entire interactive UI is off-brand
- **What**: `--accent` is `#3b82f6` (Givelink) and `#58a6ff` (Task OS) — Tailwind/GitHub blues. Every button, badge, focus ring, sidebar highlight, and progress bar uses this color. Brand purple `#6B3FA0` / `#5718CA` appears nowhere in the primary UI.
- **Where**: `givelink.html:17` (`--accent:#3b82f6`), `index.html:17` (`--accent:#58a6ff`)
- **Why it matters**: A first-time visitor or investor sees a blue product, not a purple one. Brand coherence is zero. Changing one CSS variable fixes hundreds of elements.
- **Effort**: S
- **Suggested fix**:
  - `givelink.html:17`: change `--accent:#3b82f6` → `#6B3FA0`
  - `index.html:17`: change `--accent:#58a6ff` → `#6B3FA0`
  - Verify no hard-coded `#3b82f6` or `#58a6ff` references remain after the variable change (grep both files)

---

### 7. PWA `theme-color` is blue in four separate places
- **What**: The Android/iOS status bar and app switcher show Tailwind blue `#3b82f6` / `#58a6ff` because the meta tag and manifest both declare it.
- **Where**: `givelink.html:6` (`content="#3b82f6"`), `index.html:6` (`content="#58a6ff"`), `manifest-givelink.json:8` (`"theme_color":"#3b82f6"`), `manifest.json:9` (`"theme_color":"#58a6ff"`)
- **Why it matters**: The OS chrome (status bar, splash screen, recent-apps thumbnail) shows the wrong brand color. This is the first thing users see on install.
- **Effort**: S
- **Suggested fix**:
  - Update all four to `#5718CA` (deep brand purple)
  - Match `background_color` in manifests to `#070d1a` / `#0d1117` (already correct)

---

### 8. AI failure state shows raw red text with no retry or recovery path
- **What**: When a Claude API call fails (bad key, rate limit, network), both apps show either a red error string inline or a toast — no retry button, no link to settings to fix the API key, no indication of whether the problem is transient.
- **Where**: `givelink.html:1118–1119` (inline HTML injection), `index.html:2223` (toast only, returns null)
- **Why it matters**: Users give up on the AI features after one failure. The most common failure (wrong API key) is fixable in 10 seconds but the UI gives no hint.
- **Effort**: M
- **Suggested fix**:
  - For key/auth errors (HTTP 401), show: "API key invalid — [Open Settings]" with a button that opens the settings modal
  - For rate limit (HTTP 429), show: "Rate limited — try again in a moment" with a Retry button that re-fires the same prompt
  - Givelink line 1119: replace the raw `e.message` injection with a structured error card using the same pattern

---

### 9. Givelink CRM pillar color variables use non-brand palette
- **What**: The five CRM pillar colors (`--gr`, `--np`, `--pr`, `--ex`, `--op`) use green, blue, yellow, pink, and lavender — none of which match the brand palette. Growth is `#4ade80` (green), Networks/People is `#60a5fa` (blue), Execution is `#fbbf24` (yellow).
- **Where**: `givelink.html:18–19`
- **Why it matters**: The CRM sidebar and task badges are the most-used UI surfaces. They visually conflict with any brand material and make the product look generic.
- **Effort**: M
- **Suggested fix**:
  - Map pillars to brand-derived tints: use purple shades (`#5718CA`, `#6B3FA0`, `#8B5CF6`, `#A78BFA`) as a primary spectrum and one pink accent (`#E353B6`) for the fifth pillar
  - Keep hue variation for legibility but stay within the purple-pink family

---

### 10. AI Sprint Planner sends empty context when backlog is zero tasks
- **What**: `runAiSprintPlanner()` builds the prompt from `curTasks()`. When the backlog is empty (new user, or filtered sprint), the prompt says "Backlog: (none)" and Claude returns generic suggestions that can't be added meaningfully.
- **Where**: `givelink.html:1052–1089`
- **Why it matters**: New users who try AI Sprint Planning immediately get irrelevant output, creating a bad first impression of the AI features.
- **Effort**: S
- **Suggested fix**:
  - Before calling the AI, check `if(!backlog.length)` and show an inline message: "Add some backlog tasks first, then AI can suggest the best ones for your sprint."
  - Optionally pre-populate 3 example tasks when the board is empty (seeding pattern already exists in the codebase)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. Three separate Claude API call implementations with diverging logic
- **What**: There are three independent fetch-to-Claude wrappers: `runAiSprintPlanner()` (givelink.html:1092), `callClaudeGL()` (givelink.html:1225), and `callClaude()` (index.html:2213). They use different models, different error handling, and different header patterns — all doing the same thing.
- **Where**: `givelink.html:1092–1121`, `givelink.html:1225–1233`, `index.html:2213–2224`
- **Why it matters**: Each bugfix or model update must be applied three times. The SW offline fix (P0 #3) has to be applied three times.
- **Effort**: M
- **Suggested fix**:
  - Consolidate into one `callClaude(prompt, {model, maxTokens})` function in each file (or a shared inline utility)
  - Extract `MODEL_FAST` / `MODEL_CAPABLE` constants so model choice is explicit at call sites

---

### 12. `claude-opus-4-5` is a deprecated/older model — should upgrade
- **What**: The AI Sprint Planner in givelink.html hardcodes `model:'claude-opus-4-5'` which is an older model version. Current latest is `claude-opus-4-7`. The model may be deprecated without notice.
- **Where**: `givelink.html:1101`
- **Why it matters**: Deprecated models are eventually retired. When Anthropic removes this model ID, the Sprint Planner silently stops working with a confusing 404 from the API.
- **Effort**: S
- **Suggested fix**:
  - Upgrade to `claude-opus-4-7` (or `claude-sonnet-4-6` for cost/speed balance)
  - Define a `const MODEL = 'claude-sonnet-4-6'` constant at the top of the script block in each file, so future updates are one line

---

### 13. Magic time constants scattered across both files
- **What**: `86400000` (ms in a day), `7*86400000` (week), `30` (days in month), and similar values appear in at least 8 different places with no named constant or comment.
- **Where**: `index.html:2230` (`daysSinceDate`), `index.html:2880`, `givelink.html:1449` (implicit in date math), and several other locations
- **Why it matters**: A developer changing "7 days" to "14 days" for a feature has to grep for the magic number and may miss an instance, introducing a subtle bug.
- **Effort**: S
- **Suggested fix**:
  - Add at the top of the `<script>` block in each file: `const DAY_MS=86400000, WEEK_MS=7*DAY_MS;`
  - Replace inline occurrences with the named constants

---

### 14. Inline `onclick` in template literals blocks CSP improvement
- **What**: Both apps generate HTML strings with embedded event handlers like `` `onclick="openEdit('${t.id}')"` ``. This pattern requires `script-src 'unsafe-inline'` in the CSP (already set in `vercel.json:14`) and makes XSS via injected task titles possible if `esc()` is ever missed.
- **Where**: `givelink.html:662,1127`, `index.html:1256,2674,4340` (representative lines — pattern is pervasive)
- **Why it matters**: One missed `esc()` call on a user-supplied string (task title, note, org name) becomes a stored XSS. Inline handlers also can't be tested without a browser.
- **Effort**: L
- **Suggested fix**:
  - For new code: use `data-id` attributes and a single delegated `addEventListener('click', ...)` on the container
  - Short-term: audit every template literal for missing `esc()` calls around user data — that's the XSS risk; refactoring the pattern is a larger project

---

### 15. PWA manifest combines `"purpose": "any maskable"` — non-standard
- **What**: Both manifests declare a single icon entry with `"purpose": "any maskable"`. The Web App Manifest spec requires separate entries for `any` and `maskable` purposes; some browsers (Samsung Internet, older Chrome) ignore combined values.
- **Where**: `manifest.json:17`, `manifest-givelink.json:14`
- **Why it matters**: Maskable icons may not render correctly on Android (icon gets clipped or shown without safe-zone padding) on some devices.
- **Effort**: S
- **Suggested fix**:
  ```json
  "icons": [
    { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable" }
  ]
  ```

---

## 💡 P3 — Nice to have

### 16. Service worker cache name requires manual date-stamp bump on every deploy
- **What**: `const CACHE = 'task-os-20260419-190847'` is a hardcoded timestamp in `sw.js:1`. Forgetting to update it means users get stale HTML cached indefinitely.
- **Where**: `sw.js:1`
- **Why it matters**: Low risk now (Vercel's no-cache header forces revalidation), but if the cache strategy ever changes, stale cache bugs become very hard to debug.
- **Effort**: S
- **Suggested fix**:
  - Use a build-injected version (e.g., `const CACHE = 'task-os-__BUILD_HASH__'`) or derive it from `manifest.json`'s version field
  - Alternatively, document in a `DEPLOY.md` that sw.js line 1 must be updated on every deploy

---

### 17. Cross-app navigation assumes `givelink.html` exists with no fallback
- **What**: `window.location.href = 'givelink.html'` (and the reverse in givelink.html) navigates to a sibling file with no error handling. If a route ever changes or the file is renamed, the user lands on a raw 404.
- **Where**: `index.html:~3914`, `givelink.html:~1700` (app-switcher buttons)
- **Why it matters**: Low probability but high confusion — a 404 in a PWA with no navigation chrome leaves the user stranded with no back button (standalone mode).
- **Effort**: S
- **Suggested fix**:
  - Add `onerror="window.history.back()"` or wrap in a `try/catch` with a toast fallback
  - Consider using the `vercel.json` rewrite (`/givelink` → `/givelink.html`) as the canonical URL in the switcher

---

### 18. Daily standup prompt hardcodes the founder's name and company description
- **What**: The standup generation prompt (givelink.html:1453) hardcodes `"Generate a daily standup for Panos, founder of Givelink (B2B SaaS helping nonprofits manage Amazon wishlist donations + donor matching)."` This description is in production code.
- **Where**: `givelink.html:1453`
- **Why it matters**: If/when other people use this tool (team members, beta users), the standup is attributed to the wrong person. The company description also locks in a specific framing that may need updating.
- **Effort**: S
- **Suggested fix**:
  - Add `userName` and `companyDesc` fields to the Settings panel (already has a settings modal)
  - Fall back to the current hardcoded values if unset, so existing behavior is preserved

---

### 19. `vercel.json` CSP uses `unsafe-inline` for scripts — limits XSS protection
- **What**: The Content-Security-Policy allows `script-src 'self' 'unsafe-inline'`, which neutralizes XSS protection for inline scripts. Given that all app JS is inline (single-file architecture), this is currently unavoidable.
- **Where**: `vercel.json:14`
- **Why it matters**: If an XSS injection reaches a `innerHTML` assignment (possible given the inline-onclick pattern — see P2 #14), `unsafe-inline` means the injected script executes. Without it, the browser would block it.
- **Effort**: L
- **Suggested fix**:
  - Long-term: move JS to an external `app.js` file so `'self'` alone covers it and `unsafe-inline` can be removed
  - Short-term: add a `Strict-Transport-Security` header and ensure all `esc()` calls are audited (reduces blast radius)
