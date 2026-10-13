import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { canPrestige, isMaxLevel, upgradeCost, locationConfig } from '../engine.js';
import { formatMoney, pickLocation, withLocationOption } from '../util.js';

export default {
  data: withLocationOption(
    new SlashCommandBuilder()
      .setName('prestige')
      .setDescription('Reset a maxed business to level 1 for a permanent multiplier')
  ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const location = pickLocation(state, interaction.options.getString('location'));
    if (!location) {
      return interaction.reply({ content: "You don't own that business — check `/location list`.", flags: MessageFlags.Ephemeral });
    }

    const cfg = locationConfig(location.key);
    if (cfg?.side) {
      return interaction.reply({
        content: `The **${cfg.label}** is a side business — it cannot be prestiged.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!canPrestige(location)) {
      const next = isMaxLevel(location) ? '' : ` You need level ${cfg.maxLevel} (currently ${location.level}).`;
      return interaction.reply({
        content: `You can only prestige at level ${cfg.maxLevel}.${next}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const target = ECONOMY.prestige.resetLevel;
    economy.setPrestige(guildId, user.id, location.key, location.prestige + 1, target);
    const after = economy.buildState(guildId, user.id);
    const gained = ECONOMY.prestige.multiplierPerPrestige * (location.prestige + 1) * 100;

    return interaction.reply({
      content:
        `⭐ **${location.name}** prestiged to level ${target}!\n` +
        `Permanent multiplier: **+${Math.round(gained)}%** income for this business (now prestige ${location.prestige + 1}).\n` +
        (after.locations.some((l) => (l.prestige ?? 0) > 0) && location.prestige === 0
          ? `\n🔓 **Unlocked:** employee \`/employees train\` and \`/advertise\` (Biktok campaigns).`
          : ''),
    });
  },
};
