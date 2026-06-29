# Weekly Triage — 2026-06-29

> **Note:** No commits landed in the last 7 days (last activity: 2026-06-08). This report covers the last 30-day window (4 commits) and a static scan of current code for debt markers.

---

## 📊 Week at a glance

- Commits (last 30d): **4** | Files changed: **1** (`index.html` every time) | Debt markers: **0** explicit (no TODO/FIXME/HACK) — but **10 empty catch blocks**, **4 modal bypasses**, and a handful of silent failures
- High-churn file: `index.html` (touched in **all 4 commits** — 12,893 lines, entire app in one file)
- Fix-to-feature ratio: **3 of 4 commits were bug fixes** — a sign of instability, not polish

---

## 🚨 Needs immediate attention

### 1. Four modals bypass `openM()` — PTR-behind-modal bug lives on
`index.html:6361`, `6978`, `9727`, `9853`, `11009`

Commits `eeb9b8f` and `70d4241` fixed this exact pattern for several modals (body class `modal-open` never set → pull-to-refresh fires behind the dialog). The fix landed, but at least **5 more call sites** still use `.classList.remove('hidden')` directly instead of `openM()`. One confirmed: `body-modal` at L11009 (`openBodyLog()`). The others open the weekly-notes editor, priority audit, and inbox-AI modals. Any of these will allow PTR to trigger under the modal on iOS PWA.

**Why this matters:** Same root cause as the production bugs fixed two weeks ago. Users logging body weight or running a priority audit will see broken behaviour on mobile.

---

### 2. Claude API called directly from the browser with `anthropic-dangerous-direct-browser-access`
`index.html:4136–4142` — introduced in commit `537b01a`

```js
headers: {
  'x-api-key': S.claudeKey,
  'anthropic-dangerous-direct-browser-access': 'true'
}
```

The API key is stored in `localStorage` as `taskos_api_key` / `S.claudeKey`. Any XSS on the page (or a malicious browser extension) exfiltrates the key. The `anthropic-dangerous-direct-browser-access` header name itself is the SDK's warning that this pattern is not production-safe.

**Why this matters:** Key theft → unbounded spend on the owner's Anthropic bill. For a personal app where the user entered their own key this is an accepted risk, but it should be a known, documented decision — not an accidental posture.

---

### 3. Supabase anon key + refresh token in `localStorage` — no expiry, no rotation
`index.html:8520`, `8533`, `8563`, `8573` — commit `67de902`

The Supabase URL, anon key, email, and JWT refresh token are all stored in plain `localStorage`. Refresh tokens are long-lived. Same XSS risk as above; additionally, the `autoSnap` function at L8648 silently swallows **all** Supabase write errors (`catch(e){}`), so sync failures are invisible to the user.

**Why this matters:** A failed auto-snapshot could mean days of data not syncing to the cloud with no warning shown.

---

### 4. Personal/private data hardcoded in `seed()` — will appear for every new user
`index.html:3659–3795` — commit predates recent activity

`seed()` populates sample tasks with real personal details: Greek medical appointments ("Ακτινογραφία στα γόνατα", "Πνευμολογικές εξετάσεις"), specific financial figures ("245€ in investments from seminaria"), and brokerage references ("Verify Etoro account"). If this app is ever shared or open-sourced, this data ships to every new user's `localStorage`.

**Why this matters:** PII leak risk; also breaks the UX for anyone who isn't you — their "getting started" tasks are your personal to-dos.

---

## 🧹 Cleanup opportunities

### 5. Hardcoded model string — will break when model is deprecated
`index.html:4139` — commit `537b01a`

```js
model: 'claude-haiku-4-5-20251001'
```

No constant, no config, no fallback. When this model ID is retired the AI features silently stop working.

---

### 6. 10 empty `catch` blocks — silent failures
`index.html:2433`, `2501`, `2877`, `3230`, `4516`, `8624`, `8657`, `8675`, `9310`, `10054`

Most are low-risk (UI state persistence), but notable:
- **L8624** — `try{refresh();}catch(e){}` in the Supabase sync path: a failed cloud sync is swallowed with no user feedback
- **L8657** — `catch(e){}` wrapping the entire auto-snapshot write: see item #3 above
- **L9310** — ntfy push notification failure is silently dropped (fine, but worth a `console.warn` for debugging)
- **L10054** — EOD XP award failure is silently swallowed (XP could be lost with no indication)

---

### 7. `_goalMomentum` name collision — function is 12 lines but appears at line 11,747
`index.html:11747`

The Python size estimate flagged this as ~1,147 lines because it's the last named function before `</script>`. The function itself is correct and concise. No action needed — just a reminder that the file's structure makes automated analysis unreliable.

---

### 8. `seed()` is ~394 lines of inline data
`index.html:3659–4052` — predates recent activity

It's a one-time seeding function that will never run again for existing users (`if(S.seededV2)return`), but it accounts for ~3% of the file. It could be extracted to a separate JSON or stripped for non-owner builds.

---

### 9. `renderDash()` is ~162 lines; `renderDeepWork()` ~61 lines
`index.html:2460`, `4635`

These are the largest render functions actively called on every navigation. Long render functions make it hard to trace bugs (like the wins-blank-title bug that needed a 4-commit patch). No immediate breakage, but they're the reason small schema changes cause widespread display bugs.

---

## 🤔 Worth a second look

### 10. Three bug fixes landed on the same morning (June 8, 09:32–09:45)
Commits `eeb9b8f`, `70d4241`, `7b27281`, `0b54845` — all within 13 minutes

Four separate PRs, all fixing modal/event bugs introduced by the Givelink dashboard and North Star features from the prior sprint. The rapid back-to-back patches suggest the feature was shipped without end-to-end mobile testing. The `body.modal-open` pattern has now been patched in multiple places; a single regression test for "modal close → PTR should not fire" would prevent this class of bug recurring.

---

### 11. `autoFillReview()` uses AI to pre-populate the weekly review form — no loading state
`index.html:5289` (~63 lines)

The function calls `callClaude()` and then fills in form fields, but there's no visual indicator while the call is in flight. If the network is slow, fields appear to do nothing when the button is clicked.

---

### 12. `givelink.html` exists as a separate file — not in the commit log
`/home/user/task-management/givelink.html` is present but was not touched in any of the last 30 commits. If it shares state with `index.html` via `localStorage`, schema changes to task/win objects (e.g., `.text` vs `.title`) may not have been applied there.

---

*Scan coverage: `index.html` (12,893 lines), `sw.js`, `givelink.html` (not analysed above — see item 12), `supabase-setup.sql`. No test files found in the repo.*
