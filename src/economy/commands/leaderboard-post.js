import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { leaderboardEmbed } from './leaderboard.js';
import { ECONOMY } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard-post')
    .setDescription('Post a live leaderboard that updates itself in this channel')
    .setDefaultMemberPermissions(0x8),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has(0x8)) {
      return interaction.reply({ content: 'Administrator only.', flags: MessageFlags.Ephemeral });
    }
    const guildId = interaction.guildId;
    const channel = interaction.channel;
    if (!channel.isTextBased()) {
      return interaction.reply({ content: 'Run this in a text channel.', flags: MessageFlags.Ephemeral });
    }

    await interaction.reply({ content: 'Posting…', flags: MessageFlags.Ephemeral });
    const message = await channel.send({ embeds: [leaderboardEmbed(guildId)] });
    economy.setLeaderboardTarget(guildId, channel.id ?? interaction.channelId, message.id);
    return interaction.editReply({
      content: `🏆 Live leaderboard posted in <#${channel.id}> — it refreshes every ${ECONOMY.leaderboardRefreshMinutes} minutes.`,
    });
  },
};
