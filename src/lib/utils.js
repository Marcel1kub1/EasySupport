const STATUS_CONFIG = {
  operational: {
    label: 'Operational',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.35)]',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/20',
  },
  degraded: {
    label: 'Degraded Performance',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.35)]',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20',
  },
  outage: {
    label: 'Major Outage',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.35)]',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500/20',
  },
  maintenance: {
    label: 'Maintenance',
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    shadow: 'shadow-[0_0_20px_rgba(100,116,139,0.35)]',
    dot: 'bg-slate-500',
    ring: 'ring-slate-500/20',
  },
};

export function statusConfig(status) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.operational;
}

export function generateUptimeBlocks(status, count = 90) {
  const blocks = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let blockStatus = status;
    if (r > 0.94) blockStatus = 'degraded';
    else if (r > 0.985) blockStatus = 'outage';
    blocks.push(blockStatus);
  }
  return blocks;
}

export const GLOBAL_LABELS = {
  operational: 'All Systems Operational',
  degraded: 'Degraded Performance',
  outage: 'Major Outage',
  maintenance: 'Maintenance',
};
