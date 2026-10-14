import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { addToBlacklist, removeFromBlacklist, isBlacklisted } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Block or unblock members from opening tickets')
    .setDefaultMemberPermissions(0x8) // Administrator
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Block a member from opening tickets')
        .addUserOption((o) => o.setName('member').setDescription('Who').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Unblock a member')
        .addUserOption((o) => o.setName('member').setDescription('Who').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Check whether a member is blocked')
        .addUserOption((o) => o.setName('member').setDescription('Who').setRequired(true))
    ),
  async execute(interaction) {
    const guildId = interaction.guildId;
    const member = interaction.options.getUser('member');
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      addToBlacklist(guildId, member.id);
      return interaction.reply({ content: `⛔ <@${member.id}> can no longer open tickets.`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'remove') {
      removeFromBlacklist(guildId, member.id);
      return interaction.reply({ content: `✅ <@${member.id}> can open tickets again.`, flags: MessageFlags.Ephemeral });
    }
    const blocked = isBlacklisted(guildId, member.id);
    return interaction.reply({
      content: blocked ? `⛔ <@${member.id}> is blocked from opening tickets.` : `✅ <@${member.id}> is not blocked.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
