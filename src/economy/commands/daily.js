import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { cooldownRemaining, formatDuration, formatMoney, nowIso, parseDbTime } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily bonus — keep the streak alive'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const row = economy.ensureUser(guildId, user.id);

    const remaining = cooldownRemaining(row, 'last_daily_at', ECONOMY.cooldowns.daily);
    if (remaining > 0) {
      return interaction.reply({
        content: `Already claimed today — next daily in **${formatDuration(remaining)}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const last = parseDbTime(row.last_daily_at);
    const missedWindow = last && Date.now() - last > ECONOMY.payouts.daily.streakResetHours * 3_600_000;
    const streak = missedWindow || !last ? 1 : (row.daily_streak ?? 0) + 1;
    const capped = Math.min(streak, ECONOMY.payouts.daily.streakCap);
    const reward = ECONOMY.payouts.daily.base * capped;

    economy.addCash(guildId, user.id, reward);
    economy.setDailyStreak(guildId, user.id, streak);
    economy.setCooldown(guildId, user.id, 'last_daily_at', nowIso());

    const note = missedWindow && last ? '\n(Your streak had expired — starting a fresh one!)' : '';
    return interaction.reply({
      content: `🎁 Daily bonus: **${formatMoney(reward)} ${ECONOMY.currency}** (day ${streak}, capped at ${ECONOMY.payouts.daily.streakCap}×).${note}`,
    });
  },
};
