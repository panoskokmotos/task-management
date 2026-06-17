# Givelink / Task OS — Improvement Plan

_Audit date: 2026-06-17. Covers `index.html` (12,893 lines), `givelink.html` (1,755 lines), `sw.js`, and `vercel.json`._

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. CSP blocks Inter font in production — app ships with system font fallback

**What:** The Content-Security-Policy in `vercel.json` lists `font-src 'self'` and `style-src 'self' 'unsafe-inline'`, but `index.html` loads Inter from `fonts.googleapis.com` / `fonts.gstatic.com`. Both domains are absent from the CSP, so browsers silently block them.

**Where:** `vercel.json:14` (CSP header), `index.html:12-14` (font imports)

**Why it matters:** Every user on the deployed Vercel instance gets system font (Arial/Helvetica) instead of Inter. Typography-heavy UI looks degraded and unpolished — the exact opposite of the "world-class" goal stated in recent commits.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src`
- Add `https://fonts.gstatic.com` to `font-src`
```diff
-"style-src 'self' 'unsafe-inline'; ... font-src 'self';"
+"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ... font-src 'self' https://fonts.gstatic.com;"
```

---

### 2. Push notifications silently fail — icon path doesn't exist in repo

**What:** `sw.js` references `./icons/icon-192.png` for push notification icon and badge, but the `icons/` directory does not exist in the repo (only `icon.svg` and `icon-gl.svg` are present).

**Where:** `sw.js:38-39`, `index.html:9286`

**Why it matters:** Any user who granted notification permission (Reminders feature, ntfy integration) receives notifications with broken icons — on Android this shows a generic placeholder; on some iOS versions the notification is silently dropped entirely.

**Effort:** S

**Suggested fix:**
- Change icon references to use the existing SVG files:
```diff
-icon:'./icons/icon-192.png',
-badge:'./icons/icon-192.png',
+icon:'./icon.svg',
+badge:'./icon.svg',
```
- Or add a proper `icons/` directory with PNG files to match the current path (needed anyway for a complete PWA install on Android).

---

### 3. AI Sprint Planner crashes on unexpected Claude API response

**What:** `runAiSprintPlanner()` accesses `data.content[0].text.trim()` with no optional chaining. If the API returns an error body, a stream-truncated response, or a format change (e.g., `content` is empty or missing), this throws `TypeError: Cannot read properties of undefined`.

**Where:** `givelink.html:1147`

```js
// DANGEROUS — no null guard:
const raw = data.content[0].text.trim();
```

**Why it matters:** The AI Sprint Planner is a headline feature of Givelink. Any rate-limit, token-limit, or network blip leaves the modal frozen with a spinner and a JS console error — the user has no idea why and can't recover.

**Effort:** S

**Suggested fix:**
```js
const raw = data.content?.[0]?.text?.trim();
if (!raw) throw new Error('Empty response from Claude — try again');
```

---

### 4. `callClaudeGL` (standup / outreach generator) silently swallows HTTP errors

**What:** `callClaudeGL()` calls `await res.json()` regardless of `res.ok`, then returns `data.content?.[0]?.text||null`. When Claude returns a 401, 429, or 529, the response body is an error object with no `content` field — the function returns `null` silently.

**Where:** `givelink.html:1263-1271`

```js
try {
  const res = await fetch('https://api.anthropic.com/v1/messages', {...});
  // res.ok is never checked here ↑
  const data = await res.json();
  return data.content?.[0]?.text || null;  // null on error, no toast
} catch(e) { toast('AI error: ' + e.message); return null; }
```

**Why it matters:** When the standup generator or outreach drafter fails (invalid key, quota exceeded), the modal shows no content and no error message. Users assume the feature is broken and lose trust.

**Effort:** S

**Suggested fix:**
```js
const res = await fetch(...);
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  const msg = res.status === 429 ? 'Rate limit — wait and retry'
    : res.status === 401 ? 'Invalid API key — check Settings'
    : `AI error ${res.status}: ${err.error?.message || res.statusText}`;
  toast(msg); return null;
}
```

---

### 5. Default sprint in `givelink.html` expired 67 days ago

