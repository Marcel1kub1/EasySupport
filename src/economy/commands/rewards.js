import { SlashCommandBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { todayPeriod } from '../db.js';
import { ECONOMY } from '../config.js';
import { formatMoney, formatDuration } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rewards')
    .setDescription('Your streak, claimed tasks and redeemed coupons today'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const row = economy.ensureUser(guildId, user.id);
    const period = todayPeriod();

    const tasks = economy.listTasks(guildId, user.id, period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
    const claimed = tasks.filter((t) => t.claimed).length;
    const claimable = tasks.filter((t) => !t.claimed && t.progress >= t.goal).length;
    const redeemed = economy.listRedeemedCodes(guildId, user.id).length;

    const lines = [
      `🎁 Daily streak: **${row.daily_streak ?? 0}** day(s)`,
      `📋 Tasks claimed today: **${claimed}/${ECONOMY.tasks.dailySlots}**${claimable ? ` · **${claimable} ready to claim!**` : ''}`,
      `🎟️ Coupons redeemed: **${redeemed}**`,
      `💰 Balance: **${formatMoney(row.cash)}** ${ECONOMY.currency}`,
    ];
    return interaction.reply({ content: `🏅 **Your rewards**\n${lines.join('\n')}` });
  },
};
