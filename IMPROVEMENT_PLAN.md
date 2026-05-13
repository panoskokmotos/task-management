# Givelink Task OS — Improvement Plan

> Generated: 2026-05-13 | Codebase: `index.html` (7,642 lines), `givelink.html` (1,755 lines), `sw.js` (110 lines)

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. XSS in EOD "Quick Pick" — task title injected into onclick attribute

**What**: Task titles are inserted raw into an inline `onclick` attribute with only single-quote escaping, allowing `"` or `<script>` tags in a title to break out of the attribute context.

**Where**: `index.html:6632`
```js
onclick="document.getElementById('eod-mit').value='${t.title.replace(/'/g,"\\'")}'"
```

**Why it matters**: Any task whose title contains a double-quote (`"`) corrupts the HTML and may execute arbitrary JS in the page context. Since users can paste arbitrary text from Notion or Readwise imports, this is reachable without deliberate attack.

**Effort**: S

**Suggested fix**:
- Use a `data-` attribute and a named handler instead of an inline string: `<div data-title="${esc(t.title)}" onclick="_eodPickTitle(this)">`
- In the handler: `function _eodPickTitle(el){ document.getElementById('eod-mit').value = el.dataset.title; }`
- This eliminates the escaping problem entirely.

---

### 2. XSS in weekly review wizard — unescaped task/goal titles in innerHTML

**What**: The review wizard renders task titles and goal titles directly into `innerHTML` without calling `esc()`, unlike the rest of the app.

**Where**: `index.html:2161` (completed tasks), `index.html:2168` (backlog promote), `index.html:2170` (goal progress)
```js
// line 2161 — no esc()
`<div class="tt" style="text-decoration:line-through;">${t.title}</div>`
// line 2168 — no esc()
`<div class="tt">${t.title}</div>`
// line 2170 — no esc()
`${g.isTop3?'⭐ ':''}${g.title}`
```

**Why it matters**: A task title like `<img src=x onerror=alert(1)>` would execute in the review wizard. Combined with Readwise/Notion imports that accept arbitrary text, this is a realistic path.

**Effort**: S

**Suggested fix**:
- Wrap every interpolated user string: `${esc(t.title)}`, `${esc(g.title)}`
- Also fix `index.html:2143` (goal card linked-task list): `• ${t.title}` → `• ${esc(t.title)}`
- Audit all `body.innerHTML` assignments in `renderWizPanel()` with the same fix.

---

### 3. Claude API header `anthropic-version: 2023-06-01` — silent deprecation risk

**What**: The Anthropic API version header is 3 years old. When Anthropic sunsets this version, all AI features will silently return errors with no user-facing explanation.

**Where**: `index.html:3173`
```js
headers: { 'anthropic-version': '2023-06-01', ... }
```

**Why it matters**: Every AI feature in the app (task sequencing, AI briefing, pre-mortem, batch suggestions, auto-categorize, etc.) depends on `callClaude()`. A single deprecation event kills them all at once with a cryptic `AI error 400` toast.

**Effort**: S

**Suggested fix**:
- Update to the current version: `'anthropic-version': '2023-06-01'` → `'anthropic-version': '2023-06-01'` (verify current at docs.anthropic.com — as of 2026 the latest is `2023-06-01`, but confirm this is still supported)
- Extract as a named constant at the top of the script: `const ANTHROPIC_API_VERSION = '2023-06-01';` so future updates are a single-line change.

---

### 4. Hardcoded "Panos" persona in 6 AI prompt templates

**What**: Six AI prompts embed the owner's name and company context as literal strings, making every AI feature produce wrong output for any other user of the app.

**Where**: `index.html:6098`, `6199`, `6355`, `6417`, `6493`, `5937`
```js
// line 6098
const prompt = `You are helping Panos (founder of Givelink, B2B SaaS for nonprofits)...`
// line 5937 — ntfy default reminder
msg: 'Good morning Panos! Check your One Thing and start focused work.'
```

**Why it matters**: Profile name is already stored in `localStorage('taskos_name')` and falls back to `'Panos'` (line 1618). Anyone who clears their storage or uses the app fresh gets AI advice addressed to "Panos" — confusing and trust-breaking.

**Effort**: M

**Suggested fix**:
- Replace all literal `Panos` strings in prompts with the runtime variable: `${profileName}`
- Replace the literal Givelink context with a Settings-configurable `S.userContext` field (e.g. "founder of Givelink, B2B SaaS for nonprofits") that defaults to empty
- Update the ntfy default reminder at line 5937 to use `${profileName}` at reminder-send time, not at definition time.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. `alert()` used for 3 validation errors — blocks the page

