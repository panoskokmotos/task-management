# Task OS — Improvement Plan

Audit date: 2026-06-01  
Codebase: single-file vanilla JS/HTML PWA (`index.html` 12,888 lines, `givelink.html` 1,755 lines, `sw.js` 109 lines)

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Life Score habits component always returns 0
**What:** `calcLifeScore()` calls `h.id` on habits that are plain strings, so `h.id` is always `undefined` — the streak counter never increments and the habits dimension is permanently locked at 0%.  
**Where:** `index.html:2176` — `if((S.habitLogs||{})[d]?.[h.id])streak++;`  
**Why it matters:** The Life Score widget on the dashboard shows the habits bar empty for every user. It silently corrupts the most-used engagement metric. Every habit the user checks off is reflected nowhere.  
**Effort:** S  
**Suggested fix:**
- Change `h.id` → `h` on line 2176: `if((S.habitLogs||{})[d]?.[h])streak++;`
- Add a grep for any other `h.id` or `h.name` references on `S.habits` items and fix the same way (see P2 #9)

---

### 2. Deep work "hours" computed from seconds ÷ 60 in Life Score (60× over-report)
**What:** `calcLifeScore()` divides total session `duration` (stored in **seconds**) by 60, producing **minutes** labelled as "hours". A 30-minute session appears as 30h, so the deep-work bar is perpetually maxed — masking real deficits.  
**Where:** `index.html:2184` — `.reduce((a,s)=>a+(s.duration||s.minutes||0),0)/60`  
**Why it matters:** The Deep Work dimension (worth 20% of Life Score) is always at 100% regardless of actual effort, giving false signal and hiding when deep-work volume drops.  
**Effort:** S  
**Suggested fix:**
- Change `/60` → `/3600` on line 2184 to match every other deep-work calculation in the file (lines 4657, 5072, 6981, 9861 all correctly use `/3600`)
- The legacy `||s.minutes` fallback (older sessions stored in minutes) should become `(s.duration ? s.duration/3600 : (s.minutes||0)/60)` to handle both correctly

---

### 3. Push notification icon 404 on every notification
**What:** The service worker references `./icons/icon-192.png` for both `icon` and `badge` in `showNotification()`, but that path does not exist — the actual icons are `./icon.svg` and `./icon-gl.svg`.  
**Where:** `sw.js:39-40`  
**Why it matters:** Every push notification (reminders, streak nudges, ntfy messages) shows a broken image. On Android/Chrome this causes the notification to display an empty icon tile, degrading perceived app quality.  
**Effort:** S  
**Suggested fix:**
- Change both `icon` and `badge` to `'./icon.svg'`
- Optionally add a proper 192×192 PNG to a new `icons/` directory and update the PWA manifest to include it; the manifest currently only lists the SVG

---

### 4. AI-extracted task "Add" button silently fails when Claude uses special characters
**What:** In `aiExtractTasksFromNotes()`, extracted task titles are embedded directly into an inline `onclick` string with only apostrophe-escaping. If Claude returns a title containing backticks, curly braces, or newlines, the generated HTML contains broken JavaScript that fails silently — the task is never added.  
**Where:** `index.html:6407`  
**Why it matters:** The weekly-notes AI extraction is a core workflow. A single unusual AI output character wipes the entire batch of extracted tasks with no error shown to the user.  
**Effort:** M  
**Suggested fix:**
- Remove inline `onclick` attribute injection entirely; instead render each task row with a `data-idx` attribute and a single delegated click handler that reads `window._notesExtractTasks[idx]`
- Store the full task array in `window._notesExtractTasks` after extraction (same pattern as `window._highlightTasks` used elsewhere)

---

### 5. Readwise highlight pagination builds an invalid URL on malformed `next`
**What:** When paginating Readwise highlights, `data.next.split('?')[1]` produces `undefined` if `next` is a bare path or empty string, resulting in requests to `/highlights/?undefined`. The second page silently disappears.  
**Where:** `index.html:8859`  
**Why it matters:** Books with >500 highlights (common for heavily-annotated books) lose the second half of their highlights on import, causing incomplete AI task extraction without any warning.  
**Effort:** S  
**Suggested fix:**
- Guard the split: `const qs = data.next?.split('?')[1]; if (!qs) break;`
- Or: use `new URL(data.next, 'https://readwise.io').search.slice(1)` for robust URL parsing

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. Google Fonts blocked by CSP — Inter falls back silently on production
**What:** `vercel.json` sets `font-src 'self'`, which blocks `fonts.gstatic.com`. The `<link>` to Google Fonts in `index.html` is loaded (using `style-src 'unsafe-inline'`), but the actual font files are blocked, so Inter silently falls back to the browser's system font stack.  
**Where:** `vercel.json:14` — `"font-src 'self'"`; `index.html:14` — Google Fonts `<link>`  
**Why it matters:** The entire visual language of the app is built on Inter (weight 400–800). On Vercel production, every user sees the system font (San Francisco on macOS, Roboto on Android), which breaks the intended design and legibility at small sizes.  
**Effort:** S  
**Suggested fix:**
- Add `https://fonts.gstatic.com` to `font-src` and `https://fonts.googleapis.com` to `style-src` in `vercel.json`
- Or self-host Inter as a local font file and serve from the same origin (eliminates the external dependency entirely)

---

### 7. Claude API key written to Supabase in plain text
**What:** `sbPush()` syncs the entire `S` state object to Supabase including `S.claudeKey`. The API key lives unencrypted in the user's cloud database row.  
**Where:** `index.html:8603` — `body: JSON.stringify([{user_id: _SB.uid, data: S, ...}])`  
**Why it matters:** If Supabase RLS is misconfigured (easy to do during setup), or if the user ever examines their own row, the Claude API key is fully exposed. API keys should never leave the device. Anthropic keys currently have no rate-limit isolation — a leaked key is a billing problem.  
**Effort:** S  
**Suggested fix:**
- Before pushing: `const {claudeKey: _, ...safeS} = S; const body = [{user_id: _SB.uid, data: safeS, ...}]`
- On pull-apply: after `S = {...S, ...remote.data}`, re-read the key from localStorage: `S.claudeKey = localStorage.getItem('taskos_claude_key') || S.claudeKey`

---

### 8. AI prompts hardcode "Panos" / "Givelink founder" ignoring `profileName`
**What:** At least five AI feature prompts (`synthesizeWeeklyNotes`, `extractHighlightTasks`, `autoProcessInbox`, `_fetchAIBriefing`, `aiExtractTasksFromNotes`) hardcode `"Panos"` and the Givelink founder context instead of using the configurable `profileName` variable and `getAboutMe()` helper.  
**Where:** `index.html:9407`, `9508`, `9664`, `9726`, `6378`  
**Why it matters:** Any profile name change (Settings), new user, or public share of the app results in AI responses addressed to the wrong person. The AI briefing opens with "Panos, here's your day..." regardless of who's using it.  
**Effort:** M  
**Suggested fix:**
- Replace every `"Panos"` in prompt strings with `${profileName}` and every hardcoded role description with `${getAboutMe() || profileName + ', a productivity-focused professional'}`
- Centralise the base system prompt into a single `_buildSystemContext()` helper to avoid drift

---

### 9. AI security audit receives empty habits list
**What:** `index.html:11605` calls `S.habits.map(h => h.name)` — but habits are stored as plain strings (not objects), so `.name` returns `undefined` for every item, joining into a blank string. Claude's security audit receives no habit information.  
**Where:** `index.html:11605` — `const habits=(S.habits||[]).map(h=>h.name).join(', ')`  
**Why it matters:** The security audit is designed to audit lifestyle habits as a risk factor; it receives no data and cannot produce accurate health-security analysis.  
**Effort:** S  
**Suggested fix:**
- Change `.map(h => h.name)` → `.map(h => (typeof h === 'string' ? h : h.name || h.id))` — handles both current strings and any future migration to objects

---

### 10. Morning briefing hidden after 12:00 pm — invisible most of the day
**What:** `renderMorningBriefing()` immediately hides the element with `display:none` if `new Date().getHours() >= 12`, so afternoon and evening users never see the daily briefing.  
**Where:** `index.html:9641` — `if(h>=12){el.style.display='none';return;}`  
**Why it matters:** The briefing is the highest-value AI feature — it surfaces the day's priorities. Most users open the app after noon. The "morning" label is cosmetic; hiding it until midnight causes daily context loss.  
**Effort:** S  
**Suggested fix:**
- Change the cutoff from 12 to end-of-day: `if(h >= 20){el.style.display='none';return;}`
- Or rename the section to "Daily Focus" and show it all day, clearing at midnight via the existing `cacheKey` date mechanism

---

### 11. Notion integration fails at the API call with no advance warning
**What:** `fetchFromNotion()` makes a direct browser request to `https://api.notion.com` which Notion's CORS policy blocks. The workaround (export as Markdown) is only surfaced after the request fails, buried in an error state.  
**Where:** `index.html:8911–8950`  
**Why it matters:** Every first-time Notion user follows the setup instructions, presses "Pull from Notion", and sees an error. The flow feels broken; the actual workaround is invisible until failure.  
**Effort:** S  
**Suggested fix:**
- Show the export workaround instructions *above* the fetch button as the primary path: "Notion blocks direct browser requests. Export your page as Markdown (··· → Export) and paste below"
- Keep the fetch button as a "try direct API" secondary option, clearly labelled as experimental
- Alternatively, remove the CORS fetch entirely to reduce confusion

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 12. `_autoSnapshot()` swallows all errors with an empty catch
**What:** The Givelink auto-snapshot function wraps its entire body in `try { … } catch(e) {}` — any failure (corrupt data, storage full, JSON error) is silently discarded.  
**Where:** `index.html:8652`  
**Why it matters:** Givelink metrics trend data is the core of the Pace Engine. A silently-failing snapshot means the trend chart shows gaps with no explanation and no way to diagnose the root cause.  
**Effort:** S  
**Suggested fix:**
- Replace empty catch with `catch(e){ console.warn('autoSnapshot failed:', e); }` at minimum
- Consider wrapping in `toast()` if failure persists across multiple days

---

### 13. Three different deep-work duration units in one file
**What:** Deep work `duration` is stored in **seconds** (see `index.html:4635`, named `todaySecs`; `4674` renders `duration/60 + 'm'`). But three independent calculations use it inconsistently: Life Score divides by 60 (line 2184, treats as minutes), Priority Audit divides by 3600 (line 6979, correctly treats as seconds), and old sessions have a `minutes` field as fallback. This confusion will introduce new bugs every time a new feature touches `deepWorkSessions`.  
**Where:** `index.html:2184, 4657, 5072, 6979, 9861`  
**Why it matters:** Unit ambiguity is a silent multiplier for future bugs. Every new feature that reads `duration` will guess and get it wrong half the time.  
**Effort:** S  
**Suggested fix:**
- Add a JSDoc comment at session creation (line 4719): `// duration: number — session length in seconds`
- Fix line 2184 to use `/3600` and handle the legacy `minutes` field: `(s.duration ? s.duration / 3600 : (s.minutes || 0) / 60)`
- Add a one-time migration in `load()` to convert any old sessions with `minutes` → `duration` in seconds

---

### 14. `esc()` utility defined at line 9,768 but called from line ~2,040 onward
**What:** `function esc(s){...}` is declared near the bottom of the script block but used throughout the entire file from almost the very beginning. JavaScript hoists function declarations, so this works today — but if someone ever refactors it to `const esc = s => ...`, all ~200 earlier callsites break silently.  
**Where:** `index.html:9768` (definition); first usage around line 2047  
**Why it matters:** A utility used 200+ times should be defined near the top to be findable and safe to refactor. It's a hidden maintenance trap for any contributor.  
**Effort:** S  
**Suggested fix:**
- Move the `esc()` definition to the top of the `<script>` block, immediately after the constants/state declarations (around line 2035)

---

### 15. `weeklyNotes` sort ignores items where `weekOf` is missing
**What:** `renderWeeklyNotes()` sorts with `b.weekOf?.localeCompare(a.weekOf||'')`. When `weekOf` is `undefined` on any note, the sort comparator returns `undefined`, producing an unstable/browser-dependent order.  
**Where:** `index.html:6330`  
**Why it matters:** Notes with missing dates sort randomly, which means the most-recent note may not appear first. Over time as notes accumulate, the view becomes confusing.  
**Effort:** S  
**Suggested fix:**
- `(a, b) => (b.weekOf || '').localeCompare(a.weekOf || '')`
- Ensure `weekOf` is always populated on creation (check `openAddWeeklyNote()` line 6352 — it correctly sets `weekOf = today`, but old imported data may lack it)

---

## 💡 P3 — Nice to have

### 16. Seeded tasks contain personal Greek-language and private items
**What:** The `seed()` function (called on every new app load) inserts 40+ personal items including Greek text (`"Ενοίκιο με άλλα 2-3 άτομα στην Αθήνα"`), private names (`"Κωνσταντίνος Δημητριάδης"`), and opaque shorthand (`"Maizwnos 22 elta"`, `"Epstein check"`). Any user who opens the app for the first time sees these as their starting tasks.  
**Where:** `index.html:4000–4042`  
**Why it matters:** If the app is ever shared or open-sourced, these items are confusing and potentially embarrassing. They also clutter the initial experience for any user other than the original author.  
**Effort:** S  
**Suggested fix:**
- Move personal seed data behind a `if(profileName==='Panos')` guard, or strip Greek/private items and leave only generic aspirational examples

---

### 17. `givelink.html` uses a different brand accent color from the main app
**What:** `givelink.html` defines `--accent: #3b82f6` (Tailwind blue-500) and its PWA manifest uses `theme-color: #3b82f6`. The main app uses `--accent: #58a6ff`. The two apps look like different products.  
**Where:** `givelink.html` (CSS `:root`); `manifest-givelink.json:10`  
**Why it matters:** The Givelink sprint board and the main Task OS share a navigation shortcut (`Ctrl+2`) and are conceptually one system. Visual brand inconsistency creates cognitive friction when switching.  
**Effort:** S  
**Suggested fix:**
- Either align givelink.html to `#58a6ff` to match the main app, or intentionally define a Givelink-specific palette that contrasts clearly (e.g., Givelink uses the `--brand2: #bc8cff` purple as primary, clearly distinct but harmonious)

---

### 18. Service worker cache name is a hardcoded datestamp
**What:** `sw.js:1` — `const CACHE = 'task-os-20260530'`. Cache invalidation requires manually editing this string on every deployment.  
**Where:** `sw.js:1`  
**Why it matters:** If a deployment goes out without updating the cache name, users get stale HTML/JS for days (until they clear manually). It's an easy step to forget under deployment pressure.  
**Effort:** S  
**Suggested fix:**
- Inject the cache name at deploy time via a simple build step: `sed -i "s/task-os-[0-9]*/task-os-$(date +%Y%m%d)/" sw.js` in the Vercel build command
- Or use a content-hash approach: add a `?v=YYYYMMDD` query to HTML, and the SW will miss the old URL → forces re-fetch without changing the cache name

---

### 19. No `prefers-reduced-motion` guard on confetti/celebration animations
**What:** XP level-up and badge award animations play particle confetti effects with no check for `prefers-reduced-motion: reduce`.  
**Where:** XP/celebration code (search `confetti` or `awardXP` in `index.html`)  
**Why it matters:** Users with vestibular disorders, epilepsy triggers, or motion sensitivity have explicitly opted out of animations at the OS level. Ignoring this preference can cause discomfort or health issues.  
**Effort:** S  
**Suggested fix:**
- Wrap all confetti/particle animation calls: `if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { startConfetti(); }`

---

### 20. `S.habits` accessed with both string-key and object-property patterns — fragile model
**What:** `S.habits` is an array of strings throughout 95% of the codebase, but two locations (`calcLifeScore()` at line 2176 and security audit at line 11605) treat each element as an object with `.id`/`.name` properties. This inconsistency means any future attempt to migrate habits to objects (e.g., to add color, frequency, or linked goals) will silently break the string-based code.  
**Where:** `index.html:2176, 11605` (object access); lines `3552, 4742, 4798–4807, 4809, 8702, 9622` (string access)  
**Why it matters:** The habit data model is currently a hidden landmine. One migration or third-party import that switches to objects breaks streak tracking, the Life Score, and the EOD ritual.  
**Effort:** M  
**Suggested fix:**
- Fix the two stale object-access sites (see P0 #1 and P1 #9 above for specifics)
- Add a comment at `S.habits` declaration in the state object: `// habits: string[] — plain habit names, used as keys in habitLogs`
- If objects are ever needed, do a single migration: `S.habits = S.habits.map(h => typeof h === 'string' ? {id: h, name: h} : h)` with corresponding habitLogs key migration

---

*Total: 5 P0 · 6 P1 · 4 P2 · 5 P3*
