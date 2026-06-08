# Weekly Triage — 2026-06-08

> **Note:** No commits landed in the strict 7-day window (last commit: 2026-05-29). This report covers the 12-commit burst from 2026-05-28–29, which is the active development batch.

---

## 📊 Week at a glance

- Commits: **12** (May 28–29) | Files changed: **4** | Debt markers added: **0 explicit** (no TODOs/FIXMEs) — but see findings below
- High-churn files: `index.html` (12 touches), `sw.js` (4 touches), `supabase-setup.sql` (1 touch)
- Suspicious commit signals: `d3a28fb fix EOD ritual` (was broken in prod), 4 consecutive "Mobile polish" commits in 3 hours suggesting iterative fire-fighting

---

## 🚨 Needs immediate attention

### 1. XSS: task/goal titles injected unescaped into innerHTML (15+ sites)
`index.html:3003, 2627, 2691, 2741, 2885, 2892, 3577, 7117` — commit `3a32d45`

`esc()` exists at line 9768 and is correctly applied to `t.ifThen` (line 3011), but `t.title` and `g.title` are interpolated raw into template literals rendered via `innerHTML` everywhere. An import of a crafted JSON backup executes arbitrary JS in the user's session — including exfiltrating `S.claudeKey`, Readwise token, Supabase credentials. Fix: wrap every `${t.title}` / `${g.title}` in `esc()`.

---

### 2. Claude API key stored inside `S` → synced to Supabase in plaintext
`index.html:4135, 8500, 8604` — commit `67de902`

`S.claudeKey` lives inside the main state object. `sbPush()` serializes the entire `S` blob to Supabase's `app_state` table. This means the API key travels over the wire and sits in the cloud database. It also lands in every JSON export. The other secrets (Readwise, Notion) use separate `localStorage` keys that are not part of `S` — `claudeKey` should follow that same pattern.

---

### 3. Missing `icons/` directory breaks push notifications
`sw.js:32–34` — commit `dd16e0c`

The service worker references `./icons/icon-192.png` twice (notification icon + badge). The directory does not exist in the repo. Push notifications will fire but show no icon; on some platforms (iOS, strict Android) this causes the notification to be silently dropped or render as a blank tile.

---

### 4. Supabase sync silently discards edits on concurrent devices
`index.html:8607–8625` — commit `67de902`

`sbSyncNow()` resolves conflicts purely by comparing `_updatedAt` timestamps and does a full-object overwrite (`S = {...S, ...remote.data}`). If you edit Device A (tasks) and Device B (goals) within the same 2.5 s debounce window, Device B's push will overwrite Device A's task edits with no merge and no warning. The only signal is the status line briefly flashing "Synced ⬇". No field-level merge; no conflict UI.

---

### 5. EOD fix (d3a28fb) patched data loss but left a timing fragility
`index.html:10040–10052` — commit `d3a28fb`

The fix added `if(_eodEnergy){...}` guards and a commit guard. However `_eodEnergy`, `_eodWin`, and `_eodMit` are module-scoped variables not declared with `let/const` — they're implicit globals (grep confirms no `let _eodEnergy`). If the page is reloaded mid-ritual, they reset to `undefined` and the guard silently skips the energy write. This is the same class of bug that caused the original data loss.

---

## 🧹 Cleanup opportunities

### 6. `givelinkHistory` (and other log arrays) grow forever
`index.html:8638–8652` — commit `67de902`

`_autoSnapshot()` appends a daily record with no cap or pruning. Same for `S.eodLogs`, `S.contextLog`, `S.energyLog`, `S.habitLogs`, `S.deepWorkSessions`. After 12 months of daily use the serialized `S` will approach or exceed the 5 MB localStorage quota. `save()` does handle `QuotaExceededError` with a toast, but by then data is already stuck. Add a `slice(-365)` trim on the history arrays in `_autoSnapshot` and similar append-only logs.

---

### 7. Multiple silent catch blocks swallow errors
`index.html:2430, 2498, 2874, 4513, 8619, 8652, 9305, 10049`

Eight locations use `catch(e){}` or `catch(_){}` with no logging and no user feedback. Notably:
- `index.html:4513` — `try{awardXP(5,'workflow');}catch(e){}` silently drops XP award failures
- `index.html:8619` — `try{refresh();}catch(e){}` after a sync pull swallows render errors that would otherwise surface broken state
- `index.html:2430` — nav-collapse localStorage write silently fails when storage is full

At minimum the `refresh()` swallow at 8619 should re-throw or show a toast, as a failed render after sync means the user sees stale data.

---

### 8. Notion API is attempted before showing the known-unavailable workaround
`index.html:8920–8946` — pre-existing, surfaced in recent commits via d3a28fb

The code makes a live fetch to `api.notion.com` from the browser (line 8924), which always fails with CORS, then catches the error and shows a "use Markdown export instead" workaround (line 8944). The network round-trip is wasted. The CORS failure is deterministic — show the workaround immediately without the fetch.

---

### 9. Clock-skew makes sync silently favor stale data
`index.html:8613–8614` — commit `67de902`

`sbSyncNow()` picks the winner by comparing `remote.ms > localMs` where `localMs = S._updatedAt`, set via `Date.now()`. If one device's clock is ahead (VM snapshots, travel timezone changes, DST), it will always "win" and overwrite the other device's changes even when those changes are more recent in wall time. Consider using the Supabase server-side `updated_at` column exclusively rather than trusting client clocks.

---

## 🤔 Worth a second look

### 10. Direct browser→Anthropic API call is intentional but key scope is too broad
`index.html:4133–4137` — commit `1d3ea98`

Uses `anthropic-dangerous-direct-browser-access: true` — this is a supported SDK pattern for PWAs. However, since `S.claudeKey` is the same key used for all AI features, a compromised task title (see item 1) or a malicious shared backup can exfiltrate it. Consider at least stripping `claudeKey` from `exportData()` so it's never in backup files.

---

### 11. "Upcoming" calendar card shipped without external sync disclosure
`index.html:~2498 area` — commit `d3a28fb`

The commit message explicitly notes: *"Note: in-app only — external calendar sync needs a backend."* The rendered card shows no such caveat. Users expecting Google Calendar integration will add due dates, see the card, and assume it's synced. Add a "(local only)" label or tooltip before users discover the gap through missing reminders.

---

### 12. `_sbScheduleSync` fires on every `save()` with only a 2.5 s debounce
`index.html:8628–8636, 2105` — commit `67de902`

`save()` is called on every user action. Each call resets the 2.5 s debounce, meaning a user actively editing will push to Supabase every 2.5 s continuously. No per-minute cap. Supabase free tier has a row-level write limit; under heavy editing this could exhaust it or generate unnecessary egress. Consider a minimum-interval guard (e.g., no more than one push every 30 s).

---

*Generated by automated triage on 2026-06-08. Covers commits `cc36c6f`–`67de902` (May 28–29, 2026).*
