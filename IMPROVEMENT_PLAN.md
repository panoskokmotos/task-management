# Givelink Codebase — Improvement Plan

_Audited 2026-05-11. Covers `givelink.html`, `index.html`, `sw.js`, manifest files, and `vercel.json`._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. `load()` in Givelink crashes the entire app on corrupt localStorage

**What**: `JSON.parse(d)` in the Givelink persist layer has no error handling — a single corrupt byte in localStorage takes down the whole app with a blank screen.

**Where**: `givelink.html:443`

```js
function load(){const d=localStorage.getItem('givelink_sprint');if(d){const p=JSON.parse(d);S={...S,...p};}}
```

**Why it matters**: Any user who clears storage mid-session, has browser storage corruption, or has a very old state schema sees a white screen with no recovery path. Complete data loss perception even if the data is fine elsewhere.

**Effort**: S

**Suggested fix**:
- Wrap in `try/catch` mirroring what `index.html:1565` already does correctly
- On catch, show a recovery banner (`"Data corrupted — resetting sprint data"`) rather than failing silently
- Log the raw string to console in dev for debugging

---

### 2. `callClaudeGL()` doesn't check `res.ok` before parsing JSON

**What**: The shared Claude utility in Givelink calls `res.json()` unconditionally, so HTTP 401/429/500 responses produce a cryptic `"AI error: SyntaxError"` instead of actionable feedback.

**Where**: `givelink.html:1224–1232`

```js
const res=await fetch('https://api.anthropic.com/v1/messages',{...});
const data=await res.json();           // ← no res.ok check
return data.content?.[0]?.text||null;
```

**Why it matters**: When a user's API key is wrong or they hit a rate limit, they see "AI error: SyntaxError" with no path to recovery. The `index.html` version (`callClaude`, line 2732) does this correctly; Givelink's version was written separately and missed the guard.

**Effort**: S

**Suggested fix**:
- Add `if(!res.ok){const err=await res.json().catch(()=>({})); toast(friendlyMsg(res.status,err)); return null;}` before `res.json()`
- Map status codes to messages: 401 → "Invalid API key", 429 → "Rate limit — wait a moment", others → "AI error {status}"

---

### 3. Push notification icon 404 — `./icons/icon-192.png` doesn't exist

**What**: The service worker references `./icons/icon-192.png` for push notification icons, but no `icons/` directory exists in the repository.

**Where**: `sw.js:39–40`

```js
icon:'./icons/icon-192.png',
badge:'./icons/icon-192.png',
```

**Why it matters**: Push notifications display with a broken icon on Android (Chrome shows a generic globe). On some platforms, a 404 on the icon resource causes the notification to be silently swallowed. This affects every user who has enabled push reminders.

**Effort**: S

**Suggested fix**:
- Either create an `icons/` directory with a 192×192 PNG derived from `icon.svg`/`icon-gl.svg`
- Or point to existing assets: `icon:'./icon.svg'` works in modern Chrome/Android (SVG icons are supported for notifications)
- Update the manifest `icons` array to include a `192x192` entry while here

---

### 4. `getApiKey()` looks up wrong property — always falls through to `window.prompt()`

**What**: Givelink's `getApiKey()` reads `d.apiKey` from Task OS profile data, but `index.html` stores the key as `d.claudeKey` (confirmed at `index.html:1564` in the state schema). The lookup never finds the key even when it exists.

**Where**: `givelink.html:1042`

```js
const d=JSON.parse(localStorage.getItem('taskos_data_'+p.id)||'null');
if(d&&d.apiKey)return d.apiKey;   // ← should be d.claudeKey
```

**Why it matters**: Every user who has already set up their API key in Task OS will still be hit with a `window.prompt()` when they open the AI Sprint Planner in Givelink. Jarring UX and a trust-breaking moment. The fallback key stored as `taskos_api_key` (line 1046) is also a separate key silo — changes in one app don't propagate to the other.

**Effort**: S

