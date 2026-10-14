import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createEconomyDb, todayPeriod } from './db.js';
import { ECONOMY } from './config.js';
import { decayCleanliness } from './engine.js';
import { cooldownRemaining } from './util.js';

function freshDb() {
  return createEconomyDb(new DatabaseSync(':memory:'));
}

test('ensureUser grants a free level-1 taco stand exactly once', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  const shacks = db.listShacks('g1', 'u1');
  assert.equal(shacks.length, 1);
  assert.equal(shacks[0].location_key, 'taco_stand');
  assert.equal(shacks[0].level, 1);
  db.ensureUser('g1', 'u1');
  assert.equal(db.listShacks('g1', 'u1').length, 1);
});

test('balances are guild-scoped', () => {
  const db = freshDb();
  db.addCash('g1', 'u1', 1000);
  db.addCash('g2', 'u1', 50);
  assert.equal(db.getUser('g1', 'u1').cash, 1000);
  assert.equal(db.getUser('g2', 'u1').cash, 50);
});

test('cash can go negative to model spending', () => {
  const db = freshDb();
  db.addCash('g1', 'u1', 500);
  db.addCash('g1', 'u1', -800);
  assert.equal(db.getUser('g1', 'u1').cash, -300);
});

test('buy -> upgrade -> prestige round-trip', () => {
  const db = freshDb();
  db.buyLocation('g1', 'u1', 'restaurant', 'Taco Palace');
  const bought = db.getShack('g1', 'u1', 'restaurant');
  assert.equal(bought.name, 'Taco Palace');

  db.setLevel('g1', 'u1', 'restaurant', 10);
  assert.equal(db.getShack('g1', 'u1', 'restaurant').level, 10);

  db.setPrestige('g1', 'u1', 'restaurant', 1, 1);
  const prestige = db.getShack('g1', 'u1', 'restaurant');
  assert.equal(prestige.prestige, 1);
  assert.equal(prestige.level, 1);
});

test('duplicate location purchases are ignored', () => {
  const db = freshDb();
  db.buyLocation('g1', 'u1', 'restaurant');
  db.buyLocation('g1', 'u1', 'restaurant');
  assert.equal(db.listShacks('g1', 'u1').filter((s) => s.location_key === 'restaurant').length, 1);
});

test('cooldown columns are whitelisted', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.setCooldown('g1', 'u1', 'last_work_at', '2026-10-13T00:00:00Z');
  assert.equal(db.getUser('g1', 'u1').last_work_at, '2026-10-13T00:00:00Z');
  assert.throws(() => db.setCooldown('g1', 'u1', 'cash', '5'), /Unknown cooldown column/);
});

test('ingredients accumulate', () => {
  const db = freshDb();
  db.addIngredients('g1', 'u1', 4);
  db.addIngredients('g1', 'u1', 3);
  assert.equal(db.getUser('g1', 'u1').ingredients, 7);
});

test('buildState returns the engine shape', () => {
  const db = freshDb();
  const state = db.buildState('g1', 'u1');
  assert.equal(state.locations.length, 1);
  assert.equal(state.locations[0].key, 'taco_stand');
  assert.deepEqual(state.locations[0].menu, []);
  assert.deepEqual(state.locations[0].employees, []);
  assert.equal(state.user.cash, 0);
});

test('every configured location is a known location key', () => {
  for (const key of Object.keys(ECONOMY.locations)) {
    assert.ok(ECONOMY.locations[key].label, `${key} needs a label`);
  }
});

/* ------------------------------- phase 1: upgrades -------------------------- */

test('upgrades are unique per location and buyable once', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  assert.equal(db.buyUpgrade('g1', 'u1', 'taco_stand', 'better_stove'), true);
  assert.equal(db.buyUpgrade('g1', 'u1', 'taco_stand', 'better_stove'), false);
  assert.deepEqual(db.listUpgrades('g1', 'u1', 'taco_stand'), ['better_stove']);
  assert.equal(db.hasUpgrade('g1', 'u1', 'taco_stand', 'neon_sign'), false);
});

