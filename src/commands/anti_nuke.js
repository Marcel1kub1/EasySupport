import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  getGuild,
  isModuleEnabled,
  getAntiNukeConfig,
  setAntiNukeConfig,
  getRolePermission,
} from '../db.js';

const MODULE = 'anti_nuke';

export default {
  data: new SlashCommandBuilder()
    .setName('anti_nuke')
    .setDescription('Configure anti-nuke protection for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((o) => o.setName('enabled').setDescription('Enable or disable anti-nuke').setRequired(false))
    .addStringOption((o) =>
      o.setName('punishment').setDescription('Punishment for violations').addChoices(
        { name: 'None', value: 'none' },
        { name: 'Kick', value: 'kick' },
        { name: 'Ban', value: 'ban' },
      ),
    )
    .addIntegerOption((o) => o.setName('max_channels_per_min').setDescription('Max channels created per minute').setMinValue(1).setMaxValue(100).setRequired(false))
    .addIntegerOption((o) => o.setName('max_roles_per_min').setDescription('Max roles created per minute').setMinValue(1).setMaxValue(100).setRequired(false))
    .addIntegerOption((o) => o.setName('max_bans_per_min').setDescription('Max bans issued per minute').setMinValue(1).setMaxValue(100).setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    if (!(await isModuleEnabled(interaction.guildId, MODULE))) {
      return interaction.reply({ content: 'The Anti-Nuke module is disabled for this server.', flags: MessageFlags.Ephemeral });
    }

    const hasPerm = await checkRolePermission(interaction.guildId, interaction.member, 'anti_nuke');
    if (!hasPerm) {
      return interaction.reply({ content: 'You do not have permission to configure anti-nuke.', flags: MessageFlags.Ephemeral });
    }

    const existing = await getAntiNukeConfig(interaction.guildId);
    const enabled = interaction.options.getBoolean('enabled') ?? (existing?.enabled ?? false);
    const punishment = interaction.options.getString('punishment') ?? (existing?.punishment ?? 'kick');
    const maxChannels = interaction.options.getInteger('max_channels_per_min') ?? (existing?.max_channels_per_min ?? 5);
    const maxRoles = interaction.options.getInteger('max_roles_per_min') ?? (existing?.max_roles_per_min ?? 5);
    const maxBans = interaction.options.getInteger('max_bans_per_min') ?? (existing?.max_bans_per_min ?? 5);

    await setAntiNukeConfig(interaction.guildId, {
      enabled,
      punishment,
      max_channels_per_min: maxChannels,
      max_roles_per_min: maxRoles,
      max_bans_per_min: maxBans,
      whitelisted_roles: existing?.whitelisted_roles ?? [],
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Anti-Nuke Configuration')
      .addFields(
        { name: 'Enabled', value: enabled ? '✅ Yes' : '❌ No', inline: true },
        { name: 'Punishment', value: punishment, inline: true },
        { name: 'Max Channels/Min', value: String(maxChannels), inline: true },
        { name: 'Max Roles/Min', value: String(maxRoles), inline: true },
        { name: 'Max Bans/Min', value: String(maxBans), inline: true },
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
