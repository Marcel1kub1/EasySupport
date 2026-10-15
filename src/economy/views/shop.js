import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { maxUpgradesOwned, expandCost, hourlyRate, decorationsMultiplier } from '../engine.js';
import { formatMoney, pickLocation } from '../util.js';

export async function render({ guildId, userId, action, args }) {
  const state = economy.buildState(guildId, userId);
  const location = pickLocation(state, null);
  if (!location) return { embeds: [new EmbedBuilder().setTitle('🛒 Shop').setDescription('Run /taco once to open your free stand.')] };

  if (action === 'buy') {
    const [kind, key] = (args[0] ?? '').split(':');
    const status = buy(guildId, userId, kind, key, state, location);
    const fresh = economy.buildState(guildId, userId);
    return { status, embeds: [shopEmbed(fresh, pickLocation(fresh, null))], rows: [buyRows(pickLocation(fresh, null))] };
  }

  if (action === 'expand') {
    const cost = expandCost(location);
    if (!Number.isFinite(cost)) return { status: '**That business is fully expanded.**', embeds: [shopEmbed(state, location)], rows: [buyRows(location)] };
    if (state.user.cash < cost) {
      return { status: `Expansion costs **${formatMoney(cost)}** — you have ${formatMoney(state.user.cash)}.`, embeds: [shopEmbed(state, location)], rows: [buyRows(location)] };
    }
    economy.addCash(guildId, userId, -cost);
    economy.setExpanded(guildId, userId, location.key, location.expanded + 1);
    const fresh = economy.buildState(guildId, userId);
    return { status: `🏗️ **${location.name}** expanded — ${maxUpgradesOwned(pickLocation(fresh, null))} upgrade slots.`, embeds: [shopEmbed(fresh, pickLocation(fresh, null))], rows: [buyRows(pickLocation(fresh, null))] };
  }

  return { embeds: [shopEmbed(state, location)], rows: [buyRows(location)] };
}

function buy(guildId, userId, kind, key, state, location) {
  if (kind === 'upgrade') {
    const upgrade = ECONOMY.upgrades.find((u) => u.key === key);
    if (!upgrade) return 'Unknown upgrade.';
    if (location.upgrades.includes(key)) return `You already own the **${upgrade.label}**.`;
    if (location.level < upgrade.minLevel) return `Needs level ${upgrade.minLevel} (you are ${location.level}).`;
    if (location.upgrades.length >= maxUpgradesOwned(location)) {
      return `No free upgrade slots (${location.upgrades.length}/${maxUpgradesOwned(location)}) — expand first.`;
    }
    if (state.user.cash < upgrade.price) return `**${upgrade.label}** costs ${formatMoney(upgrade.price)} — you have ${formatMoney(state.user.cash)}.`;
    economy.addCash(guildId, userId, -upgrade.price);
    economy.buyUpgrade(guildId, userId, location.key, key);
    return `🔧 Bought the **${upgrade.label}** (+${Math.round(upgrade.bonus * 100)}% income).`;
  }

  if (kind === 'decor') {
    const decor = ECONOMY.decorations.find((d) => d.key === key);
    if (!decor) return 'Unknown decoration.';
    if (economy.hasDecoration(guildId, userId, location.key, key)) return `**${location.name}** already has it.`;
    if (state.user.cash < decor.price) return `Costs ${formatMoney(decor.price)} — you have ${formatMoney(state.user.cash)}.`;
    economy.addCash(guildId, userId, -decor.price);
    economy.buyDecoration(guildId, userId, location.key, key);
    return `🎀 **${location.name}** got the **${decor.label}**.`;
  }

  if (kind === 'boost') {
    const boost = ECONOMY.boosts.find((b) => b.key === key);
    if (!boost) return 'Unknown boost.';
    if (state.user.cash < boost.price) return `Costs ${formatMoney(boost.price)} — you have ${formatMoney(state.user.cash)}.`;
    economy.addCash(guildId, userId, -boost.price);
    economy.addBoost(guildId, userId, `boost:${key}`, boost.multiplier, Date.now() + boost.durationHours * 3_600_000);
    return `✨ **${boost.label}** active: ×${boost.multiplier} for ${boost.durationHours}h.`;
  }

  if (kind === 'hq') {
    const hq = ECONOMY.headquarters.find((h) => h.key === key);
    if (!hq) return 'Unknown HQ upgrade.';
    if (economy.hasHq(guildId, userId, key)) return `You already own **${hq.label}**.`;
    if (state.user.cash < hq.price) return `Costs ${formatMoney(hq.price)} — you have ${formatMoney(state.user.cash)}.`;
    economy.addCash(guildId, userId, -hq.price);
    economy.buyHq(guildId, userId, key);
    return `🏢 **${hq.label}** acquired: +${Math.round(hq.bonus * 100)}% on every business.`;
  }

  return 'Unknown item.';
}

function shopEmbed(state, location) {
  const owned = location.upgrades;
  const lines = ECONOMY.upgrades.map((u) => {
    const has = owned.includes(u.key);
    const locked = location.level < u.minLevel;
    const status = has ? '✅ owned' : locked ? `🔒 level ${u.minLevel}` : `💵 ${formatMoney(u.price)}`;
    return `**${u.label}** +${Math.round(u.bonus * 100)}% · ${status}`;
  });
  const decorLines = ECONOMY.decorations.map((d) => {
    const has = economyHasDecor(state, d.key);
    return `**${d.label}** +${Math.round(d.bonus * 100)}% · ${has ? '✅ owned' : `💵 ${formatMoney(d.price)}`}`;
  });
  const boostLines = ECONOMY.boosts.map((b) => `**${b.label}** ×${b.multiplier}/${b.durationHours}h · 💵 ${formatMoney(b.price)}`);
  const hqLines = ECONOMY.headquarters.map((h) => `**${h.label}** +${Math.round(h.bonus * 100)}% global · ${state.hq.includes(h.key) ? '✅ owned' : `💵 ${formatMoney(h.price)}`}`);

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🛒 Shop — ${location.name}`)
    .addFields(
      { name: '🔧 Upgrades', value: lines.join('\n') },
      { name: '🎀 Decorations', value: decorLines.join('\n') },
      { name: '✨ Boosts', value: boostLines.join('\n') },
      { name: '🏢 Headquarters', value: hqLines.join('\n') }
    )
    .setFooter({ text: `Income ${formatMoney(hourlyRate(state))}/h · decor +${Math.round((decorationsMultiplier(location) - 1) * 100)}%` });
}

function economyHasDecor(state, key) {
  return state.locations.some((l) => (l.decorations ?? []).includes(key));
}

function buyRows(location) {
  const rows = [];
  const push = (label, id, style, disabled = false) => {
    if (rows.length === 0 || rows.at(-1).components.length === 5) rows.push(new ActionRowBuilder());
    rows.at(-1).addComponents(
      new ButtonBuilder().setCustomId(`taco:${id}`).setLabel(label).setStyle(style).setDisabled(disabled)
    );
  };

  for (const u of ECONOMY.upgrades) push(u.label, `buy:upgrade:${u.key}`, ButtonStyle.Secondary, location.upgrades.includes(u.key));
  for (const b of ECONOMY.boosts) push(b.label, `buy:boost:${b.key}`, ButtonStyle.Primary);
  for (const h of ECONOMY.headquarters) push(h.label, `buy:hq:${h.key}`, ButtonStyle.Success);
  push('🏗️ Expand', 'expand', ButtonStyle.Secondary);

  return rows;
}
