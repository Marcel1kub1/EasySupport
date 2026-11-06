import { pool } from './db.js';
import { config } from './config.js';

/**
 * Delete data older than the configured retention period.
 * Safe to call on every boot and periodically thereafter.
 *
 * Tables cleaned:
 *   - tickets: closed tickets older than retention days
 *   - ticket_messages: messages belonging to deleted tickets (cascade)
 *   - moderation_warnings, moderation_mutes, moderation_bans
 *   - automod_violations
 *   - anti_nuke_logs
 *   - vouches
 *   - giveaways (ended only)
 */
export async function runRetentionCleanup(retentionDays = config.dataRetentionDays) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');

  const results = {};

  // Closed tickets older than retention
  const [ticketRes] = await pool.query(
    `DELETE FROM tickets WHERE status = 'closed' AND closed_at IS NOT NULL AND closed_at < ?`,
    [cutoffStr]
  );
  results.tickets = ticketRes.affectedRows ?? 0;

  // moderation_warnings
  const [warnRes] = await pool.query(
    'DELETE FROM moderation_warnings WHERE created_at < ?',
    [cutoffStr]
  );
  results.warnings = warnRes.affectedRows ?? 0;

  // moderation_mutes (also remove expired ones)
  const [muteRes] = await pool.query(
    'DELETE FROM moderation_mutes WHERE created_at < ? OR (expires_at IS NOT NULL AND expires_at < NOW())',
    [cutoffStr]
  );
  results.mutes = muteRes.affectedRows ?? 0;

  // moderation_bans
  const [banRes] = await pool.query(
    'DELETE FROM moderation_bans WHERE created_at < ?',
    [cutoffStr]
  );
  results.bans = banRes.affectedRows ?? 0;

  // automod_violations
  const [violRes] = await pool.query(
    'DELETE FROM automod_violations WHERE created_at < ?',
    [cutoffStr]
  );
  results.violations = violRes.affectedRows ?? 0;

  // anti_nuke_logs
  const [nukeRes] = await pool.query(
    'DELETE FROM anti_nuke_logs WHERE created_at < ?',
    [cutoffStr]
  );
  results.antiNukeLogs = nukeRes.affectedRows ?? 0;

  // vouches
  const [vouchRes] = await pool.query(
    'DELETE FROM vouches WHERE created_at < ?',
    [cutoffStr]
  );
  results.vouches = vouchRes.affectedRows ?? 0;

  // giveaways (ended only)
  const [gwRes] = await pool.query(
    'DELETE FROM giveaways WHERE ended = TRUE AND ends_at < ?',
    [cutoffStr]
  );
  results.giveaways = gwRes.affectedRows ?? 0;

  return { retentionDays, cutoff: cutoffStr, results };
}

/** Run cleanup once and then schedule it to run daily. */
export function startRetentionCleanup(intervalMs = 24 * 60 * 60 * 1000) {
  let timer;
  const run = async () => {
    try {
      const summary = await runRetentionCleanup();
      console.log('[retention] Cleanup completed:', JSON.stringify(summary));
    } catch (error) {
      console.error('[retention] Cleanup failed:', error.message ?? error);
    }
  };
  // Run immediately, then repeat daily.
  run();
  timer = setInterval(run, intervalMs);
  return () => clearInterval(timer);
}