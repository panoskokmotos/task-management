# Givelink — Improvement Plan
_Generated: 2026-09-30 | Analyzed: index.html (14,926 lines), givelink.html (1,829 lines), landing.html (732 lines), api/claude.js (49 lines)_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### P0-1: AI proxy empty — all AI features are silently broken in hosted mode
- **What**: `aiProxy: ''` in `APP_CONFIG` means every AI feature (auto-triage, day planning, task assistant, morning briefing) silently falls back to requiring users to paste their own Claude API key — no hosted user will do this.
- **Where**: `index.html:9959`
- **Why it matters**: The entire AI value proposition is dead for any user who hasn't manually entered an API key. This is the core differentiator of the product.
- **Effort**: S
- **Suggested fix**:
  - Set `aiProxy: '/api/claude'` in `APP_CONFIG`
  - Deploy `api/claude.js` with `ANTHROPIC_API_KEY` set as a Vercel env var
  - Address rate limiting (see P1-5) before enabling, or you expose unbounded spend

### P0-2: Personal "About Me" fallback leaks into AI prompts for all users
- **What**: Three AI paths use `"Panos — Greek founder in his 20s building Givelink..."` as the fallback when a user has no About Me profile. All other call sites use a generic fallback.
- **Where**: `index.html:7849`, `index.html:9806`, `index.html:12186`
- **Why it matters**: Hosted users without a filled profile receive AI suggestions colored by the founder's personal context (Greek founder, Givelink SaaS, San Francisco), breaking trust and making the AI seem confused.
- **Effort**: S
- **Suggested fix**:
  - Replace all three with the same generic string used elsewhere: `'A focused individual organizing their work and personal goals.'`
  - Add a lint/grep check to CI to catch re-introduction of personal strings

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### P1-3: Post-login sync failure is swallowed silently
- **What**: `try{await sbSyncNow(true);}catch(e){}` swallows all sync errors after login; users land on an empty dashboard with no feedback.
- **Where**: `index.html:10131`
- **Why it matters**: If sync fails (expired token, Supabase schema mismatch, network timeout), users see their data is missing and assume the app is broken — leading to churn on first use.
- **Effort**: S
- **Suggested fix**:
  - Replace `catch(e){}` with `catch(e){ toast('⚠ Could not load your data — ' + e.message); }`
  - Set the sync pill to error state so users know to retry

### P1-4: Magic link / OTP auth errors discard the actual failure reason
- **What**: The catch block in auth sends a generic "Could not send the link — try again" regardless of the real Supabase error (rate-limited, OTP disabled, invalid email format, etc.).
- **Where**: `index.html:10106`
- **Why it matters**: Users get identical messaging for entirely different problems; rate-limited users keep retrying and making it worse.
- **Effort**: S
- **Suggested fix**:
  - Pass `e.message` (sanitized) to `_agErr()` so "Email rate limit exceeded" and similar surface clearly
  - Add special handling for the most common Supabase auth errors

### P1-5: No rate limiting on the AI proxy — unbounded spend risk
- **What**: `api/claude.js` explicitly notes (line 12–13) that per-user rate limiting is missing. Currently safe only because the proxy is disabled (P0-1).
- **Where**: `api/claude.js:12`
- **Why it matters**: Enabling P0-1 without this creates an open spend tap — any authenticated user could hammer the Anthropic API and run up the bill.
- **Effort**: M
- **Suggested fix**:
  - Add Upstash Redis rate limiting (free tier, ~20 min to wire up) before enabling the proxy
  - Or: store a per-user daily token counter in Supabase and reject calls over limit
  - Set a hard budget alert in Anthropic Console as a backstop

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### P2-6: Hardcoded personal financial targets (€25,000 / €300) visible to all users
- **What**: Finance view renders `goal: €25K` and `goal: €300` as hardcoded magic numbers; the `targets` object also hardcodes `{income:25000, passive:3600}`.
- **Where**: `index.html:5323–5324`, `index.html:3558`
- **Why it matters**: Every user sees the founder's personal income goals as their own. The Finance view is confusing or misleading to anyone who hasn't manually changed these values.
- **Effort**: S
- **Suggested fix**:
  - Move targets to a user-editable settings field stored in localStorage/Supabase
  - Default to `null` / empty state with a "Set your target" CTA on first visit

