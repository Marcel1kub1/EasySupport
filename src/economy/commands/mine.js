import { SlashCommandBuilder } from 'discord.js';
import { economy, bumpTasks } from '../instance.js';
import { ECONOMY } from '../config.js';
import { cooldownRemaining, formatDuration, formatIngredients, nowIso } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mine')
    .setDescription('Mine ingredients for restaurants and recipes'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const row = economy.ensureUser(guildId, user.id);

    const remaining = cooldownRemaining(row, 'last_mine_at', ECONOMY.cooldowns.mine);
    if (remaining > 0) {
      return interaction.reply({ content: `Your pickaxe is recovering — ready in **${formatDuration(remaining)}**.` });
    }

    const { min, max } = ECONOMY.payouts.mine;
    const found = min + Math.floor(Math.random() * (max - min + 1));
    const total = economy.addIngredients(guildId, user.id, found);
    economy.setCooldown(guildId, user.id, 'last_mine_at', nowIso());
    bumpTasks(guildId, user.id, 'mine');

    return interaction.reply({
      content: `⛏️ You mined **${found}** ingredient${found === 1 ? '' : 's'}. Banked: **${formatIngredients(total)}**.\nIngredients are needed for restaurants, hotels and recipes.`,
    });
  },
};
