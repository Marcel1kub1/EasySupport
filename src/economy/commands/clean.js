import { SlashCommandBuilder } from 'discord.js';
import { economy, bumpTasks } from '../instance.js';
import { ECONOMY } from '../config.js';
import { cooldownRemaining, formatDuration, nowIso, pickLocation, withLocationOption } from '../util.js';

export default {
  data: withLocationOption(
    new SlashCommandBuilder().setName('clean').setDescription('Scrub the shack — a dirty shack loses customers')
  ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const row = economy.ensureUser(guildId, user.id);

    const remaining = cooldownRemaining(row, 'last_clean_at', ECONOMY.cooldowns.clean);
    if (remaining > 0) {
      return interaction.reply({ content: `Already sparkling — you can clean again in **${formatDuration(remaining)}**.` });
    }

    const state = economy.buildState(guildId, user.id);
    const location = pickLocation(state, interaction.options.getString('location'));
    if (!location) {
      return interaction.reply({ content: 'You have no shack yet — run `/found` first.' });
    }

    economy.setCleanliness(guildId, user.id, location.key, ECONOMY.cleanliness.cleanRestore);
    economy.touchCleanliness(guildId, user.id, location.key);
    economy.setCooldown(guildId, user.id, 'last_clean_at', nowIso());
    bumpTasks(guildId, user.id, 'clean');

    return interaction.reply({ content: `🧽 **${location.name}** is spotless. Customers are happy again!` });
  },
};
