/*
 * End-to-end smoke test: every economy command is executed against a throwaway
 * database file with a mock interaction, verifying replies and side effects.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ECONOMY } from './config.js';
import { locationIncome, headquartersMultiplier } from './engine.js';
import { todayPeriod } from './db.js';

const TMP_DB = path.join(os.tmpdir(), `econ-smoke-${process.pid}.db`);

/** Mock of the parts of a ChatInputCommandInteraction the commands use. */
function mockInteraction({ options = {}, subcommand = null, guildId = 'guild-1', userId = 'user-1', memberPermissions = { has: () => true }, channel } = {}) {
  const replies = [];
  return {
    guildId,
    channelId: 'channel-1',
    user: { id: userId, username: 'tester' },
    memberPermissions,
    channel: channel ?? { isTextBased: () => true },
    options: {
      getString: (name) => options[name] ?? null,
      getInteger: (name) => options[name] ?? null,
      getUser: (name) => options[name] ?? null,
      getRole: (name) => options[name] ?? null,
      getChannel: (name) => options[name] ?? null,
      getSubcommand: () => subcommand,
    },
    reply: async (payload) => {
      replies.push(payload);
      return payload;
    },
    editReply: async (payload) => {
      replies.push(payload);
      return payload;
    },
    lastReply: () => replies.at(-1),
    replyText: () => replies.map((r) => r.content ?? '').join('\n'),
  };
}

let economy;
let commands;

before(async () => {
  process.env.DB_FILE = TMP_DB;
  for (const file of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) {
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  economy = (await import('./instance.js')).economy;
  const dir = path.join(import.meta.dirname, 'commands');
  commands = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    commands[file.slice(0, -3)] = (await import(pathToFileURL(path.join(dir, file)).href)).default;
  }
});

test('every economy command module exposes data + execute', () => {
  const expected = [
    'buy', 'clean', 'cooldowns', 'daily', 'employees', 'found', 'hire', 'menu', 'mine', 'shack', 'shop', 'tips', 'upgrades', 'work',
    'location', 'prestige', 'advertise', 'expand', 'hq', 'decorations',
    'tasks', 'achievements', 'badge', 'coupons', 'redeem', 'rewards', 'remind', 'rushhour', 'event',
    'gift', 'priority', 'donate', 'goal', 'help', 'stats', 'economy-admin', 'leaderboard', 'leaderboard-post', 'staff-top',
  ];
  assert.deepEqual(Object.keys(commands).sort(), expected.sort());
  for (const [name, command] of Object.entries(commands)) {
    assert.ok(command.data?.name, `${name} missing data`);
    assert.equal(command.data.name, name, `${name} file/name mismatch`);
    assert.equal(typeof command.execute, 'function', `${name} missing execute`);
  }
});

test('/found names the shack and grants the free taco stand', async () => {
  const interaction = mockInteraction({ options: { name: 'El Nacho' } });
  await commands.found.execute(interaction);
  assert.match(interaction.replyText(), /El Nacho/);
  const shack = economy.getShack('guild-1', 'user-1', 'taco_stand');
  assert.equal(shack.name, 'El Nacho');
});

test('/work pays out and sets a cooldown', async () => {
  const first = mockInteraction({});
  await commands.work.execute(first);
  assert.match(first.replyText(), /worked a shift at/);
  assert.ok(economy.getUser('guild-1', 'user-1').cash > 0);

  const second = mockInteraction({});
  await commands.work.execute(second);
  assert.match(second.replyText(), /still on shift/);
});

test('/tips pays out', async () => {
  const interaction = mockInteraction({});
  await commands.tips.execute(interaction);
  assert.match(interaction.replyText(), /collected/);
});

test('/clean restores cleanliness', async () => {
  economy.setCleanliness('guild-1', 'user-1', 'taco_stand', 12);
  const interaction = mockInteraction({});
  await commands.clean.execute(interaction);
  assert.match(interaction.replyText(), /spotless/);
  assert.equal(economy.getShack('guild-1', 'user-1', 'taco_stand').cleanliness, 100);
});

test('/daily pays a streak reward', async () => {
  const interaction = mockInteraction({});
  await commands.daily.execute(interaction);
  assert.match(interaction.replyText(), /Daily bonus/);
  assert.equal(economy.getUser('guild-1', 'user-1').daily_streak, 1);
});

