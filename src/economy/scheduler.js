/*
 * Reminder scheduler: every minute, fire due economy reminders by DM (falling
 * back to a channel ping when DMs are closed). Started once from src/index.js.
 */

export function startReminderScheduler(client, economy) {
  const tick = async () => {
    let due;
    try {
      due = economy.listDueReminders();
    } catch (error) {
      console.error('[economy] Reminder tick failed:', error.message ?? error);
      return;
    }
    for (const reminder of due) {
      try {
        const user = await client.users.fetch(reminder.user_id);
        await user.send(`⏰ Your **/${reminder.action}** is ready — go collect!`);
      } catch {
        // DMs closed: ping in the original channel instead
        const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
        if (channel) {
          await channel.send(`⏰ <@${reminder.user_id}> your **/${reminder.action}** is ready!`).catch(() => {});
        }
      }
      economy.deleteReminder(reminder.id);
    }
  };

  const timer = setInterval(tick, 60_000);
  timer.unref();
  console.log('[economy] Reminder scheduler started.');
}