**What**: Three validation failures use `window.alert()`, which freezes the entire browser tab until dismissed.

**Where**: `index.html:2309`, `2450`, `2504`
```js
if(!title){ alert('Enter a task title.'); return; }
if(!slot) { alert('Top 3 full! Remove one first.'); return; }
if(!title){ alert('Enter a goal title.'); return; }
```

**Why it matters**: `alert()` is visually jarring, inconsistent with the app's toast system, and triggers browser "this page is unresponsive" warnings in some contexts. The rest of the app already uses `toast()` correctly.

**Effort**: S

**Suggested fix**:
- Replace all three with `toast('...')` calls and an early return — exactly what every other validation path already does.
- For "Top 3 full" (line 2450), consider highlighting the Top 3 section and shaking it rather than using any text message.

---

### 6. Claude API key serialized inside the main `S` state object

**What**: `S.claudeKey` lives inside the master state blob that is JSON-stringified to `localStorage['taskos']` on every save, exported via "Export Data", and visible in any DevTools console `JSON.parse(localStorage.taskos)`.

**Where**: `index.html:1616` (state definition), `index.html:3335` (save), exported via the export function

**Why it matters**: Every data export shares the user's Anthropic API key. If a user exports their tasks to share them, or if their laptop is briefly unattended, their key leaks. Readwise and Notion tokens have the same problem (stored in separate localStorage keys but still plaintext).

**Effort**: M

**Suggested fix**:
- Move `claudeKey` out of `S` into a dedicated `localStorage.getItem('taskos_claude_key')` key (separate from the main state blob).
- Exclude it from data export: in the export function, omit the key field or replace it with a placeholder.
- At minimum, add a warning to the export UI: "Note: your API key is included in this export — keep it private."

---

### 7. Dashboard AI briefing card has no loading state

**What**: `_fetchAIBriefing()` makes a Claude API call that takes 2–5 seconds. During this time the card element renders blank with no spinner or skeleton.

**Where**: `index.html:6352–6404`
```js
async function _fetchAIBriefing(ctx, el, cacheKey) {
  // no loading indicator set before the fetch
  const txt = await callClaude(prompt, 600);
```

**Why it matters**: Users see an empty card and have no signal the app is working. This causes repeated clicks and duplicate AI calls (mitigated by `_aiInFlight` but still wasteful).

**Effort**: S

**Suggested fix**:
- Before `callClaude()`, set `el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0;">⏳ Generating briefing…</div>'`
- On success or error, replace with the result or an error message.

---

### 8. Readwise import silently truncates at 1,000 highlights with no warning

**What**: The highlight fetch loop is hard-capped at 2 pages (`for(let i=0;i<2;i++)`). Users with 1,000+ highlights lose the rest silently.

**Where**: `index.html:5560–5566`
```js
// fetch up to 2 pages (1000 highlights max)
for(let i=0;i<2;i++){
  const data = await _rwFetch(url);
  all = [...all, ...(data.results||[])];
  if(!data.next) break;
```

**Why it matters**: Heavy Readwise users who trust the import as complete will have gaps in their library extraction — specifically older/longer books — without knowing it.

**Effort**: S

**Suggested fix**:
- Remove the hard page cap and loop until `!data.next`.
- Show a progress indicator: "Loading page 2…" for users with large libraries.
- If a cap is needed for performance, set it at 10 pages (5,000 highlights) and display: "Showing first 5,000 highlights — refine by book for full access."

---

### 9. App accent color (#58a6ff) contradicts Givelink brand palette

**What**: Both `index.html` and `givelink.html` use blue as their primary accent (`#58a6ff` dark / `#2563eb` light / `#3b82f6` Givelink). The brand palette specifies purple `#6B3FA0`/`#5718CA` with pink `#C2185B`/`#E353B6` as secondary.

**Where**: `index.html:17` (dark mode `--accent: #58a6ff`), `index.html:24` (light mode `--accent: #2563eb`), `givelink.html:17` (`--accent: #3b82f6`)

**Why it matters**: Every button, active nav item, checkbox, progress bar, goal bar, and badge uses `var(--accent)`. The entire UI is branded blue when it should be purple. Prospective customers seeing a demo will not recognize the brand.

