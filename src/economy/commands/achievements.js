import { SlashCommandBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('Long-term goals and your progress'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    economy.buildState(guildId, user.id); // lazily unlocks any newly-earned badges
    const unlocked = economy.listAchievements(guildId, user.id);

    const lines = ECONOMY.achievements.map((a) => {
      const has = unlocked.includes(a.key);
      return `${has ? `${a.badge} **${a.label}** ✅` : `🔒 ${a.label} — locked`}`;
    });

    return interaction.reply({
      content:
        `🏆 **Achievements** (${unlocked.length}/${ECONOMY.achievements.length}):\n${lines.join('\n')}\n\n` +
        `Badges are earned automatically — show them off with \`/badge view\`.`,
    });
  },
};
