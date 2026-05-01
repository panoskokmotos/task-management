# Givelink + Task OS — Improvement Plan

> Scanned: `index.html` (4 583 lines), `givelink.html` (2 241 lines), `sw.js` (82 lines), `vercel.json`.
> Items are ordered by ROI within each tier. Max 20 total.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Stored XSS — task titles rendered unescaped in `index.html`

**What:** `index.html` has no `esc()` helper, so every `innerHTML` template that interpolates user data (titles, notes, names) is a stored XSS vector.

**Where:** `index.html:1264, 1295, 1332, 1435, 1453, 1460, 1524, 1751, 1774` (and more) — all use `${t.title}` / `${t.notes}` directly in template-literal HTML. `givelink.html:607` has `esc()` defined; `index.html` does not.

**Why it matters:** A task title containing `<img src=x onerror="...">` executes on every render. Because titles come from user input and are persisted in `localStorage`, this is stored XSS — it fires on every page load, not just on entry.

**Effort:** S

**Suggested fix:**
- Copy the `esc()` definition from `givelink.html:607` into `index.html` (just above `uid()`).
- Wrap every `${t.title}`, `${t.notes}`, `${g.title}`, `${profileName}` etc. in template literals with `${esc(t.title)}`.
- Search for the pattern: `grep -n '${t\.' index.html | grep -v 'esc('` to find remaining instances.

---

### 2. App crash on corrupted `localStorage` — `JSON.parse` without `try/catch` in both `load()` functions

**What:** Both `load()` functions call `JSON.parse` on raw `localStorage` content with no error handling; a corrupted value (partial write, manual edit, storage quota error) throws an uncaught exception that prevents the entire app from initialising.

**Where:** `index.html:1198` — `S={...S,...JSON.parse(d)}` · `givelink.html:604` — `const p=JSON.parse(d);S={...S,...p}`

**Why it matters:** The app renders a blank white screen with no message. The user has no way to recover except clearing storage manually via DevTools — they will assume the app is broken.

**Effort:** S

**Suggested fix:**
- Wrap both `load()` bodies in `try { ... } catch(e) { console.warn('Corrupt state, starting fresh', e); }`.
- Consider showing a `toast('⚠️ Data could not be loaded — starting fresh.')` so the user is aware.
- Same pattern needed for `index.html:1509` (`JSON.parse(localStorage.getItem('taskos_history')||'[]')`).

---

### 3. `findIndex` result not checked — silent data corruption on task/goal save

**What:** `saveTask()` and `saveGoal()` call `findIndex` and immediately use the result as an array index without checking for `-1`.

**Where:** `index.html:1581` — `const i=S.tasks.findIndex(...); S.tasks[i]={...S.tasks[i],...d}` · `index.html:1654` — same pattern for goals.

**Why it matters:** If the modal's `editT`/`editG` ID becomes stale (task deleted from another tab, data import while modal is open), `findIndex` returns `-1`. `S.tasks[-1]` silently assigns a non-integer property on the array — the edit appears to succeed but the data is not actually updated, and the array is subtly corrupted.

**Effort:** S

**Suggested fix:**
- Add a guard: `if(i<0){toast('❌ Task not found — it may have been deleted.');return;}` before the assignment.
- Same fix for the goals path at line 1654.
- The relationship code at `index.html:2525` already does this correctly (`if(i>=0)`) — use that as the pattern.

---

### 4. `callClaude()` silently swallows API errors — AI features fail without feedback

**What:** The central `callClaude()` in `index.html` never checks `res.ok`, so 401 / 429 / 500 responses are parsed as JSON, `data.content` is undefined, and the function returns `null` — callers silently get no output with no toast or error.

**Where:** `index.html:2288–2295`

```js
const res = await fetch('https://api.anthropic.com/v1/messages', {...});
const data = await res.json();          // ← no res.ok check
return data.content?.[0]?.text || null; // ← null on any API error
```

**Why it matters:** An invalid or rate-limited API key causes every AI feature to silently do nothing. Users don't know if they clicked the button, if there's a bug, or if their key is bad — they just see nothing happen.

**Effort:** S

