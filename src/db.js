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
const MODULES = ['ticket', 'highrankdm'];

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