/* --------------------------------- phase 1: menu ---------------------------- */

test('menu slots store by index and overwrite on re-set', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.setMenuItem('g1', 'u1', 'taco_stand', 0, 'taco');
  db.setMenuItem('g1', 'u1', 'taco_stand', 1, 'burrito');
  assert.deepEqual(db.listMenu('g1', 'u1', 'taco_stand'), ['taco', 'burrito']);
  db.setMenuItem('g1', 'u1', 'taco_stand', 0, 'churros');
  assert.deepEqual(db.listMenu('g1', 'u1', 'taco_stand'), ['churros', 'burrito']);
});

test('menu rows are sparse-indexed when slot 0 is empty', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.setMenuItem('g1', 'u1', 'taco_stand', 2, 'nachos');
  const menu = db.listMenu('g1', 'u1', 'taco_stand');
  assert.deepEqual(menu, [null, null, 'nachos']);
});

/* ------------------------------- phase 1: employees ------------------------- */

test('hiring respects the per-location cap and rejects duplicate names', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  for (let i = 0; i < ECONOMY.maxEmployeesPerLocation; i++) {
    assert.ok(db.hireEmployee('g1', 'u1', 'taco_stand', 'chef', `chef-${i}`), `hire ${i} should succeed`);
  }
  assert.equal(db.countEmployees('g1', 'u1', 'taco_stand'), ECONOMY.maxEmployeesPerLocation);
  assert.equal(db.hireEmployee('g1', 'u1', 'taco_stand', 'chef', 'chef-0'), null); // duplicate name
});

test('training increments an employee level', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.hireEmployee('g1', 'u1', 'taco_stand', 'chef', 'Ana');
  assert.equal(db.trainEmployee('g1', 'u1', 'taco_stand', 'Ana').training, 1);
  assert.equal(db.trainEmployee('g1', 'u1', 'taco_stand', 'nobody'), null);
});

/* -------------------------------- phase 1: boosts --------------------------- */

test('boosts list only unexpired entries', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  const now = Date.now();
  db.addBoost('g1', 'u1', 'boost:golden_ticket', 1.5, now + 3_600_000, now);
  db.addBoost('g1', 'u1', 'boost:expired', 2, now - 1000, now);
  const active = db.listBoosts('g1', 'u1', now);
  assert.equal(active.length, 1);
  assert.equal(active[0].kind, 'boost:golden_ticket');
});

/* ------------------------------ phase 2: decorations ----------------------- */

test('decorations are unique per location', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  assert.equal(db.buyDecoration('g1', 'u1', 'taco_stand', 'neon_tacos'), true);
  assert.equal(db.buyDecoration('g1', 'u1', 'taco_stand', 'neon_tacos'), false);
  assert.deepEqual(db.listDecorations('g1', 'u1', 'taco_stand'), ['neon_tacos']);
  assert.equal(db.hasDecoration('g1', 'u1', 'taco_stand', 'pinata'), false);
});

/* ----------------------------- phase 2: headquarters ----------------------- */

test('HQ upgrades are global to the user', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.buyLocation('g1', 'u1', 'restaurant');
  assert.equal(db.buyHq('g1', 'u1', 'hq_branding'), true);
  assert.equal(db.buyHq('g1', 'u1', 'hq_branding'), false);
  assert.deepEqual(db.listHq('g1', 'u1'), ['hq_branding']);
  assert.equal(db.hasHq('g1', 'u1', 'hq_branding'), true);
  // the HQ applies across every location in the state
  const state = db.buildState('g1', 'u1');
  assert.deepEqual(state.hq, ['hq_branding']);
  assert.equal(state.locations.length, 2);
});

