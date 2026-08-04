# Improvement Plan — Arete (Task OS)
*Generated 2026-08-04 by automated codebase review*

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CSP blocks Google Fonts — Inter doesn't load for any user
**What:** `vercel.json` sets `font-src 'self'` and `style-src 'self' 'unsafe-inline'`, which blocks both the Google Fonts stylesheet (`fonts.googleapis.com`) and the font files (`fonts.gstatic.com`). Inter never loads; every user falls back to system fonts.

**Where:** `vercel.json:15`

**Why it matters:** The entire design system is built on Inter. Every user sees a visually degraded app — wrong weight, wrong spacing, wrong feel — from their very first session.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src` in the CSP header
- Add `https://fonts.gstatic.com` to `font-src`
- Or move to a self-hosted Inter subset (eliminates the external dependency entirely)

---

### 2. `taskReply()` ignores `APP_CONFIG.aiProxy` — core "Reply to act" feature is broken for hosted users
**What:** `taskReply()` at `index.html:9206` checks only `S.claudeKey` and falls back to a simple pattern-matcher (`_taskReplyLocal`) when no personal key is set — even when `APP_CONFIG.aiProxy` is configured. Users who sign up through the hosted flow never get AI replies; they get "Add your Claude API key in Settings."

**Where:** `index.html:9206`

```js
// Current (broken for hosted users):
if(!S.claudeKey){return _taskReplyLocal(id,text);}

// Fix:
if(!S.claudeKey && !APP_CONFIG.aiProxy){return _taskReplyLocal(id,text);}
```

**Why it matters:** "Reply to a task to do it" is the primary differentiator shown in every marketing asset. Hosted users land, see this promised, try it, and hit a dead end. This is the highest-friction moment in the conversion funnel.

**Effort:** S

**Suggested fix:**
- Change the guard at `index.html:9206` to check both `S.claudeKey` and `APP_CONFIG.aiProxy`
- Apply the same fix to `aiCategorizePaste()` at `index.html:12553` (same bug, same line pattern)
- Also fix `_fetchAIBriefing()` at `index.html:11670` which checks a stale `taskos_api_key` localStorage key instead of `APP_CONFIG.aiProxy`

---

### 3. Service worker push icon points to non-existent path
**What:** `sw.js:47-48` references `'./icons/icon-192.png'` as the push notification icon and badge. No `icons/` directory exists — the file is at the root as `icon-192.png`. Push notifications silently show no icon or fail to render on some platforms.

**Where:** `sw.js:47-48`

**Why it matters:** Every push reminder shows a blank icon, breaking the branded experience for users who've opted into notifications.

**Effort:** S

**Suggested fix:**
- Change `'./icons/icon-192.png'` → `'./icon-192.png'` in both `icon` and `badge` fields of `showNotification()`

---

### 4. XSS: `t.title` interpolated into `innerHTML` without `esc()` in weekly review panels
**What:** Three locations render task/goal titles directly into `innerHTML` via template literals without calling `esc()`:
- `index.html:3594` — Weekly Review "Completed this week" panel: `${t.title}`
- `index.html:3601` — Weekly Review "Backlog" panel: `${t.title}`
- `index.html:2543` — Blocked-by `<select>`: `t.title.slice(0,45)` (no escaping)

The `esc()` helper exists at `index.html:11776` and is used correctly elsewhere; these panels were missed.

**Where:** `index.html:2543`, `3594`, `3601`

**Why it matters:** Template import (`importData`) and Supabase sync are live attack surfaces. A task title like `<img src=x onerror=alert(document.cookie)>` in an imported file executes immediately when the review or backlog panel renders.

**Effort:** S

**Suggested fix:**
- Wrap every `${t.title}` and `${g.title}` in these panels with `${esc(t.title)}`
- Audit any other `innerHTML` template literal in `renderWizPanel()` that interpolates user-owned strings

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. `APP_CONFIG.aiProxy` is empty — all AI features require a personal API key
**What:** `index.html:9959` has `aiProxy: ''`. Even though Supabase is configured for multi-user hosted mode, the AI proxy URL is never set. Every AI button in the app silently degrades to "Add your Claude API key in Settings."

