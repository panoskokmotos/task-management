# Weekly Triage — 2026-07-29

## 📊 Week at a glance
- **Commits**: 1 | **Files changed**: 3 | **Debt markers added**: 1
- **High-churn files**: `landing.html` (1 commit this week; historically touched every 3-4 commits)
- **No test commits** followed the feature commit

---

## 🚨 Needs immediate attention

### 1. PostHog key is empty — analytics still dark after "analytics" commit
- **File**: `landing.html:700`
- **Commit**: `b38d4bb` — "Landing growth: analytics, SEO foundation, and comparison table"
- **Why this matters**: The commit's entire point was wiring up analytics and SEO. The analytics key (`POSTHOG_KEY = ''`) is still a placeholder. All 4 tracking events added in this commit (`landing_view`, `landing_cta_click`, `landing_scroll`, `landing_demo_seen`) are silent no-ops. The same empty key exists in `index.html:9960`. The team has no funnel data from either the landing or the app.

### 2. Landing canonical URL still points to Vercel staging domain
- **File**: `landing.html:11,16,18,21`, `sitemap.xml` (both changed this week)
- **Commit**: `b38d4bb`
- **Why this matters**: `sitemap.xml` was added this week with `https://task-management-beige-eight.vercel.app/` as the URL. Google will index the staging domain, not the production one. If a custom domain is ever used, the SEO work from this commit is wasted.

---

## 🧹 Cleanup opportunities

### 3. `POSTHOG_KEY = ''` hardcoded placeholder
- **File**: `landing.html:700`
- **Commit**: `b38d4bb`
- **Why this matters**: Pattern of empty string placeholders (same in `index.html` for both `posthogKey` and `aiProxy`) means features silently don't work rather than erroring loudly during development. Consider a startup check that `console.warn`s if keys are missing.

### 4. Comparison table added to landing but not linked from nav
- **File**: `landing.html` — section id `#compare` added this week
- **Commit**: `b38d4bb`
- **Why this matters**: The nav links list `#features`, `#how`, `#templates`, `#trust`, `#faq` but not `#compare`. Users can't navigate directly to the comparison table. Not a bug, but an easy omission to fix.

### 5. `sitemap.xml` changefreq set to `monthly` for the app URL
- **File**: `sitemap.xml`
- **Commit**: `b38d4bb`
- **Why this matters**: The app at `/index.html` ships new features every 1-2 weeks. `monthly` crawl frequency means Google may be weeks behind on re-indexing changes. `weekly` is more appropriate.

---

## 🤔 Worth a second look

### 6. No test or smoke-check commit followed the landing page update
- **Files changed**: `landing.html`, `robots.txt`, `sitemap.xml`
- **Commit**: `b38d4bb`
- **Why this matters**: The landing page has 4 new JS tracking events, a new comparison table section, and modified robots/sitemap. There's no corresponding verification commit or CI check. On a PWA that serves landing.html from the service worker cache, a broken change would be cached and sticky.

### 7. `robots.txt` disallows `/api/` — correct but worth confirming intent
- **File**: `robots.txt` (added this week)
- **Commit**: `b38d4bb`
- **Why this matters**: `Disallow: /api/` is correct (don't index the Claude proxy endpoint). However `Allow: /` is also present. Verify that `/givelink.html` (still served but removed from the product) is either disallowed or 404s properly — otherwise Google may index a zombie page from a discontinued product.

---

_Triage kept to the 7 highest-leverage items from this week's single commit. Run `git log --since="7 days ago" --name-only` to verify scope._
