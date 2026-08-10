# Weekly Triage — 2026-08-10

## 📊 Week at a glance
- **Commits (last 7 days): 0** — last activity was 2026-07-22 (commit `b38d4bb`), 19 days ago
- **Files changed (last 3 weeks): 3** — `landing.html`, `robots.txt`, `sitemap.xml`
- **Debt markers added this week: 0** (no new commits)
- **High-churn files (last 10 commits):** `index.html` (3×), `landing.html` (3×), `sw.js` (2×)
- **Codebase:** monolithic single-file app — `index.html` is 14,924 lines / 1 MB

> No commits landed in the last 7 days. Triage below covers the full codebase state
> as of the last active sprint (2026-07-16 → 2026-07-22).

---

## 🚨 Needs immediate attention

### 1. Supabase credentials hardcoded in a public repo
**`index.html:9957–9958`** · commit `e0b0a00`

```js
supabaseUrl : 'https://bgvddpkdsftgynxyhnoc.supabase.co',
supabaseAnon: 'sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M',
```

The comment calls this safe ("publishable key, RLS protects data"), but the project URL is now permanently indexed by GitHub's code search, and a single misconfigured RLS policy exposes all user data. The `sb_publishable_` prefix is Supabase's newer format for browser-safe keys but it still grants unauthenticated API access to the project. **If RLS has any gap, the blast radius is every user's tasks, goals, and notes.**

Action: confirm every table has RLS enabled (`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` in Supabase SQL editor). Consider rotating the anon key if this repo is or was ever public.

---

### 2. Direct browser-to-Anthropic API calls with user key stored in localStorage
**`index.html:5020–5024`** · commit `76d794a`

```js
res = await fetch('https://api.anthropic.com/v1/messages', {
  headers: { 'x-api-key': S.claudeKey, 'anthropic-dangerous-direct-browser-access': 'true' },
```

When `APP_CONFIG.aiProxy` is empty (which it is — `aiProxy: ''` on line 9959), the app calls Anthropic directly from the browser using a user-supplied key stored in `localStorage`. The header name `anthropic-dangerous-direct-browser-access` is Anthropic's own signal that this is a high-risk pattern. Any XSS bug → immediate API key theft. The key is also visible in DevTools Network tab.

Action: wire up `APP_CONFIG.aiProxy` to `api/claude.js` or gate this path behind an explicit "I accept the risk" settings toggle.

---

### 3. No per-user rate limiting on the AI proxy
**`api/claude.js:12`** · note present since `api/claude.js` was added

```js
// Note: this is a minimal proxy. For production add per-user rate limiting
// (e.g. Upstash) so a single account can't run up your Anthropic bill.
```

The proxy is live and carries your Anthropic billing credentials. One determined user (or a tab left open in a loop) can exhaust your monthly budget. The comment acknowledges it but no implementation followed.

Action: add Upstash rate-limit middleware or Vercel Edge Config per-user quotas before this becomes a billing surprise.

---

### 4. No `.env.example` documenting required serverless environment variables
**`api/claude.js:4–8`**

`ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` are required at deploy time but there is no `.env.example` or documentation in the repo root. A contributor or a fresh Vercel deploy silently omits them → `500 Server is missing ANTHROPIC_API_KEY` in production.

Action: add `api/.env.example` with all three vars plus a comment linking to where to get each.

---

## 🧹 Cleanup opportunities

### 5. 15+ silent empty catch blocks
**`index.html:956, 2587, 2949, 2983, 3031, 3583, 3868, 3971, 3978, 3979, 3988, 4443, 8066, 8071, 9242, 10082, 10115, 10120`**

```js
try { _stripH1Emoji(); } catch(e) {}
try { act = JSON.parse(...); } catch(e) {}
try { nav('dashboard'); } catch(e) { try { refresh(); } catch(_) {} }
```

Silent swallowing makes production bugs invisible — a parse failure on line 9242 means `act` is silently `undefined` and the AI workflow continues with unpredictable behavior. The pattern is widespread enough that it's structural, not incidental.