test('advertising cooldown column exists', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.setCooldown('g1', 'u1', 'last_ad_at', new Date(Date.now() - 30_000).toISOString());
  assert.equal(db.getUser('g1', 'u1').last_ad_at, new Date(Date.now() - 30_000).toISOString());
  // and the cooldown helper understands it (30s ago on a 60s cooldown => 30s left)
  assert.ok(cooldownRemaining(db.getUser('g1', 'u1'), 'last_ad_at', 60) > 0);
});

test('buildState hydrates decorations and hq', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.buyDecoration('g1', 'u1', 'taco_stand', 'salsa_fountain');
  db.buyHq('g1', 'u1', 'hq_logistics');
  const state = db.buildState('g1', 'u1');
  assert.deepEqual(state.locations[0].decorations, ['salsa_fountain']);
  assert.deepEqual(state.hq, ['hq_logistics']);
});

/* ---------------------------- phase 1: cleanliness -------------------------- */

test('cleanliness decays lazily on read and persists', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  const threeHoursAgo = Date.now() - 3 * 3_600_000;
  db.setCleanliness('g1', 'u1', 'taco_stand', 100);
  // rewind the decay clock so the next read sees 3 elapsed hours
  db.touchCleanliness('g1', 'u1', 'taco_stand', threeHoursAgo);

  const expected = decayCleanliness(100, 3, 0);
  const state = db.buildState('g1', 'u1', Date.now());
  assert.equal(state.locations[0].cleanliness, expected);
  // the decayed value is persisted, not recomputed from the original each time
  const again = db.buildState('g1', 'u1', Date.now());
  assert.equal(again.locations[0].cleanliness, expected);
});

test('janitors slow the decay', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.hireEmployee('g1', 'u1', 'taco_stand', 'janitor', 'Moppsy');
  const hours = 5;
  const withoutJanitor = decayCleanliness(100, hours, 0);
  const withJanitor = decayCleanliness(100, hours, 1);
  assert.ok(withJanitor > withoutJanitor);

  const state = db.buildState('g1', 'u1', Date.now());
  assert.equal(state.locations[0].employees.length, 1);
  assert.equal(state.locations[0].employees[0].key, 'janitor');
});

test('multiple locations coexist per user', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.buyLocation('g1', 'u1', 'restaurant', 'Taco Palace');
  db.buyLocation('g1', 'u1', 'hotel', 'Taco Grand');
  const state = db.buildState('g1', 'u1');
  assert.deepEqual(state.locations.map((l) => l.key), ['taco_stand', 'restaurant', 'hotel']);
  // each location keeps its own ladder
  db.setLevel('g1', 'u1', 'restaurant', 7);
  assert.equal(db.buildState('g1', 'u1').locations.find((l) => l.key === 'restaurant').level, 7);
  assert.equal(db.buildState('g1', 'u1').locations.find((l) => l.key === 'taco_stand').level, 1);
});

/* ------------------------------ phase 3: tasks ------------------------------ */

