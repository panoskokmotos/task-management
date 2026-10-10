# Weekly Triage — 2026-10-10

## 📊 Week at a glance
- Commits: **0** in the last 7 days | **2** in the last 30 days | Debt markers added: **0 new** (pre-existing only)
- High-churn files: `index.html` (touched every PR), `givelink.html` (2 recent PRs)
- Last commits: `160f0d8` (Supabase keep-alive, 2026-09-12), `72e03fe` (Givelink bug fixes, 2026-09-12)

> No commits landed in the past 7 days. Triage below covers the two most recent commits (both landed 2026-09-12) plus a full debt scan of all changed files.

---

## 🚨 Needs immediate attention

### 1. Hardcoded owner bio in 5 AI functions — wrong advice for every user
**File:** `index.html:13535, 13544, 13553, 13614, 13624`
**Commit that introduced it:** Pre-existing, but worsened by `72e03fe` (Givelink features added without updating fallbacks)
**Why this matters:** Any user without a manual "About me" entry gets AI analysis written from the perspective of *Panos, Givelink founder, Greece→SF*. The advice is confidently wrong for everyone else.

### 2. No rate limiting on `/api/claude` proxy
**File:** `api/claude.js:12` (self-documented as missing)
**Commit:** Pre-existing, never addressed
**Why this matters:** The proxy is unauthenticated for token cost — any signed-in user can loop calls and exhaust the monthly Anthropic budget in minutes. No logging of per-user usage exists.

### 3. Claude API key serialised into the `taskos` localStorage blob
**File:** `index.html:2580` (`save()` → `JSON.stringify(S)`); key written at line 9917
**Commit:** Pre-existing
**Why this matters:** `exportData()` (line 2599) dumps `S` as JSON including `claudeKey`. A user who shares their backup file leaks their Anthropic API key. Also exposed to any XSS or browser extension with `localStorage` access.

### 4. `skills` NaN crash guard added in `72e03fe` — but only for `hoursLogged`
**File:** `index.html` (renderSkills function, touched by `72e03fe`)
**Commit:** `72e03fe`
**Why this matters:** The fix guarded `sk.hoursLogged` with `||0` but other numeric fields on the skills object (e.g. `targetHours`, `lastPracticed` date math) have no similar guard. The same class of bug can recur on any field added before the `||0` pattern was established.

---

## 🧹 Cleanup opportunities

### 5. Commented-style personal tasks in `seed()` / `seedGoals()` ship to all users
**File:** `index.html:4537–4780`
**Commit:** Pre-existing (never updated after rebrand to Arete)
**Why this matters:** Tasks like `"EYE post"`, `"LinkedIn Viral Predictor App"`, `"Present on a big stage challenge"` are the owner's personal backlog. A non-hosted user's "Getting Started" experience looks like someone else's todo list.

### 6. `save()` calls scattered everywhere but none after token refresh in `_sbToken()`
**File:** `index.html:10022–10026`
**Commit:** Pre-existing
**Why this matters:** `_sbToken()` refreshes the Supabase JWT and stores it via `_sbStoreSession(j)` but does not call `save()`. If the app crashes between the token refresh and the next natural `save()`, the new token is lost and the user gets silently logged out on reload.

### 7. `getAboutMe()` returns empty string — no prompt to fill it in
**File:** `index.html:9936`
**Commit:** Pre-existing
**Why this matters:** The function exists and is called before every AI feature, but the Settings UI never nudges the user to complete it. Empty bio → low-quality AI output, which trains users to distrust the AI features.

### 8. Supabase anon key and project URL committed to public repo
**File:** `index.html:9957–9958`
**Commit:** Pre-existing
**Why this matters:** `sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M` and `https://bgvddpkdsftgynxyhnoc.supabase.co` are in the public repository. Supabase anon keys are meant to be public (RLS protects data), but if RLS is misconfigured even briefly, the URL + key pair is all an attacker needs. Consider a comment linking to RLS docs.

---

## 🤔 Worth a second look

### 9. Service worker `statechange` fires on `'activated'` not `'installed'`
**File:** `index.html:10695–10698`
**Commit:** Pre-existing
**Why this matters:** The update banner fires when the new SW is fully in control (activated), not when it is ready and waiting (installed). This means the prompt to reload appears *after* the user is already on the new version, which is a no-op UX-wise. Intentional? Most update-prompt patterns fire on `installed`.

### 10. `posthogKey` is empty — PostHog init runs but no data flows
**File:** `index.html:9960, 10392`
**Commit:** Pre-existing
**Why this matters:** The PostHog snippet initialises and the `track()` helper wraps all events, but `posthogKey: ''` means the library silently no-ops. Product decisions are being made without conversion/retention data. If this is intentional (self-hosted telemetry off), add a comment; if not, wire up the key.

### 11. `_applyPendingTemplate()` called 3 times on login path with no idempotency guard
**File:** `index.html:10134, 10381, 10479`
**Commit:** Pre-existing
**Why this matters:** Template application is triggered in three places during the post-login flow. If any of the async auth calls resolves more than once (e.g. magic link followed by a password login), the template could be applied twice, duplicating tasks silently.

---

*30-day churn leaders: `index.html` (every commit), `givelink.html` (2 of 2 commits)*
*No new `TODO`/`FIXME`/`@ts-ignore`/`eslint-disable` markers found in changed files this week.*
*No new dependencies added this cycle.*
