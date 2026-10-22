<div align="center">
  <a href="https://easyv.wisp.uno">
    <img src="assets/logo.png" alt="EasySupport logo" width="112">
  </a>
  <h1>EasySupport</h1>
  <p>Private Discord support tickets, guild tools, and a searchable server dashboard.</p>
  <p>
    <a href="https://easyv.wisp.uno">Official website</a>
    · <a href="https://easyvstatus.wisp.uno">Service status</a>
    · <a href="https://github.com/Marcel1kub1/EasySupport">GitHub</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-%3E%3D22.5-339933?logo=node.js&logoColor=white" alt="Node.js 22.5 or newer">
    <img src="https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white" alt="discord.js v14">
    <img src="https://img.shields.io/badge/database-MySQL-00758F?logo=mysql&logoColor=white" alt="MySQL database">
    <a href="https://github.com/Marcel1kub1/EasySupport/pulls">
      <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="Pull requests welcome">
    </a>
  </p>
</div>

---

EasySupport gives Discord communities one place to handle private tickets, moderation, server
configuration, and staff permissions. Members open tickets from a Discord panel; authorized staff
can manage guild modules and roles from the web dashboard.

## Product preview

The panel gives members a clear starting point for support:

<p align="center">
  <img src="assets/panel.png" alt="EasySupport Discord panel with support categories members can select" width="100%">
</p>

Staff handle questions and ticket status in the private ticket channel:

<p align="center">
  <img src="assets/ticket.png" alt="EasySupport ticket conversation with intake answers and staff status controls" width="100%">
</p>

## What it includes

### Ticket support

- Category-based ticket panels with private channels
- Optional intake questions before a ticket opens
- Staff claims, configurable status controls, and audit logs
- TXT and HTML transcripts when tickets close
- Optional 1–5 member ratings after resolution
- Generated panel and category art
- Per-member open-ticket limits and blacklist exceptions for configured access roles

### Guild dashboard

- Sign in with Discord and manage guilds where you have **Manage Server** access
- Configure supported modules, channels, categories, and role settings for each guild
- Search modules and commands by name or description
- Searchable guild, channel, category, and role selectors
- Configure role-based access to commands; server administrators retain their bypass
- Receive clear save and loading feedback while settings are updated
- Read published EasySupport release notes from the dashboard

### Bot modules

- **Moderation:** warnings, timeouts, bans, and warning lookups
- **Anti-nuke:** configurable raid, spam, invite, and link protections
- **Automod:** word and link filters, mention spam, caps, and configurable actions
- **Leveling:** XP, ranks, leaderboards, and role rewards
- **Economy:** balances, payments, daily rewards, and work commands
- **Giveaways:** timed draws, multiple winners, and automatic results
- **Vouches:** member vouches, cooldowns, and leaderboards
- **Welcome, goodbye, and boost messages:** configurable messages, channels, and rewards
- **Logging:** configurable logs for message, member, moderation, role, channel, and voice events

Available commands and options can vary by the current build and guild configuration.

## Release notes

The dashboard checks the public GitHub Releases API when a guild dashboard or release-notes page
is opened. Results are cached for five minutes and link to the original release. If GitHub is
temporarily unavailable, the dashboard logs the fetch error and uses the last locally generated
feed when available.

Maintainers can also generate factual draft notes locally from Git history; the generator does
not send code to an AI service. It groups commit subjects using
[`scripts/release-notes.rules.json`](./scripts/release-notes.rules.json), lists changed paths, and
includes slash-command definitions when command files change:

```bash
npm run release:notes -- --from v2.3.0 --version 2.4.0
```

Review `src/data/releases.json` and `src/data/releases.md` before publishing if you want local
notes to serve as a fallback. An offline instance cannot display new releases while it is offline.
Read and dismiss state is stored in the browser; no Discord message is sent.

## Public health endpoints

EasyVStatus polls the bot's public, read-only health endpoints:

- `GET /api/status/health` reports Discord readiness and performs a live `SELECT 1` against the
  bot's MySQL pool. It returns component state and generic details, never database credentials
  or host information.
- `GET /healthz` independently confirms that the website gateway responds.

The endpoints do not require an API token.

## Run your own instance

### Requirements

