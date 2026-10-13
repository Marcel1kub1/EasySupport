import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { expandCost, maxUpgradesOwned } from '../engine.js';
import { formatMoney, pickLocation, withLocationOption } from '../util.js';

export default {
  data: withLocationOption(
    new SlashCommandBuilder()
      .setName('expand')
      .setDescription('Expand a business for more upgrade slots')
  ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const location = pickLocation(state, interaction.options.getString('location'));
    if (!location) {
      return interaction.reply({ content: "You don't own that business — check `/location list`.", flags: MessageFlags.Ephemeral });
    }

    const cost = expandCost(location);
    if (!Number.isFinite(cost)) {
      return interaction.reply({
        content: `**${location.name}** is fully expanded (level ${location.expanded}/${ECONOMY.expand.maxLevel}).`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (state.user.cash < cost) {
      return interaction.reply({
        content: `Expansion costs **${formatMoney(cost)}** ${ECONOMY.currency} — you have ${formatMoney(state.user.cash)}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    economy.addCash(guildId, user.id, -cost);
    economy.setExpanded(guildId, user.id, location.key, location.expanded + 1);
    const slots = maxUpgradesOwned({ ...location, expanded: location.expanded + 1 });

    return interaction.reply({
      content: `🏗️ **${location.name}** expanded to level ${location.expanded + 1}!\nUpgrade slots: **${slots}** — buy more with \`/buy\`.`,
    });
  },
};
