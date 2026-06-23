# Givelink / Task OS — Improvement Plan
_Generated 2026-06-23. Codebase: `index.html` (12,893 lines), `givelink.html` (1,755 lines), `sw.js` (109 lines). Vanilla JS, no build step, localStorage-first + optional Supabase sync._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Silent total data loss on corrupt localStorage
**What**: `load()` catches a JSON parse error and silently falls back to factory defaults — wiping every task, goal, habit, and review the user has ever created.
**Where**: `index.html:2107` — `catch(e){console.warn('Corrupt localStorage, using defaults',e);}`
**Why it matters**: Any mid-write browser crash, storage migration, or browser bug produces an unreadable JSON blob. The user opens the app to find it completely empty with no explanation. There is no recovery path.
**Effort**: S
**Suggested fix**:
- Before discarding, stash the raw corrupted string: `localStorage.setItem('taskos_corrupt_backup', d)`
- Show a prominent error toast: "⚠️ Your saved data couldn't be read. Tap here to export a rescue copy." with a button that downloads `taskos_corrupt_backup`
- Optionally maintain a rolling 2-version ring buffer (`taskos_prev`) written on each successful save, so one good state is always recoverable

---

### 2. `givelink.html` Sprint Board is a completely separate data store
**What**: The "Switch to Givelink Sprint Board" sidebar link opens `givelink.html`, which saves its state to `givelink_sprint` localStorage key — entirely separate from the `taskos` key used by the main app. Tasks created or completed in one app are invisible to the other.
**Where**: `index.html:533` (the link), `givelink.html:447–448` (its own `save()`/`load()` functions)
**Why it matters**: Users who work in both views will double-enter tasks, see stale data, and lose confidence in the system. A task marked done in Sprint Board stays "open" in Task OS and vice versa. This actively undermines the productivity system.
**Effort**: M
**Suggested fix**:
- Make `givelink.html` read and write from the shared `taskos` localStorage key, filtered to `category === 'givelink'` tasks
- Or replace the separate Sprint Board with a dedicated "Givelink Sprint" view inside `index.html` (already has a `givelink-dash` view at line 7443 — the Sprint Board is redundant)
- As an interim: add a warning banner on `givelink.html` that reads "Changes here are not synced to Task OS" until fixed

---

### 3. XSS via unescaped user content injected into innerHTML
**What**: `t.title` and `g.title` are inserted directly into `innerHTML` template literals throughout the app. An `esc()` helper exists at line 9773 but is inconsistently applied — used in some places, skipped in most.
**Where**:
- `index.html:3006` — `tcHTML()` → `` `<div class="tt">${t.title}` `` (renders every task in the app)
- `index.html:2694` — `inboxHTML()` → `` `<div class="tt">${t.title}` ``
- `index.html:2888, 2895, 2897` — all three weekly review wizard steps render `${t.title}` and `${g.title}` raw
- `index.html:2813, 2864` — goals view renders `${g.title}` raw
- `index.html:2630` — dashboard Top 3 widget renders `${t.title}` raw
- `index.html:3014` — linked goal sub-line: `${gl.title.slice(0,20)}`
- `index.html:3131` — delete undo toast: `<strong>${t.title.slice(0,30)}</strong>` (toast uses `innerHTML`)

**Why it matters**: Self-XSS today; an active attack vector if the app ever adds import-from-URL, shared backups, or multi-user features. A task title like `<img src=x onerror="fetch('…'+localStorage.getItem('taskos'))">` executes silently. It also means any user testing with `<b>bold test</b>` in a title sees broken UI.
**Effort**: S
**Suggested fix**:
- Run `grep -n '\${t\.title}' index.html | grep -v 'esc('` and wrap every hit with `${esc(t.title)}`
- Same for `g.title`, `p.name`, `b.title`, `h.name`
- Add a comment above `tcHTML()` and `inboxHTML()`: `// Always use esc() for user-provided strings in innerHTML`
- Consider moving `esc()` from line 9773 to line ~2253 (with the other utilities) so it's defined near its heaviest callers

---

