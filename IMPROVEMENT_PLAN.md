# Givelink / Task OS — Improvement Plan

_Generated 2026-06-25. Max 20 items ordered by ROI within each tier._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### P0-1 · `callClaudeGL` swallows API errors silently
**What:** `callClaudeGL()` calls `res.json()` without checking `res.ok` first. A 401 (bad key), 429 (rate limit), or 500 from Anthropic returns a JSON error body that `data.content?.[0]?.text` resolves to `null` — silently. The user sees nothing happen; the AI button appears broken for unknown reasons.  
**Where:** `givelink.html` ~line 1264  
**Why it matters:** Every AI feature in Givelink (sprint planner, nonprofit outreach, standup generator) is broken in silence when the API key is missing or rate-limited.  
**Effort:** S  
**Fix:** Add `if(!res.ok) throw new Error(await res.text())` immediately after the `fetch` call, before `res.json()`. The existing `catch` block will then surface the error via `toast()`.

---

### P0-2 · Standup "yesterday" is two days ago
**What:** `generateStandup()` calculates yesterday as `now.getDate()-2` instead of `now.getDate()-1`.  
**Where:** `givelink.html` ~line 1488  
**Why it matters:** Every standup generated shows wrong yesterday-tasks (tasks from 2 days ago). Daily standup is a core workflow for the sprint team.  
**Effort:** S  
**Fix:** Change `yesterday.setDate(now.getDate()-2)` → `yesterday.setDate(now.getDate()-1)`.

---

### P0-3 · Dynamically-injected modals never get click-outside-to-close
**What:** The DOMContentLoaded handler at ~line 875 attaches backdrop-click listeners to all `.mo` elements present at page load. Three modals created later by JavaScript — `np-modal` (Nonprofit CRM), `standup-modal`, and `outreach-modal` — are injected into the DOM on first use and never receive this listener. Clicking outside them does nothing; users can only close them via the explicit close button.  
**Where:** `givelink.html` ~line 875 (setup); ~lines 1362, 1408, 1460 (dynamic injection sites)  
**Why it matters:** Broken close UX for the three most-used modals in the CRM workflow.  
**Effort:** S  
**Fix:** Replace the per-element listener with a single delegated listener on `document` that checks `e.target.classList.contains('mo')`, or re-run the attachment logic inside each `_showNPModal` / `openStandup` / `openOutreach` helper after injecting.

---

### P0-4 · `toast()` renders unescaped HTML via `innerHTML`
**What:** `toast(msg)` sets `t.innerHTML = msg`. Several callers pass strings containing user-controlled data (task titles, AI response fragments). This is a stored-XSS vector if any user-controlled string reaches a toast call.  
**Where:** `givelink.html` line 452  
**Why it matters:** Low-severity today (no multi-user surface), but the pattern will propagate as features are added, and the AI-returned text going into toasts is an XSS amplifier if the Anthropic API is ever compromised or spoofed.  
**Effort:** S  
**Fix:** Change `t.innerHTML = msg` → `t.textContent = msg`. If bold/emoji HTML is needed, use a safe allowlist via `DOMParser` or switch callers that need HTML to pass pre-escaped strings.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### P1-1 · Mobile bottom nav omits 2 of 5 Givelink pillars
**What:** The mobile bottom nav in `givelink.html` only exposes 5 sections (Overview, Sprint, Backlog, Past, Nonprofits). The "Nonprofits" and "Smooth Ops" pillar views are unreachable on mobile without knowing to open the sidebar hamburger menu.  
**Where:** `givelink.html` lines 306–312  
**Why it matters:** Mobile-first users (field volunteers, on-the-go nonprofit contacts) can't access the CRM or Ops sections without discovering the hidden sidebar.  
**Effort:** M  
**Fix:** Either add a "More" overflow tab that opens a bottom sheet with remaining nav items, or consolidate the mobile nav to the 4 highest-traffic sections and add an explicit "More →" link.

---

