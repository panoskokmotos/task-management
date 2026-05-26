# Givelink Improvement Plan

> Generated: 2026-05-26 | Scope: `index.html` (11,595 lines) + `givelink.html` (1,755 lines)

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### P0-1 — `callClaudeGL()` never checks HTTP status, silently returns `null` on every API error

**What**: The Givelink-specific Claude wrapper skips `res.ok` validation, so 401 (bad key), 429 (rate limited), and 500 (server error) all look identical — callers receive `null` and show the same dead-end message.

**Where**: `givelink.html:1264–1271`

**Why it matters**: Every AI feature in the Givelink app (sprint planner, standup generator, outreach writer) is built on this function. A bad API key shows the same non-actionable "Could not generate. Check your API key." as a rate limit or a network blip. Users can't self-diagnose, so they churn.

**Effort**: S

**Suggested fix**:
- After `const res = await fetch(...)`, add `if(!res.ok){ const err=await res.json().catch(()=>({})); const msg=res.status===429?'Rate limit hit — wait a moment':res.status===401?'Invalid API key — check Settings':\`AI error ${res.status}\`; toast(msg); return null; }`
- Mirror the already-correct implementation in `index.html:3644–3647`
- Refactor both files to share one `callClaude` function to prevent the implementations drifting again

---

### P0-2 — Empty `catch` block silently fails API key lookup, locking users out of all AI features

**What**: `getApiKey()` wraps its localStorage profile scan in `try { ... } catch(e) {}` — if the stored JSON is corrupt, the error vanishes, the function returns `null`, and every AI button immediately shows "API key required" with no recovery path.

**Where**: `givelink.html:1078–1087` (catch on line 1083)

**Why it matters**: One corrupted `taskos_profiles` entry silently kills every AI feature in the Givelink app with no user-visible explanation.

**Effort**: S

**Suggested fix**:
- Replace `catch(e){}` with `catch(e){ console.warn('Profile key lookup failed:', e); }` at minimum
- Better: validate the parsed value is an array before iterating — `const profiles = JSON.parse(...); if(Array.isArray(profiles)) { ... }`
- Log a toast "Could not read saved profiles — AI features may need your API key again" so the user knows something went wrong

---

### P0-3 — `window.prompt()` for API key entry is blocked in many browser contexts and provides no recovery

**What**: Both `getApiKey()` and the inline fallback use `window.prompt()` to collect the Claude API key. If the user hits Cancel, they get a toast with no navigation path; if the app runs inside a web view or iframe, `prompt()` is blocked entirely and returns `null` silently.

**Where**: `givelink.html:1086`, `givelink.html:1261`

**Why it matters**: This is the onboarding path for every new Givelink user. A cancelled or blocked prompt leaves the entire app non-functional with no visible way to fix it — the user has no idea there is a Settings panel.

**Effort**: M

**Suggested fix**:
- Replace `window.prompt()` with a proper inline modal (reuse the existing modal pattern) that includes a "where do I get this?" help link
- After saving, toast "API key saved ✓" and immediately retry the triggering action
- Add a persistent "⚙ Add API key" banner to the header when no key is stored, so the call-to-action is always visible

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### P1-1 — CRM impact widget silently empties on zero nonprofits — first-time users see a blank screen

**What**: `renderImpactWidget()` sets `el.innerHTML = ''` and returns when `S.nonprofits` is empty, leaving the entire widget area blank with no guidance.

**Where**: `givelink.html:1573–1576`

**Why it matters**: The nonprofit CRM is the primary value driver of Givelink. A blank widget on first launch (the most common state) signals the app is broken rather than inviting the user to add their first nonprofit. This is a direct conversion kill.

**Effort**: S

**Suggested fix**:
- Replace the early return with an empty-state card: `el.innerHTML = '<div class="empty-state"><span>🌍</span><p>No nonprofits yet</p><button onclick="openAddNP()">Add your first nonprofit →</button></div>'`
- Mirror the existing empty-state styling used elsewhere in the file
- Add the same empty-state to the CRM kanban column when all columns are empty

---

