# Weekly Triage — 2026-10-05

## 📊 Week at a glance
- **Commits**: 1 | **Files changed**: 1 | **Debt markers added**: 0
- **High-churn files**: None this week (only CI/workflow change)
- **Context**: The last code commit was Sep 12 (#84). This week was quiet on the main codebase.

---

## 🚨 Needs immediate attention

### 1. Broken push-notification icon path (introduced: `5cd9437` era, first observed now)
- **File**: `sw.js:46-47`, `index.html:11289`
- **Commit**: Pre-exists in current HEAD (`72e03fe` / `160f0d8`)
- **Issue**: Both files reference `./icons/icon-192.png` — a path that does not exist. The actual icon files live at `./icon-192.png` (root). Every push notification fired by the app shows a broken icon badge on iOS/Android.
- **Why this matters**: Silently broken for all users who have enabled reminders. Push notifications are a key retention mechanism — broken imagery degrades trust.

### 2. `profileName` hardcoded to `'Panos'` as fallback (introduced: original seed, never removed)
- **File**: `index.html:2519`
- **Commit**: Present in current HEAD
- **Issue**: `let profileName = localStorage.getItem('taskos_name') || 'Panos'`. Any new user who doesn't set a name sees "Good morning, Panos 👋" on their dashboard.
- **Why this matters**: This is the first screen new users see. It's a straightforward personalization bug that will confuse every non-Panos user.

### 3. AI proxy URL empty in production build (introduced: `index.html:9959`)
- **File**: `index.html:9959`
- **Commit**: Present in current HEAD
- **Issue**: `aiProxy: ''` — all AI features ("Plan my day", "Triage inbox", "AI daily picks") silently fail for users who haven't added their own Anthropic key. With a guest-first acquisition strategy, this kills the "AI that plans your day" value prop at first touch.
- **Why this matters**: If the hosted deployment is meant for public users, every AI CTA in the app is a dead end.

---

## 🧹 Cleanup opportunities

### 4. Supabase keep-alive workflow uses inline secrets (this week's commit)
- **File**: `.github/workflows/supabase-keepalive.yml:23-24`
- **Commit**: `160f0d8` (Oct 1)
- **Issue**: The workflow comment correctly notes that the Supabase URL and anon key are "safe to expose" (publishable). However, they're still hardcoded in a CI workflow rather than using GitHub Actions secrets. This is fine for a public anon key but establishes a pattern that could lead to embedding real secrets later.
- **Why this matters**: Low risk now, but worth migrating to `secrets.SUPABASE_URL` / `secrets.SUPABASE_ANON_KEY` as a good hygiene habit before anyone adds a service-role key.

### 5. ~60+ silent `catch(e){}` blocks throughout `index.html`
- **File**: `index.html` — pervasive; examples at lines 956, 2587, 2983, 3031, 10392
- **Commit**: Long-standing, not introduced this week
- **Issue**: Empty catch blocks swallow every error in critical paths (save, sync, first-run, AI calls). There is no error telemetry (PostHog key is empty), so production failures are completely invisible.
- **Why this matters**: The last bug-fix commit (#84) fixed 4 data-integrity bugs. With no error reporting, it's unknown how long those bugs existed or how many users were affected.

### 6. Seeded starter tasks contain personal Givelink/Panos data
- **File**: `index.html:4616,4814,4932,4945,4970`
- **Commit**: Long-standing
- **Issue**: New user accounts are seeded with tasks and goals that mention "Givelink", "SF move", and financial goals personal to the app author. This leaks personal context into new-user dashboards.
- **Why this matters**: Confusing UX for any new user; also exposes business strategy in starter data.

---

## 🤔 Worth a second look

### 7. `sbSyncNow` merge strategy: timestamp-only last-write-wins
- **File**: `index.html:10417-10423`
- **Pattern**: `if(remote.ms > localMs) { S = {...S, ...remote.data} }` — merges the entire state blob from the winner, discarding the loser's unsaved changes.
- **Why suspicious**: With multiple devices and fast edits, this is a race condition waiting to produce user-visible data loss. It may be intentional ("simple wins") but the next sync could silently erase just-completed tasks.

### 8. `_frOrganize` (first-run) calls AI but has no non-AI fallback
- **File**: `index.html:10527-10563`
- **Pattern**: First-run "Organize my day ✨" calls `callClaude()`. If `aiProxy` is empty and `S.claudeKey` is unset, the user hits "Add Claude API key in Settings" — during onboarding.
- **Why suspicious**: Onboarding is the highest-leverage moment. An AI failure here means the magic moment never lands.

### 9. `givelink.html` diverging from `index.html` — brand/style inconsistencies possible
- **File**: `givelink.html` (1,829 lines, separate file)
- **Pattern**: The rebranding commit `72d9c68` specifically called out "purge stray old-brand colors" — exactly the kind of drift that happens with duplicate files.
- **Why suspicious**: Any styling fix to `index.html` needs to be manually mirrored in `givelink.html`.

---

*Keep it under 30 items — 9 surfaced. Quality over quantity.*
