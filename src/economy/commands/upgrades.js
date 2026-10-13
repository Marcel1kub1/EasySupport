import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ECONOMY } from '../config.js';
import { economy } from '../instance.js';
import { formatMoney } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('upgrades')
    .setDescription('Browse shack upgrades'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const location = state.locations[0];
    if (!location) {
      return interaction.reply({ content: 'You have no shack yet — run `/found` first.' });
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
      .setFooter({ text: 'Buy with /buy <upgrade>' });

    return interaction.reply({ embeds: [embed] });
  },
};
