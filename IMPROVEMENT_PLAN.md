# Givelink / Arete — Improvement Plan
> Generated 2026-08-10

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

---

### 1. Anthropic API key stored in localStorage and sent directly from browser
**What:** `getApiKey()` in `givelink.html` stores the Anthropic API key in `localStorage` and passes it as a header in direct browser-side `fetch()` calls to `api.anthropic.com`.

**Where:** `givelink.html:1075–1088`, `1131–1144`, `1257–1271`

**Why it matters:** Any XSS vulnerability — now or in the future — exposes the key. The key is also visible to anyone who opens DevTools → Network and inspects the request headers. A stolen key lets an attacker run up unlimited Anthropic charges. The `anthropic-dangerous-direct-browser-access: true` header makes this risk explicit.

**Effort:** S

**Suggested fix:**
- Route all Claude calls through the existing `/api/claude` serverless proxy (`api/claude.js`), which already holds the key server-side.
- Remove the `getApiKey()` function entirely from `givelink.html`.
- Remove `anthropic-dangerous-direct-browser-access` headers from all browser fetches.

---

### 2. NP modal delete/log/advance buttons baked in on first render — wrong state on re-open
**What:** `_showNPModal()` creates the modal DOM once (`if(!m)`) with `${editNpId?...:''}` evaluated at that moment. When the modal is later opened in a different mode (add vs. edit), the buttons from the first render persist or are absent.

**Where:** `givelink.html:1358–1401`

**Why it matters:** If the modal is first opened in "add org" mode, the delete/log/advance buttons are never injected — they stay gone even when editing existing orgs. If it's first opened while editing, the delete button always shows — even when adding new orgs, risking accidental deletes.

**Effort:** S

**Suggested fix:**
- Move the mf button block out of the `if(!m)` template.
- After filling the fields, show/hide `#npm-del-btn`, `#npm-log-btn`, `#npm-advance-btn` explicitly with `style.display` based on `editNpId`.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

---

### 3. Google Fonts blocked by CSP — Inter font silently fails on Vercel
**What:** `index.html` loads Inter from `fonts.googleapis.com` / `fonts.gstatic.com`, but the `Content-Security-Policy` header in `vercel.json` has `style-src 'self' 'unsafe-inline'` (no `fonts.googleapis.com`) and `font-src 'self'` (no `fonts.gstatic.com`). The font request is blocked by the browser, falling back to system fonts.

**Where:** `vercel.json:15`, `index.html:14–16`

**Why it matters:** The Inter typeface is central to the Arete brand identity. Without it, the app renders in system fonts (Helvetica on Mac, Segoe UI on Windows), making the landing page look generic and inconsistent with the premium positioning.

**Effort:** S

