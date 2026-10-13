import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { hourlyRate } from '../engine.js';
import { formatMoney, formatRate, locationOption, pickLocation } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('hire')
    .setDescription('Hire an employee for a business')
    // Discord requires required options before optional ones, so `location` goes last.
    .addStringOption((o) =>
      o.setName('type').setDescription('Who to hire').setRequired(true)
        .addChoices(...ECONOMY.employees.map((e) => ({ name: `${e.label} — ${formatMoney(e.price)}`, value: e.key })))
    )
    .addStringOption((o) =>
      o.setName('name').setDescription('Name them (max 20 chars)').setRequired(true).setMaxLength(20)
    )
    .addStringOption(locationOption),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const typeKey = interaction.options.getString('type');
    const name = interaction.options.getString('name').trim();

    const type = ECONOMY.employees.find((e) => e.key === typeKey);
    if (!type) {
      return interaction.reply({ content: 'Unknown employee type.', flags: MessageFlags.Ephemeral });
    }
    if (!name) {
      return interaction.reply({ content: 'Give your employee a name.', flags: MessageFlags.Ephemeral });
    }

    const state = economy.buildState(guildId, user.id);
    const location = pickLocation(state, interaction.options.getString('location'));
    if (!location) {
      return interaction.reply({ content: "You don't own that business yet — check `/location list`.", flags: MessageFlags.Ephemeral });
    }
    if (economy.countEmployees(guildId, user.id, location.key) >= ECONOMY.maxEmployeesPerLocation) {
      return interaction.reply({
        content: `Your shack already employs ${ECONOMY.maxEmployeesPerLocation} people — that is the max for now.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (state.user.cash < type.price) {
      return interaction.reply({
        content: `**${type.label}** costs ${formatMoney(type.price)} ${ECONOMY.currency} — you have ${formatMoney(state.user.cash)}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    economy.addCash(guildId, user.id, -type.price);
    const hired = economy.hireEmployee(guildId, user.id, location.key, type.key, name);
    if (!hired) {
      economy.addCash(guildId, user.id, type.price); // refund: name already taken
      return interaction.reply({
        content: `You already have an employee named **${name}** here — pick another name.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const afterHire = economy.buildState(guildId, user.id);
    return interaction.reply({
      content: `🧑‍🍳 **${name}** joined **${location.name}** as ${type.label} (+${Math.round(type.bonus * 100)}% income, wage ${formatMoney(type.wage)}/h).\nIncome is now **${formatRate(hourlyRate(afterHire))}**.`,
    });
  },
};