test('/mine yields ingredients', async () => {
  const interaction = mockInteraction({});
  await commands.mine.execute(interaction);
  assert.match(interaction.replyText(), /mined/);
  assert.ok(economy.getUser('guild-1', 'user-1').ingredients > 0);
});

test('/shack shows stats', async () => {
  const interaction = mockInteraction({});
  await commands.shack.execute(interaction);
  const embed = interaction.lastReply().embeds?.[0];
  assert.ok(embed, 'expected an embed reply');
  const fields = embed.data.fields.map((f) => f.name);
  assert.ok(fields.includes('Income'));
  assert.ok(fields.includes('Net worth'));
  // per-location fields carry the cleanliness status
  const locationField = embed.data.fields.find((f) => /El Nacho/.test(f.name));
  assert.match(locationField.value, /Clean|Dirty/);
});

test('/upgrades lists the upgrade ladder', async () => {
  const interaction = mockInteraction({});
  await commands.upgrades.execute(interaction);
  const embed = interaction.lastReply().embeds?.[0];
  assert.match(embed.data.description, /Better Stove/);
});

test('/shop lists boosts', async () => {
  const interaction = mockInteraction({});
  await commands.shop.execute(interaction);
  const embed = interaction.lastReply().embeds?.[0];
  assert.match(embed.data.description, /Lucky Sombrero/);
});

test('/buy deducts cash and grants the upgrade', async () => {
  const before = economy.getUser('guild-1', 'user-1').cash;
  economy.addCash('guild-1', 'user-1', 100_000);
  const interaction = mockInteraction({ options: { item: 'upgrade:better_stove' } });
  await commands.buy.execute(interaction);
  assert.match(interaction.replyText(), /Bought the/);
  assert.ok(economy.hasUpgrade('guild-1', 'user-1', 'taco_stand', 'better_stove'));
  assert.equal(economy.getUser('guild-1', 'user-1').cash, before + 100_000 - 2500);
});

test('/buy rejects unaffordable items without charging', async () => {
  const before = economy.getUser('guild-1', 'user-1').cash;
  const interaction = mockInteraction({ options: { item: 'boost:golden_ticket' } });
  await commands.buy.execute(interaction);
  assert.match(interaction.replyText(), /Not enough cash/);
  assert.equal(interaction.lastReply().flags, 1 << 6); // MessageFlags.Ephemeral
  assert.equal(economy.getUser('guild-1', 'user-1').cash, before);
});

test('/menu view shows empty slots, /menu set fills and charges', async () => {
  const view = mockInteraction({ subcommand: 'view', options: {} });
  await commands.menu.execute(view);
  assert.match(view.replyText(), /empty/);

  economy.addCash('guild-1', 'user-1', 100_000);
  const set = mockInteraction({ subcommand: 'set', options: { slot: 1, item: 'supreme_taco' } });
  await commands.menu.execute(set);
  assert.match(set.replyText(), /Slot 1 now serves/);
  assert.deepEqual(economy.listMenu('guild-1', 'user-1', 'taco_stand')[0], 'supreme_taco');
});

test('/menu set rejects locked slots', async () => {
  // level 1 shack has exactly one slot
  const interaction = mockInteraction({ subcommand: 'set', options: { slot: 5, item: 'taco' } });
  await commands.menu.execute(interaction);
  assert.match(interaction.replyText(), /locked/);
});

test('/hire adds an employee and refunds duplicate names', async () => {
  economy.addCash('guild-1', 'user-1', 100_000);
  const hired = mockInteraction({ options: { type: 'chef', name: 'Ana' } });
  await commands.hire.execute(hired);
  assert.match(hired.replyText(), /joined .* as Chef/);

  const duplicate = mockInteraction({ options: { type: 'chef', name: 'Ana' } });
  await commands.hire.execute(duplicate);
  assert.match(duplicate.replyText(), /already have an employee named/);
  assert.equal(economy.countEmployees('guild-1', 'user-1', 'taco_stand'), 1);
});

test('/employees list shows staff, /employees train is prestige-gated', async () => {
  const list = mockInteraction({ subcommand: 'list', options: {} });
  await commands.employees.execute(list);
  assert.match(list.replyText(), /Ana/);

  const train = mockInteraction({ subcommand: 'train', options: { name: 'Ana' } });
  await commands.employees.execute(train);
  assert.match(train.replyText(), /first prestige/);
});

test('/cooldowns reports readiness', async () => {
  const interaction = mockInteraction({});
  await commands.cooldowns.execute(interaction);
  assert.match(interaction.replyText(), /ready|⏳/);
});

