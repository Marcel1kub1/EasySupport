import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { hourlyRate, netWorth } from '../engine.js';
import { formatMoney, formatRate } from '../util.js';

const MAX_ROWS = 10;

/** Net-worth ranking for a guild, richest first. */
export function guildRanking(guildId) {
  return economy
    .listPlayers(guildId)
    .map((userId) => {
      const state = economy.buildState(guildId, userId);
      return { userId, worth: netWorth(state), income: hourlyRate(state) };
    })
    .sort((a, b) => b.worth - a.worth)
    .slice(0, MAX_ROWS);
}

export function leaderboardEmbed(guildId, scope = 'server') {
  const rows = guildRanking(guildId);
  if (rows.length === 0) {
    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🏆 Leaderboard')
      .setDescription('Nobody has played yet — be the first with `/work`.');
  }
  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map((row, i) => {
    const place = medals[i] ?? `**${i + 1}.**`;
    return `${place} <@${row.userId}> — **${formatMoney(row.worth)}** · ${formatRate(row.income)}`;
  });
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🏆 Richest members')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Scope: ${scope} · net worth = cash + bank + business value` });
}

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Richest members by net worth')
    .addStringOption((o) =>
      o
        .setName('scope')
        .setDescription('Rankings (global rankings land with the stats phase)')
        .setRequired(false)
        .addChoices({ name: 'This server', value: 'server' })
    ),
  async execute(interaction) {
    const scope = interaction.options.getString('scope') ?? 'server';
    return interaction.reply({ embeds: [leaderboardEmbed(interaction.guildId, scope)] });
  },
};
