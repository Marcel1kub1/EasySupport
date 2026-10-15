import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { staffStats, countAllOpenTickets } from '../../db.js';
import { ECONOMY } from '../config.js';
import { netWorth, hourlyRate } from '../engine.js';
import { formatMoney, formatRate } from '../util.js';
import { monthPeriod } from './helpers.js';

export async function render({ guildId, userId }) {
  const rows = economy
    .listPlayers(guildId)
    .map((id) => {
      const state = economy.buildState(guildId, id);
      return { id, worth: netWorth(state), income: hourlyRate(state) };
    })
    .sort((a, b) => b.worth - a.worth)
    .slice(0, ECONOMY.staffPayouts.leaderboardSize);

  const medals = ['🥇', '🥈', '🥉'];
  const richest = rows.length
    ? rows.map((r, i) => `${medals[i] ?? `**${i + 1}.**`} <@${r.id}> — **${formatMoney(r.worth)}** · ${formatRate(r.income)}`).join('\n')
    : '*Nobody has played yet.*';

  const period = monthPeriod();
  const paid = new Map(economy.listStaffPayouts(guildId, period).map((p) => [p.userId, p]));
  const staff = staffStats(guildId, period).slice(0, ECONOMY.staffPayouts.leaderboardSize);
  const staffLines = staff.length
    ? staff.map((row, i) => {
        const payout = paid.get(row.userId);
        const rating = row.averageRating ? ` · ⭐${row.averageRating}` : '';
        return `${medals[i] ?? `**${i + 1}.**`} <@${row.userId}> — **${row.reasoned}** reasoned · ${formatMoney(payout?.amount ?? 0)} paid${rating}`;
      }).join('\n')
    : '*No closures with a reason yet this month.*';

  const openTickets = countAllOpenTickets(guildId);

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🏆 Leaderboards')
        .addFields(
          { name: 'Richest members', value: richest },
          { name: `🧑‍💼 Staff of the month — ${period}`, value: staffLines }
        )
        .setFooter({ text: `${openTickets === 0 ? '🧹 Quiet queue: +25% for everyone' : `${openTickets} ticket(s) open`} · net worth = cash + bank + businesses` }),
    ],
    rows: [],
  };
}
