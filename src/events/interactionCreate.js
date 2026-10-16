import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  closeTicket,
  countOpenTickets,
  createTicket,
  getGuild,
  getTicketById,
  getTicketByChannel,
  getTicketMessages,
  isBlacklisted,
  nextTicketNumber,
  rateTicket,
  setPanelMessageId,
  updateTicketStatus,
} from '../db.js';
import { CATEGORIES, DEFAULT_STATUS, TICKET_STATUSES, getStatusMeta, resolveStaffRole } from '../categories.js';
import { categoryArt } from '../art.js';
import { saveTranscripts } from '../transcripts.js';

const COLORS = { blurple: 0x5865f2, green: 0x57f287, red: 0xed4245, yellow: 0xfee75c };
const PANEL_COOLDOWN_MS = 5_000;
const panelCooldowns = new Map();

/*
 * Discord can re-dispatch an interaction (gateway resume, a second client
 * sharing the token). Handling it twice acknowledges it twice — the second
 * defer/reply throws 40060 — so every interaction is processed at most once.
 * The set is cleared wholesale every 5 minutes; ids are snowflakes and unique.
 */
const HANDLED_TTL_MS = 5 * 60_000;
const handledInteractions = new Set();
let handledSweep = 0;

function firstHandling(interaction) {
  const now = Date.now();
  if (now - handledSweep > HANDLED_TTL_MS) {
    handledInteractions.clear();
    handledSweep = now;
  }
  if (handledInteractions.has(interaction.id)) return false;
  handledInteractions.add(interaction.id);
  return true;
}

/** Acknowledges only if nobody has acknowledged this interaction yet. */
async function acknowledge(interaction) {
  if (interaction.replied || interaction.deferred) return;
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    if (error?.code !== 40060) throw error;
    console.warn(`[interaction] ${interaction.id} was already acknowledged — continuing.`);
  }
}

