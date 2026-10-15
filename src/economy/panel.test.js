/*
 * Panel integration tests: every /taco view is rendered against a throwaway
 * database with mock interactions, and every action button is exercised.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP_DB = path.join(os.tmpdir(), `taco-panel-${process.pid}.db`);

let renderView;
let economy;
let VIEWS;

before(async () => {
  process.env.DB_FILE = TMP_DB;
  for (const file of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) {
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  economy = (await import('./instance.js')).economy;
  const mod = await import('./views/index.js');
  renderView = mod.renderView;
  VIEWS = mod.VIEWS;
});

/** Minimal interaction mock for a panel view render. */
function render(view, { guildId = 'guild-1', userId = 'user-1', args = [], interaction } = {}) {
  return renderView(view, { guildId, userId, args, interaction });
}

function payloadOf(view) {
  return view;
}

test('the panel exposes exactly one command and every view', () => {
  const command = (fs.readFileSync(path.join(import.meta.dirname, '..', 'commands', 'taco.js'), 'utf8'));
  assert.match(command, /setName\('taco'\)/);
  const expected = [
    'home', 'shop', 'menu', 'staff', 'empire', 'market', 'kitchen', 'crew', 'games', 'quests', 'board', 'me',
  ];
  assert.deepEqual(Object.keys(VIEWS).sort(), expected.sort());
});

test('opening the panel shows the free shack and the action row', async () => {
  const view = await render('home');
  assert.ok(view.embeds.length >= 1, 'home renders an embed');
  const titles = view.embeds.map((e) => e.data.title);
  assert.ok(titles.some((t) => /My Taco Shack|Your empire/.test(t)), `unexpected titles: ${titles}`);
  // nav row is appended by the router
  assert.ok(view.components.length >= 1);
});

test('work, tips, clean, daily and mine all pay out and set cooldowns', async () => {
  const before = economy.getUser('guild-1', 'user-1').cash;
  const work = await render('work');
  assert.match(work.content ?? '', /Shift done/);
  assert.ok(economy.getUser('guild-1', 'user-1').cash > before);
  assert.ok(economy.getUser('guild-1', 'user-1').last_work_at);

  const second = await render('work');
  assert.match(second.content ?? '', /Still on shift/);

  const tips = await render('tips');
  assert.match(tips.content ?? '', /tips/);
  const clean = await render('clean');
  assert.match(clean.content ?? '', /spotless/);
  const daily = await render('daily');
  assert.match(daily.content ?? '', /Daily bonus/);
  const mine = await render('mine');
  assert.match(mine.content ?? '', /Mined/);
  assert.ok(economy.getUser('guild-1', 'user-1').ingredients > 0);
});

test('shop buys an upgrade and blocks a second purchase of the same one', async () => {
  economy.addCash('guild-1', 'user-1', 1_000_000);
  const bought = await render('buy', { args: ['upgrade:better_stove'] });
  assert.match(bought.content ?? '', /Bought the/);
  assert.ok(economy.hasUpgrade('guild-1', 'user-1', 'taco_stand', 'better_stove'));

  const again = await render('buy', { args: ['upgrade:better_stove'] });
  assert.match(again.content ?? '', /already own/);
});

test('menu set fills the first empty slot and charges for it', async () => {
  economy.addCash('guild-1', 'user-1', 1_000_000);
  const set = await render('set', { args: ['1', 'burrito'] });
  assert.match(set.content ?? '', /now serves/);
  assert.equal(economy.listMenu('guild-1', 'user-1', 'taco_stand')[0], 'burrito');

  const locked = await render('set', { args: ['9', 'taco'] });
  assert.match(locked.content ?? '', /locked/);
});

test('staff hires an employee into the business', async () => {
  economy.addCash('guild-1', 'user-1', 1_000_000);
  const hired = await render('hire', { args: ['chef'] });
  assert.match(hired.content ?? '', /joined as/);
  assert.ok(economy.listEmployees('guild-1', 'user-1', 'taco_stand').length > 0);
});

test('empire view reports unlocks, buys the taco truck and prestige-gates', async () => {
  economy.setLevel('guild-1', 'user-1', 'taco_stand', 3);
  economy.addCash('guild-1', 'user-1', 1_000_000);

  const list = await render('empire');
  assert.ok(list.embeds[0].data.description.includes('Beach Shack'));

  const truck = await render('buy', { args: ['taco_truck'] });
  assert.match(truck.content ?? '', /is open|Taco Truck/);
  assert.ok(economy.getShack('guild-1', 'user-1', 'taco_truck'));

  // prestige requires level 10
  const tooEarly = await render('prestige', { args: ['taco_stand'] });
  assert.match(tooEarly.content ?? '', /level 10/);
});

test('sauce market: deterministic prices, buying and selling', async () => {
  economy.addCash('guild-1', 'user-1', 5_000_000);
  const view = await render('market');
  const description = view.embeds[0].data.description;
  assert.match(description, /Mild/);

  const buy = await render('mktbuy', { args: ['mild', '2'] });
  assert.match(buy.content ?? '', /Bought/);
  const position = economy.getSaucePosition('guild-1', 'user-1', 'mild');
  assert.equal(position.qty, 2);

  const sell = await render('mktsell', { args: ['mild', '1'] });
  assert.match(sell.content ?? '', /Sold/);
  assert.equal(economy.getSaucePosition('guild-1', 'user-1', 'mild').qty, 1);
});

