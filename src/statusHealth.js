export async function createStatusHealthSnapshot({ botReady, checkDatabase, logger = console }) {
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

  return {
    checkedAt: new Date().toISOString(),
    services: {
      bot: {
        status: botReady ? 'operational' : 'outage',
        detail: botReady ? 'The Discord client is connected and ready.' : 'The Discord client is not ready.',
      },
      database,
    },
  };
}
