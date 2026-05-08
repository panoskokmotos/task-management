# Givelink / Task OS — Improvement Plan

> Generated: 2026-05-08 | Codebase: vanilla HTML/JS/CSS SPA, two apps (`index.html` 4,685 lines, `givelink.html` 1,716 lines), localStorage persistence, direct Claude API calls.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### P0-1 · Silent data loss when localStorage quota is exceeded

**What**: `save()` has no error handling — if the 5 MB localStorage quota is exceeded the write silently fails and every subsequent user action is lost until the next reload.

**Where**: `index.html:1124`
```js
function save(){localStorage.setItem('taskos',JSON.stringify(S));}
```

**Why it matters**: The state object already holds tasks, goals, health logs, finance entries, automations, habits, decisions, wins, photo logs, and context logs. Power users will hit the quota. When they do, data they think they saved evaporates — no error, no warning, no retry.

**Effort**: S

**Suggested fix**:
- Wrap `localStorage.setItem` in try/catch; on `QuotaExceededError` show a persistent toast with a link to the export/backup action.
- Add a lightweight size check: `if(JSON.stringify(S).length > 4_000_000) toast('⚠️ Storage >4 MB — export a backup')`.
- Long-term: split out rarely-accessed logs (health, finance, decisions) into separate localStorage keys so the main state stays small.

---

### P0-2 · Unguarded `JSON.parse` on startup crashes the whole app

**What**: `load()` calls `JSON.parse(d)` with no try/catch. Corrupted or partially-written localStorage (power loss during save, storage API bug, manual edit) causes an unhandled exception that freezes the app on every subsequent load.

**Where**: `index.html:1125`
```js
function load(){const d=localStorage.getItem('taskos');if(d)S={...S,...JSON.parse(d)};}
```

**Why it matters**: There is no fallback — the user is stuck with a broken app until they know to open DevTools and clear storage. Zero discoverability.

**Effort**: S

**Suggested fix**:
- Wrap in try/catch: on parse failure, keep the default empty `S`, show a banner ("Couldn't load your data — it may be corrupted. Your last known-good backup is available here."), and offer a download of the raw broken string for manual recovery.
- Before overwriting with a new save, keep a `taskos_backup` key with the previous snapshot so there's always one rollback point.

---

### P0-3 · `window.prompt()` used for API key and CRM activity logging

**What**: Two places in `givelink.html` fall back to `window.prompt()` — a blocking, thread-freezing native dialog — to collect user input.

**Where**:
- `givelink.html:1047` — API key fallback: `prompt('Enter your Anthropic API key:')`
- `givelink.html:1222` — second API key path: `window.prompt('Enter Anthropic API key:')`
- `givelink.html:1392` — CRM activity log: `window.prompt('Log activity (what happened?):')`

**Why it matters**: `window.prompt()` blocks the entire browser tab, is invisible to screen readers, destroys screen-sharing sessions, can't be styled, and on some browsers (Firefox in strict mode, certain PWA contexts) is silently suppressed — meaning the key is never captured and AI features fail mysteriously. The CRM flow is completely broken in any PWA installed context.

**Effort**: S

**Suggested fix**:
- Replace the API key prompt with a redirect to the Settings modal (same pattern used in `index.html:2214`): `toast('Add your API key in Settings'); return null;`
- Replace the CRM activity prompt with a small inline form in the existing NP modal (one `<textarea>` + Save button).
- Audit for any remaining `window.prompt` / `window.confirm` usage across both files.

---

### P0-4 · "Panos" hardcoded throughout AI prompts — wrong output for any other user

**What**: The founder's first name is hardcoded in at least five AI prompt strings, so every other user (or a demo) gets briefings, standups, and outreach emails written "for Panos."

**Where**:
- `index.html:4073` — morning briefing prompt: `"for Panos, founder of Givelink"`
- `index.html:4133` — inbox triage prompt: `"for Panos, a startup founder"`
- `index.html:4208` — relationship draft: `"for Panos to send to ${p.name}"`
- `givelink.html:1453` — standup generator: `"for Panos, founder of Givelink"`
- `givelink.html:1598` — outreach email: `"from Panos Evangelou, co-founder of Givelink"`
- `index.html:12` — page title: `<title>Task OS — Panos</title>`
- `index.html:308` — static HTML greeting: `Good morning, Panos 👋` (the JS version at line 1156 correctly reads `profileName`)

**Why it matters**: Every AI output names the wrong person. Outreach emails signed "Panos Evangelou" sent from any other user's API key is a brand/trust catastrophe. The static title and greeting also look broken to other users.

**Effort**: S

**Suggested fix**:
- Replace all hardcoded occurrences with `${profileName}` / `${S.profileName}` (already available at `index.html:1121`).
- Store a `profileRole` and `profileCompany` field in Settings (e.g. "co-founder, Givelink") and substitute into prompts.
- Fix `index.html:308` static HTML to read the name from JS on `DOMContentLoaded`, and update `<title>` dynamically.

