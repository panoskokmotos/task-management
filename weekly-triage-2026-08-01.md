# Weekly Triage — 2026-08-01

## 📊 Week at a glance
- Commits: **0** | Files changed: **0** | Debt markers added: **0**
- High-churn files: _(no activity this week)_
- Last commit: `b38d4bb` on 2026-07-22 — "Landing growth: analytics, SEO foundation, and comparison table (#83)"

> **No code changes landed in the past 7 days.**
> The items below are pre-existing issues found during the broader codebase scan (see `IMPROVEMENT_PLAN.md`).

---

## 🚨 Needs immediate attention

### 1. Push notification icon path is broken (shipped in b38d4bb ancestry)
- **File:** `sw.js:46–47`
- **Issue:** `icon: './icons/icon-192.png'` — the `icons/` directory doesn't exist. The actual file is `./icon-192.png`. Every push notification shows a broken/missing icon on all platforms.
- **Why it matters:** PWA users receive reminders with a broken badge — erodes trust, may cause the OS to deprioritise notifications.

---

### 2. Share card canvas still says "Task OS" — not "Arete"
- **File:** `index.html:10214–10215` and `index.html:10232`
- **Issue:** The shareable progress card (generated via Canvas API) draws `'Task' + 'OS'` as the logo text and watermarks with `task-management-beige-eight.vercel.app`. The rebrand commit (#80) updated the rest of the UI but missed the canvas render.
- **Why it matters:** Every user who shares their progress promotes the old brand and routes signups to the Vercel URL instead of the canonical one.

---

### 3. `APP_CONFIG.aiProxy` is empty — AI is gated behind a personal API key
- **File:** `index.html:9959`
- **Issue:** `aiProxy: ''` means every user must obtain their own Anthropic API key before using inbox triage, plan-my-day, or AI commands. The proxy (`api/claude.js`) already exists and is deployed — it just isn't referenced.
- **Why it matters:** The landing page's key differentiator ("AI triage & plan-my-day") requires friction that most new users will abandon. Commit #83 just improved the landing page to promote these features harder — if the flow breaks right after, the conversion lift is wasted.

---

### 4. PostHog key is empty — no analytics on any user action
- **File:** `index.html:9960`
- **Issue:** `posthogKey: ''` silences all 30+ `track()` calls. There is no data on activation, retention, or conversion.
- **Why it matters:** Commit #83 ("Landing growth: analytics, SEO foundation") was explicitly about measurement. The SEO and comparison table shipped, but the analytics layer that would validate whether they work did not.

---

### 5. Claude API key stored in and synced via the main app state blob
- **File:** `index.html:9917` (save path), `index.html:10405–10410` (`sbPush`)
- **Issue:** `S.claudeKey` is serialised into `localStorage` via `save()` and pushed to Supabase via `sbPush` as part of the full state blob. Any XSS (see `IMPROVEMENT_PLAN.md` P0/item 4) reads it from localStorage. It is also uploaded to the cloud, where a Supabase RLS misconfiguration could expose it.
- **Why it matters:** A user's personal Anthropic API key is a billing credential. Leaking it lets anyone run unlimited API calls charged to the user.

---

## 🧹 Cleanup opportunities

### 6. Unescaped `t.title` in innerHTML — self-XSS, latent cross-user risk
- **File:** `index.html:3223` (`inboxHTML`), `3274`, `3306`, `3519`, `3570`, `3594–3603`
- **Issue:** `${t.title}` and `${g.title}` are interpolated directly into `innerHTML`. `esc()` exists at line 11776 but is not called in these paths.
- **Introduced:** Part of the original render pattern; not introduced this week, but the share/invite flows added in recent commits (#78, #76) increase the XSS blast radius if task data is ever shared between users.
- **Why it matters:** Stored XSS payload in a task title would execute for every device the user opens the app on.

---

### 7. Hardcoded `task-management-beige-eight.vercel.app` in 4 locations
- **File:** `index.html:24–32`, `index.html:10180`, `index.html:10232`, `landing.html:11–21`
- **Issue:** The raw Vercel project URL is spread across OG meta tags, the `_APP_URL` constant, the share card canvas, and the landing canonical tag. No single place to update when a custom domain is added.
- **Added in:** Commit #82/83 for the landing; earlier for the app. Not introduced this week, but commit #83 added more of them (sitemap, robots.txt now reference it too).
- **Why it matters:** Referral links sent this week route to the wrong URL.

---

### 8. Token refresh failure is silent — users get stuck in a permanent error state
- **File:** `index.html:10022–10026`, `index.html:10439`
- **Issue:** If a Supabase refresh token expires, `sbSyncNow` catches the error and shows `⚠ not connected` in the sync pill. The user is never prompted to re-auth and changes accumulate locally without syncing.
- **Why it matters:** Long-term users (30+ days between logins on a device) silently lose sync without knowing it.

---

## 🤔 Worth a second look

### 9. `seed()` and `seedGoals()` still populate Givelink business tasks for self-hosters
- **File:** `index.html:4532–5000`, `index.html:4926–5000`
- **Issue:** Commit #73 ("Remove Givelink from Task OS") separated the UIs, but the seed functions still add tasks like "Nonprofits Board Follow Ups" and goals referencing Givelink. These run for any user where `_hostedMode()` is false (i.e., self-hosters or users who bypass the hosted auth gate).
- **Why it matters:** Self-hosting users get a confusing first-run experience filled with someone else's business tasks.

---

### 10. Service worker caches `manifest-givelink.json` and `givelink.html` for the Arete PWA
- **File:** `sw.js:2–18`
- **Issue:** The SW's `HTML` and `STATIC` arrays explicitly precache `givelink.html` and `manifest-givelink.json` for all Arete users. This wastes cache quota and means Arete users are silently downloading Givelink app assets.
- **Why it matters:** Small (probably <100KB), but philosophically inconsistent with the product separation. Could cause confusion if a user navigates to `/givelink.html` accidentally.

---

_Keep it under 30: 10 items total (3 actionable P0s + 7 cleanup/watch). See `IMPROVEMENT_PLAN.md` for the full prioritised list with effort estimates and suggested fixes._
