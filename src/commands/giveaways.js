import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  isModuleEnabled,
  createGiveaway,
  getGiveaways,
  endGiveaway,
  getRolePermission,
} from '../db.js';

const MODULE = 'giveaways';

export default {
  data: new SlashCommandBuilder()
    .setName('giveaways')
    .setDescription('Create and manage giveaways.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new giveaway.')
        .addStringOption((o) => o.setName('prize').setDescription('The prize').setRequired(true))
        .addIntegerOption((o) => o.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1))
        .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners').setRequired(false).setMinValue(1).setMaxValue(10)),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List active giveaways.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('End a giveaway by message ID.')
        .addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)),
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    if (!(await isModuleEnabled(interaction.guildId, MODULE))) {
      return interaction.reply({ content: 'The Giveaways module is disabled for this server.', flags: MessageFlags.Ephemeral });
    }

    const hasPerm = await checkRolePermission(interaction.guildId, interaction.member, 'giveaways');
    if (!hasPerm) {
      return interaction.reply({ content: 'You do not have permission to manage giveaways.', flags: MessageFlags.Ephemeral });
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
      await handleCreate(interaction);
    } else if (subcommand === 'list') {
      await handleList(interaction);
    } else if (subcommand === 'end') {
      await handleEnd(interaction);
    }
  },
};

async function handleCreate(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const prize = interaction.options.getString('prize');
  const durationMinutes = interaction.options.getInteger('duration');
  const winnerCount = interaction.options.getInteger('winners') ?? 1;
  const endsAt = new Date(Date.now() + durationMinutes * 60_000).toISOString().slice(0, 19).replace('T', ' ');

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('🎉 Giveaway')
    .setDescription(`Prize: **${prize}**\nEnds: <t:${Math.floor(new Date(endsAt).getTime() / 1000)}:R>\nWinners: ${winnerCount}`)
    .setFooter({ text: 'Ends at' })
    .setTimestamp();

  const message = await interaction.channel.send({ embeds: [embed] });
  await createGiveaway(interaction.guildId, interaction.channelId, message.id, prize, winnerCount, endsAt, interaction.user.id);

  await interaction.editReply({ content: '✅ Giveaway created.', flags: MessageFlags.Ephemeral });
}

async function handleList(interaction) {
  const giveaways = await getGiveaways(interaction.guildId);
  const active = giveaways.filter((g) => !g.ended);
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('Active Giveaways')
    .setDescription(
      active.length === 0
        ? 'No active giveaways.'
        : active.map((g) => `• <#${g.channel_id}> — ${g.prize} (ends <t:${Math.floor(new Date(g.ends_at).getTime() / 1000)}:R>)`).join('\n'),
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleEnd(interaction) {
  const messageId = interaction.options.getString('message_id');
  const giveaway = await endGiveaway(messageId);
  await interaction.reply({ content: '✅ Giveaway ended.', flags: MessageFlags.Ephemeral });
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
