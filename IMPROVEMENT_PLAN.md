# Arete (Task OS) — Improvement Plan
_Generated: 2026-08-27 | Analysed: index.html (14,924 lines), api/claude.js, sw.js, givelink.html, landing.html_

---

## 🔥 P0 — Ship this week (bugs breaking user flows)

### 1. All AI prompts are hardcoded for one specific user

**What:** 10+ AI feature prompts are hardcoded with "Panos", "Givelink", "Greek founder in his 20s", and "the SF move" — meaning every user gets coaching advice for someone else's life.

**Where:**
- `index.html:11672` — Morning briefing: `"You are the personal chief-of-staff for Panos, founder of Givelink…"`
- `index.html:5647` — Relationships AI: `"Who should Panos reach out to…Consider his Givelink fundraising platform"`
- `index.html:5920` — Discomfort coach: `"give Panos…How this builds resilience for the SF move and Givelink growth"`
- `index.html:7319` — Brand audit: `"Audit Panos's brand presence (Panos is a Greek founder in his 20s building Givelink…)"`
- `index.html:7849` — Decisions AI: `"Suggest 5 decisions Panos should actively make…focus on Givelink growth"`
- `index.html:8604` — Weekly newsletter: `"Write a personal weekly newsletter for Panos, a startup founder"`
- `index.html:5445` — Automations AI: `"Focus on…Givelink B2B SaaS for nonprofits"`
- `index.html:7580` — Daily priorities: `"Prioritize tasks that drive Givelink revenue"`

**Why it matters:** Every signed-up user receives AI advice about Panos's life goals, Panos's startup, and Panos's move to SF. This is the app's core differentiator (personalized AI coaching) rendered completely broken for anyone who isn't the developer.

**Effort:** M

**Suggested fix:**
- Replace all hardcoded names/context with `profileName` + `S.brandStatement` (already stored in state), e.g. `"You are the personal chief-of-staff for ${profileName}. Context: ${getAboutMe()}"`
- `getAboutMe()` already exists and returns the user's brand statement — use it consistently in every AI prompt
- Audit every `prompt=` string for the literal text "Panos" and "Givelink" and parameterise

---

### 2. Morning briefing silently skips when using the AI proxy

**What:** `_fetchAIBriefing` (line 11670) checks `!S.claudeKey && !localStorage.getItem('taskos_api_key')` before calling the AI, but never checks `APP_CONFIG.aiProxy`. Users on the hosted/proxy path — the majority of non-developer users — never see the morning briefing.

**Where:** `index.html:11670`
```js
if(!S.claudeKey&&!localStorage.getItem('taskos_api_key'))return;  // BUG: aiProxy not checked
```
Additionally, `taskos_api_key` is a stale localStorage key that is never written by the current app — it will always be falsy.

**Why it matters:** The morning AI briefing is a high-visibility dashboard feature. Proxy users (anyone on the hosted deployment without their own Claude key) click "refresh" and nothing happens — no loading state, no error, no explanation.

**Effort:** S

**Suggested fix:**
- Change the guard to: `if(!S.claudeKey && !APP_CONFIG.aiProxy) return;`
- Remove the `localStorage.getItem('taskos_api_key')` check entirely — it is a dead code path
- Verify `callClaude()` (line 5007) correctly picks up the proxy — it does, so only this guard needs fixing

---

### 3. Push notification icon path broken in Service Worker

**What:** `sw.js` lines 46–47 reference `./icons/icon-192.png` as the notification icon/badge, but no `icons/` subdirectory exists in the repository. The actual icons are at the root (`./icon-192.png`).

**Where:** `sw.js:46-47`
```js
icon:'./icons/icon-192.png',   // 404 — directory does not exist
badge:'./icons/icon-192.png',
```

**Why it matters:** Every push notification (task reminders, snooze alerts) shows with a broken/missing icon on Android. On iOS the badge is also lost. Users receiving silent or icon-less notifications lose trust in the reminder feature.

**Effort:** S

**Suggested fix:**
- Change to `icon:'./icon-192.png', badge:'./icon-192.png'`
- Bump the SW cache version (`CACHE = 'arete-20260723'`) to force all clients to pick up the fix

---

## ⚡ P1 — High ROI (UX friction blocking conversion)

### 4. Default name "Panos" shown to all new users

**What:** `profileName` defaults to `'Panos'` and the dashboard heading is rendered as "Good morning, Panos 👋" for every first-time visitor before they configure their name.

**Where:**
- `index.html:2519` — `let profileName=localStorage.getItem('taskos_name')||'Panos';`
- `index.html:1070` — `<h1 id="greeting">Good morning, Panos 👋</h1>`

