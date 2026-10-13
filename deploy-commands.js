import { REST, Routes } from 'discord.js';
import { config } from './src/config.js';
import setup from './src/commands/setup.js';
import panel from './src/commands/panel.js';

const body = [setup.data.toJSON(), panel.data.toJSON()];
const rest = new REST({ version: '10' }).setToken(config.token);

try {
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
    console.log(`[deploy] Registered ${body.length} guild command(s) for guild ${config.guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body });
    console.log(`[deploy] Registered ${body.length} global command(s) (may take up to 1 hour to appear).`);
  }
} catch (error) {
  console.error('[deploy] Failed to register commands:', error);
  process.exit(1);
}
