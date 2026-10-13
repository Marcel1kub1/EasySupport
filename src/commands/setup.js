import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { saveGuildSettings } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure ticketing for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption((o) =>
      o.setName('staff_role').setDescription('Role allowed to claim and close tickets').setRequired(true)
    )
    .addChannelOption((o) =>
      o.setName('log_channel').setDescription('Channel that receives ticket log entries').setRequired(true)
    )
    .addChannelOption((o) =>
      o
        .setName('category')
        .setDescription('Category under which ticket channels are created')
        .setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName('max_open')
        .setDescription('Max simultaneously open tickets per member (default 2)')
        .setMinValue(1)
        .setMaxValue(10)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffRole = interaction.options.getRole('staff_role');
    const logChannel = interaction.options.getChannel('log_channel');
    const category = interaction.options.getChannel('category');

    if (category.type !== ChannelType.GuildCategory) {
      return interaction.editReply('The `category` option must be a category, not a text channel.');
    }
    if (!logChannel.isTextBased()) {
      return interaction.editReply('The `log_channel` option must be a text channel.');
    }

    saveGuildSettings({
      guildId: interaction.guildId,
      staffRoleId: staffRole.id,
      logChannelId: logChannel.id,
      ticketCategoryId: category.id,
      maxOpenTickets: interaction.options.getInteger('max_open') ?? 2,
    });

    const missingPerms = [];
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      missingPerms.push('Manage Channels');
    }
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      missingPerms.push('Manage Roles');
    }

    const warning = missingPerms.length
      ? `\n\n⚠️ The bot is missing these permissions: ${missingPerms.join(', ')}. Grant them or ticket creation will fail.`
      : '';

    await interaction.editReply(
      `Ticketing configured.\n- Staff role: <@&${staffRole.id}>\n- Log channel: <#${logChannel.id}>\n- Ticket category: ${category.name}${warning}\n\nPost a panel with \`/panel\`.`
    );
  },
};
