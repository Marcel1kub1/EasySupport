/*
 * Pure economy math — no Discord, no SQL, no I/O. Every payout, decay and
 * multiplier lives here so the whole balance model is unit-testable and the
 * commands stay thin. State is a plain object built by db.js:
 *
 *   {
 *     user: { cash, bank, dailyStreak, ingredients },
 *     locations: [{ key, name, level, prestige, cleanliness, upgrades: [key],
 *                  menu: [itemKey|null, ...], employees: [{ key, training }] }],
 *     hq: [key],
 *     boosts: [{ kind, multiplier, expiresAt }],   // ms epoch
 *   }
 */
import { ECONOMY } from './config.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* ------------------------------- small lookups ------------------------------*/

export function locationConfig(key, config = ECONOMY) {
  return config.locations[key] ?? null;
}

export function upgradeConfig(key, config = ECONOMY) {
  return config.upgrades.find((u) => u.key === key) ?? null;
}

export function menuItemConfig(key, config = ECONOMY) {
  return config.menuItems.find((m) => m.key === key) ?? null;
}

export function employeeConfig(key, config = ECONOMY) {
  return config.employees.find((e) => e.key === key) ?? null;
}

/* ------------------------------- multipliers --------------------------------*/

/** +15% per prestige of this location, stacking. */
export function prestigeMultiplier(location, config = ECONOMY) {
  return 1 + (location.prestige ?? 0) * config.prestige.multiplierPerPrestige;
}

/** 1 + sum of owned upgrade bonuses (upgrades are one-off purchases). */
export function upgradesMultiplier(location, config = ECONOMY) {
  const bonus = (location.upgrades ?? []).reduce(
    (sum, key) => sum + (upgradeConfig(key, config)?.bonus ?? 0), 0);
  return 1 + bonus;
}

/** Flat hourly income added by the menu (sum of item incomes × 0.25). */
export function menuBonusPerHour(location, config = ECONOMY) {
  const items = location.menu ?? [];
  return items.reduce((sum, key) => sum + (menuItemConfig(key, config)?.income ?? 0), 0) * 0.25;
}

/** Decorations multiply the location by a small stacked bonus. */
export function decorationsMultiplier(location, config = ECONOMY) {
  const bonus = (location.decorations ?? []).reduce(
    (sum, key) => sum + (config.decorations.find((d) => d.key === key)?.bonus ?? 0), 0);
  return 1 + bonus;
}

/** How many upgrades this location may own (expansion buys more slots). */
export function maxUpgradesOwned(location, config = ECONOMY) {
  const slots = config.upgradeSlots.base + (location.expanded ?? 0) * config.upgradeSlots.perExpansion;
  return Math.min(config.upgrades.length, slots);
}

/** Employee bonuses scale with training: bonus × (1 + training × 0.02). */
export function employeesMultiplier(location, config = ECONOMY) {
  const bonus = (location.employees ?? []).reduce((sum, emp) => {
    const base = employeeConfig(emp.key, config)?.bonus ?? 0;
    return sum + base * (1 + (emp.training ?? 0) * config.training.bonusPerLevel);
  }, 0);
  return 1 + bonus;
}

export function employeeWages(location, config = ECONOMY) {
  return (location.employees ?? []).reduce(
    (sum, emp) => sum + (employeeConfig(emp.key, config)?.wage ?? 0), 0);
}

/** Dirty shacks earn less. */
export function cleanlinessMultiplier(location, config = ECONOMY) {
  const c = location.cleanliness ?? config.cleanliness.cleanRestore;
  return c < config.cleanliness.cleanThreshold ? 1 - config.cleanliness.hourlyPenaltyWhenDirty : 1;
}

/** HQ upgrades are global multipliers across every location. */
export function headquartersMultiplier(state, config = ECONOMY) {
  const bonus = (state.hq ?? []).reduce(
    (sum, key) => sum + (config.headquarters.find((h) => h.key === key)?.bonus ?? 0), 0);
  return 1 + bonus;
}

/** Owning more location lines pays. Counts non-side locations. */
export function synergyMultiplier(state, config = ECONOMY) {
  const lines = (state.locations ?? []).filter((l) => !locationConfig(l.key, config)?.side).length;
  return 1 + Math.max(0, lines - 1) * config.synergy.bonusPerExtraLine;
}

