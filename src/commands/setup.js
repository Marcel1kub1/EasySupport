import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {
  getGuild,
  saveGuildSettings,
  setModuleEnabled,
  isModuleEnabled,
} from '../db.js';

const MODULES = ['ticket', 'highrankdm'];

/** In-progress configure form state, keyed by user id. */
const configureSessions = new Map();

function moduleBadge(enabled) {
  return enabled ? '✅ Enabled' : '❌ Disabled';
}

function settingsEmbed(guild, settings) {
  const embed = new EmbedBuilder()
    .setColor(0x4a3b32)
    .setTitle('EasySupport — Setup')
    .setDescription(
      'Welcome to EasySupport setup. Choose how you would like to configure ticketing for this server.\n\n' +
        '• **Quick Setup** — creates sensible defaults in one click.\n' +
        '• **Configure** — pick the log channel, ticket category and roles from dropdowns, then submit.\n' +
        '• Toggle modules and view current settings below.',
    )
    .addFields(
      {
        name: 'Staff role',
        value: settings?.staff_role_id ? `<@&${settings.staff_role_id}>` : 'not set',
        inline: true,
      },
      {
        name: 'Log channel',
        value: settings?.log_channel_id ? `<#${settings.log_channel_id}>` : 'not set',
        inline: true,
      },
      {
        name: 'Ticket category',
        value: settings?.ticket_category_id ? `<#${settings.ticket_category_id}>` : 'not set',
        inline: true,
      },
      {
        name: 'Management role',
        value: settings?.management_role_id ? `<@&${settings.management_role_id}>` : 'not set',
        inline: true,
      },
      {
        name: 'Ticket module',
        value: moduleBadge(isModuleEnabledSync(settings, 'ticket')),
        inline: true,
      },
      {
        name: 'HighRankDM module',
        value: moduleBadge(isModuleEnabledSync(settings, 'highrankdm')),
        inline: true,
      },
    )
    .setFooter({ text: 'Changes are saved to your guild settings.' });

  return embed;
}

function configureEmbed(guild, session) {
  const embed = new EmbedBuilder()
    .setColor(0x4a3b32)
    .setTitle('EasySupport — Configure')
    .setDescription(
      'Pick the channel and roles from the dropdowns below, then press **Submit**. ' +
        'Leave a dropdown untouched to keep its current value.',
    )
    .addFields(
      {
        name: 'Staff role',
        value: session.staffRoleId ? `<@&${session.staffRoleId}>` : 'not set',
        inline: true,
      },
      {
        name: 'Log channel',
        value: session.logChannelId ? `<#${session.logChannelId}>` : 'not set',
        inline: true,
      },
      {
        name: 'Ticket category',
        value: session.ticketCategoryId ? `<#${session.ticketCategoryId}>` : 'not set',
        inline: true,
      },
      {
        name: 'Management role',
        value: session.managementRoleId ? `<@&${session.managementRoleId}>` : 'not set',
        inline: true,
      },
    )
    .setFooter({ text: 'No IDs or mentions to type — select, submit, done.' });

  return embed;
}

function isModuleEnabledSync(settings, module) {
  if (!settings?.enabled_modules) return true;
  try {
    return JSON.parse(settings.enabled_modules).includes(module);
  } catch {
    return true;
  }
}

function panelButtons(settings) {
  const ticketEnabled = isModuleEnabledSync(settings, 'ticket');
  const hrEnabled = isModuleEnabledSync(settings, 'highrankdm');

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:quick').setLabel('Quick Setup').setStyle(ButtonStyle.Success).setEmoji('⚡'),
      new ButtonBuilder().setCustomId('setup:configure').setLabel('Configure').setStyle(ButtonStyle.Primary).setEmoji('🔧'),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup:toggle:ticket')
        .setLabel(`Ticket module: ${moduleBadge(ticketEnabled)}`)
        .setStyle(ticketEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('setup:toggle:highrankdm')
        .setLabel(`HighRankDM module: ${moduleBadge(hrEnabled)}`)
        .setStyle(hrEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
    ),
  ];
}

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure ticketing for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction, client) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const settings = await getGuild(interaction.guildId);
    const embed = settingsEmbed(interaction.guild, settings);

    const panel = await interaction.editReply({
      embeds: [embed],
      components: panelButtons(settings),
      fetchReply: true,
    });

    const collector = panel.createMessageComponentCollector({ time: 5 * 60_000 });

    collector.on('collect', async (button) => {
      if (button.user.id !== interaction.user.id) {
        return button.reply({ content: 'Only the person who ran /setup can use these buttons.', flags: MessageFlags.Ephemeral });
      }

      if (button.customId === 'setup:configure') {
        await button.deferReply({ flags: MessageFlags.Ephemeral });
        return openConfigureForm(interaction);
      }

      await button.deferReply({ flags: MessageFlags.Ephemeral });
      const current = await getGuild(interaction.guildId);

      if (button.customId === 'setup:quick') {
        await runQuickSetup(interaction.guild);
        const updated = await getGuild(interaction.guildId);
        await button.editReply({
          content: '✅ Quick Setup complete. Ticketing is configured with defaults.',
          embeds: [settingsEmbed(interaction.guild, updated)],
          components: panelButtons(updated),
        });
        return;
      }

      if (button.customId === 'setup:toggle:ticket') {
        const currentModules = current?.enabled_modules ? JSON.parse(current.enabled_modules) : [...MODULES];
        const next = !currentModules.includes('ticket');
        await setModuleEnabled(interaction.guildId, 'ticket', next);
        const updated = await getGuild(interaction.guildId);
        await button.editReply({
          content: `Ticket module ${next ? 'enabled' : 'disabled'}.`,
          embeds: [settingsEmbed(interaction.guild, updated)],
          components: panelButtons(updated),
        });
        return;
      }

      if (button.customId === 'setup:toggle:highrankdm') {
        const currentModules = current?.enabled_modules ? JSON.parse(current.enabled_modules) : [...MODULES];
        const next = !currentModules.includes('highrankdm');
        await setModuleEnabled(interaction.guildId, 'highrankdm', next);
        const updated = await getGuild(interaction.guildId);
        await button.editReply({
          content: `HighRankDM module ${next ? 'enabled' : 'disabled'}.`,
          embeds: [settingsEmbed(interaction.guild, updated)],
          components: panelButtons(updated),
        });
        return;
      }
    });

    collector.on('end', () => {
      panel.edit({ components: [] }).catch(() => {});
    });
  },
};

