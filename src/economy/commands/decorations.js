import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { decorationsMultiplier } from '../engine.js';
import { formatMoney, pickLocation, withLocationOption } from '../util.js';

export default {
  data: withLocationOption(
    new SlashCommandBuilder().setName('decorations').setDescription('Browse decorations for a business')
  ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const location = pickLocation(state, interaction.options.getString('location'));
    if (!location) {
      return interaction.reply({ content: "You don't own that business — check `/location list`." });
    }

    const owned = location.decorations ?? [];
    const lines = ECONOMY.decorations.map((d) => {
      const has = owned.includes(d.key);
      return `**${d.label}** — +${Math.round(d.bonus * 100)}% income · ${has ? '✅ owned' : `💵 ${formatMoney(d.price)}`}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎀 Decorations — ${location.name}`)
      .setDescription(lines.join('\n'))
      .addFields({
        name: 'Decoration bonus',
        value: `**+${Math.round((decorationsMultiplier(location) - 1) * 100)}%**`,
        inline: true,
      })
      .setFooter({ text: 'Buy with /buy' });

    return interaction.reply({ embeds: [embed] });
  },
};