- Node.js **22.5 or newer**
- A MySQL database
- A Discord application and bot token from the
  [Discord Developer Portal](https://discord.com/developers/applications)
- The bot's Discord role needs **Manage Channels** and **Manage Roles**, along with the
  messaging, attachment, embed, and history permissions used by your enabled features

Panel art is rasterized with `@resvg/resvg-js`. Category artwork is cached under `data/art/`;
transcripts are written under `transcripts/`.

### 1. Create and invite the bot

1. Create an application in the Discord Developer Portal and add a bot.
2. Copy the bot token. Under **Bot → Privileged Gateway Intents**, enable **Server Members
   Intent** and **Message Content Intent**.
3. Generate an invite using the `bot` and `applications.commands` scopes. Grant the permissions
   needed by the bot's enabled features.
4. For the web dashboard, configure the Discord OAuth2 client and its callback URL to match the
   `OAUTH_REDIRECT_URI` value in your environment.

### 2. Configure environment

Copy the example and fill in the values for your Discord application and MySQL database:

```bash
cp .env.example .env
```

The required settings include `DISCORD_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `MYSQL_HOST`,
`MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, and `OAUTH_REDIRECT_URI`. Set a unique
`SESSION_SECRET` for production. `MYSQL_PORT`, `PORT`, and `GUILD_ID` are optional overrides;
see [`.env.example`](./.env.example) for the complete list.

For a public deployment, set the OAuth callback to your deployed website's `/auth/callback` route
and add the same URL in the Discord Developer Portal.

### 3. Install, register, and start

```bash
npm install
npm run deploy
npm start
```

The deploy command synchronizes slash commands from `src/commands/` with Discord. It also removes
commands that are no longer present in the current build.

### 4. Configure a guild

Use `/setup` for ticket defaults and `/panel` to publish the ticket panel. Guild administrators
can use the web dashboard to configure supported modules and staff role permissions.

## Development

Run the test suite with:

```bash
npm test
```

### Project layout

```text
src/
├── index.js                 client bootstrap and command/event loading
├── config.js                environment validation
├── art.js                   ticket panel and category artwork
├── categories.js            ticket categories, questions, and statuses
├── db.js                    MySQL schema and repository functions
├── transcripts.js           TXT and HTML transcript generation
├── web.js                   website, health API, and guild dashboard
├── views/                   EJS templates
├── public/                  website and dashboard assets
├── commands/                slash commands
└── events/                  Discord event handlers

assets/
├── fonts/                   bundled fonts used for artwork
└── emoji/                   Twemoji SVG assets
```

### Hosting and operations

The bot stores its data in the configured MySQL database, generated artwork in `data/art/`,
downloaded emoji SVGs in `data/emoji/`, and transcripts in `transcripts/`. For production:

- Run under **systemd** or **PM2** so the process restarts after a reboot.
- Back up the MySQL database regularly.
- Keep `.env` out of version control and never publish bot or database credentials.

Example systemd service:

```ini
[Service]
WorkingDirectory=/opt/easysupport
ExecStart=/usr/bin/node src/index.js
Restart=always
EnvironmentFile=/opt/easysupport/.env
```

### Extending ticket categories and statuses

Ticket categories and statuses are defined in [`src/categories.js`](./src/categories.js).
Dashboard settings are stored per guild in MySQL; edit the category definitions when adding
code-level ticket workflows.

- **Add a category** by adding an entry. Re-post `/panel` to render its button:

  ```js
  refunds: {
    label: 'Refunds',
    emoji: '💸',
    staffRole: 'Billing Team',
    questions: ['What was refunded?', 'When did you pay? (optional)'],
  },
  ```

  `staffRole` may be a role name or ID. Questions can be plain strings or objects such as
  `{ label: 'Order ID', style: 'short', required: false }`.

- **Add a status** in `TICKET_STATUSES`. Each status becomes a control-panel button and appears
  in ticket logs:

  ```js
  escalated: {
    label: 'Escalated to management',
    emoji: '🔺',
    staffRole: 'Management',
  },
  ```

  | Field | Effect |
  |---|---|
  | `label` / `emoji` | Embed text, button label, and log text |
  | `staffRole` | Grants channel access and pings that role once on entry |
  | `claimable` | Records the staff member who selected the status |
  | `staffOnly` | Defaults to `true`; `false` allows members to select it |
  | `terminal` | Runs the close flow, transcript delivery, rating DM, and channel deletion |

  Set `terminal: true` on the final status to enable the close flow. Terminal statuses stop
  counting toward the open-ticket limit and freeze message logging. Existing tickets keep their
  current status; re-post `/panel` after changing the workflow.

- **Reopen a closed ticket:** the closed ticket record is retained, so a `ticket:reopen` status can
  create a new channel linked to it.
- **Regenerate category art:** artwork is derived from the category key and label and cached in
  `data/art/`. Rename a category or remove its cached PNG to generate new art.

For the full design rationale and architecture, see [`DESIGN.md`](./DESIGN.md).
