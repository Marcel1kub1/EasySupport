export async function createStatusHealthSnapshot({ botReady, checkDatabase, logger = console }) {
  let database;
  const started = performance.now();
  try {
    await checkDatabase();
    database = {
      status: 'operational',
      detail: 'The EasySupport database health query succeeded.',
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    logger.error('[status] EasySupport database health query failed:', error);
    database = {
      status: 'outage',
      detail: 'The EasySupport database query failed.',
      latencyMs: Math.round(performance.now() - started),
    };
  }

  const services = {
    bot: {
      status: botReady ? 'operational' : 'outage',
      detail: botReady ? 'The Discord client is connected and ready.' : 'The Discord client is not ready.',
    },
    database,
  };

  const statuses = Object.values(services).map((service) => service.status);
  const clusterStatus = statuses.includes('outage')
    ? 'outage'
    : statuses.includes('degraded') || statuses.includes('maintenance')
      ? 'degraded'
      : statuses.length && statuses.every((value) => value === 'operational')
        ? 'operational'
        : 'degraded';

  return {
    checkedAt: new Date().toISOString(),
    services,
    cluster: {
      version: 1,
      mode: 'single-node',
      privacy: 'Browser latency checks are not stored.',
      status: clusterStatus,
      detail: clusterStatus === 'operational'
        ? 'All monitored services are responding.'
        : clusterStatus === 'outage'
          ? 'One or more monitored services are offline.'
          : 'One or more monitored services need attention.',
    },
  };
}