### P1-2 — Givelink brand palette is entirely wrong — app uses blue/green/amber, not brand purple/pink

**What**: The Givelink app's CSS variables define `--accent: #3b82f6` (blue), `--gr: #4ade80` (green), `--np: #60a5fa` (sky blue), `--ex: #fbbf24` (amber). CRM stage colors (won = `#22c55e`, contacted = `#60a5fa`) and sprint progress bars all use these off-brand colors.

**Where**: `givelink.html:17–19` (CSS variables), `givelink.html:1279` (CRM stage colors)

**Why it matters**: The specified brand palette is purple (`#6B3FA0`, `#5718CA`) and pink (`#C2185B`, `#E353B6`). The current UI looks like a generic Tailwind app, not a distinct product. This erodes trust and memorability at every touchpoint.

**Effort**: M

**Suggested fix**:
- Update `:root` variables: `--accent: #5718CA`, `--accent-light: #6B3FA0`, replace blue pillar colors with purple-family shades
- Update CRM stage colors to use purple spectrum for active stages (`won: #6B3FA0`) and neutral for inactive
- Audit every inline hex in the file and replace out-of-palette values — a single `grep -n '#[0-9a-fA-F]\{6\}'` pass will surface them all

---

### P1-3 — Touch targets on task checkboxes, hamburger, and modal close are below 44 px — mobile use is error-prone

**What**: Checkboxes render at 22 px (24 px on mobile override), the hamburger button is 38×38 px, and the modal close button is 36×36 px on mobile — all below the 44 px WCAG 2.5.8 minimum.

**Where**: `index.html:69` (`.ck`, 22px), `index.html:199` (`.ham-btn`, 38px), `index.html:240` (`.mc`, 36px mobile)

**Why it matters**: Checkboxes are the single most-used interaction in the app. At 22 px, users frequently tap the wrong element on a phone, marking tasks done by accident or missing entirely. This creates a frustrating core loop.

**Effort**: S

**Suggested fix**:
- `.ck { width: 22px; height: 22px; }` → keep visual size but add `padding: 11px` and `box-sizing: content-box` (or use a pseudo-element hit area) so the tappable region is 44 px
- `.ham-btn { width: 44px; height: 44px; }` and `.mc { width: 44px; height: 44px; min-width: 44px; }` in mobile breakpoint (line 229+)
- Same fix for `.habit-ck` (`index.html:278`) and `.bl-check` (`index.html:337`)

---

### P1-4 — Five icon-only buttons have no accessible names — screen readers announce "button" with no context

**What**: The dashboard overflow menu ("⋯"), the refresh button ("↺"), and the voice input button ("🎤") are interactive controls with no `aria-label`, and emoji content is announced inconsistently across screen readers.

**Where**: `index.html:471` (`#dash-more-btn`), `index.html:539` (refresh ↺), `index.html:592` (voice 🎤)

**Why it matters**: Users relying on VoiceOver or TalkBack hear "button" three times in a row with no ability to distinguish them. This is a WCAG 4.1.2 failure.

**Effort**: S

**Suggested fix**:
- Add `aria-label="More options"` to `#dash-more-btn`, `aria-label="Refresh"` to the refresh button, `aria-label="Voice input"` to the mic button
- Audit remaining emoji-only buttons with: `grep -n 'button' index.html | grep -v 'aria-label'` and add labels to any that are missing

---

### P1-5 — Body text at 10–11 px is below readable threshold on mobile and triggers iOS auto-zoom

**What**: Six CSS classes (`.ns`, `.ibadge`, `.sl`, `.badge`, `.tag`, `.sub`) set `font-size: 10px` or `11px`. None of these are overridden to larger sizes in the `@media (max-width:600px)` block.

**Where**: `index.html:37` (`.ns 10px`), `index.html:41` (`.ibadge 10px`), `index.html:63` (`.sl 11px`), `index.html:77` (`.badge 10px`), `index.html:159` (`.tag 11px`)

**Why it matters**: iOS Safari auto-zooms the entire viewport on any input with `font-size < 16px`, breaking the layout. At 10 px, tag labels and stat numbers are barely legible on a phone screen even without zoom.

