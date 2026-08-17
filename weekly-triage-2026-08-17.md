# Weekly Triage — 2026-08-17

## 📊 Week at a glance
- Commits this week: **0** (last commit was 2026-07-22 — 26-day gap)
- Sprint reviewed: 12 commits, Jul 10–22 | Files changed: 14 (unique) | Debt markers added: 0 TODO/FIXME
- High-churn files: `index.html` (11/12 commits), `sw.js` (10/12 commits), `landing.html` (3/12 commits)

> Note: No new activity this week. Triage covers the Jul 10–22 sprint — findings still live in `HEAD`.

---

## 🚨 Needs immediate attention

### 1. Givelink removal is incomplete — `index.html:2503`, `2507`, `2517`, `2984`, `8618`
**Commit:** `d635c06` ("Remove Givelink from Task OS")  
**Why this matters:** The commit title claims full separation but Givelink is still wired into the core data model, the router, the badge system, and the seeded task list. New users get Givelink-specific tasks seeded. The `givelink-dash` view is still reachable. If you're selling "Arete" as a clean personal OS, this is brand confusion and a data hygiene problem.

- `index.html:2503` — `givelink` still in the `CATS` category map
- `index.html:2507` — `givelink` still under the `wealth` domain
- `index.html:2517` — `givelinkMetrics` and `givelinkHistory` still in the default state `S`
- `index.html:2984` — `'givelink-dash': renderGivelinkDash` still in the view router
- `index.html:8618` — `renderGivelinkDash()` function still present
- `index.html:7068-7070` — Givelink-specific achievement badges still active
- `index.html:4546-4754` — ~15 seeded tasks still tagged `category:'givelink'`

---

### 2. Claude API key stored in app state and exported to localStorage — `index.html:2517`, `5022`
**Commit:** `76d794a` (long-standing)  
**Why this matters:** `S.claudeKey` is part of the global state object that gets `JSON.stringify`'d and written to localStorage on every `save()`. Any browser extension, third-party script, or XSS gadget can read `localStorage.getItem('taskos')` and extract the key. The header `anthropic-dangerous-direct-browser-access: true` (line 5022) acknowledges the risk — the key exposure via state serialization is the bigger problem.

---

### 3. Hardcoded Supabase credentials in source — `index.html:9957-9958`
**Commit:** `e0b0a00` (#68)  
**Why this matters:** The production Supabase URL and anon key are literal strings in the shipped HTML. The anon key is designed to be public (RLS protects data), but hardcoding the URL + key means rotating either requires a code change + deploy. Anyone who forks or views source has the endpoint. Should live in a build-time env var or be set by the user in Settings (the Settings UI already exists).

```
supabaseUrl : 'https://bgvddpkdsftgynxyhnoc.supabase.co',
supabaseAnon: 'sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M',
```

---

### 4. Multiple `await fetch` calls to Supabase auth/REST without error handling — `index.html:10012`, `10040`, `10081`, `10101`, `10398`, `10409`
**Commit:** `e0b0a00` (#68), `67de902` (#50)  
**Why this matters:** If the user is offline or Supabase is unreachable, these throw unhandled promise rejections. The token-refresh path (`_sbRefresh`, line 10025) is especially risky — a failed refresh during an active session could silently log the user out or leave the app in a broken state with no user-visible feedback.

---

## 🧹 Cleanup opportunities

### 5. `catch(e){}` silent-swallow in inline event handlers — `index.html:956`, `2587`, `2949`, `2983`, `3031`, `3583`, `3868`
**Commit:** Accumulated across multiple commits  
**Why this matters:** Errors in `_frCount()`, `_toggleNsGroup()`, `renderReview()`, and other UI functions are swallowed with empty catches. When these break they fail invisibly — no console trace, no user feedback. The surrounding `console.warn`-style catches are fine; the completely empty ones aren't.

---

### 6. Init block errors logged with no context — `index.html:13764-13769`
**Commit:** `0c1d32d` (#80)  
**Why this matters:** Six consecutive `try{initX()}catch(e){console.warn(e)}` calls log only the raw error with no function name. In production, `console.warn(e)` without a string prefix makes it impossible to identify which init step failed from a bug report.

```js
try{initQuickCapture();}catch(e){console.warn(e);}   // which one failed?
try{initPWA();}catch(e){console.warn(e);}
```

---

### 7. `window._lastClickX/Y` used as positional state for XP popups — `index.html:4476`, `7023`
**Commit:** long-standing  
**Why this matters:** Click coordinates are stored on `window` and consumed asynchronously. If `awardXP()` is called outside a click context (e.g., from a timer), `window._lastClickX` is undefined and the popup silently doesn't render. Low severity but a fragile implicit contract.

---

### 8. `_sbRefresh` called in token flow with no catch — `index.html:10025`
**Commit:** `e0b0a00` (#68)  
**Why this matters:** `_sbRefresh()` itself calls `_sbAuth()` which does a raw `await fetch`. If this throws (network down, token expired server-side), the caller gets an unhandled rejection. The user stays "logged in" locally but cloud sync is silently broken.

---

## 🤔 Worth a second look

### 9. Direct Anthropic API call from the browser — `index.html:5020-5022`
**Commit:** `76d794a`  
**Why this matters:** `fetch('https://api.anthropic.com/v1/messages', ...)` with the user's key works, and the `anthropic-dangerous-direct-browser-access` header is the correct acknowledgment header. This is intentional for a personal-use app. However if the `aiProxy` path ever gets removed, this becomes the only flow — worth keeping the proxy path healthy.

---

### 10. `seededV2` / `seededGoalsV3` flags in state but no `seededV3` — `index.html:2517`
**Commit:** long-standing  
**Why this matters:** The seed-guard pattern uses version flags. The current `seed()` and `seedGoals()` functions run behind `seededV2`/`seededGoalsV3` but there's no `seededGoalsV4` or similar after the Givelink tasks were supposed to be removed. Existing users who seeded before #73 still have those tasks; new users get them again. A migration step that removes seeded Givelink tasks would fix both.

---

### 11. `S.givelinkMetrics.impactModel.viralCoeff` hardcoded to `1.1` — `index.html:2517`
**Commit:** `e0b0a00` (#68)  
**Why this matters:** Magic number baked into default state for a product that was supposedly separated. If `givelinkMetrics` is being cleaned up (see item #1), this goes with it. If it's being kept, the `1.1` coefficient should be a named constant or configurable field.

---

### 12. Guest-mode nudge swallows its own errors silently — `index.html:2587`
**Commit:** `0e19b15` (#77)  
**Why this matters:** The guest-to-signup nudge is a key acquisition moment. If `_maybeGuestNudge()` throws (e.g., DOM not ready), it fails silently and `taskos_guest_nudged` never gets set — so it won't retry either. The catch should at minimum log.

---

*Generated by automated Monday triage — 12 commits scanned (Jul 10–22 sprint). No commits this week.*