**Where:** `index.html:9959`, `api/claude.js`

**Why it matters:** The app is marketed as AI-powered. New hosted users land, skip the personal-key friction (reasonable), and then discover none of the AI works. Conversion-killer.

**Effort:** M

**Suggested fix:**
- Deploy `api/claude.js` to Vercel as a serverless function (it already exists, just needs the env var)
- Set `aiProxy: 'https://<your-app>.vercel.app/api/claude'` in `APP_CONFIG`
- Add per-user rate limiting via Upstash (noted in `api/claude.js:14`) to protect against bill-drain

---

### 6. OG / canonical meta URLs are the raw Vercel dev domain
**What:** `index.html:24-32` and `landing.html:11,16` hardcode `https://task-management-beige-eight.vercel.app/` in `og:url`, `og:image`, `og:site_name`, canonical, and structured data. Every social share preview and every Google result shows the random Vercel URL, not a brand domain.

**Where:** `index.html:24-32`, `landing.html:11,16,25`

**Why it matters:** Hurts SEO authority (canonical domain mismatch) and destroys trust in social shares — clicking a link to `task-management-beige-eight.vercel.app` when the brand says "Arete" is jarring.

**Effort:** S

**Suggested fix:**
- Set a custom domain (`arete.app` or similar) in Vercel project settings
- Replace all hardcoded `task-management-beige-eight.vercel.app` occurrences with the real domain
- Update `sitemap.xml` to match

---

### 7. PostHog analytics is not configured — the funnel is completely dark
**What:** `APP_CONFIG.posthogKey: ''` at `index.html:9960` and `POSTHOG_KEY = ''` at `landing.html:702`. The PostHog integration is fully wired — events are firing, the landing scroll-depth and CTA-click tracking is set up — but no data is collected.

**Where:** `index.html:9960`, `landing.html:702`

**Why it matters:** There is no visibility into where users drop off, which CTAs convert, or whether any growth changes are working. Growth iteration is flying blind.

**Effort:** S

**Suggested fix:**
- Create a PostHog project (free tier covers the volume)
- Paste the key into `APP_CONFIG.posthogKey` and `landing.html`'s `POSTHOG_KEY`
- The landing → signup → activation funnel will connect automatically (same key, same origin)

---

### 8. No rate limiting on the AI proxy — one token can drain the Anthropic bill
**What:** `api/claude.js` passes all authenticated requests to Anthropic with no per-user budget enforcement. The file itself notes this at line 14: `"for production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."`

**Where:** `api/claude.js:14-48`

**Why it matters:** A compromised Supabase token (or a malicious user who creates a valid account) can make unlimited API calls. At Haiku pricing this is cheap but unlimited; at higher volumes or with a model upgrade, this becomes a real financial risk.

**Effort:** M

**Suggested fix:**
- Add an Upstash Redis rate limiter: `ratelimit.limit(userId)` before the Anthropic fetch
- Reasonable limit: 100 AI calls/user/day
- Return `429 Too Many Requests` when exceeded (the client already handles this gracefully at `index.html:5028`)

---

### 9. Sync uses last-write-wins — multi-device edits silently lose data
**What:** `sbSyncNow()` at `index.html:10418` compares `_updatedAt` timestamps and replaces the entire local state with cloud state if cloud is newer. If a user has the app open on both a phone and a desktop and makes different changes, whichever closed last wins and the other side's changes vanish without any warning.

**Where:** `index.html:10418-10428`

**Why it matters:** Users with two devices (mobile + desktop is the common case the marketing targets) will silently lose tasks they've just created. This erodes trust and is nearly impossible to diagnose.

**Effort:** L

**Suggested fix:**
- For a quick win: detect the conflict and show a toast "Your data on another device is newer — merged." before overwriting
- For a real fix: move to array-level merging: tasks are identified by `id`, so new tasks from both sides can be unioned; for field-level edits on the same task, last-write-wins per field (track `updatedAt` per task)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. Off-brand colors in two feature areas
**What:** Two components use hot pink outside the Arete violet palette:
- `index.html:12193` — Bucket list "Creative" category: `color: '#ec4899'`
- `index.html:13211` — Life wheel chart "health" area: `color: '#f472b6'`

