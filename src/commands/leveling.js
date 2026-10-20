import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  UserSelectMenuBuilder,
} from 'discord.js';
import {
  getGuild,
  isModuleEnabled,
  getLevelingUser,
  addXp,
  getRolePermission,
} from '../db.js';

const MODULE = 'leveling';

export default {
  data: new SlashCommandBuilder()
    .setName('leveling')
    .setDescription('Check your level and XP, or view the leaderboard.')
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .addUserOption((o) => o.setName('user').setDescription('User to check').setRequired(false))
    .addStringOption((o) =>
      o.setName('action').setDescription('Action to perform').addChoices(
        { name: 'rank', value: 'rank' },
        { name: 'leaderboard', value: 'leaderboard' },
        { name: 'addxp', value: 'addxp' },
      ),
    )
    .addIntegerOption((o) => o.setName('amount').setDescription('XP amount to add (addxp only)').setRequired(false)),
  async execute(interaction, client) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    if (!(await isModuleEnabled(interaction.guildId, MODULE))) {
      return interaction.reply({ content: 'The Leveling module is disabled for this server.', flags: MessageFlags.Ephemeral });
    }

    const action = interaction.options.getString('action') ?? 'rank';
    const target = interaction.options.getUser('user') ?? interaction.user;

    if (action === 'rank') {
      await handleRank(interaction, target);
    } else if (action === 'leaderboard') {
      await handleLeaderboard(interaction);
    } else if (action === 'addxp') {
      await handleAddXp(interaction, target);
    }
  },
};

async function handleRank(interaction, target) {
  const row = await getLevelingUser(interaction.guildId, target.id);
  const xp = row?.xp ?? 0;
  const level = row?.level ?? 0;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${target.tag}'s Level`)
    .addFields(
      { name: 'Level', value: String(level), inline: true },
      { name: 'XP', value: String(xp), inline: true },
      { name: 'Next Level XP', value: String((level + 1) ** 2 * 100), inline: true },
    )
    .setThumbnail(target.displayAvatarURL())
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleLeaderboard(interaction) {
  const { query } = await import('../db.js');
  const rows = await query(
    'SELECT user_id, xp, level FROM leveling_users WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10',
    [interaction.guildId],
  );
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Leveling Leaderboard')
    .setDescription(
      rows.length === 0
        ? 'No leveling data yet.'
        : rows.map((r, i) => `#${i + 1} <@${r.user_id}> — Level ${r.level} (${r.xp} XP)`).join('\n'),
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleAddXp(interaction, target) {
  const hasPerm = await checkRolePermission(interaction.guildId, interaction.member, 'leveling');
  if (!hasPerm) {
    return interaction.reply({ content: 'You do not have permission to add XP.', flags: MessageFlags.Ephemeral });
  }
  const amount = interaction.options.getInteger('amount');
  if (!amount || amount <= 0) {
    return interaction.reply({ content: 'Please specify a positive XP amount.', flags: MessageFlags.Ephemeral });
  }
  const result = await addXp(interaction.guildId, target.id, amount);
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('XP Added')
    .addFields(
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'XP Added', value: String(amount), inline: true },
      { name: 'New Level', value: String(result.level), inline: true },
      { name: 'Total XP', value: String(result.xp), inline: true },
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function checkRolePermission(guildId, member, commandName) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const roles = member.roles.cache;
  for (const [roleId] of roles) {
    const allowed = await getRolePermission(guildId, roleId, commandName);
    if (allowed === false) return false;
  }
  return true;
}