test('commands are guild-scoped', async () => {
  const other = mockInteraction({ guildId: 'guild-2', userId: 'user-1', options: { name: 'Second Guild' } });
  await commands.found.execute(other);
  assert.equal(economy.getShack('guild-2', 'user-1', 'taco_stand').name, 'Second Guild');
  assert.equal(economy.getUser('guild-2', 'user-1').cash, 0);
  assert.equal(economy.listShacks('guild-2', 'user-1').length, 1);
  // guild-1 still has its own empire untouched
  assert.equal(economy.getShack('guild-1', 'user-1', 'taco_stand').name, 'El Nacho');
});

/* ---------------------------- phase 2: locations ---------------------------- */

function give(amount) {
  economy.addCash('guild-1', 'user-1', amount);
}

function maxOut(key) {
  economy.setLevel('guild-1', 'user-1', key, ECONOMY.locations[key].maxLevel);
}

test('/location list shows owned and locked businesses', async () => {
  const interaction = mockInteraction({});
  await commands.location.execute(interaction);
  const embed = interaction.lastReply().embeds[0];
  assert.match(embed.data.description, /Taco Stand/);
  assert.match(embed.data.description, /restaurant/i);
});

test('/location buy is blocked by prestige and ingredients', async () => {
  // ingredient check comes after the unlock gate
  maxOut('taco_stand');
  economy.setPrestige('guild-1', 'user-1', 'taco_stand', 1, 1);
  give(2_000_000);

  const noIngredients = mockInteraction({ subcommand: 'buy', options: { business: 'restaurant' } });
  await commands.location.execute(noIngredients);
  assert.match(noIngredients.replyText(), /needs .* ingredients/);

  economy.addIngredients('guild-1', 'user-1', 500);
  const brokePrestige = mockInteraction({ subcommand: 'buy', options: { business: 'hotel' } });
  await commands.location.execute(brokePrestige);
  assert.match(brokePrestige.replyText(), /Locked|Unlocks after/i);
});

test('/location buy purchases the restaurant and grants synergy', async () => {
  const cashBefore = economy.getUser('guild-1', 'user-1').cash;
  const ingredientsBefore = economy.getUser('guild-1', 'user-1').ingredients;
  const interaction = mockInteraction({ subcommand: 'buy', options: { business: 'restaurant', name: 'Taco Palace' } });
  await commands.location.execute(interaction);
  assert.match(interaction.replyText(), /is open/);
  assert.ok(economy.getShack('guild-1', 'user-1', 'restaurant'));
  assert.equal(economy.getUser('guild-1', 'user-1').cash, cashBefore - ECONOMY.locations.restaurant.buyPrice);
  assert.equal(
    economy.getUser('guild-1', 'user-1').ingredients,
    ingredientsBefore - ECONOMY.locations.restaurant.ingredients
  );
});

test('/shack shows every owned business', async () => {
  const interaction = mockInteraction({});
  await commands.shack.execute(interaction);
  const embed = interaction.lastReply().embeds[0];
  const fieldNames = embed.data.fields.map((f) => f.name);
  assert.ok(fieldNames.some((n) => /Taco Palace/.test(n)), 'restaurant field missing');
  assert.ok(fieldNames.some((n) => /El Nacho/.test(n)), 'stand field missing');
});

test('/location buy refuses duplicates', async () => {
  const interaction = mockInteraction({ subcommand: 'buy', options: { business: 'restaurant' } });
  await commands.location.execute(interaction);
  assert.match(interaction.replyText(), /already own/);
});

/* ----------------------------- phase 2: prestige ---------------------------- */

test('/prestige resets to level 1, adds a star and unlocks perks', async () => {
  economy.setPrestige('guild-1', 'user-1', 'taco_stand', 0, 10); // clean slate
  maxOut('taco_stand');
  const interaction = mockInteraction({ options: { location: 'taco_stand' } });
  await commands.prestige.execute(interaction);
  const shack = economy.getShack('guild-1', 'user-1', 'taco_stand');
  assert.equal(shack.level, 1);
  assert.equal(shack.prestige, 1);
  assert.match(interaction.replyText(), /Unlocked/);
});

test('/prestige is rejected below max level', async () => {
  const interaction = mockInteraction({ options: { location: 'restaurant' } });
  await commands.prestige.execute(interaction);
  assert.match(interaction.replyText(), /only prestige at level/);
});

