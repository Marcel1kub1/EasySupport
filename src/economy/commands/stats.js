import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { countAllOpenTickets, staffStats } from '../../db.js';
import { ECONOMY } from '../config.js';
import { hourlyRate, netWorth, eventMultiplier, isRushHour, activeSeasonal } from '../engine.js';
import { formatMoney, formatRate } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Your lifetime economy stats and the current event multipliers'),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const period = new Date().toISOString().slice(0, 7);
    const payouts = economy.listStaffPayouts(guildId, period).find((p) => p.userId === user.id);
    const ticketStats = staffStats(guildId, period).find((s) => s.userId === user.id);

    const openTickets = countAllOpenTickets(guildId);
    const events = [
      `Rush Hour ${isRushHour() ? `**active ×${ECONOMY.events.rushHour.multiplier}**` : `(${ECONOMY.events.rushHour.startHour}:00–${ECONOMY.events.rushHour.endHour}:00 UTC)`}`,
      ...activeSeasonal().map((s) => `**${s.name} ×${s.multiplier}**`),
      openTickets === 0 ? `Quiet queue **×${ECONOMY.quietQueueBonus.multiplier}**` : `Quiet queue (${openTickets} open)`,
    ];

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📈 Your stats')
      .addFields(
        { name: 'Balance', value: `${formatMoney(state.user.cash)} ${ECONOMY.currency}`, inline: true },
        { name: 'Net worth', value: formatMoney(netWorth(state)), inline: true },
        { name: 'Income', value: formatRate(hourlyRate(state)), inline: true },
        { name: 'Businesses', value: String(state.locations.length), inline: true },
        { name: 'Ingredients', value: String(state.user.ingredients), inline: true },
        { name: 'Daily streak', value: String(state.user.daily_streak ?? 0), inline: true },
        { name: 'Tickets closed this month', value: String(ticketStats?.reasoned ?? 0), inline: true },
        {
          name: 'Staff payouts this month',
          value: payouts ? `${formatMoney(payouts.amount)} across ${payouts.closures} closure(s)${payouts.amount >= ECONOMY.staffPayouts.monthlyCapPerStaff ? ' (capped)' : ''}` : '—',
          inline: true,
        },
        {
          name: 'Events now',
          value: `Live multiplier: **×${eventMultiplier(Date.now(), { openTickets }).toFixed(2)}**\n${events.join(' · ')}`,
        }
      )
      .setFooter({ text: `Seasonal windows and caps are configured in src/economy/config.js` });

    return interaction.reply({ embeds: [embed] });
  },
};
