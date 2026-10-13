import { SlashCommandBuilder, MessageFlags, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { headquartersMultiplier, hourlyRate } from '../engine.js';
import { formatMoney, formatRate } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('hq')
    .setDescription('Headquarters: global upgrades for every business you own'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const owned = state.hq ?? [];

    if (state.locations.length === 0) {
      return interaction.reply({ content: 'You have no business yet — run `/found` first.', flags: MessageFlags.Ephemeral });
    }

    const lines = ECONOMY.headquarters.map((h) => {
      const has = owned.includes(h.key);
      return `**${h.label}** — +${Math.round(h.bonus * 100)}% income everywhere · ${has ? '✅ owned' : `💵 ${formatMoney(h.price)}`}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🏢 Headquarters')
      .setDescription(lines.join('\n'))
      .addFields(
        { name: 'HQ multiplier', value: `**×${headquartersMultiplier(state).toFixed(2)}**`, inline: true },
        { name: 'Total income', value: `**${formatRate(hourlyRate(state))}**`, inline: true }
      )
      .setFooter({ text: 'Buy with /buy — HQ upgrades apply to all locations at once' });

    return interaction.reply({ embeds: [embed] });
  },
};
