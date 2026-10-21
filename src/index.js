import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { loadModules } from './loader.js';
import { createWebApp } from './web.js';
import { deployCommands } from '../deploy-commands.js';
import { connect, initialize, migrate, pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.commands = new Map();

// Slash commands: src/commands/**
await loadModules(path.join(__dirname, 'commands'), (command) => {
  if (command?.data?.name && typeof command.execute === 'function') {
    client.commands.set(command.data.name, command);
  }
});

// Gateway events: src/events/**
await loadModules(path.join(__dirname, 'events'), (event) => {
  if (event?.name && typeof event.execute === 'function') {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
});

client.once(Events.ClientReady, (ready) => {
  console.log(`[bot] Logged in as ${ready.user.tag}`);
  console.log(`[bot] Serving ${client.guilds.cache.size} guild(s)`);
});

client.on(Events.Error, (error) => console.error('[bot] Client error:', error));

process.on('unhandledRejection', (err) => console.error('[bot] Unhandled promise rejection:', err));

/* Boot: connect to MySQL, initialize schema, then start the combined bot + web process. */
async function boot() {
  try {
    await connect();
    console.log('[db] Connected to MySQL.');
    await initialize();
    console.log('[db] Schema initialized.');
    await migrate();
    console.log('[db] Migrations applied.');

    // Sync slash commands with Discord: register current ones and prune any
    // stale commands left over from older builds (both scopes).
    try {
      await deployCommands();
    } catch (error) {
      console.error('[deploy] Command sync failed (non-fatal):', error.message ?? error);
    }

  } catch (error) {
    console.error('[db] Failed to connect to MySQL:', error);
    process.exit(1);
  }

  // Start the public site and guild dashboard alongside the bot.
  const app = createWebApp(client);
  const server = app.listen(config.port, () => {
    console.log(`[web] Listening on http://localhost:${config.port}`);
  });

  // Graceful shutdown.
  process.on('SIGTERM', () => {
    server.close(() => pool.end());
    client.destroy();
    process.exit(0);
  });

  await client.login(config.token);
}

boot();
