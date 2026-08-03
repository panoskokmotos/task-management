# Weekly Triage — 2026-08-03

## 📊 Week at a glance
- **Commits this week:** 0 (last commit was 2026-07-22 — 12 days of quiet)
- **Active review window:** 2026-07-15 → 2026-07-22 (12 commits, 14 files changed)
- **Silent catch blocks:** 71 in `index.html` alone
- **High-churn files:** `index.html` (11/12 commits), `sw.js` (10/12 commits), `landing.html` (3/12 commits)
- **Tests added this sprint:** 0 — no test commits in the entire window

---

## 🚨 Needs immediate attention

### 1. Hardcoded Supabase credentials in source
**`index.html:9957–9958`** · commit `e0b0a00`

```js
supabaseUrl : 'https://bgvddpkdsftgynxyhnoc.supabase.co',
supabaseAnon: 'sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M',
```

The Supabase project URL and publishable anon key are hardcoded in the public client bundle. The comment correctly says the anon key is "safe in the browser; RLS protects data" — but RLS being the only gate means any RLS misconfiguration directly exposes all user data. If you ever rotate this key or migrate projects, every deployed version of the app becomes broken silently. This should live in a build-time config or be settable via env injection, not committed literally.

---

### 2. XSS: task titles rendered as raw HTML in Weekly Review wizard
**`index.html:3594`** and **`index.html:3601`** · commit `e0b0a00` (original XSS path)

```js
// line 3594 – completed tasks panel
`<div class="tt" style="text-decoration:line-through;">${t.title}</div>`

// line 3601 – backlog promotion panel
`<div class="tt">${t.title}</div>`
```

An `esc()` function exists (line 11776) and is used in most places, but the Weekly Review wizard interpolates `t.title` directly into `innerHTML`. A task titled `<img src=x onerror=alert(1)>` would execute in the review panel. Also unescaped: `t.title.slice(0,45)` in the blocked-by task selector at line 2543.

---

### 3. AI proxy has no rate limiting — billing risk
**`api/claude.js:12`**

The proxy file itself documents this: *"add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."* It's been marked as a known gap since commit `e0b0a00`. Any authenticated user can call the Claude proxy in an unbounded loop. With no per-user limit, a single session can drain the Anthropic budget before the next billing cycle.

---

### 4. Cloud sync failure silently swallowed during logout
**`index.html:10131`** · commit `f89aed3`

```js
try{await sbSyncNow(true);}catch(e){}
```

During logout the app tries to do a final sync — but the catch swallows every failure with no log, toast, or retry. If the user's last session of the day fails to sync (network blip, expired token), they lose data silently. At minimum this should `console.warn` and show a toast.

---

### 5. `givelink.html` (112 KB) still in repo after "removal"
**`givelink.html`** · commit `d635c06` claims to "Remove Givelink from Task OS"

The commit message says the products are fully separated, but `givelink.html` (112 KB), `icon-gl.svg`, `manifest-givelink.json`, and the `/givelink` route in `vercel.json` are all still present. This is either intentional (kept as a separate product) or the removal was incomplete. Either way the route is publicly live at `/givelink`.

---

## 🧹 Cleanup opportunities

### 6. `catch(e){}` used 71 times — many mask real errors
**`index.html`** — pervasive pattern

The app uses a "wrap everything in try/catch and swallow" pattern throughout the init sequence (lines 10656–13770). While some are genuinely fire-and-forget, others cover state mutations where a silent failure leaves the UI in a corrupt state. The ones most likely to cause ghost bugs:
- `index.html:10131` — sync-on-logout (see item 4)
- `index.html:9242` — AI action parse failure; the action just silently becomes `null`
- `index.html:10306` — inside Supabase signup flow (an auth error disappears)

---

### 7. Hardcoded production app URL
**`index.html:10180`** · commit `32e7288`

```js
const _APP_URL='https://task-management-beige-eight.vercel.app/';
```

This URL is baked into referral links, share cards, and OG meta. If the domain ever changes (or the Vercel project is renamed), every share link and OG tag breaks. Should be a build-time constant or derived from `window.location.origin`.

---

### 8. AI proxy model pinned to a specific model ID
**`api/claude.js:42`**

```js
model: 'claude-haiku-4-5-20251001'
```

A specific dated model ID is hardcoded. When this model is deprecated (Anthropic typically retires dated variants), the proxy will start returning 400 errors with no user-visible message. Should be updated to the current stable alias.

---

### 9. No `.env.example` file
**Repo root** — no `.env` or `.env.example` file present

The proxy (`api/claude.js`) requires `ANTHROPIC_API_KEY`, optionally `SUPABASE_URL`, and `SUPABASE_ANON_KEY` as Vercel env vars. There's no `.env.example` to document this for new contributors or deployments. The setup instructions exist only as comments inside `index.html` (~line 9945).

---

## 🤔 Worth a second look

### 10. `unsafe-inline` in Content Security Policy
**`vercel.json` CSP header** · commit `07213ad`

```
script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com
style-src  'self' 'unsafe-inline'
```

The entire app is a single inline `<script>` block, so `'unsafe-inline'` is currently unavoidable — but it neutralises the XSS protection the CSP is meant to provide. If inline scripts are injected (see item 2), the CSP won't stop them. A nonce-based approach would require a server-side render step.

---

### 11. Referral UID exposed in share URLs without confirmation
**`index.html:10182`** · commit `32e7288`

```js
function _refUrl(){const r=(_SB&&_SB.uid)?('?ref='+encodeURIComponent(_SB.uid)):'';return _APP_URL+r;}
```

Whenever a user shares anything (goal, win, invite, template), their Supabase user ID is appended to the URL automatically without a prompt. This leaks the internal UID to anyone who receives the link. If row-level security ever slips, this ID is the key. Low risk today; worth noting for when the product grows.

---

### 12. First-run seed data still runs in non-hosted mode
**`index.html:10660`** · commit `9f898e0`

```js
try{if(!_hostedMode()){seed();seedGoals();}}catch(e){console.warn('seed',e);}
```

The fix for the "new signups inherit owner data" bug (commit `9f898e0`) correctly gates seeding behind `!_hostedMode()`. But `seed()` adds ~389 hardcoded tasks directly from the owner's personal backlog (life goals, Givelink tasks, investments). If the app is ever run outside hosted mode — local dev, a second Vercel project without Supabase configured — those tasks still seed. This is low-risk in production but a surprise for any new developer running it locally.

---

### 13. `shareStats()` canvas screenshot uses `html2canvas`-style DOM capture — may leak private data
**`index.html:10236`** · commit `fb63461`

The `shareStats` function builds a visible stats card and uses `navigator.share` or clipboard copy. The stats include task counts, streaks, and XP — no direct task content — so this is likely fine. But it's worth confirming that `_shareStats()` (line 10195) never pulls task titles or goal names into the share payload for users with sensitive data.
