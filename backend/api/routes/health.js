import { createStatusHealthSnapshot } from '../../shared/statusHealth.js';

export function setupHealthRoutes(app, client, pool) {
  app.get('/healthz', (_req, res) => {
    res.set('Cache-Control', 'no-store').status(200).json({
      status: 'ok',
      service: 'website-gateway',
    });
  });

  app.get('/api/status/health', async (_req, res) => {
    const health = await createStatusHealthSnapshot({
      botReady: Boolean(client?.isReady()),
      checkDatabase: () => pool.query('SELECT 1'),
    });
    return res.set('Cache-Control', 'no-store').status(200).json(health);
  });
}
