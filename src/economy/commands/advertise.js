import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { hasAdvertisingUnlocked } from '../engine.js';
import { cooldownRemaining, formatDuration, formatMoney, nowIso } from '../util.js';

const ad = ECONOMY.advertising;

export default {
  data: new SlashCommandBuilder()
    .setName('advertise')
    .setDescription(`Run a ${ad.name}: ×${ad.multiplier} income for ${ad.durationHours}h`),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const row = economy.ensureUser(guildId, user.id);

    const state = economy.buildState(guildId, user.id);
    if (!hasAdvertisingUnlocked(state)) {
      return interaction.reply({
        content: 'Advertising unlocks with your **first prestige** — max a business to level 10 and use `/prestige`.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const remaining = cooldownRemaining(row, 'last_ad_at', ECONOMY.cooldowns.advertise);
    if (remaining > 0) {
      return interaction.reply({
        content: `Your last ${ad.name} is still running — next one in **${formatDuration(remaining)}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (state.user.cash < ad.price) {
      return interaction.reply({
        content: `A ${ad.name} costs **${formatMoney(ad.price)}** ${ECONOMY.currency} — you have ${formatMoney(state.user.cash)}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    economy.addCash(guildId, user.id, -ad.price);
    economy.addBoost(guildId, user.id, `advertise`, ad.multiplier, Date.now() + ad.durationHours * 3_600_000);
    economy.setCooldown(guildId, user.id, 'last_ad_at', nowIso());

    return interaction.reply({
      content:
        `📱 **${ad.name}** launched for **${formatMoney(ad.price)}** ${ECONOMY.currency}!\n` +
        `×${ad.multiplier} income for **${ad.durationHours} hours** — hope it goes viral. 🚀`,
    });
  },
};
