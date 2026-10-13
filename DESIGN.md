# Easy — Discord Ticketing Bot

> Name shortlist · architecture · features · implementation template (discord.js)

This repository contains the **design document** and a **runnable discord.js v14
template** for a self-hosted Discord ticketing bot: members open private support
channels from a button-based panel, staff claim and close them, every
interaction is logged, and users receive a transcript plus a rating on closure.

---

## 1. Bot name shortlist

Every name starts with **Easy**, avoids the obvious `EasyTickets` / `EasySupport` /
`EasyBot` clichés, and leans professional rather than playful. Names are grouped
by the feeling they evoke, with the rationale for each.

### Relay & routing — the bot as a signal router
| Name | Rationale |
|---|---|
| **EasyRelay** ⭐ | A relay stations forwards traffic to the right desk — exactly what a ticket router does. Crisp, two syllables, logo-friendly. **Recommended default.** |
| EasyConduit | A conduit carries messages between two parties; understated and enterprise-friendly. |
| EasySignal | Plain-spoken and confident; suggests speed of response. |
| EasyDispatch | Reads like an operations tool — fitting for high-volume servers. |

### Service & care — the bot as a host
| Name | Rationale |
|---|---|
| **EasyConcierge** ⭐ | White-glove, premium service tone; ideal if the bot targets VIP or customer-facing communities. **Recommended for a premium positioning.** |
| EasyHarbor | A harbor is where troubled vessels dock — a safe place for users' problems. |
| EasyHaven | Short, warm, memorable; sanctuary metaphor. |
| EasySteward | Stewards manage resources faithfully on behalf of others — fits staff oversight. |

### Access & flow — the bot as a controlled entrance
| Name | Rationale |
|---|---|
| EasyTurnstile | Support with controlled entry: you tap the button, you're let in. Distinctive and modern. |
| EasyKiosk | Self-serve intake counter; suggests the intake-form workflow. |
| EasyLiaison | The liaison between members and the team — a diplomatic, professional word. |
| EasyDais | A dais is the raised platform where cases are heard. Uncommon, elegant, and memorable. |

### Trust & oversight — the bot as a guardian
| Name | Rationale |
|---|---|
| EasyAegis | Protective shield imagery; strong for a bot whose job is safe, private tickets. |
| EasySentry | A watchful guardian — implies vigilance and audit trails. |
| EasyWarden | Steward of order inside a busy server. |

### Office & operations — the bot as an institution
| Name | Rationale |
|---|---|
| EasyBureau | Reads like a real service agency; scales well to a product suite. |
| EasyEmissary | An official messenger — formal, trustworthy, unusual. |
| EasyChancery | Where requests are officially received; distinctive and premium. |

**Runner-ups to avoid:** `EasyTickets`, `EasyHelp`, `EasyBot`, `EasySupport` —
functional, but generic and hard to trademark.

---

## 2. Technical architecture

```
                Discord Gateway (WebSocket)
                          │
        ┌─────────────────┼──────────────────────────┐
        │                 │                          │
   interactions       messages                  guilds/members
   (buttons,          (transcript               (metadata)
    modals,            capture)
    slash cmds)             │                          │
                          ▼                          ▼
┌───────────────────────────────────────────────────────────────┐
│                     Bot process (Node.js 18+)                  │
│                                                               │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │ Command      │  │ Event handler │  │ Persistent panel   │  │
│  │ router       │  │ (interaction  │  │ views (custom_id   │  │
│  │ (/setup,     │  │  Create,      │  │  scheme, survives  │  │
│  │  /panel)     │  │  messageCreate│  │  restarts)         │  │
│  └──────────────┘  └───────────────┘  └────────────────────┘  │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │ Ticket       │  │ Transcript    │  │ Config service     │  │
│  │ manager      │  │ engine (TXT + │  │ (per-guild         │  │
│  │ (lifecycle,  │  │  HTML)        │  │  settings)         │  │
│  │  permissions)│  └───────────────┘  └────────────────────┘  │
│  └──────────────┘                                             │
└───────────────┬───────────────────────────────┬───────────────┘
                ▼                               ▼
      SQLite (dev) / PostgreSQL (prod)    transcripts/ on disk
```