---

### P0-5 · No button debounce on AI calls — duplicate requests and API errors

**What**: None of the 13+ buttons that trigger `callClaude()` / `callClaudeGL()` are disabled during the async call. Rapid clicks fire parallel requests, hitting rate limits and producing duplicate outputs pasted into the same UI container.

**Where**: `index.html:2387` (`aiSuggestAutomations`), `2466` (`aiRelNudge`), `2759` (`showBatchSuggestions`), `2783` (`generateTweet`), `3060` (`genAIChallenge`), `3245` (`aiPreMortem`), `3471` (`runPriorityAudit`), `4123` (`autoProcessInbox`), `4249` (`showGoalDigest`); `givelink.html:1058` (`runAiSprintPlanner`), `1593` (`generateOutreach`).

**Why it matters**: Claude Haiku calls cost money. Duplicate parallel calls double the spend and return garbled concatenated results in the output modal. During the 1-3 second wait, a frustrated user clicks again — this is a guaranteed behavior.

**Effort**: S

**Suggested fix**:
- Add a module-level `let _aiRunning = false` flag; set it true at the start of `callClaude()`, false in the finally block.
- Alternatively, disable the triggering button element and restore it after the call resolves.
- Show a spinner/loading class on the output container instead of only a toast.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### P1-1 · Brand palette is not implemented — both apps use GitHub-blue

**What**: The brand spec calls for purple (`#6B3FA0`, `#5718CA`) and pink (`#C2185B`, `#E353B6`) as primary brand colors. Neither appears anywhere in the codebase. `index.html` uses `--accent:#58a6ff` (GitHub blue) and `givelink.html` uses `--accent:#3b82f6` (Tailwind blue).

**Where**: `index.html:17`, `givelink.html:17`

**Why it matters**: The product looks like a GitHub/Linear clone rather than Givelink. Any marketing material, pitch deck, or landing page built off the brand palette will be visually disconnected from the actual tool — confusing at demos.

**Effort**: M

**Suggested fix**:
- Define brand tokens in both files: `--brand-purple:#5718CA; --brand-purple-light:#6B3FA0; --brand-pink:#E353B6;`
- Replace `--accent` with `--brand-purple` in both apps; use `--brand-pink` for the Givelink category badge and sprint-bar accent in `givelink.html`.
- Enforce the no-pink-on-purple rule: never place `--brand-pink` text on a `--brand-purple` background — audit after applying by visually checking the sidebar active state and Top 3 slots.

---

### P1-2 · Givelink and Task OS share no design tokens — two incompatible color systems

**What**: `index.html` and `givelink.html` define completely different CSS variable naming schemes (e.g. `--surface` vs `--sf`, `--surface2` vs `--s2`) and different accent colors with no shared source.

**Where**: `index.html:15–21`, `givelink.html:15–20`

**Why it matters**: Every UI change must be made twice. The two apps look noticeably different side-by-side, undermining the impression of a single coherent product. This will compound as more features are added.

**Effort**: M

**Suggested fix**:
- Extract shared CSS variables into a `<link rel="stylesheet">` pointing to a `tokens.css` file (or an inline `<style>` block in a shared header partial).
- Normalize variable names to one scheme; use semantic aliases where apps differ (`--accent-app` can resolve to different values per app if needed).
- As a quick win, at minimum align the background, surface, border, and text palette so the apps look like siblings.

---

### P1-3 · No onboarding for new users — AI features silently fail

**What**: A first-time user sees a fully populated-looking dashboard with AI buttons that produce toast errors ("Add Claude API key in Settings first") with no guidance on what Settings is, where to get a key, or what it costs.

**Where**: `index.html:745–761` (Settings modal, no help text); `index.html:2214` (error toast with no CTA)

**Why it matters**: The API key setup is a non-trivial hurdle (requires an Anthropic account, billing, generating a key). Without guidance, new users churn before reaching any value. This is the primary conversion blocker for anyone who isn't already a Claude power user.

**Effort**: M

**Suggested fix**:
- On first load (detect `!localStorage.getItem('taskos')`), show a one-time welcome modal: "Welcome to Task OS. To unlock AI features, add your Anthropic API key. [Get one here →](https://console.anthropic.com/) It costs ~$0.01 per AI action."
- Add a `?` help icon next to the API key field in Settings that opens a tooltip explaining where to get it and the expected cost.
- Change the error toast text from "Add Claude API key in Settings first" to "Add your Claude API key in ⚙️ Settings → API Key to enable this feature." (with Settings being a clickable link).

---

### P1-4 · Duplicate API-key lookup logic between the two apps creates inconsistent auth behavior

