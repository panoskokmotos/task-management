# Weekly Triage — 2026-09-25

## 📊 Week at a glance
- Commits this week: **0** (last commit was 2026-09-12, 13 days ago)
- Files changed in last 14 days: **3** (`givelink.html`, `index.html`, `.github/workflows/supabase-keepalive.yml`)
- Debt markers added this week: **0** (no commits in window)
- High-churn files (last 14 days): `givelink.html` (#84), `index.html` (#84)

> No commits landed in the past 7 days. Triage below covers the two PRs merged on 2026-09-12 and residual debt in the files they touched.

---

## 🚨 Needs immediate attention

### 1. `givelink.html:1152` — empty catch swallows Supabase auth errors silently
- **Introduced**: `72e03fe` (PR #84, "Givelink bug fixes and This Week view")
- **Code**: `}catch(e){}` wrapping the token-lookup and cross-app sync path
- **Why this matters**: When the Supabase session expires during a Sprint Planner session, the catch fires, the function continues with a `null`/empty token, and every downstream API call fails silently. The user has no signal to re-authenticate.

### 2. `index.html:9206` — `taskReply()` never uses `APP_CONFIG.aiProxy`
- **Introduced**: Predates #84 but was NOT fixed despite being in the same AI path that was touched
- **Code**: `if(!S.claudeKey){return _taskReplyLocal(id,text);}` — missing `&&!APP_CONFIG.aiProxy`
- **Why this matters**: Every other AI entry point checks both keys. This one will break silently when `aiProxy` is enabled — the feature that looks most like "natural language task management" will fall back to 5 hardcoded keyword matches.

### 3. `sw.js:46–47` — push notification icon path is wrong
- **Introduced**: Present before recent commits; not touched in #84 or #85
- **Code**: `icon: './icons/icon-192.png'` — directory `icons/` does not exist; assets are at root
- **Why this matters**: Every push notification shows a broken/blank icon. Looks like malware. Low effort to fix.

### 4. `index.html:1070` — developer's first name baked into static HTML
- **Introduced**: Predates recent commits; not fixed despite auth onboarding work in #84
- **Code**: `<h1 id="greeting">Good morning, Panos 👋</h1>`; default at line 2519: `||'Panos'`
- **Why this matters**: Every new signed-up user sees "Panos" on their first screen. It is the first thing they read.

### 5. `vercel.json:15` — CSP blocks Google Fonts in production
- **Introduced**: Predates recent commits
- **Code**: `"font-src": "'self'"` — `fonts.gstatic.com` and `fonts.googleapis.com` absent
- **Why this matters**: Inter has never loaded in production. Every user sees the fallback system font instead of the designed typeface.

---

## 🧹 Cleanup opportunities

### 6. `givelink.html:1276–1284` — `syncToTaskOS()` reads obsolete localStorage keys
- **Introduced**: Key migration predates #84; the function was not updated when `taskos_profiles` + `taskos_data_<id>` were consolidated into `taskos`
- **Code**: `localStorage.getItem('taskos_profiles')`, `localStorage.getItem('taskos_data_'+p.id)`
- **Why this matters**: The Givelink ↔ Arete sync always toasts "No Task OS profile found" — it has been permanently broken for all users since the storage migration.

### 7. `index.html:4546–4711` — `seed()` contains ~100 personal developer tasks
- **Introduced**: Predates recent commits; guarded by `_hostedMode()` after-the-fact
- **Code**: tasks like "Nonprofits Board Follow Ups", "Greek Nonprofits Board (Make-A-Wish etc)", "AFP (Golden Gate, Silicon Valley, Wine Country)"
- **Why this matters**: Anyone self-hosting the repo (without Supabase credentials) gets the developer's personal backlog seeded as their starter tasks.

### 8. `index.html:10214`, `10232` — share card still uses old brand "Task OS" and scaffolding URL
- **Introduced**: Predates #84; rebrand commit (#80) updated the UI but missed the canvas rendering
- **Code**: `fillText('Task', ...)` + `fillText('OS', ...)` in canvas; footer text `'Made with Arete · task-management-beige-eight.vercel.app'`
- **Why this matters**: Every shared progress card (the product's primary viral loop) advertises the old name and an unmemorable Vercel scaffolding URL.

### 9. `index.html:9242` — empty catch on AI JSON parse
- **Introduced**: Predates recent commits
- **Code**: `try{act=JSON.parse(...);}catch(e){}`
- **Why this matters**: When the AI returns malformed JSON, the command fires and nothing happens — no error, no explanation. Fix is one line: `catch(e){ toast('Could not interpret that command — try again'); return; }`.

### 10. `index.html:10131` — sync failure in `_afterAuth` silently swallowed
- **Introduced**: Touched in #84 (auth flow was cleaned up) but this catch was left empty
- **Code**: `try{await sbSyncNow(true);}catch(e){}`
- **Why this matters**: If Supabase sync throws after login, the user sees "Welcome back" but their cloud data never loads. They might unknowingly overwrite cloud data with an empty local state.

---

## 🤔 Worth a second look

### 11. `givelink.html:1200–1225` — AI Sprint Planner calls Anthropic directly from browser
- **Commit**: `72e03fe` (PR #84) added this feature
- **Code**: `fetch('https://api.anthropic.com/v1/messages', { headers: { 'x-api-key': apiKey, 'anthropic-dangerous-direct-browser-access': 'true' } })`
- **Why this looks suspicious**: The `anthropic-dangerous-direct-browser-access` header is Anthropic's own warning label for this pattern. The API key is visible in browser devtools / network tab. Also hardcodes `model:'claude-opus-4-5'` (the most expensive model) for what is a simple list-generation task. Intended? Or did the author not realize the proxy (`APP_CONFIG.aiProxy`) could handle this?

### 12. `index.html:9957–9958` — Supabase URL and publishable key hardcoded in source
- **Code**: `supabaseUrl: 'https://bgvddpkdsftgynxyhnoc.supabase.co'`, `supabaseAnon: 'sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M'`
- **Context**: The comment correctly notes these are publishable/safe (RLS protects data). The keepalive workflow (#85) also embeds the same values in the YAML. **These are fine** for the anon key — but it means any Supabase project migration requires a code push rather than an env var update. Worth discussing whether this should move to a `/api/config` endpoint before the user base grows.

### 13. `api/claude.js` — proxy has no rate limit; will be active billing risk once `aiProxy` is set
- **Introduced**: PR #85 added the keep-alive; `aiProxy` is still blank so this is latent
- **Why worth watching**: The code comments `"For production add per-user rate limiting"` — this has never been done. The moment `aiProxy` is filled in (which P1 in the improvement plan recommends this week), every signed-in user gets uncapped access to the Anthropic API. Should be fixed before enabling `aiProxy`.