**Why it matters:** First impressions are irreversible. A new user sees someone else's name within 2 seconds and immediately distrusts the personalisation. The guest-mode onboarding never prompts for a name.

**Effort:** S

**Suggested fix:**
- Change the default to an empty string or `'friend'` — e.g. `||''` — and render "Good morning 👋" when no name is set
- Prompt for name in the first-run brain dump flow (already shows; just auto-focus the name step)
- The hosted path already extracts from email (line 10459-10461) — apply the same logic for guest mode

---

### 5. Seeded demo data is the developer's personal content

**What:** `seed()` and `seedGoals()` (lines ~4600–4976) inject personal tasks and goals for non-hosted-mode deployments — e.g. "ETF for founder-led companies", "Song on Givelink", "Financial Independency w/ Givelink", "6+ Months in SF". `seedGoals()` alone is 394 lines of personal content.

**Where:** `index.html:4532` (`function seedGoals()`) through `index.html:4976`

**Why it matters:** Any self-hosted user or developer evaluating the app immediately sees content that has no relation to them. This undermines the "Personal OS" pitch and looks like broken software. The `_seedStarter()` function (line 10443) already has a clean, generic 5-task welcome set — it's just not used consistently.

**Effort:** M

**Suggested fix:**
- Replace the personal seed content in `seedGoals()` with generic goal archetypes (Health, Growth, Finance, Relationships)
- Gate the personal seed data behind a `if(DEV_MODE)` flag so it only appears in local development
- Use `_seedStarter()` (the clean generic version) as the production default

---

### 6. AI features completely unavailable with no clear fallback

**What:** `APP_CONFIG.aiProxy` is `''` (line 9959). Users without their own Claude API key see a toast: "Add Claude API key in Settings to…" with no link, no explanation of what a key is, and no upgrade path.

**Where:** `index.html:9959` — `aiProxy: '',` and `index.html:5008` — `if(!useProxy&&!S.claudeKey){toast('Add Claude API key…');return null;}`

**Why it matters:** The landing page sells AI as the product's core value. Users sign up, hit "Plan my day" or "AI triage," and get a dismissive toast. Conversion from trial to activation dies here.

**Effort:** M

**Suggested fix:**
- Deploy `api/claude.js` on Vercel with `ANTHROPIC_API_KEY` and set `aiProxy` to the deployed URL — the proxy code is already written
- Or, when no proxy/key is available, replace the toast with an inline upgrade prompt modal linking to the Settings → Claude API section
- Track `track('ai_blocked_no_key', {feature})` events (currently `posthogKey` is also blank; see item 7)

---

### 7. Zero product analytics — no visibility into user behaviour

**What:** `APP_CONFIG.posthogKey` is `''` (line 9960). All `track()` calls (`auth_login`, `guest_to_signup`, `ai_blocked_no_key`, etc.) are no-ops. The PostHog snippet still loads its ~4KB inline stub on every page view.

**Where:** `index.html:9960` — `posthogKey: '',`

**Why it matters:** Every conversion event — guest-to-signup, first AI use, subscription — is invisible. The team is flying blind on where users drop off, which features drive retention, and what the real activation rate is.

**Effort:** S

**Suggested fix:**
- Set a PostHog project key (free tier covers up to 1M events/month)
- Wrap the PostHog stub with a `if(APP_CONFIG.posthogKey)` guard to avoid loading it when blank
- Instrument the 3 highest-value events: `guest_started`, `auth_signup`, `first_ai_used`

---

### 8. AI output injected as raw HTML without sanitisation

**What:** `_renderAIBriefing` inserts Claude's response text directly into `innerHTML` without escaping (line 11704). If the AI returns text containing `<script>`, `<img onerror>`, or `<a href="javascript:">`, it executes in the page.

**Where:** `index.html:11704`
```js
if(body)body.innerHTML=lines.join('<br><br>');  // lines include raw AI text
```

**Why it matters:** While Anthropic's API is not adversarially controlled, AI outputs have been jailbroken to produce HTML. More practically, cached briefings stored in localStorage (line 11693) persist across sessions — a corrupted or injected cache entry could execute on every load.

**Effort:** S

**Suggested fix:**
- Use `textContent` + `createElement` for text nodes, and `document.createElement('strong')` for the `PRIORITY_1` bold
- Or run all AI text through `esc()` (already defined at line 11776) before building the `lines` array
- Clear the briefing cache key from localStorage when the user logs out (`authLogout`, line 10113)

---

## 🛠 P2 — Code health (tech debt slowing velocity)

### 9. No rate limiting on the AI proxy endpoint

**What:** `api/claude.js` has a comment (line 12) noting "add per-user rate limiting (e.g. Upstash)" but it remains unimplemented. If `SUPABASE_URL` is not set, the endpoint is fully unauthenticated — any caller can run up unlimited Anthropic API costs.

