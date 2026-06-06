# Weekly Triage — 2026-06-06

> **Note:** No commits landed in the last 7 days (last commit `67de902` was 2026-05-29). This triage covers the most recent commit batch (May 28–29, 2026) — six commits that added ~800 net lines of code, including the brand-new Supabase sync layer and the North Star Pace Engine. These have not been in production long enough to have post-deploy monitoring data.

---

## 📊 Week at a glance

- **Commits (last 30d active period):** 8 | **Files changed:** `index.html` (touched in all 8), `sw.js` (3), `supabase-setup.sql` (1, added)
- **Net additions in most recent batch:** ~800 lines to `index.html`, 52 lines in `supabase-setup.sql`
- **Debt markers added this sprint:** 0 TODOs / 0 FIXMEs — but 3 new empty catch blocks and 1 untested async flow
- **High-churn files:**
  1. `index.html` — modified in every single commit, 100% churn rate
  2. `sw.js` — touched in 3 of the last 8 commits (DD service worker scope changes)
  3. `supabase-setup.sql` — newly added but referenced by untested code

---

## 🚨 Needs immediate attention

---

**1. Supabase sync explicitly flagged as untested — in production now**
`index.html:8545–8634` | commit `67de902`

The commit message itself says _"couldn't be tested against a live project in this environment — needs a real project to verify end to end."_ The code is now live. If a user enables cloud sync and auth fails (wrong anon key, email sign-up disabled in their Supabase project), the error is swallowed — `_sbSetStatus` writes to a string inside the Settings panel that most users never open. Their assumption: data is syncing. Reality: every save since setup has been localStorage-only.

_Why this matters:_ Silent data-loss risk. A user who trusts "cloud sync is on" and then reinstalls their browser loses everything.

---

**2. `_fetchAIBriefing` is a floating unhandled promise**
`index.html:9659` | commit `d3a28fb` (dashboard briefing added)

```js
// line 9659 — no .catch(), no try/catch inside the function:
_fetchAIBriefing(ctx, el, cacheKey);
```

The function makes a `callClaude()` network call with no try/catch wrapper. When the API is slow or the key is rate-limited, this produces an unhandled promise rejection. On Chrome 124+, unhandled rejections in the microtask queue can prevent subsequent `.then()` chains in the same frame from executing.

_Why this matters:_ The morning briefing fails silently on every API hiccup, leaving the dashboard card blank — no "retry" affordance, no error message.

---

**3. XSS via `t.title` in delete toast — introduced in core task flow**
`index.html:3128` | long-standing, amplified by every new feature that adds tasks

```js
toast(`🗑 "<strong>${t.title.slice(0,30)}</strong>" deleted — ...`);
```

`t.title` is never escaped before HTML interpolation. The `esc()` utility exists at line 9768 but is not used here. This is the most-executed toast in the app (every task delete). Any title containing `<img onerror=...>` or `<script>` will execute in the toast stack.

_Why this matters:_ If this app is ever shared across users or the state syncs via Supabase (now it can!), a crafted task title becomes a stored XSS payload that fires for every user who views the task list.

---

**4. Empty catch in post-sync refresh can leave DOM stale**
`index.html:8619` | commit `67de902`

```js
try { refresh(); } catch(e) {}  // silent
```

After a successful Supabase pull, `S` is updated in memory and `save()` is called — but then `refresh()` is called bare with an empty catch. If the current view's render function throws (a bug introduced by any of the other 7 recent commits), the user sees old data even though the underlying state was overwritten. They can't detect this without hard-reloading.

_Why this matters:_ This code path was added alongside 800 new lines; a render bug in any of the new views (North Star Cockpit, Givelink widgets, calendar glance) would trigger this silent failure.

---

## 🧹 Cleanup opportunities

---

**5. Three new empty catch blocks in the May 29 batch**
`index.html:8619, 8652, 4513` | commit `67de902`

