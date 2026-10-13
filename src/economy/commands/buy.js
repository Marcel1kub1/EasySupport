import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney, primaryLocation } from '../util.js';
import { hourlyRate } from '../engine.js';

const CHOICES = [
  ...ECONOMY.upgrades.map((u) => ({ name: `🔧 ${u.label} — ${formatMoney(u.price)}`, value: `upgrade:${u.key}` })),
  ...ECONOMY.boosts.map((b) => ({ name: `✨ ${b.label} — ${formatMoney(b.price)}`, value: `boost:${b.key}` })),
];

const MAX_CHOICES = 25; // Discord limit for a single string option

export default {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an upgrade or a boost')
    .addStringOption((o) =>
      o.setName('item').setDescription('What to buy').setRequired(true)
        .addChoices(...CHOICES.slice(0, MAX_CHOICES))
    ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const choice = interaction.options.getString('item');
    const [kind, key] = choice.split(':');

    const state = economy.buildState(guildId, user.id);
    const location = primaryLocation(state);
    if (!location) {
      return interaction.reply({ content: 'You have no shack yet — run `/found` first.', flags: MessageFlags.Ephemeral });
    }

    if (kind === 'upgrade') {
      const upgrade = ECONOMY.upgrades.find((u) => u.key === key);
      if (!upgrade) return unknown(interaction);
      if (location.upgrades.includes(key)) {
        return interaction.reply({ content: `You already own the **${upgrade.label}**.`, flags: MessageFlags.Ephemeral });
      }
      if (location.level < upgrade.minLevel) {
        return interaction.reply({
          content: `The **${upgrade.label}** needs shack level ${upgrade.minLevel} (you are ${location.level}).`,
          flags: MessageFlags.Ephemeral,
        });
      }
      if (state.user.cash < upgrade.price) {
        return tooExpensive(interaction, upgrade.price, state.user.cash);
      }
      economy.addCash(guildId, user.id, -upgrade.price);
      economy.buyUpgrade(guildId, user.id, location.key, key);
      return interaction.reply({
        content: `🔧 Bought the **${upgrade.label}** (+${Math.round(upgrade.bonus * 100)}% income).\nIncome is now **${formatMoney(hourlyRate(state))}/h** — keep reinvesting!`,
      });
    }

    if (kind === 'boost') {
      const boost = ECONOMY.boosts.find((b) => b.key === key);
      if (!boost) return unknown(interaction);
      if (state.user.cash < boost.price) return tooExpensive(interaction, boost.price, state.user.cash);
      economy.addCash(guildId, user.id, -boost.price);
      economy.addBoost(guildId, user.id, `boost:${key}`, boost.multiplier, Date.now() + boost.durationHours * 3_600_000);
      return interaction.reply({
        content: `✨ **${boost.label}** active: ×${boost.multiplier} income for ${boost.durationHours}h.`,
      });
    }

    return unknown(interaction);
  },
};

function unknown(interaction) {
  return interaction.reply({ content: 'Unknown item.', flags: MessageFlags.Ephemeral });
}

function tooExpensive(interaction, price, cash) {
  return interaction.reply({
    content: `Not enough cash: you need **${formatMoney(price)}** ${ECONOMY.currency} but have **${formatMoney(cash)}**. Run \`/work\` and \`/tips\`!`,
    flags: MessageFlags.Ephemeral,
  });
}
