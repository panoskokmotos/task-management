# Givelink / Task OS — Improvement Plan
_Generated 2026-05-22_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. Silent data loss when editing a task whose ID is stale
**What:** `findIndex` returns `-1` when a task ID is not found; `S.tasks[-1] = …` silently creates a non-enumerable property on the array, so the entire edit is discarded with no error.
**Where:** `givelink.html:728`, `index.html:2553`
**Why it matters:** Any race condition (two tabs open, a fast delete-then-edit) causes edits to vanish. User sees no feedback and the data is gone.
**Effort:** S
**Suggested fix:**
- Add a guard before the assignment: `if(i >= 0) S.tasks[i] = {...S.tasks[i], ...d};`
- Add an `else` branch: `else toast('Task no longer exists — it may have been deleted.');`
- Apply the same fix to both files.

---

### 2. localStorage calls without try-catch crash in Firefox private browsing
**What:** Several direct `localStorage.getItem/setItem` calls in `givelink.html` have no try-catch wrapper, causing an uncaught `SecurityError` in Firefox private mode or a `QuotaExceededError` when storage is full — the whole JS event handler aborts.
**Where:** `givelink.html:1085`, `:1257`, `:1672`, `:1677`, `:1682`, `:1702`
**Why it matters:** A user opening the app in private browsing (common on shared devices or for privacy) sees a blank/broken app with no explanation. The main `save()` in `index.html` already wraps localStorage correctly (line 1811) — `givelink.html` just never got the same treatment.
**Effort:** S
**Suggested fix:**
- Wrap each call in a `try/catch(e){}` block — or create a tiny `lsGet(key, fallback)` / `lsSet(key, val)` helper at the top of the file.
- For set failures: show a `toast('Storage is full — some data may not save.')`.
- Test in Firefox private browsing before shipping.

---

### 3. Anthropic API response accessed unsafely in Givelink AI planner
**What:** `const raw = data.content[0].text.trim()` throws a `TypeError` if the API returns an unexpected shape (rate-limit error, streaming chunk, empty response). There is no optional chaining.
**Where:** `givelink.html:1147`
**Why it matters:** The AI Sprint Planner is one of Givelink's headline features. A single unexpected API response silently crashes the AI planning flow — the spinner disappears and nothing happens, with no user message.
**Effort:** S
**Suggested fix:**
- Replace with: `const raw = data?.content?.[0]?.text?.trim();`
- Add a guard: `if (!raw) { el.innerHTML = '<div …>No response from AI. Try again.</div>'; btn.disabled=false; return; }`
- Compare against `givelink.html:1269` which already does this correctly with optional chaining.

---

### 4. `updIBadge()` crashes when its DOM element is absent
**What:** `const b = document.getElementById('ib'); b.innerHTML = …` — no null check. If the inbox badge element doesn't exist in the current rendered view, this throws and halts downstream JS execution.
**Where:** `index.html:2794`
**Why it matters:** `updIBadge()` is called from several paths including `delTask()` and `toggleDone()`. A crash here means task deletion or completion can fail silently mid-function.
**Effort:** S
**Suggested fix:**
- Change to: `if (b) b.innerHTML = …`
- Audit other `getElementById()` returns used without null checks in the same file (lines 2827, 2845 are next in line).

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. Givelink's entire UI renders in blue instead of the brand's purple
**What:** The CSS root (`--accent: #3b82f6`), the `<meta name="theme-color">`, and `manifest-givelink.json` all declare blue as the primary brand color. Every button, active link, logo, and sprint card uses it. The stated brand palette is purple (`#6B3FA0` / `#5718CA`).
**Where:** `givelink.html:6` (meta), `givelink.html:17` (CSS root), `manifest-givelink.json:8`
**Why it matters:** Givelink is meant to be a distinct product from Task OS. Currently both apps look nearly identical. Correct brand color instantly differentiates the product, reinforces identity, and costs one line per file.
**Effort:** S
**Suggested fix:**
- Change `--accent` in `givelink.html` `:root` to `#6B3FA0` (or `#5718CA` for the darker variant).
- Update `<meta name="theme-color" content="#6B3FA0">` in `givelink.html:6`.
- Update `"theme_color": "#6B3FA0"` in `manifest-givelink.json:8`.
- Verify pink (`--pr: #f472b6`) isn't used on purple backgrounds (check `.sprint-name`, `.ni.active`).

