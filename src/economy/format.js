/** Formatting helpers shared by every economy command. */

const UNITS = ['', 'k', 'M', 'B', 'T', 'Qa'];

/** 1234 -> "1.23k", 5_400_000 -> "5.4M" */
export function formatMoney(amount) {
  const n = Math.floor(Math.max(0, Number(amount) || 0));
  if (n < 1000) return String(n);
  let tier = 0;
  let scaled = n;
  while (scaled >= 1000 && tier < UNITS.length - 1) {
    scaled /= 1000;
    tier += 1;
  }
  const rounded = scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
  return `${rounded}${UNITS[tier]}`;
}

/** 12000 -> "12k/h" */
export function formatRate(perHour) {
  return `${formatMoney(perHour)}/h`;
}

/** Ingredients are small integers. */
export function formatIngredients(amount) {
  return String(Math.floor(Math.max(0, Number(amount) || 0)));
}
