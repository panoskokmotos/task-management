# Givelink / Task OS — Improvement Plan
> Generated 2026-07-17

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. CRM modal Delete/Log Activity buttons are frozen after first render
- **What**: `_showNPModal()` creates the modal DOM once and reuses it. The Delete and Log Activity buttons are rendered from `editNpId` at creation time, so they're permanently stuck in the state of the *first* call — Delete always shows (or never shows) regardless of add vs edit mode.
- **Where**: `givelink.html:1358–1390`
- **Why it matters**: A user who adds a new org after previously editing one will see a Delete button in the Add form. Clicking it deletes the wrong org (the previously edited one), silently destroying data.
- **Effort**: S
- **Suggested fix**:
  - Remove the conditional `${editNpId?...}` inside the static `innerHTML` block.
  - Instead, after setting `m.classList.remove('hidden')`, imperatively toggle the Delete/Log/Advance buttons based on `editNpId`.
  - Or always include them but hide with `display:none`, then show/hide after every `_showNPModal()` call.

---

### 2. Givelink sprint dates are in the past for every new user
- **What**: The seeded sprint runs 2026-03-28 → 2026-04-11. Today is 2026-07-17. Every new user lands on "0 days left", velocity shows ∞ tasks/day, ETA chip errors, and the burndown is flat.
- **Where**: `givelink.html:437`
- **Why it matters**: Core metrics are all wrong on first launch. A founder showing this to a nonprofit prospect or investor sees a broken app, not a sprint board.
- **Effort**: S
- **Suggested fix**:
  - In `seed()`, compute start/end dynamically: `const s=new Date(); const e=new Date(); e.setDate(s.getDate()+14);`
  - Use `s.toISOString().slice(0,10)` and `e.toISOString().slice(0,10)` as defaults.

---

### 3. Push notification icon path is a 404
- **What**: The service worker references `./icons/icon-192.png` for push notification icons, but the file lives at `./icon-192.png` (no `icons/` subdirectory).
- **Where**: `sw.js:42–43`
- **Why it matters**: Every push notification shows without the app icon, breaking brand trust and making notifications look like browser-generic alerts. Also applies to the badge.
- **Effort**: S
- **Suggested fix**:
  - Change `icon:'./icons/icon-192.png'` → `icon:'./icon-192.png'`
  - Change `badge:'./icons/icon-192.png'` → `badge:'./icon-192.png'`

---

### 4. Standup modal burns an API call every time it opens
- **What**: `openStandup()` calls `generateStandup()` unconditionally. Re-opening the standup modal (e.g. to copy text) triggers a fresh Claude call with 200-token output, wasting ~$0.01 per accidental re-open.
- **Where**: `givelink.html:1481–1483`
- **Why it matters**: At ~$0.01/call, a user who opens the standup 5 times to copy/paste burns ~$0.05 in tokens. In a team setting this adds up fast. Also adds 2–4s of latency on every open.
- **Effort**: S
- **Suggested fix**:
  - Cache the generated text on `S.standupCache = {date, text}`.
  - In `openStandup()`, show the cache if `standupCache.date === today`; only call `generateStandup()` on the "Regenerate" button click.

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 5. Givelink uses old blue brand — looks like a different product
- **What**: `givelink.html` uses `--accent:#3b82f6` (Tailwind blue) for all interactive elements. Task OS uses violet `#8b7cff` / `#5718CA`. The two products look unrelated.
- **Where**: `givelink.html:17` (`<meta name="theme-color">`) and `:root` block lines 16–19
- **Why it matters**: Violates brand consistency. When Panos shows Givelink to a prospect, it doesn't look like the same company as the Task OS brand. The brand palette (purple `#5718CA`, violet `#8b7cff`) should be unified.
- **Effort**: S
- **Suggested fix**:
  - Change `--accent:#3b82f6` → `--accent:#5718CA` (or `#8b7cff` for the lighter violet)
  - Change `<meta name="theme-color" content="#3b82f6">` → `content="#5718CA"`
  - Update `--prog:#3b82f6` and `--np:#60a5fa` used for pillar colors if they need to distinguish from the accent.

---