export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!firstHandling(interaction)) return;
    try {
      if (interaction.isButton()) return handleButton(interaction, client);
      if (interaction.isModalSubmit()) return handleModalSubmit(interaction, client);
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction, client);
      }
    } catch (error) {
      console.error('[interaction] Failed to handle interaction:', error);
      const payload = { content: 'Something went wrong. Please try again.', flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};

/* -------------------------------- routing --------------------------------- */

async function handleButton(interaction, client) {
  const id = interaction.customId;

  if (id.startsWith('ticket:open:')) return onPanelClick(interaction, client);

  if (id.startsWith('ticket:status:')) {
    const rest = id.slice('ticket:status:'.length);
    if (rest === 'cancel' || id === 'ticket:cancel') {
      return interaction.update({ content: 'Cancelled.', components: [] }).catch(() => {});
    }
    if (rest.startsWith('confirm:')) {
      return onStatusConfirm(interaction, rest.slice('confirm:'.length));
    }
    return onStatusButton(interaction, rest);
  }

  if (id.startsWith('ticket:rate:')) return onRatingClick(interaction);
}

async function handleModalSubmit(interaction, client) {
  if (interaction.customId.startsWith('ticket:intake:')) {
    const key = interaction.customId.slice('ticket:intake:'.length);
    const category = CATEGORIES[key];
    if (!category) return interaction.reply({ content: 'Unknown category.', flags: MessageFlags.Ephemeral });

  const questions = category.questions.slice(0, 5);
  const answers = questions.map((q, i) => ({
    question: q.label,
    answer: interaction.fields.getTextInputValue(`q${i}`),
  }));
    return openTicket(interaction, client, key, answers);
  }

  if (interaction.customId.startsWith('ticket:status:reason:')) {
    const key = interaction.customId.slice('ticket:status:reason:'.length);
    const reason = interaction.fields.getTextInputValue('reason').trim();
    return finalizeClose(interaction, key, reason);
  }
}

/* ---------------------------- ticket creation ----------------------------- */

async function onPanelClick(interaction, client) {
  const key = interaction.customId.slice('ticket:open:'.length);
  const category = CATEGORIES[key];
  if (!category) {
    return interaction.reply({ content: 'Unknown ticket category.', flags: MessageFlags.Ephemeral });
  }

  // Lightweight anti-spam: one panel click per user every few seconds.
  const now = Date.now();
  if (now - (panelCooldowns.get(interaction.user.id) ?? 0) < PANEL_COOLDOWN_MS) {
    return interaction.reply({
      content: 'Please wait a few seconds before opening another ticket.',
      flags: MessageFlags.Ephemeral,
    });
  }
  panelCooldowns.set(interaction.user.id, now);

  const settings = getGuild(interaction.guildId);
  if (!settings?.staff_role_id || !settings.log_channel_id || !settings.ticket_category_id) {
    return interaction.reply({
      content: 'Ticketing is not configured yet. An admin must run `/setup` first.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (isBlacklisted(interaction.guildId, interaction.user.id)) {
    return interaction.reply({ content: 'You are not allowed to open tickets.', flags: MessageFlags.Ephemeral });
  }

  // Counts every non-terminal status (open, pending, claimed, escalated, ...).
  const open = countOpenTickets(interaction.guildId, interaction.user.id);
  if (open >= settings.max_open_tickets) {
    return interaction.reply({
      content: `You already have ${open} open ticket(s) — the limit is ${settings.max_open_tickets}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (category.questions.length) {
    return interaction.showModal(buildIntakeModal(key, category));
  }

  return openTicket(interaction, client, key, null);
}

function buildIntakeModal(key, category) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket:intake:${key}`)
    .setTitle(`${category.label} — intake`);

  category.questions.slice(0, 5).forEach((q, i) => {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`q${i}`)
          .setLabel(q.label)
          .setStyle(q.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(q.required !== false)
          .setMaxLength(q.style === 'paragraph' ? 1000 : 200)
      )
    );
  });

  return modal;
}

async function openTicket(interaction, client, key, answers) {
  const settings = getGuild(interaction.guildId);
  const category = CATEGORIES[key];
  const guild = interaction.guild;
  const number = nextTicketNumber(interaction.guildId);

  // Category staff role (name or ID from src/categories.js): resolved against
  // this guild; unknown values are skipped so nothing breaks.
  const configuredCategoryRole = category.staffRole ?? category.staffRoleId;
  const categoryRole = resolveStaffRole(guild, configuredCategoryRole);
  const categoryRoleId = categoryRole?.id ?? null;
  if (configuredCategoryRole && !categoryRole) {
    console.warn(
      `[tickets] Category "${key}" references staff role "${configuredCategoryRole}", which does not exist in ${guild.name}.`
    );
  }

  await acknowledge(interaction);

  // The channel is invisible to everyone except the opener, the staff roles
  // and the bot itself.
  const sanitized = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const channel = await guild.channels.create({
    name: `ticket-${sanitized}-${number}`,
    type: ChannelType.GuildText,
    parent: settings.ticket_category_id,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      {
        id: settings.staff_role_id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageMessages,
        ],
      },
      // Category staff role gets the same access as the main staff role.
      ...(categoryRoleId
        ? [
            {
              id: categoryRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ManageMessages,
              ],
            },
          ]
        : []),
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });

  const ticketId = createTicket({
    guildId: guild.id,
    channelId: channel.id,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    category: key,
  });

  const initialStatus = getStatusMeta(DEFAULT_STATUS);
  const fields = [
    { name: 'Opened by', value: `<@${interaction.user.id}>`, inline: true },
    { name: 'Status', value: statusText(initialStatus, interaction.user), inline: true },
  ];
  for (const answer of answers ?? []) {
    fields.push({
      name: answer.question.slice(0, 256),
      value: answer.answer.slice(0, 1024) || '(empty)',
    });
  }

  const control = new EmbedBuilder()
    .setColor(COLORS.blurple)
    .setTitle(`Ticket #${ticketId} — ${category.label}`)
    .setDescription(
      `${category.description ?? 'Our team will reply shortly.'}\n\nPlease describe what was happening when the problem occurred and include any screenshots — it helps us reply faster.`
    )
    .addFields(fields)
    .setImage('attachment://ticket-art.png')
    .setTimestamp();

  /*
   * The whole ticket lives in this one message: generated category art, the
   * status overview, the intake answers and the status buttons. The staff ping
   * rides in the message content because a mention inside the embed would not
   * notify anybody.
   */
  const panelMessage = await channel.send({
    content: categoryRoleId
      ? `<@&${categoryRoleId}> — a new${priority ? ' ⚡ **priority**' : ''} **${category.label}** ticket was opened by <@${interaction.user.id}>.`
      : `<@${interaction.user.id}> thanks for getting in touch.`,
    allowedMentions: categoryRoleId ? { roles: [categoryRoleId] } : { users: [interaction.user.id] },
    embeds: [control],
    components: statusButtonRows(DEFAULT_STATUS),
    files: [{ attachment: await categoryArt(key, category.label, category.emoji), name: 'ticket-art.png' }],
  });
  setPanelMessageId(ticketId, panelMessage.id);

  await sendLog(
    interaction.guildId,
    client,
    new EmbedBuilder()
      .setColor(COLORS.green)
      .setTitle('Ticket opened')
      .addFields(
        { name: 'Ticket', value: `#${ticketId} (${category.label})`, inline: true },
        { name: 'Opened by', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Channel', value: `<#${channel.id}>`, inline: true }
      )
      .setTimestamp()
  );

  await interaction.editReply(`Your ticket is ready: <#${channel.id}>`);
}

/* --------------------- status system (config-driven) ---------------------- */
/*
 * Every status defined in TICKET_STATUSES (src/categories.js) automatically
 * becomes a button on the ticket control panel. Non-terminal statuses change
 * state (and ping their staffRole, granting it channel access); terminal
 * statuses run the close protocol. No per-status code exists anywhere.
 */

function statusText(meta, user) {
  const base = `${meta.emoji} ${meta.label}`;
  return meta.claimable && user ? `${base} <@${user.id}>` : base;
}

function statusButtonRows(currentStatus) {
  const usable = Object.keys(TICKET_STATUSES).filter(
    (key) => key !== currentStatus && getStatusMeta(key).staffOnly !== false
  );

  const group = (terminal) => usable.filter((key) => getStatusMeta(key).terminal === terminal);

  const rows = [];
  for (const batch of [group(false), group(true)]) {
    for (let i = 0; i < batch.length; i += 5) {
      rows.push(
        new ActionRowBuilder().addComponents(
          batch.slice(i, i + 5).map((key) => {
            const meta = getStatusMeta(key);
            const button = new ButtonBuilder()
              .setCustomId(`ticket:status:${key}`)
              .setLabel(meta.label)
              .setStyle(meta.terminal ? ButtonStyle.Danger : ButtonStyle.Secondary);
            if (meta.emoji) button.setEmoji(meta.emoji);
            return button;
          })
        )
      );
    }
  }
  return rows;
}

function isStaff(interaction) {
  const settings = getGuild(interaction.guildId);
  return (
    interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    interaction.member.roles.cache.has(settings?.staff_role_id)
  );
}

async function onStatusButton(interaction, key) {
  const meta = getStatusMeta(key);
  if (!meta) return interaction.reply({ content: 'Unknown status.', flags: MessageFlags.Ephemeral });

  if (meta.staffOnly !== false && !isStaff(interaction)) {
    return interaction.reply({ content: 'Only staff can change the ticket status.', flags: MessageFlags.Ephemeral });
  }

  const ticket = getTicketByChannel(interaction.channelId);
  if (!ticket) return interaction.reply({ content: 'This channel is not a ticket.', flags: MessageFlags.Ephemeral });

  const current = getStatusMeta(ticket.status);
  if (current?.terminal) {
    return interaction.reply({ content: `This ticket is already ${current.label}.`, flags: MessageFlags.Ephemeral });
  }
  if (ticket.status === key) {
    return interaction.reply({ content: `This ticket is already "${meta.label}".`, flags: MessageFlags.Ephemeral });
  }

  if (meta.terminal) return showCloseConfirmation(interaction, key, meta);
  return applyStatus(interaction, ticket, key, meta);
}

async function applyStatus(interaction, ticket, key, meta) {
  const ok = updateTicketStatus(interaction.channelId, key, meta.claimable ? interaction.user.id : null);
  if (!ok) {
    return interaction.reply({ content: 'Could not update the ticket status.', flags: MessageFlags.Ephemeral });
  }

  if (ticket.panel_message_id) {
    const panelMessage = await interaction.channel.messages.fetch(ticket.panel_message_id).catch(() => null);
    if (panelMessage?.embeds[0]) {
      const updated = EmbedBuilder.from(panelMessage.embeds[0]);
      updated.spliceFields(1, 1, { name: 'Status', value: statusText(meta, interaction.user), inline: true });
      await panelMessage.edit({ embeds: [updated], components: statusButtonRows(key) }).catch(() => {});
    }
  }

  // Staff role attached to this status: resolve name/ID, grant channel access,
  // then ping once.
  let pingRoleId = null;
  const configuredRole = meta.staffRole ?? meta.staffRoleId;
  if (configuredRole) {
    const role = resolveStaffRole(interaction.guild, configuredRole);
    if (role) {
      await interaction.channel.permissionOverwrites
        .edit(role.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        })
        .catch(() => {});
      pingRoleId = role.id;
    } else {
      console.warn(
        `[tickets] Status "${key}" references staff role "${configuredRole}", which does not exist in ${interaction.guild.name}.`
      );
    }
  }

  await interaction.reply({ content: `Status set to ${meta.emoji} **${meta.label}**.` });

  if (pingRoleId) {
    await interaction.channel.send({
      content: `<@&${pingRoleId}> — ticket #${ticket.id} moved to **${meta.label}**.`,
      allowedMentions: { roles: [pingRoleId] },
    });
  }

  await sendLog(
    interaction.guildId,
    interaction.client,
    new EmbedBuilder()
      .setColor(COLORS.blurple)
      .setTitle('Ticket status changed')
      .addFields(
        { name: 'Ticket', value: `#${ticket.id}`, inline: true },
        { name: 'Status', value: statusText(meta, meta.claimable ? interaction.user : null), inline: true },
        { name: 'Set by', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp()
  );
}

/* -------------------------- terminal status flow -------------------------- */

async function showCloseConfirmation(interaction, key, meta) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:status:confirm:${key}`)
      .setLabel(`Confirm ${meta.label}`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    content: `${meta.label} this ticket? The user will receive the transcript and a rating prompt.`,
    flags: MessageFlags.Ephemeral,
    components: [row],
  });
}

async function onStatusConfirm(interaction, key) {
  const meta = getStatusMeta(key);
  if (!meta) return interaction.reply({ content: 'Unknown status.', flags: MessageFlags.Ephemeral });

  if (meta.staffOnly !== false && !isStaff(interaction)) {
    return interaction.reply({ content: 'Only staff can change the ticket status.', flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder().setCustomId(`ticket:status:reason:${key}`).setTitle(meta.label);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel(`Reason for ${meta.label.toLowerCase()} (optional)`)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
    )
  );
  return interaction.showModal(modal);
}

async function finalizeClose(interaction, key, reason) {
  const meta = getStatusMeta(key);
  if (!meta) {
    return interaction.reply({ content: 'Unknown status.', flags: MessageFlags.Ephemeral });
  }
  await acknowledge(interaction);

  const ticket = getTicketByChannel(interaction.channelId);
  const current = ticket ? getStatusMeta(ticket.status) : null;
  if (!ticket || current?.terminal) {
    return interaction.editReply(`This ticket is already ${current?.label ?? 'closed'}.`);
  }

  closeTicket(interaction.channelId, key, reason || null, interaction.user.id);

  const closed = getTicketById(ticket.id);
  const messages = getTicketMessages(ticket.id);
  const { textPath, htmlPath } = saveTranscripts(closed, messages);

  // Rating prompt + transcripts, delivered by DM.
  const ratingRow = new ActionRowBuilder().addComponents(
    [1, 2, 3, 4, 5].map((n) =>
      new ButtonBuilder()
        .setCustomId(`ticket:rate:${ticket.id}:${n}`)
        .setLabel(String(n))
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const user = await interaction.client.users.fetch(ticket.user_id).catch(() => null);
  let dmDelivered = false;
  if (user) {
    dmDelivered = await user
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.green)
            .setTitle(`Ticket #${ticket.id} is ${meta.label.toLowerCase()}`)
            .setDescription(
              `Reason: ${reason || 'no reason given'}\n\nPlease rate the support you received:`
            ),
        ],
        components: [ratingRow],
        files: [
          { attachment: textPath, name: `ticket-${ticket.id}.txt` },
          { attachment: htmlPath, name: `ticket-${ticket.id}.html` },
        ],
      })
      .then(() => true)
      .catch(() => false);
  }

  await sendLog(
    interaction.guildId,
    interaction.client,
    new EmbedBuilder()
      .setColor(COLORS.red)
      .setTitle('Ticket status changed')
      .addFields(
        { name: 'Ticket', value: `#${ticket.id}`, inline: true },
        { name: 'Status', value: `${meta.emoji} ${meta.label}`, inline: true },
        { name: 'Set by', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Claimed by', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : '—', inline: true },
        { name: 'Reason', value: reason || '—' },
        { name: 'Transcript', value: dmDelivered ? `DM'd to <@${ticket.user_id}>` : `saved on server: \`${htmlPath}\`` },
        { name: 'Messages logged', value: String(messages.length), inline: true }
      )
      .setTimestamp()
  );

  await interaction.editReply(`Ticket ${meta.label.toLowerCase()}. Deleting this channel in 10 seconds…`);
  setTimeout(() => {
    interaction.channel?.delete(`Ticket #${ticket.id} closed by ${interaction.user.tag}`).catch(() => {});
  }, 10_000);
}

async function onRatingClick(interaction) {
  const [, , ticketIdPart, ratingPart] = interaction.customId.split(':');
  const ticket = getTicketById(Number(ticketIdPart));

  if (!ticket) return interaction.reply({ content: 'Unknown ticket.', flags: MessageFlags.Ephemeral });
  if (ticket.user_id !== interaction.user.id) {
    return interaction.reply({ content: 'You can only rate your own ticket.', flags: MessageFlags.Ephemeral });
  }

  const rating = Number(ratingPart);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return interaction.reply({ content: 'Invalid rating.', flags: MessageFlags.Ephemeral });
  }

  rateTicket(ticket.id, ticket.user_id, rating);
  await interaction
    .update({ content: `Thanks! You rated this ticket ${rating}/5 ${'⭐'.repeat(rating)}`, components: [] })
    .catch(() => {});
}

/* --------------------------------- helpers -------------------------------- */

async function sendLog(guildId, client, embed) {
  const settings = getGuild(guildId);
  if (!settings?.log_channel_id) return;
  const channel = await client.channels.fetch(settings.log_channel_id).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send({ embeds: [embed] }).catch(() => {});
  }
}