**Where:** `index.html:12193`, `index.html:13211`

**Why it matters:** Pink-on-purple is a contrast failure and also a brand inconsistency after the recent color audit. These are visible UI elements.

**Effort:** S

**Suggested fix:**
- Replace `#ec4899` with `var(--cb)` (`#f79ac0` in dark mode, softer) or use `#9878ea` (brand violet)
- Replace `#f472b6` with a brand-adjacent warm: `#fbbf24` (gold) fits "health" better semantically
- Update the same pattern for the Givelink sprint board (`givelink.html` `--pr` variable which is `#f472b6`)

---

### 11. `_fetchAIBriefing()` reads a stale localStorage key
**What:** `index.html:11670` guards on `S.claudeKey || localStorage.getItem('taskos_api_key')`. The `taskos_api_key` key is not set anywhere else in the codebase — it's a relic from an earlier schema. The function silently does nothing for all users who migrated.

**Where:** `index.html:11670`

**Why it matters:** The daily AI briefing feature (homepage context panel) silently never runs for any user on the current schema.

**Effort:** S

**Suggested fix:**
- Change to `if(!S.claudeKey && !APP_CONFIG.aiProxy) return;` to match the rest of the AI guard pattern

---

### 12. `aiCategorizePaste()` at line 12553 checks only `S.claudeKey`
**What:** Same class of bug as P0 item 2 — the paste-categorization AI feature hardcodes a `S.claudeKey` check and never uses the proxy path.

**Where:** `index.html:12553`

**Why it matters:** Paste categorization is a key power-user feature (turn a block of text into categorized tasks). Hosted users who don't have their own key hit a dead end.

**Effort:** S

**Suggested fix:**
- Replace `if(!S.claudeKey)return toast(...)` with `if(!S.claudeKey && !APP_CONFIG.aiProxy)return toast(...)`
- Then route through `callClaude()` which already handles both paths correctly

---

### 13. `index.html` is 14,924 lines — a single 1MB monolith
**What:** The entire app lives in one HTML file with no module system. JavaScript, CSS, and HTML are minified-by-hand together. This makes testing, profiling, and onboarding to the codebase extremely slow. Google PageSpeed will flag the parse time.

**Where:** `index.html` (entire file)

**Why it matters:** Every new feature has to be bolted onto a file that's already at the edge of cognitive load. Minor fixes require full-file reads. No tree-shaking means every user downloads all 14K lines even for views they never visit.

**Effort:** L

**Suggested fix:**
- Start with a build step (Vite is zero-config for vanilla JS) that bundles and tree-shakes
- Split view-specific render functions into separate `.js` modules loaded lazily
- Move CSS into a separate sheet so the browser can parallelize CSS + HTML parsing

---

## 💡 P3 — Nice to have

### 14. Service worker cache name needs a deploy-time bump
**What:** `sw.js:1` has `const CACHE = 'arete-20260723'` hardcoded. Deploying a new version without updating this string leaves users on stale cached HTML.

**Where:** `sw.js:1`

**Why it matters:** Without a cache bust, users on mobile (where service workers are sticky) can see old UI for days after a deploy.

**Effort:** S

**Suggested fix:**
- Inject the cache name from a build step using the current date or a content hash
- Or add a deploy checklist item to bump `CACHE` before each deploy

---

### 15. `authMagic()` error copy uses a Unicode curly apostrophe in source
**What:** `index.html:10099`: `'Enter your email first, then I’ll send the link'` — a right single quotation mark (U+2019) is embedded in a JS string literal. It works because it's not the string delimiter, but some minifiers or transpilers may mangle it.

**Where:** `index.html:10099`

**Why it matters:** Low risk today, but could silently break copy in a build pipeline. Also inconsistent with the rest of the codebase which uses straight ASCII apostrophes.

**Effort:** S

**Suggested fix:**
- Change to `'Enter your email first — I\'ll send the link'` using an escaped ASCII apostrophe, or rephrase: `'Enter your email first, then tap Send Link'`
