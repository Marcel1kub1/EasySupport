import { SlashCommandBuilder, MessageFlags, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import {
  locationConfig, locationIncome, hourlyRate, unlockBlockReason,
  locationIngredients, upgradeCost,
} from '../engine.js';
import { formatMoney, formatRate, formatIngredients } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('location')
    .setDescription('Browse, inspect and buy businesses')
    .addSubcommand((sub) => sub.setName('list').setDescription('All locations and their status'))
    .addSubcommand((sub) =>
      sub
        .setName('buy')
        .setDescription('Buy the next business')
        .addStringOption((o) =>
          o.setName('business').setDescription('Which business').setRequired(true)
            .addChoices(...Object.entries(ECONOMY.locations).map(([key, cfg]) => ({ name: cfg.label, value: key })))
        )
        .addStringOption((o) => o.setName('name').setDescription('Name it').setRequired(false).setMaxLength(40))
    ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;

    if (interaction.options.getSubcommand() === 'buy') {
      const key = interaction.options.getString('business');
      const cfg = locationConfig(key);
      if (!cfg) {
        return interaction.reply({ content: 'Unknown business.', flags: MessageFlags.Ephemeral });
      }
      if (cfg.free) {
        return interaction.reply({ content: `The **${cfg.label}** is free — every player starts with one.`, flags: MessageFlags.Ephemeral });
      }

      const state = economy.buildState(guildId, user.id);
      if (state.locations.some((l) => l.key === key)) {
        return interaction.reply({ content: `You already own a **${cfg.label}**.`, flags: MessageFlags.Ephemeral });
      }
      const blocked = unlockBlockReason(key, state);
      if (blocked) {
        return interaction.reply({ content: `🔒 ${blocked}`, flags: MessageFlags.Ephemeral });
      }

      const ingredients = locationIngredients(key);
      if (state.user.ingredients < ingredients) {
        return interaction.reply({
          content: `The **${cfg.label}** needs **${ingredients}** ingredients — you have ${formatIngredients(state.user.ingredients)}. Mine with \`/mine\`.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      if (state.user.cash < cfg.buyPrice) {
        return interaction.reply({
          content: `The **${cfg.label}** costs **${formatMoney(cfg.buyPrice)}** ${ECONOMY.currency} — you have ${formatMoney(state.user.cash)}.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      economy.addCash(guildId, user.id, -cfg.buyPrice);
      if (ingredients > 0) economy.addIngredients(guildId, user.id, -ingredients);
      const name = interaction.options.getString('name')?.trim() || cfg.label;
      economy.buyLocation(guildId, user.id, key, name);
      const after = economy.buildState(guildId, user.id);
      const owned = after.locations.length;
      const synergy = owned > 1 ? `\n🔗 Ownership synergy: **+${Math.round((owned - 1) * ECONOMY.synergy.bonusPerExtraLine * 100)}%** on all income!` : '';

      return interaction.reply({
        content:
          `🎉 **${name}** is open! (${formatMoney(cfg.buyPrice)}${ingredients ? ` + ${ingredients} ingredients` : ''})\n` +
          `Base income **${formatRate(cfg.base)}** — level it with \`/upgrade\`.${synergy}`,
      });
    }

    // /location list
    const state = economy.buildState(guildId, user.id);
    const lines = Object.entries(ECONOMY.locations).map(([key, cfg]) => {
      const owned = state.locations.find((l) => l.key === key);
      if (owned) {
        return `✅ **${owned.name}** — Lv ${owned.level}/${cfg.maxLevel}${owned.prestige ? ` · ⭐${owned.prestige}` : ''} · ${formatRate(locationIncome(owned))}`;
      }
      const blocked = unlockBlockReason(key, state);
      const price = cfg.free ? 'free' : `${formatMoney(cfg.buyPrice)}${cfg.ingredients ? ` + ${cfg.ingredients}🥘` : ''}`;
      return `${blocked ? '🔒' : '💰'} **${cfg.label}** — ${price}${blocked ? ` · ${blocked}` : ''}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🏢 Your empire')
      .setDescription(lines.join('\n'))
      .addFields({ name: 'Total income', value: `**${formatRate(hourlyRate(state))}**`, inline: true })
      .setFooter({ text: 'Buy with /location buy — side businesses do not count for prestige' });

    return interaction.reply({ embeds: [embed] });
  },
};