**Suggested fix:**
- Add `if(!res.ok){ const err=await res.json().catch(()=>{}); throw new Error(err?.error?.message||'API error '+res.status); }` after line 2292.
- The Givelink fetch functions (`givelink.html:1754`, `1845`) already do this correctly — use the same pattern.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. `alert()` and `confirm()` break PWA flows — 8 call sites

**What:** Native `alert()` (form validation) and `confirm()` (destructive actions) are used throughout both apps.

**Where:** `alert()` at `index.html:1579, 1603, 1645`. `confirm()` at `index.html:553, 829, 1586, 1659, 2530, 3300, 4234` and `givelink.html:1162`.

**Why it matters:** iOS Safari in standalone/PWA mode silently suppresses `confirm()` dialogs — delete confirmations return `true` immediately, making data deletion irreversible with no user consent. `alert()` also freezes the JS thread and can't be styled.

**Effort:** M

**Suggested fix:**
- Replace `alert('msg')` with `toast('⚠️ msg')` for validation messages.
- Replace `confirm('Delete?')` with a small inline confirmation pattern — e.g. a "Really delete?" tooltip/mini-modal or a second button click within 3 s.
- For the data-reset at `index.html:829`, this is highest risk — wrap in a proper modal with an input that forces typing "RESET".

---

### 6. AI Sprint Planner silently uses `claude-opus-4-5` — 10× token cost vs. other features

**What:** The AI Sprint Planner in Givelink uses `claude-opus-4-5` while all other AI calls across both apps use `claude-haiku-4-5-20251001`. There is no UI hint about model or cost.

**Where:** `givelink.html:1749` (Sprint Planner generate) · `givelink.html:1843` (goal breakdown) — both hardcoded to `claude-opus-4-5`.

**Why it matters:** Users with pay-per-token API keys will burn through credits much faster on sprint planning without realising it. Opus is ~15× more expensive than Haiku per token.

**Effort:** S

**Suggested fix:**
- Align all AI calls to `claude-haiku-4-5-20251001` unless quality testing shows Haiku is genuinely insufficient for these prompts.
- If Opus is intentionally kept for quality, add a tooltip on the "Generate" button: `title="Uses Claude Opus (higher quality, ~15× cost)"`.
- Define `const AI_MODEL = 'claude-haiku-4-5-20251001'` at the top of each file and reference it in all `fetch` calls.

---

### 7. No loading state on most `callClaude()` callers in `index.html` — double-fire risk

**What:** The shared `callClaude()` function has no built-in loading guard. Most callers in `index.html` do not disable their button before calling it, so rapid double-clicks fire concurrent requests.

**Where:** `index.html:2285–2296` — `callClaude()` definition. Callers at `index.html:2882, 4061, 4154` correctly set `btn.disabled=true`, but many others (e.g. Weekly Digest, Anti-Pattern, EOD Ritual) call `callClaude()` without any loading state.

**Why it matters:** Concurrent duplicate requests waste API tokens and can produce race conditions where the second response overwrites the first mid-render.

**Effort:** S

**Suggested fix:**
- Add a module-level lock: `let _aiPending=false;` and guard at the top of `callClaude()`:
  ```js
  if(_aiPending) return null;
  _aiPending = true;
  try { ... } finally { _aiPending = false; }
  ```
- Show a generic loading indicator (e.g. append `⏳` to the button that triggered the call) by passing the button element as an optional second argument.

---

### 8. Zero modal accessibility — no focus trap, no Escape handler in `givelink.html`, no ARIA roles

**What:** Neither app uses `role="dialog"`, `aria-modal`, or `aria-labelledby` on modals. `givelink.html` has no `keydown` handler for Escape at all. Focus is not moved to the modal on open or restored to the trigger on close.

**Where:** Modal CSS at `index.html:94–99`, `givelink.html:123–128`. `givelink.html` has no `document.addEventListener('keydown',...)` at all.

**Why it matters:** Keyboard-only and screen-reader users cannot dismiss modals. The Escape key doing nothing in Givelink is a common user expectation that isn't met.

**Effort:** M

