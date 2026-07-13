# Weekly Triage — 2026-07-13

## 📊 Week at a glance
- Commits: 3 | Files changed: 5 | Debt markers added: 0 explicit (TODO/FIXME/HACK), ~20 empty `catch(e){}` blocks
- High-churn files: `index.html` (3/3 commits), `sw.js` (3/3 commits), `api/claude.js` (1 commit, brand new)
- Week theme: Hosted multi-user launch (#68) + seeding fix (#69) + account chip (#70). A lot shipped in one PR.

---

## 🚨 Needs immediate attention

**1. No rate limiting on the Claude proxy** — `api/claude.js:12–13` | commit `e0b0a00`
The file itself warns: *"For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."* That comment shipped alongside live hosted sign-up. Any authenticated user can now loop `callClaude` at will and drain your Anthropic quota.

**2. `sbConnect` auto-creates an account when login fails** — `index.html:9891–9895` | commit `e0b0a00`
If password auth throws for any reason (wrong password, network blip, typo in email), the catch immediately fires a `/auth/v1/signup` call with those credentials. A user who mistypes their email gets a new orphan account silently instead of "wrong password". Hosted mode now has real users, so this will happen.

**3. Silent data-loss risk on logout** — `index.html:9975–9976` | commit `e0b0a00`
```js
try{await sbSyncNow(true);}catch(e){}   // line 9975
try{refresh();}catch(e){}               // line 9976
```
Logout clears local credentials immediately after. If the final sync throws (network, expired token), the failure is swallowed silently and the user's latest changes never reach the cloud. Should at minimum `console.warn` and ideally show a toast before wiping the session.

---

## 🧹 Cleanup opportunities

**4. 20 empty `catch(e){}` blocks** — `index.html` scattered | commit `e0b0a00` (bulk)
None have `console.warn` or any logging. Individually most are low-risk (posthog, haptics, UI), but they make it nearly impossible to debug production issues without devtools open. The pattern `catch(e){}` also masks whether a failure is expected or surprising. Consider at least `console.warn('context', e)` for the non-trivial ones.
Notable locations: lines 2826, 2860, 2909, 3460, 7926, 7931, 9969, 9975, 9976, 10033.

**5. No `.env.example` file** — `api/claude.js` | commit `e0b0a00`
`api/claude.js` requires `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` but there is no `.env.example` in the repo. Anyone forking/deploying will have to reverse-engineer the env vars from the source.

**6. `authMagic` discards the actual error from Supabase** — `index.html:9955` | commit `e0b0a00`
```js
if(!r.ok)throw new Error('send failed');
```
The real Supabase error body is never inspected. The `catch` shows "Could not send the link — try again in a moment" regardless of cause. When Supabase is rate-limiting or the domain isn't allow-listed, users get a useless message.

**7. `supabase-setup.sql` recommends disabling email confirmation** — `supabase-setup.sql:37–38` | commit `e0b0a00`
```sql
-- turn OFF "Confirm email" for the fastest single-user setup,
```
This was sensible when the app was self-hosted personal use. Now that hosted multi-user signup is live, new operators following this guide will disable email confirmation for real users. Should add a note distinguishing single-user vs multi-user mode.

**8. `authMagic` stores email before confirming the request succeeded** — `index.html:9956` | commit `e0b0a00`
```js
localStorage.setItem('taskos_sb_email', email);  // line 9956, before checking r.ok
```
Actually the `if(!r.ok)throw` is line 9955, and the store is line 9956 — so storage happens only if `r.ok`. This is fine. Disregard. *(Left as a struck note for reviewers.)*

---

## 🤔 Worth a second look

**9. Proxy silently caps `max_tokens` at 2000** — `api/claude.js:35` | commit `e0b0a00`
```js
const max_tokens = Math.min(parseInt(body.max_tokens) || 1000, 2000);
```
All current AI features request ≤1500 tokens, so this is fine today. But the cap is silent — the caller gets a truncated response with no indication. If a future feature requests 3000 tokens, Claude will return a cut-off answer that looks complete.

**10. SW cache key requires a manual date bump on every deploy** — `sw.js:1` | commit `e0b0a00`
```js
const CACHE = 'task-os-20260711';
```
If a hotfix ships without updating this string, returning users get stale cached HTML even after a hard refresh. SW cache invalidation is the only mechanism and it's entirely manual. Consider deriving the key from a build hash or adding a CI check.

**11. User's own Claude API key is sent in a browser `fetch`** — `index.html:4876–4879` | commit `e0b0a00`
When `APP_CONFIG.aiProxy` is empty and the user has set their own `claudeKey`, it's passed as `x-api-key` in a plain browser request with `anthropic-dangerous-direct-browser-access: true`. The key is visible in DevTools → Network to anyone with access to the device. This is intentional by Anthropic's header convention, but worth documenting as a known trade-off so users are informed.

**12. AI inbox triage shows no button loading state** — `index.html:4900–4930` | commit `e0b0a00`
`aiAutoTriage` fires a toast ("AI triaging…") but the triggering button has no disabled/spinner state. The `_aiLock` guard correctly prevents double-fire, but visually there's no feedback on the button itself during the ~2–5 second API call. Users who tap again see nothing — and `_aiLock` silently returns without explaining why.

**13. Board view column count is hardcoded to life-area layout** — inferred from `e0b0a00` commit message
The commit ships a Board view ("Board = life-area columns with mobile scroll-snap"). If a user has non-standard life areas or many categories, the column layout may not adapt gracefully. No loading or empty-state handling is described for the board when there are 0 tasks in a column.
