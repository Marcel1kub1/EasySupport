import { SlashCommandBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { tipsPayout } from '../engine.js';
import { cooldownRemaining, formatDuration, formatMoney, nowIso, pickLocation, withLocationOption } from '../util.js';

export default {
  data: withLocationOption(
    new SlashCommandBuilder().setName('tips').setDescription('Collect tips from the jar')
  ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const row = economy.ensureUser(guildId, user.id);

    const remaining = cooldownRemaining(row, 'last_tips_at', ECONOMY.cooldowns.tips);
    if (remaining > 0) {
      return interaction.reply({ content: `The jar is empty — check back in **${formatDuration(remaining)}**.` });
    }

    const state = economy.buildState(guildId, user.id);
    const location = pickLocation(state, interaction.options.getString('location'));
    if (!location) {
      return interaction.reply({ content: 'You have no shack yet — run `/found` first.' });
    }

    const { minRoll, maxRoll } = ECONOMY.payouts.tips;
    const roll = minRoll + Math.floor(Math.random() * (maxRoll - minRoll + 1));
    const weekend = [0, 6].includes(new Date().getUTCDay());
    const lunchRush = weekend && ECONOMY.events.lunchRush.weekendOnly;
    const payout = Math.round(
      tipsPayout(location, roll) * (lunchRush ? ECONOMY.events.lunchRush.tipsMultiplier : 1)
    );

    economy.addCash(guildId, user.id, payout);
    economy.setCooldown(guildId, user.id, 'last_tips_at', nowIso());

    const suffix = lunchRush ? ' 🌮 **Lunch Rush** — weekend tips are doubled!' : '';
    return interaction.reply({
      content: `🪙 You collected **${formatMoney(payout)} ${ECONOMY.currency}** in tips.${suffix}`,
    });
  },
};
