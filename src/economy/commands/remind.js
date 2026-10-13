import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { cooldownRemaining, formatDuration, nowIso, pickLocation } from '../util.js';

const MAX_REMINDERS = 5;

export default {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Get pinged when an action is ready again')
    .addStringOption((o) =>
      o.setName('action').setDescription('Which action').setRequired(true)
        .addChoices(
          { name: 'Work shift', value: 'work' },
          { name: 'Tip jar', value: 'tips' },
          { name: 'Mining', value: 'mine' },
          { name: 'Daily bonus', value: 'daily' },
          { name: 'Cleaning', value: 'clean' },
          { name: 'Advertising', value: 'advertise' }
        )
    ),
  async execute(interaction) {
    const { guildId, channelId } = interaction;
    const user = interaction.user;
    const action = interaction.options.getString('action');

    if (economy.countReminders(guildId, user.id) >= MAX_REMINDERS) {
      return interaction.reply({
        content: `You already have ${MAX_REMINDERS} reminders queued — wait for one to fire first.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const row = economy.ensureUser(guildId, user.id);
    const column = { work: 'last_work_at', tips: 'last_tips_at', mine: 'last_mine_at', daily: 'last_daily_at', clean: 'last_clean_at', advertise: 'last_ad_at' }[action];
    const remaining = cooldownRemaining(row, column, ECONOMY.cooldowns[action] ?? ECONOMY.cooldowns[action === 'advertise' ? 'advertise' : 'work']);
    const dueAt = Date.now() + remaining;

    economy.addReminder(guildId, channelId, user.id, action, dueAt);
    return interaction.reply({
      content: `⏰ I'll ping you when **/${action}** is ready${remaining > 0 ? ` (in ${formatDuration(remaining)})` : ' — it is ready now!'}.`,
    });
  },
};
