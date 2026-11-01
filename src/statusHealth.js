import { getClusterConfig, getClusterStatus } from './cluster.js';

export async function createStatusHealthSnapshot({ botReady, checkDatabase, logger = console, clusterConfig = getClusterConfig() }) {
  let database;
  const started = performance.now();
  try {
    await checkDatabase();
    database = {
      status: 'operational',
      detail: 'The EasySupport database query succeeded.',
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
  return {
    checkedAt: new Date().toISOString(),
    services,
    cluster: getClusterStatus(services, clusterConfig),
  };
}
