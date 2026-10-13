import { SlashCommandBuilder } from 'discord.js';
import { ECONOMY } from '../config.js';
import { isRushHour, rushHourMultiplier } from '../engine.js';
import { formatDuration } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rushhour')
    .setDescription('Rush Hour info: when the 2x passive window runs'),
  async execute(interaction) {
    const now = Date.now();
    const active = isRushHour(now);
    const { startHour, endHour, multiplier } = ECONOMY.events.rushHour;

    const nextStart = () => {
      const d = new Date(now);
      d.setUTCHours(startHour, 0, 0, 0);
      if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1);
      return d.getTime();
    };

    const content = active
      ? `⚡ **Rush Hour is ON** — all passive income pays **×${multiplier}** right now!\nWindow: ${startHour}:00–${endHour}:00 UTC (ends in ${formatDuration(
          (() => {
            const d = new Date(now);
            d.setUTCHours(endHour, 0, 0, 0);
            return Math.max(0, d.getTime() - now);
          })()
        )}).`
      : `⚡ **Rush Hour** pays ×${multiplier} on all passive income.\nWindow: ${startHour}:00–${endHour}:00 UTC — next one starts in **${formatDuration(nextStart() - now)}**.`;

    return interaction.reply({ content });
  },
};
