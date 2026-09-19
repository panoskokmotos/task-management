# Weekly Triage — 2026-09-19

## 📊 Week at a glance

- **Commits this week**: 0 — last commit was 2026-09-12 (`#85` Supabase keep-alive)
- **Files changed**: 0
- **Debt markers added this week**: 0 (no new commits to scan)
- **High-churn files (last 30d)**: `index.html` (every PR), `landing.html` (3 of last 6 PRs), `givelink.html` (2 of last 6 PRs)

_No commits landed in the 7-day window ending 2026-09-19. Triage scope expanded to the two most recent PRs (#84, #85) and static debt found in the current `main` HEAD._

---

## 🚨 Needs immediate attention

### 1 · `sw.js:46–47` + `index.html:11289` — broken notification icon path
- **Commit**: `72e03fe` (Givelink bug fixes and This Week view, 2026-09-12)
- **Code**: `icon: './icons/icon-192.png'` — directory `icons/` does not exist; the file is `./icon-192.png`
- **Why this matters**: Every scheduled reminder and push notification fires with a broken 404 icon. Users on Android PWA see a generic grey square on every notification.

### 2 · `givelink.html:453` — `load()` crashes on corrupt localStorage
- **Commit**: part of codebase prior to the triage window (no recent change, pre-existing)
- **Code**: `const p = JSON.parse(d); S = {...S,...p};` — no try/catch
- **Why this matters**: Any localStorage corruption (browser bug, manual edit, storage migration) leaves the Givelink sprint board completely blank with no error message and no recovery.

### 3 · `givelink.html:1338` — `callClaudeGL()` calls `res.json()` without checking `res.ok`
- **Commit**: predates triage window; `72e03fe` touched `givelink.html` but did not fix this
- **Code**: `const data = await res.json(); return data.content?.[0]?.text || null;`
- **Why this matters**: A 429 rate-limit or 401 auth error returns an error JSON body; `data.content` is undefined, so the AI standup generator and outreach email generator silently return `null` with no user feedback.

### 4 · `index.html:6516` — `genAIChallenge` regex broken — all AI challenge cards are blank
- **Commit**: predates triage window; high probability of regression from the `#79 PLG Tier 1` or `#80 Rebrand` commit
- **Code**: `new RegExp(key+':\s*(.+)')` — `\s` inside a string literal is `s`, not whitespace
- **Why this matters**: Every user clicking "Generate challenge" sees a blank card. The feature appears to work (Claude is called, a spinner shows) but always produces empty output.

---

## 🧹 Cleanup opportunities

### 5 · `index.html:3594,3601,3603` — unescaped user data in innerHTML (Weekly Review wizard)
- **Commit**: predates triage window; `renderWizPanel` was last modified ~`#79` (template import)
- **Code**: `${t.title}` and `${g.title}` used directly in innerHTML — `esc()` helper exists and is used elsewhere but was missed here
- **Why this matters**: Self-XSS vector: a task titled `<script>...` executes when the Weekly Review is opened. Low-severity because it requires the user to craft their own malicious task, but becomes critical if/when import from external sources is added.

### 6 · `index.html:5445,7849,9807` — hardcoded "Panos" persona in three AI prompt strings
- **Commit**: `0c1d32d` (Rebrand to Arete, 2026 — left-over from personal use before productisation)
- **Code**: `"Panos — Greek founder in his 20s building Givelink..."` — bypasses the `getAboutMe()` function that reads from Settings
- **Why this matters**: Every non-founder user receives AI suggestions tailored to someone else's biography. The "About me" Settings field has no effect in these three paths.

### 7 · `index.html:9569` + seeds — "Givelink" hardwired into nav and AGI/SF seed data
- **Commit**: `0c1d32d` (Rebrand to Arete) introduced `givelink-dash` nav item; seeds not updated
- **Code**: `{id:'givelink-dash', e:'🟣', l:'Givelink'}` in `_MORE_NAV_GROUPS`; `AGI_DECISIONS_SEED` and `SF_MILESTONES_SEED` contain Givelink-specific decisions
- **Why this matters**: Every new user's nav contains an irrelevant button; their AGI tracker arrives pre-seeded with another person's business decisions.

### 8 · `index.html:10214–10215` — share card still says "TaskOS"
- **Commit**: `1fb177a` (Rebrand app icon + logo to violet) — the canvas rendering was not updated alongside the CSS rebrand
- **Code**: Two separate `fillText('Task',...)` + `fillText('OS',...)` calls; line 10232 also hardcodes `task-management-beige-eight.vercel.app`
- **Why this matters**: Every shared card distributed on social carries the old product name and a Vercel staging URL.

### 9 · `index.html:847` — offline pill double-hidden (class + inline style)
- **Commit**: `e0b0a00` (Personal OS: mobile-native pass) — likely copy-paste from a hidden-by-default template
- **Code**: `class="hidden" style="display:none;"` — toggling `.hidden` in JS leaves the inline style active
- **Why this matters**: The offline indicator never appears even when the network drops; a complete feature that silently does nothing.

### 10 · `index.html:143,301,917` — `--faint` CSS variable referenced but never defined
- **Commit**: predates triage window; present since at least `#68`
- **Code**: `.gg-ct`, `.proc-hint`, `.fr-hint` all use `var(--faint)` which is absent from `:root`
- **Why this matters**: Hint text in the capture flow and process cards renders at full body-text brightness rather than the intended muted grey, degrading visual hierarchy.

---

## 🤔 Worth a second look

### 11 · `givelink.html:914` — new sprint resets `S.sprint` but not `S.snapshots`
- **Commit**: predates triage window; `72e03fe` (Givelink bug fixes) touched sprint logic but did not address this
- **Pattern**: `confirmNewSprint()` archives tasks and resets the sprint object, but the burndown snapshot array carries over — looks intentional (retain history) but renders incorrectly on the burndown chart from day 1 of a new sprint.
- **Likely intent**: Snapshots were meant to reset. The burndown view has no "historical sprints" selector to justify keeping them.

### 12 · `givelink.html:1561` — standup "yesterday" window is 48h, not 24h
- **Commit**: `72e03fe` (Givelink bug fixes, 2026-09-12) — touched standup but did not fix the threshold
- **Code**: `yesterday.setDate(now.getDate()-2)` — the comment says "yesterday" but the cutoff is 2 days back
- **Likely intent**: Off-by-one error, not intentional. Tasks from 2 days ago appear in "Completed Yesterday".

### 13 · `api/claude.js:12` — rate limiting explicitly deferred in a comment
- **Commit**: part of original proxy implementation (before PR #68)
- **Code**: `// Note: this is a minimal proxy. For production add per-user rate limiting`
- **Likely intent**: Placeholder for production hardening. The proxy is live; the comment has been in production for multiple sprints.

---

_Triage complete. 4 items need immediate attention. 6 items are cleanup with clear fixes. 3 items need a second look for intent before acting._