async function runQuickSetup(guild) {
  const settings = await getGuild(guild.id);

  let categoryId = settings?.ticket_category_id;
  if (!categoryId) {
    try {
      const category = await guild.channels.create({
        name: 'Support',
        type: ChannelType.GuildCategory,
        reason: 'EasySupport Quick Setup',
      });
      categoryId = category.id;
    } catch {
      /* category creation not permitted */
    }
  }

  let logChannelId = settings?.log_channel_id;
  if (!logChannelId) {
    try {
      const channel = await guild.channels.create({
        name: 'ticket-logs',
        type: ChannelType.GuildText,
        parent: categoryId,
        reason: 'EasySupport Quick Setup',
      });
      logChannelId = channel.id;
    } catch {
      /* channel creation not permitted */
    }
  }

  let staffRoleId = settings?.staff_role_id;
  if (!staffRoleId) {
    try {
      const role = await guild.roles.create({
        name: 'Support Staff',
        reason: 'EasySupport Quick Setup',
      });
      staffRoleId = role.id;
    } catch {
      /* role creation not permitted */
    }
  }

  await saveGuildSettings({
    guildId: guild.id,
    staffRoleId,
    logChannelId,
    ticketCategoryId: categoryId,
    maxOpenTickets: 2,
    motmRoleId: settings?.motm_role_id ?? null,
    managementRoleId: settings?.management_role_id ?? null,
    enabledModules: settings?.enabled_modules ?? null,
  });
}

async function openConfigureForm(interaction) {
  const settings = await getGuild(interaction.guildId);
  const session = {
    staffRoleId: settings?.staff_role_id ?? null,
    logChannelId: settings?.log_channel_id ?? null,
    ticketCategoryId: settings?.ticket_category_id ?? null,
    managementRoleId: settings?.management_role_id ?? null,
  };
  configureSessions.set(interaction.user.id, session);

  const form = await interaction.followUp({
    embeds: [configureEmbed(interaction.guild, session)],
    components: [
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup:role:staff')
          .setPlaceholder('Staff role')
          .setMaxValues(1),
      ),
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('setup:channel:log')
          .setPlaceholder('Log channel')
          .addChannelTypes(ChannelType.GuildText)
          .setMaxValues(1),
      ),
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('setup:channel:category')
          .setPlaceholder('Ticket category')
          .addChannelTypes(ChannelType.GuildCategory)
          .setMaxValues(1),
      ),
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup:role:management')
          .setPlaceholder('Management role')
          .setMaxValues(1),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:submit').setLabel('Submit').setStyle(ButtonStyle.Success),
      ),
    ],
    flags: MessageFlags.Ephemeral,
    fetchReply: true,
  });

  const formCollector = form.createMessageComponentCollector({ time: 5 * 60_000 });

  formCollector.on('collect', async (component) => {
    if (component.user.id !== interaction.user.id) {
      return component.reply({ content: 'Only the person who ran /setup can use this form.', flags: MessageFlags.Ephemeral });
    }

    if (component.isButton() && component.customId === 'setup:submit') {
      await component.deferReply({ flags: MessageFlags.Ephemeral });
      const current = await getGuild(interaction.guildId);
      const saved = configureSessions.get(interaction.user.id) ?? {};
      await saveGuildSettings({
        guildId: interaction.guildId,
        staffRoleId: saved.staffRoleId ?? current?.staff_role_id ?? null,
        logChannelId: saved.logChannelId ?? current?.log_channel_id ?? null,
        ticketCategoryId: saved.ticketCategoryId ?? current?.ticket_category_id ?? null,
        maxOpenTickets: current?.max_open_tickets ?? 2,
        motmRoleId: current?.motm_role_id ?? null,
        managementRoleId: saved.managementRoleId ?? current?.management_role_id ?? null,
        enabledModules: current?.enabled_modules ?? null,
      });
      configureSessions.delete(interaction.user.id);
      const updated = await getGuild(interaction.guildId);
      await component.editReply({
        content: '✅ Configuration saved.',
        embeds: [settingsEmbed(interaction.guild, updated)],
        components: panelButtons(updated),
      });
      await component.message.edit({ components: [] }).catch(() => {});
      return;
    }

    if (component.isRoleSelectMenu() || component.isChannelSelectMenu()) {
      const saved = configureSessions.get(interaction.user.id) ?? {};
      const value = component.values[0] ?? null;
      if (component.customId === 'setup:role:staff') saved.staffRoleId = value;
      if (component.customId === 'setup:channel:log') saved.logChannelId = value;
      if (component.customId === 'setup:channel:category') saved.ticketCategoryId = value;
      if (component.customId === 'setup:role:management') saved.managementRoleId = value;
      configureSessions.set(interaction.user.id, saved);
      await component.update({ embeds: [configureEmbed(interaction.guild, saved)] });
    }
  });

  formCollector.on('end', () => {
    form.edit({ components: [] }).catch(() => {});
    configureSessions.delete(interaction.user.id);
  });
}

export { panelButtons };