**What**: `callClaude()` reads from `S.claudeKey`; `callClaudeGL()` tries three different sources in sequence (`taskos_api_key` localStorage key → parse `taskos` JSON → `window.prompt()`). The key set in Task OS Settings is sometimes not found by Givelink, and vice versa.

**Where**: `index.html:2213–2224`, `givelink.html:1217–1233`, `givelink.html:1036–1048`

**Why it matters**: A user who configures their key in Task OS opens Givelink and gets a `window.prompt()` dialog asking for it again. This looks broken, doubles setup friction, and stores the key in a second localStorage slot that can drift out of sync.

**Effort**: M

**Suggested fix**:
- Standardize on one lookup chain: `localStorage.getItem('taskos_api_key')` as the canonical single-source-of-truth key.
- Have Task OS Settings write to `taskos_api_key` (not `S.claudeKey`) so both apps read the same value.
- Remove the `window.prompt()` fallback entirely (see P0-3).

---

### P1-5 · No data export / backup — full data loss on browser clear

**What**: All user data (tasks, goals, health logs, finance entries, all 20+ data types) is stored in a single `localStorage` key. There is no export button, no cloud backup, and no import/restore flow.

**Where**: `index.html:1124–1125` (save/load); Settings modal `index.html:745–761` (only has reset, no export)

**Why it matters**: Clearing browser data, switching devices, or opening in a different browser profile destroys everything. This is a trust-breaking event for power users with months of data.

**Effort**: M

**Suggested fix**:
- Add "Export backup (JSON)" to the Settings modal: `const blob = new Blob([JSON.stringify(S)], {type:'application/json'}); ...` — standard pattern, ~5 lines.
- Add an "Import backup" file input that reads the JSON and overwrites `S` after validation.
- As a 5-minute quick win, copy the current state to `taskos_backup` on every Settings open so there's always one recent snapshot.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### P2-1 · 4,685-line monolithic HTML file with no module system

**What**: All JavaScript (195+ functions), CSS (250 lines), and HTML markup (250+ elements, 15+ modals) are in a single `index.html` with no build tooling, no module system, and no tests.

**Where**: `index.html` (entire file)

**Why it matters**: Onboarding a collaborator requires understanding ~4,700 lines at once. A grep for a function name returns ambiguous results. One misplaced bracket silently breaks everything below it. There is no way to run unit tests on business logic like `goalStats()`, `ei()`, or `renderDash()`.

**Effort**: L

**Suggested fix**:
- As an incremental step (not a big-bang rewrite): extract the `<style>` block to `styles.css`, load it via `<link>`. This alone reduces the file to ~4,430 lines with zero behavior change.
- Extract the 12 async AI functions to `ai.js` as ES modules; import them with `<script type="module">`.
- Extract the data layer (`save`, `load`, `S`, `uid`) to `store.js` — this is the foundation for any future testing.
- Do NOT rewrite in a framework unless the codebase is already being rebuilt from scratch.

---

### P2-2 · Hardcoded model string `claude-haiku-4-5-20251001` in multiple locations

**What**: The Claude model identifier is a magic string repeated in `index.html:2219` and `givelink.html:1217, 1621`. When Anthropic retires the model, all three must be found and updated by hand.

**Where**: `index.html:2219`, `givelink.html:1217`, `givelink.html:1621`

**Why it matters**: Haiku 4.5 will be deprecated. When it is, calls silently fail or return errors that look like API key problems to the user. Finding all three occurrences under time pressure is error-prone.

**Effort**: S

**Suggested fix**:
- In each file, add `const AI_MODEL = 'claude-haiku-4-5-20251001';` near the top of the script block.
- Replace all inline string literals with `AI_MODEL`.
- Update in one place when the model changes.

---

### P2-3 · No localStorage schema versioning — state shape changes break existing installs

**What**: The state object has no `_version` field. The presence of `seededGoalsV3:false` at `index.html:1119` implies at least two prior schema migrations happened ad hoc. The `load()` function uses object spread (`{...S,...JSON.parse(d)}`) which silently drops new keys if the saved object has different shape.

**Where**: `index.html:1119`, `index.html:1125`

**Why it matters**: When new properties are added to `S` (as has happened repeatedly: `contextLog`, `oneThing`, `habitUnits` all added post-launch), users on the old schema get `undefined` values that cause runtime errors in rendering functions. There's no way to detect or repair this.

**Effort**: M

**Suggested fix**:
- Add `_version: 4` to the default `S` object.
- In `load()`, after parsing, check `parsed._version < CURRENT_VERSION` and run a migration function that fills in missing keys with defaults.
- Pattern: `function migrate(data) { if (!data.contextLog) data.contextLog = []; ... return data; }`

---

### P2-4 · Empty catch block swallows errors in API key lookup

**What**: `givelink.html:1044` has `catch(e){}` — all exceptions from the profile-scan API-key-lookup block are silently discarded.

