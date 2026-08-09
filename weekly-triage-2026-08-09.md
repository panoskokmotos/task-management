# Weekly Triage — 2026-08-09

## 📊 Week at a glance

- **Commits this week**: 0 (last commit was `b38d4bb` on 2026-07-22 — 18 days ago)
- **Files changed**: 0 (no active development this week)
- **Debt markers added**: 0 (no new commits to scan)
- **High-churn files (last 30 days)**: `index.html` (7 of last 11 commits), `sw.js` (6 of last 11), `landing.html` (3 of last 11)
- **Status**: Repository is in a post-sprint quiet period. All findings below are from the live codebase, not new commits.

---

## 🚨 Needs immediate attention

### 1. `profileName` defaults to `'Panos'` for all new users
- **File**: `index.html:2519`
- **Introduced**: `0c1d32d` (2026-07-17 — Rebrand to Arete)
- **Why**: Line `let profileName=localStorage.getItem('taskos_name')||'Panos'` hardcodes the developer's name as a fallback. Every new user's greeting reads "Good morning, Panos 👋". The static HTML at `index.html:1070` also has "Panos" in the initial render. This shipped in the rebrand commit and has been live since.

### 2. `aiProxy` not configured — all AI features return an error toast
- **File**: `index.html:9959`
- **Introduced**: `b38d4bb` (2026-07-22 — Landing growth commit, last shipped)
- **Why**: `aiProxy: ''` means `callClaude()` at `index.html:5008` immediately toasts "Add Claude API key in Settings first" for every user. The proxy code in `api/claude.js` is complete and correct — it's a missing config string. AI is the lead value proposition on the landing page; it's been broken since at least the last commit.

### 3. Push notification icon path 404s on every notification
- **File**: `sw.js:46-47`, `index.html:11289`
- **Introduced**: `0c1d32d` (2026-07-17 — Rebrand icons commit)
- **Why**: `./icons/icon-192.png` doesn't exist. The actual file is `./icon-192.png` (root level, no `icons/` subdirectory). The icons were reorganized in the rebrand commit but the service worker references weren't updated. Every push notification and in-app reminder shows a broken image on the OS notification tray.

### 4. AI prompts use hardcoded developer identity as the default context
- **File**: `index.html:5647, 5920, 7319, 7477, 7849, 9806`
- **Introduced**: Multiple commits through `72d9c68` and `0c1d32d`
- **Why**: Six AI prompt templates fall back to `'Panos — Greek founder in his 20s building Givelink...'`. Any user without an "About me" filled in gets AI output addressed to Panos about Givelink. Comment at line 10458 even acknowledges this: `// Personalize the greeting from the sign-in email (so it's never "Panos")` — the guard was added for the greeting but missed the AI prompts.

---

## 🧹 Cleanup opportunities

### 5. `seed()` function — 400 lines of personal tasks still in the codebase
- **File**: `index.html:4532-4925`
- **Introduced**: Pre-dates the current git history; blocked (not deleted) in `9f898e0` (2026-07-06)
- **What**: The personal data was blocked from running in hosted mode by `try{if(!_hostedMode()){seed();seedGoals();}}` at `index.html:10660`. But the function body (Greek medical appointments, Givelink tasks, personal finance tasks) is still shipped to every browser. Anyone self-hosting without Supabase will load the developer's personal life as their own starter data.
- **Why this matters**: Dead code adding 400+ lines; leaks personal data in non-hosted deployments; confusing to any developer who reads the source.

### 6. Givelink view still fully functional after "removal" commit
- **File**: `index.html:2984, 8618-8746, 9569, 11917, 14311`
- **Introduced**: `d635c06` (2026-07-16 — "Remove Givelink from Task OS")
- **What**: Commit message says Givelink was removed, but `renderGivelinkDash()` (229 lines), the sidebar nav entry, the router dispatch entry, a dashboard widget, and the `v-givelink-dash` HTML div all still exist. The `CATS` constant still lists `givelink`. The `S` state object still carries `givelinkMetrics` (ARR, MRR, pipeline) for every user.
- **Why this matters**: Nav entry appears for users; state object bloat; misleading commit history. The "removal" was partial.

### 7. Staging URL hardcoded in OG tags, canonical, and share card
- **File**: `index.html:24,25,32,10180,10232` | `landing.html:11,16,17,25`
- **Introduced**: `a8586f3` (2026-07-16 — OG preview commit)
- **What**: `task-management-beige-eight.vercel.app` appears 7+ times. The constant `_APP_URL` at `index.html:10180` and the canvas text in the share card at `index.html:10232` both reference it.
- **Why this matters**: Social sharing embeds wrong URL; Google may index the preview domain; SEO canonical tag points to wrong origin.

### 8. `console.warn('seed', e)` — swallowed seed error
- **File**: `index.html:10660`
- **Introduced**: `9f898e0` (2026-07-06)
- **What**: `try{if(!_hostedMode()){seed();seedGoals();}}catch(e){console.warn('seed',e);}` — if seed throws (e.g. corrupt localStorage), it's silently swallowed. New users get no tasks and no error message.
- **Why this matters**: Silent failure in the new-user path; hard to debug in prod without console access.

---

## 🤔 Worth a second look

### 9. Supabase anon key format — `sb_publishable_...` vs expected JWT
- **File**: `index.html:9958`
- **What**: `supabaseAnon: 'sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M'`. Standard Supabase anon (public) keys start with `eyJ` (JWT format). The `sb_publishable_` prefix is associated with edge function publishable keys. If this is the wrong key type, Supabase auth flows will silently 401 — users can't sign in and sync is broken for all accounts.
- **Status**: May be intentional (Supabase changed key format) or a misconfiguration. Needs verification in the Supabase dashboard.

### 10. Token refresh runs on every AI call — potential race condition
- **File**: `index.html:5013`
- **What**: `const tok=_sbEnabled()?await _sbToken().catch(()=>''):''` — `_sbToken()` at `index.html:10022` can trigger a token refresh. If two AI calls fire near-simultaneously (e.g. multi-step AI lab workflow), both may attempt to refresh the token at the same moment, overwriting each other's `access_token` in localStorage. Second call may use a stale token.
- **Status**: Probably fine for current usage (one AI call at a time), but `_aiLock()` doesn't prevent concurrent calls from different code paths.

### 11. `_APP_URL` used in share text but references staging
- **File**: `index.html:10180`
- **What**: `const _APP_URL='https://task-management-beige-eight.vercel.app/'`. This feeds into the progress card share flow and invite links. Could cause confusion for users sharing to friends who then land on the staging URL instead of the canonical app.
- **Status**: Covered by item #7 in cleanup, but worth noting the constant name suggests it's meant to be dynamic.

### 12. No `Content-Security-Policy` header in `vercel.json`
- **File**: `vercel.json`
- **What**: The Vercel config has routes and rewrites but no CSP headers. The app uses `eval`-style JSON parsing (`JSON.parse` on user-supplied strings) and inline `onclick` handlers throughout. A CSP would block XSS escalation paths.
- **Status**: Low urgency for a personal productivity tool, higher urgency if user data (tasks, health logs, finance entries) is genuinely sensitive.

---

*Immediate action items: #1, #2, #3 (all small — under 1 hour each)*
*This week's biggest risk: AI features being broken (#2) while being advertised on the landing page*
