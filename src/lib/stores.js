import { writable, derived } from 'svelte/store';

export const componentNodes = writable([
  { id: 'gateway', name: 'Gateway Shard 0', desc: 'Discord gateway WebSocket', status: 'operational' },
  { id: 'lavalink', name: 'Lavalink Audio Node', desc: 'Voice & audio processing', status: 'operational' },
  { id: 'rest', name: 'REST API Endpoint', desc: 'REST API and HTTP endpoints', status: 'operational' },
]);

export const adminUnlocked = writable(false);
export const preloaderVisible = writable(true);

export const globalStatus = derived(componentNodes, ($nodes) => {
  const order = { operational: 0, maintenance: 1, degraded: 1, outage: 2 };
  let worst = 'operational';
  for (const n of $nodes) {
    if (order[n.status] ?? 0 > order[worst]) worst = n.status;
  }
  return worst;
});
