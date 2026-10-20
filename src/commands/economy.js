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
  getEconomyUser,
  addBalance,
  setEconomyUser,
  getRolePermission,
} from '../db.js';

const MODULE = 'economy';

export default {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Economy commands: check balance, pay users, or manage funds.')
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .addUserOption((o) => o.setName('user').setDescription('User to check/pay').setRequired(false))
    .addStringOption((o) =>
      o.setName('action').setDescription('Action to perform').addChoices(
        { name: 'balance', value: 'balance' },
        { name: 'pay', value: 'pay' },
        { name: 'setbalance', value: 'setbalance' },
      ),
    )
    .addIntegerOption((o) => o.setName('amount').setDescription('Amount to pay or set').setRequired(false)),
  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    if (!(await isModuleEnabled(interaction.guildId, MODULE))) {
      return interaction.reply({ content: 'The Economy module is disabled for this server.', flags: MessageFlags.Ephemeral });
    }

    const action = interaction.options.getString('action') ?? 'balance';
    const target = interaction.options.getUser('user') ?? interaction.user;

    if (action === 'balance') {
      await handleBalance(interaction, target);
    } else if (action === 'pay') {
      await handlePay(interaction, target);
    } else if (action === 'setbalance') {
      await handleSetBalance(interaction, target);
    }
  },
};

async function handleBalance(interaction, target) {
  const row = await getEconomyUser(interaction.guildId, target.id);
  const balance = row?.balance ?? 0;
  const bank = row?.bank ?? 0;
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`${target.tag}'s Economy`)
    .addFields(
      { name: 'Balance', value: `💰 ${balance}`, inline: true },
      { name: 'Bank', value: `🏦 ${bank}`, inline: true },
      { name: 'Total', value: `💵 ${balance + bank}`, inline: true },
    )
    .setThumbnail(target.displayAvatarURL())
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handlePay(interaction, target) {
  const amount = interaction.options.getInteger('amount');
  if (!amount || amount <= 0) {
    return interaction.reply({ content: 'Please specify a positive amount.', flags: MessageFlags.Ephemeral });
  }
  if (target.id === interaction.user.id) {
    return interaction.reply({ content: 'You cannot pay yourself.', flags: MessageFlags.Ephemeral });
  }
  const sender = await getEconomyUser(interaction.guildId, interaction.user.id);
  if (!sender || sender.balance < amount) {
    return interaction.reply({ content: 'Insufficient balance.', flags: MessageFlags.Ephemeral });
  }
  await addBalance(interaction.guildId, interaction.user.id, -amount);
  await addBalance(interaction.guildId, target.id, amount);
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Payment Sent')
    .addFields(
      { name: 'From', value: `${interaction.user.tag}`, inline: true },
      { name: 'To', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Amount', value: `💰 ${amount}`, inline: true },
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleSetBalance(interaction, target) {
  const hasPerm = await checkRolePermission(interaction.guildId, interaction.member, 'economy');
  if (!hasPerm) {
    return interaction.reply({ content: 'You do not have permission to set balances.', flags: MessageFlags.Ephemeral });
  }
  const amount = interaction.options.getInteger('amount');
  if (amount == null || amount < 0) {
    return interaction.reply({ content: 'Please specify a non-negative amount.', flags: MessageFlags.Ephemeral });
  }
  await setEconomyUser(interaction.guildId, target.id, amount, 0);
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Balance Set')
    .addFields(
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'New Balance', value: `💰 ${amount}`, inline: true },
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