### 6. API key UX: bare `window.prompt()` with no context
- **What**: When an Anthropic key isn't cached, both `getApiKey()` and `callClaudeGL()` show a blocking `window.prompt('Enter your Anthropic API key:')` with no link to get one and no explanation of why Givelink needs it.
- **Where**: `givelink.html:1086`, `givelink.html:1261`
- **Why it matters**: `window.prompt()` is a jarring browser-native dialog. It gives no guidance for non-technical users (nonprofit staff, not devs). Conversion to AI features will be low.
- **Effort**: M
- **Suggested fix**:
  - Build a small settings modal in givelink.html (or reuse the AI modal flow) that explains: "Givelink uses Claude AI. Paste your key from console.anthropic.com."
  - Store the key on save. Remove all `window.prompt()` calls for API key entry.
  - Alternatively, wire Givelink up to use the `api/claude.js` proxy (see item 10).

---

### 7. Activity log in CRM uses a browser `window.prompt()` dialog
- **What**: `logActivityNP()` calls `window.prompt('Log activity (what happened?):')` — a browser-native blocking dialog that loses context (which org, what stage, current note).
- **Where**: `givelink.html:1431`
- **Why it matters**: The CRM is central to Givelink's outreach workflow. A clunky `prompt()` will make people stop using it in favor of a spreadsheet.
- **Effort**: S
- **Suggested fix**:
  - Add an inline "Log note" input field inside the NP modal (a `<textarea>` + "Log" button) that appends to `activityLog` and updates `lastActivityNote` / `lastActivityAt`.
  - No new modal needed — just expand the existing one.

---

### 8. Mobile bottom nav in Givelink hides 4 of 9 views
- **What**: The bottom nav shows only 5 tabs: Overview, Growth, Product, Execute, Backlog. CRM, Past Sprints, Nonprofits pillar, and Ops pillar are only reachable via the hamburger sidebar on mobile.
- **Where**: `givelink.html:306–311`
- **Why it matters**: CRM is a key daily workflow for Panos (tracking nonprofit pipeline). Hiding it behind 2 taps on mobile hurts daily active use on iPhone.
- **Effort**: M
- **Suggested fix**:
  - Replace the 5 fixed tabs with a scrollable horizontal tab bar (overflow-x: auto, snap) that shows all major views.
  - Or swap one of the less-used bottom tabs (e.g. Execute) for CRM, as overdue pipeline items are surfaced in the sidebar count already.

---

