import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Send cash to another member (a small fee keeps it fair)')
    .addUserOption((o) => o.setName('member').setDescription('Who receives the cash').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('How much to send').setRequired(true).setMinValue(ECONOMY.gifting.minAmount)
    ),
  async execute(interaction) {
    const { guildId } = interaction;
    const sender = interaction.user;
    const target = interaction.options.getUser('member');
    const amount = interaction.options.getInteger('amount');

    if (target.id === sender.id) {
      return interaction.reply({ content: 'You cannot gift yourself.', flags: MessageFlags.Ephemeral });
    }
    if (target.bot) {
      return interaction.reply({ content: 'Bots have no use for tacos.', flags: MessageFlags.Ephemeral });
    }

    const fee = Math.ceil(amount * ECONOMY.gifting.feePercent);
    const total = amount + fee;
    const balance = economy.getUser(guildId, sender.id)?.cash ?? 0;
    if (balance < total) {
      return interaction.reply({
        content: `You need **${formatMoney(total)}** ${ECONOMY.currency} (${formatMoney(amount)} + ${formatMoney(fee)} fee) but have ${formatMoney(balance)}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    economy.addCash(guildId, sender.id, -total);
    economy.addCash(guildId, target.id, amount);
    return interaction.reply({
      content: `🎁 You sent **${formatMoney(amount)}** ${ECONOMY.currency} to <@${target.id}> (fee ${formatMoney(fee)}).`,
    });
  },
};
