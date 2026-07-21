# Improvement Plan — Arete Task OS

> Generated 2026-07-21 via automated codebase scan.

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. Hardcoded "Panos" / Givelink in 15+ AI prompts
**What:** AI features generate personalised advice for "Panos, Greek founder of Givelink" regardless of who is actually signed in.  
**Where:** `index.html` lines 7849–7850, 8604, 9806, 11415, 11516, 11524, 11672, 11734, 11810, 12186, 13111, 13198, 13289, 13293 (210 total occurrences of "Panos")  
**Why it matters:** Every other user who signs up receives AI responses about Givelink, SF moves, and nonprofit SaaS strategy — completely breaking the product experience.  
**Effort:** M  
**Suggested fix:**
- Replace every hardcoded fallback `|| 'Panos — Greek founder...'` with `|| 'a productivity-focused individual'` (or pull from `getAboutMe()` only)
- Remove all inline "Panos should…" / "for Panos" / "helping Panos" from prompt strings; use `name = profileName || 'you'` variable instead
- Gate the affected features behind a "complete your profile" nudge if `getAboutMe()` is empty

---

### 2. `profileName` hardcoded default shows "Good morning, Panos"
**What:** Every new user who hasn't set a name sees "Good morning, Panos 👋" in the dashboard.  
**Where:** `index.html` line 2519: `let profileName=localStorage.getItem('taskos_name')||'Panos';` and `index.html` line 1070  
**Why it matters:** First impression for all new users is broken — the greeting calls them by the developer's name, destroying trust immediately.  
**Effort:** S  
**Suggested fix:**
- Change default to `|| ''` and render `Good morning${name ? ', '+name : ''}` 
- During first-run onboarding (already exists at `_startFirstRun()`), prompt for name and save it

---

### 3. Broken push notification icon path in service worker
**What:** The service worker push notification handler references `./icons/icon-192.png` but the file lives at `./icon-192.png` (no `icons/` subdirectory).  
**Where:** `sw.js` lines 38–39  
**Why it matters:** Every push notification shows a broken icon — poor UX and a trust signal for the app's reliability.  
**Effort:** S  
**Suggested fix:**
- Change `icon: './icons/icon-192.png'` → `icon: './icon-192.png'`
- Change `badge: './icons/icon-192.png'` → `badge: './icon-192.png'`

---

### 4. Logout leaves private auth tokens in localStorage
**What:** `authLogout()` only clears 4 keys but leaves `taskos_sb_uid`, `taskos_sb_email`, `taskos_sb_access`, `taskos_sb_refresh`, `taskos_sb_exp` and other private data in localStorage.  
**Where:** `index.html` line 10120  
**Why it matters:** On shared devices, the next user (or attacker) can read the previous user's email, UID, and bearer token from localStorage, enabling account takeover.  
**Effort:** S  
**Suggested fix:**
- Replace the selective key removal with `['taskos','taskos_name','taskos_guest','taskos_guest_nudged','taskos_sb_uid','taskos_sb_email','taskos_sb_access','taskos_sb_refresh','taskos_sb_exp','taskos_wiz_draft'].forEach(k=>localStorage.removeItem(k))`
- Or use `localStorage.clear()` then re-seed any needed defaults

---