### P1-2 · Task sync to Task OS deduplicates by title substring — creates phantom duplicates
**What:** `syncToTaskOS()` checks for existing tasks by case-insensitive title match. If a task is renamed even slightly (e.g., "Draft proposal" → "Draft final proposal"), a second copy is created in Task OS with no warning.  
**Where:** `givelink.html` ~line 1232  
**Why it matters:** Users report double tasks in Task OS after editing Givelink task titles — trust-breaking for a productivity tool.  
**Effort:** M  
**Fix:** Assign a stable `glid` UUID to each Givelink task on creation and match by that ID in TaskOS during sync. Fall back to title match only when `glid` is absent (legacy tasks).

---

### P1-3 · API key acquisition uses `window.prompt()` — blocked in PWA / broken UX
**What:** Both `callClaudeGL()` and `callClaude()` (index.html) use `window.prompt()` as the fallback key-entry mechanism. Browsers suppress `prompt()` in standalone PWA mode and in some iframe embeddings.  
**Where:** `givelink.html` line 1086, 1261; `index.html` ~line 1420  
**Why it matters:** First-time AI usage silently fails in PWA install (the most-promoted usage mode). Key is also stored as plaintext in `localStorage` with no masking.  
**Effort:** M  
**Fix:** Replace the `prompt()` flow with a branded settings modal (already exists in Task OS — reuse or link to it). Store key under an obfuscated key name and consider a simple XOR+base64 encoding to reduce casual exposure.

---

### P1-4 · `delCur()` task deletion uses native `confirm()` — breaks in PWA
**What:** Deleting a sprint task calls `confirm('Delete task?')`. Like `prompt()`, `confirm()` is suppressed in standalone PWA mode on iOS/Android.  
**Where:** `givelink.html` ~line 732  
**Why it matters:** Deleting a task silently does nothing (confirm returns `false` when suppressed) — users can't delete tasks in PWA mode.  
**Effort:** S  
**Fix:** Replace with the in-app `showConfirm()` helper that already exists in `index.html` (or port a lightweight version to `givelink.html`).

---

### P1-5 · Offline pill flickers: `style.display=''` reverts to stylesheet, not `block`
**What:** The online/offline event handlers in `index.html` set `p.style.display=''` to show the pill, clearing the inline `display:none`. But the stylesheet default for `#offline-pill` is `display:none`, so the pill becomes invisible immediately again.  
**Where:** `index.html` ~line 10583–10588  
**Why it matters:** Users have no visual indication when they lose connectivity.  
**Effort:** S  
**Fix:** Change `p.style.display=''` → `p.style.display='flex'` (or `'block'`) in the offline handler. Or toggle a CSS class instead of inline style.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### P2-1 · Duplicate AI caller functions across both files
**What:** `callClaude()` (index.html ~line 1410) and `callClaudeGL()` (givelink.html ~line 1257) implement identical fetch logic with only minor parameter differences. Bug fixes must be applied to both; they diverge each time.  
**Where:** `index.html` ~line 1410; `givelink.html` ~line 1257  
**Why it matters:** P0-1 (missing `res.ok` check) exists in both files. Every future API change or model update requires touching two files.  
**Effort:** M  
**Fix:** Extract to a shared `claude-api.js` or a `<script>` block in a shared include. Until a build step is added, at minimum synchronize the implementations and add a comment linking them.

---

### P2-2 · `closeM()` and `closeModal()` coexist in index.html doing the same thing
**What:** `closeM(id)` and `closeModal(id)` both hide modal overlays; usage is inconsistent across 12,893 lines.  
**Where:** `index.html` — `closeModal` defined ~line 10583; `closeM` used throughout  
**Why it matters:** Developers patch one and not the other; the backdrop-bug fix in commit #54 required knowing which function to use.  
**Effort:** S  
**Fix:** Pick one (prefer `closeM` — it handles `body.modal-open` correctly). Add a one-line alias `function closeModal(id){closeM(id);}` to avoid breaking existing calls, and migrate callers over time.

---