**Suggested fix:**
- Add `role="dialog" aria-modal="true" aria-labelledby="<modal-title-id>"` to each `.md` element.
- Add a single `document.addEventListener('keydown', e=>{ if(e.key==='Escape') document.querySelectorAll('.mo:not(.hidden)').forEach(m=>m.classList.add('hidden')); });` in `givelink.html`.
- On `openM(id)`, move focus to the first focusable element inside the modal: `setTimeout(()=>el.querySelector('input,button,textarea')?.focus(), 50)`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. `toast()` uses `innerHTML` — latent XSS vector

**What:** `givelink.html`'s `toast()` sets `t.innerHTML=msg`, meaning any HTML in the message string is rendered. All current callers pass safe strings, but one future call with a user value would be XSS.

**Where:** `givelink.html:608` — `t.innerHTML=msg`

**Why it matters:** Low risk today, guaranteed problem as more callers are added. Already a pattern mismatch with the rest of the codebase.

**Effort:** S

**Suggested fix:**
- Change to `t.textContent=msg` for plain-text toasts.
- If emoji or bold is needed, use a safe allowlist: pass an object `{text, icon}` and construct it with `textContent`.

---

### 10. `uid()` and `fd()` duplicated across both files

**What:** Identical implementations of `uid()` and `fd()` are defined in both `index.html` and `givelink.html`. Any bug fix or improvement must be made twice.

**Where:** `index.html:1201,1203` · `givelink.html:609,612`

**Why it matters:** Already drifted slightly (`esc()` exists only in `givelink.html`). Will continue to diverge as features are added.

**Effort:** S

**Suggested fix:**
- Extract shared utilities into a `utils.js` file and include it with `<script src="utils.js">` in both HTML files. Functions to extract: `uid()`, `fd()`, `esc()`, `toast()` (unified version).
- Alternatively, since both apps are single-file, a `<!-- shared utils -->` comment block at the top of each that's kept in sync via a short note is acceptable as a lower-effort step.

---

### 11. Six hardcoded model name strings — model update requires touching 6 lines

**What:** The Claude model ID is hardcoded as a string literal in 6 separate `fetch` calls across both files, with two different values in use.

**Where:** `claude-haiku-4-5-20251001` at `givelink.html:2185, 2214` · `index.html:2291, 4214`. `claude-opus-4-5` at `givelink.html:1749, 1843`.

**Why it matters:** When models are updated (e.g. `claude-haiku-4-5-20251001` → next generation), each file must be manually grepped and every string updated. Easy to miss one.

**Effort:** S

**Suggested fix:**
- Define constants at the top of each `<script>`: `const MODEL_FAST='claude-haiku-4-5-20251001';` and `const MODEL_POWERFUL='claude-opus-4-5';`.
- Replace all inline model strings with these constants.

---

### 12. Service worker cache key is a manually maintained timestamp — stale cache on deploys

**What:** The SW cache key `'task-os-20260413-174350'` must be manually bumped on every deploy, or users receive cached HTML indefinitely despite `must-revalidate` headers.

**Where:** `sw.js:1`

**Why it matters:** If a developer forgets to update the cache key after deploying a fix, users may run the old buggy version for days until they hard-refresh.

**Effort:** S

**Suggested fix:**
- Replace the manual timestamp with a build-injected value. For this no-build-step project, the simplest approach: append the SW version to the HTML's `<link rel="manifest">` via a query string (`?v=YYYYMMDD`), and auto-derive the cache key from `Date.now()` at SW install time (acceptable for this caching strategy since the SW always network-firsts HTML).
- Alternatively, set up a one-line deploy script: `sed -i "s/task-os-.*/task-os-$(date +%Y%m%d-%H%M%S)';/" sw.js` in a Vercel build hook.

---

### 13. `confirm()` on destructive actions fails silently on iOS PWA — data loss risk