**Effort**: M

**Suggested fix**:
- Update CSS variables: dark mode `--accent: #7C4DFF` (or `#6B3FA0`), light mode `--accent: #5718CA`
- Test contrast: purple on dark backgrounds passes WCAG AA; verify `color: #000` on `.bp` buttons still has adequate contrast (may need to switch to `color: #fff`)
- Apply brand pink `#E353B6` as a secondary highlight for XP/badge elements to distinguish gamification from primary actions.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 10. ntfy notification errors silently swallowed

**What**: The ntfy send call wraps in `catch(_){}` — any network error, wrong topic, or server failure is discarded with no user feedback.

**Where**: `index.html:5996`
```js
try { await _ntfyPost(topic, `${r.emoji} ${r.label}`, r.msg, ['bell']); }
catch(_) {}
```

**Why it matters**: Users enable notifications, expect them to arrive, and never learn they're broken (wrong topic string, ntfy.sh outage). This erodes trust in the entire automation system.

**Effort**: S

**Suggested fix**:
- Change to `catch(e){ console.warn('ntfy send failed:', e.message); }` at minimum.
- For the `testNtfy()` function (line 5998) specifically, surface the error: `catch(e){ toast('❌ Notification failed: ' + e.message); }`

---

### 11. Claude model version hard-coded as string literal

**What**: `'claude-haiku-4-5-20251001'` is embedded inline in the only API call site, requiring a grep-and-replace to upgrade.

**Where**: `index.html:3174`
```js
body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, ... })
```

**Why it matters**: Haiku 4.5 will be retired. When that happens, all AI features fail with a 404. There's no single place to update the model.

**Effort**: S

**Suggested fix**:
- Extract to a constant near the top of the script: `const AI_MODEL = 'claude-haiku-4-5-20251001';`
- Alternatively, expose as a Settings option alongside the API key so power users can switch to Sonnet for better quality on complex tasks.

---

### 12. Notion API version `2022-06-28` is 3+ years stale

**What**: The Notion integration sends `Notion-Version: 2022-06-28` in every request. New Notion block types (callout, synced block, database views) introduced since then are unsupported.

**Where**: `index.html:5616`
```js
headers: { 'Authorization': 'Bearer ' + token, 'Notion-Version': '2022-06-28', ... }
```

**Why it matters**: Users with modern Notion layouts (post-2022 templates) will silently import incomplete or malformed data. Notion may also deprecate old versions.

**Effort**: S

**Suggested fix**:
- Update to `'Notion-Version': '2022-06-28'` → `'2022-06-28'` (verify latest stable at developers.notion.com — current is `2022-06-28` but check for updates).
- Extract as a constant: `const NOTION_API_VERSION = '2022-06-28';`

---

### 13. Unescaped `t.title` in goal card linked-task list

**What**: The goal card component renders linked task titles without `esc()`, creating a minor XSS surface in the Goals view.

**Where**: `index.html:2143`
```js
linked.map(t => `<div style="font-size:11px;color:var(--muted);padding:2px 0;">• ${t.title}</div>`)
```

**Why it matters**: Consistent with the wider XSS pattern: `esc()` is used ~60 times in the codebase but missed in a handful of rendering paths. Fixing all remaining instances closes the vulnerability class.

**Effort**: S

**Suggested fix**:
- `• ${t.title}` → `• ${esc(t.title)}`
- Run a project-wide grep for `\${t\.title}` and `\${g\.title}` and `\${p\.name}` without a preceding `esc(` to find any remaining instances.

---

### 14. `document.title` reassigned on every `nav()` call

**What**: `document.title = 'Task OS — ' + profileName` runs unconditionally at line 5365, inside `nav()` or a global init path, triggering a DOM write on every view transition.

**Where**: `index.html:5365`

**Why it matters**: Minor but unnecessary work on every navigation. More importantly, if the profile name changes during a session, the title update should be driven by the settings save (line 5333) not re-derived on every nav.

**Effort**: S

**Suggested fix**:
- Remove line 5365 from the render loop.
- Set `document.title` once on load and once inside `saveName()` at line 5333 (where it already updates `profileName`).

---

### 15. Service worker cache version is a manually-maintained date string

**What**: `const CACHE = 'task-os-20260513-round3'` must be hand-bumped on every deployment. If forgotten, users load stale JS/HTML from cache with no way to recover without a manual cache clear.

**Where**: `sw.js:1`

