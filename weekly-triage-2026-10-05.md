# Weekly Triage — 2026-10-05

## 📊 Week at a glance
- **Commits this week:** 0 — last activity was Sep 12 (23 days ago)
- **Most recent commits:** `160f0d8` (Supabase keep-alive workflow) · `72e03fe` (Givelink bug fixes + This Week view)
- **Files touched in last sprint:** `givelink.html`, `index.html`, `.github/workflows/supabase-keepalive.yml`
- **Debt markers added:** 0 (no new TODO/FIXME/HACK added in recent commits)
- **High-churn files:** N/A — both `givelink.html` and `index.html` were touched once

---

## 🚨 Needs immediate attention

**1. `givelink.html:1155` + `givelink.html:1330` — Blocking `prompt()` for API key collection**
> Commit: `72e03fe`
> Both `getClaudeKey()` functions fall back to `window.prompt('Enter your Anthropic API key:')` when no key is in localStorage. This blocks the UI thread, breaks on mobile, and doesn't work in iframes or some PWA contexts — it silently fails. Users who haven't set a key in Settings will hit a blocking dialog on every AI feature click.
>
> Fix: route to the Settings sheet instead of prompting.

**2. `givelink.html:1504` — `window.prompt()` for activity logging**
> Commit: predates `72e03fe` but present in current code
> `window.prompt('Log activity (what happened?):')` is used to collect user input for activity logs. Same blocking/PWA-hostile issue as above. If the user cancels, the result is `null` and the code likely stores a null entry.

**3. `givelink.html:1152` — Silent `catch(e){}` on profile data read**
> Commit: `72e03fe` context (present in current `getClaudeKey()`)
> ```js
> try { const profiles = JSON.parse(...); ... } catch(e) {}
> ```
> If localStorage is corrupted or the JSON is malformed, the function silently continues and returns `null`, triggering the `prompt()` fallback unexpectedly. Silent swallow = no debugging signal.

---

## 🧹 Cleanup opportunities

**4. `givelink.html:1328` — Empty catch on Supabase key lookup**
> `try { k = p.claudeKey || ''; } catch(e) {}` — if parsing fails, `k` is empty and the caller gets `null`, then calls `prompt()`. Same chain as item 1. A `console.warn` would at least leave a breadcrumb.

**5. `index.html:9242` — Silent `catch(e){}` on AI response JSON parse**
> ```js
> try { act = JSON.parse((raw.match(/\{[\s\S]*\}/)||[])[0]); } catch(e) {}
> ```
> If the AI returns malformed JSON, `act` is `undefined`, but no user-visible error fires. The action silently no-ops. Should at minimum `toast('AI response could not be parsed')`.

**6. `index.html:9956–9962` — `APP_CONFIG.aiProxy` is empty on the hosted deployment**
> The proxy URL (`aiProxy: ''`) is unset in the committed config, so all AI features in the hosted app require users to supply their own Claude API key. This is gated in `index.html:4328` with a toast, which is fine — but worth noting that the hosted deployment has no AI fallback for users who won't enter a key. A Vercel `/api/claude.js` deployment is described in comments (`index.html:9951`) but not wired up.

**7. `index.html:13766–13772` — Init errors swallowed with `catch(e){console.warn(e)}`**
> Seven `try/catch` blocks at startup (`initQuickCapture`, `initPWA`, `initReminders`, etc.) all suppress exceptions to `console.warn` with no message. If one of these inits fails silently, the app looks functional but a feature is broken. Better: log the init name so failures are searchable in prod.

**8. `index.html:10390–10392` — PostHog analytics disabled in `APP_CONFIG`**
> `posthogKey: ''` — analytics never fires on the hosted deployment. Intentional (self-hostable project) but worth confirming: growth metrics from the landing page (PLG features added in `#77–#79`) would be invisible. If PostHog is desired, the key needs to be set.

---

## 🤔 Worth a second look

**9. `givelink.html:639–658` — This Week view: `plannedDate` string equality comparison**
> Commit: `72e03fe`
> The week grid filters tasks by `t.plannedDate === key` where `key` is `"2026-10-05"` (ISO date string). This assumes all `plannedDate` values were stored in ISO format. The save path (`givelink.html:793`) sets `plannedDate: document.getElementById('t-date').value || null` from an `<input type="date">`, which does produce ISO strings — but any tasks edited via the old code path (or imported) may have dates in other formats. A task with `"Mon Oct 05 2026"` would simply not appear.

**10. `.github/workflows/supabase-keepalive.yml` — Hardcoded Supabase URL and anon key in workflow**
> Commit: `160f0d8`
> Both `https://bgvddpkdsftgynxyhnoc.supabase.co` and `sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M` are hardcoded in the YAML `run` step. The commit message explicitly says this is intentional (same values already in `index.html`, anon key is public-safe). Worth flagging for awareness: if the project is ever migrated to a different Supabase instance, there are now two places to update (`index.html:APP_CONFIG` and `.github/workflows/supabase-keepalive.yml`). Consider using a GitHub Actions variable for the URL/key to keep them in sync.

**11. `index.html:2049` — `supabase-setup.sql` referenced but only the anon key is in `APP_CONFIG`**
> The `supabase-setup.sql` setup SQL exists and the anon key is in config, but `APP_CONFIG.supabaseAnon` uses a key format `sb_publishable_*` which is the new Supabase client-side key format (not the old `eyJ...` JWT format). The comment in the settings UI still says `eyJhbGciOi...` as the placeholder. This mismatch in the placeholder text could confuse new self-hosters trying to enter their own key.

---

_Triage by Claude Code — 2026-10-05. No commits landed in the past 7 days; analysis covers the two most recent commits (Sep 12, 2026)._
