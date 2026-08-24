# Weekly Triage — 2026-08-24

## 📊 Week at a glance
- Commits: 1 | Files changed: 1 | Debt markers added: 0
- High-churn files: N/A (only README touched this week)
- The week had no new feature work — the single commit was a documentation update.

---

## 🚨 Needs immediate attention

No new regressions were introduced this week. However, the audit surfaced several **pre-existing production issues** that need action:

### 1. `index.html:11254` — Hardcoded "Panos" in system push notifications
**Introduced**: predates this week (commit 5cd9437 did not touch this)  
**Why this matters**: Every new user's scheduled 8 AM push notification says "Good morning Panos!" — visible on lock screens across all platforms. Breaks product credibility on first interaction.  
**Commit that last touched this area**: `f883adf` (PLG Tier 1) or earlier.

### 2. `sw.js:47` — Push notification icon path is wrong (`./icons/icon-192.png` → file doesn't exist)
**Commit that introduced it**: Cannot trace exactly; directory was never created.  
**Why this matters**: Every push notification shows a broken icon. No `icons/` directory exists — the file is at `./icon-192.png`.

### 3. `index.html:11258` — Default "Givelink CRM" reminder seeded to all new users
**Why this matters**: New users get a recurring push notification (Mon/Wed/Fri 10am) to "Check your Givelink CRM" — a product they know nothing about.

---

## 🧹 Cleanup opportunities

### 4. `api/claude.js:12–13` — Explicit TODO: add rate limiting
> "For production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill."

The proxy is written and deployed but `APP_CONFIG.aiProxy` is `''` — it's not wired. When it gets wired (a near-term priority), this missing rate limiter becomes a billing liability immediately.

### 5. `index.html:9959` — `aiProxy: ''` is effectively a missing feature flag
The Vercel Claude proxy at `/api/claude.js` is production-ready but the URL is not set. All AI features gate on this value. This is not a code bug but a deployment gap that silently breaks the app's advertised core feature.

### 6. `sw.js:1` — Cache name `'arete-20260723'` is stale
Date-stamped cache names require manual bumps. This one is from July 2026. If static assets were deployed since then without updating this, some users are serving stale cached files.

---

## 🤔 Worth a second look

### 7. `index.html:2984` — `givelink-dash` view still reachable
Commit #73 "Remove Givelink from Task OS" left the full `renderGivelinkDash` function (line 8618), a sidebar nav entry (line 9569), and a `#v-givelink-dash` HTML panel (line 14311). A user navigating to `#givelink-dash` or clicking the sidebar link will see a functional Givelink sprint board. Likely intentional for Panos's own use, but confusing for product users.

### 8. `index.html:4532–4925` — `seed()` function ships 100+ personal tasks in the production bundle
The personal task seed (complete with Greek medical appointments, Givelink CRM tasks, and personal financial entries) is in the bundle received by every user. The `_hostedMode()` guard prevents it from running, but the data is client-visible. Review whether this is an acceptable privacy posture.

### 9. `index.html:7849, 9806, 12186` — 3 of ~15 AI prompts still fall back to Panos bio
Most prompts have been updated to use `getAboutMe()||'A focused individual...'`, but 3 still fall back to `'Panos — Greek founder in his 20s building Givelink...'`. The others are correct.

---

_Triage complete. 1 commit this week, no new debt introduced. The items above are carry-over from prior weeks and flagged in full in `IMPROVEMENT_PLAN.md`._
