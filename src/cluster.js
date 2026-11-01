const DEFAULT_CLUSTER_ID = 'primary';
const DEFAULT_CLUSTER_NAME = 'Primary node';
const DEFAULT_CLUSTER_REGION = 'Single-server deployment';

export function getClusterConfig(environment = process.env) {
  return {
    id: environment.CLUSTER_ID || DEFAULT_CLUSTER_ID,
    name: environment.CLUSTER_NAME || DEFAULT_CLUSTER_NAME,
    region: environment.CLUSTER_REGION || DEFAULT_CLUSTER_REGION,
    endpoint: environment.CLUSTER_ENDPOINT || '/healthz',
  };
}

export function getClusterStatus(services, config = getClusterConfig()) {
  const statuses = Object.values(services).map((service) => service.status);
  const status = statuses.includes('outage')
    ? 'outage'
    : statuses.includes('degraded') || statuses.includes('maintenance')
      ? 'degraded'
      : statuses.length && statuses.every((value) => value === 'operational')
        ? 'operational'
        : 'degraded';
  return {
    version: 1,
    mode: 'single-node',
    privacy: 'Browser latency checks are not stored.',
    nodes: [{
      id: config.id,
      name: config.name,
      region: config.region,
      endpoint: config.endpoint,
      status,
      detail: status === 'operational'
        ? 'All monitored services are responding.'
        : status === 'outage'
          ? 'One or more monitored services are offline.'
          : 'One or more monitored services need attention.',
    }],
  };
}
