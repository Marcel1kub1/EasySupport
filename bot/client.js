import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from '../shared/config.js';

/**
 * Creates and configures the Discord.js client used by EasySupport.
 * Intents and partials match the original src/index.js bootstrap.
 */
export function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.commands = new Map();

  client.on(Events.Error, (error) => console.error('[bot] Client error:', error));
  process.on('unhandledRejection', (err) => console.error('[bot] Unhandled promise rejection:', err));

  return client;
}

export default { createClient };
