import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { staffStats } from '../../db.js';
import { ECONOMY } from '../config.js';
import { formatMoney } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('staff-top')
    .setDescription('Staff of the month: reasoned closures, payouts and ratings'),
  async execute(interaction) {
    const { guildId } = interaction;
    const period = new Date().toISOString().slice(0, 7);
    const paid = new Map(economy.listStaffPayouts(guildId, period).map((p) => [p.userId, p]));
    const stats = staffStats(guildId, period);

    if (stats.length === 0) {
      return interaction.reply({
        content: 'No closures with a reason yet this month — that is what pays out.',
      });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = stats.slice(0, ECONOMY.staffPayouts.leaderboardSize).map((row, i) => {
      const payout = paid.get(row.userId);
      const rating = row.averageRating ? ` · ⭐ ${row.averageRating}` : '';
      return `${medals[i] ?? `**${i + 1}.**`} <@${row.userId}> — **${row.reasoned}** reasoned closure(s) · **${row.closed}** total · ${formatMoney(payout?.amount ?? 0)} paid${rating}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🧑‍💼 Staff of the month — ${period}`)
      .setDescription(lines.join('\n'))
      .setFooter({
        text: `${formatMoney(ECONOMY.staffPayouts.perReasonedClosure)} per reasoned closure · monthly cap ${formatMoney(ECONOMY.staffPayouts.monthlyCapPerStaff)}`,
      });

    return interaction.reply({ embeds: [embed] });
  },
};
