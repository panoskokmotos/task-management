# Weekly Triage — 2026-09-08

## 📊 Week at a glance

- **Commits this week (Sep 1–8)**: 0
- **Files changed this week**: 0
- **Debt markers added this week**: N/A — no commits to scan
- **High-churn files**: N/A
- **Last commit**: `5cd9437` on 2026-08-22 (17 days ago) — README update only

> The repo has been quiet for over two weeks. The triage below is a static snapshot
> of the most actionable debt discovered across all files rather than commit-window items.

---

## 🚨 Needs immediate attention

### 1. CSP blocks Google Fonts — Inter not rendering in production
- **File**: `vercel.json:15`
- **Introduced by**: `0c1d32d` (Rebrand to Arete, 2026-07-17)
- **Why it matters**: `style-src` and `font-src` directives don't include `fonts.googleapis.com`/`fonts.gstatic.com`. Inter never loads; users see system fonts. Affects every page view in production since the rebrand.

### 2. Push notification icon is a 404
- **File**: `sw.js:48-49`
- **Introduced by**: `0c1d32d` (Rebrand to Arete, 2026-07-17)
- **Why it matters**: Path `./icons/icon-192.png` does not exist — there is no `/icons/` subdirectory. Every push reminder notification shows a broken icon on mobile lock screens.

### 3. XSS — unescaped `t.title` in Weekly Review wizard innerHTML
- **File**: `index.html:3594`, `3601`, `3603`
- **Introduced by**: pre-existing (wizard code, ~commit f883adf PLG Tier 1)
- **Why it matters**: Task titles are interpolated directly into `innerHTML` without `esc()`. The helper exists at line 11776 but wasn't applied consistently. Self-XSS in a single-user context today; escalates as sharing features mature.

### 4. AI proxy open to unauthenticated callers when `SUPABASE_URL` is unset
- **File**: `api/claude.js:22`
- **Introduced by**: original proxy commit
- **Why it matters**: If deployed without `SUPABASE_URL` env var, the Anthropic API proxy accepts any POST with no auth — anyone can exhaust the operator's Claude quota. No rate limiting compounds this.

---

## 🧹 Cleanup opportunities

### 5. Stale Givelink state fields in `S` schema
- **File**: `index.html:2517`
- **Introduced by**: `d635c06` (Remove Givelink from Task OS, 2026-07-06) — should have cleaned these but didn't
- **Detail**: `givelinkMetrics` and `givelinkHistory` remain in the default state object and are synced to Supabase for every user. Dead weight in every user's cloud record.

### 6. `givelink.html` cached in service worker and served at `/givelink`
- **File**: `sw.js:4,16`, `vercel.json:4`
- **Introduced by**: `0c1d32d` (rebrand, 2026-07-17) — sw.js was updated but these entries weren't removed
- **Detail**: SW fetches and caches `givelink.html` on install. The `/givelink` rewrite stays live. Three separate files reference a dead product page.

### 7. `catch(e){}` empty catch blocks — ~30 instances
- **File**: `index.html` — lines 956, 2587, 2949, 2983, 3868, 3971, 9242, 10115, 10120, 10374, 10381, and ~20 more
- **Detail**: Errors are silently swallowed. Notable: auth-callback user fetch (10374), sync-on-login (10381), template application (10134). Users see no feedback when these fail; bugs are invisible in production.

### 8. Off-brand `gold` CSS keyword used for top-goal border
- **File**: `index.html:244`
- **Introduced by**: unknown (predates recent commits)
- **Detail**: `.gc.top { border-left: 3px solid gold; }` uses a CSS keyword outside the design token system. Doesn't respond to theme switching; looks off in dark mode.

### 9. Hardcoded non-branded production URL `task-management-beige-eight.vercel.app`
- **File**: `index.html:10180`, `10232`; `landing.html:11,16,17,19,21,24,25`
- **Introduced by**: `b38d4bb` (landing growth, 2026-07-22)
- **Detail**: `_APP_URL` and the canvas share-card text embed this URL. Share cards show it as the destination — kills the referral loop at the last second.

---

## 🤔 Worth a second look

### 10. `BCOLORS` object duplicates CSS variable values as magic strings
- **File**: `index.html:2515`
- **Detail**: `BCOLORS = {'this-week':'#ff6b6b','this-month':'#ffa94d',...}` — the same colors are defined as CSS custom properties (`--q1`, `--q3`, etc.) but the JS object hardcodes the dark-mode hex values. If the palette changes, these go stale and the theme breaks.

### 11. `toast()` uses `innerHTML` — forwarding network error messages
- **File**: `index.html:2789`
- **Detail**: `toast('AI error: ' + e.message)` at line 5033 passes a network error message straight to `innerHTML`. A crafted server response could inject HTML. Low likelihood, but worth tightening.

### 12. `option` tag content not escaped in linked-task selector
- **File**: `index.html:2543`
- **Detail**: `t.title.slice(0,45)` inserted directly into `<option>` tags without `esc()`. A title containing `"` or `</option><option>` could corrupt the select.

### 13. `max_tokens` proxy cap too low for complex AI features
- **File**: `api/claude.js:35`
- **Detail**: Hard cap at 2000 tokens. Several AI features (notes synthesis, day planning, briefing) routinely need more. Truncated output surfaces as incomplete AI responses with no user-visible warning.

### 14. `#ef4444` red and `#ff8fab` pink hardcoded inline — not in design tokens
- **File**: `index.html:847` (offline pill), `index.html:1080` (checklist badge), `index.html:710` (board dot)
- **Detail**: These bypass the `--q1`/`--cb` token system. In light mode they may clash with the light-mode palette values for those tokens, since the tokens redefine their values under `body.light`.

---

*No commits landed this week. No new debt was introduced. The items above are existing findings.*
*Next scheduled triage: 2026-09-15.*