---

### 6. Hardcoded model names will silently break when Anthropic retires them
**What:** `'claude-opus-4-5'` and `'claude-haiku-4-5-20251001'` are hardcoded in two places. When Anthropic retires these model IDs (as it does periodically), every AI call returns a 404 with no user-visible error, breaking sprint planning, standup generation, and outreach copy.
**Where:** `givelink.html:1140` (Opus), `givelink.html:1256` (Haiku), `givelink.html:1660` (Haiku)
**Why it matters:** Users discover the AI features are broken only after trying them — not from a config warning. The fix surface is three lines, but the discovery cost is high.
**Effort:** S
**Suggested fix:**
- Define constants at the top of the script: `const MODEL_PLANNING = 'claude-opus-4-7'; const MODEL_FAST = 'claude-haiku-4-5-20251001';`
- Replace all hardcoded strings with these constants.
- Consider making `MODEL_PLANNING` user-configurable in the API key settings panel alongside the key.

---

### 7. AI error messages give users no actionable guidance
**What:** All three AI flows in Givelink collapse to the same generic message — `"Could not generate. Check your API key."` — whether the failure was a wrong key, a network timeout, a rate limit, or an API structure change.
**Where:** `givelink.html:1158`, `:1514`, `:1666`
**Why it matters:** A user who just entered their key correctly gets told to "check their API key" and has nowhere to go. Distinguishing 401 (bad key), 429 (rate limit), and network errors takes three extra lines and cuts support confusion.
**Effort:** S
**Suggested fix:**
- After `const res = await fetch(…)`, check `res.status`:
  - `401` → `'Invalid API key — paste a fresh key in Settings.'`
  - `429` → `'Rate limit hit — wait 30 seconds and try again.'`
  - Other non-2xx → `` `AI error ${res.status}: ${res.statusText}` ``
- Wrap `data.content[0]` access (see P0 item 3) for structural failures.

---

### 8. No retry mechanism after a failed AI request
**What:** When any AI call fails, the button re-enables but there is no "Try again" affordance in the error state itself. The user must remember to click the button again, which is non-obvious when the error appears inside a results container.
**Where:** `givelink.html:1158` (sprint planner result div), `index.html` AI panels broadly
**Why it matters:** Users who hit a transient error (network glitch, Anthropic hiccup) often abandon the feature entirely rather than retry — a missed engagement moment for the app's primary value-add.
**Effort:** S
**Suggested fix:**
- In each error HTML block, append a retry button: `<button onclick="runAiSprintPlanner()">↺ Try again</button>`
- Reuse the same pattern across all three AI flows in `givelink.html`.

---

### 9. Icon-only buttons lack accessible labels in both apps
**What:** The FAB "+" button in `givelink.html` and multiple icon-only buttons in `index.html` (checklist, reminder, and action buttons around lines 449–458) have no `aria-label`. Screen readers announce them as "button" with no context.
**Where:** `givelink.html:303`, `index.html:449`–`458`
**Why it matters:** Users relying on assistive technology cannot discover or activate these primary CTAs. Also affects voice control users (Dragon NaturallySpeaking, etc.).
**Effort:** S
**Suggested fix:**
- Add `aria-label="Add task"` to the FAB in `givelink.html:303`.
- Add descriptive `aria-label` attributes to each icon button in `index.html:449`–`458` (e.g., `"Open checklist"`, `"Set reminder"`, `"Add to today"`).
- Run a quick pass with the axe DevTools browser extension to catch any remaining missing labels.

---