**Suggested fix**:
- Change `d.apiKey` → `d.claudeKey` on givelink.html:1042
- Also check `localStorage.getItem('taskos_api_key')` as the shared fallback (already done) but ensure the write path is consistent: both apps should write to the same key name

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 5. Notion integration is architecturally broken by CORS — advertised feature that doesn't work

**What**: The Notion "fetch from page" integration makes a direct browser-to-Notion API request, but Notion's API explicitly blocks all cross-origin browser requests. The code detects the failure but falls back to a manual export workaround that most users won't follow.

**Where**: `index.html:4829–4851`

**Why it matters**: Users who see "Notion Integration" in Settings and spend time configuring it will hit a dead end every time. The workaround instructions are buried in an error state. This is a feature that promises automated Notion sync but delivers a manual copy-paste flow.

**Effort**: M

**Suggested fix**:
- Replace the broken direct fetch with a Notion "public page" share approach: users share the page publicly and the app fetches the public HTML, then strips it — no CORS issue
- Or remove the broken auto-fetch UI entirely and keep only the paste-from-export path, with clear copy explaining it's manual
- Long-term: proxy through a small Vercel Edge Function (the infra is already there via `vercel.json`) to avoid CORS

---

### 6. `window.prompt()` used for API key and CRM activity logging — broken on mobile

**What**: `window.prompt()` is used in three places: API key collection in Givelink (line 1047), API key collection in Givelink's shared utility (line 1222), and CRM activity logging (line 1392). This dialog is blocked in Safari on iOS under certain conditions, truncates long notes, and is visually jarring.

**Where**: `givelink.html:1047`, `givelink.html:1222`, `givelink.html:1392`

**Why it matters**: CRM activity logging is a core workflow for Givelink's nonprofit outreach tracking. `window.prompt()` limits note length, has no formatting, can't be dismissed by Escape on some mobile browsers, and looks unprofessional to users demoing the product to nonprofits.

**Effort**: M

**Suggested fix**:
- Replace the API key prompt with a proper settings modal — Givelink already has a modal system (`.mo`/`.md` classes), just needs a settings view with a key input field
- Replace the CRM activity prompt with an inline textarea inside the NP modal that's already open — `logActivityNP()` can open a small sub-section in `#np-modal` instead of a native dialog
- The `callClaudeGL()` prompt (line 1222) should redirect to the settings modal instead of storing ad-hoc in `localStorage`

---

### 7. Brand mismatch: Givelink uses blue; defined brand is purple

**What**: The Givelink app's accent color is `#3b82f6` (blue) throughout — CSS variables, sprint bar, badges, buttons, and the PWA manifest `theme_color`. The documented Givelink brand palette specifies purple (`#6B3FA0`/`#5718CA`) and pink (`#C2185B`/`#E353B6`).

**Where**: `givelink.html:17` (CSS `--accent:#3b82f6`), `manifest-givelink.json:7` (`"theme_color":"#3b82f6"`), `givelink.html:6` (`<meta name="theme-color" content="#3b82f6">`)

**Why it matters**: The product shows to nonprofit partners, donors, and investors. Using the wrong brand color throughout the sprint board means every internal demo or screen share sends an off-brand signal. The Givelink app looks like Task OS with different data.

**Effort**: S

**Suggested fix**:
- Update `--accent` in `givelink.html:17` to `#5718CA` (primary brand purple)
- Add `--accent2:#E353B6` (brand pink) for secondary highlights like pillar badges
- Update `manifest-givelink.json` and the `<meta name="theme-color">` tag to match
- Verify the "no pink on purple" rule: pink badges should not appear on purple backgrounds — currently `--pr:#f472b6` (pink) is used alongside `--op:#a78bfa` (purple) in the same badge rows (task meta, line 87–95)

---

### 8. Modals have no ARIA roles, no focus trap, no keyboard dismiss