### 2.1 Stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 22.5 LTS+ | Native `fetch`, stable ESM, built-in SQLite. |
| Library | discord.js v14 | Buttons, modals, slash commands, REST. |
| Intents | `Guilds`, `GuildMembers`, `GuildMessages`, `MessageContent` | Content intent is privileged — enable it in the Developer Portal. |
| Storage | `node:sqlite` (built-in, no compile step) / PostgreSQL + `pg` (production) | Swap behind the same repository functions in `src/db.js`. |
| Config | `dotenv` | Secrets never in source; `.env` is git-ignored. |
| Process | `systemd`, Docker, or PM2 | Single process; scale by adding shards only past ~2,500 guilds. |

### 2.2 Module responsibilities

| Module | Responsibility |
|---|---|
| `src/index.js` | Client bootstrap, event/command auto-loading, login. |
| `src/config.js` | Validated environment config. |
| `src/db.js` | Schema + all persistence (tickets, messages, guild settings, blacklist). |
| `src/categories.js` | **Central config**: panel buttons, intake questions and the full ticket-status registry. |
| `src/events/interactionCreate.js` | All interactive flows: open, claim, close, rate. |
| `src/events/messageCreate.js` | Automated interaction logging. |
| `src/transcripts.js` | Plain-text + HTML transcript generation to disk. |
| `src/commands/` | `/setup` (per-guild config), `/panel` (post ticket panel). |

### 2.3 Data model

```
guilds          per-server config: staff_role_id, log_channel_id,
                ticket_category_id, max_open_tickets
tickets         id, guild_id, channel_id, user_id, user_tag, category,
                status (any key of TICKET_STATUSES), claimed_by, timestamps,
                close_reason, rating, panel_message_id
ticket_messages every message inside a ticket, ordered — the audit trail
blacklist       (guild_id, user_id) — members barred from opening tickets
```

The interaction log is append-only, so transcripts are reproducible from the
database even if Discord messages are edited or deleted.

### 2.4 Lifecycle state machine

```
        /panel click (+ intake modal)
               │
               ▼
       ┌───────────────┐
       │ DEFAULT_STATUS │   ← configured in src/categories.js
       └───────────────┘
               │
   staff click any status button on the ticket panel —
   one button per status in TICKET_STATUSES (except the current one):

   open ──► pending ──► claimed ──► escalated ──► ... ──► terminal
   (each transition can grant channel access + ping the role configured
    on that status, and may record which staff member made the change)

               │ terminal status button
               ▼
   ┌──────────────────────────────────────────────────┐
   │  Confirm → reason modal → CLOSE                   │
   │  • transcripts written (TXT + HTML)               │
   │  • DM to user: transcript + 1–5⭐ rating buttons   │
   │  • log-channel embed (who/when/why)               │
   │  • channel deleted after 10 s grace window        │
   └──────────────────────────────────────────────────┘
```

---

## 3. Core features

### 3.1 Button-based ticket creation
- Panels are posted with `/panel`; each button carries a stable `custom_id`
  (`ticket:open:<key>`), so panels keep working across restarts without
  collectors or re-registration.
- Cooldown per user (5 s) prevents click spam; per-guild open-ticket limit
  (configurable, default 2) prevents channel flooding.
- The creator only sees their own ticket — every channel is created with
  explicit permission overwrites (deny `@everyone`, allow user + staff role + bot).

### 3.2 Intake forms
- Optional per-category Discord modal (up to 5 questions) shown before the
  channel is created; answers are posted into the ticket as an embed, giving
  staff structured context from the first second.

### 3.3 Staff role integration
- `/setup` binds a staff role, a log channel and a ticket category to the guild.
- Every status button is staff-gated by default (`ManageMessages` **or** the
  configured staff role); individual statuses can opt out with `staffOnly: false`.
- **Status changes are atomic** (`UPDATE ... WHERE status != ?`), so two staff
  clicking at once cannot both win; the control-panel status field updates live.
