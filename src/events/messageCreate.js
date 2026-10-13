import { getTicketByChannel, logMessage } from '../db.js';
import { getStatusMeta } from '../categories.js';

/*
 * Automated interaction logging: every message sent inside a ticket channel
 * that has not reached a terminal status is stored, so a complete transcript
 * can be produced on closure.
 */
export default {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const ticket = getTicketByChannel(message.channel.id);
    if (!ticket || getStatusMeta(ticket.status)?.terminal) return;

    const content =
      message.content?.trim() ||
      (message.attachments.size > 0 ? `[${message.attachments.size} attachment(s)]` : '[no text content]');

    logMessage({
      ticketId: ticket.id,
      authorId: message.author.id,
      authorTag: message.author.tag,
      content,
      createdAt: message.createdAt.toISOString(),
    });
  },
};
