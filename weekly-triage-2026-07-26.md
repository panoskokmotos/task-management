# Weekly Triage — 2026-07-26

## 📊 Week at a glance
- Commits: 1 | Files changed: 3 | Debt markers added: 0
- High-churn files: `landing.html` (only file with significant changes this week)
- No TODO/FIXME/HACK/console.log added in changed files

---

## 🚨 Needs immediate attention

### 1. PostHog key left blank — analytics from PR #83 are collecting nothing
**File:** `landing.html:701`
**Commit:** `b38d4bb`
**Code:**
```js
var POSTHOG_KEY  = '';   // e.g. 'phc_xxxxxxxx'
```
**Why this matters:** The entire analytics layer landed in this PR — `landing_view`, `landing_cta_click` (with which CTA: hero/nav/final/templates/how/footer), `landing_scroll` depth, `landing_demo_seen`. All are wired up and ready. But the key is blank so every call is a silent no-op. The PR description says "Gated on a key you paste; a blank key is a silent no-op, so nothing fires until you opt in." — this is intentional staging, but needs to be done before the growth data matters. Until this is pasted, the comparison table and CTA-location tracking from #83 produce zero signal.
**Action:** Paste the PostHog project key (same key that goes in `APP_CONFIG.posthogKey` in `index.html`) into `POSTHOG_KEY` in `landing.html:701`.

---

### 2. `APP_CONFIG.posthogKey` is also blank in the main app
**File:** `index.html:9960`
**Commit:** Not this week — pre-existing
**Code:**
```js
posthogKey  : '',   // e.g. 'phc_xxxxxxxx'
```
**Why this matters:** With both the landing and app PostHog keys blank, there is zero analytics data being collected anywhere. The funnel connection the PR comment promises ("same key + same origin means the landing → signup funnel connects on its own") can only work if both keys are set. This is a pre-existing gap that the landing analytics work makes more urgent.
**Action:** Set this at the same time as the landing key above — one paste, two files.

---

## 🧹 Cleanup opportunities

### 3. `sitemap.xml` only lists the root URL, not `/landing.html`
**File:** `sitemap.xml:4`
**Commit:** `b38d4bb`
**Code:**
```xml
<loc>https://task-management-beige-eight.vercel.app/</loc>
```
**Why this matters:** The landing page has JSON-LD structured data, a comparison table, and SEO copy that was specifically added for discovery — but search crawlers won't find it efficiently without a sitemap entry. The root URL (`/`) is already covered; `/landing.html` is the page with the marketing copy.
**Action:** Add a `<url>` entry for the landing page URL with `changefreq: monthly` and `priority: 0.8`.

---

### 4. `robots.txt` references the Vercel subdomain — will need updating with a custom domain
**File:** `robots.txt:4`
**Commit:** `b38d4bb`
**Code:**
```
Sitemap: https://task-management-beige-eight.vercel.app/sitemap.xml
```
**Why this matters:** Not a current bug, but a reminder: if a custom domain is added (which should happen soon given the landing page investment), `robots.txt` and `sitemap.xml` URLs need to be updated in the same deploy. Otherwise Google Search Console will show the old sitemap as the canonical reference.
**Action:** Add a note in the next domain-migration PR to update this file.

---

## 🤔 Worth a second look

### 5. Comparison table claims Arete has "Keyboard-fast capture (⌘K)" as ✓ vs Flat to-do apps as "partial"
**File:** `landing.html:528`
**Commit:** `b38d4bb`
**Why this matters:** The table positions flat to-do apps (Todoist, Things, etc.) as only "partial" for keyboard-fast capture. Most of those apps have robust keyboard shortcuts. The table legend says "Honest take from someone who used all three" which gives wiggle room, but a user coming from Todoist who knows its keyboard shortcuts may see this as a credibility miss and bounce.
**Action:** Review whether "partial" is defensible for the "⌘K from anywhere to add/find/jump" claim specifically (vs general keyboard shortcuts). If the distinguishing feature is the global system-wide ⌘K, clarify that in the table.

---

### 6. PostHog script loader on landing uses `autocapture:false` — intentional but worth confirming
**File:** `landing.html:707`
**Commit:** `b38d4bb`
**Code:**
```js
posthog.init(POSTHOG_KEY, {api_host:POSTHOG_HOST, persistence:'localStorage', autocapture:false, capture_pageview:true});
```
**Why this matters:** `autocapture:false` means no automatic click/form tracking — only the manual `track()` calls fire. This is the right choice for a minimal, privacy-respecting setup, and it matches the same config in `index.html`. Just confirming this was intentional — autocapture would capture every button click, including task content, which would be a privacy issue.
**Action:** No action needed. Just confirm this is intentional for future analytics reviews.
