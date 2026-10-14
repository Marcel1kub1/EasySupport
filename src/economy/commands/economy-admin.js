import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('economy-admin')
    .setDescription('Admin tools for the economy (promos, fixes, resets)')
    .setDefaultMemberPermissions(0x8) // Administrator
    .addSubcommand((sub) =>
      sub
        .setName('give')
        .setDescription('Grant cash to a member')
        .addUserOption((o) => o.setName('member').setDescription('Who').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('How much').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set a member balance exactly')
        .addUserOption((o) => o.setName('member').setDescription('Who').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('New balance').setRequired(true).setMinValue(0))
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Wipe one member\'s empire (level 1 stand, no cash)')
        .addUserOption((o) => o.setName('member').setDescription('Who').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('pot').setDescription('Add to (or drain with a negative) the community pot')
        .addIntegerOption((o) => o.setName('amount').setDescription('Signed amount').setRequired(true))
    ),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has(0x8)) {
      return interaction.reply({ content: 'Administrator only.', flags: MessageFlags.Ephemeral });
    }
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'give' || sub === 'set') {
      const target = interaction.options.getUser('member');
      const amount = interaction.options.getInteger('amount');
      if (sub === 'give') {
        economy.addCash(guildId, target.id, amount);
        const balance = economy.getUser(guildId, target.id).cash;
        return interaction.reply({
          content: `✅ Granted **${formatMoney(amount)}** to <@${target.id}> — balance now ${formatMoney(balance)}.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      economy.ensureUser(guildId, target.id);
      const current = economy.getUser(guildId, target.id).cash;
      economy.addCash(guildId, target.id, amount - current);
      return interaction.reply({
        content: `✅ Set <@${target.id}>'s balance to **${formatMoney(amount)}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'pot') {
      const amount = interaction.options.getInteger('amount');
      const pot = economy.addToPot(guildId, amount);
      return interaction.reply({
        content: `💝 Community pot is now **${formatMoney(pot)} / ${formatMoney(ECONOMY.communityPot.goal)}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // reset
    const target = interaction.options.getUser('member');
    economy.resetPlayer(guildId, target.id);
    return interaction.reply({
      content: `🧹 <@${target.id}>'s empire was reset: free level-1 stand, no cash, no staff.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
