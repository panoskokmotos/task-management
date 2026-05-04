# Weekly Triage — 2026-05-04

## 📊 Week at a glance
- Commits: 2 | Files changed: 3 (`givelink.html`, `index.html`, `sw.js`) | Debt markers added: 5
- High-churn files: `givelink.html` (1,539 line delta across both commits), `index.html` (489 line delta)
- Commit pattern: one feature commit (`b67d96e`) merged immediately into `fc79d54` — no test commits followed

---

## 🚨 Needs immediate attention

### 1. SW update banner fires twice on every update — both apps
**`givelink.html:1685–1692` | `index.html:3933–3939`** — commit `b67d96e`

`showUpdateBanner()` is called from two separate paths: `updatefound → statechange='activated'` and `controllerchange`. Because `sw.js` calls `skipWaiting()` + `clients.claim()` immediately, **both events always fire**. The `_swRefreshing` guard only covers the `controllerchange` path, so `showUpdateBanner()` runs twice on every deploy. Currently harmless (idempotent `style.display='flex'`), but the guard logic is broken and will hide real bugs if the handler grows.

---

### 2. Two independent API key retrieval paths in `givelink.html`
**`givelink.html:1036` (function `getApiKey`) and `givelink.html:1218` (inline in `callClaudeGL`)** — commit `fc79d54`

`getApiKey()` scans `taskos_profiles` + `taskos_data_*` entries then falls back to `taskos_api_key`. `callClaudeGL()` does its own lookup: `taskos_api_key` → `taskos` JSON `.claudeKey`. These read **different key sources** in a different order. A user with a key stored only in a profile will get the key from `getApiKey()` but hit a prompt from `callClaudeGL()`. The prompt at line 1222 calls `window.prompt()` which blocks the main thread and is broken in PWA standalone mode on iOS.

---

### 3. API key stored unencrypted in `localStorage`, leaked via `prompt()`
**`givelink.html:1047`, `givelink.html:1222`** — commit `fc79d54`

`localStorage` values are accessible to any injected script. More critically, `prompt()` is used to collect the API key — its value is visible in browser history on some platforms. If any third-party script is ever added (analytics, embeds), the key is fully exposed. `index.html` stores the key in `S.claudeKey` (in-memory + `save()` to localStorage) which is slightly better but the same underlying risk.

---

### 4. `index.html:4647` — update-banner has `display:none` declared twice
**`index.html:4647`** — commit `b67d96e`

```html
<div id="update-banner" style="display:none;...;display:none;align-items:...">
```

The second `display:none` overrides `align-items:center` cascade in some parsers and confirms the element was assembled by copy-paste. `showUpdateBanner()` sets `style.display='flex'` in JS so it works today, but this is fragile — a CSS specificity change could cause the banner to never display `flex` correctly.

---

## 🧹 Cleanup opportunities

### 5. Empty `catch(e){}` swallows errors silently
**`givelink.html:1044`** — commit `fc79d54`

Inside `getApiKey()`, the loop parsing profile data swallows all errors. A corrupted `taskos_data_*` entry will silently skip, and the user gets an unexpected API key prompt with no explanation.

---

### 6. Empty `catch(e){}` on AI briefing cache parse
**`index.html:4065`** — commit `fc79d54`

```js
try{const d=JSON.parse(cached);_renderAIBriefing(d,el);}catch(e){}
```

If the cached briefing is corrupt, this silently fails and the AI briefing widget shows nothing. User sees a blank card with no error or retry path.

---

### 7. `renderCRM()` is ~105 lines — well over the 50-line threshold
**`givelink.html:1260`** — commit `fc79d54`

The function builds the full nonprofit CRM HTML string, handles all 6 pipeline stages, filters, and activity lists inline. It makes future edits to the CRM view risky (hard to test in isolation, easy to break the string template).

---

### 8. `gl_ios_shown` and `gl_pwa_dismissed` are separate keys that diverge
**`givelink.html:1641`, `1633`, `1663`, `1709`** — commit `b67d96e`

iOS users who see the hint get `gl_ios_shown='1'` set. If they later dismiss the banner via the ✕ button, `gl_pwa_dismissed='1'` is also set. But if a user clears only part of localStorage (e.g. clearing app data but keeping one key), they can get into a state where the iOS hint re-appears despite having dismissed it. `index.html` uses a single key (`pwa_install_dismissed`) consistently — `givelink.html` should match.

---

### 9. No tests shipped with 10 new automations
Commit `fc79d54` added: Nonprofit CRM, AI Standup Generator, Sprint Velocity Monitor, Impact Counter, AI Outreach Email, AI Morning Briefing, Inbox AI Triage, Relationship Outreach Draft, Goal Progress AI Digest, Quick Capture hotkey. Zero test commits followed. For a pure client-side app this may be accepted practice, but the AI prompt functions (`callClaudeGL`, `callClaude`) have no input validation — a `null` task list passed to a prompt template will silently send a malformed prompt.

---

## 🤔 Worth a second look

### 10. `statechange='activated'` may never fire after `skipWaiting()`
**`givelink.html:1685–1686`** — commit `b67d96e`

The code listens for `statechange` on `reg.installing`, but since `sw.js` calls `self.skipWaiting()` in the `install` handler, the SW transitions from `installing → activating → activated` very fast — potentially before the `statechange` listener is attached in the `.then()` callback. The `controllerchange` event is the reliable signal. The `statechange` path may therefore **never fire**, making the dual-path design misleading.

---

### 11. `callClaudeGL` and `callClaude` — two separate AI wrappers, no shared retry/error logic
**`givelink.html:1215` and `index.html:2210`** — commit `fc79d54`

Each HTML file has its own Claude wrapper with slightly different behavior: `givelink.html` shows `toast('AI error: '+e.message)`, `index.html` also shows a toast. Both use `anthropic-dangerous-direct-browser-access: true` (required for direct browser calls but worth flagging in review). If the API shape changes or rate limiting needs to be added, it must be updated in two places.

---

### 12. iOS install hint shows even if PWA install is not possible on that iOS version
**`givelink.html:1636–1645`** — commit `b67d96e`

The iOS check is `/iphone|ipad|ipod/i` with no version gate. iOS < 11.3 doesn't support "Add to Home Screen" for PWAs. Very edge-case given iOS 11 market share, but the hint text will confuse users on older devices who follow the steps and nothing happens.

---

*Total items: 12. Generated from commits `b67d96e` and `fc79d54` (past 7 days). No hotfix/revert/wip commits detected.*