**Suggested fix:**
- Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` in the CSP header in `vercel.json`.
- Or self-host Inter (download woff2 files, serve from `/fonts/`) to avoid the CSP change and reduce latency.

---

### 4. `toast()` renders raw HTML and is called with unescaped user data
**What:** `toast()` uses `t.innerHTML = msg` (`givelink.html:452`). Line 847 calls `toast(\`"${archive.name}" archived...\`)` where `archive.name` comes from user input. A sprint name like `<img src=x onerror=alert(1)>` would execute.

**Where:** `givelink.html:452`, `847`

**Why it matters:** Stored XSS via sprint name. Because the name is saved to `localStorage` and re-loaded, the payload persists across sessions.

**Effort:** S

**Suggested fix:**
- Change `t.innerHTML = msg` to `t.textContent = msg` in the `toast()` function.
- Use a wrapper function `toastSafe(text)` that calls `textContent` — or pass the message as a DOM tree if you need emoji rendered inline.

---

### 5. `window.prompt()` blocks the thread for API key entry and activity logging
**What:** Three `window.prompt()` calls block the browser thread: API key entry at `givelink.html:1086` and `1261`, activity logging at `1431`. On mobile, the native OS dialog is clunky and unstyled; on some browsers it's disabled entirely in iframes.

**Where:** `givelink.html:1086`, `1261`, `1431`

**Why it matters:** The AI Sprint Planner and AI Outreach Generator are conversion-critical features — they demonstrate product value. A native `prompt()` dialog immediately breaks the in-app feel and signals the product is unfinished. Activity logging via `prompt()` means no cancel-safe UX and no validation.

**Effort:** M

**Suggested fix:**
- Replace the API key prompt with a small inline modal (reuse `.mo/.md` pattern) with a password-type input and a "Save key" button.
- Replace the activity log prompt with a modal text area (same pattern as the existing task notes field).
- Consider adding a persistent Settings panel for API key management.

---

### 6. AI Sprint Planner calls `claude-opus-4-5` — the most expensive model for a structured task
**What:** `runAiSprintPlanner()` hard-codes `model: 'claude-opus-4-5'` (`givelink.html:1140`) while `callClaudeGL()` defaults to `claude-haiku-4-5-20251001`. The planner just needs structured JSON output from a well-defined prompt — Haiku handles this reliably at ~20× lower cost.

**Where:** `givelink.html:1140`

**Why it matters:** For a user who generates suggestions multiple times, the cost per session is significant. High latency from Opus also makes the feature feel slow.

**Effort:** XS

**Suggested fix:**
- Change `model: 'claude-opus-4-5'` → `model: 'claude-haiku-4-5-20251001'` in `runAiSprintPlanner()`.
- If output quality regresses, upgrade to `claude-sonnet-4-6` (mid-tier) before Opus.

---

### 7. Service worker push notification references a non-existent icon path
**What:** `sw.js:48` sets `icon: './icons/icon-192.png'` inside the push notification handler. The actual icon is at `./icon-192.png` (no `icons/` subdirectory). The notification banner shows a broken image on all platforms.

**Where:** `sw.js:48`, `sw.js:49`

**Why it matters:** Push notifications are a re-engagement mechanism. Showing a broken icon undermines trust and looks unprofessional; iOS and Android both prominently display the notification icon.

**Effort:** XS

**Suggested fix:**
- Change `icon: './icons/icon-192.png'` → `icon: './icon-192.png'`
- Change `badge: './icons/icon-192.png'` → `badge: './icon-192.png'` on line 49 as well.

---

### 8. Givelink Sprint Board uses blue (#3b82f6) — completely off-brand
**What:** `givelink.html` defines `--accent: #3b82f6` (Tailwind blue) as its primary color throughout: sprint bar, active nav items, focus rings, progress fills, FAB shadow, and the `<meta name="theme-color">` tag. The Givelink brand palette is purple (`#6B3FA0`/`#5718CA`) and pink (`#C2185B`/`#E353B6`).

**Where:** `givelink.html:17–18` (CSS variables), `givelink.html:6` (theme-color meta)

**Why it matters:** The Sprint Board is a Givelink-branded tool (logo says "Givelink", not "Arete"). Any screenshot, screen share, or external link sends the wrong brand signal. The Arete app (index.html) already uses the correct violet/purple palette.

**Effort:** S

**Suggested fix:**
- Replace `--accent: #3b82f6` with `--accent: #5718CA` (or `#6B3FA0` for a softer variant).
- Update `--prog: #3b82f6` to the same purple.
- Update `<meta name="theme-color" content="#3b82f6">` to the brand purple.
- Audit derived color usages (FAB shadow, sprint bar fills) — most will inherit from `--accent`.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

---

### 9. `save()` has no localStorage quota error handling — silent data loss risk
**What:** `save()` in `givelink.html:447` calls `localStorage.setItem('givelink_sprint', JSON.stringify(S))` with no `try/catch`. The seeded task list is ~80 tasks. As nonprofits and snapshots accumulate, the serialized state could exceed the 5 MB browser quota, throwing a `QuotaExceededError` that's completely swallowed.

**Where:** `givelink.html:447`

**Why it matters:** The app silently stops saving. The user continues working and closes the tab, losing all recent changes with no warning.

**Effort:** S

**Suggested fix:**
```js
function save() {
  try {
    localStorage.setItem('givelink_sprint', JSON.stringify(S));
  } catch (e) {
    toast('⚠️ Storage full — some changes may not be saved.', 5000);
  }
}
```

---

### 10. Two divergent API key lookup paths in `givelink.html`
**What:** `getApiKey()` (`givelink.html:1075`) looks in `taskos_profiles → taskos_data_<id>.apiKey` then falls back to `taskos_api_key`. `callClaudeGL()` (`givelink.html:1257`) looks in `taskos_api_key` then `taskos` then prompts. They don't share the same lookup order and could find different (or no) keys for different features.

**Where:** `givelink.html:1075–1088`, `1257–1262`

**Why it matters:** A user who saved their key through one path might find AI features working in some places but broken in others. Debugging is confusing.

**Effort:** S

**Suggested fix:**
- Extract a single `getGLApiKey()` helper with one consistent lookup chain.
- Have both `getApiKey()` and `callClaudeGL()` call it.

---

### 11. `document.execCommand('copy')` deprecated — will break in future Chromium
**What:** The clipboard fallback in `givelink.html:1521` and `1621` uses `document.execCommand('copy')`, which is deprecated and flagged for removal in Chromium.

**Where:** `givelink.html:1521`, `1621`

**Why it matters:** Copy-to-clipboard in the Standup Generator and Outreach Email features will silently fail when Chromium removes it.

**Effort:** XS

**Suggested fix:**
- Use only `navigator.clipboard.writeText()` with a `.catch()` that shows a toast with "Press Ctrl+C to copy" rather than falling back to `execCommand`.

---

### 12. API proxy has no rate limiting — any authenticated user can exhaust your Anthropic budget
**What:** `api/claude.js` acknowledges this in a comment: "For production add per-user rate limiting." With `SUPABASE_URL` set, it gates on a valid session, but every signed-in user can call the proxy with no per-minute or per-day cap.

**Where:** `api/claude.js:12–13`

**Why it matters:** A single abusive or compromised account can exhaust the Anthropic quota before you notice.

**Effort:** M

**Suggested fix:**
- Add Upstash Redis (free tier) with a `rate-limiter-flexible` check: e.g., 20 requests per user per 24h.
- Return HTTP 429 with a `Retry-After` header when the limit is exceeded.

---

### 13. OG/Twitter image and canonical URL still reference the Vercel preview domain
**What:** `index.html:24,26` and `landing.html:11` hard-code `https://task-management-beige-eight.vercel.app/` as the canonical URL and OG image base. This is the Vercel auto-generated subdomain, not a branded domain.

**Where:** `index.html:24–29`, `landing.html:11`

**Why it matters:** When someone shares the app on Twitter/LinkedIn, the preview card shows the raw Vercel URL in the meta. It also blocks proper SEO consolidation if a custom domain is ever added.

**Effort:** XS

**Suggested fix:**
- Update all canonical/OG URLs to the production domain once one is established.
- Or parameterize via a `<base>` tag or a build step to avoid future drift.

---

## 💡 P3 — Nice to have

---

### 14. Nonprofit CRM has no search or filter — will become unusable at scale
**What:** The CRM kanban (`givelink.html:1299`) renders all nonprofits grouped by pipeline stage with no search, name filter, or city filter.

**Where:** `givelink.html:1299–1345`

**Why it matters:** At 20–30 nonprofits the kanban becomes hard to scan. A name filter input above the kanban would cost ~15 lines and pay off immediately.

**Effort:** S

**Suggested fix:**
- Add a text input above the kanban that filters `nps` by `name.toLowerCase().includes(query)` before rendering columns.

---

### 15. "← Task OS" cross-link in Givelink sidebar may confuse new visitors
**What:** `givelink.html:225` shows `← Task OS` linking to `index.html`. Since commit #73 ("Remove Givelink from Task OS"), the two products are intentionally separate. A nonprofit visiting the Givelink Sprint Board via a direct link doesn't know what "Task OS" is.

**Where:** `givelink.html:225`

**Why it matters:** Low friction for power users (founders) who use both. Confusing for partners or nonprofits who only have the Givelink URL.

**Effort:** XS

**Suggested fix:**
- Replace the link with a "givelink.io" home link, or remove it entirely if the target audience is internal only.

---

### 16. Burndown chart has no y-axis labels or legend — hard to interpret
**What:** The SVG burndown chart (`givelink.html:754–775`) renders two polylines with no axis labels, no legend distinguishing ideal vs. actual, and no tooltip on hover.

**Where:** `givelink.html:754–775`

**Why it matters:** Without a legend, the dashed blue line (ideal) and green line (actual) are ambiguous to anyone seeing the chart for the first time.

**Effort:** S

**Suggested fix:**
- Add two colored legend chips (`<span>` rows) below the SVG: "— Ideal" (blue) and "— Actual" (green).
- Optionally add a y-axis tick for 0% and 100% completion.