test('prestige multiplies that location income', async () => {
  const plain = { key: 'taco_stand', level: 1, prestige: 0, cleanliness: 100, upgrades: [], menu: [], employees: [], decorations: [] };
  const starred = { ...plain, prestige: 1 };
  assert.equal(locationIncome(starred), ECONOMY.locations.taco_stand.base * 1.15);
  assert.ok(locationIncome(starred) > locationIncome(plain));
});

/* --------------------------- phase 2: advertising --------------------------- */

test('/advertise is prestige-gated then applies a boost', async () => {
  // restaurant has no prestige yet -> still locked for this check? unlock is global (any prestige)
  const gated = mockInteraction({ guildId: 'guild-3', userId: 'user-9' });
  await commands.found.execute(gated);
  await commands.advertise.execute(gated);
  assert.match(gated.replyText(), /first prestige/);

  give(2_000_000);
  const ad = mockInteraction({ options: {} });
  await commands.advertise.execute(ad);
  assert.match(ad.replyText(), /Biktok campaign.*launched/s);
  const boosts = economy.listBoosts('guild-1', 'user-1');
  assert.ok(boosts.some((b) => b.kind === 'advertise' && b.multiplier === ECONOMY.advertising.multiplier));
});

test('/advertise respects its cooldown', async () => {
  const again = mockInteraction({ options: {} });
  await commands.advertise.execute(again);
  assert.match(again.replyText(), /next one in/);
});

/* ---------------------------- phase 2: expansion ---------------------------- */

test('/expand adds upgrade slots and charges', async () => {
  give(2_000_000);
  const before = economy.getUser('guild-1', 'user-1').cash;
  const interaction = mockInteraction({ options: { location: 'taco_stand' } });
  await commands.expand.execute(interaction);
  assert.match(interaction.replyText(), /expanded to level 1/);
  assert.equal(economy.getShack('guild-1', 'user-1', 'taco_stand').expanded, 1);
  assert.equal(economy.getUser('guild-1', 'user-1').cash, before - ECONOMY.expand.baseCost);
});

test('upgrade slots now gate /buy purchases', async () => {
  give(10_000_000);
  // stand is expanded once: base 2 + 2 = 4 slots
  for (const key of ['better_stove', 'neon_sign', 'comfy_seats', 'salsa_bar']) {
    const interaction = mockInteraction({ options: { item: `upgrade:${key}`, location: 'taco_stand' } });
    economy.setLevel('guild-1', 'user-1', 'taco_stand', 10); // satisfy min levels
    await commands.buy.execute(interaction);
  }
  const full = mockInteraction({ options: { item: 'upgrade:drive_thru', location: 'taco_stand' } });
  await commands.buy.execute(full);
  assert.match(full.replyText(), /No free upgrade slots/);
});

/* --------------------------- phase 2: HQ & decorations ---------------------- */

test('/hq lists headquarters and /buy hq applies globally', async () => {
  const list = mockInteraction({});
  await commands.hq.execute(list);
  assert.match(list.lastReply().embeds[0].data.description, /Logistics HQ/);

  give(20_000_000);
  const buy = mockInteraction({ options: { item: 'hq:hq_branding' } });
  await commands.buy.execute(buy);
  assert.match(buy.replyText(), /Branding HQ\*\* acquired/);
  assert.ok(economy.hasHq('guild-1', 'user-1', 'hq_branding'));
  assert.equal(headquartersMultiplier(economy.buildState('guild-1', 'user-1')), 1.15);
});

test('/decorations browse and /buy decor applies to the location', async () => {
  give(20_000_000);
  const browse = mockInteraction({ options: { location: 'taco_stand' } });
  await commands.decorations.execute(browse);
  assert.match(browse.lastReply().embeds[0].data.description, /Neon Taco Sign/);

  const buy = mockInteraction({ options: { item: 'decor:neon_tacos', location: 'taco_stand' } });
  await commands.buy.execute(buy);
  assert.match(buy.replyText(), /got the \*\*Neon Taco Sign\*\*/);
  assert.ok(economy.hasDecoration('guild-1', 'user-1', 'taco_stand', 'neon_tacos'));

  const again = mockInteraction({ options: { item: 'decor:neon_tacos', location: 'taco_stand' } });
  await commands.buy.execute(again);
  assert.match(again.replyText(), /already has/);
});

