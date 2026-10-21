import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  isModuleEnabled,
  getAutomodConfig,
  setAutomodConfig,
  getRolePermission,
} from '../db.js';

const MODULE = 'automod';

export default {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure auto-moderation rules for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((o) => o.setName('enabled').setDescription('Enable or disable automod').setRequired(false))
    .addBooleanOption((o) => o.setName('anti_invite').setDescription('Block server invites').setRequired(false))
    .addBooleanOption((o) => o.setName('anti_link').setDescription('Block links').setRequired(false))
    .addBooleanOption((o) => o.setName('anti_spam').setDescription('Block spam').setRequired(false))
    .addBooleanOption((o) => o.setName('anti_caps').setDescription('Block excessive caps').setRequired(false))
    .addStringOption((o) =>
      o.setName('punishment').setDescription('Punishment for violations').addChoices(
        { name: 'None', value: 'none' },
        { name: 'Delete', value: 'delete' },
        { name: 'Mute', value: 'mute' },
        { name: 'Kick', value: 'kick' },
      ),
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    if (!(await isModuleEnabled(interaction.guildId, MODULE))) {
      return interaction.reply({ content: 'The Automod module is disabled for this server.', flags: MessageFlags.Ephemeral });
    }

    const hasPerm = await checkRolePermission(interaction.guildId, interaction.member, 'automod');
    if (!hasPerm) {
      return interaction.reply({ content: 'You do not have permission to configure automod.', flags: MessageFlags.Ephemeral });
    }

    const existing = await getAutomodConfig(interaction.guildId);
    const enabled = interaction.options.getBoolean('enabled') ?? (existing?.enabled ?? false);
    const antiInvite = interaction.options.getBoolean('anti_invite') ?? (existing?.anti_invite ?? false);
    const antiLink = interaction.options.getBoolean('anti_link') ?? (existing?.anti_link ?? false);
    const antiSpam = interaction.options.getBoolean('anti_spam') ?? (existing?.anti_spam ?? false);
    const antiCaps = interaction.options.getBoolean('anti_caps') ?? (existing?.anti_caps ?? false);
    const punishment = interaction.options.getString('punishment') ?? (existing?.punishment ?? 'delete');

    await setAutomodConfig(interaction.guildId, {
      enabled,
      anti_invite: antiInvite,
      anti_link: antiLink,
      anti_spam: antiSpam,
      anti_caps: antiCaps,
      punishment,
    });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Automod Configuration')
      .addFields(
        { name: 'Enabled', value: enabled ? '✅ Yes' : '❌ No', inline: true },
        { name: 'Anti Invite', value: antiInvite ? '✅' : '❌', inline: true },
        { name: 'Anti Link', value: antiLink ? '✅' : '❌', inline: true },
        { name: 'Anti Spam', value: antiSpam ? '✅' : '❌', inline: true },
        { name: 'Anti Caps', value: antiCaps ? '✅' : '❌', inline: true },
        { name: 'Punishment', value: punishment, inline: true },
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
