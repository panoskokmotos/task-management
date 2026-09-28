# Weekly Triage — 2026-09-28

## 📊 Week at a glance
- **Commits this week**: 0 (last commit was 2026-09-12, 16 days ago)
- **Files changed this week**: 0
- **Debt markers added this week**: 0 (no new commits to scan)
- **High-churn files**: No churn this week. In the last 30 days: `givelink.html`, `index.html`, `.github/workflows/supabase-keepalive.yml`

> **Note:** There were zero commits in the last 7 days. The triage below covers the most recent commits (from the `72e03fe` / `160f0d8` batch on 2026-09-12) and the standing debt visible in the current codebase.

---

## 🚨 Needs immediate attention

### 1. `S.claudeKey` is pushed verbatim to Supabase on every sync
- **File**: `index.html:10408` (sbPush: `data: S`)
- **Introduced in**: `72e03fe` (Givelink bug fixes, 2026-09-12) — sbPush was not modified in that commit, but the claudeKey field in S was not stripped before the commit went live
- **Why this matters**: Every user's Anthropic API key is stored in plain text in the `app_state` Supabase table. One leaked Supabase service key exposes all user API keys.

### 2. Unescaped user content in innerHTML (XSS vector)
- **File**: `index.html:3594`, `3601`, `3603`
- **Introduced in**: Pre-existing; not addressed in the most recent commit
- **Why this matters**: Task and goal titles are rendered via `${t.title}` / `${g.title}` directly in `innerHTML` with no call to `esc()`. The `esc()` function exists at line 11776 but is not used consistently. A malicious task name executes arbitrary JS.

### 3. Push notification icon 404 (service worker)
- **File**: `sw.js:46–47`
- **Introduced in**: `160f0d8` (Supabase keep-alive, 2026-09-12) — sw.js was not changed in this commit; the bug predates it
- **Why this matters**: `icon: './icons/icon-192.png'` references a path that does not exist. The actual file is `./icon-192.png`. Push notifications show a broken icon on all platforms.

### 4. Empty catch block silently drops AI action parse failures
- **File**: `index.html:9242`
- **Introduced in**: Part of the health coach feature (earlier sprint)
- **Why this matters**: `catch(e){}` with no body means a malformed AI response leaves the user staring at a spinner or blank state with no error message and no way to retry.

---

## 🧹 Cleanup opportunities

### 5. `// Note: this is a minimal proxy. For production add per-user rate limiting (e.g. Upstash)` — never acted on
- **File**: `api/claude.js:12–13`
- **Commit**: This comment predates current git history
- **What they likely meant**: The proxy was shipped as an MVP. Upstash Redis rate limiting was deferred. It still has no guard.

### 6. `// always land on Today after login, not a stale last view` — compound try/catch masking actual errors
- **File**: `index.html:10132`
- **Commit**: `28dc1b8` (Land on Today after login)
- **What they likely meant**: A belt-and-suspenders guard for the nav/refresh call. But `try{nav('dashboard');}catch(e){try{refresh();}catch(_){}}` silently swallows any real navigation errors. If `nav()` throws for a real reason (missing view element, etc.), it's invisible.

### 7. Hardcoded model `'claude-haiku-4-5-20251001'` in the proxy
- **File**: `api/claude.js:42`
- **Commit**: Present in current codebase; not changed since model was set
- **What they likely meant**: Ship with a known-good model and upgrade later. "Later" hasn't happened. When this model is deprecated, every AI proxy call will 404.

### 8. `window.prompt()` for API key in givelink.html
- **File**: `givelink.html:1154–1155`, `1326–1330`
- **Commit**: Predates current git history
- **What they likely meant**: Quick shortcut to wire up AI in the sprint board without building a settings UI for it. Should read from the same key store as `index.html`.

### 9. Service worker cache version is 2 months stale
- **File**: `sw.js:1` — `const CACHE = 'arete-20260723'`
- **Commit**: Last updated in a deploy around July 2026
- **What they likely meant**: Bump on every deploy to bust the cache. Has not been bumped since the two September commits. Users on those commits may still be served the July build.

---

## 🤔 Worth a second look

### 10. Supabase sync last-write-wins with no merge or conflict UI
- **File**: `index.html:10418–10420`
- **Pattern**: `S = {...S, ...remote.data}` — the entire local state is replaced when the remote is newer
- **Why it looks suspicious**: On multi-device use (common for a productivity app), any tasks added on device A while device B was open will be silently dropped when device B syncs. This could explain any user-reported "my tasks disappeared" issues. The pattern looks intentional but may not be understood to have this side effect.

### 11. `_hostedMode()` gates exist but `APP_CONFIG.aiProxy` is empty string in production config
- **File**: `index.html:9957–9961`
- **Pattern**: `const APP_CONFIG = { ..., aiProxy: '' }`. The proxy URL is left blank; callers check `!!APP_CONFIG.aiProxy`. If `aiProxy` is empty, every AI call falls through to the direct browser path (with the dangerous-direct-browser-access flag).
- **Why it looks suspicious**: May be intentional for self-hosting, but if the hosted deployment at `task-management-beige-eight.vercel.app` has `aiProxy: ''`, users with an API key in settings are calling Anthropic directly from the browser, exposing their key in the network tab.

### 12. `Promise.allSettled` in SW install silently ignores failed asset caches
- **File**: `sw.js:24`
- **Pattern**: `Promise.allSettled([...HTML, ...STATIC].map(u => c.add(u)))` — if any asset 404s during install, it is swallowed
- **Why it looks suspicious**: The comment says this is intentional to avoid stranding clients, which is reasonable. But there's no logging, so a bad deploy that breaks offline mode is invisible until a user reports "the app doesn't work offline".
