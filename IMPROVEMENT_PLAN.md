# Givelink / Task OS — Improvement Plan

_Audited: 2026-06-14 | Scope: `index.html`, `givelink.html`, `sw.js`, `vercel.json`_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Supabase completely blocked in production by CSP

**What:** `vercel.json` CSP `connect-src` lists allowed hosts but omits `*.supabase.co`, so every Supabase fetch throws a CSP violation and fails silently for all production users.

**Where:** `vercel.json:14`

**Why it matters:** Cloud sync — the flagship persistence feature added in commit `67de902` — is 100% broken for anyone visiting the Vercel deployment. Users lose data without warning.

**Effort:** S

**Suggested fix:**
- Add `https://*.supabase.co` to the `connect-src` directive in `vercel.json:14`.
- Also add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` while you're there (see item 4).

---

### 2. Stored XSS via `toast()` rendering user-controlled HTML

**What:** `toast()` assigns its argument to `el.innerHTML` (line 2273). At line 3131, a raw task title is interpolated directly into the HTML string: `` `🗑 "<strong>${t.title.slice(0,30)}</strong>"` ``. A task named `</strong><img src=x onerror=alert(document.cookie)><strong>` would execute arbitrary JS.

**Where:** `index.html:2273` (toast), `index.html:3131` (call site), `index.html:2048` (checklist `c.text` in innerHTML without `esc()`)

**Why it matters:** Self-XSS in a single-user app is lower risk than in a multi-tenant product, but the attack surface is real: malicious import files, shared task lists, or future collab features would turn this into a full exploit.

**Effort:** S

**Suggested fix:**
- Replace `` `...<strong>${t.title.slice(0,30)}</strong>...` `` at line 3131 with `` `...<strong>${esc(t.title.slice(0,30))}</strong>...` ``
- In `_renderChecklistEditor()` (line 2048), replace `'+c.text+'` with `'+esc(c.text)+'`.
- Long-term: convert `toast()` to use `textContent` for the message part and build the Undo anchor separately via `document.createElement`.

---

### 3. `callClaudeGL` crashes on any non-200 Claude response

**What:** `callClaudeGL` in `givelink.html` calls `res.json()` unconditionally before checking `res.ok` (line 1269). When the API returns a 401, 429, or 500, the body is an error object, and `data.content[0].text` throws a TypeError that falls into the outer `catch` block — but there's no error message shown, just `null` returned silently.

**Where:** `givelink.html:1263–1271`

**Why it matters:** Any expired API key or rate-limit hit on the Givelink sprint planner silently fails with no feedback. Users assume the feature is broken.

**Effort:** S

**Suggested fix:**
- Add `if(!res.ok){ const err=await res.json().catch(()=>({}))); toast('AI error '+res.status+': '+(err.error?.message||res.statusText)); return null; }` before `res.json()`.
- Mirror the error-handling pattern already in `callClaude()` at `index.html:4141–4144`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Google Fonts blocked by CSP → wrong font in production

**What:** The app loads Inter via `<link href="https://fonts.googleapis.com/css2?family=Inter...">` but the CSP `style-src` does not include `https://fonts.googleapis.com` and `font-src` does not include `https://fonts.gstatic.com`. Fonts fail to load silently; the UI falls back to the browser's default sans-serif.

**Where:** `vercel.json:14`, font `<link>` tags in both `index.html` (lines ~9–12) and `givelink.html` (lines ~9–12)