Action: replace the most consequential ones (data parsing, auth, AI response parsing) with at least `console.warn(e)`. The UI-cosmetic ones (`_stripH1Emoji`, haptics) can stay silent.

---

### 6. `givelink.html` still cached by the service worker after product separation
**`sw.js:14`** · separation commit `d635c06`

```js
const HTML = ['./','./index.html', './givelink.html', './landing.html'];
```

Commit `d635c06` ("Remove Givelink from Task OS — fully separate the two products") removed Givelink from the app nav, but `givelink.html` is still in the repo and explicitly pre-cached by the service worker. This wastes ~50KB of cache space per install and creates a stale route that users could accidentally hit offline.

Action: decide if `givelink.html` is still a separate product at this URL or fully retired. If retired, delete the file and remove from `sw.js`. If kept, bump the cache version string (`arete-20260723`) to force clients to re-evaluate.

---

### 7. Deployment URL hardcoded to Vercel preview domain in landing `<head>`
**`landing.html:11, 16, 17, 21`** · commit `b38d4bb`

```html
<link rel="canonical" href="https://task-management-beige-eight.vercel.app/">
<meta property="og:url" content="https://task-management-beige-eight.vercel.app/">
```

`task-management-beige-eight` is a Vercel auto-generated slug, not a branded domain. All SEO link equity and OG share previews point here. The structured data in the same commit correctly says `"name":"Arete"` but links to the ugly URL.

Action: once a proper domain is set, update all four occurrences and `sitemap.xml` in one pass.

---

### 8. PostHog analytics wired but key empty in both files (silently no-ops)
**`landing.html:702`** and **`index.html:9960`** · commit `b38d4bb`

```js
var POSTHOG_KEY = '';   // landing.html
posthogKey: '',          // index.html APP_CONFIG
```

The analytics instrumentation (landing funnel, `landing_cta_click`, `landing_scroll`) was added in `b38d4bb` but no key was pasted in either location. No data is being collected. The landing/app also have separate config variables that must stay in sync manually.

Action: paste the PostHog project key in both locations, or add a startup warning log when `posthogKey` is empty so it's obvious during development that analytics are off.

---

### 9. `manifest-givelink.json` cached in sw.js after product separation
**`sw.js:8`** · separation commit `d635c06`

```js
'./manifest-givelink.json'
```

Same issue as #6 — left over after the Givelink separation. Low severity but adds a stale asset to the install cache.

---

## 🤔 Worth a second look

### 10. ntfy.sh push topic has no auth or namespacing visible in code
**`index.html:11304`** · commit `76d794a`

```js
return fetch('https://ntfy.sh', { ... })
```

ntfy.sh topics are publicly guessable by name. If a user picks a common topic string, anyone who knows or guesses it can subscribe to their reminders. The code doesn't appear to enforce a user-specific prefix or private ntfy server.

Worth checking: are users warned to pick a non-guessable topic, or does the UI auto-generate a random one?

---

### 11. AI JSON parse on line 9242 returns `undefined` on failure, no downstream guard
**`index.html:9242`**

```js
try { act = JSON.parse((raw.match(/\{[\s\S]*\}/)||[])[0]); } catch(e) {}
```

If the regex returns no match, `[0]` is `undefined`, `JSON.parse(undefined)` throws `SyntaxError: Unexpected token`, and `act` remains unset. The code that follows uses `act.type` etc. — trace through the callers to confirm `act` is null-checked before use.

---

### 12. Logout sync failure silently ignored — potential data loss window
**`index.html:10131`**

```js
try { await sbSyncNow(true); } catch(e) {}
```

If the final sync before logout fails (network flap, Supabase token expired), the catch is empty and logout proceeds. The user's last unsaved changes may never reach the server.

Worth adding at minimum a `console.warn` and ideally a toast: "Sync failed — your last changes may not have saved."

---

*Triage generated 2026-08-10. No commits landed in the 7-day window (last activity: 2026-07-22). Report covers full codebase state against recently active files.*