- **Per-category staff roles**: every category in `src/categories.js` can pin its
  own `staffRoleId`. A ticket of that category grants that role channel access
  and pings it exactly once when the ticket opens — so different teams (billing,
  moderation, appeals) are only notified for their own topics. The panel embed
  lists the handling role for each button. Invalid role IDs are skipped with a
  console warning instead of breaking channel creation.
- **Per-status staff roles**: statuses can ping too (see §3.4) — e.g. an
  `escalated` status that grants the high-rank role channel access and pings it.

### 3.4 Config-driven status system
`src/categories.js` is the single configuration file for ticket statuses. Each
entry in `TICKET_STATUSES` becomes, without any other code change:

| Field | Effect |
|---|---|
| `label` / `emoji` | Shown in the control embed, on the generated button, and in log messages |
| `staffRole` | Role (by **name** or numeric ID) granted channel access **and** pinged once when the ticket enters the status |
| `claimable` | Records which staff member set it + timestamp |
| `staffOnly` | Defaults to `true`; `false` lets members use the button |
| `terminal` | Runs the close protocol (confirm → reason → transcript → rating → delete) |

- Buttons are generated at runtime (`ticket:status:<key>`), so adding `escalated`
  or `pending` only means adding an entry. The per-user open-ticket limit counts
  **every non-terminal status**, and interaction logging stops only at a
  terminal status.
- Normalizers at the bottom of the file fill in defaults, accept the legacy
  `intake` / `staffRoleId` aliases, and resolve role names to IDs via
  `resolveStaffRole()`; unknown roles are warned about, never fatal.
- Panels posted before editing the registry keep their old buttons — re-post
  with `/panel` after changing statuses.

### 3.5 Automated interaction logging
- Every message in a ticket channel is stored in `ticket_messages` with author,
  timestamp and content, including attachment markers.
- Status-change events post embeds to the log channel — the audit trail survives
  channel deletion.

### 3.6 Closure protocol
Every **terminal** status (default `closed`) runs this protocol:
1. Staff clicks the terminal status button → ephemeral confirmation (prevents accidents).
2. **Confirm** → optional reason modal.
3. Server marks the ticket terminal, writes TXT + HTML transcripts.
4. User receives a DM with transcripts and a 1–5 star rating row (rating stored
   against the ticket, keyed to the opener).
5. Log channel receives the full closure summary (who set it, reason, transcript
   location, message count).
6. The ticket channel is deleted after a 10-second grace window.

### 3.7 Built-in protections
- Blacklist table (extendable via commands) blocks barred users at click time.
- Bot-permission warnings during `/setup` when `ManageChannels`/`ManageRoles`
  are missing.
- All interaction handlers are wrapped in try/catch — failures reply privately
  instead of leaving "the application did not respond".
- Stale role IDs in categories or statuses are skipped with a console warning
  instead of breaking channel creation or pinging failures.

### 3.8 Extension points (roadmap)
- Multi-language strings (EN/ES) behind a tiny `t()` helper.
- Scheduled auto-close for inactivity, working-hours aware routing.
- Staff statistics command (response time, claims, ratings) from the log table.
- Add/remove member buttons inside tickets, priority selector.
- PostgreSQL swap: replace the `better-sqlite3` statements in `src/db.js`.

---

## 4. What's in this template

```
.
├── package.json              ESM, discord.js v14, dotenv (SQLite is built into Node)
├── .env.example              DISCORD_TOKEN / CLIENT_ID / GUILD_ID
├── deploy-commands.js        one-shot slash-command registration
├── src/
│   ├── index.js              client bootstrap + auto-loading
│   ├── config.js             validated environment config
│   ├── categories.js         CENTRAL CONFIG: categories, intake, statuses
│   ├── db.js                 schema + repository functions
│   ├── transcripts.js        TXT + HTML transcript generation
│   ├── commands/
│   │   ├── setup.js          /setup — per-guild configuration
│   │   └── panel.js          /panel — post the ticket panel
│   └── events/
│       ├── interactionCreate.js   category buttons + all status flows
│       └── messageCreate.js       automated interaction logging
└── README.md                 setup & hosting instructions
```

Run it with `npm install && npm run deploy && npm start`. See `README.md` for
the full Discord Developer Portal walkthrough.