### P2-3 · `runAiSprintPlanner()` hardcodes an outdated model name
**What:** `runAiSprintPlanner()` passes `'claude-opus-4-5'` to `callClaudeGL`. The correct model ID is `claude-opus-4-8` (current). `claude-opus-4-5` will fail with a 400 once deprecated.  
**Where:** `givelink.html` ~line 1131  
**Why it matters:** Sprint planning AI will break silently when the old model is sunset.  
**Effort:** S  
**Fix:** Update to `'claude-opus-4-8'` and define a `GL_MODELS = {fast: 'claude-haiku-4-5-20251001', smart: 'claude-opus-4-8'}` constant so model references are centralized.

---

### P2-4 · Dynamic modal injection has no lifecycle management
**What:** `_showNPModal()` creates a `<div>` and appends it to `document.body` on first call. On subsequent calls it re-queries `#np-modal` and re-populates it. There is no cleanup path; if the modal is accidentally created twice (race condition on fast double-tap) the second instance is orphaned.  
**Where:** `givelink.html` ~line 1358  
**Why it matters:** Memory leak on repeated CRM usage; potential double-modal rendering.  
**Effort:** S  
**Fix:** Guard with `if(document.getElementById('np-modal')) return;` before injection, or move the modal markup into static HTML and just show/hide it.

---

### P2-5 · Empty catch blocks swallow errors in index.html
**What:** Multiple `}catch(e){}` blocks (lines 2433, 2501, 2877, 8657, 10054) silently discard errors with no logging.  
**Where:** `index.html` — ~8 occurrences  
**Why it matters:** Bugs in localStorage parsing, nav state, and XP award calls are invisible in production.  
**Effort:** S  
**Fix:** Replace silent catches with `console.warn('[taskos] context:', e)`. Reserve empty catches only for truly optional progressive-enhancement code with an explanatory comment.

---

### P2-6 · Service worker cache version not bumped on deploys
**What:** `sw.js` hardcodes `CACHE_NAME = 'taskos-v1'`. If cache version is never changed, users on stale PWA installs load old HTML even after deploys.  
**Where:** `sw.js` line 1  
**Why it matters:** Bug fixes (including P0 fixes above) won't reach PWA users until they manually clear the cache or reinstall.  
**Effort:** S  
**Fix:** Automate cache-busting by injecting a build timestamp into `CACHE_NAME` via a simple deploy script (or Vercel build hook). Short term: bump manually to `taskos-v2` after each significant release.

---

## 💡 P3 — Nice to have

### P3-1 · Brand color misalignment across both apps
**What:** Both apps use blue as the primary accent — `--accent:#3b82f6` (givelink.html) and `--accent:#58a6ff` (index.html). The Givelink brand color is purple (`#5718CA` / `#6B3FA0`).  
**Where:** `givelink.html` line ~12 (`:root`); `index.html` line ~8  
**Why it matters:** Inconsistent brand impression; fundraising materials and the app feel like different products.  
**Effort:** M  
**Fix:** Update `--accent` and `--brand-gradient` in givelink.html to `#6B3FA0` / `#5718CA`. Audit button and highlight colors. Consider CSS custom property tokens shared via a `<link rel="stylesheet">` import.

---

### P3-2 · `standup-body._text` uses non-standard DOM property for state
**What:** After generating a standup, the text is saved as `body._text = text` on the DOM element for the clipboard copy button to retrieve. This is lost on any re-render.  
**Where:** `givelink.html` ~line 1519  
**Why it matters:** Fragile; the copy button will silently copy nothing if the DOM is updated between generation and copy.  
**Effort:** S  
**Fix:** Store the generated standup text in `S.lastStandup` (already a field on the state object) or a module-scoped variable, and read from there in the copy handler.

---

### P3-3 · Hardcoded Supabase URL and anon key in HTML source
**What:** The Supabase project URL and `anon` key are embedded directly in `index.html`. The `anon` key is designed to be public, but the project URL reveals the Supabase project identity.  
**Where:** `index.html` ~line 2060  
**Why it matters:** Low risk today (anon key + RLS), but makes rotating credentials require a full re-deploy, and the key will appear in version history forever.  
**Effort:** M  
**Fix:** Move to Vercel environment variables and inject at build time, or use a `config.js` file excluded from git (`.gitignore` + document in README). As a minimum, add a comment noting the key is intentionally public and RLS-protected.

---

_Total items: 17 across 4 tiers. Last updated: 2026-06-25._
