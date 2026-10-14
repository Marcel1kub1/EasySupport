import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatDuration, formatMoney } from '../util.js';

const perk = () => ECONOMY.perks.priority;

export default {
  data: new SlashCommandBuilder()
    .setName('priority')
    .setDescription('Buy priority support — your tickets get flagged and pinged')
    .addSubcommand((sub) => sub.setName('buy').setDescription(`Buy it (${formatMoney(perk().price)})`))
    .addSubcommand((sub) => sub.setName('view').setDescription('Check whether it is active')),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;

    if (interaction.options.getSubcommand() === 'view') {
      const active = economy.hasPerk(guildId, user.id, 'priority');
      if (!active) {
        return interaction.reply({
          content: `⚡ You do not have **${perk().label}**. Buy it for **${formatMoney(perk().price)}** ${ECONOMY.currency} with \`/priority buy\`.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      const expires = economy.listPerks(guildId, user.id).find((p) => p.kind === 'priority').expires_at;
      return interaction.reply({
        content: `⚡ **${perk().label}** is active until <t:${Math.floor(new Date(expires.replace(' ', 'T') + 'Z').getTime() / 1000)}:R>.`,
      });
    }

    const config = perk();
    if (economy.hasPerk(guildId, user.id, 'priority')) {
      return interaction.reply({ content: 'Priority support is already active.', flags: MessageFlags.Ephemeral });
    }
    const balance = economy.getUser(guildId, user.id)?.cash ?? 0;
    if (balance < config.price) {
      return interaction.reply({
        content: `**${config.label}** costs **${formatMoney(config.price)}** ${ECONOMY.currency} — you have ${formatMoney(balance)}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    economy.addCash(guildId, user.id, -config.price);
    economy.addPerk(guildId, user.id, 'priority', Date.now() + config.durationHours * 3_600_000);
    return interaction.reply({
      content: `⚡ **${config.label}** active for **${config.durationHours / 24} days** — every ticket you open now flags, pings and logs as priority.`,
    });
  },
};
