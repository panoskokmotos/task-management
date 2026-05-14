# Givelink / Task OS — Improvement Plan

_Scanned: 2026-05-14 · Files: `index.html` (8,201 lines), `givelink.html` (1,755 lines), `sw.js` (109 lines)_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. XSS: Task titles, goal titles, and person notes injected into `innerHTML` unescaped

**What:** `tcHTML()` and the weekly review wizard render user-supplied text directly into `innerHTML` without calling `esc()`, enabling stored XSS via the JSON import flow.

**Where:**
- `index.html:2319` — `tcHTML()`: `${t.title}` (every task card in the app)
- `index.html:2229,2236` — review wizard steps 1 & 2: `${t.title}` in `body.innerHTML`
- `index.html:2238` — review wizard step 3: `${g.title}` in goal progress panel
- `index.html:2165` — goals grid: `${g.isTop3?'⭐ ':''}${g.title}`
- `index.html:2423` — soft-delete toast: `` `🗑 "<strong>${t.title.slice(0,30)}</strong>"` ``
- `index.html:3544,3547` — `renderRelationships()`: `${p.name}` and `${p.notes}`
- `index.html:2210` — linked tasks panel: `${t.title}` in goal modal

**Why it matters:** A user who imports a JSON backup from a third party (or pastes AI-generated tasks) can execute arbitrary JavaScript in their browser session, instantly leaking their Claude API key, Readwise token, and Notion key stored in localStorage. The `esc()` helper already exists at `index.html:6941`—it just isn't used consistently.

**Effort:** S

**Suggested fix:**
- Wrap every bare `${t.title}`, `${g.title}`, `${p.name}`, and `${p.notes}` inside template literals that set `innerHTML` with `${esc(t.title)}` etc. — global find-and-replace within HTML-generating functions.
- In `tcHTML()` (line 2319), change `${t.title}` to `${esc(t.title)}`.
- In the soft-delete toast (line 2423), use `esc(t.title.slice(0,30))` before injecting into the toast `innerHTML`.

---

### 2. Missing `icons/` directory causes silent push notification failures

**What:** The service worker and the in-app notification code both reference `./icons/icon-192.png`, but the directory does not exist in the repo.

**Where:**
- `sw.js:38-39` — push handler uses `icon:'./icons/icon-192.png'`
- `index.html:6454` — `Notification()` constructor uses same path

**Why it matters:** In Chromium-based browsers, a missing notification icon causes the entire `showNotification()` call to silently fail. Users who configure ntfy reminders get no system notifications at all, with no error message shown. This is a silent feature kill for the reminder system.

**Effort:** S

**Suggested fix:**
- Create an `icons/` directory and generate `icon-192.png` and `icon-512.png` from the existing `icon.svg` (e.g., via Squoosh or `sharp` CLI).
- Alternatively, replace the `.png` references with `icon.svg` — modern browsers support SVG notification icons.
- Add `./icons/icon-192.png` to the `STATIC` array in `sw.js` so it is cached for offline use.

---

### 3. `alert()` calls block JS execution and break PWA standalone mode

**What:** Three places use native `window.alert()` instead of the custom `toast()`/`showConfirm()` system.

**Where:**
- `index.html:2398` — `if(!title){alert('Enter a task title.');return;}`
- `index.html:2539` — `if(!slot){alert('Top 3 full! Remove one first.');return;}`
- `index.html:2593` — `if(!title){alert('Enter a goal title.');return;}`

**Why it matters:** `alert()` is blocked or behaves incorrectly in PWA standalone mode on iOS and some Android WebViews. It also freezes the UI event loop during display, causing visible animation stutters. The app already has a toast queue and a confirm modal — these three calls are simply inconsistent with the rest of the system.

**Effort:** S

**Suggested fix:**
- Replace all three `alert('...')` calls with `toast('⚠️ ...')`.
- The "Top 3 full" message at line 2539 could additionally set a brief shake animation on the Top 3 section to draw the eye.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Brand palette is entirely absent: every accent color is blue, brand is purple

**What:** Both apps use blue as the primary accent. The Givelink brand palette (purple `#6B3FA0`/`#5718CA`, pink `#C2185B`/`#E353B6`) appears nowhere in either file.

**Where:**
- `index.html:17` — `--accent:#58a6ff` (dark mode)
- `index.html:24` — `--accent:#2563eb` (light mode)
- `givelink.html:6` — `<meta name="theme-color" content="#3b82f6">`
- `givelink.html:17` — `--accent:#3b82f6`

