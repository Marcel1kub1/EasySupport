import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  // Partials.Channel is required so the bot can DM users and interact there.
  partials: [Partials.Channel],
});

client.commands = new Map();

async function loadModules(dir, onModule) {
  const full = path.join(__dirname, dir);
  for (const file of fs.readdirSync(full)) {
    if (!file.endsWith('.js')) continue;
    const mod = await import(pathToFileURL(path.join(full, file)).href);
    onModule(mod.default, file);
  }
}

// Slash commands
await loadModules('commands', (command) => {
  if (command?.data?.name && typeof command.execute === 'function') {
    client.commands.set(command.data.name, command);
  }
});

// Gateway events
await loadModules('events', (event) => {
  if (event?.name && typeof event.execute === 'function') {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
});

client.once(Events.ClientReady, (ready) => {
  console.log(`[bot] Logged in as ${ready.user.tag}`);
  console.log(`[bot] Serving ${client.guilds.cache.size} guild(s)`);
});

// discord.js surfaces failures inside event handlers as Client 'error' events;
// without this listener such an error takes the whole process down.
client.on(Events.Error, (error) => console.error('[bot] Client error:', error));

process.on('unhandledRejection', (err) => console.error('[bot] Unhandled promise rejection:', err));

client.login(config.token);
