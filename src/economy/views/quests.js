import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney } from '../util.js';
import { dailyPeriod } from './helpers.js';

export async function render({ guildId, userId, action, args }) {
  const period = dailyPeriod();

  if (action === 'claim') {
    const rows = economy.listTasks(guildId, userId, period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
    const task = rows.find((r) => r.key === args[0]);
    if (!task) return { status: `That task isn't on today's list.`, embeds: [questsEmbed(guildId, userId)], rows: [questsRows(guildId, userId)] };
    if (task.claimed) return { status: `Already claimed **${task.label}** today.`, embeds: [questsEmbed(guildId, userId)], rows: [questsRows(guildId, userId)] };
    if (task.progress < task.goal) {
      return { status: `**${task.label}** — ${task.progress}/${task.goal}. Keep going!`, embeds: [questsEmbed(guildId, userId)], rows: [questsRows(guildId, userId)] };
    }
    economy.claimTask(guildId, userId, period, task.key);
    const balance = economy.addCash(guildId, userId, task.reward);
    return { status: `✅ Claimed **${task.label}**: +${formatMoney(task.reward)} (balance ${formatMoney(balance)}).`, embeds: [questsEmbed(guildId, userId)], rows: [questsRows(guildId, userId)] };
  }

  return { embeds: [questsEmbed(guildId, userId)], rows: [questsRows(guildId, userId)] };
}

function questsEmbed(guildId, userId) {
  const period = dailyPeriod();
  const rows = economy.listTasks(guildId, userId, period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
  const lines = rows.map((task) => {
    const done = task.progress >= task.goal;
    const state = task.claimed ? '✅ claimed' : done ? '🎁 claim below' : `${task.progress}/${task.goal}`;
    return `${done ? '🌮' : '⏳'} **${task.label}** — ${state} · 💵 ${formatMoney(task.reward)}`;
  });

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📋 Daily quests')
    .setDescription(lines.join('\n') + '\n\nProgress fills automatically while you play. New set at midnight UTC.')
    .setFooter({ text: `${rows.filter((r) => r.claimed).length}/${rows.length} claimed today` });
}

function questsRows(guildId, userId) {
  const period = dailyPeriod();
  const rows = economy.listTasks(guildId, userId, period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
  const row = new ActionRowBuilder();
  for (const task of rows) {
    if (task.claimed || task.progress < task.goal) continue;
    if (row.components.length >= 5) break;
    row.addComponents(
      new ButtonBuilder().setCustomId(`taco:claim:${task.key}`).setLabel(`Claim ${task.label}`).setStyle(ButtonStyle.Success)
    );
  }
  return row.components.length ? [row] : [];
}
