import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { hourlyRate, netWorth, menuSlots, upgradesMultiplier, employeesMultiplier } from '../engine.js';
import { formatMoney, formatRate, formatIngredients } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('shack')
    .setDescription('Your shack stats: balance, income, cleanliness, staff'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const location = state.locations[0];

    if (!location) {
      return interaction.reply({ content: 'You have no shack yet — run `/found` first.' });
    }

    const dirty = location.cleanliness < ECONOMY.cleanliness.cleanThreshold;
    const menuFilled = location.menu.filter(Boolean).length;
    const embed = new EmbedBuilder()
      .setColor(dirty ? 0xed4245 : 0x5865f2)
      .setTitle(`🌮 ${location.name}`)
      .addFields(
        { name: 'Balance', value: `**${formatMoney(state.user.cash)}** ${ECONOMY.currency}`, inline: true },
        { name: 'Income', value: `**${formatRate(hourlyRate(state))}**`, inline: true },
        { name: 'Level', value: `${location.level} / ${ECONOMY.locations[location.key].maxLevel}`, inline: true },
        { name: 'Cleanliness', value: dirty ? `⚠️ ${location.cleanliness}% — run /clean` : `✨ ${location.cleanliness}%`, inline: true },
        { name: 'Menu', value: `${menuFilled} / ${menuSlots(location.level)} slots set`, inline: true },
        { name: 'Prestige', value: `${location.prestige}`, inline: true },
        {
          name: 'Bonuses',
          value: `Upgrades ×${upgradesMultiplier(location).toFixed(2)} · Staff ×${employeesMultiplier(location).toFixed(2)}`,
        },
        { name: 'Net worth', value: `**${formatMoney(netWorth(state))}** ${ECONOMY.currency}`, inline: true },
        { name: 'Ingredients', value: formatIngredients(state.user.ingredients), inline: true }
      )
      .setFooter({ text: 'Reinvest everything — saving early slows you down.' });

    return interaction.reply({ embeds: [embed] });
  },
};