**Why it matters:** The Givelink Sprint Board is the outward-facing tool. Its chrome (logo, active nav indicator, buttons, sprint progress bar) is rendered in Tailwind blue — a color associated with generic SaaS, not the Givelink brand. Any screenshot or demo looks like a different product.

**Effort:** M

**Suggested fix:**
- In `givelink.html:17`, change `--accent:#3b82f6` → `--accent:#5718CA` (Givelink purple). Update `theme-color` to match.
- In `index.html`, consider a softer purple for the personal Life OS accent so the two apps feel like a family.
- Audit secondary category colors (`--np`, `--pr`, etc. in givelink.html) to ensure pink is never placed on a purple background per the no-pink-on-purple rule.

---

### 5. Personal developer seed data ships to every new user

**What:** The `seed()` function pre-populates the app with the developer's private tasks, including Greek-language medical appointments and personal finance entries.

**Where:** `index.html:2789–2850` — includes `'Ακτινογραφία στα γόνατα'`, `'Πνευμολογικές εξετάσεις'`, `'245€ in investments from seminaria (was behind) + rest to me'`.

**Why it matters:** A new user's first experience is seeing someone else's personal health exams, financial details, and Greek-language text. It's confusing, unprofessional, and potentially embarrassing if the app is demoed publicly or used by a team. The seed data was likely intended for local development only.

**Effort:** S

**Suggested fix:**
- Replace the personal seed tasks with 3–5 neutral, instructional placeholder tasks (e.g., "Set up your first goal →", "Try the Eisenhower matrix →", "Add a habit to track").
- Keep one task per major category to demonstrate the UI without leaking personal data.
- Remove the seeded Greek-language tasks and the personal finance entry entirely.

---

### 6. Hardcoded `"Panos"` in AI relationship draft prompt

**What:** The AI prompt for generating relationship outreach messages hardcodes the developer's name.

**Where:** `index.html:6975`
```js
const prompt=`Write a SHORT, warm, casual message ... for Panos to send to ${p.name}...`
```

**Why it matters:** Every user who uses the relationship draft feature receives an AI message written "for Panos." The `profileName` variable already holds the correct name and is used everywhere else in the app — this is simply a copy-paste oversight that breaks the personalization of a flagship AI feature.

**Effort:** XS

**Suggested fix:**
- Replace the hardcoded `'Panos'` with the `profileName` variable: `for ${profileName} to send to ${p.name}`.

---

### 7. Claude API key is serialised into every JSON data export

**What:** `S.claudeKey` lives inside the main state object `S`, which is serialised to JSON on every export.

**Where:**
- `index.html:1658` — `claudeKey:''` is part of the `S` object definition
- `index.html:1714` — `exportData()` exports `JSON.stringify(S,null,2)` — includes the key

**Why it matters:** A user who shares their "Task OS backup" with a friend or posts it for troubleshooting inadvertently shares their Anthropic API key. Since the key is also stored in localStorage with no encryption, any browser extension with `storage` permission can also read it. Keeping the key out of the main data blob is a simple first step.

**Effort:** S

**Suggested fix:**
- Remove `claudeKey` from the `S` state object; store it separately under `localStorage.setItem('taskos_claudekey', k)` (alongside `taskos_readwise_key` and `taskos_notion_key` which already use this pattern).
- In `exportData()`, explicitly omit API key fields: `const {claudeKey,...exportable}=S; JSON.stringify(exportable,null,2)`.

---

### 8. `closeModal()` doesn't release focus traps, breaking keyboard navigation

**What:** Two different modal-close functions exist. `closeM()` correctly calls `_releaseFocus()`. `closeModal()` only adds the `hidden` class and leaves the focus trap active.

**Where:**
- `index.html:2639` — `closeM()` with proper `_releaseFocus()` call
- `index.html:7659` — `closeModal(id)` — only does `classList.add('hidden')`
- Used by: win modal (line 891), bucket-list modal (line 926), wishlist modal (line 964), project modal (line 1004), paste import modal (line 862)

**Why it matters:** After closing any of these five modals, Tab key focus is still trapped inside the now-invisible dialog. Pressing Tab cycles through hidden elements; the visible content becomes unreachable via keyboard until the user refreshes. This silently breaks accessibility for keyboard-only users and is noticeable to any power user.

**Effort:** S

**Suggested fix:**
- Replace the body of `closeModal()` with a call to `closeM()`:
  ```js
  function closeModal(id){closeM(id);}
  ```
