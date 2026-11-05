import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from './client.js';
import { config } from '../shared/config.js';
import { loadModules } from '../../src/loader.js';

/**
 * Bootstraps the Discord bot: loads commands and events, then logs in.
 * Called by server.js after the database and web server are ready.
 */
export async function startBot() {
  const client = createClient();

  // Slash commands: bot/commands/**
  await loadModules(path.join(process.cwd(), 'bot', 'commands'), (command) => {
    if (command?.data?.name && typeof command.execute === 'function') {
      client.commands.set(command.data.name, command);
    }
  });

  // Gateway events: bot/events/**
  await loadModules(path.join(process.cwd(), 'bot', 'events'), (event) => {
    if (event?.name && typeof event.execute === 'function') {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  });

  client.once(Events.ClientReady, (ready) => {
    console.log(`[bot] Logged in as ${ready.user.tag}`);
    console.log(`[bot] Serving ${client.guilds.cache.size} guild(s)`);
  });

  await client.login(config.token);
  return client;
}

export default { startBot };
