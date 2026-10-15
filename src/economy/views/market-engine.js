/** Deterministic price-walk helpers for the sauce market. */

/** Current hour bucket, e.g. '512456'. */
export function hourKey(now = Date.now()) {
  return String(Math.floor(now / 3_600_000));
}

/** Small deterministic PRNG from a string seed (mulberry32). */
export function seededRandom(seedText) {
  let h = 2166136261;
  for (const ch of String(seedText)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic price-walk helpers for the sauce market. */

/** Deterministic per-guild price for a sauce at a given hour. */
export function priceOf(guildId, sauce, now = Date.now()) {
  const seed = seededRandom(`${guildId}:${sauce.key}:${hourKey(now)}`);
  const drift = (seed() - 0.48) * 2; // slight upward bias keeps the market fun
  const wave = Math.sin(Number(hourKey(now)) / 6 + sauce.base) * sauce.volatility * 0.5;
  return Math.max(sauce.base * 0.25, Math.round(sauce.base * (1 + drift * sauce.volatility + wave)));
}
