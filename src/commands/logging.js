import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import {
  getGuild,
  isModuleEnabled,
  getLoggingConfig,
  setLoggingConfig,
  getRolePermission,
} from '../db.js';

const MODULE = 'logging';

export default {
  data: new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Configure logging channels for moderation, tickets, messages, voice, and members.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o.setName('type').setDescription('Log type to configure').addChoices(
        { name: 'Moderation', value: 'mod' },
        { name: 'Tickets', value: 'ticket' },
        { name: 'Messages', value: 'message' },
        { name: 'Voice', value: 'voice' },
        { name: 'Members', value: 'member' },
      ),
    )
    .addChannelOption((o) => o.setName('channel').setDescription('Log channel').setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    if (!(await isModuleEnabled(interaction.guildId, MODULE))) {
      return interaction.reply({ content: 'The Logging module is disabled for this server.', flags: MessageFlags.Ephemeral });
    }

    const hasPerm = await checkRolePermission(interaction.guildId, interaction.member, 'logging');
    if (!hasPerm) {
      return interaction.reply({ content: 'You do not have permission to configure logging.', flags: MessageFlags.Ephemeral });
    }

    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');

    const existing = await getLoggingConfig(interaction.guildId) || {};

    const updates = {};
    if (type === 'mod') updates.mod_log_channel_id = channel?.id ?? null;
    if (type === 'ticket') updates.ticket_log_channel_id = channel?.id ?? null;
    if (type === 'message') updates.message_log_channel_id = channel?.id ?? null;
    if (type === 'voice') updates.voice_log_channel_id = channel?.id ?? null;
    if (type === 'member') updates.member_log_channel_id = channel?.id ?? null;

    await setLoggingConfig(interaction.guildId, {
      ...existing,
      ...updates,
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${type.charAt(0).toUpperCase() + type.slice(1)} Logging`)
      .addFields(
        { name: 'Channel', value: channel ? `<#${channel.id}>` : 'cleared', inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

async function checkRolePermission(guildId, member, commandName) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const roles = member.roles.cache;
  for (const [roleId] of roles) {
    const allowed = await getRolePermission(guildId, roleId, commandName);
    if (allowed === false) return false;
  }
  return true;
}
