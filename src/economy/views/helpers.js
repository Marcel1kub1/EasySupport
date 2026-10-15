/** Shared helpers for panel views. */

/** 'YYYY-MM-DD' for daily rotation. */
export function dailyPeriod(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** The streak breaks when the last claim is older than the reset window. */
export function isStreakMissed(lastDailyAt, now = Date.now()) {
  if (!lastDailyAt) return false;
  const iso = String(lastDailyAt).includes('T') ? lastDailyAt : `${lastDailyAt.replace(' ', 'T')}Z`;
  const last = new Date(iso).getTime();
  if (!Number.isFinite(last)) return false;
  return now - last > 48 * 3_600_000;
}

/** 'YYYY-MM' month key used by payouts and staff rankings. */
export function monthPeriod(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 7);
}

export function paginate(items, page, perPage) {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(0, page), pages - 1);
  return { items: items.slice(current * perPage, (current + 1) * perPage), page: current, pages };
}