### 10. Duplicate task suggestions in Givelink don't check against existing tasks
**What:** The AI sprint planner's "Add Suggested Tasks" path (`givelink.html:1192`) pushes tasks straight into `S.tasks` with no deduplication check against tasks already in the current sprint.
**Where:** `givelink.html:1192`
**Why it matters:** A user who runs the planner twice (or reloads and runs again) accumulates duplicate tasks in their sprint, inflating velocity metrics and cluttering the board.
**Effort:** S
**Suggested fix:**
- Before pushing each suggestion, check: `if (!S.tasks.some(t => t.title.toLowerCase() === task.title.toLowerCase())) S.tasks.push(task);`
- Show a toast summarizing how many were added vs. already present.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. Two modal-close functions with divergent behaviour — codebase comment even flags it
**What:** `closeM(id)` (line 2786) releases focus trap and clears `editT/editG` state; `closeModal(id)` (line 8825) only hides the element. The comment at line 8824 explicitly reads: `"some modals use closeModal, some closeM — unify"`. Modals closed via `closeModal` never clear edit state, leaving stale references.
**Where:** `index.html:2786`, `index.html:8824`–`8825`
**Why it matters:** If a "Win" or "Wishlist" modal is dismissed while `editT` is set (e.g., opened from a task context), `editT` stays dirty and the next task edit could save to the wrong record.
**Effort:** M
**Suggested fix:**
- Merge into a single `closeModal(id)` that does what `closeM` does: release focus, hide, and clear `editT/editG`.
- Find all `closeModal(...)` call sites (lines 8418, 8511, 8616, 8714, 8817) and verify none need the old minimal behaviour.
- Delete the old `closeM` and the explaining comment.

---

### 12. Empty catch blocks silently swallow parse errors
**What:** Two `catch(e){}` blocks in `givelink.html` suppress errors entirely — one when reading `taskos_profiles`, one when reading Task OS data. If the JSON is corrupted, the app silently proceeds with stale/empty state.
**Where:** `givelink.html:1083`, `givelink.html:1259`
**Why it matters:** When a bug corrupts a localStorage value, these silent catches make the symptom ("Givelink shows no tasks") untraceable — the real parse error is never visible.
**Effort:** S
**Suggested fix:**
- Replace each empty catch with at minimum: `catch(e){ console.warn('Failed to parse storage key:', e); }`
- For user-facing recovery, show a banner: `"Sprint data could not be loaded. Last good backup was X."` if data is available.

---

### 13. Off-brand hardcoded hex colors scattered across index.html
**What:** `#ef4444` (red), `#fbbf24` (amber), `#22c55e` (green), `#38bdf8` (cyan), `#f97316` (orange) appear as inline style values throughout `index.html` — outside the CSS variable system and outside the brand palette.
**Where:** `index.html:305`, `:450`, `:2103`–`2104`, `:5071`, `:7343`, `:8431`
**Why it matters:** Theming, dark/light mode, and a future rebrand all require hunting down every hardcoded value. Colors like `#ef4444` on a purple/pink brand background also create unintended combinations (e.g., red badge on purple sidebar).
**Effort:** M
**Suggested fix:**
- Add semantic CSS variables to `:root`: `--color-danger: #ef4444; --color-warning: #fbbf24; --color-success: #22c55e;`
- Replace hardcoded hex values with these variables.
- Review any location where pink appears against purple (search for `var(--pr)` within containers that use `var(--accent)` as background).

---

### 14. `callClaude()` in index.html has no request deduplication
**What:** `callClaude()` (line 3407) uses `_aiLock()` to prevent concurrent calls on the same button, but multiple distinct AI-enabled buttons can fire simultaneous requests. If a re-render fires while a request is in-flight, the same prompt can be sent twice.
**Where:** `index.html:3407`–`3420`
**Why it matters:** Wasted API spend for the user, and race conditions where two responses arrive and the later one overwrites UI state unexpectedly.
**Effort:** M
**Suggested fix:**
- Keep a module-level `AbortController` reference; abort the previous request when a new one starts: `_currentAiController?.abort(); _currentAiController = new AbortController();`
- Pass `signal: _currentAiController.signal` to `fetch()`.
- Add `catch(e){ if(e.name==='AbortError') return; … }` to suppress abort noise.

---