### 9. AI Sprint Planner adds to Backlog despite being called "Sprint Planner"
- **What**: The "AI Sprint Planner" modal analyzes sprint completion and suggests tasks, then adds them to the **Backlog** (not the Sprint). The CTA says "Add Selected to Backlog."
- **Where**: `givelink.html:413`, `givelink.html:1193`
- **Why it matters**: Confusing intent — a user who clicks "AI Sprint Planner" before a new sprint expects tasks to land in the Sprint, not Backlog. This causes confusion and extra manual work.
- **Effort**: S
- **Suggested fix**:
  - Either rename the feature to "AI Backlog Suggestions" and update the modal copy to explain it pre-populates the backlog for the next sprint.
  - Or offer a toggle: "Add to Backlog / Add to Sprint" before saving.

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. `api/claude.js` has no CORS headers and is never used by Givelink
- **What**: The Vercel serverless function at `api/claude.js` has no `Access-Control-Allow-Origin` header and no OPTIONS preflight handler. It also isn't referenced by `givelink.html` at all — Givelink always calls Anthropic directly.
- **Where**: `api/claude.js:15–49`, `givelink.html:1131–1145`
- **Why it matters**: The proxy was built to avoid exposing the API key in the browser. It's unused for Givelink, so the key remains in browser localStorage and network logs. CORS issue means even if wired up, it would fail.
- **Effort**: M
- **Suggested fix**:
  - Add CORS headers at the top of the handler: `res.setHeader('Access-Control-Allow-Origin','*')` + OPTIONS preflight (`if(req.method==='OPTIONS'){res.status(200).end();return;}`).
  - Update `callClaudeGL()` in givelink.html to call `APP_CONFIG.aiProxy` when set (same pattern as index.html's `callClaude()`).

---

### 11. `runAiSprintPlanner()` duplicates `callClaudeGL()` entirely
- **What**: The sprint planner (lines 1131–1159) contains its own `fetch()` to the Anthropic API with identical header logic to `callClaudeGL()` (lines 1256–1272). Any future change to API version, model, or auth needs to be made in two places.
- **Where**: `givelink.html:1097–1161` vs `givelink.html:1256–1272`
- **Why it matters**: When updating model or headers, it's easy to miss one copy. Already diverged: sprint planner uses `claude-opus-4-5`, callClaudeGL uses `claude-haiku-4-5-20251001`.
- **Effort**: S
- **Suggested fix**:
  - Refactor `runAiSprintPlanner()` to call `callClaudeGL(prompt, 1024, 'claude-opus-4-5')`.
  - `callClaudeGL` already handles key retrieval and error display.

---

### 12. No rate limiting on the Claude proxy
- **What**: `api/claude.js` proxies any POST to Anthropic without per-user or per-IP rate limiting. The code comment explicitly notes this risk.
- **Where**: `api/claude.js:13`
- **Why it matters**: A single leaked session token or a browser bug could run up the Anthropic bill without limit. With a team using it, one runaway loop = surprise invoice.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (10 req/min/uid or 100/day/uid).
  - Alternatively, require a valid Supabase JWT and log calls to a `claude_usage` table to detect abuse.

---

### 13. Burndown SVG concatenates `"undefined"` when no actuals exist
- **What**: Line 771 has an incomplete ternary `(actualPts.length ? '<circle...>')` with no false branch, which evaluates to `undefined` when false. String concatenation then produces literal `"undefined"` in the SVG markup.
- **Where**: `givelink.html:771`
- **Why it matters**: The guard at line 758 (`if(snapshots.length<2){...return}`) prevents this from rendering today, but if the guard is ever relaxed or snapshots desyncs, the SVG will contain invalid literal text "undefined", breaking the chart.
- **Effort**: S
- **Suggested fix**:
  - Add the false branch: `(actualPts.length ? '<circle ...>' : '')`

---

### 14. Burndown only records snapshots on task completion, creating gaps
- **What**: `_recordSnapshot()` is called only from `toggleDone()`. Days where tasks are only moved or edited (not completed) produce no snapshot. The burndown chart will have gaps or look flat.
- **Where**: `givelink.html:743–753`
- **Why it matters**: The burndown's primary value is showing daily trend. A user who's working every day but completing tasks in batches will see a step-function chart instead of a smooth line.
- **Effort**: M
- **Suggested fix**:
  - Call `_recordSnapshot()` on `init` and on any task state change (`save()` call sites) — not just `toggleDone()`.
  - Alternatively, record on every page load if today's snapshot is missing.

---

## 💡 P3 — Nice to have

### 15. MARKETING.md copy still links to the Vercel preview URL
- **What**: `MARKETING.md:5,40` hardcodes `task-management-beige-eight.vercel.app` as the production URL in ready-to-post social copy and the Product Hunt thread.
- **Where**: `MARKETING.md:5,40`
- **Why it matters**: If the Vercel project is renamed or moved to a custom domain, all copy becomes wrong. Low urgency since MARKETING.md is internal, but it's a foot-gun when copying text to post.
- **Effort**: XS
- **Suggested fix**: Replace the hardcoded URL with `[PRODUCTION_URL]` placeholder and note the real URL once at the top.

---

### 16. Givelink keyboard shortcuts are minimal
- **What**: Only `n` (new task) and Escape are wired. No shortcuts to navigate pillars (`g` for Growth, `p` for Product, etc.) or open the CRM.
- **Where**: `givelink.html:876–880`
- **Why it matters**: The app explicitly targets "keyboard-fast" users (same brand as Task OS). Pillar switching via keyboard would align with that promise.
- **Effort**: S
- **Suggested fix**: Add a keydown handler for `1–5` or letter shortcuts mapped to pillar views, following the same pattern as the Task OS shortcuts.

---

### 17. No `<link rel="canonical">` in either HTML file
- **What**: Neither `index.html` nor `givelink.html` has a canonical URL meta tag. With Vercel preview URLs and possible redirect domains, search engines may index duplicate content.
- **Where**: `index.html` head, `givelink.html` head
- **Why it matters**: SEO dilution. Low urgency until custom domain is set.
- **Effort**: XS
- **Suggested fix**: Add `<link rel="canonical" href="https://[production-domain]/">` to both files.