- This reuses the existing focus management and ensures parity without code duplication.

---

### 9. Icon-only buttons have no accessible names across the app

**What:** The `×` close buttons, `🗑` delete buttons, and bottom navigation icons have no `aria-label` or visible text fallback.

**Where:** Throughout `index.html` — representative examples:
- Line 845: `<button class="mc" onclick="closeModal(...)">×</button>`
- Line 3554–3558: relationship card action buttons (`✍️ Draft`, `📞 Logged`, `🎁`, `🙏`, `✏️`, `×`)
- Lines 223–228: bottom nav buttons with emoji-only labels

**Why it matters:** Screen readers announce these as "button" with no context. Users relying on assistive technology cannot navigate the app. The app currently has only 2 `aria-label` attributes across 8,201 lines — a near-zero accessibility baseline.

**Effort:** M

**Suggested fix:**
- Add `aria-label="Close"` to all `×` (`.mc`) close buttons.
- Add `aria-label="Delete"` (or contextual "Delete task", "Delete win") to trash buttons.
- Add `aria-label="Dashboard"`, `aria-label="Capture"`, etc. to bottom nav buttons.
- Add `role="navigation"` and `aria-label="Main navigation"` to the sidebar `<nav>` equivalent.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. Identical AI JSON-parsing try/catch block copy-pasted three times

**What:** The pattern of stripping code fences and JSON-parsing an AI response into an array is duplicated verbatim at three call sites.

**Where:**
- `index.html:7357` — task suggestions from AI
- `index.html:7462` — book task extraction
- `index.html:7560` — project idea generation

**Why it matters:** The three blocks are character-for-character identical. A change to error handling or the regex (e.g., to support non-array responses) must be made in all three places. This has already caused subtle divergence: the fallback `showAiOut()` vs `previewPasteImport()` calls differ, suggesting the blocks drifted independently.

**Effort:** S

**Suggested fix:**
- Extract a `_parseAIJsonArray(txt)` helper that returns `{items, raw}` and throws on failure.
- All three sites call the helper and handle the thrown error differently via their own catch.

---

### 11. Two parallel modal-close systems create an ambiguous API

**What:** `closeM(id)` (line 2639) and `closeModal(id)` (line 7659) both hide modals but with different side effects. New code must choose between them with no guidance.

**Where:** `index.html:2639` and `index.html:7659`

**Why it matters:** As the app adds new modals, the wrong function gets used (evidence: the five modals in P1 item 8 all use `closeModal()` and miss focus release). Maintaining two systems doubles the surface area for bugs and slows code review.

**Effort:** S

**Suggested fix:**
- After fixing P1 item 8 (making `closeModal` delegate to `closeM`), remove `closeModal` as a distinct function.
- Add a JSDoc comment to `closeM()` marking it as the single canonical close path.

---

### 12. `renderDash()` triggers 15+ synchronous sub-renders on every navigation

**What:** Every time the user navigates to the Dashboard, `renderDash()` synchronously calls `renderTop3()`, `renderMorningBriefing()`, `renderStreakRow()`, `renderAntiPatterns()`, `checkEatTheFrog()`, `checkPreMortem()`, `renderMomentumScore()`, `renderOneThing()`, `renderWeeklyTheme()`, `renderExecutionScore()`, `_updateStartDayBtn()`, and more — each scanning the full task/habit/goal/challenge arrays.

**Where:** `index.html:1959–1985`

**Why it matters:** With a few hundred tasks and 90 days of habit logs, switching to the dashboard becomes measurably sluggish. `renderAntiPatterns()` alone runs 6 `.filter()` passes over all tasks. Each navigation to home re-pays this cost even if nothing changed.

**Effort:** M

**Suggested fix:**
- Memoize expensive scans (`antiPatterns`, `momentumScore`, `executionScore`) with a stale flag reset only on `save()`.
- Defer `renderMorningBriefing()` with `setTimeout(..., 0)` since it involves an async AI call and doesn't need to block first paint.
- Combine the multiple `active().filter(...)` calls at the top of `renderDash()` into a single pass.

---

### 13. 193 instances of 10–11px text on `--muted` color fail WCAG AA contrast

**What:** Metadata labels, section headers, and badge text are styled at `font-size:10px` or `font-size:11px` with `color:var(--muted)`.

**Where:** `index.html:37,63,117,124,152,159` (CSS definitions); applied at 193+ render sites including task card metadata, bucket counts, and sidebar nav labels.

