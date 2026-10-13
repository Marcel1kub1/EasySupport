import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { menuSlots } from '../engine.js';
import { formatMoney, locationOption, pickLocation } from '../util.js';

const ITEM_CHOICES = ECONOMY.menuItems.map((m) => ({
  name: `${m.label} — ${m.income} income/h (${formatMoney(m.price)})`,
  value: m.key,
}));

export default {
  data: new SlashCommandBuilder()
    .setName('menu')
    .setDescription('View or edit a menu')
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('Show your current menu').addStringOption(locationOption)
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Put an item in a menu slot')
        .addIntegerOption((o) =>
          o.setName('slot').setDescription('Menu slot number (1-based)').setRequired(true).setMinValue(1).setMaxValue(25)
        )
        .addStringOption((o) =>
          o.setName('item').setDescription('Item to place').setRequired(true).addChoices(...ITEM_CHOICES)
        )
        .addStringOption(locationOption)
    ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const location = pickLocation(state, interaction.options.getString('location'));
    if (!location) {
      return interaction.reply({ content: "You don't own that business yet — check `/location list`.", flags: MessageFlags.Ephemeral });
    }

    if (interaction.options.getSubcommand() === 'view') {
      const slots = menuSlots(location.level);
      const rows = Array.from({ length: slots }, (_, i) => {
        const item = location.menu[i];
        const meta = item ? ECONOMY.menuItems.find((m) => m.key === item) : null;
        return `Slot ${i + 1}: ${meta ? `**${meta.label}** (+${Math.round(meta.income * 0.25)}/h)` : '*empty — you are losing income!*'}`;
      });
      const empty = location.menu.slice(0, slots).some((slot) => !slot);
      return interaction.reply({
        content: `🌮 **${location.name}** — menu (${slots} slot${slots === 1 ? '' : 's'}):\n${rows.join('\n')}` +
          (empty ? `\n\n💡 ${ECONOMY.flavor.menuTrap}` : ''),
      });
    }

    // /menu set
    const slot = interaction.options.getInteger('slot');
    const itemKey = interaction.options.getString('item');
    const slots = menuSlots(location.level);
    if (slot > slots) {
      return interaction.reply({
        content: `Slot ${slot} is locked — you have ${slots} slot${slots === 1 ? '' : 's'} at level ${location.level}.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    const item = ECONOMY.menuItems.find((m) => m.key === itemKey);
    if (!item) {
      return interaction.reply({ content: 'Unknown menu item.', flags: MessageFlags.Ephemeral });
    }
    if (state.user.cash < item.price) {
      return interaction.reply({
        content: `**${item.label}** costs ${formatMoney(item.price)} ${ECONOMY.currency} — you have ${formatMoney(state.user.cash)}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    economy.addCash(guildId, user.id, -item.price);
    economy.setMenuItem(guildId, user.id, location.key, slot - 1, itemKey);
    return interaction.reply({
      content: `🌮 Slot ${slot} now serves **${item.label}** (+${Math.round(item.income * 0.25)} income/h).`,
    });
  },
};
