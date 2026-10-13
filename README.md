# Easy — Discord Ticketing Bot (discord.js template)

Self-hosted ticketing: members open private support channels from a button-based
panel, staff move tickets through configurable statuses, all interactions are
logged, and users receive a transcript with a rating prompt when a ticket
reaches its terminal status.

Full design rationale, name shortlist and architecture: **[DESIGN.md](./DESIGN.md)**.

## Requirements

- **Node.js 22.5+** (hosted on your server — nothing needs to run locally)
  SQLite ships built into Node (`node:sqlite`), so there are **no native modules
  to compile** — `npm install` only downloads `discord.js` and `dotenv`.
- A Discord application + bot token ([Developer Portal](https://discord.com/developers/applications))
- On the server: permissions **Manage Channels** and **Manage Roles**

## Setup

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

### 4. Configure in Discord

```
/setup staff_role:@Support log_channel:#ticket-logs category:Support max_open:3
/panel                # posts the panel; members click a button to open a ticket
```

That's it — a member clicking a panel button gets their own private channel
with a status button for every status defined in `src/categories.js`
(Claim, Pending, Escalate, Close, …) for staff to use.

## Project layout

```
src/
├── index.js                 client bootstrap, auto-loads commands + events
├── config.js                validated env config
├── categories.js            CENTRAL CONFIG: categories, questions, statuses
├── db.js                    SQLite schema + repository functions
├── transcripts.js           TXT + HTML transcript generation
├── commands/setup.js        /setup — per-guild configuration
├── commands/panel.js        /panel — post the ticket panel
└── events/
    ├── interactionCreate.js panel buttons, intake modals, status flows, rating
    └── messageCreate.js     automated interaction logging
```

## Hosting on a server

The template writes its database to `data/tickets.db` and transcripts to
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

- Back up `data/` and `transcripts/` on a schedule (cron + restic/borg).
- When you outgrow SQLite, swap the statements in `src/db.js` for PostgreSQL —
  the schema is already relational (see DESIGN.md §2.3).
- Keep `.env` out of git (it's in `.gitignore`) and never commit the token.

## Extending

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
- **Auto-close inactive tickets** — add a `node-cron` job that closes tickets
  whose last message in `ticket_messages` is older than N days.
- **Staff stats** — query `tickets` for claim time and ratings per staff member.
