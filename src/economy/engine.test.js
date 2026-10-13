import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMY } from './config.js';
import {
  locationIncome, hourlyRate, workPayout, tipsPayout, accruedIncome, passiveIncome,
  decayCleanliness, upgradeCost, isMaxLevel, canPrestige, prestigeMultiplier,
  synergyMultiplier, headquartersMultiplier, activeBoostMultiplier,
  unlockBlockReason, menuSlots, locationAssetValue, netWorth, menuBonusPerHour,
  decorationsMultiplier, maxUpgradesOwned, expandCost, locationIngredients,
  isRushHour, rushHourMultiplier, isLunchRush,
} from './engine.js';

const NOW = 1_700_000_000_000;

function shack(overrides = {}) {
  return {
    key: 'taco_stand',
    name: 'Test Shack',
    level: 1,
    prestige: 0,
    cleanliness: 100,
    expanded: 0,
    upgrades: [],
    menu: [],
    employees: [],
    ...overrides,
  };
}

function state(locations, overrides = {}) {
  return {
    user: { cash: 0, bank: 0, daily_streak: 0, ingredients: 0 },
    locations,
    hq: [],
    boosts: [],
    ...overrides,
  };
}

/* --------------------------------- income ---------------------------------- */

test('level-1 taco stand earns base income', () => {
  assert.equal(locationIncome(shack()), ECONOMY.locations.taco_stand.base);
});

test('income scales with level squared', () => {
  assert.equal(locationIncome(shack({ level: 10 })), 120 * 100);
});

test('upgrades multiply income additively', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
  close(locationIncome(shack({ upgrades: ['better_stove'] })), 120 * 1.08);
  close(locationIncome(shack({ upgrades: ['better_stove', 'neon_sign'] })), 120 * (1 + 0.08 + 0.12));
});

test('dirty shack earns the configured penalty', () => {
  const clean = locationIncome(shack());
  const dirty = locationIncome(shack({ cleanliness: ECONOMY.cleanliness.cleanThreshold - 1 }));
  assert.equal(dirty, clean * (1 - ECONOMY.cleanliness.hourlyPenaltyWhenDirty));
});

test('menu adds a flat bonus and empty slots cap nothing silently', () => {
  const withMenu = locationIncome(shack({ menu: ['taco'] }));
  assert.equal(withMenu, 120 + menuBonusPerHour(shack({ menu: ['taco'] })));
  assert.equal(menuBonusPerHour(shack({ menu: [null, 'churros'] })), 1500 * 0.25);
});

test('employees add bonus and wages are subtracted', () => {
  const staffed = locationIncome(shack({ employees: [{ key: 'apprentice_chef', training: 0 }] }));
  const base = 120;
  const expected = base * 1.12 - 120 * 1 * 0.1; // wage = 120 × level(1) × 0.1
  assert.equal(staffed, expected);
});

test('training levels increase the employee bonus', () => {
  const untrained = locationIncome(shack({ employees: [{ key: 'apprentice_chef', training: 0 }] }));
  const trained = locationIncome(shack({ employees: [{ key: 'apprentice_chef', training: 10 }] }));
  assert.ok(trained > untrained);
});

test('prestige stacks multiplicatively per location', () => {
  assert.equal(prestigeMultiplier(shack({ prestige: 0 })), 1);
  assert.equal(prestigeMultiplier(shack({ prestige: 3 })), 1.45);
  assert.equal(locationIncome(shack({ level: 10, prestige: 1 })), 120 * 100 * 1.15);
});

test('synergy rewards owning more lines', () => {
  const stand = state([shack()]);
  const withRestaurant = state([shack(), shack({ key: 'restaurant' })]);
  assert.equal(synergyMultiplier(stand), 1);
  assert.equal(synergyMultiplier(withRestaurant), 1.1);
  // the side truck does not count as a line
  assert.equal(synergyMultiplier(state([shack(), shack({ key: 'taco_truck' })])), 1);
});

