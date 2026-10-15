/** Franchise bonus math — pure and testable. */

/**
 * Franchise income bonus for a member: the highest unlocked level whose member
 * requirement the franchise meets, plus a small pot bonus.
 */
export function franchiseBonus(franchise, config) {
  const levels = config.franchise.levels;
  const members = franchise.members ?? 0;
  let bonus = 0;
  for (const level of levels) {
    if (members >= level.members) bonus = Math.max(bonus, level.bonus);
  }
  return bonus + Math.min(0.1, (franchise.pot ?? 0) / 100_000_000); // pot tops out at +10%
}

/** Cost of the next franchise level, or null when maxed. */
export function nextFranchiseLevel(franchise, config) {
  return config.franchise.levels.find((level) => (franchise.members ?? 0) < level.members) ?? null;
}