### 5. XSS via unescaped user content in weekly review innerHTML
**What:** Task titles and goal descriptions are injected directly into `innerHTML` without calling `esc()` in the weekly review wizard.  
**Where:** `index.html` lines 3594 (`${t.title}`), 3601 (`${t.title}`), 3603 (`${g.title}`, `${g.description}`)  
**Why it matters:** A task titled `<img src=x onerror=alert(document.cookie)>` executes arbitrary JS. With Supabase sync this could affect other sessions.  
**Effort:** S  
**Suggested fix:**
- Wrap all user-content interpolations with `esc()`: `${esc(t.title)}`, `${esc(g.title)}`, `${esc(g.description)}`
- Run a one-time audit: `grep -n "innerHTML.*\${t\.title\|innerHTML.*\${g\.title" index.html` to find any remaining sites

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 6. No rate limiting on the AI proxy — bill exposure
**What:** `api/claude.js` explicitly notes "add per-user rate limiting" but the code has none; any signed-in user can fire unlimited AI calls.  
**Where:** `api/claude.js` line 12 (comment acknowledging the gap)  
**Why it matters:** A single power user or bot could run up hundreds of dollars of Anthropic API spend in minutes. This is a business-critical blocker before any promotion.  
**Effort:** M  
**Suggested fix:**
- Add Upstash Redis rate limiting (free tier available): `@upstash/ratelimit` with a sliding window (e.g. 20 AI calls per user per hour)
- Alternatively, add a per-user call counter in Supabase and check it before proxying
- At minimum, add a hard per-request token cap matching the current 2000-token proxy limit

---

### 7. Morning reminder default message hardcoded to "Panos"
**What:** The default scheduled morning reminder message is `'Good morning Panos! Check your One Thing and start focused work.'`  
**Where:** `index.html` line 11254  
**Why it matters:** Every user who enables reminders without customising the message gets a notification addressed to Panos — breaking the personal feel of the app.  
**Effort:** S  
**Suggested fix:**
- Change to `'Good morning! Check your One Thing and start focused work.'`
- Or interpolate the stored name: `` `Good morning${profileName ? ' '+profileName : ''}! ...` ``

---

### 8. `aiProxy` left blank — users must supply own Claude key
**What:** `APP_CONFIG.aiProxy` is set to `''`, meaning every user must paste their own `sk-ant-...` key before AI features work.  
**Where:** `index.html` line 9959  
**Why it matters:** Requiring users to find, generate, and paste an Anthropic API key is high-friction onboarding; most will bounce before ever seeing AI value. The proxy exists precisely to solve this.  
**Effort:** S  
**Suggested fix:**
- Deploy `api/claude.js` to Vercel with `ANTHROPIC_API_KEY` set as an env var
- Set `aiProxy` to the deployed URL (e.g. `'https://arete.vercel.app/api/claude'`)
- The Supabase auth gate in the proxy already protects it to signed-in users only

---

### 9. Goal / relationship views have no mobile scroll on long lists
**What:** Complex views (Goals, OKRs, Relationships, Weekly Review wizard) use fixed `height` containers that overflow on small viewports without scrolling.  
**Where:** `index.html` — only 19 `@media` queries across 14,924 lines; goal cards and wizard panels lack `overflow-y: auto`  
**Why it matters:** Mobile is likely the dominant access pattern for check-ins; users on iPhone can't reach CTAs hidden below the fold.  
**Effort:** M  
**Suggested fix:**
- Add `overflow-y: auto; -webkit-overflow-scrolling: touch;` to `.view` containers for Goals, OKRs, and Relationships
- Test the weekly review wizard on 375px viewport; fix any steps where "Next →" is unreachable

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 10. 14,924-line monolithic `index.html`
**What:** The entire app — CSS, HTML structure, 100+ JavaScript functions — lives in one file with no modules, no build step, and no tests.  
**Where:** `index.html` (entire file)  
**Why it matters:** Feature branches collide in every PR; dead code can't be tree-shaken; linting is impractical; onboarding any collaborator is a multi-day read.  
**Effort:** L  
**Suggested fix:**
- Extract CSS into `styles.css` and the 5–6 major JS sections (`auth.js`, `ai.js`, `sync.js`, `render.js`, `data.js`) using `<script type="module">`
- Keep the HTML shell thin; add Vite or esbuild for bundling
- Don't attempt all at once — start with `auth.js` (cleanest boundary) as a proof of concept

---

### 11. Service worker CACHE key is hardcoded to a date
**What:** `const CACHE = 'arete-20260723'` must be manually edited on every deploy or old clients won't see new code.  
**Where:** `sw.js` line 1  
**Why it matters:** Forgetting to bump this date means users run stale JS/HTML indefinitely — silent production bug.  
**Effort:** S  
**Suggested fix:**
- Generate the cache key from a build hash or git SHA, e.g. inject via Vercel env: `const CACHE = 'arete-{{GIT_SHA}}'`
- Or use a `version.json` that both the SW and the app read

