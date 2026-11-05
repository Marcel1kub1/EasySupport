import { setupHealthRoutes } from './routes/health.js';
import { setupPublicRoutes } from './routes/public.js';
import { setupAuthRoutes } from './routes/auth.js';
import { setupDashboardRoutes } from './routes/dashboard.js';
import { setupAdminRoutes } from './routes/admin.js';

export function setupApiRoutes(app, deps) {
  setupHealthRoutes(app, deps);
  setupPublicRoutes(app, deps);
  setupAuthRoutes(app, deps);
  setupDashboardRoutes(app, deps);
  setupAdminRoutes(app, deps);
}

export default { setupApiRoutes };
