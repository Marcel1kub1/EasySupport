import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { todayPeriod } from '../db.js';
import { ECONOMY } from '../config.js';
import { formatMoney } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tasks')
    .setDescription('Daily tasks: view progress and claim rewards')
    .addSubcommand((sub) => sub.setName('view').setDescription("Today's tasks"))
    .addSubcommand((sub) =>
      sub
        .setName('claim')
        .setDescription('Claim a finished task reward')
        .addStringOption((o) =>
          o.setName('task').setDescription('Which task').setRequired(true)
            .addChoices(...ECONOMY.tasks.pool.map((t) => ({ name: t.label, value: t.key })))
        )
    ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const period = todayPeriod();

    if (interaction.options.getSubcommand() === 'claim') {
      const key = interaction.options.getString('task');
      const task = ECONOMY.tasks.pool.find((t) => t.key === key);
      if (!task) {
        return interaction.reply({ content: 'Unknown task.', flags: MessageFlags.Ephemeral });
      }
      const rows = economy.listTasks(guildId, user.id, period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
      const row = rows.find((r) => r.key === key);
      if (!row) {
        return interaction.reply({ content: `**${task.label}** isn't on today's list.`, flags: MessageFlags.Ephemeral });
      }
      if (row.progress < task.goal) {
        return interaction.reply({
          content: `**${task.label}** — ${row.progress}/${task.goal} done. Keep going!`,
          flags: MessageFlags.Ephemeral,
        });
      }
      if (row.claimed) {
        return interaction.reply({ content: `You already claimed **${task.label}** today.`, flags: MessageFlags.Ephemeral });
      }
      economy.claimTask(guildId, user.id, period, key);
      const balance = economy.addCash(guildId, user.id, task.reward);
      return interaction.reply({
        content: `✅ Claimed **${task.label}**: +${formatMoney(task.reward)} ${ECONOMY.currency} (balance ${formatMoney(balance)}).`,
      });
    }

    const rows = economy.listTasks(guildId, user.id, period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
    const lines = rows.map((task) => {
      const done = task.progress >= task.goal;
      const state = task.claimed ? '✅ claimed' : done ? '🎁 claimable with /tasks claim' : `${task.progress}/${task.goal}`;
      return `${done ? '🌮' : '⏳'} **${task.label}** — ${state} · reward ${formatMoney(task.reward)}`;
    });
    return interaction.reply({
      content: `📋 **Today's tasks** (resets at midnight UTC):\n${lines.join('\n')}`,
    });
  },
};
