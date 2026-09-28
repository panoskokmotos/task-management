# Weekly Triage — 2026-09-28

## 📊 Week at a glance
- Commits: **0** (repo has been quiet for 16 days — last activity was 2026-09-12)
- Files changed this week: 0 | Debt markers added: N/A
- High-churn files (recent weeks): `index.html` (touched in every PR), `givelink.html` (touched in #84), `.github/workflows/supabase-keepalive.yml` (added in #85)

> No new commits landed since 2026-09-12. The findings below are standing issues in the codebase, surfaced from the files changed in the two most recent PRs (#85, #84) and broader scans of the active files.

---

## 🚨 Needs immediate attention

**1. `givelink.html:1333` — `callClaudeGL()` silently swallows API errors**
`fetch()` result is parsed with `res.json()` without checking `res.ok` first. A 401 (bad key), 429 (rate limit), or 500 from the Anthropic API causes `data.content?.[0]?.text` to be undefined, returning `null` with no user feedback beyond `toast('AI error: ...')`. Users get a vague failure with no actionable message.
- Commit: 72e03fe (#84 — Givelink bug fixes and This Week view)
- Why it matters: rate limit errors will silently return null and callers (log activity drafter, outreach generator) will just do nothing — no indication to the user that the API call failed.

**2. `givelink.html:1155, 1330` — API key collected via `window.prompt()`**
Two separate code paths (`getApiKey()` and `callClaudeGL()`) fall back to a browser `prompt()` dialog to ask for the Anthropic key, then store it in `localStorage` under `taskos_api_key`. The key is briefly visible in the browser's native prompt UI.
- Commit: 72e03fe (#84)
- Why it matters: this is a fallback for when no key is configured, but `prompt()` is blocking and jarring, and the stored key has no expiry. A proper settings flow is already in index.html; givelink.html should use the same pattern.

**3. `api/claude.js:13` (comment) — AI proxy has no rate limiting**
The comment in the proxy explicitly flags: *"For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."* The proxy is deployed but unguarded. Any valid Supabase session can call it without limits.
- Commit: present since the proxy was created
- Why it matters: a single session could burn through an Anthropic bill in hours if the app is ever shared broadly.

---

## 🧹 Cleanup opportunities

**4. `index.html:3594, 3601, 3603` — `t.title` and `g.title` unescaped in `innerHTML`**
The Weekly Review wizard renders task titles and goal titles directly into `innerHTML` using template literals (`${t.title}`, `${g.title}`). The `esc()` helper (defined at index.html:11776) exists and is used elsewhere but missing here.
- Commit: 0c1d32d (#80 — Rebrand to Arete)
- Why it matters: self-XSS for a local-only user is low-impact today, but if task/goal data ever arrives via Supabase sync from another source, a crafted title like `<img src=x onerror=...>` would execute in the owner's browser.

**5. `index.html:3531` — `${v}` (core values) unescaped in `innerHTML`**
The Know Thyself / values section renders user-entered values directly: `` `💎 ${v}` `` into a `<span>` without `esc()`.
- Same commit as above (#80)
- Why it matters: same XSS vector as #4.

**6. `givelink.html:1209` — hardcoded `claude-opus-4-5` in AI sprint planner**
The sprint planner function `runAiSprintPlanner()` hardcodes `model:'claude-opus-4-5'` while the rest of givelink uses `claude-haiku-4-5-20251001`. This is inconsistently the most expensive model, for a feature that generates a list — haiku is sufficient and would be 20× cheaper per call.
- Commit: 72e03fe (#84)
- Why it matters: cost — every sprint plan generation hits Opus pricing unnecessarily.

**7. `givelink.html:1152` — empty catch swallowing profile-scan error**
In `getApiKey()`, the loop that scans `taskos_profiles` localStorage for a saved API key has a bare `}catch(e){}`. If localStorage is corrupted or profiles contain unexpected data, the error disappears.
- Commit: 72e03fe (#84)
- Why it matters: silent failure makes the "no API key" fallback (`prompt()`) fire unpredictably when the real problem is a parse error.

**8. `landing.html:40, 704` — empty catch blocks on analytics + consent init**
The PostHog analytics init and consent-cookie logic both use bare `}catch(e){}`. If PostHog fails to load (CSP block, ad blocker, network), no fallback or log is produced.
- Commit: b38d4bb (#83 — Landing growth)
- Why it matters: analytics data will silently drop; no way to diagnose if the PostHog key is misconfigured.

---

## 🤔 Worth a second look

**9. `givelink.html:1504` — `window.prompt()` for activity log entry**
The "Log activity" button in the NP CRM modal calls `window.prompt('Log activity (what happened?):')` — a blocking native dialog to capture the log note. This is consistent with the API-key prompt pattern but doesn't match the rest of the Givelink UI.
- Commit: 72e03fe (#84)
- Why it matters: UX inconsistency — all other modals use the custom in-page modals; native prompts disrupt the flow, especially on mobile.

**10. `vercel.json` — `'unsafe-inline'` in CSP for scripts**
`Content-Security-Policy` allows `script-src 'self' 'unsafe-inline' ...`. This is expected given that the app is a single HTML file with all scripts inline, but it means CSP provides no protection against injected scripts (#4/#5 if they escalated).
- Commit: present since vercel.json was added
- Why it matters: combined with the unescaped innerHTML findings, there's no CSP safety net. Tracking issue if XSS findings above are left unaddressed.

**11. `api/claude.js` — proxy `max_tokens` cap is 2000, model is Haiku**
The proxy caps `max_tokens` at 2000 and always uses `claude-haiku-4-5-20251001`, ignoring any model the caller requests. If index.html ever passes a model override (it currently doesn't for proxy calls), it would be silently ignored.
- Not a regression, just worth knowing when extending AI features.

---

*Generated by scheduled triage — 0 new commits this week. Next triage: 2026-10-05.*
