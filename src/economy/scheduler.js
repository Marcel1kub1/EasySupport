/*
 * Background jobs for the economy:
 *   1. Reminders — every minute, DM (or channel-ping) due reminders.
 *   2. Live leaderboard — refresh the posted message every N minutes.
 *   3. Staff of the month — on the 1st, award the previous month's winner in
 *      the log channel (cash bonus + the configured role, when set).
 * Started once from src/index.js.
 */
import { staffStats, getGuild } from '../db.js';
import { ECONOMY } from '../economy/config.js';
import { leaderboardEmbed } from '../economy/commands/leaderboard.js';

const MINUTE = 60_000;

export function startEconomyScheduler(client, economy) {
  /* ------------------------------- reminders ------------------------------- */
  const fireReminders = async () => {
    let due;
    try {
      due = economy.listDueReminders();
    } catch (error) {
      console.error('[economy] Reminder tick failed:', error.message ?? error);
      return;
    }
    for (const reminder of due) {
      try {
        const user = await client.users.fetch(reminder.user_id);
        await user.send(`⏰ Your **/${reminder.action}** is ready — go collect!`);
      } catch {
        const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
        if (channel) {
          await channel.send(`⏰ <@${reminder.user_id}> your **/${reminder.action}** is ready!`).catch(() => {});
        }
      }
      economy.deleteReminder(reminder.id);
    }
  };

  /* ----------------------------- live leaderboard -------------------------- */
  const refreshLeaderboards = async () => {
    for (const guild of client.guilds.cache.values()) {
      const target = economy.getLeaderboardTarget(guild.id);
      if (!target) continue;
      const channel = guild.channels.cache.get(target.channel_id);
      const message = channel ? await channel.messages.fetch(target.message_id).catch(() => null) : null;
      if (message) await message.edit({ embeds: [leaderboardEmbed(guild.id)] }).catch(() => {});
      else economy.clearLeaderboardTarget(guild.id);
    }
  };

  /* --------------------------- staff of the month -------------------------- */
  let lastMotmCheck = null;
  const staffOfTheMonth = async () => {
    const now = new Date();
    const key = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
    if (now.getUTCDate() !== 1 || lastMotmCheck === key) return;
    lastMotmCheck = key;

    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const period = previous.toISOString().slice(0, 7);

    for (const guild of client.guilds.cache.values()) {
      const settings = getGuild(guild.id);
      if (!settings?.log_channel_id) continue;
      const best = staffStats(guild.id, period)[0];
      if (!best || best.reasoned === 0) continue;

      const channel = guild.channels.cache.get(settings.log_channel_id);
      if (!channel) continue;

      const parts = [
        `🧑‍💼 **Staff of the month — ${period}**: <@${best.userId}> with **${best.reasoned}** reasoned closure(s)${best.averageRating ? ` · ⭐ ${best.averageRating}` : ''}`,
      ];
      const roleId = settings.motm_role_id;
      if (roleId) {
        const member = await guild.members.fetch(best.userId).catch(() => null);
        const role = guild.roles.cache.get(roleId);
        if (member && role) {
          // hand the badge to the new winner and take it from anyone else
          for (const other of role.members.values()) {
            if (other.id !== best.userId) await other.roles.remove(roleId).catch(() => {});
          }
          await member.roles.add(roleId).catch(() => {});
          parts.push(`🏅 The ${role.name} role has been awarded.`);
        }
      }
      if (ECONOMY.staffPayouts.monthlyBonusWinner > 0) {
        economy.addCash(guild.id, best.userId, ECONOMY.staffPayouts.monthlyBonusWinner);
        parts.push(`💰 Bonus: **+${ECONOMY.staffPayouts.monthlyBonusWinner.toLocaleString('en-US')}** ${ECONOMY.currency}.`);
      }
      await channel.send({ content: parts.join('\n'), allowedMentions: { users: [best.userId] } }).catch(() => {});
    }
  };

  const tick = async () => {
    await fireReminders().catch(() => {});
    await refreshLeaderboards().catch(() => {});
    await staffOfTheMonth().catch(() => {});
  };

  const timer = setInterval(tick, MINUTE);
  timer.unref();
  console.log('[economy] Scheduler started (reminders, leaderboard, staff of the month).');
}
