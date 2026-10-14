import { SlashCommandBuilder } from 'discord.js';
import { ECONOMY } from '../config.js';
import { hourlyRate, isRushHour, isLunchRush, activeSeasonal } from '../engine.js';
import { economy } from '../instance.js';
import { countAllOpenTickets } from '../../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Current and upcoming Taco Empire events')
    .addSubcommand((sub) => sub.setName('info').setDescription('What is running now')),
  async execute(interaction) {
    const now = Date.now();
    const { happyHour, rushHour, lunchRush } = ECONOMY.events;

    const openTickets = countAllOpenTickets(interaction.guildId);
    const seasonal = activeSeasonal(now);

    const lines = [
      `⚡ **Rush Hour** — ×${rushHour.multiplier} passive, ${rushHour.startHour}:00–${rushHour.endHour}:00 UTC · **${isRushHour(now) ? 'ACTIVE NOW' : 'scheduled'}**`,
      `🎉 **Happy Hour** — ×${happyHour.multiplier} on /work with a ${Math.round(happyHour.chancePerWork * 100)}% chance per shift · always on`,
      `🥗 **Lunch Rush** — ×${lunchRush.tipsMultiplier} tips on weekends · **${isLunchRush(now) ? 'ACTIVE NOW' : 'weekdays: off'}**`,
      `🧹 **Quiet queue** — ×${ECONOMY.quietQueueBonus.multiplier} while the server has 0 open tickets · **${openTickets === 0 ? 'ACTIVE NOW' : `${openTickets} ticket(s) open`}**`,
      ...seasonal.map((s) => `🎊 **${s.name}** — ×${s.multiplier} everything · ${s.note}`),
    ];

    return interaction.reply({
      content: `📅 **Events**\n${lines.join('\n')}\n\nTip: set a \`/remind\` so you never miss Rush Hour.`,
    });
  },
};
