<div align="center">


<img src="assets/banner.png" alt="EasySupport — self-hosted Discord ticketing" width="720">

<!-- Copy-paste in your Readme.md file -->

<a href="https://next.ossinsight.io/widgets/official/analyze-repo-pushes-and-commits-per-month?repo_id=1416277319" target="_blank" style="display: block" align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://next.ossinsight.io/widgets/official/analyze-repo-pushes-and-commits-per-month/thumbnail.png?repo_id=1416277319&image_size=auto&color_scheme=dark" width="721" height="auto">
    <img alt="Pushes and Commits of Marcel1kub1/EasySupport" src="https://next.ossinsight.io/widgets/official/analyze-repo-pushes-and-commits-per-month/thumbnail.png?repo_id=1416277319&image_size=auto&color_scheme=light" width="721" height="auto">
  </picture>
</a>

<!-- Made with [OSS Insight](https://ossinsight.io/) -->

<a href="https://wispbyte.com"><img src="assets/wispbyte-hero.png" alt="Hosted by Wispbyte — free 24/7 hosting" width="680"></a>


**Private support tickets, staff workflows, transcripts and ratings — driven by one config file.**

<p>
  <img src="https://img.shields.io/badge/node-%3E%3D22.5-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js &gt;= 22.5">
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="discord.js v14">
  <img src="https://img.shields.io/badge/storage-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite storage">
  <img src="https://img.shields.io/badge/storage-MySQL-00758F?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL storage">
  <img src="https://img.shields.io/badge/dashboard-Express%20%2B%20EJS-4A3B32?style=for-the-badge" alt="Web dashboard">
  <img src="https://img.shields.io/badge/no%20compile%20step-prebuilt%20binaries-blue?style=for-the-badge" alt="no compile step">
  <img src="https://img.shields.io/badge/maintained-yes-green?style=for-the-badge" alt="maintained">
  <a href="https://github.com/Marcel1kub1/EasySupport/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge" alt="PRs welcome"></a>
  <img src="https://img.shields.io/github/stars/Marcel1kub1/EasySupport?style=for-the-badge&logo=github&logoColor=white" alt="GitHub stars">
  <img src="https://img.shields.io/github/last-commit/Marcel1kub1/EasySupport?style=for-the-badge&logo=github&logoColor=white" alt="last commit">
</p>

</div>

---

## ✨ Features

- 🎫 **One-click tickets** — `/panel` posts a button per category; members get a private channel instantly
- 📋 **Intake questions** — ask up to 5 questions in a popup before the channel is created
- 🧩 **Everything in one panel** — art, status, intake answers and all status buttons live in a single message
- 🎨 **Generated category art** — every ticket channel and the public panel get a banner rendered with `@resvg/resvg-js`, showing the **category name and emoji** on a palette unique to that category (deterministic, cached in `data/art/`)
- 🧭 **Config-driven statuses** — every status in `src/categories.js` becomes a control-panel button (claim, pending, escalate, close)
- 🔒 **Private channels** — only the opener and the handling role can see the ticket
- 📄 **Transcripts** — a TXT + HTML transcript is generated when a ticket closes
- ⭐ **Rating prompt** — members rate the support 1–5 by DM after close
- 📝 **Audit log** — every action is logged to your log channel
- 🗄️ **MySQL storage** — all data stored in MySQL via `mysql2/promise`, with automatic migrations on boot
- ⚙️ **One-file config** — roles by name (`'Moderation Team'`) or by ID, everything else is optional

### 🛡️ Moderation
- `/moderation warn` — warn a user with reason
- `/moderation mute` — timeout a user for a duration
- `/moderation ban` — ban a user
- `/moderation warnings` — view warnings for a user

### 🔒 Anti-Nuke
- `/anti_nuke` — configure raid protection, anti-spam, anti-invite, anti-link
- Threshold-based detection with configurable punishment

### 🤖 Automod
- `/automod` — word filter, link filter, mention spam, caps filter
- Customizable blocked words, allowed domains, punishment actions

### 📈 Leveling
- `/leveling` — check rank, view leaderboard, add XP
- XP per message with cooldown, level-up announcements, role rewards

### 💰 Economy
- `/economy` — check balance, pay users, set balance
- Daily rewards, work commands, currency customization

### 🎁 Giveaways
- `/giveaways` — create, list, and end giveaways
- Timed draws, multiple winners, automatic results

### ⭐ Vouches
- `/vouches` — give or view vouches for users
- Vouch leaderboard, cooldowns, anonymous vouch option

### 👋 Welcome / Goodbye / Boost
- `/welcome_goodbye_boost` — configure welcome, goodbye, and boost messages
- Custom channels, messages, and boost role rewards

### 📝 Logging
- `/logging` — configure log channels for 15 event types
- Message delete/edit, member join/leave/ban, role/channel changes, voice, nickname, avatar

### 🌐 Web Dashboard
- **Guild-based management** — sign in with Discord and configure servers where you have Manage Server access
- **Module settings** — configure channels, categories, roles, and feature options for each guild
- **Ticket access role** — allow a selected role to open tickets even when its members are on the ticket blacklist
- **Module and command search** — filter the guild’s module list by feature name, description, or command
- **Searchable guild, channel, category, and role selectors** — find server settings without scrolling long native menus
- **In-app dashboard navigation** — move between modules and overview without a full page reload
- **Staff role permissions** — grant or deny command access for the roles in each guild
- **Save notifications** — receive custom success and error notices when settings or permissions are saved
- **Animated save controls and server loading state** — clear feedback while settings save or a guild opens
- **Settings persistence** — all changes saved to MySQL in real time
- **GitHub release notes** — show published EasySupport releases in the guild dashboard

### 👥 Role-Based Command Permissions
- Configure which staff roles can run each command from the guild dashboard
- Admins with `Administrator` permission always bypass checks
- Default fallback to Discord's native permission system when no role config exists

### 📰 GitHub release notes

The dashboard checks the public GitHub Releases API for published EasySupport releases when a guild dashboard or release-notes page is opened. Results are cached for five minutes and include a link to the original release. If GitHub is temporarily unavailable, the dashboard logs the fetch error and uses the last locally generated feed when available.

Maintainers can also generate factual draft notes locally from Git history; this does not send code to an AI service. The generator groups commit subjects using `scripts/release-notes.rules.json`, lists changed paths, and includes slash-command definitions when their command files changed. Set `package.json` to the release version and provide the previous release ref:

```bash
npm run release:notes -- --from v2.3.0 --version 2.4.0
```

Review and edit `src/data/releases.json` and `src/data/releases.md` before publishing if you want those local notes to serve as a fallback. GitHub release notes are visible to a running instance the next time someone opens the dashboard; an offline instance cannot display changes while it is offline. Read and dismiss state is stored in that browser only; no Discord message is sent.

### 📡 Private status API

Set a unique `STATUS_HEALTH_API_TOKEN` (at least 32 characters) in the bot's private environment
to enable `GET /api/status/health`. EasyVStatus calls this endpoint with a Bearer token to read
the Discord client's ready state and run a live `SELECT 1` against the bot's MySQL pool. The
response contains only component states and generic details; it does not include database
credentials or host information. Use the same token for `MAIN_SYSTEMS_API_TOKEN` in EasyVStatus.
The public `GET /healthz` endpoint independently confirms that the website gateway responds.

## 🖼️ Preview

**The ticket panel** (`/panel` — one button per category, handled-by pills per field):

<img src="assets/panel.png" alt="Discord message showing the EasySupport ticket panel with four category buttons" width="100%">

**Inside a ticket** (status buttons, staff ping, intake answers):

<img src="assets/ticket.png" alt="Discord ticket channel showing the control panel, status buttons and conversation" width="100%">

## 📋 Requirements

- **Node.js 22.5+** (hosted on your server — nothing needs to run locally).
  SQLite ships built into Node (`node:sqlite`). Panel art is rasterized with
  `@resvg/resvg-js`, which downloads a **prebuilt binary** on `npm install`
  (no compiler toolchain needed); if it is ever unavailable the bot falls back
  to a built-in procedural renderer, so tickets still get an image.
- A Discord application + bot token ([Developer Portal](https://discord.com/developers/applications))
- On the server: permissions **Manage Channels** and **Manage Roles**

## 🚀 Setup

### 1. Create the application

1. Developer Portal → **New Application**.
2. **Bot** → **Reset Token** → copy it.
3. Under **Bot → Privileged Gateway Intents**, enable **Server Members Intent**
   and **Message Content Intent** (the bot needs message content to build transcripts).
4. **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`; bot
   permissions: `Manage Channels`, `Manage Roles`, `Send Messages`,
   `Attach Files`, `Embed Links`, `Read Message History`.

### 2. Configure the bot

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id        # OAuth2 → Application ID
GUILD_ID=your-dev-guild-id           # optional; commands register instantly per-guild
```

### 3. Install and register commands

```bash
npm install
npm run deploy        # registers /setup and /panel
npm start             # boots the bot
```

`npm run deploy` loads whatever is in `src/commands/` and **deletes any command
on Discord that is no longer in the system** (in both the guild and global
scope), so the command list always matches the current build. Restart the
Discord client if the list looks cached.

### 4. Configure in Discord

```
/setup staff_role:@Support log_channel:#ticket-logs category:Support max_open:3
/panel                # posts the panel; members click a button to open a ticket
```

That's it — a member clicking a panel button gets their own private channel
with a status button for every status defined in `src/categories.js`
(Claim, Pending, Escalate, Close, …) for staff to use.

## 🗂️ Project layout

```
src/
├── index.js                 client bootstrap, auto-loads commands + events
├── config.js                validated env config
├── art.js                   SVG art generator: category + panel banners with names
├── categories.js            CENTRAL CONFIG: categories, questions, statuses
├── db.js                    MySQL schema + repository functions
├── transcripts.js           TXT + HTML transcript generation
├── web.js                   public site and Discord-authenticated guild dashboard
├── views/                   EJS templates rendered as HTML pages
├── public/site.css          shared responsive website styling
├── public/site.js           dashboard form feedback
├── commands/setup.js        /setup — per-guild configuration
├── commands/panel.js        /panel — post the ticket panel
└── events/
    ├── interactionCreate.js panel buttons, intake modals, status flows, rating
    └── messageCreate.js     automated interaction logging

assets/
├── fonts/                   Inter (OFL) bundled for banner text rendering
└── emoji/                   Twemoji SVGs for the emojis used in categories.js
```
## 🖥️ Hosting on a server

The template writes its database to MySQL (configured via `.env`), generated panel art to
`data/art/`, downloaded emoji SVGs to `data/emoji/` and transcripts to
`transcripts/`. For production:

- Run under **systemd** or **PM2** so it restarts on reboot:

  ```ini
  # /etc/systemd/system/ticketbot.service
  [Service]
  WorkingDirectory=/opt/ticketbot
  ExecStart=/usr/bin/node src/index.js
  Restart=always
  EnvironmentFile=/opt/ticketbot/.env
  ```

- Back up your MySQL database on a schedule (cron + mysqldump/automated backups).
- Keep `.env` out of git (it's in `.gitignore`) and never commit the token.

## 🧪 Tests

```bash
npm test
```

## 🧩 Extending

Everything about categories and statuses lives in **`src/categories.js`** — the
only file you edit. Every field is optional and defaults are filled in
automatically. Roles are given by **name** (`'Billing Team'`) or by **ID**
(`'123456789012345678'`); an unknown role is skipped with a console warning.

- **Add a category** — one entry. Re-post with `/panel` to render the button:

  ```js
  refunds: {
    label: 'Refunds',
    emoji: '💸',
    staffRole: 'Billing Team',                 // name or ID
    questions: ['What was refunded?', 'When did you pay? (optional)'],  // popup before the channel opens
  },
  ```

  `questions` accepts plain strings (paragraph questions; append
  `(optional)` to make one optional) or full objects:
  `{ label: 'Order ID', style: 'short', required: false }`.

- **Add a status** — one entry in `TICKET_STATUSES`. Each status automatically
  becomes a button on every ticket's control panel, is counted by the
  per-user open-ticket limit (unless `terminal`), and appears in logs:

  ```js
  // ping a high-rank team the moment a ticket is escalated,
  // and grant that role access to the ticket channel
  escalated: {
    label: 'Escalated to management',
    emoji: '🔺',
    staffRole: 'Management',                   // name or ID
  },
  ```

  | Field | Effect |
  |---|---|
  | `label` / `emoji` | Embed text, button label, log text |
  | `staffRole` | Role granted channel access + pinged once on entry |
  | `claimable` | Records which staff member set it |
  | `staffOnly` | Default `true`; `false` lets members press it |
  | `terminal` | Close protocol: confirm → reason → transcript + rating DM → delete |

  Mark the final status (`terminal: true`) — it drives transcript delivery and
  channel deletion. Terminal statuses stop counting toward the open limit and
  freeze message logging. Existing tickets keep the status they already had, so
  re-post `/panel` and treat old panels as stale.

- **Reopen a closed ticket** — the closed ticket row is kept, so a
  `ticket:reopen` status can create a new channel linked to the same record.
- **Regenerate category art** — banners are derived deterministically from the
  category key and label, cache the category name and emoji, and are cached in
  `data/art/`; rename a category (or delete a cached PNG) to get a fresh one.
- **Auto-close inactive tickets** — add a `node-cron` job that closes tickets
  whose last message in `ticket_messages` is older than N days.
- **Staff stats** — query `tickets` for claim time and ratings per staff member.

---

<div align="center">
<sub>Full design rationale, name shortlist and architecture: <a href="./DESIGN.md">DESIGN.md</a></sub>
</div>
