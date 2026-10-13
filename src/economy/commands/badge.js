import { SlashCommandBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('badge')
    .setDescription('Show the badges you have earned')
    .addSubcommand((sub) => sub.setName('view').setDescription('Your badge collection')),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    economy.buildState(guildId, user.id); // lazily unlocks any newly-earned badges
    const unlocked = economy.listAchievements(guildId, user.id);

    const earned = ECONOMY.achievements.filter((a) => unlocked.includes(a.key));
    if (earned.length === 0) {
      return interaction.reply({
        content: '🎖️ No badges yet — run `/work` and check `/achievements` to see what to chase first.',
      });
    }
    return interaction.reply({
      content: `🎖️ **Your badges** (${earned.length}/${ECONOMY.achievements.length}):\n${earned
        .map((a) => `${a.badge} **${a.label}**`)
        .join('\n')}`,
    });
  },
};