### P2-7: givelink.html has near-zero accessibility (1 aria-label in 1,829 lines)
- **What**: All interactive elements (nav items, task cards, goal cards, pillar cards, CRM cards) are bare `<div>` elements with `onclick` handlers — no `role`, no `aria-label`, no keyboard nav.
- **Where**: `givelink.html` — all `.ni`, `.tc2`, `.gc2`, `.pcard`, `.crm-card` elements
- **Why it matters**: Screen reader users can't use the app at all. Keyboard-only users (power users, accessibility-requirement customers) are blocked. Also a legal risk as the app targets nonprofits/charitable giving.
- **Effort**: M
- **Suggested fix**:
  - Convert clickable divs to `<button>` elements, or add `role="button"` + `tabindex="0"` + `onkeydown` Enter handler
  - Add descriptive `aria-label` to all cards
  - Add `:focus-visible` outline styles

### P2-8: 14,926-line monolithic HTML file with 711+ functions
- **What**: The entire app — CSS, HTML structure, and all JS — lives in a single 1MB file with no module system, no bundler, and no incremental testing.
- **Where**: `index.html` (entire file)
- **Why it matters**: Any change risks breaking unrelated views. The file can't be linted, tree-shaken, or tested in isolation. Onboarding new contributors is extremely difficult. This is the root cause of several other P2 items.
- **Effort**: L
- **Suggested fix**:
  - Start incremental extraction: pull the Supabase auth/sync block (~200 lines, `index.html:9938–10160`) into `js/sync.js` as a first PR
  - Then extract the AI/callClaude block (~300 lines) into `js/ai.js`
  - Use `<script type="module">` — no bundler needed initially

### P2-9: 23 `console` statements left in production code
- **What**: 23 `console.warn` / `console.error` calls in production paths (boot sequence, sync handlers, render fallback at line 10689) expose internal state in devtools.
- **Where**: `index.html` — 23 occurrences (run `grep -n "console\." index.html`)
- **Why it matters**: Exposes internal function names and app state; looks unprofessional in a B2B context; can slow down low-end devices.
- **Effort**: S
- **Suggested fix**:
  - Add `const DEBUG = new URLSearchParams(location.search).has('debug');` near the top
  - Gate all non-critical console calls behind `if(DEBUG)`
  - Keep `console.error` for genuine unexpected failures only

### P2-10: Toast, modal, and nav boilerplate duplicated across index.html and givelink.html
- **What**: Both files independently implement `toast()`, modal patterns, mobile hamburger+overlay, and bottom nav (~80 lines each, near-identical).
- **Where**: `index.html` + `givelink.html`
- **Why it matters**: Any UI polish (animation, styling, behavior) must be manually mirrored. Currently the two implementations have drifted slightly, creating inconsistent UX.
- **Effort**: M
- **Suggested fix**:
  - Extract to a shared `js/ui.js` (~100 lines) imported by both files
  - Start with `toast()` since it's the simplest and most called function

---

## 💡 P3 — Nice to have

### P3-11: `plannedDate` field is invisible in index.html — cross-app field orphaned
- **What**: The `plannedDate` task field added for the "This Week" view in givelink.html exists in the data model but is never displayed or editable in index.html's task modal or task cards.
- **Where**: `givelink.html:639, 640, 774, 793` (field exists); `index.html` (absent)
- **Why it matters**: Users who switch between the two app views lose the ability to see or manage their weekly plan assignments.
- **Effort**: S
- **Suggested fix**: Add `plannedDate` to index.html's task edit modal (a simple date picker alongside the due date field)

### P3-12: PostHog analytics key is empty — no visibility into user flows
- **What**: `posthogKey: ''` in `APP_CONFIG` means analytics are silently disabled. The infrastructure is wired up and ready.
- **Where**: `index.html:9960`
- **Why it matters**: No visibility into signup conversion, feature adoption, or error rates. Flying blind on product decisions.
- **Effort**: S
- **Suggested fix**: Set `posthogKey` to the production PostHog project API key via Vercel env var (inject at build time or leave as runtime config)

### P3-13: Model ID hardcoded as string in two separate files
- **What**: `'claude-haiku-4-5-20251001'` is hardcoded in both `api/claude.js:42` and `index.html:5023`. Upgrading the model requires finding and editing both places.
- **Where**: `api/claude.js:42`, `index.html:5023`
- **Why it matters**: Low risk today, but will cause a split-brain upgrade when a new model ships.
- **Effort**: S
- **Suggested fix**: Define a single `const AI_MODEL = 'claude-haiku-4-5-20251001'` in a shared config location; reference it from both files

---

_Total items: 13 | P0: 2 | P1: 3 | P2: 5 | P3: 3_