test('employee training unlocks after prestige', async () => {
  economy.setPrestige('guild-1', 'user-1', 'taco_stand', 1, 1); // already 1 from earlier test
  give(20_000_000);
  const interaction = mockInteraction({ subcommand: 'train', options: { name: 'Ana', location: 'taco_stand' } });
  await commands.employees.execute(interaction);
  assert.match(interaction.replyText(), /trained to level 1/);
  const staff = economy.listEmployees('guild-1', 'user-1', 'taco_stand');
  assert.equal(staff.find((e) => e.name === 'Ana').training, 1);
});

/* ---------------------------- phase 3: tasks -------------------------------- */

test('/tasks view assigns the daily set and /work bumps progress', async () => {
  const view = mockInteraction({ subcommand: 'view', options: {} });
  await commands.tasks.execute(view);
  assert.match(view.replyText(), /Today's tasks/);
  assert.ok(view.replyText().includes('/tasks claim') || view.replyText().includes('claimed') || /\d\/\d/.test(view.replyText()));

  const period = todayPeriod();
  const before = economy.listTasks('guild-1', 'user-1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
  economy.setCooldown('guild-1', 'user-1', 'last_work_at', null); // clear the earlier shift's cooldown
  const shift = mockInteraction({ options: {} });
  await commands.work.execute(shift);
  const after = economy.listTasks('guild-1', 'user-1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots);
  const workTask = after.find((t) => t.track === 'work');
  if (workTask) {
    const beforeProgress = before.find((t) => t.key === workTask.key)?.progress ?? 0;
    assert.equal(workTask.progress, beforeProgress + 1);
  }
});

test('/tasks claim pays once and rejects incomplete tasks', async () => {
  const period = todayPeriod();
  const pool = ECONOMY.tasks.pool;
  const tasks = economy.listTasks('guild-1', 'user-1', period, pool, ECONOMY.tasks.dailySlots);
  const target = tasks[0];
  const incomplete = mockInteraction({ subcommand: 'claim', options: { task: target.key } });
  await commands.tasks.execute(incomplete);
  if (target.progress < target.goal) {
    assert.match(incomplete.replyText(), /Keep going/);
  }

  // force the goal, then claim
  for (let i = target.progress; i < target.goal; i++) economy.bumpTask('guild-1', 'user-1', period, target.key, 1);
  give(1_000_000);
  const cashBefore = economy.getUser('guild-1', 'user-1').cash;
  const claim = mockInteraction({ subcommand: 'claim', options: { task: target.key } });
  await commands.tasks.execute(claim);
  assert.match(claim.replyText(), /Claimed/);
  assert.equal(economy.getUser('guild-1', 'user-1').cash, cashBefore + target.reward);

  const again = mockInteraction({ subcommand: 'claim', options: { task: target.key } });
  await commands.tasks.execute(again);
  assert.match(again.replyText(), /already claimed/);
});

test('daily task sets are stable within a day', async () => {
  const period = todayPeriod();
  const a = economy.listTasks('guild-1', 'user-1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots).map((t) => t.key);
  const b = economy.listTasks('guild-1', 'user-1', period, ECONOMY.tasks.pool, ECONOMY.tasks.dailySlots).map((t) => t.key);
  assert.deepEqual(a, b);
});

/* ------------------------- phase 3: achievements/badges --------------------- */

test('the free stand unlocks the first achievement lazily', async () => {
  const fresh = mockInteraction({ guildId: 'guild-9', userId: 'user-9', options: { name: 'Badge Test' } });
  await commands.found.execute(fresh);
  const list = mockInteraction({ guildId: 'guild-9', userId: 'user-9' });
  await commands.achievements.execute(list);
  assert.match(list.replyText(), /Grand Opening/);
  const badge = mockInteraction({ guildId: 'guild-9', userId: 'user-9', subcommand: 'view', options: {} });
  await commands.badge.execute(badge);
  assert.match(badge.replyText(), /Grand Opening/);
});

/* ---------------------------- phase 3: coupons ------------------------------ */

test('/coupons lists codes and /redeem pays once', async () => {
  const list = mockInteraction({});
  await commands.coupons.execute(list);
  assert.match(list.lastReply().embeds[0].data.description, /WISPBYTE/);

  const code = ECONOMY.coupons[0].code;
  const cashBefore = economy.getUser('guild-1', 'user-1').cash;
  const redeem = mockInteraction({ options: { code: code.toLowerCase() } });
  await commands.redeem.execute(redeem);
  assert.match(redeem.replyText(), /redeemed/);
  assert.equal(economy.getUser('guild-1', 'user-1').cash, cashBefore + ECONOMY.coupons[0].reward);

  const again = mockInteraction({ options: { code } });
  await commands.redeem.execute(again);
  assert.match(again.replyText(), /already redeemed/);

  const bogus = mockInteraction({ options: { code: 'NOTAREALCODE' } });
  await commands.redeem.execute(bogus);
  assert.match(bogus.replyText(), /does not exist/);
});

/* ---------------------------- phase 3: reminders ---------------------------- */

test('/remind queues a reminder and honours the cap', async () => {
  const a = mockInteraction({ options: { action: 'work' } });
  await commands.remind.execute(a);
  assert.match(a.replyText(), /I'll ping you when/);
  assert.equal(economy.countReminders('guild-1', 'user-1'), 1);

  for (let i = 0; i < 6; i++) {
    const more = mockInteraction({ options: { action: 'tips' } });
    await commands.remind.execute(more);
  }
  assert.ok(economy.countReminders('guild-1', 'user-1') <= 5);
  const capped = mockInteraction({ options: { action: 'tips' } });
  await commands.remind.execute(capped);
  assert.match(capped.replyText(), /already have 5 reminders/);
});

/* --------------------------- phase 3: rush/events --------------------------- */

test('/rushhour and /event info report the windows', async () => {
  const rush = mockInteraction({ options: {} });
  await commands.rushhour.execute(rush);
  assert.match(rush.replyText(), /Rush Hour/);
  assert.match(rush.replyText(), /UTC/);

  const event = mockInteraction({ subcommand: 'info', options: {} });
  await commands.event.execute(event);
  assert.match(event.replyText(), /Happy Hour/);
  assert.match(event.replyText(), /Lunch Rush/);
});

test('/rewards summarises streak, tasks and coupons', async () => {
  const interaction = mockInteraction({ options: {} });
  await commands.rewards.execute(interaction);
  assert.match(interaction.replyText(), /Daily streak/);
  assert.match(interaction.replyText(), /Coupons redeemed/);
});

/* ------------------------- phase 4: bridge commands ------------------------- */

test('/gift transfers cash with a fee and blocks self-gifts', async () => {
  give(1_000_000);
  const before = economy.getUser('guild-1', 'user-1').cash;
  const self = mockInteraction({ options: { member: { id: 'user-1', bot: false }, amount: 5_000 } });
  await commands.gift.execute(self);
  assert.match(self.replyText(), /cannot gift yourself/);

  // the mock exposes a fake member object rather than a User
  const target = { id: 'user-2', bot: false };
  const gift = mockInteraction({ options: { member: target, amount: 5_000 } });
  await commands.gift.execute(gift);
  assert.match(gift.replyText(), /You sent/);
  const fee = Math.ceil(5_000 * ECONOMY.gifting.feePercent);
  assert.equal(economy.getUser('guild-1', 'user-1').cash, before - 5_000 - fee);
  assert.equal(economy.getUser('guild-1', 'user-2').cash, 5_000);
});

test('/priority buy grants the perk once, /priority view reports it', async () => {
  give(1_000_000);
  const buy = mockInteraction({ subcommand: 'buy', options: {} });
  await commands.priority.execute(buy);
  assert.match(buy.replyText(), /Priority support.*active/s);
  assert.ok(economy.hasPerk('guild-1', 'user-1', 'priority'));

  const again = mockInteraction({ subcommand: 'buy', options: {} });
  await commands.priority.execute(again);
  assert.match(again.replyText(), /already active/);

  const view = mockInteraction({ subcommand: 'view', options: {} });
  await commands.priority.execute(view);
  assert.match(view.replyText(), /active until/);
});

test('/donate fills the pot and /goal shows the progress bar', async () => {
  give(1_000_000);
  const donate = mockInteraction({ options: { amount: 100_000 } });
  await commands.donate.execute(donate);
  assert.match(donate.replyText(), /Pot:/);
  assert.equal(economy.getPot('guild-1'), 100_000);

  const goal = mockInteraction({ options: {} });
  await commands.goal.execute(goal);
  const embed = goal.lastReply().embeds[0];
  assert.match(embed.data.description, /█/);
  assert.match(embed.data.description, /100k/);
});

test('reaching the pot goal pays every player and resets', async () => {
  const goalValue = ECONOMY.communityPot.goal;
  const target = mockInteraction({ guildId: 'guild-8', userId: 'user-8', options: { name: 'Pot Tester' } });
  await commands.found.execute(target);
  economy.ensureUser('guild-8', 'user-2');
  economy.addCash('guild-8', 'user-8', goalValue);

  const donate = mockInteraction({ guildId: 'guild-8', userId: 'user-8', options: { amount: goalValue } });
  await commands.donate.execute(donate);
  assert.match(donate.replyText(), /Community goal reached/);
  assert.equal(economy.getPot('guild-8'), 0);
  const players = economy.listPlayers('guild-8');
  for (const player of players) {
    assert.ok(economy.listBoosts('guild-8', player).some((b) => b.kind === 'community'));
  }
});

test('/help lists every command group', async () => {
  const interaction = mockInteraction({ options: {} });
  await commands.help.execute(interaction);
  const text = interaction.replyText();
  assert.match(text, /Ticketing/);
  assert.match(text, /Earning/);
  assert.match(text, /Empire/);
  assert.match(text, /\/work/);
});

test('/stats shows balances and the live event multiplier', async () => {
  give(1_000);
  const interaction = mockInteraction({ options: {} });
  await commands.stats.execute(interaction);
  const embed = interaction.lastReply().embeds[0];
  const names = embed.data.fields.map((f) => f.name);
  assert.ok(names.includes('Balance'));
  assert.ok(names.includes('Events now'));
  assert.match(embed.data.fields.find((f) => f.name === 'Events now').value, /Live multiplier/);
});

test('/economy-admin give, set and reset (admin-gated)', async () => {
  const admin = { memberPermissions: { has: () => true } };
  give(0);
  const enemy = { id: 'user-7', bot: false };

  const set = mockInteraction({ options: { member: enemy, amount: 42_000 }, subcommand: 'set', memberPermissions: admin.memberPermissions });
  await commands['economy-admin'].execute(set);
  assert.match(set.replyText(), /Set/);
  assert.equal(economy.getUser('guild-1', 'user-7').cash, 42_000);

  const add = mockInteraction({ options: { member: enemy, amount: 8_000 }, subcommand: 'give', memberPermissions: admin.memberPermissions });
  await commands['economy-admin'].execute(add);
  assert.equal(economy.getUser('guild-1', 'user-7').cash, 50_000);

  economy.buyLocation('guild-1', 'user-7', 'restaurant');
  const reset = mockInteraction({ options: { member: enemy }, subcommand: 'reset', memberPermissions: admin.memberPermissions });
  await commands['economy-admin'].execute(reset);
  assert.deepEqual(economy.listShacks('guild-1', 'user-7').map((s) => s.location_key), ['taco_stand']);
  assert.equal(economy.getUser('guild-1', 'user-7').cash, 0);

  // non-admins are refused
  const denied = mockInteraction({ options: { member: enemy, amount: 1 }, subcommand: 'give', memberPermissions: { has: () => false } });
  await commands['economy-admin'].execute(denied);
  assert.match(denied.replyText(), /Administrator only/);
});

test('/leaderboard ranks members by net worth', async () => {
  give(500_000);
  const interaction = mockInteraction({ options: {} });
  await commands.leaderboard.execute(interaction);
  const embed = interaction.lastReply().embeds[0];
  assert.match(embed.data.description, /<@user-1>/);
});

test('/leaderboard-post stores a live target (admin-gated)', async () => {
  const admin = { memberPermissions: { has: () => true } };
  const interaction = mockInteraction({ options: {}, memberPermissions: admin.memberPermissions, channelId: 'chan-9' });
  // the command sends a bootstrap message; stub the channel surface
  interaction.channel = { id: 'chan-9', isTextBased: () => true, send: async (payload) => ({ id: 'msg-99', ...payload }) };
  await commands['leaderboard-post'].execute(interaction);
  const target = economy.getLeaderboardTarget('guild-1');
  assert.equal(target.channel_id, 'chan-9');
  assert.equal(target.message_id, 'msg-99');
  economy.clearLeaderboardTarget('guild-1');
});

test('/staff-top ranks reasoned closures (empty until a close with reason)', async () => {
  const interaction = mockInteraction({ options: {} });
  await commands['staff-top'].execute(interaction);
  // this suite never closes a ticket, so the ranking is empty
  assert.match(interaction.replyText(), /No closures with a reason yet this month/);
});

