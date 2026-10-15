import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { employeeConfig, hasTrainingUnlocked } from '../engine.js';
import { formatMoney, pickLocation } from '../util.js';

export async function render({ guildId, userId, action, args }) {
  const state = economy.buildState(guildId, userId);
  const location = pickLocation(state, null);
  if (!location) return { embeds: [new EmbedBuilder().setTitle('🧑‍🍳 Staff').setDescription('Run /taco once to open your free stand.')] };

  if (action === 'hire') {
    const typeKey = args[0];
    const type = ECONOMY.employees.find((e) => e.key === typeKey);
    if (!type) return { status: 'Unknown role.', embeds: [staffEmbed(state, location)], rows: [staffRows(location, state)] };
    if (location.employees.length >= ECONOMY.maxEmployeesPerLocation) {
      return { status: `That business already employs ${ECONOMY.maxEmployeesPerLocation} people.`, embeds: [staffEmbed(state, location)], rows: [staffRows(location, state)] };
    }
    if (state.user.cash < type.price) {
      return { status: `**${type.label}** costs ${formatMoney(type.price)} — you have ${formatMoney(state.user.cash)}.`, embeds: [staffEmbed(state, location)], rows: [staffRows(location, state)] };
    }
    economy.addCash(guildId, userId, -type.price);
    const name = `${type.label.split(' ')[0]} ${location.employees.length + 1}`;
    const hired = economy.hireEmployee(guildId, userId, location.key, type.key, name);
    if (!hired) {
      economy.addCash(guildId, userId, type.price);
      return { status: 'That name is taken — try again.', embeds: [staffEmbed(state, location)], rows: [staffRows(location, state)] };
    }
    const fresh = economy.buildState(guildId, userId);
    return { status: `🧑‍🍳 **${name}** joined as ${type.label}.`, embeds: [staffEmbed(fresh, pickLocation(fresh, null))], rows: [staffRows(pickLocation(fresh, null), fresh)] };
  }

  if (action === 'train') {
    const name = args[0];
    if (!hasTrainingUnlocked(state)) {
      return { status: 'Training unlocks with your **first prestige** (level 10 → /taco empire).', embeds: [staffEmbed(state, location)], rows: [staffRows(location, state)] };
    }
    const employee = location.employees.find((e) => e.name === name);
    if (!employee) return { status: `No employee named **${name}** here.`, embeds: [staffEmbed(state, location)], rows: [staffRows(location, state)] };
    if ((employee.training ?? 0) >= ECONOMY.training.maxLevel) {
      return { status: `**${name}** is fully trained.`, embeds: [staffEmbed(state, location)], rows: [staffRows(location, state)] };
    }
    const cost = ECONOMY.training.baseCost * ECONOMY.training.costGrowth ** (employee.training ?? 0);
    if (state.user.cash < cost) {
      return { status: `Training costs **${formatMoney(cost)}** — you have ${formatMoney(state.user.cash)}.`, embeds: [staffEmbed(state, location)], rows: [staffRows(location, state)] };
    }
    economy.addCash(guildId, userId, -cost);
    const trained = economy.trainEmployee(guildId, userId, location.key, name);
    const fresh = economy.buildState(guildId, userId);
    return { status: `📚 **${name}** trained to level ${trained.training}.`, embeds: [staffEmbed(fresh, pickLocation(fresh, null))], rows: [staffRows(pickLocation(fresh, null), fresh)] };
  }

  return { embeds: [staffEmbed(state, location)], rows: [staffRows(location, state)] };
}

function staffEmbed(state, location) {
  const staffLines = location.employees.length
    ? location.employees.map((emp) => {
        const meta = employeeConfig(emp.key) ?? { label: emp.key, bonus: 0, wage: 0 };
        const trained = emp.training ? ` · 📚×${emp.training}` : '';
        return `**${emp.name}** — ${meta.label} (+${Math.round(meta.bonus * 100)}%${trained}, wage ${formatMoney(meta.wage)}/h)`;
      })
    : '*Nobody yet — hire below.*';

  const hireLines = ECONOMY.employees.map(
    (e) => `**${e.label}** +${Math.round(e.bonus * 100)}% · wage ${formatMoney(e.wage)}/h · 💵 ${formatMoney(e.price)}`
  );

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🧑‍🍳 Staff — ${location.name}`)
    .addFields(
      { name: `On payroll (${location.employees.length}/${ECONOMY.maxEmployeesPerLocation})`, value: staffLines.join('\n') },
      { name: 'Hirable', value: hireLines.join('\n') }
    )
    .setFooter({ text: hasTrainingUnlocked(state) ? 'Training unlocked — press any name to train.' : 'Training unlocks after your first prestige.' });
}

function staffRows(location, state) {
  const rows = [];
  const push = (label, id, style, disabled = false) => {
    if (rows.length === 0 || rows.at(-1).components.length === 5) rows.push(new ActionRowBuilder());
    rows.at(-1).addComponents(
      new ButtonBuilder().setCustomId(`taco:${id}`).setLabel(label).setStyle(style).setDisabled(disabled)
    );
  };

  for (const e of ECONOMY.employees) push(`Hire ${e.label}`, `hire:${e.key}`, ButtonStyle.Success, location.employees.length >= ECONOMY.maxEmployeesPerLocation);
  if (hasTrainingUnlocked(state)) {
    for (const emp of location.employees.slice(0, 5)) push(`📚 ${emp.name}`, `train:${emp.name}`, ButtonStyle.Primary);
  }
  return rows;
}
