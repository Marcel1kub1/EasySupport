import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { cooldownRemaining, formatDuration } from '../util.js';

const TRACKED = [
  ['last_work_at', 'work', 'Work a shift'],
  ['last_tips_at', 'tips', 'Collect tips'],
  ['last_clean_at', 'clean', 'Clean the shack'],
  ['last_mine_at', 'mine', 'Mine ingredients'],
  ['last_daily_at', 'daily', 'Daily bonus'],
];

export default {
  data: new SlashCommandBuilder()
    .setName('cooldowns')
    .setDescription('See which economy actions are ready'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const row = economy.ensureUser(guildId, user.id);

    const lines = TRACKED.map(([column, key, label]) => {
      const remaining = cooldownRemaining(row, column, ECONOMY.cooldowns[key]);
      return remaining > 0
        ? `⏳ **${label}** — ${formatDuration(remaining)}`
        : `✅ **${label}** — ready`;
    });

    return interaction.reply({
      content: lines.join('\n'),
      flags: MessageFlags.Ephemeral,
    });
  },
};
