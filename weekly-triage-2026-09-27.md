# Weekly Triage — 2026-09-27

## 📊 Week at a glance
- **Commits this week (Sep 20–27):** 0
- **Last active commits:** Sep 12, 2026 (15 days ago — PRs #84 and #85)
- **Files changed last active week:** `givelink.html` (+93 lines), `index.html` (+14 lines), `.github/workflows/supabase-keepalive.yml` (new)
- **Debt markers added this week:** 0 (no commits)
- **High-churn files (last 30 days):** `givelink.html` (touched in PRs #79, #80, #81, #84), `index.html` (every PR)

No new commits landed in the past 7 days. This report covers residue from the two Sep 12 commits (last active development) and standing structural debt found in the current codebase.

---

## 🚨 Needs immediate attention

### 1. Push notification icon path is broken
- **File:** `sw.js:46-47`
- **Commit introduced:** Likely original sw.js setup (pre-history in this branch)
- **Why this matters:** Any push notification (habit reminder, snooze alarm) shows a broken icon. Looks like spam, damages user trust in the reminder system.
```js
icon:'./icons/icon-192.png',   // ← file does not exist at ./icons/
badge:'./icons/icon-192.png',  // ← should be ./icon-192.png
```

### 2. Push notification permission silently never granted
- **File:** `index.html:~11270`
- **Commit introduced:** Feature-era (pre-history)
- **Why this matters:** `Notification.requestPermission()` is called from a `setTimeout` after 5 s — Chrome 69+, Safari 15.4+, and Firefox silently reject permission requests not triggered by a user gesture. Users who tap "Enable Reminders" see no prompt and no error — reminders simply never fire.

### 3. All AI features are broken for new users
- **File:** `index.html:9959`
- **Commit introduced:** Config was never populated
- **Why this matters:** `APP_CONFIG.aiProxy = ''` means every AI button (triage, day plan, coach, AI command) toasts "Add Claude API key in Settings first". AI is the key differentiator in marketing; it's completely dead out of the box. `/api/claude.js` is already written and ready to deploy.

### 4. Share card draws "TaskOS" brand — old name after rebrand
- **File:** `index.html:10214-10215`
- **Commit introduced:** Rebrand was done in PR #80 (`0c1d32d`) and #81 (`72d9c68`) but this canvas code was missed
- **Why this matters:** Users who share their progress card send an image saying "TaskOS" in the header. Breaks trust and confuses new users who arrived after the Arete rebrand.

---

## 🧹 Cleanup opportunities

### 5. `--faint` CSS variable referenced but never defined
- **File:** `index.html:144, 301, 917, 6267, 6268`
- **Commit introduced:** Inconsistency between `landing.html` (defines `--faint:#9b9488`) and `index.html` (omits it)
- **Why this matters:** Subtle hint text in the goal group, process mode, and first-run views renders with `undefined` as the color value — falls back to inherited parent color instead of the intended dim grey.
```css
/* In :root (landing.html only): */
--faint:#9b9488;
/* Missing from index.html :root and body.light */
```
**Fix:** Add `--faint` to `index.html`'s `:root` (dark: `#5a5a6e`) and `body.light` (light: `#9b9488`).

### 6. `saveContent()` and `saveExperience()` fragile createdAt pattern
- **File:** `index.html:12656, 12819`
- **Commit introduced:** PR #84 (`72e03fe`) — fixed the clobber bug but via a spread-then-override pattern
- **Why this matters:** The fix works but the `undefined` value is still spread into the object first, then overridden after. A future refactor removing the trailing `, createdAt: S...createdAt` silently re-introduces the data-loss bug:
```js
// Fragile — createdAt:undefined is spread, then overridden:
S.contentPipeline[i] = {...prev, ...obj, createdAt: prev.createdAt};
// Robust — don't put createdAt in obj at all when editing:
const obj = { id: editId||uid(), title, ... }; // no createdAt
if (!editId) obj.createdAt = new Date().toISOString();
```

### 7. Hardcoded `task-management-beige-eight.vercel.app` in 8+ locations
- **File:** `index.html:24-32, 10180, 10232`; `landing.html:11,16-17,21,25`
- **Commit introduced:** Initial project setup (Vercel auto-generated subdomain)
- **Why this matters:** Social share cards watermark this temp URL. OG tags point to it. Referral links use it. Every social share and SEO signal is to the wrong domain.

### 8. Old `#toast` element coexists with `#toast-stack`
- **File:** `index.html:436, 467`
- **Commit introduced:** Toast was upgraded to stack implementation (PR ~#68) but old element was left in place
- **Why this matters:** Dead DOM element with `aria-live` can confuse screen readers. Easy to remove.

### 9. `renderFocusDayPlan()` block hardcoded to "Givelink Outreach"
- **File:** `index.html:~4375`
- **Commit introduced:** Givelink integration (pre-separation)
- **Why this matters:** After Givelink was separated into its own app (PR #73), this block remained. Non-Givelink users see a mystery empty block in their focus day plan.

### 10. AI model ID not in `APP_CONFIG`
- **File:** `index.html:5023`, `api/claude.js:42`
- **Commit introduced:** Initial AI implementation
- **Why this matters:** When `claude-haiku-4-5-20251001` is deprecated, all AI features silently break. There is no single place to update it.

---

## 🤔 Worth a second look

### 11. `_sbToken()` expired-refresh leaves sync permanently broken
- **File:** `index.html:10022-10026`
- **Commit:** Auth flow (pre-history)
- **Pattern:** When the Supabase refresh token expires, `_sbToken()` throws `'auth 4xx'`. The `sbSyncNow` caller shows "Sync error — retry" but never re-prompts login. The user's sync stays silently broken indefinitely until they manually sign out and back in. Consider detecting auth 401/403 from sync calls and surfacing a "Session expired — sign in again" prompt.

### 12. `seed()` function contains developer's personal tasks in Greek
- **File:** `index.html:4546-4595`
- **Commit:** Initial setup (pre-history)
- **Pattern:** Only runs in non-hosted mode (`!_hostedMode()`), so **production users are not affected**. However, any developer cloning the repo sees tasks like "Παραλαβή σκηνή", "245€ in investments from seminaria", "Dex CRM — set up & use" as their demo data. Should be replaced with generic fictional examples.

### 13. `_compact` defaulted `true` by a one-time migration flag
- **File:** `index.html:2991`
- **Commit introduced:** PR ~#68 (cockpit layout change)
- **Pattern:** `if(!S._cockpitV1){S._cockpitV1=true;S.dashCompact=true;save();}` — this one-time migration ran for all existing users, permanently setting them to compact mode. New users who sign up fresh also get `dashCompact:false` default from the state definition, then immediately get it set to `true` on first `renderDash()`. The UX intention is correct (compact is better) but the migration code is now permanently dead weight.

### 14. No `unhandledrejection` handler — promise failures are invisible
- **File:** `index.html` (no global handler found)
- **Commit:** Not introduced this week; standing gap
- **Pattern:** The codebase has ~35 async functions. Uncaught promise rejections (expired Supabase tokens mid-sync, AI network failures during background briefing) produce no user-visible feedback. Consider: `window.addEventListener('unhandledrejection', e => { if (!navigator.onLine) return; toast('Something went wrong — try refreshing'); });`
