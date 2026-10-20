import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  getGuild,
  isModuleEnabled,
  createWarning,
  getWarnings,
  deleteWarning,
  createMute,
  getMutes,
  deleteMute,
  createBan,
  getBans,
  deleteBan,
  getRolePermission,
  setRolePermission,
} from '../db.js';

const MODULE = 'moderation';

export default {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('Moderation tools: warn, mute, ban, and view history.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName('warn')
        .setDescription('Warn a user.')
        .addUserOption((o) => o.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason for the warning').setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('warnings')
        .setDescription('View warnings for a user.')
        .addUserOption((o) => o.setName('user').setDescription('User to check').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('mute')
        .setDescription('Mute a user for a duration.')
        .addUserOption((o) => o.setName('user').setDescription('User to mute').setRequired(true))
        .addStringOption((o) =>
          o.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true),
        )
        .addStringOption((o) => o.setName('reason').setDescription('Reason for the mute').setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('ban')
        .setDescription('Ban a user.')
        .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason for the ban').setRequired(false)),
    ),
  async execute(interaction, client) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    // Module gating.
    if (!(await isModuleEnabled(interaction.guildId, MODULE))) {
      return interaction.reply({ content: 'The Moderation module is disabled for this server.', flags: MessageFlags.Ephemeral });
    }

    // Role permission check.
    const member = interaction.member;
    const hasPerm = await checkRolePermission(interaction.guildId, member, 'moderation');
    if (!hasPerm) {
      return interaction.reply({ content: 'You do not have permission to use moderation commands.', flags: MessageFlags.Ephemeral });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'warn') {
      await handleWarn(interaction);
    } else if (subcommand === 'warnings') {
      await handleWarnings(interaction);
    } else if (subcommand === 'mute') {
      await handleMute(interaction);
    } else if (subcommand === 'ban') {
      await handleBan(interaction);
    }
  },
};

async function checkRolePermission(guildId, member, commandName) {
  // Administrators bypass role permissions.
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const roles = member.roles.cache;
  for (const [roleId] of roles) {
    const allowed = await getRolePermission(guildId, roleId, commandName);
    if (allowed === false) return false;
  }
  return true;
}

async function handleWarn(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  await createWarning(interaction.guildId, user.id, interaction.user.id, reason);
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('User Warned')
    .addFields(
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
      { name: 'Reason', value: reason },
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleWarnings(interaction) {
  const user = interaction.options.getUser('user');
  const warnings = await getWarnings(interaction.guildId, user.id);
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`Warnings for ${user.tag}`)
    .setDescription(warnings.length === 0 ? 'No warnings found.' : warnings.map((w) => `#${w.id} — ${w.reason} (by <@${w.moderator_id}>)`).join('\n'))
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleMute(interaction) {
  const user = interaction.options.getUser('user');
  const durationStr = interaction.options.getString('duration');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const ms = parseDuration(durationStr);
  if (!ms) {
    return interaction.reply({ content: 'Invalid duration format. Use e.g. 10m, 1h, 1d.', flags: MessageFlags.Ephemeral });
  }
  const expiresAt = new Date(Date.now() + ms).toISOString().slice(0, 19).replace('T', ' ');
  await createMute(interaction.guildId, user.id, interaction.user.id, reason, expiresAt);
  try {
    await interaction.guild.members.timeout(user.id, ms, reason);
  } catch {
    /* timeout may fail if permissions missing */
  }
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('User Muted')
    .addFields(
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
      { name: 'Duration', value: durationStr, inline: true },
      { name: 'Reason', value: reason },
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleBan(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  await createBan(interaction.guildId, user.id, interaction.user.id, reason);
  try {
    await interaction.guild.members.ban(user, { reason });
  } catch {
    /* ban may fail if permissions missing */
  }
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('User Banned')
    .addFields(
      { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
      { name: 'Reason', value: reason },
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return value * mult;
}
