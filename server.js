import { connect, initialize, migrate, pool } from './shared/db.js';
import { createWebApp } from './backend/api/index.js';
import { startBot } from './bot/index.js';
import { config } from './shared/config.js';

/* Boot: connect to MySQL, initialize schema, start the combined bot + web process. */
async function boot() {
  try {
    await connect();
    console.log('[db] Connected to MySQL.');
    await initialize();
    console.log('[db] Schema initialized.');
    await migrate();
    console.log('[db] Migrations applied.');
  } catch (error) {
    console.error('[db] Failed to connect to MySQL:', error);
    process.exit(1);
  }

  // Start the Discord bot first so web routes have a ready client.
  // Web still starts even if the bot fails to log in.
  let client = null;
  try {
    client = await startBot();
    console.log('[bot] Discord client ready.');
  } catch (error) {
    console.error('[bot] Failed to start Discord client:', error);
  }

  // Start the public site and guild dashboard alongside the bot.
  const app = createWebApp(client, pool);
  const server = app.listen(config.port, () => {
    console.log(`[web] Listening on port ${config.port}`);
  });

  // Graceful shutdown.
  process.on('SIGTERM', () => {
    server.close(() => pool.end());
    process.exit(0);
  });
}

boot();
