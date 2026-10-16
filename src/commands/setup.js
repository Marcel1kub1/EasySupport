import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  getGuild,
  saveGuildSettings,
  setModuleEnabled,
  isModuleEnabled,
} from '../db.js';

const MODULES = ['ticket', 'highrankdm'];

/** Shared setup state for Advanced Setup. Keyed by user id. */
const setupState = new Map();

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
        '• **Advanced Setup** — configure every option in a single modal.\n' +
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
      new ButtonBuilder().setCustomId('setup:advanced').setLabel('Advanced Setup').setStyle(ButtonStyle.Primary),
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

      // Advanced Setup must be the initial response (modal), so do not defer.
      if (button.customId === 'setup:advanced') {
        setupState.set(interaction.user.id, { values: {} });
        const modal = new ModalBuilder().setCustomId('setup:submit').setTitle('EasySupport — Advanced Setup');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('staff_role')
              .setLabel('Staff role mention or ID')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('<@&123456789012345678>')
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('log_channel')
              .setLabel('Log channel mention or ID')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('<#123456789012345678>')
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('category')
              .setLabel('Ticket category mention or ID')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('<#123456789012345678>')
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('max_open')
              .setLabel('Max open tickets per member (1-10)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('2')
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('management_role')
              .setLabel('Management role mention or ID')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('<@&123456789012345678>')
              .setRequired(true),
          ),
        );
        return button.showModal(modal);
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

/* ---------------------------- quick setup ---------------------------- */

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

/* ---------------------------- advanced setup modal ---------------------------- */

function extractId(value) {
  const m = value.match(/<@&(\d+)>/) || value.match(/<#(\d+)>/) || value.match(/^(\d+)$/);
  return m ? m[1] : null;
}

export async function handleSetupModal(interaction, client) {
  if (interaction.customId !== 'setup:submit') return false;
  const state = setupState.get(interaction.user.id);
  if (!state) {
    return interaction.reply({ content: 'Setup session expired. Please run /setup again.', flags: MessageFlags.Ephemeral });
  }

  const maxOpen = parseInt(interaction.fields.getTextInputValue('max_open'), 10);
  if (Number.isNaN(maxOpen) || maxOpen < 1 || maxOpen > 10) {
    return interaction.reply({ content: 'Max open tickets must be a number between 1 and 10.', flags: MessageFlags.Ephemeral });
  }

  const settings = await getGuild(interaction.guildId);
  await saveGuildSettings({
    guildId: interaction.guildId,
    staffRoleId: extractId(interaction.fields.getTextInputValue('staff_role')),
    logChannelId: extractId(interaction.fields.getTextInputValue('log_channel')),
    ticketCategoryId: extractId(interaction.fields.getTextInputValue('category')),
    maxOpenTickets: maxOpen,
    motmRoleId: settings?.motm_role_id ?? null,
    managementRoleId: extractId(interaction.fields.getTextInputValue('management_role')),
    enabledModules: settings?.enabled_modules ?? null,
  });

  setupState.delete(interaction.user.id);
  const updated = await getGuild(interaction.guildId);
  await interaction.reply({
    content: '✅ Advanced Setup complete. Ticketing is configured.',
    embeds: [settingsEmbed(interaction.guild, updated)],
    components: panelButtons(updated),
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

export { panelButtons };