### 4. Givelink dashboard shows MRR/ARR in € but impact model uses $
**What**: The metrics stats cards display MRR and ARR with a `€` prefix, but the 1M People Impact Model input labels say "Avg donation size ($)" — two different currencies in the same screen.
**Where**: `index.html:7466` (`€${m.mrr}`) and `index.html:7470` (`€${m.arr}`); `index.html:7526` (`Avg donation size ($)`)
**Why it matters**: The "people impacted" calculation on line 7506 divides total donations by 50 (`totalDonations/50`). If MRR is in € but the model thinks in $, the projected impact figure is wrong by the EUR/USD spread. Business decisions — how many nonprofits to onboard, when to hit 1M people — are based on a miscalculated number.
**Effort**: S
**Suggested fix**:
- Standardise on € throughout: change the line 7526 label from `($)` to `(€)`
- Update the `calcImpactModel()` divisor comment to reflect the currency
- Or add a single `currency` field to `S.givelinkMetrics` and render the symbol dynamically

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Weekly Review has no exit or "save draft" CTA — it's a trap
**What**: The 6-step review wizard renders with no visible exit button. Auto-draft save fires on navigation (line 2953), but there's no in-flow "Save progress & close" button, so users don't know their place will be remembered.
**Where**: `index.html:2877–2953` — `renderReview()` and `renderWizPanel()`; no exit CTA in any rendered step HTML
**Why it matters**: Users who don't have 20 minutes skip the review entirely rather than completing two steps and coming back. The wizard's trap-door design is a direct cause of low review completion rates.
**Effort**: S
**Suggested fix**:
- Add a "💾 Save & Exit" button in `renderWizBar()` that calls `_wizSave()` then `nav('dashboard')` and shows: "Draft saved — you're on Step 3/6. Resume anytime."
- Show a subtle "⏳ In progress" pill badge on the sidebar "Review" nav item when `taskos_wiz_draft` exists in localStorage
- On the dashboard, the existing in-progress banner (line 2501) already works — make it more prominent (a solid button, not just a strip)

---

### 6. ~15 `callClaude` callers have no loading indicator
**What**: Only callers wrapped in `_aiBtn()` show a spinner. Direct calls — Wheel coaching, relationship messages, North Star pace, brand audit, morning briefing — fire silently with no visual feedback.
**Where**: `index.html:6068` (Wheel coaching), `7026` (North Star pace), `7436` (brand insight), `7775` (relationship message), `8397` (security audit), `9127` (book summary), `9685` (daily brief), `9746` (inbox triage), `9819` (goal suggest), `9885` (EOD ritual)
**Why it matters**: Users click an AI button, see nothing happen, and click it again — firing duplicate API calls and burning credits. Or they navigate away assuming the feature is broken.
**Effort**: S
**Suggested fix**:
- Enforce consistent use of the existing `_aiBtn(btn, fn)` wrapper for every button that triggers `callClaude`
- For non-button triggers, show/hide a loading state on the output container: `outEl.innerHTML = '<div class="skel">…</div>'` before the call, replace with real content after

---

### 7. `givelink.html` falls back to `window.prompt()` for API key entry
**What**: When the Claude API key is absent, the Sprint Board calls `window.prompt('Enter your Anthropic API key:')` — a native browser dialog that can't be styled, is blocked by some browsers, and is inaccessible to screen readers.
**Where**: `givelink.html:1086` and `givelink.html:1261`
**Why it matters**: This is the first interaction a new user has with AI in the Sprint Board. A raw browser prompt looks like a phishing attempt and breaks the polished product feel.
**Effort**: S
**Suggested fix**:
- The code at line 1259 already attempts to read the key from the shared `taskos` localStorage (`p.claudeKey`) — fix the logic so it reliably finds the key when set in Task OS settings, removing the need to prompt at all
- If the key genuinely isn't set anywhere, show an inline error message rather than `window.prompt()`: "Add your Claude API key in Task OS → Settings to enable AI features here"

---

