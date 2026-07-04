# Task OS

A personal productivity operating system for planning goals, running sprints, reflecting daily, and staying accountable with the help of AI coaching. It installs as an offline-first Progressive Web App and optionally syncs across your devices through Supabase.

## 🎯 Overview

Task OS is more than a to-do list. It is a single-page web app that combines task management, gamification, journaling, and AI planning into one dashboard. Everything runs in the browser with no build step, stores locally by default, and can sync to the cloud when you connect a Supabase project.

Live app: [task-management-beige-eight.vercel.app](https://task-management-beige-eight.vercel.app)

## ✨ Features

**Planning and focus**
* North Star Cockpit for keeping long term goals in view while you work
* Pace Engine that tracks whether your daily output is on target
* Sprints and goals so larger ambitions break down into trackable work
* Command palette, keyboard navigation, and natural language dates for fast entry

**Gamification**
* Experience points and scoring on completed tasks
* Streaks, momentum tracking, and level ups that reward consistency

**Reflection and journaling**
* Daily journal and an end of day reflection ritual
* Quick add and today's journal available as app shortcuts

**AI coaching**
* AI Workflows Hub and a coaching layer powered by the Anthropic Claude API
* Planning tools that help you prioritise and reschedule your work

**Integrations**
* Notion, Readwise, and Slack connections
* Push notifications through ntfy.sh

**Progressive Web App**
* Installable on desktop and mobile, works offline, and includes app shortcuts and a share target
* Service worker caching, with a mobile polished interface, haptics, and accessibility support

**Cloud sync (optional)**
* Offline-first Supabase sync with email and password auth and Row Level Security
* Automatic snapshots, with last write wins conflict resolution
* localStorage stays the offline cache, so the app keeps working with no connection

## 🛠️ Tech Stack

* **Frontend**: a single page vanilla HTML and JavaScript app, with no framework or build tooling
* **Backend (optional)**: Supabase for auth and cloud sync
* **AI**: Anthropic Claude API
* **Hosting**: [Vercel](https://task-management-beige-eight.vercel.app), with a strict Content Security Policy and security headers

## 🚀 Getting Started

You only need a modern browser to run the app.

1. Clone the repository:
   ```bash
   git clone https://github.com/panoskokmotos/task-management.git
   cd task-management
   ```
2. Open `index.html` in your browser, or deploy the folder to any static host such as Vercel.

The app works fully on its own with local storage. Cloud sync is optional.

## ☁️ Enabling Cloud Sync

To sync across devices, connect a free Supabase project:

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase SQL Editor, paste and run `supabase-setup.sql` from this repo. It creates a per user state table protected by Row Level Security.
3. In Supabase Project Settings, copy your Project URL and anon public key.
4. In Task OS, open Settings, then Cloud Sync, and paste the URL and key along with an email and password. The first connect signs you in and starts syncing.

Full instructions live in the comments at the top of `supabase-setup.sql`.

## 📂 Project Structure

```
task-management/
├── index.html              Main Task OS app
├── givelink.html           Givelink dashboard view
├── manifest.json           PWA manifest for Task OS
├── manifest-givelink.json  PWA manifest for the Givelink view
├── sw.js                   Service worker for offline support
├── supabase-setup.sql      One time database setup for cloud sync
├── vercel.json             Hosting config, rewrites, and security headers
├── icon.svg, icon-gl.svg   App icons
└── README.md               This file
```

## 🤝 Contributing

Contributions are welcome. Feel free to open an issue for a bug or a feature request, or send a pull request.

## 📄 License

Open source under the MIT License.

## 👤 Author

Panos Kokmotos, co-founder at Givelink.
Email: panos@givelink.app
Portfolio: [panoskokmotos.com](https://panoskokmotos.com)
