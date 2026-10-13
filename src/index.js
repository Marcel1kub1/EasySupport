import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { loadModules } from './loader.js';
import { economy } from './economy/instance.js';
import { startReminderScheduler } from './economy/scheduler.js';

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

// Slash commands: src/commands/** and the economy tree src/economy/commands/**
for (const dir of ['commands', path.join('economy', 'commands')]) {
  await loadModules(path.join(__dirname, dir), (command) => {
    if (command?.data?.name && typeof command.execute === 'function') {
      client.commands.set(command.data.name, command);
    }
  });
}

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

// discord.js surfaces failures inside event handlers as Client 'error' events;
// without this listener such an error takes the whole process down.
client.on(Events.Error, (error) => console.error('[bot] Client error:', error));

process.on('unhandledRejection', (err) => console.error('[bot] Unhandled promise rejection:', err));

client.login(config.token).then(() => startReminderScheduler(client, economy));
