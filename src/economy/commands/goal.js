import { SlashCommandBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { goalEmbed } from './donate.js';

export default {
  data: new SlashCommandBuilder()
    .setName('goal')
    .setDescription('Community pot progress — reaching the goal boosts everyone'),
  async execute(interaction) {
    return interaction.reply({ embeds: [goalEmbed(interaction.guildId)] });
  },
};
