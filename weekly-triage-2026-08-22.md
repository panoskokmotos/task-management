# Weekly Triage — 2026-08-22

## 📊 Week at a glance
- **Commits**: 1 | **Files changed**: 1 | **Debt markers added**: 3
- **High-churn files**: `README.md` (sole change this week)
- Note: Very quiet week — one housekeeping commit. The real debt lives in `index.html` (untouched this week but flagged below as structural residue from prior weeks).

---

## 🚨 Needs immediate attention

### 1. README instructs `npm ci` / `npm test` / `npm run build` — no `package.json` exists
- **File**: `README.md:43-52` | **Commit**: `5cd9437`
- **Why it matters**: The first three installation steps in the "Getting Started" section fail immediately because there is no `package.json`. Any contributor or evaluator who follows the docs hits a hard error on step 2. Also breaks any CI that clones and runs setup commands.
- **Fix**: Remove the Node/npm section entirely; the app is a static file — install is just "clone and open". Add a `vercel deploy` one-liner for hosted users.

### 2. README links to `CHANGELOG.md` and `CONTRIBUTING.md` — neither file exists
- **File**: `README.md:62,65` | **Commit**: `5cd9437`
- **Why it matters**: Two documentation links in the new README are dead on arrival. GitHub renders 404 inline links in red; this is the first thing an OSS evaluator sees.
- **Fix**: Create minimal stub files or replace the links with issue-tracker URLs until the files are ready.

### 3. Debt marker confirmed in README: "badges placeholder" in commit subject
- **File**: `README.md` (subject of `5cd9437`)
- **Why it matters**: The commit message itself says "badges placeholder" — placeholder content was committed intentionally. The README has an image section (`## 📸 Screenshots`) with placeholder text but no actual screenshots. This is dead content in the repo.
- **Fix**: Either add at least one real screenshot before the next marketing push, or remove the placeholder section.

---

## 🧹 Cleanup opportunities

*(From full-codebase scan of structural debt — `index.html` is not touched this week but carries persistent debt worth flagging.)*

### 4. `// Auto-snapshot: capture a daily Givelink history point` — stale comment after rebrand
- **File**: `index.html:10620` | **Commit**: prior (rebrand `#80`)
- **Why it matters**: Comment references "Givelink history" in a function that snapshots `S.givelinkMetrics`. After the rebrand to Arete, this comment misleads anyone reading the code about what the function actually does.
- **Fix**: Update comment to reference "Arete business metrics" or whatever the data now represents.

### 5. `catch(e){}` empty catch blocks — 6 occurrences
- **File**: `index.html:3031, 3583, 10132, 10134, 10138, 10306`
- **Why it matters**: Silent failure makes debugging production issues impossible. If an error occurs in a swallowed catch, there's no breadcrumb in PostHog or the console.
- **Fix**: At minimum, replace with `catch(e){console.warn('[context]', e)}` so errors appear in browser devtools even if not surfaced to users.

### 6. Console logs intentionally left in init sequence
- **File**: `index.html:10689` (`console.error`), `index.html:10656-10666` (6× `console.warn`)
- **Why it matters**: The init sequence logs warnings for every bootstrap function — `load`, `seed`, `resetRecurring`, `quests`, etc. In production, these appear in every user's browser console and can leak app internals to curious users.
- **Fix**: These are fine during development; gate them behind `if(APP_CONFIG.debug)` or remove the ones that don't add value (the `quests` and `sidebarSwipe` warns fire on every page load even when nothing is wrong).

---

## 🤔 Worth a second look

### 7. `_APP_URL` hardcoded to staging Vercel URL
- **File**: `index.html:10180`
- **What it looks like**: `const _APP_URL='https://task-management-beige-eight.vercel.app/';`
- **Why it's suspicious**: This constant is used in share cards, invite links, and referral tracking. If this is intentional (the app is *only* deployed at this URL), it's fine. If a custom domain is planned, every shared link and progress card will point to the wrong place. The share card canvas text at line 10232 writes this URL into pixel data.
- **Verdict**: Intentional for now, but set a reminder to update before any custom domain goes live.

### 8. Global state object `S` has `securityAuditLog` field — never written to
- **File**: `index.html:2517`
- **What it looks like**: `securityAuditLog:[]` in the initial state declaration
- **Why it's suspicious**: The field exists in the state schema but there are no `push` or write calls for it anywhere in the file. Either it's a planned feature that was never implemented, or it's abandoned.
- **Verdict**: If not implemented, remove from the state declaration to keep the schema clean and reduce serialized payload size.

### 9. PostHog initialized inline with a 400-character minified snippet
- **File**: `index.html:10391`
- **What it looks like**: The PostHog bootstrap snippet is inlined as a single minified line. `APP_CONFIG.posthogKey` is an empty string `''` in the template.
- **Why it's suspicious**: PostHog silently no-ops when initialized with an empty key, so this is safe locally. But if `posthogKey` is deployed empty to production, all analytics silently drop. There's no warning when the key is missing.
- **Verdict**: Add a single guard: `if(!APP_CONFIG.posthogKey){console.warn('PostHog key not set — analytics disabled'); return;}` before the `posthog.init()` call to make the misconfiguration visible.
