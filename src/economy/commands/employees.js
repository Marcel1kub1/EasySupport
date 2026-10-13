import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { employeeConfig } from '../engine.js';
import { hasTrainingUnlocked } from '../engine.js';
import { formatMoney, primaryLocation } from '../util.js';

export default {
  data: new SlashCommandBuilder()
    .setName('employees')
    .setDescription('List your staff, or train them')
    .addSubcommand((sub) => sub.setName('list').setDescription('Show your employees'))
    .addSubcommand((sub) =>
      sub
        .setName('train')
        .setDescription('Train an employee (+2% output per level)')
        .addStringOption((o) => o.setName('name').setDescription('Employee name').setRequired(true))
    ),
  async execute(interaction) {
    const { guildId } = interaction;
    const user = interaction.user;
    const state = economy.buildState(guildId, user.id);
    const location = primaryLocation(state);
    if (!location) {
      return interaction.reply({ content: 'You have no shack yet — run `/found` first.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.options.getSubcommand() === 'train') {
      return train(interaction, guildId, user, state, location);
    }

    // list
    if (location.employees.length === 0) {
      return interaction.reply({ content: `No staff yet — hire someone with \`/hire\`.` });
    }
    const lines = location.employees.map((emp) => {
      const meta = employeeConfig(emp.key) ?? { label: emp.key, bonus: 0, wage: 0 };
      const trained = (emp.training ?? 0) > 0 ? ` · trained ×${emp.training}` : '';
      return `**${emp.name}** — ${meta.label} (+${Math.round(meta.bonus * 100)}%${trained}, wage ${formatMoney(meta.wage)}/h)`;
    });
    return interaction.reply({
      content: `🧑‍🍳 **${location.name}** staff (${location.employees.length}/${ECONOMY.maxEmployeesPerLocation}):\n${lines.join('\n')}`,
    });
  },
};

async function train(interaction, guildId, user, state, location) {
  if (!hasTrainingUnlocked(state)) {
    return interaction.reply({
      content: 'Training unlocks with your **first prestige** — reach level 10 and use `/prestige`. (Prestige arrives with the expansion update.)',
      flags: MessageFlags.Ephemeral,
    });
  }
  const name = interaction.options.getString('name');
  const employee = location.employees.find((e) => e.name === name);
  if (!employee) {
    return interaction.reply({ content: `No employee named **${name}** here.`, flags: MessageFlags.Ephemeral });
  }
  if ((employee.training ?? 0) >= ECONOMY.training.maxLevel) {
    return interaction.reply({ content: `**${name}** is already fully trained.`, flags: MessageFlags.Ephemeral });
  }
  const cost = ECONOMY.training.baseCost * ECONOMY.training.costGrowth ** (employee.training ?? 0);
  if (state.user.cash < cost) {
    return interaction.reply({
      content: `Training costs **${formatMoney(cost)}** ${ECONOMY.currency} — you have ${formatMoney(state.user.cash)}.`,
      flags: MessageFlags.Ephemeral,
    });
  }
  economy.addCash(guildId, user.id, -cost);
  const trained = economy.trainEmployee(guildId, user.id, location.key, name);
  return interaction.reply({
    content: `📚 **${name}** trained to level ${trained.training} (+${Math.round(trained.training * ECONOMY.training.bonusPerLevel * 100)}% output).`,
  });
}
