import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('coupons')
    .setDescription('Active coupon codes you can redeem'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const redeemed = economy.listRedeemedCodes(guildId, user.id);

    const lines = ECONOMY.coupons.map((c) => {
      const used = redeemed.includes(c.code.toUpperCase());
      return `🎟️ **${c.code}** — *${c.note}* · ${formatMoney(c.reward)} ${used ? '· ✅ redeemed' : ''}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎟️ Coupons')
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Redeem with /redeem <code> — one claim per player' });

    return interaction.reply({ embeds: [embed] });
  },
};