test('daily tasks are assigned deterministically and stable for the day', () => {
  const db = freshDb();
  const period = todayPeriod();
  const first = db.listTasks('g1', 'u1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
  const second = db.listTasks('g1', 'u1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
  assert.equal(first.length, ECONOMY.tasks.dailySlots);
  assert.deepEqual(first.map((t) => t.key), second.map((t) => t.key));
  assert.ok(first.every((t) => t.progress === 0 && !t.claimed));
});

test('task progress bumps, is claimable once, and blocks over-claiming', () => {
  const db = freshDb();
  const period = todayPeriod();
  const [task] = db.listTasks('g1', 'u1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);

  for (let i = 0; i < task.goal; i++) db.bumpTask('g1', 'u1', period, task.key, 1);
  const done = db.listTasks('g1', 'u1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots).find((t) => t.key === task.key);
  assert.equal(done.progress, task.goal);

  assert.equal(db.claimTask('g1', 'u1', period, task.key), true);
  const claimed = db.listTasks('g1', 'u1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots).find((t) => t.key === task.key);
  assert.equal(claimed.claimed, true);
  // claiming again is a no-op
  assert.equal(db.claimTask('g1', 'u1', period, task.key), false);
});

test('tasks are scoped per day and per guild', () => {
  const db = freshDb();
  const period = todayPeriod();
  const list1 = db.listTasks('g1', 'u1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
  const list2 = db.listTasks('g2', 'u1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
  // the pick is seeded by guild+user+date, so different guilds draw different sets
  assert.equal(list1.length, ECONOMY.tasks.dailySlots);
  assert.equal(list2.length, ECONOMY.tasks.dailySlots);
  db.bumpTask('g1', 'u1', period, list1[0].key, 1);
  assert.equal(db.listTasks('g1', 'u1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots)[0].progress, 1);
  assert.equal(db.listTasks('g2', 'u1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots)[0].progress, 0);
});

/* --------------------------- phase 3: achievements -------------------------- */

test('achievements unlock once and persist in the state', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  assert.deepEqual(db.listAchievements('g1', 'u1'), []);
  // 'grand_opening' is satisfied by the free taco stand
  const state = db.buildState('g1', 'u1');
  assert.deepEqual(state.locations.map((l) => l.key), ['taco_stand']);
  assert.deepEqual(db.listAchievements('g1', 'u1'), ['grand_opening']);
  // unlocking twice does not duplicate
  assert.equal(db.unlockAchievement('g1', 'u1', 'grand_opening'), false);
  assert.deepEqual(db.listAchievements('g1', 'u1'), ['grand_opening']);
});

test('a throwing achievement check never breaks the read', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  const original = ECONOMY.achievements;
  ECONOMY.achievements.push({ key: 'boom', label: 'Boom', badge: '💥', test: () => { throw new Error('nope'); } });
  try {
    const state = db.buildState('g1', 'u1');
    assert.ok(state.locations.length >= 1);
  } finally {
    ECONOMY.achievements.length = original.length;
  }
});

/* ---------------------------- phase 3: reminders ---------------------------- */

test('reminders are queued and returned only when due', () => {
  const db = freshDb();
  const now = Date.now();
  db.addReminder('g1', 'c1', 'u1', 'work', now + 10 * 60_000);
  assert.equal(db.countReminders('g1', 'u1'), 1);
  assert.deepEqual(db.listDueReminders(now), []);
  const due = db.listDueReminders(now + 11 * 60_000);
  assert.equal(due.length, 1);
  assert.equal(due[0].action, 'work');
  db.deleteReminder(due[0].id);
  assert.equal(db.countReminders('g1', 'u1'), 0);
});

/* ----------------------------- phase 3: coupons ----------------------------- */

test('coupons redeem once per player', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  const code = ECONOMY.coupons[0].code;
  assert.equal(db.redeemCoupon('g1', 'u1', code.toLowerCase()), true);
  assert.equal(db.redeemCoupon('g1', 'u1', code), false);
  assert.deepEqual(db.listRedeemedCodes('g1', 'u1'), [code.toUpperCase()]);
});

/* ------------------- phase 4: payouts, perks, pot, board -------------------- */

test('staff payouts respect the monthly cap', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  const base = ECONOMY.staffPayouts.perReasonedClosure;
  const cap = ECONOMY.staffPayouts.monthlyCapPerStaff;

  const first = db.addStaffPayout('g1', 'u1', '2026-10', base, cap);
  assert.deepEqual(first, { paid: base, capped: false });

  // jumping just under the cap clips the payment instead of exceeding it
  const near = db.addStaffPayout('g1', 'u1', '2026-10', cap, cap);
  assert.equal(near.paid, cap - base);
  assert.equal(near.capped, true);

  // past the cap nothing is paid
  const over = db.addStaffPayout('g1', 'u1', '2026-10', base, cap);
  assert.deepEqual(over, { paid: 0, capped: true });

  const rows = db.listStaffPayouts('g1', '2026-10');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, cap);
  assert.equal(rows[0].closures, 2);
});

test('staff payouts are scoped per month and per guild', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.addStaffPayout('g1', 'u1', '2026-09', 1_000, 300_000);
  db.addStaffPayout('g1', 'u1', '2026-10', 1_000, 300_000);
  db.addStaffPayout('g2', 'u1', '2026-10', 1_000, 300_000);
  assert.equal(db.listStaffPayouts('g1', '2026-10')[0].amount, 1_000);
  assert.equal(db.listStaffPayouts('g1', '2026-09').length, 1);
  assert.equal(db.listStaffPayouts('g2', '2026-10')[0].closures, 1);
});

test('perks activate and expire', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  const now = Date.now();
  db.addPerk('g1', 'u1', 'priority', now + 3_600_000, now);
  assert.equal(db.hasPerk('g1', 'u1', 'priority', now + 1_000), true);
  assert.equal(db.hasPerk('g1', 'u1', 'priority', now + 7_200_000), false);
  // re-buying extends the existing expiry
  db.addPerk('g1', 'u1', 'priority', now + 10_000_000, now + 100);
  assert.equal(db.hasPerk('g1', 'u1', 'priority', now + 9_000_000), true);
});

test('community pot accumulates, pays out and resets', () => {
  const db = freshDb();
  assert.equal(db.getPot('g1'), 0);
  assert.equal(db.addToPot('g1', 250_000), 250_000);
  assert.equal(db.addToPot('g1', 100_000), 350_000);
  // draining past zero clamps at 0 (the goal payout subtracts the whole pot)
  assert.equal(db.addToPot('g1', -999_999_999), 0);
  assert.equal(db.getPot('g1'), 0);
});

test('leaderboard target round-trips and clears', () => {
  const db = freshDb();
  assert.equal(db.getLeaderboardTarget('g1'), null);
  db.setLeaderboardTarget('g1', 'chan-1', 'msg-1');
  assert.equal(db.getLeaderboardTarget('g1').channel_id, 'chan-1');
  assert.equal(db.getLeaderboardTarget('g1').message_id, 'msg-1');
  db.setLeaderboardTarget('g1', 'chan-2', 'msg-2');
  assert.equal(db.getLeaderboardTarget('g1').channel_id, 'chan-2');
  assert.equal(db.getLeaderboardTarget('g1').message_id, 'msg-2');
  assert.equal(db.clearLeaderboardTarget('g1'), true);
  assert.equal(db.getLeaderboardTarget('g1'), null);
});

test('resetPlayer returns the empire to a fresh free stand', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.buyLocation('g1', 'u1', 'restaurant');
  db.buyUpgrade('g1', 'u1', 'taco_stand', 'better_stove');
  db.hireEmployee('g1', 'u1', 'taco_stand', 'chef', 'Ana');
  db.buyHq('g1', 'u1', 'hq_branding');
  db.addPerk('g1', 'u1', 'priority', Date.now() + 3_600_000);
  db.addStaffPayout('g1', 'u1', '2026-10', 1_000, 300_000);
  db.addCash('g1', 'u1', 50_000);

  db.resetPlayer('g1', 'u1');
  const state = db.buildState('g1', 'u1');
  assert.deepEqual(state.locations.map((l) => l.key), ['taco_stand']);
  assert.equal(state.locations[0].level, 1);
  assert.deepEqual(state.locations[0].upgrades, []);
  assert.deepEqual(state.hq, []);
  assert.deepEqual(state.boosts, []);
  assert.equal(db.getUser('g1', 'u1').cash, 0);
  assert.deepEqual(db.listStaffPayouts('g1', '2026-10'), []);
});

test('listPlayers covers everyone known to the economy', () => {
  const db = freshDb();
  db.ensureUser('g1', 'u1');
  db.addCash('g1', 'u2', 100); // gifting creates the row
  assert.deepEqual(db.listPlayers('g1').sort(), ['u1', 'u2']);
  assert.deepEqual(db.listPlayers('g9'), []);
});
