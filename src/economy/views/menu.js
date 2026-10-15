import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { menuSlots, menuItemConfig } from '../engine.js';
import { formatMoney, pickLocation } from '../util.js';

export async function render({ guildId, userId, action, args }) {
  const state = economy.buildState(guildId, userId);
  const location = pickLocation(state, null);
  if (!location) return { embeds: [new EmbedBuilder().setTitle('🌮 Menu').setDescription('Run /taco once to open your free stand.')] };

  if (action === 'set') {
    const [slotPart, itemKey] = args;
    const slot = Number(slotPart);
    const slots = menuSlots(location.level);
    if (!Number.isInteger(slot) || slot < 1 || slot > slots) {
      return { status: `Slot ${slotPart} is locked — you have ${slots} at level ${location.level}.`, embeds: [menuEmbed(state, location)], rows: [menuRows(location)] };
    }
    const item = menuItemConfig(itemKey);
    if (!item) return { status: 'Unknown menu item.', embeds: [menuEmbed(state, location)], rows: [menuRows(location)] };
    if (state.user.cash < item.price) {
      return { status: `**${item.label}** costs ${formatMoney(item.price)} — you have ${formatMoney(state.user.cash)}.`, embeds: [menuEmbed(state, location)], rows: [menuRows(location)] };
    }
    economy.addCash(guildId, userId, -item.price);
    economy.setMenuItem(guildId, userId, location.key, slot - 1, itemKey);
    const fresh = economy.buildState(guildId, userId);
    return { status: `🌮 Slot ${slot} now serves **${item.label}**.`, embeds: [menuEmbed(fresh, pickLocation(fresh, null))], rows: [menuRows(pickLocation(fresh, null))] };
  }

  return { embeds: [menuEmbed(state, location)], rows: [menuRows(location)] };
}

function menuEmbed(state, location) {
  const slots = menuSlots(location.level);
  const filled = location.menu.slice(0, slots).filter(Boolean).length;
  const rows = Array.from({ length: slots }, (_, i) => {
    const key = location.menu[i];
    const meta = key ? ECONOMY.menuItems.find((m) => m.key === key) : null;
    return `Slot ${i + 1}: ${meta ? `**${meta.label}** (+${Math.round(meta.income * 0.25)}/h)` : '*empty — losing income!*'}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🌮 Menu — ${location.name}`)
    .setDescription(rows.join('\n') + `\n\n${filled < slots ? `💡 ${ECONOMY.flavor.menuTrap}` : '✨ Every slot is filled!'}`)
    .setFooter({ text: 'More slots unlock as the business levels up' });

  return embed;
}

function menuRows(location) {
  const rows = [];
  for (const item of ECONOMY.menuItems) {
    if (rows.length === 0 || rows.at(-1).components.length === 5) rows.push(new ActionRowBuilder());
    const emptySlot = location.menu.slice(0, menuSlots(location.level)).findIndex((s) => !s) + 1;
    rows.at(-1).addComponents(
      new ButtonBuilder()
        .setCustomId(`taco:set:${emptySlot || 1}:${item.key}`)
        .setLabel(`${item.label}`)
        .setStyle(ButtonStyle.Secondary)
    );
  }
  return rows;
}
