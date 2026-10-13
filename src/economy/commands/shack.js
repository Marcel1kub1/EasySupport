import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import {
  hourlyRate, netWorth, menuSlots,
  locationIncome, maxUpgradesOwned, prestigeMultiplier,
} from '../engine.js';
import { formatMoney, formatRate, formatIngredients } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('shack')
    .setDescription('Your empire: balance, income, cleanliness, staff, net worth'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const first = state.locations[0];

    if (!first) {
      return interaction.reply({ content: 'You have no business yet — run `/found` first.' });
    }

    const fields = state.locations.map((location) => {
      const cfg = ECONOMY.locations[location.key];
      const dirty = location.cleanliness < ECONOMY.cleanliness.cleanThreshold;
      const menuFilled = location.menu.filter(Boolean).length;
      return {
        name: `${cfg?.label ?? location.key} — ${location.name}`,
        value:
          `Level **${location.level}/${cfg?.maxLevel ?? '?'}**${location.prestige ? ` · ⭐${location.prestige} (×${prestigeMultiplier(location).toFixed(2)})` : ''}\n` +
          `Income **${formatRate(locationIncome(location))}** · Upgrades ${location.upgrades.length}/${maxUpgradesOwned(location)}\n` +
          `Menu ${menuFilled}/${menuSlots(location.level)} · Staff ${location.employees.length} · Decor ${location.decorations?.length ?? 0}\n` +
          `${dirty ? `⚠️ Dirty (${location.cleanliness}%) — /clean` : `✨ Clean (${location.cleanliness}%)`}`,
      };
    });

    const embed = new EmbedBuilder()
      .setColor(first.cleanliness < ECONOMY.cleanliness.cleanThreshold ? 0xed4245 : 0x5865f2)
      .setTitle('🌮 Your empire')
      .addFields(
        { name: 'Balance', value: `**${formatMoney(state.user.cash)}** ${ECONOMY.currency}`, inline: true },
        { name: 'Income', value: `**${formatRate(hourlyRate(state))}**`, inline: true },
        { name: 'Net worth', value: `**${formatMoney(netWorth(state))}**`, inline: true },
        { name: 'Ingredients', value: formatIngredients(state.user.ingredients), inline: true },
        ...fields
      )
      .setFooter({ text: 'Reinvest everything — saving early slows you down.' });

    return interaction.reply({ embeds: [embed] });
  },
};