### 8. Service worker cache name must be manually bumped on every deploy
**What**: `sw.js:1` hardcodes `const CACHE = 'task-os-20260530'`. If this string isn't updated on deployment, all returning users (especially PWA installs) continue serving the old cached HTML — bug fixes don't reach them.
**Where**: `sw.js:1`
**Why it matters**: The commit history shows rapid iteration (73 commits, bug fixes in consecutive PRs). A missed cache bump means shipped fixes are invisible to a significant portion of users for days.
**Effort**: S
**Suggested fix**:
- Inject the cache name at deploy time using the git commit hash or timestamp via a one-line `vercel.json` build command: `"buildCommand": "sed -i 's/task-os-[0-9]*/task-os-'$(date +%Y%m%d%H%M)'/' sw.js"`
- Or: switch the HTML fetch strategy to `network-first` (it already is for HTML in the SW) and add a `Cache-Control: no-cache` header for `index.html` in `vercel.json` — the SW will always revalidate, eliminating the stale-version risk

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. 12,893-line monolithic HTML file
**What**: All CSS (~1,500 lines), JavaScript (~11,000 lines), and HTML markup live in a single file with no module boundaries, no build step, and no separation of concerns.
**Where**: `index.html` (entire file)
**Why it matters**: Every PR diff is a wall of changes against the same file. No ability to run unit tests, no dead-code elimination, impossible to onboard contributors, and merge conflicts are unavoidable on any parallel work.
**Effort**: L
**Suggested fix**:
- Don't rewrite — extract incrementally to avoid regressions:
  1. Move all CSS into `styles.css` (a safe, zero-risk split)
  2. Extract the constants block (lines 2031–2039) and utility functions (lines 2253–2269) to `utils.js`
  3. Extract `callClaude()` (lines 4133–4149) and related AI helpers to `ai.js`
- Add a minimal build step (e.g., a 10-line shell script using `cat`) that concatenates files back to a single-file output for deployment, preserving the existing PWA architecture

---

### 10. Claude model ID hardcoded in `callClaude()`
**What**: `'claude-haiku-4-5-20251001'` is a string literal inside `callClaude()`. When Anthropic deprecates this model, every AI feature in the app breaks simultaneously — and it can only be fixed by editing the source file.
**Where**: `index.html:4138` — `model:'claude-haiku-4-5-20251001'`
**Why it matters**: The fix is trivial now and catastrophic when the deadline hits. claude-haiku-4-5-20251001 is a recent model, but all Anthropic model versions are eventually deprecated.
**Effort**: S
**Suggested fix**:
- Hoist to a module-level constant at the top of the JS: `const AI_MODEL = 'claude-haiku-4-5-20251001';`
- Reference it in `callClaude()`: `model: AI_MODEL`
- Optionally expose it in Settings as a user-selectable value stored in `S.aiModel` — power users can switch to `claude-sonnet-4-6` for better reasoning on complex tasks

---

### 11. App state has no schema version — silent breakage on field renames
**What**: `load()` merges stored JSON into `S` with `S={...S,...JSON.parse(d)}` but never checks a schema version. If a property is renamed, removed, or restructured between commits, existing user data silently carries the old shape without any migration.
**Where**: `index.html:2107`
**Why it matters**: The state object has 70+ top-level keys and is under active development. A rename like `healthLogs` → `health.logs` would mean every existing user sees empty health data on next load. With 73 commits of active development, this will bite.
**Effort**: M
**Suggested fix**:
- Add `_version: 1` to the default `S` object
- In `load()`, after parsing, check `loaded._version` and run a `migrate(loaded)` function before merging
- Start with: if `_version` is missing, run `migrateV0()` which handles any field renames from early development
- Keep migrations accumulative: `v0→v1`, `v1→v2`, etc.

---

### 12. `_aiLock` deduplication guard is missing on most `callClaude` callers
**What**: The `_aiLock` / `_aiUnlock` mechanism (which prevents double-firing an AI call) is used only in a handful of functions like `aiSequenceTasks()`. The other ~20 callers have no guard, so rapid double-clicks fire two simultaneous API requests.
**Where**: `index.html:4159` (has the lock), `index.html:6068, 7026, 7436, 7775, 8397` (do not)
**Why it matters**: Each duplicate call wastes Claude API credits and can cause confusing double-renders of AI output. On slow connections this happens routinely.
**Effort**: S
**Suggested fix**:
- Refactor `_aiBtn(btn, fn)` to also set a data attribute on the button during the call: `btn.dataset.aiRunning = '1'`; check `btn.dataset.aiRunning` at the top and return early if set
- The existing `_aiBtn` wrapper already does this for `btn._aiRunning` — the issue is that it's only used for explicit button-click callers; ensure every UI-triggered `callClaude` goes through it

