import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { hourlyRate, workPayout, tipsPayout, isRushHour, eventMultiplier, activeSeasonal, netWorth } from '../engine.js';
import { cooldownRemaining, formatDuration, formatMoney, formatRate, primaryLocation, nowIso } from '../util.js';
import { dailyPeriod, isStreakMissed } from './helpers.js';

export async function render({ guildId, userId, action }) {
  const now = Date.now();
  const row = economy.ensureUser(guildId, userId);

  if (action === 'work' || action === 'tips' || action === 'clean' || action === 'daily' || action === 'mine') {
    const status = runAction(action, guildId, userId, row, now);
    const state = economy.buildState(guildId, userId, now);
    const freshRow = economy.getUser(guildId, userId);
    return { status, embeds: [homeEmbed(state, now)], rows: [actionRow(freshRow, state, now)] };
  }

  const state = economy.buildState(guildId, userId, now);
  return { embeds: [homeEmbed(state, now)], rows: [actionRow(row, state, now)] };
}

function runAction(action, guildId, userId, row, now) {
  const state = economy.buildState(guildId, userId, now);
  const location = primaryLocation(state);
  if (!location) return 'You have no shack yet.';

  if (action === 'work') {
    const remaining = cooldownRemaining(row, 'last_work_at', ECONOMY.cooldowns.work, now);
    if (remaining > 0) return `Still on shift — ready in **${formatDuration(remaining)}**.`;
    const happy = Math.random() < ECONOMY.events.happyHour.chancePerWork;
    const payout = workPayout(state, happy ? ECONOMY.events.happyHour.multiplier : 1, now);
    economy.addCash(guildId, userId, payout);
    economy.setCooldown(guildId, userId, 'last_work_at', nowIso(now));
    return `🌮 Shift done at **${location.name}**: **+${formatMoney(payout)}** ${ECONOMY.currency}${happy ? ' · 🎉 Happy Hour doubled it!' : ''}`;
  }

  if (action === 'tips') {
    const remaining = cooldownRemaining(row, 'last_tips_at', ECONOMY.cooldowns.tips, now);
    if (remaining > 0) return `Tip jar is empty — check back in **${formatDuration(remaining)}**.`;
    const { minRoll, maxRoll } = ECONOMY.payouts.tips;
    const roll = minRoll + Math.floor(Math.random() * (maxRoll - minRoll + 1));
    const payout = Math.round(tipsPayout(location, roll));
    economy.addCash(guildId, userId, payout);
    economy.setCooldown(guildId, userId, 'last_tips_at', nowIso(now));
    return `🪙 Collected **+${formatMoney(payout)}** in tips.`;
  }

  if (action === 'clean') {
    const remaining = cooldownRemaining(row, 'last_clean_at', ECONOMY.cooldowns.clean, now);
    if (remaining > 0) return `Already sparkling — again in **${formatDuration(remaining)}**.`;
    economy.setCleanliness(guildId, userId, location.key, ECONOMY.cleanliness.cleanRestore);
    economy.touchCleanliness(guildId, userId, location.key, now);
    economy.setCooldown(guildId, userId, 'last_clean_at', nowIso(now));
    return `🧽 **${location.name}** is spotless.`;
  }

  if (action === 'daily') {
    const remaining = cooldownRemaining(row, 'last_daily_at', ECONOMY.cooldowns.daily, now);
    if (remaining > 0) return `Daily already claimed — next in **${formatDuration(remaining)}**.`;
    const streak = isStreakMissed(row.last_daily_at, now) ? 1 : (row.daily_streak ?? 0) + 1;
    const reward = ECONOMY.payouts.daily.base * Math.min(streak, ECONOMY.payouts.daily.streakCap);
    economy.addCash(guildId, userId, reward);
    economy.setDailyStreak(guildId, userId, streak);
    economy.setCooldown(guildId, userId, 'last_daily_at', nowIso(now));
    return `🎁 Daily bonus **+${formatMoney(reward)}** (day ${streak})`;
  }

  if (action === 'mine') {
    const remaining = cooldownRemaining(row, 'last_mine_at', ECONOMY.cooldowns.mine, now);
    if (remaining > 0) return `Pickaxe recovering — ready in **${formatDuration(remaining)}**.`;
    const { min, max } = ECONOMY.payouts.mine;
    const found = min + Math.floor(Math.random() * (max - min + 1));
    economy.addIngredients(guildId, userId, found);
    economy.setCooldown(guildId, userId, 'last_mine_at', nowIso(now));
    return `⛏️ Mined **${found}** ingredient${found === 1 ? '' : 's'}.`;
  }

  return null;
}

function homeEmbed(state, now) {
  const location = primaryLocation(state);
  const activeBoosts = (state.boosts ?? []).filter((b) => b.expiresAt > now);
  const seasonal = activeSeasonal(now);

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🌮 ${location?.name ?? 'Your empire'}`)
    .setDescription(
      [
        `💰 **${formatMoney(state.user.cash)}** ${ECONOMY.currency} · 📈 **${formatRate(hourlyRate(state))}** · 🏆 ${formatMoney(netWorth(state))} net worth`,
        `🏢 Businesses: **${state.locations.length}** · 🥘 Ingredients: **${state.user.ingredients}** · 🎁 Streak: **${state.user.daily_streak ?? 0}**`,
        activeBoosts.length ? `✨ Boosts: ${activeBoosts.map((b) => `×${b.multiplier}`).join(' · ')}` : null,
        `⚡ Live multiplier **×${eventMultiplier(now, {}).toFixed(2)}**${isRushHour(now) ? ' · Rush Hour!' : ''}${seasonal.length ? ` · ${seasonal.map((s) => s.name).join(', ')}` : ''}`,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .setFooter({ text: 'Everything is a button away — the panel never expires.' });
}

function actionRow(row, state, now) {
  const ready = (column, seconds) => cooldownRemaining(row, column, seconds, now) === 0;
  const dirty = primaryLocation(state)?.cleanliness < ECONOMY.cleanliness.cleanThreshold;
  const btn = (id, label, style, disabled = false) =>
    new ButtonBuilder().setCustomId(`taco:${id}`).setLabel(label).setStyle(style).setDisabled(disabled);

  return new ActionRowBuilder().addComponents(
    btn('work', ready('last_work_at', ECONOMY.cooldowns.work) ? '🌮 Work' : '🌮 Work ⏳', ButtonStyle.Success),
    btn('tips', '🪙 Tips', ButtonStyle.Success),
    btn('clean', dirty ? '🧽 Clean!' : '🧽 Clean', ButtonStyle.Secondary),
    btn('daily', '🎁 Daily', ButtonStyle.Primary),
    btn('mine', '⛏️ Mine', ButtonStyle.Secondary)
  );
}