**What**: All modals in both apps (`.mo` class) have no `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trapping, or Escape-to-close behavior. Focus falls through to background content for keyboard and screen reader users.

**Where**: `givelink.html:123–128`, `index.html:104–109` (modal CSS), and every `<div class="mo">` throughout both files

**Why it matters**: Screen reader users cannot interact with modals at all. Keyboard users lose their position when a modal opens. The Escape key does nothing. This is a WCAG 2.1 Level A failure.

**Effort**: M

**Suggested fix**:
- Add `role="dialog" aria-modal="true" aria-labelledby="[modal-heading-id]"` to each `.mo` div
- Add a shared `trapFocus(el)` utility that moves focus to the first focusable element on open and cycles within the modal
- Add a `keydown` listener on `document` that calls `closeM()` for the active modal when Escape is pressed (both files currently have `closeM()` already — just wire up the key)

---

### 9. No localStorage quota guard — silent data loss when storage is full

**What**: `save()` in both apps calls `localStorage.setItem()` with no try/catch. localStorage is capped at ~5MB. With health logs, book highlights, and history entries, this limit is reachable. When it's hit, the save silently fails and all subsequent changes are lost until reload.

**Where**: `givelink.html:442`, `index.html:1564`

**Why it matters**: A user who has been logging workouts + sleep + importing Readwise highlights + storing AI history will eventually hit this limit. They'll keep using the app thinking their data is saved, then discover on reload that hours of work vanished.

**Effort**: S

**Suggested fix**:
- Wrap `localStorage.setItem()` in try/catch in both `save()` functions
- On `QuotaExceededError`, show a persistent banner: "Storage full — your changes could not be saved. Export your data or clear history to free up space."
- Add a storage usage indicator in Settings (both apps): `(JSON.stringify(S).length / 1024).toFixed(0) KB used`

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 10. Duplicate `callClaude` / `callClaudeGL` — two drifting implementations of the same function

**What**: `callClaude()` (`index.html:2724`) and `callClaudeGL()` (`givelink.html:1217`) are near-identical fetch wrappers for the Anthropic API. `callClaude` has proper `res.ok` checking and user-friendly error messages; `callClaudeGL` doesn't (see P0 item 2). Every improvement to one must be manually ported.

**Where**: `index.html:2724–2739`, `givelink.html:1217–1233`

**Why it matters**: This is already causing a divergence bug (P0 item 2). As more Claude features are added to Givelink, this gap will widen.

**Effort**: M

**Suggested fix**:
- Extract a shared `claude-api.js` module with the unified, well-tested `callClaude()` implementation
- Both HTML files `<script src="claude-api.js">` — no other changes needed to call sites
- The Vercel CSP in `vercel.json:14` already allows `script-src 'self'`; adding a local script file is fine

---

### 11. Both apps are single-file monoliths — index.html is ~5,500 lines

**What**: All HTML, CSS, and JavaScript live in single files. `index.html` exceeds 5,500 lines; `givelink.html` exceeds 1,700 lines. There is no module system, no component separation, and no way to test any logic in isolation.

**Where**: `index.html` (entire file), `givelink.html` (entire file)

**Why it matters**: Every new feature increases the cognitive load of the entire file. Finding a bug requires searching thousands of lines. The risk of accidental breakage on any edit is high — evidenced by the `#26` "Fix 7 bugs" commit being needed after a large feature addition.

**Effort**: L

**Suggested fix**:
- Start by extracting the largest logical blocks into separate `<script src="...">` files, in order of independence: `claude-api.js` → `storage.js` → `crm.js` → `health.js`
- Don't attempt a full rewrite — extract one feature at a time with no behavior changes
- Add ESLint as a dev dependency to catch obvious issues as files are split

---

### 12. `syncToTaskOS()` matches tasks by title substring — fragile and lossy

**What**: The cross-app sync between Givelink and Task OS matches tasks using `tt.title.toLowerCase() === gt.title.toLowerCase()`. Any title edit in either app breaks the link silently. Tasks with identical titles across different goals will incorrectly match.

**Where**: `givelink.html:1183–1208`

**Why it matters**: A user who renames a Givelink task (a common action) will find it re-added to Task OS as a duplicate on next sync. Over time this creates task proliferation in the inbox. The "sync" illusion breaks.

