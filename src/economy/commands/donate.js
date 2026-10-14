import { SlashCommandBuilder, MessageFlags, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney, formatRate } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('donate')
    .setDescription(`Fill the community pot — reaching the goal pays everyone a boost`)
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('How much to donate').setRequired(true).setMinValue(1_000)
    ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const amount = interaction.options.getInteger('amount');

    const balance = economy.getUser(guildId, user.id)?.cash ?? 0;
    if (balance < amount) {
      return interaction.reply({
        content: `You only have **${formatMoney(balance)}** ${ECONOMY.currency}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    economy.addCash(guildId, user.id, -amount);
    const pot = economy.addToPot(guildId, amount);
    const goal = ECONOMY.communityPot.goal;

    if (pot >= goal) {
      // goal reached: pay everyone an active server boost and reset the pot
      const multiplier = ECONOMY.communityPot.boostMultiplier;
      const duration = ECONOMY.communityPot.boostDurationHours;
      economy.addToPot(guildId, -pot);
      const payouts = grantServerBoost(guildId, multiplier, duration);
      return interaction.reply({
        content:
          `🎉 **Community goal reached!** The pot (${formatMoney(pot)}) funds a **×${multiplier} income boost for ${duration}h** — ` +
          `paid to **${payouts}** player${payouts === 1 ? '' : 's'}. Thanks for the ${formatMoney(amount)} donation, <@${user.id}>!`,
      });
    }

    return interaction.reply({
      content: `💝 Donated **${formatMoney(amount)}** ${ECONOMY.currency}. Pot: **${formatMoney(pot)} / ${formatMoney(goal)}** (${Math.floor((pot / goal) * 100)}%).`,
    });
  },
};

/**
 * Grants every economy player in the guild the community boost. Player rows are
 * discovered from the ledger tables, so contributors without a shack count too.
 */
function grantServerBoost(guildId, multiplier, durationHours) {
  const expires = Date.now() + durationHours * 3_600_000;
  const players = economy.listPlayers(guildId);
  for (const userId of players) economy.addBoost(guildId, userId, 'community', multiplier, expires);
  return players.length;
}

export const goalEmbed = (guildId) => {
  const pot = economy.getPot(guildId);
  const goal = ECONOMY.communityPot.goal;
  const percent = Math.min(100, Math.floor((pot / goal) * 100));
  // 20 blocks: a sliver shows as soon as anything is donated
  const filled = percent > 0 ? Math.max(1, Math.round(percent / 5)) : 0;
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('💝 Community Pot')
    .setDescription(`\`${bar}\` **${percent}%**\n${formatMoney(pot)} / ${formatMoney(goal)} ${ECONOMY.currency}`)
    .addFields(
      { name: 'On completion', value: `×${ECONOMY.communityPot.boostMultiplier} income for ${ECONOMY.communityPot.boostDurationHours}h for everyone`, inline: true },
      { name: 'Contribute', value: '`/donate <amount>`', inline: true }
    )
    .setFooter({ text: 'Boost applies to every player in the server' });
  return embed;
};