| Line | Wraps | Risk |
|------|-------|------|
| 8619 | `refresh()` after Supabase pull | High — stale UI |
| 8652 | Unknown (inside `_autoSnapshot`) | Medium — snapshot silently skipped |
| 4513 | `awardXP(5,'workflow')` | Low — XP not awarded |

The `awardXP` catch (4513) is harmless. The other two should at minimum log with `console.warn` so there's a debug trail.

_Commit:_ `67de902` (2026-05-29). Replace with `catch(e){ console.warn('[sync]', e); }`.

---

**6. `_autoSnapshot` wraps its entire body in `try{}catch(e){}` with no log**
`index.html:8639–8653` | commit `67de902`

The daily Givelink history snapshot (which feeds the Pace Engine trends) is silently skipped on any error. If `S.givelinkMetrics` is malformed or `save()` throws, the trend data stops accumulating and the Pace Engine shows flat "0 rate/wk" with no explanation.

_Why this matters:_ The Pace Engine's entire value proposition is trend data. Silent snapshot failures degrade it invisibly over time.

---

**7. Hardcoded `"Panos"` in 6 AI prompt templates**
`index.html:9664, 4433, 4449, 4637` | commits `1d3ea98`, `d3a28fb`

The AI prompt strings were added in the most recent two commits and hard-code the founder's name. This works today but becomes a blocker the moment a second person uses the app or the template is shared.

_No urgency,_ but cheap to fix now (find-and-replace → `S.profileName||'you'`) before the pattern spreads to more prompts.

---

**8. `#a78bfa` hardcoded 38 times — light mode regressions**
`index.html` (scattered) | accumulates across multiple commits

38 inline style occurrences of `#a78bfa` bypass the CSS variable system. In `body.light` mode these render as violet-on-white with potentially low contrast. The variable `--brand2` is already defined for both themes; the hardcoded values just need to be swapped.

_Commit pattern:_ Added gradually across feature commits; highest density in the navigation and Givelink dashboard sections added in `dd16e0c` and `3a32d45`.

---

## 🤔 Worth a second look

---

**9. Supabase `_sbAuth` auto-sign-up fallback — intentional but risky**
`index.html:8570–8590` | commit `67de902`

```js
// If login fails, try signup:
try { j = await _sbAuth('password', {email, password}); }
catch(_) {
  j = await _sbAuth('signup', {email, password});
}
```

The intent is convenience — one form does both login and register. The risk: if a user mis-types their email, a new account is silently created with the wrong email and their data gets pushed there. On the next login (with the correct email), `sbPull` returns empty rows and the local state is pushed up, orphaning the data that was pushed to the wrong account.

_Likely intentional,_ but worth adding a "Created new account — you're now syncing as [email]" confirmation toast so users know which account is active.

---

**10. `S={...S,...remote.data}` — no schema validation on remote merge**
`index.html:8615` | commit `67de902`

```js
S = { ...S, ...remote.data };
```

The remote Supabase blob is blindly spread over the local state with no type-checking. If a future schema change makes a field a `Map` locally but the remote still has a plain object, the spread silently reverts the field to the old type. This is how subtle data corruption gets introduced over time in last-write-wins sync systems.

_Probably fine today_ (single user, single schema version). Flag for when a second device or user enters the picture — the `_updatedAt` timestamp alone is not enough conflict resolution.

---

**11. `navigator.serviceWorker` `updatefound` listener added without `once:true`**
`index.html:8677–8683` | commit `dd16e0c`

The SW update handler registers a new `statechange` listener on every `updatefound` event. If the service worker goes through multiple install cycles in a session (e.g., user stays on the page during a deploy), `showUpdateBanner()` fires multiple times, stacking the update notification banner.

_Likely rare in practice_ but a one-word fix: `{ once: true }` on the `addEventListener`.

---

_End of triage. 11 items total: 4 need immediate attention, 4 are cleanup, 3 are worth watching. Priority order: fix items 1–4 before the next user enables cloud sync._
