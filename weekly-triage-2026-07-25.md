# Weekly Triage — 2026-07-25

## 📊 Week at a glance
- **Commits this week**: 2 (`b38d4bb`, `59abf2d`)
- **Files changed**: 3 (`landing.html`, `robots.txt`, `sitemap.xml`)
- **Debt markers added this week**: 0 (clean — no TODO/FIXME/console.log in changed files)
- **High-churn files (all-time)**: `index.html` (46 commits), `sw.js` (24 commits), `manifest.json` (5 commits)

Both commits this week were Panos, both targeted the landing page growth surface. No test commits followed either (no test infrastructure in the repo). Quiet week with a narrow scope — no regressions expected.

---

## 🚨 Needs immediate attention

### 1. Push notifications display broken icons in production — TODAY
- **File**: `sw.js:46-47`
- **Commit introduced**: `0c1d32d` (rebrand commit that moved images to root but didn't update sw.js)
- **The issue**: `icon:'./icons/icon-192.png'` and `badge:'./icons/icon-192.png'` reference a path that does not exist. The actual file is `./icon-192.png`. Every reminder notification sent to users is showing a missing icon or the browser default.
- **Why this matters**: Reminders are a core retention feature. Broken icons erode perceived quality on the first real interaction users have outside the app.

### 2. AI proxy has zero rate limiting — cost runaway risk
- **File**: `api/claude.js:12-14`
- **Commit introduced**: `d635c06` (the original proxy file)
- **The issue**: The proxy comment literally says "for production add per-user rate limiting (e.g. Upstash) so a single account can't run up your Anthropic bill." It has never been implemented. If `aiProxy` is set in APP_CONFIG and the proxy is deployed, one abusive call pattern can drain the API budget overnight.
- **Why this matters**: Direct financial risk. Anthropic usage charges have no built-in hard cap.

### 3. PostHog analytics key is empty — landing funnel is blind
- **File**: `landing.html:702` (`var POSTHOG_KEY = ''`), `index.html:9960` (`posthogKey: ''`)
- **Commit introduced**: `b38d4bb` (this week — added the analytics scaffolding but left the key blank)
- **The issue**: The entire analytics infrastructure added in the most recent commit fires zero events because both keys are empty strings. The code is correct; the key just hasn't been pasted in.
- **Why this matters**: Commit #83 was explicitly about making the landing measurable. The work is done but the switch isn't flipped — zero data is being collected.

---

## 🧹 Cleanup opportunities

### 4. `seed()` contains personal Greek-language tasks and medical appointments
- **File**: `index.html:4532-4926`
- **Commit introduced**: Present since the earliest commits; never cleaned up
- **The issue**: The `seed()` function contains hundreds of personal tasks (`'Ακτινογραφία στα γόνατα'`, `'Πνευμολογικές εξετάσεις'`, `'Verify Etoro account'`, personal health/finance goals). It's guarded by `if(!_hostedMode())`, so it only runs locally — but anyone who forks or self-hosts the repo for development sees the developer's personal health data and finances in their inbox.
- **Why this matters**: Privacy concern for the developer; confusing UX for any open-source contributor trying to evaluate the app.

### 5. `#ec4899` slipped into the Bucket List category colors
- **File**: `index.html:12193`
- **Commit introduced**: Likely introduced in one of the PLG/features commits; not in last 7 days
- **The issue**: `BL_CATS.creative.color` is `'#ec4899'` (Tailwind pink-500), which is not in the brand palette (`#C2185B`, `#E353B6`). A stray off-brand color in an otherwise well-governed palette.
- **Why this matters**: Low priority, but brand consistency is called out as a goal in the commit history. Easy one-liner fix.

### 6. Weekly Review renders task and goal titles via unescaped innerHTML
- **File**: `index.html:3594`, `3601`, `3603`
- **Commit introduced**: Present in earlier builds, not touched recently
- **The issue**: `t.title` and `g.title` are interpolated directly into innerHTML template strings without calling `esc()`. The `esc()` function exists at line 11776 and is used elsewhere. This is currently self-XSS (user's own data in their own browser) but becomes cross-user if any sharing or template feature allows foreign task titles.
- **Why this matters**: Low severity now; becomes critical the moment a shared-data feature ships.

---

## 🤔 Worth a second look

### 7. The comparison table uses `#3fa66a` (green) and `#cfc9bf` (neutral) — are these intentional brand additions?
- **File**: `landing.html:285-286`
- **Commit introduced**: `b38d4bb` (this week)
- **The issue**: The comparison table added this week uses `#3fa66a` for checkmarks (✓) and `#cfc9bf` for crosses (✗). These aren't in the documented brand palette. They look fine and are contextually correct (green = good, gray = bad), but they're undocumented additions to the color system.
- **Why this matters**: If these are intentional, add them to the design system documentation. If they're accidental, swap to the brand palette.

### 8. `sitemap.xml` and JSON-LD structured data hardcode `task-management-beige-eight.vercel.app`
- **File**: `sitemap.xml:4`, `landing.html:25`
- **Commit introduced**: `b38d4bb` (this week — JSON-LD added; sitemap updated)
- **The issue**: The production URL is the raw Vercel deployment URL, not a canonical domain. If the project gets a proper domain (`arete.so` etc.), these will silently point to the wrong origin, splitting SEO authority.
- **Why this matters**: Commit #83 was about "SEO foundation." A hardcoded Vercel URL undermines exactly that foundation at domain-move time.

### 9. Readwise and Notion integrations have settings fields and CSP entries but no visible functionality
- **File**: `index.html:2042-2044` (settings), `vercel.json` CSP
- **Commit introduced**: Integration fields present for several commits; CSP recently tightened
- **The issue**: There are form fields for Readwise Token and Notion Integration Token, but no in-app UI or flows that visibly consume these tokens. Users who configure them will see no result, which is confusing.
- **Why this matters**: Either implement or remove. Half-implemented integrations actively harm trust.

---

_Triage complete. 9 items total. Items 1–3 are production-impacting; items 4–6 are low-effort cleanup; items 7–9 are judgment calls._
