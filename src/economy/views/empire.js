import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import {
  locationConfig, locationIncome, unlockBlockReason, locationIngredients,
  isMaxLevel, canPrestige, prestigeMultiplier, expandCost,
} from '../engine.js';
import { formatMoney, formatRate, formatIngredients } from '../util.js';

export async function render({ guildId, userId, action, args }) {
  const state = economy.buildState(guildId, userId);

  const actionResult = runAction(action, guildId, userId, args, state);
  const status = actionResult?.status;
  const fresh = actionResult ? economy.buildState(guildId, userId) : state;

  return { status, embeds: [empireEmbed(fresh)], rows: [empireRows(fresh, args)] };
}

function runAction(action, guildId, userId, args, state) {
  if (action === 'buy') {
    const key = args[0];
    const cfg = locationConfig(key);
    if (!cfg) return { status: 'Unknown business.' };
    if (cfg.free) return { status: 'That one is free — everyone starts with it.' };
    if (state.locations.some((l) => l.key === key)) return { status: `You already own a **${cfg.label}**.` };
    const blocked = unlockBlockReason(key, state);
    if (blocked) return { status: `🔒 ${blocked}` };
    const ingredients = locationIngredients(key);
    if (state.user.ingredients < ingredients) {
      return { status: `Needs **${ingredients}** ingredients — you have ${formatIngredients(state.user.ingredients)}. Mine with ⛏️.` };
    }
    if (state.user.cash < cfg.buyPrice) {
      return { status: `Costs **${formatMoney(cfg.buyPrice)}** — you have ${formatMoney(state.user.cash)}.` };
    }
    economy.addCash(guildId, userId, -cfg.buyPrice);
    if (ingredients > 0) economy.addIngredients(guildId, userId, -ingredients);
    economy.buyLocation(guildId, userId, key, cfg.label);
    const owned = state.locations.length + 1;
    const synergy = owned > 1 ? ` · 🔗 +${Math.round((owned - 1) * ECONOMY.synergy.bonusPerExtraLine * 100)}% all income` : '';
    return { status: `🎉 **${cfg.label}** is open!${synergy}` };
  }

  if (action === 'prestige') {
    const location = state.locations.find((l) => l.key === args[0]);
    if (!location) return { status: 'You do not own that business.' };
    const cfg = locationConfig(location.key);
    if (cfg?.side) return { status: 'Side businesses cannot be prestiged.' };
    if (!canPrestige(location)) return { status: `Prestige needs level ${cfg.maxLevel} (you are ${location.level}).` };
    economy.setPrestige(guildId, userId, location.key, location.prestige + 1, 1);
    const gain = ECONOMY.prestige.multiplierPerPrestige * (location.prestige + 1) * 100;
    const unlocked = !hasAnyPrestige(state);
    return {
      status:
        `⭐ **${location.name}** prestiged — permanent **+${Math.round(gain)}%** for it.` +
        (unlocked ? '\n🔓 Unlocked: staff training, /advertise (Biktok) and more locations.' : ''),
    };
  }

  if (action === 'expand') {
    const location = state.locations.find((l) => l.key === args[0]);
    if (!location) return { status: 'You do not own that business.' };
    const cost = expandCost(location);
    if (!Number.isFinite(cost)) return { status: `**${location.name}** is fully expanded.` };
    if (state.user.cash < cost) return { status: `Expansion costs **${formatMoney(cost)}**.` };
    economy.addCash(guildId, userId, -cost);
    economy.setExpanded(guildId, userId, location.key, location.expanded + 1);
    return { status: `🏗️ **${location.name}** expanded to level ${location.expanded + 1}.` };
  }

  return { status: null };
}

function hasAnyPrestige(state) {
  return state.locations.some((l) => (l.prestige ?? 0) > 0);
}

function empireEmbed(state) {
  const lines = Object.values(ECONOMY.locations)
    .sort((a, b) => a.order - b.order)
    .map((cfg) => {
      const owned = state.locations.find((l) => l.key === cfgOwnKey(cfg));
      if (owned) {
        const main = !cfg.side;
        const canP = main && canPrestige(owned);
        return `✅ **${owned.name}** — Lv ${owned.level}/${cfg.maxLevel}${owned.prestige ? ` · ⭐${owned.prestige} (×${prestigeMultiplier(owned).toFixed(2)})` : ''} · ${formatRate(locationIncome(owned))}${canP ? ' · **prestige ready!**' : ''}`;
      }
      const blocked = unlockBlockReason(cfgOwnKey(cfg), state);
      const price = cfg.free ? 'free' : `${formatMoney(cfg.buyPrice)}${cfg.ingredients ? ` + ${cfg.ingredients}🥘` : ''}`;
      return `${blocked ? '🔒' : '💰'} **${cfg.label}** — ${price}${blocked ? ` · ${blocked}` : ''}`;
    });

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🏢 Your empire')
    .setDescription(lines.join('\n') + `\n\n🔗 Ownership synergy: **+${Math.round(Math.max(0, state.locations.filter((l) => !locationConfig(l.key)?.side).length - 1) * ECONOMY.synergy.bonusPerExtraLine * 100)}%**`)
    .setFooter({ text: 'Buy · prestige · expand — one tap each' });
}

function cfgOwnKey(cfg) {
  return Object.keys(ECONOMY.locations).find((k) => ECONOMY.locations[k] === cfg);
}

function empireRows(state, args) {
  const rows = [];
  const push = (label, id, style, disabled = false) => {
    if (rows.length === 0 || rows.at(-1).components.length === 5) rows.push(new ActionRowBuilder());
    rows.at(-1).addComponents(
      new ButtonBuilder().setCustomId(`taco:${id}`).setLabel(label).setStyle(style).setDisabled(disabled)
    );
  };

  for (const [key, cfg] of Object.entries(ECONOMY.locations)) {
    const owned = state.locations.some((l) => l.key === key);
    if (owned) {
      if (canPrestige(state.locations.find((l) => l.key === key)) && !cfg.side) {
        push(`⭐ Prestige ${cfg.label}`, `prestige:${key}`, ButtonStyle.Primary);
      }
    } else {
      const blocked = unlockBlockReason(key, state);
      push(`Buy ${cfg.label}`, `buy:${key}`, ButtonStyle.Success, !!blocked);
    }
  }
  return rows;
}