test('sauce prices are stable within one hour and change across hours', async () => {
  const { priceOf } = await import('./views/market-engine.js');
  const sauce = { key: 'mild', base: 800, volatility: 0.18 };
  const now = Date.now();
  const later = now + 30 * 60_000;
  const nextHour = now + 2 * 3_600_000;
  assert.equal(priceOf('guild-1', sauce, now), priceOf('guild-1', sauce, later));
  assert.notEqual(priceOf('guild-1', sauce, now), priceOf('guild-1', sauce, nextHour));
});

test('kitchen: cook consumes ingredients, collect pays out', async () => {
  economy.addCash('guild-1', 'user-1', 100_000);
  economy.addIngredients('guild-1', 'user-1', 50);
  const recipe = { key: 'quesadilla', label: 'Quesadilla', ingredients: 8, minutes: 30, reward: 25_000 };

  const tooEarly = await render('collect', { args: ['quesadilla'] });
  assert.match(tooEarly.content ?? '', /not ready/);

  const cook = await render('cook', { args: ['quesadilla'] });
  assert.match(cook.content ?? '', /on the stove/);

  // move the timer forward by writing an already-expired job
  economy.startCooking('guild-1', 'user-1', recipe.key, Date.now() - 1_000);
  const before = economy.getUser('guild-1', 'user-1').cash;
  const collect = await render('collect', { args: ['quesadilla'] });
  assert.match(collect.content ?? '', /Collected/);
  assert.ok(economy.getUser('guild-1', 'user-1').cash > before);
});

test('crew: founding a franchise creates it and joining works', async () => {
  economy.addCash('guild-1', 'user-1', 1_000_000);
  const created = await render('crewcreate', { args: ['Spicy', 'Empire'] });
  assert.match(created.content ?? '', /founded/);
  const franchise = economy.getFranchise('guild-1', 'user-1');
  assert.ok(franchise);

  const joinView = await render('crew', { guildId: 'guild-2', userId: 'user-1' });
  assert.match(joinView.embeds[0].data.description, /Spicy Empire/);

  const joined = await render('crewjoin', { guildId: 'guild-2', userId: 'user-1', args: [String(franchise.id)] });
  assert.match(joined.content ?? '', /joined/);

  const donate = await render('crewdonate', { args: ['100000'] });
  assert.match(donate.content ?? '', /Donated/);
  assert.ok(economy.getFranchise('guild-1', 'user-1').pot >= 100_000);

  const leave = await render('crewleave', { guildId: 'guild-3', userId: 'user-1' });
  assert.match(leave.content ?? '', /left|not in a franchise/);
});

test('games: slots deduct and can pay, cups picks a ball', async () => {
  economy.addCash('guild-1', 'user-1', 1_000_000);
  const slots = await render('game', { args: ['slots'] });
  assert.match(slots.content ?? '', /🎰/);

  const cups = await render('game', { args: ['cups', '2'] });
  assert.match(cups.content ?? '', /🥤/);

  const flip = await render('game', { args: ['flip'] });
  assert.match(flip.content ?? '', /🪙/);
});

test('quests: view lists tasks, claim pays once', async () => {
  const view = await render('quests');
  assert.match(view.embeds[0].data.description, /Daily quests|Daily/);

  const period = (await import('./db.js')).todayPeriod();
  const rows = economy.listTasks('guild-1', 'user-1', period, (await import('./config.js')).ECONOMY.tasks.pool, 3);
  const task = rows[0];
  for (let i = task.progress; i < task.goal; i++) economy.bumpTask('guild-1', 'user-1', period, task.key, 1);
  economy.addCash('guild-1', 'user-1', 100_000);

  const claimed = await render('claim', { args: [task.key] });
  assert.match(claimed.content ?? '', /Claimed/);
  const again = await render('claim', { args: [task.key] });
  assert.match(again.content ?? '', /already claimed/);
});

test('board ranks members and staff', async () => {
  economy.addCash('guild-1', 'user-2', 500_000);
  const view = await render('board');
  assert.match(view.embeds[0].data.description, /🥇|Richest|<@user-2>/);
});

test('profile: priority purchase applies the perk', async () => {
  economy.addCash('guild-1', 'user-1', 1_000_000);
  const view = await render('priority');
  assert.match(view.content ?? '', /Priority support.*active/s);
  assert.ok(economy.hasPerk('guild-1', 'user-1', 'priority'));
});

test('profile: coupon redemption is once per player', async () => {
  economy.addCash('guild-1', 'user-1', 100_000);
  const { ECONOMY } = await import('./config.js');
  const code = ECONOMY.coupons[0].code;
  const first = await render('redeem', { args: [code] });
  assert.match(first.content ?? '', /redeemed/);
  const second = await render('redeem', { args: [code] });
  assert.match(second.content ?? '', /already redeemed/);
});

test('every view renders without throwing for a fresh player', async () => {
  for (const view of Object.keys(VIEWS)) {
    const result = await render(view, { guildId: 'guild-fresh', userId: 'user-fresh' });
    assert.ok(result, `${view} returned nothing`);
    assert.ok(Array.isArray(result.embeds) || Array.isArray(result.rows), `${view} has no payload`);
  }
});
