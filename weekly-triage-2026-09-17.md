# Weekly Triage — 2026-09-17

## 📊 Week at a glance

- **Commits**: 2 | **Files changed**: 3 | **Debt markers added**: 0
- **High-churn files**: `givelink.html` (96 lines changed), `index.html` (14 lines changed), `.github/workflows/supabase-keepalive.yml` (new file)
- **Debt markers in changed files**: 0 TODO/FIXME/HACK, 0 `console.log` debug statements
- **New dependencies**: None

---

## 🚨 Needs immediate attention

### 1. `seed()` contains the owner's personal medical and financial tasks — in a public repo

`index.html:4538-4900` | commit `72e03fe`

The `seed()` function (which runs for non-hosted / self-hosted users) contains personal tasks: knee X-ray ("Ακτινογραφία στα γόνατα"), pulmonary tests, Etoro account verification, Vodafone phone. These are in a public GitHub repository.

Why this matters: Anyone viewing the repo source sees the owner's personal health and financial tasks. Low attack surface but high personal privacy exposure.

---

### 2. OAuth error hash unhandled — auth errors silently swallowed

`index.html:10364-10386` | bug predates this week but exposed by auth work in `72e03fe`

`_authBoot()` handles `#access_token=` but has no branch for `#error=access_denied` (expired magic link, denied OAuth consent). `landing.html` correctly redirects error hashes to the app, but the app discards them, leaving users at a blank auth gate.

Why this matters: Every user who clicks an expired magic link or denies Google consent gets a confusing experience with no guidance on what to do next.

---

### 3. `sbConnect()` falls through from failed login to auto-signup

`index.html:10036-10051` | bug predates this week

Wrong-password login silently attempts account creation. A user who misremembers their password may end up creating a duplicate account with their mistyped password as the credential.

Why this matters: Account duplication is non-recoverable from the user's perspective (no merge path). Affects anyone whose primary access method is password.

---

### 4. No rate limiting on Claude proxy

`api/claude.js:13,43-50` | acknowledged in comments, never fixed

The comment at line 13 says "For production add per-user rate limiting" — it remains unimplemented. There's no cap on how many requests a single user can make.

Why this matters: One session with large context can saturate Anthropic quota, breaking AI features for everyone. No visibility means this goes undetected until the invoice arrives.

---

### 5. XSS via unescaped task titles in `innerHTML` — `esc()` exists but is not applied

`index.html:3159,3223,3274,3594,3601,3716,3844` | `esc()` at line 11776 added long ago

`t.title` is interpolated into template literals assigned to `.innerHTML` at multiple call sites in rendering functions. The `esc()` helper exists but is inconsistently applied. The delete-undo toast (line 3844) explicitly wraps `t.title.slice(0,30)` in `<strong>` and passes it through `innerHTML`.

Why this matters: A task title like `<img src=x onerror=alert(1)>` executes. For a single-user app this is self-XSS; if imported JSON data from an external source is ever trusted, this is a real injection vector.

---

## 🧹 Cleanup opportunities

### 6. Keep-alive workflow `curl` doesn't fail on HTTP errors

`.github/workflows/supabase-keepalive.yml:22-25` | commit `160f0d8`

The `curl` call uses `-o /dev/null` without `--fail`. An HTTP 503 (paused project) or 404 would still exit 0, marking the workflow run as green while the database is actually paused.

**Fix**: Add `--fail` to the curl flags. One-liner change, prevents silent failures.

---

### 7. `saveContent()` and `saveExperience()` `createdAt` clobber — just fixed, check for similar patterns

`index.html:12654,12819` | fixed in commit `72e03fe`

Both functions were overwriting `createdAt` with `undefined` when editing. The fix (spreading `createdAt` explicitly) was applied to these two. Search for other `save*()` functions that use `{...existing,...obj}` with `obj` containing `createdAt: editId ? undefined : new Date()` — this pattern exists in other modules and may carry the same bug.

**Search**: `grep -n "createdAt:editId\?undefined" index.html`

---

### 8. `api/claude.js` — model ID and API version are magic strings

`api/claude.js:44,46` | predates this week

Model `'claude-haiku-4-5-20251001'` and `anthropic-version: '2023-06-01'` are hardcoded literals. Upgrading either requires a code change + deploy. The `2023-06-01` API version is old and will eventually be sunset.

**Fix**: Extract as named constants at the top of the file, or read from `process.env.CLAUDE_MODEL` / `process.env.ANTHROPIC_API_VERSION`.

---

### 9. `_removePasteItem()` bounds check — just added, verify no similar double-click races elsewhere

`index.html:12541-12544` | fixed in commit `72e03fe`

The bounds check `if(i<0||i>=_pasteItems.length)return;` was added for rapid double-click. Any other list-mutating functions that take an index as a parameter could have the same race. Worth a quick audit.

---

## 🤔 Worth a second look

### 10. `_welcomeSeed()` sets `window._justWelcomed = true` as a global flag

`index.html:10456` | predates this week, surfaced during auth audit

`_justWelcomed` is a module-level global that triggers the onboarding tour after `_afterAuth()`. If the user reloads mid-auth (e.g. slow connection) the flag is lost and the tour never starts.

Likely intentional (best-effort), but worth adding a localStorage fallback if the tour is a key activation step.

---

### 11. `givelink.html` "This Week" plannedDate field — no data migration for existing tasks

`givelink.html` | added in commit `72e03fe`

The new `plannedDate` field is added to new/edited tasks but existing localStorage tasks won't have it. The "Unscheduled" section handles this (`!t.plannedDate`), so the UX is fine. However, if the field is ever made required by other logic, old tasks will silently break.

Not a bug today, but keep in mind if `plannedDate` gets stricter validation.

---

### 12. Supabase keep-alive pings every 2 days but only covers REST endpoint

`.github/workflows/supabase-keepalive.yml` | commit `160f0d8`

The workflow pings `/rest/v1/` but not `/auth/v1/`. Supabase may pause the Auth service independently if there's no auth activity (e.g., no new logins for 7 days). Worth verifying whether pinging REST is sufficient to prevent auth endpoint pausing, or if an auth endpoint ping should be added.

---

*Triage performed by automated scan of commits since 2026-09-10. All findings verified against source.*
