# Task OS — Marketing & Growth Kit

Everything you need to get people using Task OS. Honest, founder-voice, no fabricated metrics.

Production URL: `https://task-management-beige-eight.vercel.app/`

---

## Built-in product-led growth (already shipped)

These make the app spread on its own — use them, and watch the events in PostHog.

| Mechanic | Where | Event |
|---|---|---|
| **Referral-attributed invite** | Account menu → "Invite a friend" | `share` (ctx: invite) |
| **Referral capture on arrival** | any `?ref=<uid>` link | `referred_arrival`, then `signup` carries `ref` |
| **Share-the-win** | Inbox Zero card, all-quests-complete toast | `share` (ctx: inbox_zero / quests) |
| **Rich link previews** | Open Graph / Twitter meta + `og-image.png` | — |
| **First-run onboarding tour** | fires on a new account's first login | `onboarding_started` / `_completed` |

**Attribution loop:** every invite/win link is `...?ref=<the sharer's user id>`. New arrivals store that ref and it rides along on their `signup` event, so you can see who drives signups (and later reward them).

---

## The 30-day launch sequence

1. **Week 0 — soft launch.** Post to your own X/LinkedIn, DM ~20 friends. Get your first 10 real users, fix what breaks.
2. **Week 1 — build in public.** 3–4 posts/week: a screenshot, a feature, a lesson. Warms an audience before the big launch.
3. **Week 2 — communities.** r/productivity, r/Notion, r/getdisciplined, Indie Hackers. Lead with the *problem you solved for yourself*.
4. **Week 3 — Product Hunt + Show HN.** Tue–Thu. Rally your Week-1 audience to comment early.
5. **Ongoing — content/SEO.** "Superhuman shortcuts for tasks", "Wheel of Life + Oura rings", templates. Use Ahrefs/Semrush for keywords.

---

## Ready-to-post copy

### X / Twitter launch thread (hook)
> I got tired of my to-do app being a graveyard. So I rebuilt my personal OS from scratch — Superhuman-fast, Notion-deep, with AI that plans my day.
>
> It's live and free. Here's what it does 🧵 → https://task-management-beige-eight.vercel.app/

Follow with one tweet + screenshot per feature: ⌘K capture · swipe-to-done · Plan-my-day AI · goals↔tasks · Oura rings.

### Product Hunt
**Tagline (60 char):** Task OS — the calm, keyboard-fast home for everything you do

**First comment:**
> Hey PH 👋 I built Task OS because every to-do app I tried was either too shallow (a flat list) or too heavy (a Notion I stopped maintaining). This is the middle: Superhuman speed for tasks, Notion depth for goals/habits/reviews, and AI that triages your inbox and plans your day. Free to start, syncs everywhere, works offline. Would love feedback on what's missing.

### Reddit (r/productivity)
> **I rebuilt my task app around one rule: it has to be faster than my brain.**
> Everything is ⌘K. You reply to a task in plain English to change it ("snooze till Friday"). One tap AI-triages your whole inbox. And every task can point at a goal so the list never feels pointless. Built it for myself, opened it up — [link]. What would you add?

### LinkedIn
> For 2 years my tasks lived in 4 different apps and none of them stuck. So I built the one I actually wanted: calm, keyboard-fast, and smart enough to plan my day for me. It's live and free — [link]. Feedback welcome.

### Show HN
> Show HN: Task OS – a keyboard-fast personal OS (tasks + goals + habits + AI)
> Single-page PWA, offline-first, Supabase sync. AI (via Claude) triages your inbox and drafts a time-blocked day. Built it for myself; it's free. Happy to answer anything technical.

---

## Measure it (PostHog)

Activation funnel: `signup` → `task_created` (×5) → return on day 2.
- Drop before 5 tasks → the onboarding/first-capture needs work.
- Drop before D2 → the reminder/notification game needs work.

Growth funnel: `share` → `referred_arrival` → `signup (ref set)`. Watch the ratio; double down on whichever share moment (invite vs inbox_zero) converts best.

---

## Before you promote widely
- **Upgrade Supabase to Pro** so the project never auto-pauses (a paused backend = everyone locked out).
- Confirm **Site URL** + redirect allow-list point at production.
- Optionally deploy the **`/api/claude` proxy** so users get AI without their own key.
