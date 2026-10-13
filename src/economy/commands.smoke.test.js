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
  const expected = ['buy', 'clean', 'cooldowns', 'daily', 'employees', 'found', 'hire', 'menu', 'mine', 'shack', 'shop', 'tips', 'upgrades', 'work'];
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
  assert.ok(fields.includes('Cleanliness'));
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
  assert.match(hired.replyText(), /joined as Chef/);

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
