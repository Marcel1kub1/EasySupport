/** Shared helpers for economy commands. */
import { ECONOMY } from './config.js';
import { formatMoney, formatRate, formatIngredients } from './format.js';

export { formatMoney, formatRate, formatIngredients };

/** Parses the UTC "YYYY-MM-DD HH:MM:SS" form node:sqlite writes. */
export function parseDbTime(value) {
  if (!value) return null;
  const iso = String(value).includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function nowIso(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 19).replace('T', ' ');
}

/** Milliseconds left on a cooldown column, or 0 when ready. */
export function cooldownRemaining(userRow, column, cooldownSeconds, now = Date.now()) {
  const last = parseDbTime(userRow?.[column]);
  if (!last) return 0;
  const remaining = cooldownSeconds * 1000 - (now - last);
  return Math.max(0, remaining);
}

export function formatDuration(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** The player's first location (phase 1 has exactly one; phase 2 adds more). */
export function primaryLocation(state) {
  return state.locations?.[0] ?? null;
}

export function priceLabel(amount) {
  return `${formatMoney(amount)} ${ECONOMY.currency}`;
}
