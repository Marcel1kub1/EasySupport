import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModules } from '../loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupApiRoutes(app, deps) {
  const routesDir = path.join(__dirname, 'routes');
  await loadModules(routesDir, (mod) => {
    if (typeof mod.setupRoutes === 'function') {
      mod.setupRoutes(app, deps);
    }
  });
}

export default { setupApiRoutes };