test('headquarters multiply across all locations', () => {
  const s = state([shack()], { hq: ['hq_logistics'] });
  assert.equal(headquartersMultiplier(s), 1.1);
  assert.equal(hourlyRate(s), 120 * 1.1);
});

test('boosts multiply only while active', () => {
  const active = state([shack()], { boosts: [{ kind: 'ad', multiplier: 1.75, expiresAt: NOW + 1000 }] });
  const expired = state([shack()], { boosts: [{ kind: 'ad', multiplier: 1.75, expiresAt: NOW - 1000 }] });
  assert.equal(activeBoostMultiplier(active, NOW), 1.75);
  assert.equal(activeBoostMultiplier(expired, NOW), 1);
});

/* ------------------------------- active payouts ---------------------------- */

test('work payout is 45 minutes of income plus a flat bonus', () => {
  const s = state([shack({ level: 10 })]);
  const expected = Math.round((12000 * 0.75 + ECONOMY.payouts.work.flatBonus) * 1);
  assert.equal(workPayout(s, 1, NOW), expected);
});

test('happy hour doubles the work payout', () => {
  const s = state([shack()]);
  assert.equal(workPayout(s, 2, NOW), workPayout(s, 1, NOW) * 2);
});

test('tips shrink when dirty', () => {
  const clean = tipsPayout(shack(), 5);
  const dirty = tipsPayout(shack({ cleanliness: 10 }), 5);
  assert.ok(clean > dirty);
});

test('offline accrual is capped at 24h', () => {
  const s = state([shack()]);
  const oneDay = accruedIncome(s, NOW - 24 * 3600_000, NOW);
  const oneWeek = accruedIncome(s, NOW - 7 * 24 * 3600_000, NOW);
  assert.equal(oneWeek, oneDay);
});

/* ------------------------------- cleanliness ------------------------------- */

test('cleanliness decays over time and janitors slow it', () => {
  const plain = decayCleanliness(100, 5, 0);
  const janitored = decayCleanliness(100, 5, 1);
  assert.equal(plain, 100 - ECONOMY.cleanliness.decayPerHour * 5);
  assert.ok(janitored > plain);
  assert.equal(decayCleanliness(10, 100), 0); // floored at 0
});

/* ------------------------------- progression ------------------------------- */

test('upgrade costs grow exponentially and max out at level 10', () => {
  const l1 = upgradeCost(shack({ level: 1 }));
  const l5 = upgradeCost(shack({ level: 5 }));
  assert.ok(l5 > l1 * 10);
  assert.equal(upgradeCost(shack({ level: 10 })), Infinity);
  assert.ok(isMaxLevel(shack({ level: 10 })));
});

test('prestige requires max level', () => {
  assert.equal(canPrestige(shack({ level: 9 })), false);
  assert.equal(canPrestige(shack({ level: 10 })), true);
  assert.equal(canPrestige(shack({ level: 10, key: 'taco_truck' })), false); // side business
});

test('restaurant unlock is gated by taco prestige', () => {
  assert.match(unlockBlockReason('restaurant', state([shack()])), /prestige/);
  assert.equal(unlockBlockReason('taco_stand', state([])), null);
});

test('menu slots unlock one per level', () => {
  assert.equal(menuSlots(1), 1);
  assert.equal(menuSlots(7), 7);
});

/* --------------------------------- net worth ------------------------------- */

test('net worth sums cash, bank and asset value', () => {
  const s = state([shack({ level: 10 })], { user: { cash: 500, bank: 1000, ingredients: 0 } });
  const expected = 500 + 1000 + locationAssetValue(shack({ level: 10 }));
  assert.equal(netWorth(s), expected);
});

/* ------------------------------ phase 2: expansion ------------------------- */

test('decorations multiply the location income', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
  const plain = locationIncome(shack());
  const decorated = locationIncome(shack({ decorations: ['neon_tacos', 'salsa_fountain'] }));
  close(decorated, plain * (1 + 0.03 + 0.05));
  assert.equal(decorationsMultiplier(shack({ decorations: ['neon_tacos'] })), 1.03);
});