**Why it matters:** The entire type system is designed around Inter. Without it, the UI looks unpolished and weights/tracking are off.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` in `vercel.json:14`.
- Alternatively, self-host the Inter subset and drop the external dependency entirely.

---

### 5. `window.prompt()` for API key in Givelink — blocks the UI thread

**What:** `getApiKey()` in `givelink.html` (line 1086) calls `prompt('Enter your Anthropic API key:')` when no key is found. This is a blocking native dialog that cannot be styled, cannot be dismissed with Escape on some mobile browsers, and interrupts any async flow mid-execution.

**Where:** `givelink.html:1086`, also `callClaudeGL:1261`

**Why it matters:** First-time users hitting any AI feature are confronted with a jarring system prompt dialog with no branding, no context, and no link to get an API key. This kills conversion for the AI sprint planner.

**Effort:** M

**Suggested fix:**
- Add a settings panel to `givelink.html` (already exists in `index.html` — copy the `<div id="set-claude-key">` pattern).
- Replace the `prompt()` call with `toast('Add your API key in Settings ⚙')` and open the settings modal.
- `index.html` already stores the key in `S.claudeKey`; `callClaudeGL` already checks `taskos` localStorage at line 1259 — just surface that path first.

---

### 6. `_aiBtn` wrapper has no catch — AI errors propagate uncaught

**What:** The `_aiBtn()` helper at `index.html:2258` wraps AI calls in `try/finally` but not `try/catch/finally`. If `fn()` throws (e.g., a network error, or an unhandled rejection from Claude), the error propagates to the caller uncaught, potentially crashing the event handler silently and leaving the UI in an inconsistent state for subsequent calls.

**Where:** `index.html:2258`

**Why it matters:** Every AI feature button goes through this path. A single uncaught exception here can break the `_aiInFlight` lock set, causing subsequent clicks to silently no-op ("already running").

**Effort:** S

**Suggested fix:**
```js
async function _aiBtn(btn, fn) {
  if (btn._aiRunning) return;
  btn._aiRunning = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spin-icon">⏳</span>';
  btn.disabled = true;
  try { await fn(); }
  catch(e) { toast('Error: ' + e.message); }
  finally { btn.innerHTML = orig; btn.disabled = false; btn._aiRunning = false; }
}
```

---

### 7. Silent stale UI after remote sync pulls new data

**What:** After `sbSyncNow()` applies a remote state, it calls `refresh()` wrapped in an empty `catch(e){}` (line 8624). If `refresh()` throws (e.g., during initial load before all DOM elements exist), the exception is swallowed and the UI displays stale data. There's no visual indicator that sync applied successfully.

**Where:** `index.html:8624`

**Why it matters:** Users enabling cloud sync on a second device may see their old data with no feedback that a sync occurred or failed to re-render. Trust in the sync feature erodes.

**Effort:** S

**Suggested fix:**
- Replace `try{refresh();}catch(e){}` with `try{refresh();}catch(e){console.warn('refresh after sync failed',e); toast('⚠ Sync applied but view refresh failed — reload to see changes');}`.
- Add a visible sync status badge (e.g., "⬇ Synced 3s ago") near the cloud icon rather than just updating the hidden settings panel status text.

---

### 8. No retry or backoff on Claude API rate limits

**What:** `callClaude()` handles a 429 response by showing a toast and returning `null` (line 4143). There is no retry, no exponential backoff, and no queue. If the user triggers two AI features in rapid succession, the second one permanently fails for the session.

**Where:** `index.html:4133–4149`

**Why it matters:** Haiku is cheap but the API does rate-limit. Power users who use the AI Lab heavily will hit this regularly and lose trust in the AI features.

**Effort:** M

**Suggested fix:**
- Add a simple retry loop (max 2 retries, 1s + 2s delays) inside `callClaude()` specifically for 429 responses.
- Show a toast: "Rate limited — retrying in 1s…" so users know it's working.
- Maintain a module-level flag to queue concurrent calls rather than fail them.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. CSP `'unsafe-inline'` defeats XSS protection

**What:** Both `script-src` and `style-src` in the production CSP include `'unsafe-inline'` (`vercel.json:14`). This means any inline script injected via the XSS vectors in items 2 and 11 would execute freely, rendering the CSP meaningless as a defense layer.

**Where:** `vercel.json:14`

**Why it matters:** CSP exists to limit XSS blast radius. With `'unsafe-inline'`, it provides no protection for scripts.

**Effort:** L

**Suggested fix:**
- Since all JS is in one monolithic `<script>` tag, the practical fix is a SHA-256 hash: compute `sha256(script content)` and use `'sha256-<hash>'` in `script-src` instead of `'unsafe-inline'`.
- For styles, extract critical CSS into a separate file so `style-src 'self'` applies cleanly.

---

### 10. Anthropic API key exposed client-side with explicit `dangerous-direct-browser-access` header

**What:** Both `callClaude()` (`index.html:4138`) and `callClaudeGL()` (`givelink.html:1266`) send the user's API key directly from the browser with the `anthropic-dangerous-direct-browser-access: true` header, which Anthropic requires only as an explicit acknowledgment that the developer understands the security tradeoff.

**Where:** `index.html:4138`, `givelink.html:1266`

**Why it matters:** Any browser extension, injected script, or network MITM can read the key from localStorage or intercept the header. This is a known design compromise, but is worth resolving when adding a backend.

**Effort:** L

**Suggested fix:**
- Deploy a minimal Vercel Edge Function (a single `api/claude.js` endpoint) that reads the key from an environment variable and proxies requests.
- Removes the key from the client entirely and makes the CSP's `connect-src` list shorter and more auditable.

---

### 11. Unescaped task title in `<option>` elements

**What:** `fillBlockerDrop()` at `index.html:2062` builds `<option>` elements with `'+t.title.slice(0,45)+'` without calling `esc()`. An injected `</option><option onclick=...>` title string could manipulate the dropdown.

**Where:** `index.html:2062`

**Why it matters:** Lower-severity injection risk but trivially fixed, and inconsistent with the codebase's own `esc()` helper already used elsewhere.

**Effort:** S

**Suggested fix:**
- Change line 2062 to use `'+esc(t.title.slice(0,45))+'` — a one-character function wrap.

---

### 12. Remote sync merges state blindly without schema validation

**What:** `sbSyncNow()` applies remote data with `S={...S,...remote.data}` (line 8620). If the remote data is from a future schema version (or is corrupt), it overwrites critical local fields with no validation. There's no schema version field checked.

**Where:** `index.html:8618–8622`

**Why it matters:** A future schema change that renames or removes a field will silently break the UI for any user whose remote state was written by a newer client. Hard to debug post-mortem.

**Effort:** M

**Suggested fix:**
- Add a `_schemaVersion` integer to the state object `S` and increment it on breaking changes.
- In `sbSyncNow()`, check `remote.data._schemaVersion <= CURRENT_SCHEMA_VERSION` before applying. If the remote version is higher, show a toast: "Remote data is from a newer version — update to sync."

---

### 13. Eight silent `catch(e){}` blocks making production failures invisible

**What:** The codebase has 8+ empty or nearly-empty catch blocks (`index.html:2433, 4516, 8624, 8657, 8675; givelink.html:1083`) that swallow exceptions without logging or notifying the user. Production failures in these paths are invisible.

**Where:** `index.html:2433, 4516, 8624, 8657, 8675`; `givelink.html:1083`

**Why it matters:** When users report "it just stopped working," there's no trace to diagnose. Empty catches are tech debt that compounds silently.

**Effort:** S

**Suggested fix:**
- Replace each `catch(e){}` with at minimum `catch(e){console.warn('[context]',e);}` so failures appear in DevTools.
- For user-visible operations (nav collapse persist, auto-snapshot), add a non-blocking toast for first-time failures.

---

## 💡 P3 — Nice to have

### 14. Icon-only buttons missing `aria-label` throughout `index.html`

**What:** Many action buttons across the dashboard use emoji or symbol-only content (e.g., `×`, `↺`, `⋯`, `🔔`) with only a `title` attribute. `title` is not read by most screen readers by default; these buttons are invisible to assistive technology.

**Where:** `index.html:617, 624, 625, 670, 706, 776` and ~60 similar occurrences (80 total `aria-label` usages in the file, but many buttons lack them)

**Why it matters:** Accessibility compliance and usability for keyboard-only users. Low impact today but becomes a blocker if the app is shared publicly.

**Effort:** M

**Suggested fix:**
- Add `aria-label="Close"` / `aria-label="Refresh"` / etc. to all icon-only `<button>` elements.
- Convert `title="..."` to `aria-label="..."` where both convey the same intent.

---

### 15. `importData` only validates `tasks` array — other keys silently reset

**What:** `importData()` at `index.html:2121` checks `if(!d.tasks||!Array.isArray(d.tasks))` then calls `Object.assign(S,d)` without verifying any other required fields (`goals`, `habits`, `people`, `finance`, etc.). An import file with only `{tasks:[]}` would wipe all other collections.

**Where:** `index.html:2115–2124`

**Why it matters:** Data import is irreversible (no undo). A bad file silently destroys years of habit, finance, and relationship data.

**Effort:** S

**Suggested fix:**
- Before `Object.assign`, confirm the backup was made by this app: check for at least 3–4 top-level keys (`goals`, `habits`, `settings` or equivalent).
- Show a diff summary in a confirmation modal: "This will import X tasks, Y goals, Z habits. Continue?"

---

### 16. Givelink PWA manifest missing shortcuts

**What:** `manifest-givelink.json` has no `shortcuts` array, while `manifest.json` has four. Installed PWA users on Android and desktop get no quick-launch shortcuts from the Givelink icon.

**Where:** `manifest-givelink.json` (entire file)

**Why it matters:** Minor but free UX win — shortcuts to "New Sprint Task" and "AI Sprint Planner" would reduce friction for daily standups.

**Effort:** S

**Suggested fix:**
- Add a `shortcuts` array to `manifest-givelink.json` with 2 entries: one pointing to `givelink.html#new-task` and one to `givelink.html#ai-planner`.
- Mirror the shortcut format from `manifest.json`.