/** Product of every active income boost (shop boosts + advertising). */
export function activeBoostMultiplier(state, now = Date.now()) {
  return (state.boosts ?? [])
    .filter((b) => b.expiresAt > now)
    .reduce((mult, b) => mult * b.multiplier, 1);
}

/* -------------------------------- income ------------------------------------*/

/** Net hourly income of one location before global multipliers. */
export function locationIncome(location, config = ECONOMY) {
  const cfg = locationConfig(location.key, config);
  if (!cfg) return 0;
  const gross =
    cfg.base * (location.level ?? 1) ** 2 *
    prestigeMultiplier(location, config) *
    upgradesMultiplier(location, config) *
    employeesMultiplier(location, config) *
    cleanlinessMultiplier(location, config) *
    decorationsMultiplier(location, config) +
    menuBonusPerHour(location, config);
  const wages = employeeWages(location, config) * (location.level ?? 1) * 0.1;
  return Math.max(0, gross - wages);
}

/** Total empire hourly rate (gross, before boost multipliers). */
export function hourlyRate(state, config = ECONOMY) {
  const locations = state.locations ?? [];
  const sum = locations.reduce((total, l) => total + locationIncome(l, config), 0);
  return (
    sum *
    synergyMultiplier(state, config) *
    headquartersMultiplier(state, config)
  );
}

/** Payout for a duration of passive income, honouring boost multipliers. */
export function passiveIncome(state, minutes, now = Date.now(), config = ECONOMY, context = {}) {
  const hours = minutes / 60;
  return (
    hourlyRate(state, config) *
    hours *
    activeBoostMultiplier(state, now, config) *
    eventMultiplier(now, context, config)
  );
}

