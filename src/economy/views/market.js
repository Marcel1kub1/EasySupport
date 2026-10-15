import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney } from '../util.js';
import { hourKey, seededRandom } from './market-engine.js';

export async function render({ guildId, userId, action, args }) {
  const prices = ECONOMY.sauceMarket.sauces.map((sauce) => ({
    sauce,
    price: priceOf(guildId, sauce),
  }));

  if (action === 'mktbuy' || action === 'mktsell') {
    const key = args[0];
    const qty = Math.max(1, Math.min(ECONOMY.sauceMarket.maxPositionsPerSauce, Number(args[1]) || 1));
    const sauce = ECONOMY.sauceMarket.sauces.find((s) => s.key === key);
    if (!sauce) return { status: 'Unknown sauce.', rows: [marketRows(prices)], embeds: [marketEmbed(guildId, userId, prices)] };

    const price = priceOf(guildId, sauce);
    const status = action === 'mktbuy'
      ? buyShares(guildId, userId, sauce, price, qty)
      : sellShares(guildId, userId, sauce, price, qty);
    const fresh = ECONOMY.sauceMarket.sauces.map((s) => ({ sauce: s, price: priceOf(guildId, s) }));
    return { status, rows: [marketRows(fresh)], embeds: [marketEmbed(guildId, userId, fresh)] };
  }

  return { embeds: [marketEmbed(guildId, userId, prices)], rows: [marketRows(prices)] };
}

function buyShares(guildId, userId, sauce, price, qty) {
  const cost = price * qty;
  const cash = economy.getUser(guildId, userId)?.cash ?? 0;
  if (cash < cost) return `Need **${formatMoney(cost)}** for ${qty}× ${sauce.label} — you have ${formatMoney(cash)}.`;
  economy.addCash(guildId, userId, -cost);
  economy.buySauce(guildId, userId, sauce.key, qty, price);
  return `📈 Bought **${qty}× ${sauce.label}** at ${formatMoney(price)} each.`;
}

function sellShares(guildId, userId, sauce, price, qty) {
  const position = economy.getSaucePosition(guildId, userId, sauce.key);
  if (!position || position.qty < qty) {
    return `You only hold ${position?.qty ?? 0}× ${sauce.label}.`;
  }
  economy.sellSauce(guildId, userId, sauce.key, qty);
  economy.addCash(guildId, userId, price * qty);
  const profit = (price - position.avgPrice) * qty;
  const sign = profit >= 0 ? '📈' : '📉';
  return `${sign} Sold **${qty}× ${sauce.label}** at ${formatMoney(price)} — ${profit >= 0 ? '+' : ''}${formatMoney(Math.round(profit))} on the trade.`;
}

/** Deterministic per-guild, per-hour price walk (mean-reverting). */
export function priceOf(guildId, sauce, now = Date.now()) {
  const seed = seededRandom(`${guildId}:${sauce.key}:${hourKey(now)}`);
  const drift = (seed() - 0.48) * 2; // slight upward bias keeps the market fun
  const wave = Math.sin(Number(hourKey(now)) / 6 + sauce.base) * sauce.volatility * 0.5;
  return Math.max(sauce.base * 0.25, Math.round(sauce.base * (1 + drift * sauce.volatility + wave)));
}

function marketEmbed(guildId, userId, prices) {
  const positions = economy.listSaucePositions(guildId, userId);
  const byKey = new Map(positions.map((p) => [p.sauce, p]));

  const rows = prices.map(({ sauce, price }) => {
    const pos = byKey.get(sauce.key);
    const change = price - sauce.base;
    const trend = change > sauce.base * 0.05 ? '🔺' : change < -sauce.base * 0.05 ? '🔻' : '➖';
    const held = pos ? ` · you hold **${pos.qty}** @ ${formatMoney(pos.avgPrice)} (${price > pos.avgPrice ? '+' : ''}${Math.round(((price - pos.avgPrice) / pos.avgPrice) * 100)}%)` : '';
    return `${trend} **${sauce.label}** — ${formatMoney(price)}${held}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('📈 Sauce Market')
    .setDescription(
      rows.join('\n') +
        '\n\nPrices drift every hour — buy low, sell high. Positions never expire.' +
        (rows.some((r) => r.includes('you hold')) ? '' : '')
    )
    .setFooter({ text: `Next hourly tick at :00 · ${positions.length} open position(s)` });

  return embed;
}

function marketRows(prices) {
  const rows = [];
  for (const { sauce } of prices) {
    if (rows.length === 0 || rows.at(-1).components.length === 3) rows.push(new ActionRowBuilder());
    rows.at(-1).addComponents(
      new ButtonBuilder().setCustomId(`taco:mktbuy:${sauce.key}:1`).setLabel(`Buy 1 ${sauce.label}`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`taco:mktbuy:${sauce.key}:5`).setLabel('×5').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`taco:mktsell:${sauce.key}:5`).setLabel('Sell 5').setStyle(ButtonStyle.Secondary)
    );
  }
  return rows;
}
