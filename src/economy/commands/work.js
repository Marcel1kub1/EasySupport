import { SlashCommandBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { hourlyRate, workPayout } from '../engine.js';
import { cooldownRemaining, formatDuration, formatMoney, formatRate, nowIso, primaryLocation } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Cook tacos for cash — the main earner'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const row = economy.ensureUser(guildId, user.id);

    const remaining = cooldownRemaining(row, 'last_work_at', ECONOMY.cooldowns.work);
    if (remaining > 0) {
      return interaction.reply({
        content: `You are still on shift — ready again in **${formatDuration(remaining)}**.`,
      });
    }

    const state = economy.buildState(guildId, user.id);
    const location = primaryLocation(state);
    if (!location) {
      return interaction.reply({ content: 'You have no shack yet — run `/found` first.' });
    }

    const happyHour = Math.random() < ECONOMY.events.happyHour.chancePerWork;
    const payout = workPayout(state, happyHour ? ECONOMY.events.happyHour.multiplier : 1);
    economy.addCash(guildId, user.id, payout);
    economy.setCooldown(guildId, user.id, 'last_work_at', nowIso());

    const lines = [
      `🌮 You worked a shift at **${location.name}** and earned **${formatMoney(payout)} ${ECONOMY.currency}**.`,
      `Balance: **${formatMoney(state.user.cash + payout)}** · Income: **${formatRate(hourlyRate(state))}**`,
    ];
    if (happyHour) lines.push('\n🎉 **Happy Hour!** Your shift paid double!');
    if (state.locations[0].menu.some((slot) => !slot)) lines.push(`\n💡 ${ECONOMY.flavor.menuTrap}`);
    if (state.locations[0].cleanliness < ECONOMY.cleanliness.cleanThreshold) lines.push(`\n⚠️ ${ECONOMY.flavor.dirtyWarning}`);

    return interaction.reply({ content: lines.join('\n') });
  },
};