### 15. API keys stored in plain localStorage with no scoping or expiry
**What:** Claude, Readwise, and Notion API keys are written to `localStorage` as plain strings under predictable keys (`taskos_api_key`, `taskos_readwise_key`, etc.). They persist indefinitely and are readable by any JS on the same origin.
**Where:** `index.html:6968`–`6993`, `givelink.html:1085`
**Why it matters:** If the app ever gains a XSS vector (even a temporary one), all stored API keys are immediately exfiltrated. The header `anthropic-dangerous-direct-browser-access: true` acknowledges the risk but localStorage makes it worse than necessary.
**Effort:** L
**Suggested fix:**
- Short-term: add a visible warning in the Settings panel: `"Your key is stored locally in this browser only. Clear it when using a shared device."`
- Medium-term: use `sessionStorage` for the Claude key so it expires when the tab closes.
- Long-term: proxy calls through a lightweight edge function so the key never lives client-side.

---

## 💡 P3 — Nice to have

---

### 16. Service worker returns empty 503 instead of an offline page
**What:** `sw.js:91` returns `new Response('', { status: 503 })` for failed network requests. Users who open the app offline see a blank white screen with no explanation.
**Where:** `sw.js:91`
**Why it matters:** PWA install rate and retention drop sharply when offline experience is confusing. A simple offline page (even a static HTML string in the SW) keeps users oriented.
**Effort:** S
**Suggested fix:**
- Pre-cache a minimal `offline.html` in the SW install event.
- Return it from the catch: `return caches.match('offline.html') || new Response('<h1>You're offline</h1>', {headers:{'Content-Type':'text/html'}});`

---

### 17. Focus trap not applied to all modals in index.html
**What:** `_trapFocus()` is implemented and used for some modals (lines 2779–2782) but not all — notably the Win, Wishlist, Bucket List, and Project modals that use `closeModal()`. Tab key can escape these modals into the background document.
**Where:** `index.html:2779`–`2782`, modals at `:943`, `:970`, `:1005`, `:1043`
**Why it matters:** Keyboard-only users can accidentally interact with content behind an open modal, causing unintended actions.
**Effort:** M
**Suggested fix:**
- After consolidating `closeM`/`closeModal` (P2 item 11), call `_trapFocus()` inside the unified open function.
- Test with keyboard-only navigation on all modal types.

---

### 18. Givelink sprint overview shows blank stats with no "no tasks" guidance
**What:** When a sprint has zero tasks, the sprint overview panel renders empty stat cards (0/0 velocity, blank burndown) with no message prompting the user to add their first task.
**Where:** `givelink.html` sprint overview render path (~line 540–600)
**Why it matters:** First-time users land on an empty dashboard with no call to action, which increases bounce rate at the exact moment when habit formation matters most.
**Effort:** S
**Suggested fix:**
- After rendering stats, check `if (sprintTasks.length === 0)` and append: `<div class="empty-state"><p>No tasks in this sprint yet.</p><button onclick="openTM()">+ Add your first task</button></div>`

---

### 19. No shared API key storage between Task OS and Givelink
**What:** `index.html` stores the Claude key under `S.claudeKey` (saved as `taskos` JSON), while `givelink.html` reads `localStorage.getItem('taskos_api_key')` directly. Users must enter their API key in both apps separately.
**Where:** `index.html` settings panel (~line 6968), `givelink.html:1085`
**Why it matters:** Minor friction that erodes the feeling of a unified product, especially for new users setting up both apps.
**Effort:** S
**Suggested fix:**
- In `givelink.html:1085`, first try reading from the Task OS store: `JSON.parse(localStorage.getItem('taskos')||'{}').claudeKey`
- Fall back to `localStorage.getItem('taskos_api_key')` for backwards compatibility.
- No changes needed to `index.html`.

---

### 20. `unsafe-inline` in CSP limits future security hardening
**What:** `vercel.json` sets `script-src 'self' 'unsafe-inline'` to support the inline `onclick="…"` handlers throughout both HTML files. This permanently blocks adopting a strict CSP nonce/hash approach.
**Where:** `vercel.json:14`
**Why it matters:** Not an active vulnerability today (no user-injectable HTML), but it means any future XSS vector immediately grants full script execution. Removing `unsafe-inline` would require refactoring all inline event handlers — that work should be planned before the codebase grows further.
**Effort:** L
**Suggested fix:**
- No immediate action required — note this in tech debt backlog.
- When a refactor opportunity arises (e.g., a component extraction sprint), migrate inline handlers to `addEventListener` calls and switch to a CSP nonce.
- Alternatively, use `strict-dynamic` with a deploy-time nonce via a Vercel edge function.
