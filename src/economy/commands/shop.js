import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ECONOMY } from '../config.js';
import { economy } from '../instance.js';
import { formatMoney, primaryLocation } from '../util.js';
import { activeBoostMultiplier } from '../engine.js';

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse temporary boosts for sale'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const location = primaryLocation(state);
    if (!location) {
      return interaction.reply({ content: 'You have no shack yet — run `/found` first.' });
    }

    const lines = ECONOMY.boosts.map(
      (b) => `✨ **${b.label}** — ×${b.multiplier} income for ${b.durationHours}h · ${formatMoney(b.price)} ${ECONOMY.currency}`
    );
    const active = activeBoostMultiplier(state);
    const activeLine = active > 1 ? `\n\nActive multiplier: **×${active.toFixed(2)}**` : '';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🛒 Boost Shop')
      .setDescription(lines.join('\n') + activeLine)
      .setFooter({ text: 'Buy with /buy <boost> — boosts stack while active' });

    return interaction.reply({ embeds: [embed] });
  },
};
