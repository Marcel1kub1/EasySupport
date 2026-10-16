import { d as derived, w as writable } from './index2-BYq7dByy.js';

const componentNodes = writable([
  { id: "gateway", name: "Gateway Shard 0", desc: "Discord gateway WebSocket", status: "operational" },
  { id: "lavalink", name: "Lavalink Audio Node", desc: "Voice & audio processing", status: "operational" },
  { id: "rest", name: "REST API Endpoint", desc: "REST API and HTTP endpoints", status: "operational" }
]);
const adminUnlocked = writable(false);
const preloaderVisible = writable(true);
derived(componentNodes, ($nodes) => {
  const order = { operational: 0, maintenance: 1, degraded: 1, outage: 2 };
  let worst = "operational";
  for (const n of $nodes) {
    if (order[n.status] ?? 0 > order[worst]) worst = n.status;
  }
  return worst;
});

export { adminUnlocked as a, preloaderVisible as p };
//# sourceMappingURL=stores-YsuwijFb.js.map