**What:** (Noted in P1 #5 for UX reasons.) Specifically, the "Reset ALL task data" action at `index.html:829` uses an inline `confirm()` inside an `onclick` attribute — if suppressed by iOS, it immediately wipes all data.

**Where:** `index.html:829` — `onclick="if(confirm('Reset ALL task data? Cannot be undone.')){localStorage.removeItem('taskos');location.reload();}"` 

**Why it matters:** This is the highest-severity confirm() case — it's the only irreversible, total-data-loss action in the app. Accidental trigger = complete data loss with no backup prompt.

**Effort:** S

**Suggested fix:**
- Replace with a dedicated modal that requires the user to type "RESET" in an input field before the button activates, matching the pattern used by services like GitHub for destructive operations.

---

### 14. CSS variable naming inconsistency between the two apps

**What:** `index.html` uses `--surface`, `--surface2`, `--bg`; `givelink.html` uses `--sf`, `--s2`, `--bg`. The same visual concepts have different names.

**Where:** `index.html:16–21` CSS `:root` block · `givelink.html:15–20` CSS `:root` block

**Why it matters:** Copying a component from one app to the other requires manually renaming all variables. Already caused the `--sb` class collision (`.sb` means Sidebar in Givelink but Search Box in Task OS).

**Effort:** M

**Suggested fix:**
- Standardise on `--bg`, `--surface`, `--surface2`, `--border` across both files. Update `givelink.html` to use the full names. A simple find-replace: `--sf` → `--surface`, `--s2` → `--surface2`.

---

## 💡 P3 — Nice to have

### 15. Brand palette mismatch — Givelink uses Tailwind colors, not the brand spec

**What:** Givelink's CSS palette is Tailwind-derived (`--accent:#3b82f6`, `--op:#a78bfa`, `--pr:#f472b6`) rather than the brand palette (`#6B3FA0`/`#5718CA` purple, `#C2185B`/`#E353B6` pink).

**Where:** `givelink.html:16–20` CSS `:root`

**Why it matters:** The two apps look like they belong to different products. Givelink's blue accent diverges from Task OS's also-blue accent but with a different hue (`#3b82f6` vs `#58a6ff`), making side-by-side screenshots inconsistent.

**Effort:** M

**Suggested fix:**
- Align Givelink's `--accent` to `#5718CA` (brand purple) and update `--op` to `#6B3FA0`.
- Audit which text-on-background combinations use `--pr` (pink) on `--op` (purple) backgrounds and check contrast — the no-pink-on-purple rule applies here. Use `tinycolor2` or the WebAIM contrast checker.

---

### 16. `profileName` written to `document.title` without sanitisation

**What:** `document.title='Task OS — '+profileName` where `profileName` is read directly from `localStorage` with no escaping.

**Where:** `index.html:4258`

**Why it matters:** `document.title` is not a vector for script execution, but a crafted value like `profileName = "'; alert(1); //"` would produce a confusing title. Consistent use of sanitisation builds good habits and prevents future issues if this value is ever used in a more sensitive context.

**Effort:** S

**Suggested fix:**
- `document.title='Task OS — '+profileName.replace(/[<>'"]/g,'')` or simply truncate to 30 chars: `profileName.slice(0,30)`.

---

### 17. Inline `onclick` `confirm()` in settings panel is untestable

**What:** Two destructive actions in Settings are implemented as inline `onclick` attributes containing `confirm()` calls, making them impossible to unit-test and hard to modify.

**Where:** `index.html:553` (Clear review history) · `index.html:829` (Reset all data — also P2 #13)

**Why it matters:** Adding a confirmation modal, analytics event, or backup-before-delete step requires restructuring the inline handler. Low urgency but compounds over time.

**Effort:** S

**Suggested fix:**
- Extract to named functions `clearHistory()` and `resetAllData()` that implement proper confirmation modals.

---

### 18. No offline fallback page for service worker

**What:** The service worker's fetch handler returns a bare `503` response for failed external requests (`sw.js:64`) but has no fallback for failed HTML page loads when offline.

**Where:** `sw.js:50–59` — the HTML network-first branch calls `catch(() => caches.match(e.request))` but if the cached version is also missing (first install, cache miss), the result is `undefined`, which the browser treats as a network error.

**Why it matters:** A user who installs the PWA and opens it without internet gets a generic browser error page rather than the cached version they previously loaded.

**Effort:** S

**Suggested fix:**
- Ensure both `index.html` and `givelink.html` are always added to the install cache (they are in `HTML` array at line 8–12 — verify this precache succeeds by checking the install event's `waitUntil` for errors).
- Add a minimal `offline.html` fallback: `catch(() => caches.match(e.request) || caches.match('./index.html'))`.
