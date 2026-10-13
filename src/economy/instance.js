import { db } from '../db.js';
import { createEconomyDb, todayPeriod } from './db.js';
import { ECONOMY } from './config.js';

/** The economy repository bound to the bot's shared database. */
export const economy = createEconomyDb(db);

/**
 * Bumps progress on today's tasks that track `action` (e.g. 'work', 'tips').
 * No-op when the player has no matching task today.
 */
export function bumpTasks(guildId, userId, action, amount = 1) {
  const period = todayPeriod();
  const assigned = economy.listTasks(guildId, userId, period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
  for (const task of assigned) {
    if (task.track === action) economy.bumpTask(guildId, userId, period, task.key, amount);
  }
}