---

### 12. No `.env.example` — contributor setup undocumented
**What:** `api/claude.js` requires `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` but there is no `.env.example` in the repo.  
**Where:** Repo root (file missing)  
**Why it matters:** Any contributor or self-hoster who clones the repo has to reverse-engineer env var names from comments buried in `api/claude.js`.  
**Effort:** S  
**Suggested fix:**
- Create `.env.example` with the three variables and a placeholder comment for each
- Reference it in the setup instructions in `README.md`

---

### 13. Supabase anon key hardcoded in source HTML
**What:** `supabaseAnon: 'sb_publishable_VndetAqTYLRXr4UEsu8Uig_y2mtTv-M'` is committed to the repository.  
**Where:** `index.html` line 9958  
**Why it matters:** While Supabase anon keys are designed to be public, hardcoding them prevents rotation without a code change and makes it obvious to any GitHub visitor which Supabase project the app targets.  
**Effort:** S  
**Suggested fix:**
- Inject via a build-time replacement (Vite `import.meta.env.VITE_SUPABASE_ANON`) or a `config.json` generated at deploy time
- At minimum, document that the key is intentionally public and what RLS rules protect it

---

### 14. `innerHTML` uses `<option>` with unescaped `t.title`
**What:** `s.innerHTML=...+t.title.slice(0,45)+'</option>'` injects task title into a `<select>` without `esc()`.  
**Where:** `index.html` line 2543 (dependency picker in task drawer)  
**Why it matters:** A task title with `"` or `>` breaks the rendered dropdown and could allow attribute injection.  
**Effort:** S  
**Suggested fix:**
- Change to `>${esc(t.title.slice(0,45))}</option>`

---

## 💡 P3 — Nice to have

### 15. OG / Twitter meta tags point to old Vercel subdomain
**What:** `og:url` and `og:image` are hardcoded to `https://task-management-beige-eight.vercel.app/`.  
**Where:** `index.html` lines 24–32  
**Why it matters:** Social shares show the raw Vercel project slug instead of a branded domain; if the project ever moves, all cached previews break.  
**Effort:** S  
**Suggested fix:**
- Move to a custom domain and update the meta tags; or inject the canonical URL via Vercel env at build time

### 16. Relationship AI nudge leaks personal context across users
**What:** `index.html` line 5647 includes `'Consider his Givelink fundraising platform and startup journey'` in the relationship AI prompt.  
**Where:** `index.html` line 5647  
**Why it matters:** Lower priority than the systemic Panos issue (P0-1) but the same root cause: personal context baked into product code.  
**Effort:** S  
**Suggested fix:**
- Remove the hardcoded founder context; use only `getAboutMe()` which users can customise

### 17. `aiProxy` cap is 2000 tokens but `callClaude` is called with up to 1500
**What:** The server proxy caps at 2000 tokens and the client sends up to 1500, but there is no budget per feature or per user per day.  
**Where:** `api/claude.js` line 37, `index.html` line 7851  
**Why it matters:** Heavy features like Decision Advisor (`1500 tokens`) and Auto-Triage (`1500 tokens`) can trigger rapidly with no backpressure.  
**Effort:** M  
**Suggested fix:**
- Set per-feature token budgets in `callClaude` callers (most features need ≤500 tokens)
- Add a daily token quota per UID in Supabase and check it in the proxy

### 18. `p.name` and `p.why` injected unescaped in relationship card HTML
**What:** `${p.name}` and `${p.why}` are interpolated directly into `innerHTML` in the relationship AI suggestions panel.  
**Where:** `index.html` line 5557  
**Why it matters:** People names or notes containing HTML characters can break the card layout; `<` in a note could corrupt the DOM.  
**Effort:** S  
**Suggested fix:**
- Wrap with `esc()`: `${esc(p.name)}` and `${esc(p.why)}`