**Where**: `givelink.html:1036–1048`

**Why it matters**: If `JSON.parse` throws on a corrupted profile entry, the empty catch means the function falls through to `window.prompt()` with no indication of what went wrong. Debugging is impossible.

**Effort**: S

**Suggested fix**:
- At minimum: `catch(e){ console.error('[Givelink] API key lookup failed:', e); }`
- Better: validate the shape of parsed data before accessing `.apiKey` to avoid the throw in the first place.

---

### P2-5 · `anthropic-dangerous-direct-browser-access` header exposes API key to XSS

**What**: Both apps call the Anthropic API directly from the browser with the `anthropic-dangerous-direct-browser-access` header and the user's raw API key in the request. The header name is Anthropic's own warning label.

**Where**: `index.html:2218`, `givelink.html:1227`

**Why it matters**: Any XSS vulnerability (e.g. an unsanitized task title rendered via `innerHTML`) can exfiltrate the API key. Stored in `localStorage`, it's also reachable by any third-party script loaded by the page. An exfiltrated key can be used to run up significant API charges.

**Effort**: L

**Suggested fix**:
- Short-term: audit all `innerHTML` assignments for user-controlled strings (task titles, notes, names) and ensure they go through an `esc()` / `sanitize()` helper. This reduces XSS surface.
- Medium-term: route Claude calls through a lightweight Vercel serverless function (`/api/claude`) that holds the API key server-side; the browser sends the prompt, the function signs the request. Key never touches the browser.
- Note: This is architecturally significant but the Vercel config already exists (`vercel.json`), making the serverless function a natural addition.

---

## 💡 P3 — Nice to have

---

### P3-1 · Page `<title>` and static HTML greeting hardcoded to "Panos"

**What**: `index.html:12` sets `<title>Task OS — Panos</title>` and line 308 has `Good morning, Panos 👋` baked into the HTML. The JS greeting at line 1156 correctly reads `profileName` at runtime, but the static values flash first.

**Where**: `index.html:12`, `index.html:308`

**Why it matters**: Minor but visible — browser tab shows "Panos" for any user, and the pre-JS-hydration flash shows "Panos" before the name loads. Looks broken in demos for any non-Panos user.

**Effort**: S

**Suggested fix**:
- Set `document.title = 'Task OS — ' + profileName;` in the `load()` / init flow.
- Replace the static HTML greeting text with a placeholder (`<span id="greeting"></span>`) and populate in `renderDash()` (already done for the JS version — just remove the static fallback text).

---

### P3-2 · Cross-tab localStorage conflict with no merge strategy

**What**: Two open browser tabs both read and write the same `taskos` localStorage key. The last tab to call `save()` wins, silently overwriting the other tab's changes.

**Where**: `index.html:1124–1125`

**Why it matters**: A user with the app open in two tabs (common for reference while working) will lose changes from one tab. No warning, no conflict resolution.

**Effort**: M

**Suggested fix**:
- Listen for the `storage` event on `window`: when another tab writes `taskos`, reload `S` and re-render.
- For write conflicts: adopt a last-write-wins strategy with a timestamp field in `S`, or show a "Updated in another tab — reload?" banner.

---

### P3-3 · Service worker cache version is hardcoded — stale assets persist after deploys

**What**: `sw.js` uses the hardcoded cache name `task-os-20260419-190847`. Old versions remain cached until this string is manually changed and a new deploy is pushed.

**Where**: `sw.js:1` (cache version constant)

**Why it matters**: If a bug fix is deployed but the SW cache version is forgotten, users continue loading the broken version until they manually clear their cache — which most won't know to do.

**Effort**: S

**Suggested fix**:
- Replace the hardcoded date string with a build-time value injected by Vercel (e.g. `VERCEL_GIT_COMMIT_SHA` environment variable substituted during the build step).
- If no build step exists, use a simple incrementing integer version (`v5`) that is changed whenever a deploy is intended to bust the cache.

---

### P3-4 · Brand category badge uses `#f783ac` (pink) — potential pink-on-purple violation

**What**: The "Brand" task category badge uses `--cb:#f783ac` (soft pink). If these badges appear inside a purple-accented container (e.g. after the brand palette from P1-1 is applied), they violate the no-pink-on-purple rule.

**Where**: `index.html:20` (`--cb:#f783ac`), rendered via `catB()` at `index.html:1133`

**Why it matters**: This is a latent violation that becomes active the moment the brand purple palette (P1-1) is applied. Fixing it post-facto is harder than fixing it now.

**Effort**: S

**Suggested fix**:
- Change the Brand category color to a neutral or use `--brand-purple-light` text on a pale background so it reads legibly without creating a pink-on-purple conflict.
- Establish a rule: pink (`--brand-pink`) is only used for interactive CTAs, never for category labels or decorative badges inside purple-background containers.
