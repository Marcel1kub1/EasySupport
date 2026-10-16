import { getSystemStatus, getAnnouncements, pool } from '$lib/server/db.js';

const STATUS_ORDER = { operational: 0, maintenance: 1, degraded: 1, outage: 2 };
const STATUS_LABEL = {
  operational: 'Operational',
  degraded: 'Degraded Performance',
  outage: 'Major Outage',
  maintenance: 'Maintenance',
};

async function getComponentStatuses() {
  let dbStatus = 'operational';
  try {
    await pool.query('SELECT 1');
  } catch {
    dbStatus = 'outage';
  }

  return [
    {
      id: 'gateway',
      name: 'Gateway Shard 0',
      desc: 'Discord gateway WebSocket',
      status: 'operational',
      label: STATUS_LABEL.operational,
    },
    {
      id: 'lavalink',
      name: 'Lavalink Audio Node',
      desc: 'Voice & audio processing',
      status: 'operational',
      label: STATUS_LABEL.operational,
    },
    {
      id: 'rest',
      name: 'REST API Endpoint',
      desc: 'REST API and HTTP endpoints',
      status: dbStatus,
      label: STATUS_LABEL[dbStatus] ?? STATUS_LABEL.operational,
    },
  ];
}

export async function load({ fetch }) {
  const [status, announcements, components] = await Promise.all([
    getSystemStatus(),
    getAnnouncements(),
    getComponentStatuses(),
  ]);

  const order = STATUS_ORDER;
  let worst = 'operational';
  for (const c of components) {
    if (order[c.status] > order[worst]) worst = c.status;
  }

  return {
    status,
    announcements,
    components,
    globalStatus: worst,
    globalLabel: STATUS_LABEL[worst] ?? STATUS_LABEL.operational,
  };
}