/** True during the scheduled Rush Hour window (guild-local hours). */
export function isRushHour(now = Date.now(), config = ECONOMY) {
  const hour = new Date(now).getUTCHours();
  const { startHour, endHour } = config.events.rushHour;
  return startHour <= endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

export function rushHourMultiplier(now = Date.now(), config = ECONOMY) {
  return isRushHour(now, config) ? config.events.rushHour.multiplier : 1;
}

/** Active seasonal windows (inclusive dates, UTC). */
export function activeSeasonal(now = Date.now(), config = ECONOMY) {
  const today = new Date(now).toISOString().slice(0, 10);
  return (config.seasonal ?? []).filter((s) => today >= s.start && today <= s.end);
}

export function seasonalMultiplier(now = Date.now(), config = ECONOMY) {
  return activeSeasonal(now, config).reduce((mult, s) => mult * s.multiplier, 1);
}

/**
 * Everything that multiplies income for a moment in time: seasonal windows,
 * Rush Hour and the quiet-queue bonus (context.openTickets === 0). Context is
 * optional so pure per-state maths stays testable.
 */
export function eventMultiplier(now = Date.now(), context = {}, config = ECONOMY) {
  const quiet = context.openTickets === 0 && config.quietQueueBonus.openTickets === 0;
  return (
    seasonalMultiplier(now, config) *
    rushHourMultiplier(now, config) *
    (quiet ? config.quietQueueBonus.multiplier : 1)
  );
}

/** Weekend Lunch Rush: double tips on Saturday/Sunday. */
export function isLunchRush(now = Date.now(), config = ECONOMY) {
  if (!config.events.lunchRush.weekendOnly) return false;
  const day = new Date(now).getUTCDay();
  return day === 0 || day === 6;
}

/* ------------------------------ active payouts ------------------------------*/

/** /work payout: 45 min of income + flat bonus, × event multiplier. */
export function workPayout(state, eventMultiplier = 1, now = Date.now(), config = ECONOMY) {
  const base = passiveIncome(state, config.payouts.work.activeMinutes, now, config) +
    config.payouts.work.flatBonus;
  return Math.round(base * eventMultiplier);
}

/** /tips payout: flat + level×min..max roll, × cleanliness, × dirty penalty. */
export function tipsPayout(location, roll, config = ECONOMY) {
  const p = config.payouts.tips;
  const level = location.level ?? 1;
  const clean = location.cleanliness ?? config.cleanliness.cleanRestore;
  const dirty = clean < config.cleanliness.cleanThreshold ? 1 - config.cleanliness.tipsPenaltyWhenDirty : 1;
  const cleanBonus = clean / config.cleanliness.cleanRestore;
  return Math.round((p.flatBonus + level * roll) * dirty * (0.5 + 0.5 * cleanBonus));
}

/** Capped offline accrual so returning after a week pays one day, not seven. */
export function accruedIncome(state, lastSeenMs, now = Date.now(), config = ECONOMY) {
  const minutes = clamp((now - lastSeenMs) / 60000, 0, config.accrual.maxHours * 60);
  return Math.round(passiveIncome(state, minutes, now, config));
}

/* ------------------------------- cleanliness --------------------------------*/

export function decayCleanliness(cleanliness, hoursElapsed, janitors = 0, config = ECONOMY) {
  const c = config.cleanliness;
  const slowdown = c.janitorSlowdown ** janitors;
  return Math.round(clamp(cleanliness - c.decayPerHour * hoursElapsed * slowdown, 0, c.cleanRestore));
}

/* ------------------------------- progression --------------------------------*/

/** Cost to go from `level` to `level+1`. */
export function upgradeCost(location, config = ECONOMY) {
  const cfg = locationConfig(location.key, config);
  if (!cfg) return Infinity;
  const level = location.level ?? 1;
  if (level >= cfg.maxLevel) return Infinity;
  return Math.round(cfg.upgradeBase * cfg.upgradeGrowth ** (level - 1));
}

export function isMaxLevel(location, config = ECONOMY) {
  const cfg = locationConfig(location.key, config);
  return !!cfg && (location.level ?? 1) >= cfg.maxLevel;
}

export function canPrestige(location, config = ECONOMY) {
  const cfg = locationConfig(location.key, config);
  return !!cfg && !cfg.side && isMaxLevel(location, config);
}

/** Ingredient cost of an upgrade, scaled by level (restaurants/hotels). */
export function upgradeIngredients(location, config = ECONOMY) {
  const cfg = locationConfig(location.key, config);
  if (!cfg || !cfg.ingredients) return 0;
  return cfg.ingredients * (location.level ?? 1) * 0.1;
}

/** Cost of the next expansion level (adds upgrade slots). */
export function expandCost(location, config = ECONOMY) {
  const e = config.expand;
  if ((location.expanded ?? 0) >= e.maxLevel) return Infinity;
  return Math.round(e.baseCost * e.growth ** (location.expanded ?? 0));
}

/** Ingredient cost of buying a location outright (0 for the free stand). */
export function locationIngredients(key, config = ECONOMY) {
  return locationConfig(key, config)?.ingredients ?? 0;
}

/** Rough asset value used by /shack and /leaderboard net worth. */
export function locationAssetValue(location, config = ECONOMY) {
  const cfg = locationConfig(location.key, config);
  if (!cfg) return 0;
  const invested = Object.values([...(location.upgrades ?? [])]).reduce(
    (sum, key) => sum + (upgradeConfig(key, config)?.price ?? 0), 0);
  const levels = location.level ?? 1;
  return Math.round(cfg.base * levels * levels * 40 + invested);
}

export function netWorth(state, config = ECONOMY) {
  const assets = (state.locations ?? []).reduce((sum, l) => sum + locationAssetValue(l, config), 0);
  return Math.round((state.user?.cash ?? 0) + (state.user?.bank ?? 0) + assets);
}

/* ------------------------------- unlock rules -------------------------------*/

/** Why a location cannot be bought yet: string reason or null when allowed. */
export function unlockBlockReason(key, state, config = ECONOMY) {
  const cfg = locationConfig(key, config);
  if (!cfg) return 'Unknown location.';
  if (cfg.free) return null;
  const req = cfg.unlock;
  if (!req) return null;
  const owned = (state.locations ?? []).find((l) => l.key === req.location);
  if (!owned) return `Unlocks after you own the ${locationConfig(req.location, config)?.label ?? req.location}.`;
  if (req.prestige && (owned.prestige ?? 0) < req.prestige) {
    return `Unlocks after ${req.prestige} prestige on your ${locationConfig(req.location, config)?.label ?? req.location}.`;
  }
  if (req.level && (owned.level ?? 1) < req.level) {
    return `Unlocks at level ${req.level} on your ${locationConfig(req.location, config)?.label ?? req.location}.`;
  }
  return null;
}

/** Menu slots granted at a level: one per level. */
export function menuSlots(level) {
  return Math.max(0, level ?? 0);
}

/** First prestige anywhere unlocks training + advertising. */
export function hasTrainingUnlocked(state) {
  return (state.locations ?? []).some((l) => (l.prestige ?? 0) > 0);
}

export function hasAdvertisingUnlocked(state) {
  return hasTrainingUnlocked(state);
}