**Why it matters**: Several recent commits have been "fix JS syntax error breaking app on all devices" (commit 94fca67) — the kind of bug that a stale service worker cache amplifies by continuing to serve the broken version to returning users.

**Effort**: M

**Suggested fix**:
- Inject the cache version from a build step (even a simple `sed` in a deploy script) using the git commit SHA or timestamp: `const CACHE = 'task-os-{{GIT_SHA}}';`
- Alternatively, adopt Workbox which handles cache versioning automatically.
- At minimum, document in a comment that this string MUST be changed before every deploy.

---

### 16. Three `catch(_){}` blocks mask real failures in critical paths

**What**: Beyond the ntfy call (item 10), two other catch blocks silently discard errors: Readwise highlight processing (line 5532, 5564) and the AI briefing cache read (line 6347).

**Where**: `index.html:5532`, `5564`, `6347`
```js
// line 6347
try { const d = JSON.parse(cached); _renderAIBriefing(d, el); }
catch(e) {}
```

**Why it matters**: If the cached AI briefing is corrupt JSON, the card renders blank with no indication. Users think the feature is broken.

**Effort**: S

**Suggested fix**:
- `catch(e){}` at line 6347 → `catch(e){ el.innerHTML = ''; /* stale cache, will re-fetch */ }`
- For Readwise at lines 5532/5564, log at minimum: `catch(e){ console.warn('Readwise parse error', e); }`

---

## 💡 P3 — Nice to have

---

### 17. README.md references `style.css` and `script.js` — both non-existent

**What**: The README describes a file structure with separate CSS and JS files that were presumably refactored into the monolithic `index.html` long ago.

**Where**: `README.md` (entire file)

**Why it matters**: Any contributor or future-self reading the README will be immediately confused about the actual architecture.

**Effort**: S

**Suggested fix**:
- Rewrite the README to accurately describe the current single-file architecture, available views, integrations, PWA setup, and how to deploy to Vercel.

---

### 18. Modal dialogs lack `role="dialog"` and `aria-modal="true"`

**What**: The focus trap logic is correctly implemented at line 2536, but the modal elements in HTML don't have `role="dialog"` or `aria-modal="true"`, so screen readers don't announce them as dialogs.

**Where**: `index.html` — modal `<div>` elements (e.g. the `.mo` overlay wrappers around line 800–1400 in the HTML section)

**Why it matters**: Screen reader users navigating the app hear no announcement when a modal opens, and the focus trap is invisible to AT. A low-effort addition significantly improves accessibility.

**Effort**: S

**Suggested fix**:
- Add `role="dialog" aria-modal="true" aria-labelledby="<modal-title-id>"` to each modal container div.
- For modals with a visible heading, set `id="modal-title-..."` on the `<h2>`/`<h3>` and reference it in `aria-labelledby`.

---

### 19. ntfy default reminder message hardcodes "Good morning Panos!"

**What**: The default reminder configuration includes a literal name and fixed greeting, separate from the main "Panos" AI prompt issue.

**Where**: `index.html:5937`
```js
{ id: 'r-morning', msg: 'Good morning Panos! Check your One Thing and start focused work.' }
```

**Why it matters**: Any user who enables ntfy notifications with default settings receives messages addressed to "Panos." It's a small but jarring personalisation failure.

**Effort**: S

**Suggested fix**:
- Replace the literal `Panos` with a template evaluated at send time: compute the message in `postToNtfy()` using `${profileName}` rather than baking it into the static config object.

---

### 20. No viewport-height guard on modals for short mobile screens

**What**: Modals use `max-height: 90vh` globally. On phones where the keyboard is open (e.g. filling in task notes), 90vh can be less than the modal's minimum content height, causing content to be clipped without a scroll indicator.

**Where**: `index.html:107` (`.md` class), `index.html:218` (768px media query override)
```css
.md { max-height: 90vh; overflow-y: auto; }
/* at 768px */
.md { max-height: 90vh; }
```

**Why it matters**: The "Add Task" modal is the most-used flow. On small iPhones with the soft keyboard open, the "Save" button can be hidden below the fold with no visual affordance to scroll.

**Effort**: S

**Suggested fix**:
- Use `max-height: min(90vh, calc(100dvh - 80px))` to account for the dynamic viewport height (`dvh`) that shrinks when the keyboard appears.
- Ensure the modal footer with action buttons uses `position: sticky; bottom: 0;` so Save/Cancel remain visible regardless of content length.
