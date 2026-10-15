/*
 * ============================================================================
 * TACO EMPIRE — MAIN CONFIGURATION
 * ----------------------------------------------------------------------------
 * The ONLY file to edit for economy balance. Locations, ladders, menu items,
 * employees, tasks, recipes, market and events are all defined here and read
 * by the pure engine (src/economy/engine.js) — commands contain no numbers.
 *
 * Everything is guild-scoped like tickets: one empire per user per guild.
 * ============================================================================
 */

export const ECONOMY = {
  currency: 'taco coins',
  currencySymbol: '🌮',

  /* ------------------------------- locations -------------------------------
   * Ordered progression: taco stand (free) -> restaurant -> hotel, plus the
   * Taco Truck side business. Each location has its own 10-level ladder,
   * employees, menu and prestige track. Income scales quadratically with level
   * so the last levels are worth chasing; upgrade costs grow exponentially so
   * each level takes measurably longer.
   *
   *   incomePerHour  = base × level² × locationMultipliers
   *   upgradeCost(L) = upgradeBase × upgradeGrowth^(L-1)   (cost of L -> L+1)
   */
  locations: {
    taco_stand: {
      label: 'Taco Stand',
      order: 0,
      free: true,                 // granted automatically with ensureUser()
      base: 120,                  // income/h at level 1
      upgradeBase: 1_500,
      upgradeGrowth: 2.2,
      maxLevel: 10,
      unlock: null,
      ingredients: 0,
    },
    restaurant: {
      label: 'Restaurant',
      order: 1,
      base: 2_500,
      upgradeBase: 40_000,
      upgradeGrowth: 2.4,
      maxLevel: 10,
      unlock: { location: 'taco_stand', prestige: 1 },
      buyPrice: 500_000,
      ingredients: 50,
    },
    hotel: {
      label: 'Taco Hotel',
      order: 2,
      base: 25_000,
      upgradeBase: 400_000,
      upgradeGrowth: 2.5,
      maxLevel: 10,
      unlock: { location: 'restaurant', prestige: 1 },
      buyPrice: 5_000_000,
      ingredients: 250,
    },
    beach_shack: {
      label: 'Beach Shack',
      order: 3,
      base: 12_000,
      upgradeBase: 150_000,
      upgradeGrowth: 2.35,
      maxLevel: 10,
      unlock: { location: 'restaurant', prestige: 2 },
      buyPrice: 2_000_000,
      ingredients: 120,
    },
    city_shack: {
      label: 'City Shack',
      order: 4,
      base: 90_000,
      upgradeBase: 1_200_000,
      upgradeGrowth: 2.45,
      maxLevel: 10,
      unlock: { location: 'beach_shack', prestige: 2 },
      buyPrice: 20_000_000,
      ingredients: 500,
    },
    taco_truck: {
      label: 'Taco Truck',
      order: 5,
      side: true,                 // side business: own mini-ladder, no prestige
      base: 900,
      upgradeBase: 12_000,
      upgradeGrowth: 2.3,
      maxLevel: 10,
      unlock: { location: 'taco_stand', level: 3 },
      buyPrice: 75_000,
      ingredients: 0,
    },
    hotdog_cart: {
      label: 'Hotdog Cart',
      order: 6,
      side: true,
      base: 6_000,
      upgradeBase: 80_000,
      upgradeGrowth: 2.35,
      maxLevel: 10,
      unlock: { location: 'taco_truck', level: 5 },
      buyPrice: 400_000,
      ingredients: 0,
    },
    mall_kiosk: {
      label: 'Mall Kiosk',
      order: 7,
      side: true,
      base: 40_000,
      upgradeBase: 600_000,
      upgradeGrowth: 2.45,
      maxLevel: 10,
      unlock: { location: 'hotdog_cart', level: 5 },
      buyPrice: 5_000_000,
      ingredients: 0,
    },
  },

  /* -------------------------------- prestige -------------------------------
   * Reset a location to level 1 for a permanent multiplier. The first prestige
   * of ANY location unlocks employee training and advertising.
   */
  prestige: {
    multiplierPerPrestige: 0.15,  // +15% for that location, stacking
    resetLevel: 1,
    unlocks: { training: true, advertising: true },
  },

  /* -------------------------------- synergy ---------------------------------
   * Owning more location lines pays: total income × (1 + 0.10 × (lines - 1)).
   */
  synergy: {
    bonusPerExtraLine: 0.10,
  },

  /* ------------------------------- cleanliness ------------------------------
   * Decays with elapsed hours; a dirty shack earns less and tips shrink.
   */
  cleanliness: {
    decayPerHour: 6,              // points lost per hour (0-100 scale)
    janitorSlowdown: 0.5,         // each janitor multiplies decay by this
    hourlyPenaltyWhenDirty: 0.10, // -10% income while dirty (< cleanThreshold)
    tipsPenaltyWhenDirty: 0.25,   // -25% tips while dirty
    cleanThreshold: 60,           // below this the shack counts as dirty
    cleanRestore: 100,
  },

  /* -------------------------------- cooldowns -------------------------------*/
  cooldowns: {
    work: 60 * 60,                // 1h — main earner
    tips: 8 * 60,                 // 8 min — tip jar
    clean: 10 * 60,
    daily: 24 * 60 * 60,
    mine: 45 * 60,
    advertise: 8 * 60 * 60,
  },

  /* ------------------------------- active payouts ---------------------------*/
  payouts: {
    work: { activeMinutes: 45, flatBonus: 1_000 },
    tips: { flatBonus: 150, minRoll: 2, maxRoll: 8 },   // + level, + cleanliness
    daily: { base: 1_000, streakCap: 7, streakResetHours: 48 },
    mine: { min: 3, max: 7 },
  },

  /* -------------------------------- upgrades --------------------------------
   * Flat % bonuses to the owning location's hourly income. Bought with /buy.
   */
  upgrades: [
    { key: 'better_stove',  label: 'Better Stove',   bonus: 0.08, price: 2_500,   minLevel: 1 },
    { key: 'neon_sign',     label: 'Neon Sign',      bonus: 0.12, price: 12_000,  minLevel: 3 },
    { key: 'comfy_seats',   label: 'Comfy Seats',    bonus: 0.15, price: 45_000,  minLevel: 5 },
    { key: 'salsa_bar',     label: 'Salsa Bar',      bonus: 0.20, price: 180_000, minLevel: 7 },
    { key: 'drive_thru',    label: 'Drive-Thru',     bonus: 0.30, price: 750_000, minLevel: 9 },
  ],

  /* ---------------------------------- menu ----------------------------------
   * One item per slot; slots unlock 1 per location level. Menu bonus applies
   * to hourly income. (TacoShack's "menu trap" — empty slots stay empty!)
   */
  menuItems: [
    { key: 'taco',         label: 'Taco',         income: 40,    price: 0 },
    { key: 'supreme_taco', label: 'Supreme Taco', income: 110,   price: 8_000 },
    { key: 'burrito',      label: 'Burrito',      income: 260,   price: 40_000 },
    { key: 'nachos',       label: 'Nachos',       income: 620,   price: 200_000 },
    { key: 'churros',      label: 'Churros',      income: 1_500, price: 1_000_000 },
  ],

  /* -------------------------------- employees -------------------------------
   * Bonus is a flat % of the location's hourly income; wage is subtracted.
   */
  employees: [
    { key: 'apprentice_chef', label: 'Apprentice Chef', bonus: 0.12, wage: 120,  price: 5_000 },
    { key: 'chef',            label: 'Chef',            bonus: 0.25, wage: 400,  price: 40_000 },
    { key: 'line_cook',       label: 'Line Cook',       bonus: 0.18, wage: 260,  price: 20_000 },
    { key: 'janitor',         label: 'Janitor',         bonus: 0.03, wage: 90,   price: 3_000, slowsDirt: true },
  ],
  maxEmployeesPerLocation: 8,
  training: { maxLevel: 10, bonusPerLevel: 0.02, baseCost: 50_000, costGrowth: 2 },

  /* --------------------------------- boosts ---------------------------------
   * /shop boosts and the Biktok advertising campaign.
   */
  boosts: [
    { key: 'lucky_sombrero', label: 'Lucky Sombrero', multiplier: 1.25, durationHours: 2, price: 25_000 },
    { key: 'golden_ticket',  label: 'Golden Ticket',  multiplier: 1.50, durationHours: 4, price: 120_000 },
  ],
  advertising: { name: 'Biktok campaign', multiplier: 1.75, durationHours: 3, price: 250_000 },

  /* -------------------------------- expansion -------------------------------*/
  expand: { baseCost: 150_000, growth: 2.5, maxLevel: 5, extraUpgradeSlots: 2 },

  /* ------------------------------ headquarters ------------------------------*
   * Global multipliers across every owned location. (Phase 2)
   */
  headquarters: [
    { key: 'hq_logistics', label: 'Logistics HQ', bonus: 0.10, price: 2_000_000 },
    { key: 'hq_branding',  label: 'Branding HQ',  bonus: 0.15, price: 8_000_000 },
    { key: 'hq_franchise', label: 'Franchise HQ', bonus: 0.20, price: 25_000_000 },
  ],

  /* ------------------------------- decorations ------------------------------*
   * Per-location cosmetics with a small income bonus. Bought with /decorations.
   */
  decorations: [
    { key: 'neon_tacos',    label: 'Neon Taco Sign',    bonus: 0.03, price: 60_000 },
    { key: 'salsa_fountain', label: 'Salsa Fountain',   bonus: 0.05, price: 250_000 },
    { key: 'pinata',        label: 'Piñata Corner',     bonus: 0.07, price: 1_000_000 },
    { key: 'golden_sombrero', label: 'Golden Sombrero', bonus: 0.10, price: 4_000_000 },
  ],

  /* -------------------------------- expansion -------------------------------*
   * Each level grants more upgrade slots for that location.
   */
  upgradeSlots: { base: 2, perExpansion: 2 },

  /* ---------------------------------- events --------------------------------*
   * Happy Hour: random 2x /work payout. Rush Hour: scheduled 2x passive.
   * Lunch Rush: weekend double tips.
   */
  events: {
    happyHour: { chancePerWork: 0.15, multiplier: 2, announce: true },
    rushHour: { startHour: 18, endHour: 20, multiplier: 2, announce: true },
    lunchRush: { weekendOnly: true, tipsMultiplier: 2 },
  },

  /* ---------------------------------- tasks ---------------------------------*
   * Three rotate in daily (seeded by user+date, so the set is stable for the
   * whole day). `track` names the action that bumps progress.
   */
  tasks: {
    dailySlots: 3,
    pool: [
      { key: 'work_shifts', label: 'Work 3 shifts', track: 'work', goal: 3, reward: 5_000 },
      { key: 'tip_jars', label: 'Collect 5 tip jars', track: 'tips', goal: 5, reward: 3_000 },
      { key: 'mine_batches', label: 'Mine 2 ingredient batches', track: 'mine', goal: 2, reward: 4_000 },
      { key: 'clean_shop', label: 'Clean a business', track: 'clean', goal: 1, reward: 2_000 },
      { key: 'buy_upgrades', label: 'Buy 2 upgrades', track: 'buy', goal: 2, reward: 6_000 },
      { key: 'hire_staff', label: 'Hire 1 employee', track: 'hire', goal: 1, reward: 4_000 },
    ],
  },

  /* ------------------------------- achievements -----------------------------*
   * Long-term goals. `test(state)` is evaluated lazily whenever the player's
   * empire is read, and the badge unlocks on the first true.
   */
  achievements: [
    { key: 'grand_opening', label: 'Grand Opening', badge: '🏪', test: (s) => (s.locations ?? []).length >= 1 },
    { key: 'restaurateur', label: 'Restaurateur', badge: '🍽️', test: (s) => (s.locations ?? []).some((l) => l.key === 'restaurant') },
    { key: 'hotelier', label: 'Hotelier', badge: '🏨', test: (s) => (s.locations ?? []).some((l) => l.key === 'hotel') },
    { key: 'prestigious', label: 'Prestigious', badge: '⭐', test: (s) => (s.locations ?? []).some((l) => (l.prestige ?? 0) >= 1) },
    { key: 'the_boss', label: 'The Boss', badge: '🧑‍🍳', test: (s) => (s.locations ?? []).reduce((n, l) => n + (l.employees ?? []).length, 0) >= 5 },
    { key: 'millionaire', label: 'Millionaire', badge: '💰', test: (s) => ((s.user?.cash ?? 0) + (s.user?.bank ?? 0)) >= 1_000_000 },
    { key: 'menu_master', label: 'Menu Master', badge: '🌮', test: (s) => (s.locations ?? []).some((l) => (l.menu ?? []).filter(Boolean).length >= 3) },
    { key: 'viral', label: 'Going Viral', badge: '📱', test: (s) => (s.boosts ?? []).some((b) => b.kind === 'advertise') },
  ],

  /* --------------------------------- coupons --------------------------------*
   * Redeemable gift codes, one claim per player. Edit the list to run promos.
   */
  coupons: [
    { code: 'WISPBYTE', reward: 100_000, note: 'Hosting partner gift' },
    { code: 'TACOTUESDAY', reward: 25_000, note: 'Tuesday special' },
    { code: 'GRANDOPENING', reward: 250_000, note: 'First-location bonus' },
  ],

  /* ------------------------------ staff payouts -----------------------------*
   * Staff earn economy cash for closing tickets WITH a reason (a closure
   * without a reason pays nothing, to keep closure notes meaningful).
   * Monthly caps keep one busy month from printing unlimited coins.
   */
  staffPayouts: {
    perReasonedClosure: 1_000,
    monthlyCapPerStaff: 300_000,
    monthlyBonusWinner: 500_000,    // staff-of-the-month extra
    leaderboardSize: 10,
  },

  /* ------------------------------- ticket perks -----------------------------*
   * Coins buy priority support: every ticket opened while the perk is active
   * is flagged, pinged and logged as priority.
   */
  perks: {
    priority: { price: 50_000, durationHours: 24 * 7, label: 'Priority support' },
  },

  /* ------------------------------ community pot -----------------------------*
   * /donate fills the pot; reaching the goal pays a server-wide boost and
   * resets the pot.
   */
  communityPot: {
    goal: 10_000_000,
    boostMultiplier: 2,
    boostDurationHours: 6,
  },

  /* -------------------------------- gifting ---------------------------------*/
  gifting: { feePercent: 0.05, minAmount: 1_000 },

  /* --------------------------- seasonal / live events -----------------------*
   * Seasonal windows stack with everything else. quietQueueBonus applies while
   * the guild has zero open tickets (ticket-driven event).
   */
  seasonal: [
    {
      key: 'anniversary',
      name: 'Anniversary Week',
      start: '2026-11-01',
      end: '2026-11-07',
      multiplier: 3,
      note: 'The bot turns one — triple income all week!',
    },
    {
      key: 'launch_fiesta',
      name: 'Launch Fiesta',
      start: '2026-10-14',
      end: '2026-10-21',
      multiplier: 2,
      note: 'Taco Empire launch week — double income!',
    },
  ],
  quietQueueBonus: { multiplier: 1.25, openTickets: 0 },
  leaderboardRefreshMinutes: 10,

  /* ------------------------------- sauce market -----------------------------*
   * Per-guild simulated stock market: prices drift hourly, positions are held
   * until sold. /taco market (view: market)
   */
  sauceMarket: {
    sauces: [
      { key: 'mild', label: 'Mild', base: 800, volatility: 0.18 },
      { key: 'medium', label: 'Medium', base: 2_500, volatility: 0.24 },
      { key: 'diablo', label: 'Diablo', base: 9_000, volatility: 0.35 },
      { key: 'volcano', label: 'Volcano', base: 30_000, volatility: 0.45 },
    ],
    maxPositionsPerSauce: 50,
    tickHours: 1,
  },

  /* ---------------------------------- kitchen --------------------------------*
   * Recipes consume ingredients and a cooking time; completing one pays cash
   * plus a chance of a rare reward.
   */
  kitchen: {
    slots: 3,
    recipes: [
      { key: 'quesadilla', label: 'Quesadilla', ingredients: 8, minutes: 30, reward: 25_000 },
      { key: 'burrito_bowl', label: 'Burrito Bowl', ingredients: 18, minutes: 60, reward: 90_000 },
      { key: 'taco_pizza', label: 'Taco Pizza', ingredients: 40, minutes: 180, reward: 280_000 },
      { key: 'golden_taco', label: 'Golden Taco', ingredients: 80, minutes: 480, reward: 1_200_000 },
    ],
  },

  /* -------------------------------- franchises -------------------------------*/
  franchise: {
    createCost: 250_000,
    maxMembers: 12,
    levels: [
      { members: 3, cost: 500_000, bonus: 0.05 },
      { members: 6, cost: 2_000_000, bonus: 0.12 },
      { members: 10, cost: 8_000_000, bonus: 0.25 },
    ],
    roles: ['Owner', 'Co-Owner', 'Recruiter', 'Member'],
  },

  /* ------------------------------- mini-games -------------------------------*/
  games: {
    slots: { cost: 10_000, reelPay: 2.5, jackpotMultiplier: 8 },
    blackjack: { minBet: 5_000, maxBet: 250_000, payout: 2 },
    scratch: { cost: 20_000, tiers: [0, 25_000, 80_000, 400_000] },
    flip: { cost: 10_000, payout: 1.95 },
    cups: { cost: 15_000, payout: 2.9 },
    roll: { cost: 10_000, payout: 5.5 },
  },

  /* --------------------- idle accrual, tasks, economy safety -----------------*/
  accrual: { maxHours: 24 },      // offline income is capped at 24h
  gambling: { enabled: false },   // Phase 6, opt-in

  /* -------------------------------- flavor text -----------------------------*/
  flavor: {
    welcome: 'Welcome to the family! Here is your free taco stand — get flipping.',
    dirtyWarning: 'Your shack is filthy. Customers are leaving — run /clean!',
    menuTrap: 'You have an empty menu slot — set one with /menu set!',
  },
};

export default ECONOMY;
