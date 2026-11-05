import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  isModuleEnabled,
  getWelcomeGoodbyeBoostConfig,
  setWelcomeGoodbyeBoostConfig,
  getRolePermission,
} from '../db.js';

const MODULE = 'welcome_goodbye_boost';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome_goodbye_boost')
    .setDescription('Configure welcome, goodbye, and boost messages.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o.setName('type').setDescription('Type to configure').addChoices(
        { name: 'Welcome', value: 'welcome' },
        { name: 'Goodbye', value: 'goodbye' },
        { name: 'Boost', value: 'boost' },
      ),
    )
    .addBooleanOption((o) => o.setName('enabled').setDescription('Enable or disable').setRequired(false))
    .addChannelOption((o) => o.setName('channel').setDescription('Channel for messages').setRequired(false))
    .addStringOption((o) => o.setName('message').setDescription('Message template').setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    if (!(await isModuleEnabled(interaction.guildId, MODULE))) {
      return interaction.reply({ content: 'The Welcome/Goodbye/Boost module is disabled for this server.', flags: MessageFlags.Ephemeral });
    }

    const hasPerm = await checkRolePermission(interaction.guildId, interaction.member, 'welcome_goodbye_boost');
    if (!hasPerm) {
      return interaction.reply({ content: 'You do not have permission to configure welcome/goodbye/boost.', flags: MessageFlags.Ephemeral });
    }

    const type = interaction.options.getString('type');
    const enabled = interaction.options.getBoolean('enabled');
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    const existing = await getWelcomeGoodbyeBoostConfig(interaction.guildId) || {};

    const updates = {};
    if (type === 'welcome') {
      updates.welcome_enabled = enabled ?? existing.welcome_enabled ?? false;
      if (channel) updates.welcome_channel_id = channel.id;
      if (message) updates.welcome_message = message;
    } else if (type === 'goodbye') {
      updates.goodbye_enabled = enabled ?? existing.goodbye_enabled ?? false;
      if (channel) updates.goodbye_channel_id = channel.id;
      if (message) updates.goodbye_message = message;
    } else if (type === 'boost') {
      updates.boost_enabled = enabled ?? existing.boost_enabled ?? false;
      if (channel) updates.boost_channel_id = channel.id;
      if (message) updates.boost_message = message;
    }

    await setWelcomeGoodbyeBoostConfig(interaction.guildId, {
      ...existing,
      ...updates,
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${type.charAt(0).toUpperCase() + type.slice(1)} Configuration`)
      .addFields(
        { name: 'Enabled', value: (updates.enabled ?? existing[`${type}_enabled`] ?? false) ? '✅ Yes' : '❌ No', inline: true },
        { name: 'Channel', value: channel ? `<#${channel.id}>` : 'not set', inline: true },
        { name: 'Message', value: message ?? 'not set', inline: false },
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
