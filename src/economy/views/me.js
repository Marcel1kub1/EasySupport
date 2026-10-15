import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { staffStats } from '../../db.js';
import { netWorth, hourlyRate, isRushHour, isLunchRush, activeSeasonal, eventMultiplier } from '../engine.js';
import { formatMoney, formatRate } from '../util.js';
import { monthPeriod } from './helpers.js';

export async function render({ guildId, userId, action, args, interaction }) {
  const state = economy.buildState(guildId, userId);

  if (action === 'priority') {
    const active = economy.hasPerk(guildId, userId, 'priority');
    if (!active) {
      const cfg = ECONOMY.perks.priority;
      if (state.user.cash < cfg.price) {
        return { status: `⚡ **${cfg.label}** costs ${formatMoney(cfg.price)} — you have ${formatMoney(state.user.cash)}.`, embeds: [meEmbed(state, guildId, userId)], rows: [] };
      }
      economy.addCash(guildId, userId, -cfg.price);
      economy.addPerk(guildId, userId, 'priority', Date.now() + cfg.durationHours * 3_600_000);
      return { status: `⚡ **${cfg.label}** active for ${cfg.durationHours / 24} days — your tickets now flag, ping and log as priority.`, embeds: [meEmbed(economy.buildState(guildId, userId), guildId, userId)], rows: [] };
    }
    return { status: '⚡ Priority support is already active.', embeds: [meEmbed(state, guildId, userId)], rows: [] };
  }

  if (action === 'redeem') {
    const code = (args[0] ?? '').toUpperCase();
    const coupon = ECONOMY.coupons.find((c) => c.code.toUpperCase() === code);
    if (!coupon) return { status: 'That code does not exist.', embeds: [meEmbed(state, guildId, userId)], rows: [meRows(state)] };
    if (!economy.redeemCoupon(guildId, userId, coupon.code)) {
      return { status: `You already redeemed **${coupon.code}**.`, embeds: [meEmbed(state, guildId, userId)], rows: [meRows(state)] };
    }
    const balance = economy.addCash(guildId, userId, coupon.reward);
    return { status: `🎟️ **${coupon.code}** redeemed — +${formatMoney(coupon.reward)} (balance ${formatMoney(balance)}).`, embeds: [meEmbed(economy.buildState(guildId, userId), guildId, userId)], rows: [meRows(economy.buildState(guildId, userId))] };
  }

  if (action === 'gift' && interaction) {
    const modal = new ModalBuilder()
      .setCustomId('taco:gift-modal')
      .setTitle('Gift cash')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('member').setLabel('Member ID').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('amount').setLabel('Amount').setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
    await interaction.showModal(modal);
    return { status: 'Fill in the popup to send cash.', embeds: [meEmbed(state, guildId, userId)], rows: [meRows(state)] };
  }

  if (action === 'stats') {
    return {
      embeds: [meEmbed(state, guildId, userId), statsEmbed(state, guildId, userId)],
      rows: [meRows(state)],
    };
  }

  return { embeds: [meEmbed(state, guildId, userId)], rows: [meRows(state)] };
}

function meEmbed(state, guildId, userId) {
  const unlocked = economy.listAchievements(guildId, userId);
  const badges = ECONOMY.achievements.filter((a) => unlocked.includes(a.key));
  const payouts = economy.listStaffPayouts(guildId, monthPeriod()).find((p) => p.userId === userId);
  const tickets = staffStats(guildId, monthPeriod()).find((s) => s.userId === userId);
  const activeBoosts = (state.boosts ?? []).filter((b) => b.expiresAt > Date.now());

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📈 Your profile')
    .addFields(
      { name: 'Balance', value: `${formatMoney(state.user.cash)} ${ECONOMY.currency}`, inline: true },
      { name: 'Net worth', value: formatMoney(netWorth(state)), inline: true },
      { name: 'Income', value: formatRate(hourlyRate(state)), inline: true },
      { name: 'Ingredients', value: String(state.user.ingredients), inline: true },
      { name: 'Daily streak', value: String(state.user.daily_streak ?? 0), inline: true },
      { name: 'Businesses', value: String(state.locations.length), inline: true },
      {
        name: `🏆 Badges (${badges.length}/${ECONOMY.achievements.length})`,
        value: badges.length ? badges.map((b) => `${b.badge} ${b.label}`).join(' · ') : '*none yet — see /taco → quests and empire*',
      },
      {
        name: '🧑‍💼 Staff',
        value: `Reasoned closures this month: **${tickets?.reasoned ?? 0}** · paid **${formatMoney(payouts?.amount ?? 0)}**${payouts && payouts.amount >= ECONOMY.staffPayouts.monthlyCapPerStaff ? ' (capped)' : ''}`,
      },
      {
        name: '⚡ Boosts & perks',
        value:
          (activeBoosts.length ? activeBoosts.map((b) => `×${b.multiplier} active`).join(' · ') : 'no active boosts') +
          ` · priority ${economy.hasPerk(guildId, userId, 'priority') ? '⚡ active' : 'off'}`,
      },
      {
        name: '🎟️ Coupons',
        value: ECONOMY.coupons.map((c) => `**${c.code}** (${formatMoney(c.reward)})${economy.listRedeemedCodes(guildId, userId).includes(c.code.toUpperCase()) ? ' ✅' : ''}`).join('\n'),
      }
    );
}

function statsEmbed(state, guildId, userId) {
  const now = Date.now();
  const seasonal = activeSeasonal(now);
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('📊 Live economy')
    .setDescription(
      [
        `Rush Hour ${isRushHour(now) ? '**LIVE ×2**' : `(${ECONOMY.events.rushHour.startHour}:00–${ECONOMY.events.rushHour.endHour}:00 UTC)`}`,
        `Lunch Rush ${isLunchRush(now) ? '**LIVE ×2 tips**' : '(weekends)'}`,
        seasonal.length ? `Seasonal: ${seasonal.map((s) => `**${s.name} ×${s.multiplier}**`).join(', ')}` : null,
        `Quiet queue **×${ECONOMY.quietQueueBonus.multiplier}** while no tickets are open`,
        `Your total multiplier right now: **×${eventMultiplier(now, {}).toFixed(2)}**`,
      ]
        .filter(Boolean)
        .join('\n')
    );
}

function meRows(state) {
  const row = new ActionRowBuilder();
  row.addComponents(
    new ButtonBuilder().setCustomId('taco:priority').setLabel('⚡ Priority support').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('taco:stats').setLabel('📊 Live economy').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('taco:gift').setLabel('🎁 Gift').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('taco:redeem:WISPBYTE').setLabel('🎟️ Redeem WISPBYTE').setStyle(ButtonStyle.Secondary)
  );
  return [row];
}
