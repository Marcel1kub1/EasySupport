import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  isModuleEnabled,
  createVouch,
  getVouches,
  getRolePermission,
} from '../db.js';

const MODULE = 'vouches';

export default {
  data: new SlashCommandBuilder()
    .setName('vouches')
    .setDescription('Give or view vouches for a user.')
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .addUserOption((o) => o.setName('user').setDescription('User to vouch for or check').setRequired(true))
    .addStringOption((o) => o.setName('message').setDescription('Vouch message').setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    if (!(await isModuleEnabled(interaction.guildId, MODULE))) {
      return interaction.reply({ content: 'The Vouches module is disabled for this server.', flags: MessageFlags.Ephemeral });
    }

    const target = interaction.options.getUser('user');
    const message = interaction.options.getString('message');

    if (message) {
      await handleVouch(interaction, target, message);
    } else {
      await handleList(interaction, target);
    }
  },
};

async function handleVouch(interaction, target, message) {
  if (target.id === interaction.user.id) {
    return interaction.reply({ content: 'You cannot vouch for yourself.', flags: MessageFlags.Ephemeral });
  }
  await createVouch(interaction.guildId, target.id, interaction.user.id, message);
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Vouch Given')
    .addFields(
      { name: 'From', value: `${interaction.user.tag}`, inline: true },
      { name: 'To', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Message', value: message },
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleList(interaction, target) {
  const vouches = await getVouches(interaction.guildId, target.id);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Vouches for ${target.tag}`)
    .setDescription(
      vouches.length === 0
        ? 'No vouches found.'
        : vouches.map((v) => `• <@${v.vouched_by}>: ${v.message ?? 'No message'}`).join('\n'),
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