**Effort**: S

**Suggested fix**:
- In the `@media (max-width:600px)` block, add: `.ns, .ibadge, .badge { font-size: 11px; }` and `.sl, .tag { font-size: 12px; }`
- For form inputs specifically, ensure `font-size: 16px` to suppress iOS zoom: add `input, select, textarea { font-size: 16px; }` scoped to mobile breakpoint

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### P2-1 — `saveTask()` uses `alert()` for validation — inconsistent with the rest of the app

**What**: When the task title is empty, `saveTask()` calls `alert('Enter a task title.')` — the only `alert()` call in the app. Everything else uses `toast()`.

**Where**: `index.html:2734`

**Why it matters**: `alert()` blocks the JavaScript thread, looks like a browser security warning, and is inconsistent with the toast pattern used in ~30 other validation messages. Minor but visible to every user who accidentally submits a blank task.

**Effort**: S

**Suggested fix**:
- Replace `alert('Enter a task title.')` with `toast('Enter a task title.')` and optionally call `document.getElementById('t-title').focus()` to keep the user in context
- No other changes needed

---

### P2-2 — Two separate `callClaude` implementations exist with different error-handling quality

**What**: `givelink.html` has `callClaudeGL()` (line 1264) with no `res.ok` check, plus an inline `fetch` inside `runAiSprintPlanner()` (line 1131) with partial handling. Meanwhile `index.html` has a well-implemented `callClaude()` at line 3636 that handles 401, 429, and network errors distinctly.

**Where**: `givelink.html:1131`, `givelink.html:1264`, `index.html:3636`

**Why it matters**: Bug fixes to error handling must be applied in three places and will inevitably drift. The weaker implementations are what users of the Givelink app hit.

**Effort**: M

**Suggested fix**:
- Extract a single shared `callClaude(prompt, maxTokens, model)` into a `<script src="claude-api.js">` included in both HTML files
- The extracted function should use the error-handling logic from `index.html:3644–3647`
- Delete the two weaker implementations and the inline fetch in `runAiSprintPlanner`

---

### P2-3 — Modal dialogs missing `role="dialog"` and `aria-modal="true"` — screen reader focus not trapped semantically

**What**: The app implements `_trapFocus()` in JavaScript but the modal container divs have no `role="dialog"`, `aria-modal="true"`, or `aria-labelledby` pointing to the modal title. Assistive technology cannot identify dialog boundaries.

**Where**: `index.html:~1163` (task modal `#tm`), `index.html:~1264` (goal modal), `givelink.html:~370` (sprint modal)

**Why it matters**: Without `role="dialog"`, VoiceOver and NVDA users are not informed when a modal opens and cannot easily navigate to the dialog's heading. This is a WCAG 4.1.2 failure.

**Effort**: S

**Suggested fix**:
- Add `role="dialog" aria-modal="true" aria-labelledby="<heading-id>"` to each modal's root element
- Add an `id` to each modal's `<h2>` or `<h3>` title element so `aria-labelledby` can reference it
- Verify existing `_trapFocus()` also sets focus to the first interactive element on open

---

### P2-4 — `parseFloat()` in `saveGoal()` can store `NaN` for numeric fields

**What**: `saveGoal()` calls `parseFloat()` on user-entered progress and target values without checking the result for `NaN`. `NaN` is truthy in a conditional and passes silently into localStorage, breaking any calculation that depends on these numbers.

**Where**: `index.html:2941–2942`

**Why it matters**: A user who enters "50%" instead of "50" for a goal target silently stores `NaN`, then sees a broken progress bar (renders as 0% or NaN%) with no error message. Data corruption with no feedback.

**Effort**: S

**Suggested fix**:
- Add validation: `const current = parseFloat(document.getElementById('g-current').value); const target = parseFloat(document.getElementById('g-target').value); if(isNaN(target)){ toast('Target must be a number'); return; }`
- Also guard against `target === 0` to prevent division-by-zero in progress calculations

---

