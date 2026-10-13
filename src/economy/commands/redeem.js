import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem a coupon code for a cash bonus')
    .addStringOption((o) =>
      o.setName('code').setDescription('The code you received').setRequired(true).setMaxLength(24)
    ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const code = interaction.options.getString('code').trim().toUpperCase();

    const coupon = ECONOMY.coupons.find((c) => c.code.toUpperCase() === code);
    if (!coupon) {
      return interaction.reply({ content: 'That code does not exist — check for typos.', flags: MessageFlags.Ephemeral });
    }

    const fresh = economy.redeemCoupon(guildId, user.id, coupon.code);
    if (!fresh) {
      return interaction.reply({ content: `You already redeemed **${coupon.code}**.`, flags: MessageFlags.Ephemeral });
    }
    const balance = economy.addCash(guildId, user.id, coupon.reward);
    return interaction.reply({
      content:
        `🎟️ **${coupon.code}** redeemed — *${coupon.note}*\n` +
        `+${formatMoney(coupon.reward)} ${ECONOMY.currency} (balance ${formatMoney(balance)}).`,
    });
  },
};