**What:** The fallback `S` state has `sprint.start:'2026-03-28', sprint.end:'2026-04-11'`. Today is 2026-06-17. For any user whose `givelink_sprint` localStorage key was never set (new device, incognito), the sprint appears to have ended 67 days ago.

**Where:** `givelink.html:437`

**Why it matters:** New users see "0 days left", a sprint progress bar at 100%, and a burndown chart with no data. This is the worst possible first impression for a sprint board. The sprint is already over on load.

**Effort:** S

**Suggested fix:**
```js
// Compute relative default dates at definition time:
const _today = new Date().toISOString().slice(0, 10);
const _end = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

let S = {
  sprint: { name: 'Sprint 1', start: _today, end: _end },
  // ...
};
```

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 6. Givelink brand color is blue (#3b82f6), not the brand purple (#6B3FA0)

**What:** `givelink.html` CSS uses `--accent:#3b82f6` (Tailwind blue-500) as the primary color for all CTAs, active nav states, progress bars, and the FAB. The stated Givelink brand palette is purple `#6B3FA0` / `#5718CA` with pink accents `#E353B6`.

**Where:** `givelink.html:17`, `manifest-givelink.json:6` (`theme_color: "#3b82f6"`)

**Why it matters:** Givelink looks like a reskinned version of Task OS (which also uses blue). Every branded touchpoint — the sprint board, the CRM kanban, the AI planner — carries the wrong visual identity. Investors and nonprofit partners who see the product see "generic blue SaaS," not the Givelink brand.

**Effort:** M

**Suggested fix:**
- Replace `--accent:#3b82f6` with `--accent:#5718CA` (or `#6B3FA0` for a softer variant)
- Replace `--pr:#f472b6` with `--pr:#E353B6` (brand pink)
- Update `manifest-givelink.json` `theme_color` and `meta name="theme-color"` to `#5718CA`
- Test: no pink text on purple backgrounds (confirmed: pillars use pink only as sidebar pip color, not background)

---

### 7. 280+ clickable `<div>` elements — keyboard users can't navigate either app

**What:** Both apps implement navigation, task cards, and action items as `<div onclick="...">` rather than `<button>` or `<a>`. Neither `role="button"` nor `tabindex="0"` is consistently applied.

**Where:** `index.html` (sidebar nav ~line 575-620, task cards ~line 3500+), `givelink.html:233-244` (all nav items)

**Why it matters:** Tab-key navigation skips every nav item, task card, and pillar switcher. Any keyboard-reliant user — keyboard power users, mobile with Bluetooth keyboard, accessibility users — cannot use the app. WCAG 2.1 Level A failure (SC 4.1.2).

**Effort:** M

**Suggested fix:**
- Convert sidebar `<div class="ni" onclick>` to `<button class="ni" onclick>` — CSS already styles these correctly, the change is mechanical
- For task cards (`.tc`), add `tabindex="0"` and `onkeydown="if(e.key==='Enter'||e.key===' ')openTask(this)"` or convert to buttons with `role="group"`
- Start with nav items (highest impact per line of change)

---

### 8. All modal close buttons have no accessible name

**What:** Every close button is `<button class="mc" onclick="closeM(...)">×</button>` — the visible content is the `×` character, which screen readers announce as "times" or the Unicode name "multiplication sign."

**Where:** `givelink.html:317, 372, 380, 406` and every modal in `index.html` (~30 instances)

**Why it matters:** Screen reader users hear "multiplication sign, button" with no context. They cannot close a dialog without knowing its position in the tab order. WCAG 2.1 Level A failure.

**Effort:** S

**Suggested fix:**
```html
<!-- Before -->
<button class="mc" onclick="closeM('tm')">×</button>
<!-- After -->
<button class="mc" onclick="closeM('tm')" aria-label="Close">×</button>
```
This is a global find-and-replace across both files.

---

### 9. PWA manifest shortcuts use fragment URLs — they do nothing

**What:** `manifest.json` defines shortcuts like `url: "./index.html#quick-add"` and `url: "./index.html#journal"`. The app uses a view-switching model (`nav('capture')`) — not hash routing. When a user taps a home-screen shortcut, the app opens but ignores the fragment.

**Where:** `manifest.json:29-57`

**Why it matters:** PWA shortcuts are a key re-engagement driver on Android and desktop. Any user who has installed the app to their home screen and taps "Add Task" or "Journal" is silently dropped to the dashboard instead. The feature is built but completely non-functional.

**Effort:** S

**Suggested fix:**
```js
// In the init block of index.html, after load():
const frag = location.hash.replace('#', '');
const fragToView = { 'quick-add': 'capture', 'journal': 'eod', 'coach': 'ailab', 'reflect': 'review' };
if (fragToView[frag]) { nav(fragToView[frag]); history.replaceState(null, '', location.pathname); }
```

---

### 10. No error feedback when Claude API features run silently against missing key

**What:** In `givelink.html`, `getApiKey()` (line 1075) falls back to `window.prompt()` — but in many in-app contexts (e.g., standup triggered from a button inside a modal), the prompt appears behind the modal overlay and is invisible on some browsers.

**Where:** `givelink.html:1085-1086`, `givelink.html:1261`

**Why it matters:** Users click "Generate Standup" and nothing happens — or they see a blank prompt that they dismiss, leaving the feature non-functional. No inline UI explains where to configure the key.

**Effort:** S

**Suggested fix:**
- Remove the `window.prompt()` fallback entirely
- When key is missing, show a dismissible inline callout: `"Add your Anthropic API key in <a onclick='nav(\"settings\")'>Settings</a> to use AI features."`
- Both files should check for a key from the same `S.claudeKey` storage location, not two different `localStorage` keys (`taskos_api_key` vs `S.claudeKey`)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 11. `callClaudeGL` and `callClaude` are duplicate API wrappers with divergent error handling

**What:** `index.html` has `callClaude()` (line 4133) with full status-code branching (401, 429). `givelink.html` has `callClaudeGL()` (line 1256) and an inline fetch in `runAiSprintPlanner()` (line 1130) — three separate implementations of the same Claude API call, each with different error handling quality.

**Where:** `index.html:4133-4149`, `givelink.html:1097-1161`, `givelink.html:1256-1272`

**Why it matters:** A fix to one (e.g., handling 529 overload) must be applied three times. The weakest implementation (`callClaudeGL`) is what Givelink users hit. Adding streaming or model-switching requires three edits.

**Effort:** M

**Suggested fix:**
- Extract a shared `callClaudeAPI(apiKey, prompt, opts)` function that lives near the top of each file (or in a shared `<script src="claude-client.js">`)
- Single place to update model, version header, retry logic, and error messages

---

### 12. `_autoSnapshot()` has a fully silent `catch(e) {}` — data loss goes undetected

**What:** The daily auto-snapshot function that feeds the Pace Engine trend data wraps everything in `try { ... } catch(e) {}` with an empty catch block. Any failure (localStorage full, corrupt state, JSON serialization error) is silently ignored.

**Where:** `index.html:8643-8658`

**Why it matters:** The Pace Engine is the key Givelink OS "north star" feature. If snapshots stop saving (e.g., storage quota exceeded on a long-time user's device), the trend charts go flat or stale with no indication. User thinks the feature is broken or that their metrics aren't growing.

**Effort:** S

**Suggested fix:**
```js
} catch(e) {
  console.warn('[autoSnapshot] failed:', e);
  // Optionally: toast a low-priority warning if this fails 3+ days in a row
}
```

---

### 13. No localStorage quota guard — silent write failures as data grows

**What:** Neither app checks `localStorage` remaining capacity before writing. `index.html`'s `S` object is extremely large (tasks, goals, health logs, finance entries, books, relationships, wins, okrs, deep work sessions, quarterly reviews, etc.). On a long-time user's device, `JSON.stringify(S)` could push past the 5-10MB browser limit.

**Where:** `index.html:2107` (`save()` function), `givelink.html:447` (`save()` function)

**Why it matters:** When localStorage is full, `setItem` throws a `QuotaExceededError`. The current `save()` functions have no try/catch, so the write fails silently and the user loses their last change with no feedback.

**Effort:** S

**Suggested fix:**
```js
function save() {
  try {
    localStorage.setItem('taskos', JSON.stringify(S));
  } catch(e) {
    if (e.name === 'QuotaExceededError') {
      toast('⚠️ Storage full — old data may need pruning in Settings', 5000);
    }
  }
}
```

---

### 14. `S` state object initialized with 70+ keys in one flat declaration

**What:** The main state `S` in `index.html` is a single object literal with 70+ top-level keys (line 2036), including deeply nested structures (`givelinkMetrics.impactModel`, `sfTimeline`, `agiPrep`, etc.). Every `load()` does a shallow `{...S, ...JSON.parse(...)}` merge, which means any key added to the schema is silently dropped from existing saved state.

**Where:** `index.html:2036-2038`, `index.html:2107`

**Why it matters:** Every new feature that adds a key to `S` requires careful ordering in the merge — the default value must be present in the declaration, or old saves lose the new field. This has already caused at least 4 bugs in the last 14 commits (the recent "Fix 4 bugs" and "Fix three bugs" commits). The merge pattern is a latent bug factory.

**Effort:** L

**Suggested fix:**
- Short-term: use deep merge instead of `{...S, ...parsed}`:
```js
function deepMerge(defaults, saved) {
  const out = { ...defaults };
  for (const k of Object.keys(saved)) {
    out[k] = (saved[k] !== null && typeof saved[k] === 'object' && !Array.isArray(saved[k]))
      ? deepMerge(defaults[k] ?? {}, saved[k])
      : saved[k];
  }
  return out;
}
```
- Long-term: schema versioning with migrations

---

## 💡 P3 — Nice to have

---

### 15. `manifest-givelink.json` has no shortcuts or share target

**What:** Task OS manifest has 4 shortcuts and a `share_target`. Givelink manifest has none.

**Where:** `manifest-givelink.json`

**Why it matters:** Home-screen Givelink users can't quick-add tasks or open the CRM directly. Minor UX gap vs Task OS.

**Effort:** S

**Suggested fix:** Add shortcuts for "Add Task" and "Open CRM" mirroring the Task OS pattern, and wire them up with the same fragment-routing fix from P1 item 9.

---

### 16. `font-src` CSP also blocks Readwise / Notion proxy fonts (future-proofing)

**What:** If either Readwise or Notion API responses include font references (possible in Notion page renders), they'd be blocked by `font-src 'self'`. More immediately, the Google Fonts fix in P0 item 1 is the only blocker, but the policy is generally too narrow.

**Where:** `vercel.json:14`

**Why it matters:** Low risk today, but adding any third-party embed will require another CSP edit.

**Effort:** S

**Suggested fix:** After the P0 fix, also review `connect-src` — `https://api.notion.com` is listed but Notion's CDN (`https://www.notion.so`) is not, which could block image/file embeds.

---

### 17. API key lookup in `givelink.html` reads from two different localStorage keys

**What:** `getApiKey()` checks `taskos_profiles` → profile data, then falls back to `taskos_api_key`. `callClaudeGL()` checks `taskos` → `claudeKey`, then falls back to `taskos_api_key`. These are three different storage locations for the same credential.

**Where:** `givelink.html:1075-1088`, `givelink.html:1257-1261`

**Why it matters:** A user who configures their key in Task OS Settings (stored as `S.claudeKey` → serialized as `taskos`) may find Givelink's AI features don't see it, depending on which lookup path wins.

**Effort:** S

**Suggested fix:** Standardize on a single lookup order: `S.claudeKey` from `taskos` localStorage, with one fallback. Remove the `taskos_api_key` key entirely and migrate on first read.

---

### 18. `confirm()` / `prompt()` dialogs used for destructive actions and data entry

**What:** `logActivityNP()` uses `window.prompt()` to capture activity notes. `deleteNP()` uses `window.confirm()`. These native dialogs block the browser thread, can't be styled, are inaccessible on some mobile browsers, and are silently blocked in some PWA contexts.

**Where:** `givelink.html:1431`, `givelink.html:1425`

**Why it matters:** On iOS PWA, `window.prompt()` often does nothing (returns `null` immediately). Tapping "Log Activity" silently fails for iOS home-screen users — a frequent pattern given the mobile-first polish focus.

**Effort:** M

**Suggested fix:** Replace with inline modal inputs (the pattern already exists for task editing). Reuse the existing modal infrastructure (`_showNPModal`) for a lightweight "Log activity" modal with a `<textarea>` and Save/Cancel.