test('upgrade slots grow with expansion but never exceed the catalogue', () => {
  assert.equal(maxUpgradesOwned(shack({ expanded: 0 })), ECONOMY.upgradeSlots.base);
  assert.equal(maxUpgradesOwned(shack({ expanded: 1 })), ECONOMY.upgradeSlots.base + ECONOMY.upgradeSlots.perExpansion);
  assert.equal(maxUpgradesOwned(shack({ expanded: 99 })), ECONOMY.upgrades.length);
});

test('expansion costs grow exponentially and cap out', () => {
  assert.ok(expandCost(shack({ expanded: 1 })) > expandCost(shack({ expanded: 0 })));
  assert.equal(expandCost(shack({ expanded: ECONOMY.expand.maxLevel })), Infinity);
});

test('restaurant needs ingredients, the free stand does not', () => {
  assert.equal(locationIngredients('restaurant'), ECONOMY.locations.restaurant.ingredients);
  assert.equal(locationIngredients('taco_stand'), 0);
});

test('hotel unlocks only after a restaurant prestige', () => {
  const withTacoPrestige = state([shack({ level: 10, prestige: 1 })]);
  assert.equal(unlockBlockReason('hotel', withTacoPrestige), "Unlocks after you own the Restaurant.");
  const withBoth = state([
    shack({ level: 10, prestige: 1 }),
    shack({ key: 'restaurant', level: 10, prestige: 1 }),
  ]);
  assert.equal(unlockBlockReason('hotel', withBoth), null);
});

/* ----------------------------- phase 3: events ------------------------------ */

test('rush hour only doubles inside its UTC window', () => {
  const { startHour, endHour, multiplier } = ECONOMY.events.rushHour;
  const inside = Date.UTC(2026, 0, 13, startHour + 1, 30);
  const before = Date.UTC(2026, 0, 13, startHour - 1, 30);
  const after = Date.UTC(2026, 0, 13, endHour + 1, 30);
  assert.equal(isRushHour(inside), true);
  assert.equal(isRushHour(before), false);
  assert.equal(isRushHour(after), false);
  assert.equal(rushHourMultiplier(inside), multiplier);
  assert.equal(rushHourMultiplier(before), 1);
});

test('passive income doubles during rush hour', () => {
  const s = state([shack({ level: 10 })]);
  const monday = Date.UTC(2026, 0, 12, 10);       // Monday 10:00 — normal
  const fridayEvening = Date.UTC(2026, 0, 16, 19); // Friday 19:00 — rush hour
  const normal = passiveIncome(s, 60, monday);
  const rushed = passiveIncome(s, 60, fridayEvening);
  assert.equal(rushed, normal * ECONOMY.events.rushHour.multiplier);
});

test('lunch rush runs on weekends only', () => {
  assert.equal(isLunchRush(Date.UTC(2026, 0, 17)), true);  // Saturday
  assert.equal(isLunchRush(Date.UTC(2026, 0, 18)), true);  // Sunday
  assert.equal(isLunchRush(Date.UTC(2026, 0, 16)), false); // Friday
});

/* --------------------------- phase 3: achievements -------------------------- */

test('achievement predicates evaluate empire state', () => {
  const byKey = Object.fromEntries(ECONOMY.achievements.map((a) => [a.key, a.test]));
  const stand = state([shack()]);
  const rich = state([shack()], { user: { cash: 2_000_000, bank: 0, ingredients: 0 } });
  assert.equal(byKey.grand_opening(stand), true);
  assert.equal(byKey.restaurateur(stand), false);
  assert.equal(byKey.restaurateur(state([shack(), shack({ key: 'restaurant' })])), true);
  assert.equal(byKey.millionaire(rich), true);
  assert.equal(byKey.prestigious(stand), false);
});
