import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import {
  getGuild,
  isModuleEnabled,
  getManagementRole,
} from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('highrankdm')
    .setDescription('Send a direct message to a user or notify all members of a role (Management only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) =>
      o.setName('user').setDescription('The user to DM').setRequired(false),
    )
    .addRoleOption((o) =>
      o.setName('role').setDescription('The role whose members to notify').setRequired(false),
    )
    .addStringOption((o) =>
      o.setName('message').setDescription('The message to send').setRequired(true),
    ),
  async execute(interaction, client) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    const settings = await getGuild(interaction.guildId);

    // Module gating.
    if (!(await isModuleEnabled(interaction.guildId, 'highrankdm'))) {
      return interaction.reply({ content: 'The HighRankDM module is disabled for this server.', flags: MessageFlags.Ephemeral });
    }

    // Authorization: Management role or Administrator.
    const managementRoleId = settings?.management_role_id;
    const isManagement = managementRoleId && interaction.member.roles.cache.has(managementRoleId);
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isManagement && !isAdmin) {
      return interaction.reply({ content: 'You must hold the Management role to use this command.', flags: MessageFlags.Ephemeral });
    }

    const targetUser = interaction.options.getUser('user');
    const targetRole = interaction.options.getRole('role');
    const message = interaction.options.getString('message');

    if (!targetUser && !targetRole) {
      return interaction.reply({ content: 'You must specify a user or a role to notify.', flags: MessageFlags.Ephemeral });
    }
    if (targetUser && targetRole) {
      return interaction.reply({ content: 'Specify either a user or a role, not both.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let sent = 0;
    let failed = 0;

    const embed = new EmbedBuilder()
      .setColor(0x4a3b32)
      .setTitle('HighRankDM — Notification')
      .setDescription(message)
      .setFooter({ text: `Sent by ${interaction.user.tag} (${interaction.guild.name})` })
      .setTimestamp();

    if (targetUser) {
      try {
        await targetUser.send({ embeds: [embed] });
        sent = 1;
      } catch {
        failed = 1;
      }
    } else if (targetRole) {
      const members = targetRole.members.filter((m) => !m.user.bot);
      for (const member of members.values()) {
        try {
          await member.user.send({ embeds: [embed] });
          sent += 1;
        } catch {
          failed += 1;
        }
      }
    }

    await interaction.editReply({
      content: `✅ Notification sent.\n• Delivered: ${sent}\n• Failed: ${failed}`,
      embeds: [],
    });
  },
};