### P2-5 — `claude-opus-4-5` model identifier in sprint planner may refer to a retired model

**What**: `runAiSprintPlanner()` hard-codes `model: 'claude-opus-4-5'` in the fetch body. This is different from the `claude-haiku-4-5-20251001` used in `callClaudeGL` and the main app. Non-existent or retired model IDs return a 400 error.

**Where**: `givelink.html:1140`

**Why it matters**: If `claude-opus-4-5` is retired, the sprint planner silently fails for every user. The error message surfaces only as raw API error text (line 1145 throws `err` which is the raw response body).

**Effort**: S

**Suggested fix**:
- Replace `'claude-opus-4-5'` with the current recommended model: `'claude-sonnet-4-6'` (or parameterize via a `const DEFAULT_MODEL` at the top of the file)
- Use the same model constant in `callClaudeGL` and `runAiSprintPlanner` so both are updated in one place

---

## 💡 P3 — Nice to have

---

### P3-1 — Service worker registration has no `.catch()` — unhandled rejection on PWA-blocked browsers

**What**: `navigator.serviceWorker.register('./sw.js').then(...)` has no `.catch()` handler. On browsers that block service workers (private mode in some browsers, strict enterprise policies), this produces an unhandled promise rejection.

**Where**: `givelink.html:1720–1721`

**Why it matters**: Unhandled rejections appear as console errors and, in some environments, crash the page load event chain. Low probability but zero cost to fix.

**Effort**: S

**Suggested fix**:
- Chain `.catch(e => console.warn('Service worker registration failed:', e))` to the `.then()` block

---

### P3-2 — Potential XSS in `onclick` attribute via user-controlled record IDs

**What**: Rendered HTML includes patterns like `onclick="openEditNP('${np.id}')"` where `np.id` comes from user-created data. If a record ID contains a single quote or JavaScript (e.g., from imported JSON), it breaks the attribute context.

**Where**: `givelink.html:1326`, `index.html:~2670`

**Why it matters**: The built-in `uid()` function generates safe IDs, but `importData()` accepts arbitrary JSON from the user, which could contain crafted IDs. The attack surface is self-XSS only (user attacking themselves), but worth closing.

**Effort**: S

**Suggested fix**:
- Replace inline `onclick` with `data-id="${esc(np.id)}"` attributes and attach event listeners in JavaScript: `el.addEventListener('click', e => { const id = e.currentTarget.dataset.id; openEditNP(id); })`
- This also eliminates the dependency on the `esc()` function being applied consistently in every template literal

---

### P3-3 — Settings modal has no "unsaved changes" guard — API keys and integration tokens silently lost

**What**: The Settings modal contains ~15 fields (Claude key, Readwise token, Notion credentials, ntfy config). Clicking the X button or pressing Escape discards all edits with no warning.

**Where**: `index.html:~1341` (settings modal)

**Why it matters**: Users who open Settings to add an API key, get distracted, and close the modal lose their input with no indication. This contributes to the "AI features not working" support pattern.

**Effort**: M

**Suggested fix**:
- Track a `_settingsDirty` boolean that is set `true` on any `input`/`change` event inside the settings modal
- On close (both X button and Escape), if `_settingsDirty`, call `showConfirm('Discard unsaved settings?', ...)` before closing
- Reset `_settingsDirty = false` after a successful save

---

### P3-4 — `#impact-widget` hardcodes `color: #22c55e` (green) as an inline style — bypasses theme variables

**What**: The "People Impacted" heading in the impact widget uses `color:#22c55e` as an inline style, bypassing CSS custom properties and making it impossible to retheme or override via the brand color update.

**Where**: `givelink.html:1583`

**Why it matters**: When the brand color refactor from P1-2 is done, this hardcoded green will remain unaffected, creating an inconsistency. Minor but will become a maintenance trap.

**Effort**: S

**Suggested fix**:
- Replace `color:#22c55e` with `color:var(--accent)` (or a new `--impact-color` CSS variable) so it picks up theme changes automatically
- Apply the same pattern to any remaining hardcoded hex colors in the widget template strings
