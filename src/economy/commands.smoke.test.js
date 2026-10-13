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

const TMP_DB = path.join(os.tmpdir(), `econ-smoke-${process.pid}.db`);

/** Mock of the parts of a ChatInputCommandInteraction the commands use. */
function mockInteraction({ options = {}, subcommand = null, guildId = 'guild-1', userId = 'user-1' }) {
  const replies = [];
  return {
    guildId,
    user: { id: userId, username: 'tester' },
    options: {
      getString: (name) => options[name] ?? null,
      getInteger: (name) => options[name] ?? null,
      getSubcommand: () => subcommand,
    },
    reply: async (payload) => {
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