**Effort**: M

**Suggested fix**:
- Add a `glId` field to tasks when they are pushed to Task OS (`givelink.html:1197`)
- Match by `glId` first; fall back to title match only if `glId` is absent (backward compatibility)
- Show a sync diff summary in the toast: "2 updated, 3 added, 1 skipped (already synced)"

---

### 13. Readwise pagination URL construction will throw if `data.next` is malformed

**What**: The Readwise highlights paginator splits `data.next` on `?` to extract query params. If `data.next` is an unexpected format or empty string, `split('?')[1]` is `undefined` and the next fetch URL becomes `/highlights/?undefined`.

**Where**: `index.html:4764`

```js
url='/highlights/?'+data.next.split('?')[1];
```

**Why it matters**: Any book with more than 500 highlights (possible for dense non-fiction) will silently truncate at the first page, and the user sees only partial highlights with no error.

**Effort**: S

**Suggested fix**:
- Use `new URL(data.next).search` instead, which is null-safe and handles both absolute and relative URLs: `url='/highlights/'+new URL(data.next,location.origin).search`
- Add a guard: `if(!data.next)break;` already exists on line 4763 — ensure it runs before the URL construction, not after

---

### 14. Missing `type="button"` on action buttons inside modal forms

**What**: Buttons in modal forms (`givelink.html` and `index.html`) lack explicit `type="button"`. Any `<button>` without `type="button"` inside a `<form>` element defaults to `type="submit"` and will submit the form on click, causing a page reload.

**Where**: `givelink.html:127` (modal close button `.mc`), and many other buttons throughout both files

**Why it matters**: If a future refactor wraps modal content in a `<form>` (common when adding validation), all these buttons will trigger unexpected submissions. The `.mc` close button is already used everywhere and would be the first to break.

**Effort**: S

**Suggested fix**:
- Add `type="button"` to every `<button>` that is not a deliberate form submit button
- A single `sed -i 's/<button class="mc"/<button type="button" class="mc"/g'` handles the close buttons
- Add an ESLint rule `no-implicit-button-type` (or use the HTML validator) to catch future instances

---

### 15. Hardcoded name "Panos" in standup prompt — breaks for any other user

**What**: The AI standup generator prompt hardcodes `"Generate a daily standup for Panos"`. If Givelink is used by a team or demoed for potential partners, every generated standup mentions the wrong person.

**Where**: `givelink.html:1453`

```js
const prompt=`Generate a daily standup for Panos, founder of Givelink...`
```

**Why it matters**: Minimal — this is a personal tool — but it's a jarring inconsistency when demoing to investors or partners who see "Panos" in generated output. Takes 30 seconds to fix.

**Effort**: S

**Suggested fix**:
- Add a `S.ownerName` field to Givelink state, default `'Panos'`
- Reference it in the prompt: `` `Generate a daily standup for ${S.ownerName||'the founder'}` ``
- Expose it as an editable field in a future Givelink Settings panel (P3 item)

---

## 💡 P3 — Nice to have

---

### 16. PWA manifests use combined `"purpose": "any maskable"` on a single icon

**What**: Both `manifest.json` and `manifest-givelink.json` declare one icon with `"purpose": "any maskable"`. The spec requires separate icons for `any` and `maskable` because maskable icons need a 10% safe-zone and will look zoomed/cropped if used as-is.

**Where**: `manifest.json:12–18`, `manifest-givelink.json:10–17`

**Why it matters**: On Android, the maskable icon may display incorrectly in the app launcher. Low visual impact but easy to fix and affects install quality.

**Effort**: S

**Suggested fix**:
- Export two versions of each icon: one standard (full bleed, `"purpose": "any"`) and one with 10% padding on each side (`"purpose": "maskable"`)
- List both in the `icons` array

---

### 17. No data export in Givelink — user data is trapped in localStorage

**What**: Task OS has a "Reset Data" button but no export. Givelink has neither. All sprint history, CRM contacts, and backlog data exist only in the browser's localStorage with no backup mechanism.

