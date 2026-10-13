/*
 * Economy persistence. Takes a DatabaseSync handle (dependency-injected: the
 * bot passes the shared db from src/db.js, tests pass ':memory:') so the schema
 * and repository are testable without touching the live database.
 *
 * Tables are added per implementation phase via CREATE TABLE IF NOT EXISTS.
 */
import { ECONOMY } from './config.js';
import { decayCleanliness } from './engine.js';
import { parseDbTime, nowIso } from './util.js';

export function createEconomyDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS economy_users (
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      cash            INTEGER NOT NULL DEFAULT 0,
      bank            INTEGER NOT NULL DEFAULT 0,
      daily_streak    INTEGER NOT NULL DEFAULT 0,
      last_daily_at   TEXT,
      last_work_at    TEXT,
      last_tips_at    TEXT,
      last_clean_at    TEXT,
      last_mine_at     TEXT,
      last_ad_at       TEXT,
      ingredients     INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS economy_shacks (
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      location_key    TEXT NOT NULL,
      name            TEXT NOT NULL DEFAULT 'My Taco Shack',
      level           INTEGER NOT NULL DEFAULT 1,
      prestige        INTEGER NOT NULL DEFAULT 0,
      cleanliness     INTEGER NOT NULL DEFAULT 100,
      expanded        INTEGER NOT NULL DEFAULT 0,
      cleanliness_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      purchased_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id, location_key)
    );

    CREATE TABLE IF NOT EXISTS economy_upgrades (
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      location_key    TEXT NOT NULL,
      upgrade_key     TEXT NOT NULL,
      bought_at       TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id, location_key, upgrade_key)
    );

    CREATE TABLE IF NOT EXISTS economy_menu (
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      location_key    TEXT NOT NULL,
      slot            INTEGER NOT NULL,
      item_key        TEXT NOT NULL,
      set_at          TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id, location_key, slot)
    );

    CREATE TABLE IF NOT EXISTS economy_employees (
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      location_key    TEXT NOT NULL,
      employee_key    TEXT NOT NULL,
      name            TEXT NOT NULL,
      training        INTEGER NOT NULL DEFAULT 0,
      hired_at        TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id, location_key, name)
    );

    CREATE TABLE IF NOT EXISTS economy_boosts (
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      kind            TEXT NOT NULL,
      multiplier      REAL NOT NULL,
      expires_at      TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS economy_decorations (
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      location_key    TEXT NOT NULL,
      decoration_key  TEXT NOT NULL,
      bought_at       TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id, location_key, decoration_key)
    );

    CREATE TABLE IF NOT EXISTS economy_hq (
      guild_id        TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      hq_key          TEXT NOT NULL,
      bought_at       TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id, hq_key)
    );
  `);

  /*
   * Idempotent column additions for databases created by earlier versions.
   * CREATE TABLE IF NOT EXISTS never alters an existing table, so new columns
   * (cooldowns, flags) are applied here — a duplicate-column error is ignored.
   */
  for (const migration of ['ALTER TABLE economy_users ADD COLUMN last_ad_at TEXT']) {
    try {
      db.exec(migration);
    } catch {
      /* column already exists */
    }
  }

  /* --------------------------------- users --------------------------------- */

  const getUserStmt = db.prepare('SELECT * FROM economy_users WHERE guild_id = ? AND user_id = ?');
  const insertUserStmt = db.prepare(`
    INSERT INTO economy_users (guild_id, user_id) VALUES (?, ?)
    ON CONFLICT(guild_id, user_id) DO NOTHING
  `);

  function ensureUser(guildId, userId) {
    insertUserStmt.run(guildId, userId);
    const shacks = db.prepare(
      'SELECT COUNT(*) AS n FROM economy_shacks WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    if (shacks.n === 0) {
      // Every player starts with a free level-1 taco stand.
      const freeKey = Object.keys(ECONOMY.locations).find((k) => ECONOMY.locations[k].free);
      if (freeKey) {
        db.prepare(`INSERT INTO economy_shacks (guild_id, user_id, location_key, name)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(guild_id, user_id, location_key) DO NOTHING`)
          .run(guildId, userId, freeKey, 'My Taco Shack');
      }
    }
    return getUserStmt.get(guildId, userId);
  }

  function getUser(guildId, userId) {
    return getUserStmt.get(guildId, userId) ?? null;
  }

  const addCashStmt = db.prepare('UPDATE economy_users SET cash = cash + ? WHERE guild_id = ? AND user_id = ?');
  const addBankStmt = db.prepare('UPDATE economy_users SET bank = bank + ? WHERE guild_id = ? AND user_id = ?');
  const addIngredientsStmt = db.prepare(
    'UPDATE economy_users SET ingredients = ingredients + ? WHERE guild_id = ? AND user_id = ?');
  const setDailyStreakStmt = db.prepare(
    'UPDATE economy_users SET daily_streak = ? WHERE guild_id = ? AND user_id = ?');

  /** Adds (or removes, negative) cash. Returns the new balance. */
  function addCash(guildId, userId, amount) {
    ensureUser(guildId, userId);
    addCashStmt.run(amount, guildId, userId);
    return getUserStmt.get(guildId, userId).cash;
  }

  function addIngredients(guildId, userId, amount) {
    ensureUser(guildId, userId);
    addIngredientsStmt.run(amount, guildId, userId);
    return getUserStmt.get(guildId, userId).ingredients;
  }

  function setDailyStreak(guildId, userId, streak) {
    ensureUser(guildId, userId);
    setDailyStreakStmt.run(streak, guildId, userId);
  }

  // Column names cannot be bound as parameters, so each whitelisted cooldown
  // column gets its own prepared statement built at schema time.
  const COOLDOWN_COLUMNS = new Set([
    'last_daily_at', 'last_work_at', 'last_tips_at', 'last_clean_at', 'last_mine_at', 'last_ad_at',
  ]);
  const cooldownStmts = new Map(
    [...COOLDOWN_COLUMNS].map((column) => [
      column,
      db.prepare(`UPDATE economy_users SET ${column} = ? WHERE guild_id = ? AND user_id = ?`),
    ])
  );

  function setCooldown(guildId, userId, column, isoNow) {
    const stmt = cooldownStmts.get(column);
    if (!stmt) throw new Error(`Unknown cooldown column: ${column}`);
    stmt.run(isoNow, guildId, userId);
  }

  /* -------------------------------- locations ------------------------------ */

  const getShackStmt = db.prepare(
    'SELECT * FROM economy_shacks WHERE guild_id = ? AND user_id = ? AND location_key = ?');
  const listShacksStmt = db.prepare(
    'SELECT * FROM economy_shacks WHERE guild_id = ? AND user_id = ? ORDER BY rowid');

  function getShack(guildId, userId, locationKey) {
    return getShackStmt.get(guildId, userId, locationKey) ?? null;
  }

  function listShacks(guildId, userId) {
    return listShacksStmt.all(guildId, userId);
  }

  function buyLocation(guildId, userId, locationKey, name = 'My Shack') {
    ensureUser(guildId, userId);
    db.prepare(`INSERT INTO economy_shacks (guild_id, user_id, location_key, name)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(guild_id, user_id, location_key) DO NOTHING`)
      .run(guildId, userId, locationKey, name);
    return getShack(guildId, userId, locationKey);
  }

  const setLevelStmt = db.prepare(
    'UPDATE economy_shacks SET level = ? WHERE guild_id = ? AND user_id = ? AND location_key = ?');
  const setPrestigeStmt = db.prepare(
    'UPDATE economy_shacks SET prestige = ?, level = ? WHERE guild_id = ? AND user_id = ? AND location_key = ?');
  const setNameStmt = db.prepare(
    'UPDATE economy_shacks SET name = ? WHERE guild_id = ? AND user_id = ? AND location_key = ?');
  const setCleanlinessStmt = db.prepare(
    'UPDATE economy_shacks SET cleanliness = ? WHERE guild_id = ? AND user_id = ? AND location_key = ?');
  const setExpandedStmt = db.prepare(
    'UPDATE economy_shacks SET expanded = ? WHERE guild_id = ? AND user_id = ? AND location_key = ?');

  function setLevel(guildId, userId, locationKey, level) {
    setLevelStmt.run(level, guildId, userId, locationKey);
    return getShack(guildId, userId, locationKey);
  }

  function setPrestige(guildId, userId, locationKey, prestige, level) {
    setPrestigeStmt.run(prestige, level, guildId, userId, locationKey);
    return getShack(guildId, userId, locationKey);
  }

  function setName(guildId, userId, locationKey, name) {
    setNameStmt.run(name, guildId, userId, locationKey);
    return getShack(guildId, userId, locationKey);
  }

  function setCleanliness(guildId, userId, locationKey, value) {
    setCleanlinessStmt.run(value, guildId, userId, locationKey);
    return getShack(guildId, userId, locationKey);
  }

  function setExpanded(guildId, userId, locationKey, level) {
    setExpandedStmt.run(level, guildId, userId, locationKey);
    return getShack(guildId, userId, locationKey);
  }

  /* ------------------------------- cleanliness ------------------------------
   * Decay is applied lazily: every read computes the elapsed time since the
   * last write and persists the decayed value, so no background job exists.
   */
  function applyCleanlinessDecay(guildId, userId, locationKey, decayFn, now = Date.now()) {
    const shack = getShack(guildId, userId, locationKey);
    if (!shack) return null;
    const last = parseDbTime(shack.cleanliness_updated_at) ?? now;
    const hours = Math.max(0, (now - last) / 3_600_000);
    if (hours < 0.02) return shack; // less than a minute: skip the write
    const janitors = db.prepare(
      'SELECT COUNT(*) AS n FROM economy_employees WHERE guild_id = ? AND user_id = ? AND location_key = ? AND employee_key = ?'
    ).get(guildId, userId, locationKey, 'janitor').n;
    const decayed = decayFn(shack.cleanliness, hours, janitors);
    setCleanlinessStmt.run(decayed, guildId, userId, locationKey);
    db.prepare('UPDATE economy_shacks SET cleanliness_updated_at = ? WHERE guild_id = ? AND user_id = ? AND location_key = ?')
      .run(nowIso(now), guildId, userId, locationKey);
    return getShack(guildId, userId, locationKey);
  }

  function touchCleanliness(guildId, userId, locationKey, now = Date.now()) {
    db.prepare('UPDATE economy_shacks SET cleanliness_updated_at = ? WHERE guild_id = ? AND user_id = ? AND location_key = ?')
      .run(nowIso(now), guildId, userId, locationKey);
  }

  /* --------------------------------- upgrades ------------------------------- */

  const hasUpgradeStmt = db.prepare(
    'SELECT 1 FROM economy_upgrades WHERE guild_id = ? AND user_id = ? AND location_key = ? AND upgrade_key = ?');
  const listUpgradesStmt = db.prepare(
    'SELECT upgrade_key FROM economy_upgrades WHERE guild_id = ? AND user_id = ? AND location_key = ?');
  const buyUpgradeStmt = db.prepare(`INSERT INTO economy_upgrades (guild_id, user_id, location_key, upgrade_key)
    VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`);

  function hasUpgrade(guildId, userId, locationKey, upgradeKey) {
    return !!hasUpgradeStmt.get(guildId, userId, locationKey, upgradeKey);
  }

  function listUpgrades(guildId, userId, locationKey) {
    return listUpgradesStmt.all(guildId, userId, locationKey).map((r) => r.upgrade_key);
  }

  function buyUpgrade(guildId, userId, locationKey, upgradeKey) {
    const result = buyUpgradeStmt.run(guildId, userId, locationKey, upgradeKey);
    return result.changes > 0;
  }

  /* ----------------------------------- menu --------------------------------- */

  const listMenuStmt = db.prepare(
    'SELECT slot, item_key FROM economy_menu WHERE guild_id = ? AND user_id = ? AND location_key = ? ORDER BY slot');
  const setMenuItemStmt = db.prepare(`INSERT INTO economy_menu (guild_id, user_id, location_key, slot, item_key)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id, location_key, slot) DO UPDATE SET item_key = excluded.item_key, set_at = datetime('now')`);

  /** Menu rows as a sparse array indexed by slot (nulls for empty slots). */
  function listMenu(guildId, userId, locationKey) {
    const rows = listMenuStmt.all(guildId, userId, locationKey);
    if (rows.length === 0) return [];
    const highest = Math.max(...rows.map((r) => r.slot));
    const menu = Array.from({ length: highest + 1 }, () => null);
    for (const row of rows) menu[row.slot] = row.item_key;
    return menu;
  }

  function setMenuItem(guildId, userId, locationKey, slot, itemKey) {
    setMenuItemStmt.run(guildId, userId, locationKey, slot, itemKey);
    return listMenu(guildId, userId, locationKey);
  }

  /* -------------------------------- employees ------------------------------- */

  const listEmployeesStmt = db.prepare(
    'SELECT employee_key, name, training FROM economy_employees WHERE guild_id = ? AND user_id = ? AND location_key = ? ORDER BY hired_at');
  const countEmployeesStmt = db.prepare(
    'SELECT COUNT(*) AS n FROM economy_employees WHERE guild_id = ? AND user_id = ? AND location_key = ?');
  const hireEmployeeStmt = db.prepare(`INSERT INTO economy_employees (guild_id, user_id, location_key, employee_key, name)
    VALUES (?, ?, ?, ?, ?)`);
  const getEmployeeStmt = db.prepare(
    'SELECT * FROM economy_employees WHERE guild_id = ? AND user_id = ? AND location_key = ? AND name = ?');
  const trainEmployeeStmt = db.prepare(
    'UPDATE economy_employees SET training = ? WHERE guild_id = ? AND user_id = ? AND location_key = ? AND name = ?');

  function listEmployees(guildId, userId, locationKey) {
    return listEmployeesStmt.all(guildId, userId, locationKey);
  }

  function countEmployees(guildId, userId, locationKey) {
    return countEmployeesStmt.get(guildId, userId, locationKey).n;
  }

  function hireEmployee(guildId, userId, locationKey, employeeKey, name) {
    try {
      const result = hireEmployeeStmt.run(guildId, userId, locationKey, employeeKey, name);
      return result.changes > 0 ? getEmployeeStmt.get(guildId, userId, locationKey, name) : null;
    } catch {
      return null; // duplicate name in this location
    }
  }

  function trainEmployee(guildId, userId, locationKey, name) {
    const employee = getEmployeeStmt.get(guildId, userId, locationKey, name);
    if (!employee) return null;
    trainEmployeeStmt.run(employee.training + 1, guildId, userId, locationKey, name);
    return getEmployeeStmt.get(guildId, userId, locationKey, name);
  }

  /* -------------------------------- decorations ----------------------------- */

  const listDecorationsStmt = db.prepare(
    'SELECT decoration_key FROM economy_decorations WHERE guild_id = ? AND user_id = ? AND location_key = ?');
  const buyDecorationStmt = db.prepare(`INSERT INTO economy_decorations (guild_id, user_id, location_key, decoration_key)
    VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`);
  const hasDecorationStmt = db.prepare(
    'SELECT 1 FROM economy_decorations WHERE guild_id = ? AND user_id = ? AND location_key = ? AND decoration_key = ?');

  function listDecorations(guildId, userId, locationKey) {
    return listDecorationsStmt.all(guildId, userId, locationKey).map((r) => r.decoration_key);
  }

  function hasDecoration(guildId, userId, locationKey, decorationKey) {
    return !!hasDecorationStmt.get(guildId, userId, locationKey, decorationKey);
  }

  function buyDecoration(guildId, userId, locationKey, decorationKey) {
    return buyDecorationStmt.run(guildId, userId, locationKey, decorationKey).changes > 0;
  }

  /* ------------------------------- headquarters ----------------------------- */

  const listHqStmt = db.prepare('SELECT hq_key FROM economy_hq WHERE guild_id = ? AND user_id = ?');
  const buyHqStmt = db.prepare(`INSERT INTO economy_hq (guild_id, user_id, hq_key)
    VALUES (?, ?, ?) ON CONFLICT DO NOTHING`);

  function listHq(guildId, userId) {
    return listHqStmt.all(guildId, userId).map((r) => r.hq_key);
  }

  function hasHq(guildId, userId, hqKey) {
    return listHq(guildId, userId).includes(hqKey);
  }

  function buyHq(guildId, userId, hqKey) {
    return buyHqStmt.run(guildId, userId, hqKey).changes > 0;
  }

  /* ---------------------------------- boosts -------------------------------- */

  const addBoostStmt = db.prepare(
    'INSERT INTO economy_boosts (guild_id, user_id, kind, multiplier, expires_at) VALUES (?, ?, ?, ?, ?)');
  const listBoostsStmt = db.prepare(
    'SELECT kind, multiplier, expires_at FROM economy_boosts WHERE guild_id = ? AND user_id = ? AND expires_at > ?');

  function addBoost(guildId, userId, kind, multiplier, expiresAt, now = Date.now()) {
    addBoostStmt.run(guildId, userId, kind, multiplier, nowIso(expiresAt));
    return listBoosts(guildId, userId, now);
  }

  function listBoosts(guildId, userId, now = Date.now()) {
    return listBoostsStmt.all(guildId, userId, nowIso(now));
  }

  /* ------------------------------ state builder -----------------------------
   * Assembles the plain state object the engine expects. Cleanliness decay is
   * applied lazily on every read, so passive timers need no background job.
   */
  function buildState(guildId, userId, now = Date.now()) {
    const user = getUser(guildId, userId) ?? ensureUser(guildId, userId);
    const locations = listShacks(guildId, userId).map((row) => {
      applyCleanlinessDecay(guildId, userId, row.location_key, decayCleanliness, now);
      const fresh = getShack(guildId, userId, row.location_key) ?? row;
      return {
        key: fresh.location_key,
        name: fresh.name,
        level: fresh.level,
        prestige: fresh.prestige,
        cleanliness: fresh.cleanliness,
        expanded: fresh.expanded,
        upgrades: listUpgrades(guildId, userId, fresh.location_key),
        menu: listMenu(guildId, userId, fresh.location_key),
        employees: listEmployees(guildId, userId, fresh.location_key).map((emp) => ({
          key: emp.employee_key,
          name: emp.name,
          training: emp.training,
        })),
        decorations: listDecorations(guildId, userId, fresh.location_key),
      };
    });
    return {
      user: user ?? { cash: 0, bank: 0, daily_streak: 0, ingredients: 0 },
      locations,
      hq: listHq(guildId, userId),
      boosts: listBoosts(guildId, userId, now),
    };
  }

  return {
    ensureUser,
    getUser,
    addCash,
    addIngredients,
    setDailyStreak,
    setCooldown,
    getShack,
    listShacks,
    buyLocation,
    setLevel,
    setPrestige,
    setName,
    setCleanliness,
    setExpanded,
    applyCleanlinessDecay,
    touchCleanliness,
    hasUpgrade,
    listUpgrades,
    buyUpgrade,
    listMenu,
    setMenuItem,
    listEmployees,
    countEmployees,
    hireEmployee,
    trainEmployee,
    addBoost,
    listBoosts,
    listDecorations,
    hasDecoration,
    buyDecoration,
    listHq,
    hasHq,
    buyHq,
    buildState,
  };
}