**Where:** `api/claude.js:12-13`, `api/claude.js:22-31`

**Why it matters:** A single malicious or misconfigured client can exhaust the entire Anthropic API budget in minutes with no circuit breaker.

**Effort:** M

**Suggested fix:**
- Add Upstash Redis rate limiting (10 req/min per user ID from the Supabase token, 3 req/min for unauthenticated calls)
- Alternatively, make the Supabase auth check mandatory (remove the `if(process.env.SUPABASE_URL)` guard) so anonymous calls are always rejected
- Cap `max_tokens` server-side (currently capped at 2000; add a per-minute token budget too)

---

### 10. 14,924-line monolithic HTML file

**What:** The entire application — 600+ functions, all CSS, all HTML templates, and all JavaScript — lives in a single `index.html` with no build system, no modules, and no tests. All 600+ functions are globally scoped.

**Where:** `index.html` (entire file)

**Why it matters:** Any rename, extraction, or refactor has a high chance of silently breaking an unrelated feature because there are no module boundaries and no tests. Adding new features requires scrolling through 15,000 lines. Debugging production issues means `console.warn` triage.

**Effort:** L

**Suggested fix:**
- Extract the CSS into `style.css` and load it via `<link>` as a first step (zero risk)
- Move the `seed()` / `seedGoals()` functions into a `seed.js` module (no dependencies, easy boundary)
- Do not attempt a full rewrite — incremental extraction by feature area over multiple weeks is safer

---

### 11. `seedGoals()` is 394 lines of personal content mixed with framework code

**What:** The `seedGoals()` function (lines 4532–4926) mixes generic seed-data infrastructure with ~350 lines of personal goal/task definitions for one specific person's life. It's the second-largest function in the codebase.

**Where:** `index.html:4532` through `index.html:4926`

**Why it matters:** Every code change near this function risks accidentally shipping personal content, and any legitimate refactor must sift through the personal data to find the structural code.

**Effort:** M

**Suggested fix:**
- Extract the personal goal/task definitions into a `DEV_SEED_DATA` constant or separate file gated by a build flag
- Keep only the generic `mk()` / `g()` helper functions and the structural seeding logic in the function body

---

### 12. `renderTop3()` is a 163-line render function with mixed concerns

**What:** The `renderTop3()` function (lines 3151–3314 approx.) handles rendering the dashboard top-3 section, the slot picker UI, drag-and-drop logic, task linking, and AI daily picks — all in one function body.

**Where:** `index.html:3151`

**Why it matters:** Any change to the Top-3 UI risks breaking the AI daily picks logic or the slot picker, and vice versa. Testing any one behaviour requires navigating 163 lines of interleaved concerns.

**Effort:** M

**Suggested fix:**
- Split into `renderTop3Slots()` (pure render), `_openSlotPicker()` (interaction), and `_renderDailyPicks()` (AI integration)
- Each of these already exists as conceptual blocks within the function; the split is mostly extracting inner blocks

---

## 💡 P3 — Nice to have

### 13. Service worker cache name is a hardcoded date

**What:** `const CACHE = 'arete-20260723'` in `sw.js:1` requires manual update on every deploy or users may serve stale assets.

**Where:** `sw.js:1`

**Effort:** S

**Suggested fix:** Use a hash or timestamp injected by a build step, or at minimum document the required manual update in the deploy checklist. Alternatively use a URL-versioned asset pattern.

---

### 14. `givelink.html` is cached by the main app's service worker

**What:** Commit `d635c06` ("Remove Givelink from Task OS") separated the two products, but `sw.js` still caches `./givelink.html` in the main app's cache (line 17).

**Where:** `sw.js:17` — `'./givelink.html'` in the `HTML` array

**Effort:** S

**Suggested fix:** Remove `'./givelink.html'` from the `HTML` array in `sw.js`. If `givelink.html` needs its own offline support, give it its own service worker.

---

### 15. PostHog stub loads on every page view even when key is blank

**What:** The `_initPostHog()` function (line 10390) checks `if(!APP_CONFIG.posthogKey)return` before calling `posthog.init()`, but the 4KB inline PostHog stub (line 10391) runs regardless because it is inside the function body after the guard. Actually the guard fires before the stub — but the stub is still inlined in the HTML unconditionally, adding ~4KB to every initial parse.

**Where:** `index.html:10390-10392`

**Effort:** S

**Suggested fix:** Move the PostHog snippet to a dynamically-loaded `<script>` tag created only when `posthogKey` is set, keeping the guard but removing the static 4KB bundle cost for unconfigured deployments.

---

_Total items: 15 (3 P0, 5 P1, 4 P2, 3 P3) — ordered within each tier by ROI._