**Where**: `givelink.html` (no export function exists)

**Why it matters**: A browser reinstall, accidental clear, or device change means total data loss. For a sprint planning tool, losing sprint history is a significant trust issue.

**Effort**: S

**Suggested fix**:
- Add `function exportData(){const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='givelink-'+new Date().toISOString().slice(0,10)+'.json';a.click();}` — ~5 lines
- Add an "Export" button to the sidebar or sprint bar
- Consider auto-export reminder after 30 days of usage

---

### 18. `document.execCommand('copy')` fallback is deprecated

**What**: The clipboard copy fallback in `givelink.html:1482` uses `document.execCommand('copy')`, which is deprecated in all major browsers and will eventually be removed.

**Where**: `givelink.html:1481–1483`

**Why it matters**: Low urgency as the primary `navigator.clipboard.writeText()` path works in all supported browsers. The fallback only triggers in very old browsers, which are unlikely to be used.

**Effort**: S

**Suggested fix**:
- Remove the `execCommand` fallback entirely; `navigator.clipboard.writeText()` is supported in all browsers that would run this app
- Show a user-facing error on rejection: `"Copy failed — please select and copy the text manually"`

---

### 19. `<meta name="description">` missing from `givelink.html`

**What**: `givelink.html` has no `<meta name="description">` tag. `index.html` also lacks one. Both are missing OG tags.

**Where**: `givelink.html:1–12`, `index.html:1–11`

**Why it matters**: Minimal SEO impact for what is currently a private tool. More relevant for the PWA install banner, which some browsers populate from the description meta tag.

**Effort**: S

**Suggested fix**:
- Add `<meta name="description" content="Givelink sprint board — goal tracking, nonprofit CRM, and AI-powered sprint planning.">` to `givelink.html:12`

---

### 20. `navigator.clipboard` used without `isSecureContext` check

**What**: `navigator.clipboard` is only available in secure contexts (HTTPS or localhost). If the app is ever accessed over HTTP (e.g., during local dev over a LAN), clipboard operations will throw uncaught TypeErrors.

**Where**: `givelink.html:1481`, and multiple copy buttons in `index.html`

**Why it matters**: Pure developer experience issue — will only bite during local development on non-localhost addresses.

**Effort**: S

**Suggested fix**:
- Guard all clipboard calls: `if(navigator.clipboard&&isSecureContext){...}else{fallback or toast("Copy not available over HTTP")}`

---

## Summary Table

| # | Priority | Effort | Area | File |
|---|----------|--------|------|------|
| 1 | P0 | S | Bug | `givelink.html:443` |
| 2 | P0 | S | Bug | `givelink.html:1224` |
| 3 | P0 | S | Bug | `sw.js:39` |
| 4 | P0 | S | Bug | `givelink.html:1042` |
| 5 | P1 | M | UX | `index.html:4829` |
| 6 | P1 | M | UX | `givelink.html:1047,1222,1392` |
| 7 | P1 | S | Brand | `givelink.html:17`, `manifest-givelink.json:7` |
| 8 | P1 | M | a11y | Both files, all `.mo` elements |
| 9 | P1 | S | Bug | `givelink.html:442`, `index.html:1564` |
| 10 | P2 | M | DX | `index.html:2724`, `givelink.html:1217` |
| 11 | P2 | L | DX | Both files (entire) |
| 12 | P2 | M | Bug | `givelink.html:1183` |
| 13 | P2 | S | Bug | `index.html:4764` |
| 14 | P2 | S | Bug | Both files, all `<button>` elements |
| 15 | P2 | S | UX | `givelink.html:1453` |
| 16 | P3 | S | PWA | Both manifest files |
| 17 | P3 | S | UX | `givelink.html` (missing feature) |
| 18 | P3 | S | DX | `givelink.html:1482` |
| 19 | P3 | S | SEO | `givelink.html:12` |
| 20 | P3 | S | DX | Both files, clipboard calls |
