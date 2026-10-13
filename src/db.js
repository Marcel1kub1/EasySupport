// Uses Node's built-in SQLite module (node:sqlite, Node >= 22.5) so the bot has
// no native dependencies to compile. To move to PostgreSQL later, replace the
// statement definitions in this file — nothing else touches the database.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { TICKET_STATUSES } from './categories.js';

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS guilds (
  guild_id          TEXT PRIMARY KEY,
  staff_role_id     TEXT,
  log_channel_id    TEXT,
  ticket_category_id TEXT,
  max_open_tickets  INTEGER NOT NULL DEFAULT 2,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id         TEXT NOT NULL,
  channel_id       TEXT UNIQUE,
  panel_message_id TEXT,
  user_id          TEXT NOT NULL,
  user_tag         TEXT NOT NULL,
  category         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',
  claimed_by       TEXT,
  opened_at        TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at       TEXT,
  closed_at        TEXT,
  close_reason     TEXT,
  rating           INTEGER
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL,
  author_tag TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blacklist (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_guild_user   ON tickets(guild_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_ticket      ON ticket_messages(ticket_id);
`);

/* ------------------------------- guild config ------------------------------ */

const getGuildStmt = db.prepare('SELECT * FROM guilds WHERE guild_id = ?');

export function getGuild(guildId) {
  return getGuildStmt.get(guildId) ?? null;
}

const upsertGuildStmt = db.prepare(`
  INSERT INTO guilds (guild_id, staff_role_id, log_channel_id, ticket_category_id, max_open_tickets, updated_at)
  VALUES (@guildId, @staffRoleId, @logChannelId, @ticketCategoryId, @maxOpenTickets, datetime('now'))
  ON CONFLICT(guild_id) DO UPDATE SET
    staff_role_id      = excluded.staff_role_id,
    log_channel_id     = excluded.log_channel_id,
    ticket_category_id = excluded.ticket_category_id,
    max_open_tickets   = excluded.max_open_tickets,
    updated_at         = datetime('now')
`);

export function saveGuildSettings({ guildId, staffRoleId, logChannelId, ticketCategoryId, maxOpenTickets }) {
  upsertGuildStmt.run({ guildId, staffRoleId, logChannelId, ticketCategoryId, maxOpenTickets });
}

/* --------------------------------- tickets -------------------------------- */

// Every non-terminal status counts as "open" for the per-user limit. Derived
// from TICKET_STATUSES so new statuses need no change here.
const openStatuses = Object.entries(TICKET_STATUSES)
  .filter(([, meta]) => !meta.terminal)
  .map(([key]) => key);

const countOpenTicketsStmt = db.prepare(`
  SELECT COUNT(*) AS n FROM tickets
  WHERE guild_id = ? AND user_id = ? AND status IN (${openStatuses.length ? openStatuses.map(() => '?').join(', ') : "'__none__'"})
`);

export function countOpenTickets(guildId, userId) {
  return countOpenTicketsStmt.get(guildId, userId, ...openStatuses).n;
}

const nextNumberStmt = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM tickets WHERE guild_id = ?');

export function nextTicketNumber(guildId) {
  return nextNumberStmt.get(guildId).n;
}

const insertTicketStmt = db.prepare(`
  INSERT INTO tickets (guild_id, channel_id, user_id, user_tag, category)
  VALUES (?, ?, ?, ?, ?)
`);

export function createTicket({ guildId, channelId, userId, userTag, category }) {
  const info = insertTicketStmt.run(guildId, channelId, userId, userTag, category);
  return Number(info.lastInsertRowid);
}

const getByChannelStmt = db.prepare('SELECT * FROM tickets WHERE channel_id = ?');

export function getTicketByChannel(channelId) {
  return getByChannelStmt.get(channelId) ?? null;
}

const getByIdStmt = db.prepare('SELECT * FROM tickets WHERE id = ?');

export function getTicketById(ticketId) {
  return getByIdStmt.get(ticketId) ?? null;
}

export function setPanelMessageId(ticketId, messageId) {
  db.prepare('UPDATE tickets SET panel_message_id = ? WHERE id = ?').run(messageId, ticketId);
}

/*
 * Generic status change used by every non-terminal status button.
 * claimedBy is stored (with timestamp) when the status is claimable.
 */
const setStatusStmt = db.prepare(`
  UPDATE tickets
  SET status      = ?,
      claimed_by  = CASE WHEN ? = 1 THEN ? ELSE claimed_by END,
      claimed_at  = CASE WHEN ? = 1 THEN datetime('now') ELSE claimed_at END
  WHERE channel_id = ? AND status != ?
`);

export function updateTicketStatus(channelId, statusKey, claimedBy = null) {
  // node:sqlite binds only number/bigint/string/Buffer/null — a boolean here
  // would throw "cannot be bound to SQLite parameter 2" and crash the process.
  const claim = claimedBy !== null ? 1 : 0;
  return setStatusStmt.run(statusKey, claim, claimedBy, claim, channelId, statusKey).changes > 0;
}

/*
 * Terminal status change: records the closure time and reason. Returns false
 * when the ticket was already in a terminal status (guards double clicks).
 */
const closeStmt = db.prepare(`
  UPDATE tickets SET status = ?, closed_at = datetime('now'), close_reason = ?
  WHERE channel_id = ? AND status != ?
`);

export function closeTicket(channelId, statusKey, reason) {
  return closeStmt.run(statusKey, reason, channelId, statusKey).changes > 0;
}

const rateStmt = db.prepare('UPDATE tickets SET rating = ? WHERE id = ? AND user_id = ?');

export function rateTicket(ticketId, userId, rating) {
  return rateStmt.run(rating, ticketId, userId).changes > 0;
}

/* ------------------------------ interaction log ---------------------------- */

const logMessageStmt = db.prepare(`
  INSERT INTO ticket_messages (ticket_id, author_id, author_tag, content, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

export function logMessage({ ticketId, authorId, authorTag, content, createdAt }) {
  logMessageStmt.run(ticketId, authorId, authorTag, content, createdAt);
}

const getMessagesStmt = db.prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id ASC');

export function getTicketMessages(ticketId) {
  return getMessagesStmt.all(ticketId);
}

/* -------------------------------- blacklist -------------------------------- */

const blacklistStmt = db.prepare('SELECT 1 FROM blacklist WHERE guild_id = ? AND user_id = ?');

export function isBlacklisted(guildId, userId) {
  return blacklistStmt.get(guildId, userId) !== undefined;
}

export function addToBlacklist(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO blacklist (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
}

export function removeFromBlacklist(guildId, userId) {
  db.prepare('DELETE FROM blacklist WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}