**Why it matters:** Dark mode `--muted` is `#8b949e` on `--bg` of `#0d1117` — approximately 3.4:1 contrast ratio. WCAG AA requires 4.5:1 for text below 18px. This affects every task card, goal progress label, habit stat, and section divider in the app.

**Effort:** M

**Suggested fix:**
- Increase dark-mode `--muted` from `#8b949e` to `#a8b4c2` to reach ≈4.7:1 on `--bg`.
- Raise the minimum font size for metadata labels (`.tm`, `.tag`, `.sl2`) from `10px` to `12px`.
- Check the light-mode `--muted` (`#6b7280` on `#f5f5f0` ≈ 4.6:1 at normal sizes) — acceptable, no change needed.

---

### 14. Toast system injects `t.title` as raw HTML, creating a second XSS vector

**What:** The toast message for soft-delete wraps `t.title` in `<strong>` inside a template literal passed to `toast()`, which uses `t.innerHTML=msg`. The `esc()` call is missing at this specific callsite.

**Where:** `index.html:2423`
```js
toast(`🗑 "<strong>${t.title.slice(0,30)}</strong>" deleted — <span ...>Undo</span>`)
```

**Why it matters:** Although this partially overlaps with P0 item 1, the toast function (`_runToast`) intentionally supports HTML for buttons (the Undo link). This makes it a persistent injection point even after the main template fixes: any task with a title like `</strong><img src=x onerror=...>` triggers execution through the undo toast.

**Effort:** S

**Suggested fix:**
- Use `esc()` on the title portion only: `` `🗑 "<strong>${esc(t.title.slice(0,30))}</strong>"... ` ``
- Consider splitting `toast()` into `toastText()` (auto-escapes all content) and `toastHTML()` (opt-in for intentional HTML), and default all call sites to `toastText()`.

---

## 💡 P3 — Nice to have

### 15. Service worker returns a bare 503 for all external API failures — no user feedback

**What:** When the device is offline, API calls to Claude, Readwise, and Notion return a `503 Service Unavailable` response from the service worker with an empty body. The callers interpret this as a network error and show a generic error toast with no offline indication.

**Where:** `sw.js:91` — `e.respondWith(fetch(e.request).catch(()=>new Response('',{status:503})))`

**Why it matters:** Users who open the app without connectivity see AI features silently fail and get generic error messages. A simple offline indicator would set the right expectation and prevent confusion.

**Effort:** S

**Suggested fix:**
- Return a JSON error body: `new Response(JSON.stringify({offline:true}),{status:503,headers:{'Content-Type':'application/json'}})`.
- In `callClaude()` (`index.html:3260`), detect this response and show `toast('📵 You\'re offline — AI features need a connection')` instead of a generic error.

---

### 16. Light mode accent (`#2563eb`) diverges visually from dark mode accent (`#58a6ff`)

**What:** Switching to light mode changes the accent from periwinkle blue to a much darker Tailwind blue, making interactive elements feel heavier and the two modes look like different apps.

**Where:** `index.html:24` — `--accent:#2563eb` in `body.light`

**Why it matters:** If the brand accent is being updated to purple (P1 item 4), this is a free fix. If not, the light mode accent should at minimum be a lighter purple or a perceptually matched blue so the two modes feel cohesive.

**Effort:** S

**Suggested fix:**
- After resolving P1 item 4, set `body.light { --accent: #6B3FA0; }` to mirror the purple brand token.
- Verify button text contrast on purple background (white text on `#6B3FA0` is ~5.3:1 — passes AA).

---

### 17. `fillBlockerDrop()` puts `t.title` in `<option>` text without `esc()`

**What:** The blocker dependency dropdown builds its options with unescaped task titles.

**Where:** `index.html:1684`
```js
s.innerHTML=active().filter(...).map(t=>'<option value="'+t.id+'"...>'+t.title.slice(0,45)+'</option>').join('');
```

**Why it matters:** `<option>` inner text is text-node content, so the browser won't execute scripts here — but a title like `<script>` will display as literal angle-bracket text, confusing users who named tasks with comparison operators or XML. Using `esc()` is still the correct practice and prevents any future HTML-parsing ambiguity.

**Effort:** XS

**Suggested fix:**
- Change `t.title.slice(0,45)` to `esc(t.title).slice(0,45)` at line 1684.

---

_Total items: 17 (3 P0, 6 P1, 5 P2, 3 P3). Ordered within each tier by ROI._
