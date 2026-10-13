import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ECONOMY } from '../config.js';
import { economy } from '../instance.js';
import { formatMoney, pickLocation, withLocationOption } from '../util.js';

export default {
  data: withLocationOption(
    new SlashCommandBuilder().setName('upgrades').setDescription('Browse business upgrades')
  ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const location = pickLocation(state, interaction.options.getString('location'));
    if (!location) {
      return interaction.reply({ content: "You don't own that business yet — check `/location list`.", flags: MessageFlags.Ephemeral });
    }

    const owned = location.upgrades;
    const lines = ECONOMY.upgrades.map((u) => {
      const has = owned.includes(u.key);
      const locked = location.level < u.minLevel;
      const status = has ? '✅ owned' : locked ? `🔒 needs level ${u.minLevel}` : `💵 ${formatMoney(u.price)}`;
      return `**${u.label}** — +${Math.round(u.bonus * 100)}% income · ${status}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🔧 Upgrades — ${location.name}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Buy with /buy — expansion adds more upgrade slots' });

    return interaction.reply({ embeds: [embed] });
  },
};
