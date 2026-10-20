// MySQL storage (mysql2/promise). Replaces the previous SQLite implementation.
// The public API is intentionally identical so callers only need to `await` the
// now-async repository functions.
import { createPool } from 'mysql2/promise';
import { config } from './config.js';
import { TICKET_STATUSES } from './categories.js';

export const pool = createPool({
  host: config.mysqlHost,
  port: config.mysqlPort,
  user: config.mysqlUser,
  password: config.mysqlPassword,
  database: config.mysqlDatabase,
  connectionLimit: 10,
});

/** Run a query and return the row array. */
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a query and return the first row, or null. */
export async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

/** Run a statement and return the MySQL result object (insertId, changedRows...). */
export async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

/** Execute one or more statements without expecting rows. */
export async function exec(sql) {
  await pool.query(sql);
}

/* Verify connectivity on boot so the process fails fast without a DB. */
export async function connect() {
  await pool.query('SELECT 1');
}

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

export async function initialize() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS guilds (
  guild_id          VARCHAR(255) PRIMARY KEY,
  staff_role_id     VARCHAR(255),
  log_channel_id    VARCHAR(255),
  ticket_category_id VARCHAR(255),
  max_open_tickets  INT NOT NULL DEFAULT 2,
  motm_role_id      VARCHAR(255),
  management_role_id VARCHAR(255),
  enabled_modules   TEXT,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
    `CREATE TABLE IF NOT EXISTS tickets (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  guild_id         VARCHAR(255) NOT NULL,
  channel_id       VARCHAR(255) UNIQUE,
  panel_message_id VARCHAR(255),
  user_id          VARCHAR(255) NOT NULL,
  user_tag         VARCHAR(255) NOT NULL,
  category         VARCHAR(255) NOT NULL,
  status           VARCHAR(255) NOT NULL DEFAULT 'open',
  claimed_by       VARCHAR(255),
  opened_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimed_at       TIMESTAMP NULL,
  closed_at        TIMESTAMP NULL,
  close_reason     TEXT,
  rating           INT
)`,
    `CREATE TABLE IF NOT EXISTS ticket_messages (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id  INT NOT NULL,
  author_id  VARCHAR(255) NOT NULL,
  author_tag VARCHAR(255) NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
)`,
    `CREATE TABLE IF NOT EXISTS blacklist (
  guild_id VARCHAR(255) NOT NULL,
  user_id  VARCHAR(255) NOT NULL,
  PRIMARY KEY (guild_id, user_id)
)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_guild_user   ON tickets(guild_id, user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_ticket      ON ticket_messages(ticket_id)`,
    `CREATE TABLE IF NOT EXISTS system_status (
  id          INT PRIMARY KEY DEFAULT 1,
  status_text VARCHAR(255) NOT NULL DEFAULT 'All systems operational',
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
    `CREATE TABLE IF NOT EXISTS announcements (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  title       VARCHAR(255) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by  VARCHAR(255)
)`,
    /* ---------- guild_settings (107 settings across 10 modules) ---------- */
    `CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id       VARCHAR(255) NOT NULL,
  setting_key    VARCHAR(255) NOT NULL,
  setting_value  TEXT,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, setting_key)
)`,
    /* ---------- role_permissions ---------- */
    `CREATE TABLE IF NOT EXISTS role_permissions (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  guild_id     VARCHAR(255) NOT NULL,
  role_id      VARCHAR(255) NOT NULL,
  command_name VARCHAR(255) NOT NULL,
  allowed      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_perm (guild_id, role_id, command_name)
)`,
    /* ---------- moderation ---------- */
    `CREATE TABLE IF NOT EXISTS moderation_warnings (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  guild_id     VARCHAR(255) NOT NULL,
  user_id      VARCHAR(255) NOT NULL,
  moderator_id VARCHAR(255) NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    `CREATE TABLE IF NOT EXISTS moderation_mutes (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  guild_id     VARCHAR(255) NOT NULL,
  user_id      VARCHAR(255) NOT NULL,
  moderator_id VARCHAR(255) NOT NULL,
  reason       TEXT,
  expires_at   TIMESTAMP NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    `CREATE TABLE IF NOT EXISTS moderation_bans (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  guild_id     VARCHAR(255) NOT NULL,
  user_id      VARCHAR(255) NOT NULL,
  moderator_id VARCHAR(255) NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    /* ---------- anti_nuke ---------- */
    `CREATE TABLE IF NOT EXISTS anti_nuke_config (
  guild_id             VARCHAR(255) PRIMARY KEY,
  enabled              BOOLEAN NOT NULL DEFAULT FALSE,
  max_channels_per_min INT NOT NULL DEFAULT 5,
  max_roles_per_min    INT NOT NULL DEFAULT 5,
  max_bans_per_min     INT NOT NULL DEFAULT 5,
  punishment           ENUM('none','kick','ban') NOT NULL DEFAULT 'kick',
  whitelisted_roles    TEXT,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
    `CREATE TABLE IF NOT EXISTS anti_nuke_logs (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  guild_id    VARCHAR(255) NOT NULL,
  action_type VARCHAR(255) NOT NULL,
  target_id   VARCHAR(255) NOT NULL,
  executor_id VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    /* ---------- automod ---------- */
    `CREATE TABLE IF NOT EXISTS automod_config (
  guild_id      VARCHAR(255) PRIMARY KEY,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  anti_invite   BOOLEAN NOT NULL DEFAULT FALSE,
  anti_link     BOOLEAN NOT NULL DEFAULT FALSE,
  anti_spam     BOOLEAN NOT NULL DEFAULT FALSE,
  anti_caps     BOOLEAN NOT NULL DEFAULT FALSE,
  punishment    ENUM('none','delete','mute','kick') NOT NULL DEFAULT 'delete',
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
    `CREATE TABLE IF NOT EXISTS automod_violations (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  guild_id    VARCHAR(255) NOT NULL,
  user_id     VARCHAR(255) NOT NULL,
  rule_type   VARCHAR(255) NOT NULL,
  message_id  VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    /* ---------- leveling ---------- */
    `CREATE TABLE IF NOT EXISTS leveling_users (
  guild_id VARCHAR(255) NOT NULL,
  user_id  VARCHAR(255) NOT NULL,
  xp       INT NOT NULL DEFAULT 0,
  level    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
)`,
    /* ---------- economy ---------- */
    `CREATE TABLE IF NOT EXISTS economy_users (
  guild_id VARCHAR(255) NOT NULL,
  user_id  VARCHAR(255) NOT NULL,
  balance  BIGINT NOT NULL DEFAULT 0,
  bank     BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
)`,
    /* ---------- giveaways ---------- */
    `CREATE TABLE IF NOT EXISTS giveaways (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  guild_id     VARCHAR(255) NOT NULL,
  channel_id   VARCHAR(255) NOT NULL,
  message_id   VARCHAR(255) NOT NULL,
  prize        TEXT NOT NULL,
  winner_count INT NOT NULL DEFAULT 1,
  ends_at      TIMESTAMP NOT NULL,
  ended        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    /* ---------- vouches ---------- */
    `CREATE TABLE IF NOT EXISTS vouches (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  guild_id   VARCHAR(255) NOT NULL,
  user_id    VARCHAR(255) NOT NULL,
  vouched_by VARCHAR(255) NOT NULL,
  message    TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    /* ---------- welcome_goodbye_boost ---------- */
    `CREATE TABLE IF NOT EXISTS welcome_goodbye_boost_config (
  guild_id           VARCHAR(255) PRIMARY KEY,
  welcome_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  welcome_channel_id VARCHAR(255),
  welcome_message    TEXT,
  goodbye_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  goodbye_channel_id VARCHAR(255),
  goodbye_message    TEXT,
  boost_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  boost_channel_id   VARCHAR(255),
  boost_message      TEXT,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
    /* ---------- logging ---------- */
    `CREATE TABLE IF NOT EXISTS logging_config (
  guild_id             VARCHAR(255) PRIMARY KEY,
  mod_log_channel_id   VARCHAR(255),
  ticket_log_channel_id VARCHAR(255),
  message_log_channel_id VARCHAR(255),
  voice_log_channel_id VARCHAR(255),
  member_log_channel_id VARCHAR(255),
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_guild_user   ON tickets(guild_id, user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_ticket      ON ticket_messages(ticket_id)`,
    `CREATE INDEX IF NOT EXISTS idx_warnings_guild_user  ON moderation_warnings(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_mutes_guild_user     ON moderation_mutes(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bans_guild_user      ON moderation_bans(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_violations_guild_user ON automod_violations(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_leveling_guild_user  ON leveling_users(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_economy_guild_user   ON economy_users(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vouches_guild_user   ON vouches(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_giveaways_guild      ON giveaways(guild_id)`,
    `CREATE INDEX IF NOT EXISTS idx_role_perm_guild      ON role_permissions(guild_id)`,
    `CREATE INDEX IF NOT EXISTS idx_settings_guild       ON guild_settings(guild_id)`,
  ];
  for (const sql of statements) {
    await pool.query(sql);
  }

  // Idempotent column additions for databases created by earlier versions:
  for (const migration of [
    'ALTER TABLE tickets ADD COLUMN closed_by VARCHAR(255)',
    'ALTER TABLE guilds ADD COLUMN motm_role_id VARCHAR(255)',
    'ALTER TABLE guilds ADD COLUMN management_role_id VARCHAR(255)',
    'ALTER TABLE guilds ADD COLUMN enabled_modules TEXT',
  ]) {
    try {
      await pool.query(migration);
    } catch {
      /* column already exists */
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Migration runner                                                           */
/* -------------------------------------------------------------------------- */

/** Idempotent migration runner. Safe to call on every boot. */
export async function migrate() {
  const statements = [
    /* guild_settings */
    `CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id       VARCHAR(255) NOT NULL,
  setting_key    VARCHAR(255) NOT NULL,
  setting_value  TEXT,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, setting_key)
)`,
    /* role_permissions */
    `CREATE TABLE IF NOT EXISTS role_permissions (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  guild_id     VARCHAR(255) NOT NULL,
  role_id      VARCHAR(255) NOT NULL,
  command_name VARCHAR(255) NOT NULL,
  allowed      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_perm (guild_id, role_id, command_name)
)`,
    /* moderation */
    `CREATE TABLE IF NOT EXISTS moderation_warnings (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  guild_id     VARCHAR(255) NOT NULL,
  user_id      VARCHAR(255) NOT NULL,
  moderator_id VARCHAR(255) NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    `CREATE TABLE IF NOT EXISTS moderation_mutes (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  guild_id     VARCHAR(255) NOT NULL,
  user_id      VARCHAR(255) NOT NULL,
  moderator_id VARCHAR(255) NOT NULL,
  reason       TEXT,
  expires_at   TIMESTAMP NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    `CREATE TABLE IF NOT EXISTS moderation_bans (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  guild_id     VARCHAR(255) NOT NULL,
  user_id      VARCHAR(255) NOT NULL,
  moderator_id VARCHAR(255) NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    /* anti_nuke */
    `CREATE TABLE IF NOT EXISTS anti_nuke_config (
  guild_id             VARCHAR(255) PRIMARY KEY,
  enabled              BOOLEAN NOT NULL DEFAULT FALSE,
  max_channels_per_min INT NOT NULL DEFAULT 5,
  max_roles_per_min    INT NOT NULL DEFAULT 5,
  max_bans_per_min     INT NOT NULL DEFAULT 5,
  punishment           ENUM('none','kick','ban') NOT NULL DEFAULT 'kick',
  whitelisted_roles    TEXT,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
    `CREATE TABLE IF NOT EXISTS anti_nuke_logs (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  guild_id    VARCHAR(255) NOT NULL,
  action_type VARCHAR(255) NOT NULL,
  target_id   VARCHAR(255) NOT NULL,
  executor_id VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    /* automod */
    `CREATE TABLE IF NOT EXISTS automod_config (
  guild_id      VARCHAR(255) PRIMARY KEY,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  anti_invite   BOOLEAN NOT NULL DEFAULT FALSE,
  anti_link     BOOLEAN NOT NULL DEFAULT FALSE,
  anti_spam     BOOLEAN NOT NULL DEFAULT FALSE,
  anti_caps     BOOLEAN NOT NULL DEFAULT FALSE,
  punishment    ENUM('none','delete','mute','kick') NOT NULL DEFAULT 'delete',
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
    `CREATE TABLE IF NOT EXISTS automod_violations (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  guild_id    VARCHAR(255) NOT NULL,
  user_id     VARCHAR(255) NOT NULL,
  rule_type   VARCHAR(255) NOT NULL,
  message_id  VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    /* leveling */
    `CREATE TABLE IF NOT EXISTS leveling_users (
  guild_id VARCHAR(255) NOT NULL,
  user_id  VARCHAR(255) NOT NULL,
  xp       INT NOT NULL DEFAULT 0,
  level    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
)`,
    /* economy */
    `CREATE TABLE IF NOT EXISTS economy_users (
  guild_id VARCHAR(255) NOT NULL,
  user_id  VARCHAR(255) NOT NULL,
  balance  BIGINT NOT NULL DEFAULT 0,
  bank     BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
)`,
    /* giveaways */
    `CREATE TABLE IF NOT EXISTS giveaways (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  guild_id     VARCHAR(255) NOT NULL,
  channel_id   VARCHAR(255) NOT NULL,
  message_id   VARCHAR(255) NOT NULL,
  prize        TEXT NOT NULL,
  winner_count INT NOT NULL DEFAULT 1,
  ends_at      TIMESTAMP NOT NULL,
  ended        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    /* vouches */
    `CREATE TABLE IF NOT EXISTS vouches (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  guild_id   VARCHAR(255) NOT NULL,
  user_id    VARCHAR(255) NOT NULL,
  vouched_by VARCHAR(255) NOT NULL,
  message    TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    /* welcome_goodbye_boost */
    `CREATE TABLE IF NOT EXISTS welcome_goodbye_boost_config (
  guild_id           VARCHAR(255) PRIMARY KEY,
  welcome_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  welcome_channel_id VARCHAR(255),
  welcome_message    TEXT,
  goodbye_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  goodbye_channel_id VARCHAR(255),
  goodbye_message    TEXT,
  boost_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  boost_channel_id   VARCHAR(255),
  boost_message      TEXT,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
    /* logging */
    `CREATE TABLE IF NOT EXISTS logging_config (
  guild_id             VARCHAR(255) PRIMARY KEY,
  mod_log_channel_id   VARCHAR(255),
  ticket_log_channel_id VARCHAR(255),
  message_log_channel_id VARCHAR(255),
  voice_log_channel_id VARCHAR(255),
  member_log_channel_id VARCHAR(255),
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
    /* indexes */
    `CREATE INDEX IF NOT EXISTS idx_warnings_guild_user  ON moderation_warnings(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_mutes_guild_user     ON moderation_mutes(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bans_guild_user      ON moderation_bans(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_violations_guild_user ON automod_violations(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_leveling_guild_user  ON leveling_users(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_economy_guild_user   ON economy_users(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vouches_guild_user   ON vouches(guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_giveaways_guild      ON giveaways(guild_id)`,
    `CREATE INDEX IF NOT EXISTS idx_role_perm_guild      ON role_permissions(guild_id)`,
    `CREATE INDEX IF NOT EXISTS idx_settings_guild       ON guild_settings(guild_id)`,
  ];
  for (const sql of statements) {
    await pool.query(sql);
  }
}

/* ------------------------------- guild config ------------------------------ */

const getGuildStmt = 'SELECT * FROM guilds WHERE guild_id = ?';

export async function getGuild(guildId) {
  return get(getGuildStmt, [guildId]) ?? null;
}

const upsertGuildStmt = `
INSERT INTO guilds (guild_id, staff_role_id, log_channel_id, ticket_category_id, max_open_tickets, motm_role_id, management_role_id, enabled_modules, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
ON DUPLICATE KEY UPDATE
  staff_role_id      = VALUES(staff_role_id),
  log_channel_id     = VALUES(log_channel_id),
  ticket_category_id = VALUES(ticket_category_id),
  max_open_tickets   = VALUES(max_open_tickets),
  motm_role_id       = VALUES(motm_role_id),
  management_role_id = VALUES(management_role_id),
  enabled_modules    = VALUES(enabled_modules),
  updated_at         = NOW()
`;

export async function saveGuildSettings({ guildId, staffRoleId, logChannelId, ticketCategoryId, maxOpenTickets, motmRoleId, managementRoleId, enabledModules }) {
  await run(upsertGuildStmt, [guildId, staffRoleId, logChannelId, ticketCategoryId, maxOpenTickets, motmRoleId ?? null, managementRoleId ?? null, enabledModules ?? null]);
}

/* --------------------------------- tickets -------------------------------- */

// Every non-terminal status counts as "open" for the per-user limit. Derived
// from TICKET_STATUSES so new statuses need no change here.
const openStatuses = Object.entries(TICKET_STATUSES)
  .filter(([, meta]) => !meta.terminal)
  .map(([key]) => key);

const countOpenTicketsStmt = `
SELECT COUNT(*) AS n FROM tickets
WHERE guild_id = ? AND user_id = ? AND status IN (${openStatuses.length ? openStatuses.map(() => '?').join(', ') : "'__none__'"})
`;

export async function countOpenTickets(guildId, userId) {
  const row = await get(countOpenTicketsStmt, [guildId, userId, ...openStatuses]);
  return Number(row?.n ?? 0);
}

/** Every open ticket in the guild regardless of user — drives quiet-queue bonus. */
const countAllOpenStmt = `
SELECT COUNT(*) AS n FROM tickets
WHERE guild_id = ? AND status IN (${openStatuses.length ? openStatuses.map(() => '?').join(', ') : "'__none__'"})
`;

export async function countAllOpenTickets(guildId) {
  const row = await get(countAllOpenStmt, [guildId, ...openStatuses]);
  return Number(row?.n ?? 0);
}

const nextNumberStmt = 'SELECT COALESCE(MAX(id), 0) + 1 AS n FROM tickets WHERE guild_id = ?';

export async function nextTicketNumber(guildId) {
  const row = await get(nextNumberStmt, [guildId]);
  return Number(row?.n ?? 1);
}

const insertTicketStmt = `
INSERT INTO tickets (guild_id, channel_id, user_id, user_tag, category)
VALUES (?, ?, ?, ?, ?)
`;

export async function createTicket({ guildId, channelId, userId, userTag, category }) {
  const result = await run(insertTicketStmt, [guildId, channelId, userId, userTag, category]);
  return Number(result.insertId);
}

const getByChannelStmt = 'SELECT * FROM tickets WHERE channel_id = ?';

export async function getTicketByChannel(channelId) {
  return get(getByChannelStmt, [channelId]);
}

const getByIdStmt = 'SELECT * FROM tickets WHERE id = ?';

export async function getTicketById(ticketId) {
  return get(getByIdStmt, [ticketId]);
}

export async function setPanelMessageId(ticketId, messageId) {
  await run('UPDATE tickets SET panel_message_id = ? WHERE id = ?', [messageId, ticketId]);
}

/*
 * Generic status change used by every non-terminal status button.
 * claimedBy is stored (with timestamp) when the status is claimable.
 */
const setStatusStmt = `
UPDATE tickets
SET status      = ?,
    claimed_by  = CASE WHEN ? = 1 THEN ? ELSE claimed_by END,
    claimed_at  = CASE WHEN ? = 1 THEN NOW() ELSE claimed_at END
WHERE channel_id = ? AND status != ?
`;

export async function updateTicketStatus(channelId, statusKey, claimedBy = null) {
  const claim = claimedBy !== null ? 1 : 0;
  const result = await run(setStatusStmt, [statusKey, claim, claimedBy, claim, channelId, statusKey]);
  return result.changedRows > 0;
}

/*
 * Terminal status change: records the closure time, reason and the staff member
 * who closed it (staff payouts are credited to `closedBy`). Returns false when
 * the ticket was already in a terminal status (guards double clicks).
 */
const closeStmt = `
UPDATE tickets SET status = ?, closed_at = NOW(), close_reason = ?, closed_by = ?
WHERE channel_id = ? AND status != ?
`;

export async function closeTicket(channelId, statusKey, reason, closedBy = null) {
  const result = await run(closeStmt, [statusKey, reason, closedBy, channelId, statusKey]);
  return result.changedRows > 0;
}

/* ----------------------------- staff statistics ----------------------------- */

const staffStatsStmt = `
SELECT closed_by AS user_id,
       COUNT(*) AS closed,
       SUM(CASE WHEN close_reason IS NOT NULL AND close_reason != '' THEN 1 ELSE 0 END) AS reasoned,
       SUM(rating) AS rating_sum,
       SUM(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) AS rated
FROM tickets
WHERE guild_id = ? AND closed_by IS NOT NULL AND DATE_FORMAT(closed_at, '%Y-%m') = ?
GROUP BY closed_by
ORDER BY reasoned DESC, closed DESC
`;

/** Per-staff closure stats for one month ('YYYY-MM'), best closer first. */
export async function staffStats(guildId, period) {
  const rows = await query(staffStatsStmt, [guildId, period]);
  return rows.map((row) => ({
    userId: row.user_id,
    closed: row.closed ?? 0,
    reasoned: row.reasoned ?? 0,
    ratingSum: row.rating_sum ?? 0,
    rated: row.rated ?? 0,
    averageRating: row.rated ? Math.round((Number(row.rating_sum) / Number(row.rated)) * 10) / 10 : null,
  }));
}

const rateStmt = 'UPDATE tickets SET rating = ? WHERE id = ? AND user_id = ?';

export async function rateTicket(ticketId, userId, rating) {
  const result = await run(rateStmt, [rating, ticketId, userId]);
  return result.changedRows > 0;
}

/* ------------------------------ interaction log ---------------------------- */

const logMessageStmt = `
INSERT INTO ticket_messages (ticket_id, author_id, author_tag, content, created_at)
VALUES (?, ?, ?, ?, ?)
`;

export async function logMessage({ ticketId, authorId, authorTag, content, createdAt }) {
  await run(logMessageStmt, [ticketId, authorId, authorTag, content, createdAt]);
}

const getMessagesStmt = 'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id ASC';

export async function getTicketMessages(ticketId) {
  return query(getMessagesStmt, [ticketId]);
}

/* -------------------------------- blacklist -------------------------------- */

const blacklistStmt = 'SELECT 1 FROM blacklist WHERE guild_id = ? AND user_id = ?';

export async function isBlacklisted(guildId, userId) {
  const row = await get(blacklistStmt, [guildId, userId]);
  return row !== undefined;
}

export async function addToBlacklist(guildId, userId) {
  await run('INSERT IGNORE INTO blacklist (guild_id, user_id) VALUES (?, ?)', [guildId, userId]);
}

export async function removeFromBlacklist(guildId, userId) {
  await run('DELETE FROM blacklist WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
}

/* ------------------------------- module toggles ---------------------------- */

/** Module names recognized by the system. */
const MODULES = [
  'tickets',
  'moderation',
  'anti_nuke',
  'automod',
  'leveling',
  'economy',
  'giveaways',
  'vouches',
  'welcome_goodbye_boost',
  'logging',
];

/** Resolve the enabled_modules JSON array for a guild. NULL means all enabled. */
async function getEnabledModules(guildId) {
  const row = await get('SELECT enabled_modules FROM guilds WHERE guild_id = ?', [guildId]);
  if (!row || row.enabled_modules == null) return null;
  try {
    return JSON.parse(row.enabled_modules);
  } catch {
    return null;
  }
}

/** Check whether a module is enabled for a guild. Defaults to enabled. */
export async function isModuleEnabled(guildId, module) {
  const enabled = await getEnabledModules(guildId);
  if (enabled === null) return true;
  return enabled.includes(module);
}

/** Enable or disable a module for a guild. */
export async function setModuleEnabled(guildId, module, enabled) {
  if (!MODULES.includes(module)) return;
  const current = await getEnabledModules(guildId);
  let next;
  if (enabled) {
    next = current === null ? [...MODULES] : [...new Set([...current, module])];
  } else {
    next = current === null ? MODULES.filter((m) => m !== module) : current.filter((m) => m !== module);
  }
  await run('UPDATE guilds SET enabled_modules = ? WHERE guild_id = ?', [JSON.stringify(next), guildId]);
}

/* ------------------------------- management role --------------------------- */

export async function getManagementRole(guildId) {
  const row = await get('SELECT management_role_id FROM guilds WHERE guild_id = ?', [guildId]);
  return row?.management_role_id ?? null;
}

export async function setManagementRole(guildId, roleId) {
  await run('UPDATE guilds SET management_role_id = ? WHERE guild_id = ?', [roleId ?? null, guildId]);
}

/* ------------------------------- website data ------------------------------ */

export async function getSystemStatus() {
  return get('SELECT * FROM system_status WHERE id = 1', []);
}

export async function setSystemStatus(statusText) {
  await run(`
    INSERT INTO system_status (id, status_text, updated_at) VALUES (1, ?, NOW())
    ON DUPLICATE KEY UPDATE status_text = VALUES(status_text), updated_at = NOW()
  `, [statusText]);
}

export async function setSystemStatusWithAnnouncement(statusText, createdBy) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    try {
      await connection.execute(`
        INSERT INTO system_status (id, status_text, updated_at) VALUES (1, ?, NOW())
        ON DUPLICATE KEY UPDATE status_text = VALUES(status_text), updated_at = NOW()
      `, [statusText]);
      await connection.execute(
        'INSERT INTO announcements (title, content, created_by) VALUES (?, ?, ?)',
        ['System status updated', statusText, createdBy]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    connection.release();
  }
}

export async function getAnnouncements() {
  return query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 10');
}

export async function createAnnouncement(title, content, createdBy) {
  await run('INSERT INTO announcements (title, content, created_by) VALUES (?, ?, ?)', [title, content, createdBy]);
}

export async function getGuildStats() {
  const rows = await query(`
    SELECT g.guild_id,
           COUNT(t.id) AS total,
           SUM(CASE WHEN t.status != 'closed' THEN 1 ELSE 0 END) AS open,
           SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) AS closed,
           AVG(CASE WHEN t.rating IS NOT NULL THEN t.rating END) AS avgRating
    FROM guilds g
    LEFT JOIN tickets t ON t.guild_id = g.guild_id
    GROUP BY g.guild_id
    ORDER BY total DESC
  `);
  return rows;
}

export async function getRecentClosures(limit = 10) {
  const rows = await query(`
    SELECT id, guild_id, user_tag, category, closed_at, close_reason, rating
    FROM tickets
    WHERE status = 'closed' AND closed_at IS NOT NULL
    ORDER BY closed_at DESC
    LIMIT ?
  `, [limit]);
  return rows;
}

/* ---------------------------------- dump ---------------------------------- */

/** Build a plain SQL dump of every table for the /export backup command. */
export async function dumpDatabase() {
  const tables = ['guilds', 'tickets', 'ticket_messages', 'blacklist'];
  const parts = [`-- EasySupport database dump -- generated ${new Date().toISOString()}\n`];
  for (const table of tables) {
    const rows = await query(`SELECT * FROM \`${table}\``);
    parts.push(`-- Table: ${table}`);
    parts.push(`DELETE FROM \`${table}\`;`);
    for (const row of rows) {
      const cols = Object.keys(row).map((c) => `\`${c}\``).join(', ');
      const vals = Object.values(row).map((v) => mysqlValue(v)).join(', ');
      parts.push(`INSERT INTO \`${table}\` (${cols}) VALUES (${vals});`);
    }
    parts.push('');
  }
  return parts.join('\n');
}

function mysqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  const s = String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${s}'`;
}

/* ---------------------------------- guild_settings ---------------------------------- */

export async function getSetting(guildId, key) {
  const row = await get('SELECT setting_value FROM guild_settings WHERE guild_id = ? AND setting_key = ?', [guildId, key]);
  return row?.setting_value ?? null;
}

export async function setSetting(guildId, key, value) {
  await run(`
    INSERT INTO guild_settings (guild_id, setting_key, setting_value, updated_at) VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
  `, [guildId, key, value]);
}

export async function deleteSetting(guildId, key) {
  await run('DELETE FROM guild_settings WHERE guild_id = ? AND setting_key = ?', [guildId, key]);
}

export async function getAllSettings(guildId) {
  return query('SELECT setting_key, setting_value FROM guild_settings WHERE guild_id = ?', [guildId]);
}

/**
 * Get all settings for a guild as a key/value object.
 */
export async function getGuildSettings(guildId) {
  const rows = await query('SELECT setting_key, setting_value FROM guild_settings WHERE guild_id = ?', [guildId]);
  const settings = {};
  for (const row of rows) {
    settings[row.setting_key] = row.setting_value;
  }
  return settings;
}

/**
 * Set a single guild setting.
 */
export async function setGuildSetting(guildId, key, value) {
  await run(`
    INSERT INTO guild_settings (guild_id, setting_key, setting_value, updated_at) VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
  `, [guildId, key, value]);
}

/**
 * Bulk update multiple guild settings in a single transaction.
 */
export async function bulkUpdateGuildSettings(guildId, settings) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const [key, value] of Object.entries(settings)) {
      await connection.execute(`
        INSERT INTO guild_settings (guild_id, setting_key, setting_value, updated_at) VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
      `, [guildId, key, value]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/* ---------------------------------- role_permissions ---------------------------------- */

export async function getRolePermission(guildId, roleId, commandName) {
  const row = await get('SELECT allowed FROM role_permissions WHERE guild_id = ? AND role_id = ? AND command_name = ?', [guildId, roleId, commandName]);
  return row?.allowed ?? true;
}

export async function setRolePermission(guildId, roleId, commandName, allowed) {
  await run(`
    INSERT INTO role_permissions (guild_id, role_id, command_name, allowed, updated_at) VALUES (?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = NOW()
  `, [guildId, roleId, commandName, allowed]);
}

export async function deleteRolePermission(guildId, roleId, commandName) {
  await run('DELETE FROM role_permissions WHERE guild_id = ? AND role_id = ? AND command_name = ?', [guildId, roleId, commandName]);
}

export async function getRolePermissions(guildId, roleId) {
  return query('SELECT command_name, allowed FROM role_permissions WHERE guild_id = ? AND role_id = ?', [guildId, roleId]);
}

export async function getAllRolePermissions(guildId) {
  return query('SELECT role_id, command_name, allowed FROM role_permissions WHERE guild_id = ?', [guildId]);
}

/* ---------------------------------- moderation ---------------------------------- */

export async function createWarning(guildId, userId, moderatorId, reason) {
  const result = await run('INSERT INTO moderation_warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)', [guildId, userId, moderatorId, reason]);
  return result.insertId;
}

export async function getWarnings(guildId, userId) {
  return query('SELECT * FROM moderation_warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [guildId, userId]);
}

export async function deleteWarning(warningId) {
  await run('DELETE FROM moderation_warnings WHERE id = ?', [warningId]);
}

export async function createMute(guildId, userId, moderatorId, reason, expiresAt) {
  const result = await run('INSERT INTO moderation_mutes (guild_id, user_id, moderator_id, reason, expires_at) VALUES (?, ?, ?, ?, ?)', [guildId, userId, moderatorId, reason, expiresAt]);
  return result.insertId;
}

export async function getMutes(guildId, userId) {
  return query('SELECT * FROM moderation_mutes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [guildId, userId]);
}

export async function deleteMute(muteId) {
  await run('DELETE FROM moderation_mutes WHERE id = ?', [muteId]);
}

export async function createBan(guildId, userId, moderatorId, reason) {
  const result = await run('INSERT INTO moderation_bans (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)', [guildId, userId, moderatorId, reason]);
  return result.insertId;
}

export async function getBans(guildId, userId) {
  return query('SELECT * FROM moderation_bans WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [guildId, userId]);
}

export async function deleteBan(banId) {
  await run('DELETE FROM moderation_bans WHERE id = ?', [banId]);
}

/* ---------------------------------- anti_nuke ---------------------------------- */

export async function getAntiNukeConfig(guildId) {
  const row = await get('SELECT * FROM anti_nuke_config WHERE guild_id = ?', [guildId]);
  if (!row) return null;
  return {
    ...row,
    whitelisted_roles: row.whitelisted_roles ? JSON.parse(row.whitelisted_roles) : [],
  };
}

export async function setAntiNukeConfig(guildId, config) {
  await run(`
    INSERT INTO anti_nuke_config (guild_id, enabled, max_channels_per_min, max_roles_per_min, max_bans_per_min, punishment, whitelisted_roles, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), max_channels_per_min = VALUES(max_channels_per_min), max_roles_per_min = VALUES(max_roles_per_min), max_bans_per_min = VALUES(max_bans_per_min), punishment = VALUES(punishment), whitelisted_roles = VALUES(whitelisted_roles), updated_at = NOW()
  `, [guildId, config.enabled ?? false, config.max_channels_per_min ?? 5, config.max_roles_per_min ?? 5, config.max_bans_per_min ?? 5, config.punishment ?? 'kick', JSON.stringify(config.whitelisted_roles ?? [])]);
}

export async function createAntiNukeLog(guildId, actionType, targetId, executorId) {
  const result = await run('INSERT INTO anti_nuke_logs (guild_id, action_type, target_id, executor_id) VALUES (?, ?, ?, ?)', [guildId, actionType, targetId, executorId]);
  return result.insertId;
}

export async function getAntiNukeLogs(guildId, limit = 50) {
  return query('SELECT * FROM anti_nuke_logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?', [guildId, limit]);
}

/* ---------------------------------- automod ---------------------------------- */

export async function getAutomodConfig(guildId) {
  const row = await get('SELECT * FROM automod_config WHERE guild_id = ?', [guildId]);
  return row ?? null;
}

export async function setAutomodConfig(guildId, config) {
  await run(`
    INSERT INTO automod_config (guild_id, enabled, anti_invite, anti_link, anti_spam, anti_caps, punishment, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), anti_invite = VALUES(anti_invite), anti_link = VALUES(anti_link), anti_spam = VALUES(anti_spam), anti_caps = VALUES(anti_caps), punishment = VALUES(punishment), updated_at = NOW()
  `, [guildId, config.enabled ?? false, config.anti_invite ?? false, config.anti_link ?? false, config.anti_spam ?? false, config.anti_caps ?? false, config.punishment ?? 'delete']);
}

export async function createAutomodViolation(guildId, userId, ruleType, messageId) {
  const result = await run('INSERT INTO automod_violations (guild_id, user_id, rule_type, message_id) VALUES (?, ?, ?, ?)', [guildId, userId, ruleType, messageId]);
  return result.insertId;
}

export async function getAutomodViolations(guildId, userId) {
  return query('SELECT * FROM automod_violations WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [guildId, userId]);
}

/* ---------------------------------- leveling ---------------------------------- */

export async function getLevelingUser(guildId, userId) {
  const row = await get('SELECT * FROM leveling_users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  return row ?? null;
}

export async function setLevelingUser(guildId, userId, xp, level) {
  await run(`
    INSERT INTO leveling_users (guild_id, user_id, xp, level) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE xp = VALUES(xp), level = VALUES(level)
  `, [guildId, userId, xp, level]);
}

export async function addXp(guildId, userId, xpAmount) {
  const row = await getLevelingUser(guildId, userId);
  if (!row) {
    await setLevelingUser(guildId, userId, xpAmount, 0);
    return { xp: xpAmount, level: 0 };
  }
  const newXp = row.xp + xpAmount;
  const newLevel = Math.floor(Math.sqrt(newXp / 100));
  await setLevelingUser(guildId, userId, newXp, newLevel);
  return { xp: newXp, level: newLevel };
}

/* ---------------------------------- economy ---------------------------------- */

export async function getEconomyUser(guildId, userId) {
  const row = await get('SELECT * FROM economy_users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  return row ?? null;
}

export async function setEconomyUser(guildId, userId, balance, bank) {
  await run(`
    INSERT INTO economy_users (guild_id, user_id, balance, bank) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE balance = VALUES(balance), bank = VALUES(bank)
  `, [guildId, userId, balance, bank]);
}

export async function addBalance(guildId, userId, amount) {
  const row = await getEconomyUser(guildId, userId);
  if (!row) {
    await setEconomyUser(guildId, userId, amount, 0);
    return { balance: amount, bank: 0 };
  }
  const newBalance = row.balance + amount;
  await setEconomyUser(guildId, userId, newBalance, row.bank);
  return { balance: newBalance, bank: row.bank };
}

/* ---------------------------------- giveaways ---------------------------------- */

export async function createGiveaway(guildId, channelId, messageId, prize, winnerCount, endsAt, createdBy) {
  const result = await run('INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winner_count, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [guildId, channelId, messageId, prize, winnerCount, endsAt, createdBy]);
  return result.insertId;
}

export async function getGiveaway(messageId) {
  return get('SELECT * FROM giveaways WHERE message_id = ?', [messageId]);
}

export async function getGiveaways(guildId) {
  return query('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY created_at DESC', [guildId]);
}

export async function endGiveaway(messageId) {
  await run('UPDATE giveaways SET ended = TRUE WHERE message_id = ?', [messageId]);
}

export async function deleteGiveaway(messageId) {
  await run('DELETE FROM giveaways WHERE message_id = ?', [messageId]);
}

/* ---------------------------------- vouches ---------------------------------- */

export async function createVouch(guildId, userId, vouchedBy, message) {
  const result = await run('INSERT INTO vouches (guild_id, user_id, vouched_by, message) VALUES (?, ?, ?, ?)', [guildId, userId, vouchedBy, message]);
  return result.insertId;
}

export async function getVouches(guildId, userId) {
  return query('SELECT * FROM vouches WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC', [guildId, userId]);
}

/* ---------------------------------- welcome_goodbye_boost ---------------------------------- */

export async function getWelcomeGoodbyeBoostConfig(guildId) {
  const row = await get('SELECT * FROM welcome_goodbye_boost_config WHERE guild_id = ?', [guildId]);
  return row ?? null;
}

export async function setWelcomeGoodbyeBoostConfig(guildId, config) {
  await run(`
    INSERT INTO welcome_goodbye_boost_config (guild_id, welcome_enabled, welcome_channel_id, welcome_message, goodbye_enabled, goodbye_channel_id, goodbye_message, boost_enabled, boost_channel_id, boost_message, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE welcome_enabled = VALUES(welcome_enabled), welcome_channel_id = VALUES(welcome_channel_id), welcome_message = VALUES(welcome_message), goodbye_enabled = VALUES(goodbye_enabled), goodbye_channel_id = VALUES(goodbye_channel_id), goodbye_message = VALUES(goodbye_message), boost_enabled = VALUES(boost_enabled), boost_channel_id = VALUES(boost_channel_id), boost_message = VALUES(boost_message), updated_at = NOW()
  `, [guildId, config.welcome_enabled ?? false, config.welcome_channel_id ?? null, config.welcome_message ?? null, config.goodbye_enabled ?? false, config.goodbye_channel_id ?? null, config.goodbye_message ?? null, config.boost_enabled ?? false, config.boost_channel_id ?? null, config.boost_message ?? null]);
}

/* ---------------------------------- logging ---------------------------------- */

export async function getLoggingConfig(guildId) {
  const row = await get('SELECT * FROM logging_config WHERE guild_id = ?', [guildId]);
  return row ?? null;
}

export async function setLoggingConfig(guildId, config) {
  await run(`
    INSERT INTO logging_config (guild_id, mod_log_channel_id, ticket_log_channel_id, message_log_channel_id, voice_log_channel_id, member_log_channel_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE mod_log_channel_id = VALUES(mod_log_channel_id), ticket_log_channel_id = VALUES(ticket_log_channel_id), message_log_channel_id = VALUES(message_log_channel_id), voice_log_channel_id = VALUES(voice_log_channel_id), member_log_channel_id = VALUES(member_log_channel_id), updated_at = NOW()
  `, [guildId, config.mod_log_channel_id ?? null, config.ticket_log_channel_id ?? null, config.message_log_channel_id ?? null, config.voice_log_channel_id ?? null, config.member_log_channel_id ?? null]);
}
