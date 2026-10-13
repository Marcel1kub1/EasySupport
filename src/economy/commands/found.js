import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('found')
    .setDescription('Name your taco shack')
    .addStringOption((o) =>
      o.setName('name').setDescription('Name of your shack').setRequired(true).setMaxLength(40)
    ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;

    const isNew = !economy.getUser(guildId, user.id);
    economy.ensureUser(guildId, user.id);
    const name = (interaction.options.getString('name') ?? '').trim();
    if (!name) {
      return interaction.reply({ content: 'Give your shack a name.', flags: MessageFlags.Ephemeral });
    }
    economy.setName(guildId, user.id, 'taco_stand', name);

    return interaction.reply({
      content: isNew
        ? `🌮 **${name}** is open for business! ${ECONOMY.flavor.welcome}\nStart with \`/work\`, then reinvest with \`/buy\`.`
        : `🌮 Your shack is now called **${name}**.`,
    });
  },
};