---

## 💡 P3 — Nice to have

### 13. No keyboard shortcut discovery — 20+ shortcuts are invisible
**What**: The app has a rich keyboard shortcut system (⌘K, ⌘1/2, N, R, W, H, D, M, B, S, Esc and more) but no way to discover them. They appear nowhere in the UI.
**Where**: Keyboard listeners scattered throughout `index.html` (search `onkeydown`, `addEventListener('keydown'`)
**Why it matters**: Power-user features exist but can't be discovered. New users miss the fastest workflows in the app.
**Effort**: S
**Suggested fix**:
- Add a `?` shortcut that opens a "Keyboard Shortcuts" modal
- Generate the modal from a central `SHORTCUTS` constant array: `[{key:'⌘K', action:'Command palette'}, …]` — this also serves as the single source of truth for what shortcuts are registered

---

### 14. Givelink nonprofit goal is hardcoded at 100
**What**: The progress bar in the Givelink stats section hardcodes `goal: 100` as the label and uses `Math.min(100, m.nonprofits)` to calculate fill percentage — so once the goal is reached, the bar stays at 100% regardless of any new target.
**Where**: `index.html:7458` — `<span style="font-size:9px;">goal: 100</span>` and `index.html:7459` — `width:${Math.min(100,m.nonprofits)}%`
**Why it matters**: As Givelink grows, the goal will change. Hardcoded targets require code changes to update, and the progress bar becomes meaningless once it pins at 100%.
**Effort**: S
**Suggested fix**:
- Add `nonprofitGoal: 100` to `S.givelinkMetrics` (default 100)
- Make it editable in the Givelink metrics modal
- Replace the hardcoded calculation: `Math.min(100, Math.round(m.nonprofits / nonprofitGoal * 100))`

---

### 15. Givelink sparkline history is manual-only
**What**: The growth sparklines in the Givelink dashboard (line 7542) need at least 2 history snapshots. Snapshots are taken only when the user manually clicks "📸 Snapshot" (line 11395). If the user forgets, the sparkline shows nothing.
**Where**: `index.html:11395` (manual snapshot save), `index.html:7542` (sparkline rendering)
**Why it matters**: The sparkline is the most useful signal in the Givelink dashboard — it shows whether traction is accelerating. An empty sparkline because the user forgot to click a button is a missed insight.
**Effort**: S
**Suggested fix**:
- Auto-snapshot once per day: in `renderGivelinkDash()`, check if `S.givelinkHistory` has a snapshot for today's date; if not, silently push one
- Or trigger an auto-snapshot in `saveGivelinkMetrics()` whenever metrics are updated (the user just manually entered data, it's the ideal moment to capture a data point)

---

### 16. Brand color divergence: app uses blue (#58a6ff) where brand spec says purple (#6B3FA0)
**What**: `index.html` defines `--brand:#58a6ff` (blue) and `--brand2:#bc8cff` (light lavender) as its brand gradient. The Givelink sections use `#a78bfa` as the Givelink accent. None of these match the specified brand palette (purple `#6B3FA0`/`#5718CA`, pink `#C2185B`/`#E353B6`). `givelink.html` uses a third separate palette (`#3b82f6` blue, `#f472b6` pink, `#a78bfa` violet).
**Where**: `index.html:22` (dark mode root vars), `index.html:30` (light mode root vars), `givelink.html:18` (its own root vars)
**Why it matters**: If external Givelink materials (pitch decks, landing pages, social) use the specified brand purples, the product itself looks like a different company. The divergence also means the "no pink on purple" rule can't be enforced because the actual colors in use haven't been agreed on.
**Effort**: M
**Suggested fix**:
- Align the three color systems: pick one authoritative palette and update the CSS variables in both files
- For the Givelink-specific accent (`#a78bfa` → `#6B3FA0` or `#5718CA`), do a find-replace on the inline color references in the Givelink dashboard section
- Document the final palette in a comment block at the top of the CSS section so future changes stay consistent

---

_Total: 16 items across 4 tiers. Items within each tier are ordered by ROI (highest first)._
