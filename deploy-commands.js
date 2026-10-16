import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REST, Routes } from 'discord.js';
import { config } from './src/config.js';
import { loadModules } from './src/loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * Load every command from src/commands/** — the deploy set is always exactly
 * what the running system has.
 */
async function collectCommands() {
  const body = [];
  for (const dir of ['commands']) {
    await loadModules(path.join(__dirname, 'src', dir), (command) => {
      if (command?.data?.name && typeof command.execute === 'function') {
        body.push(command.data.toJSON());
      }
    });
  }
  return body;
}

/*
 * Commands that exist on Discord but not in src/commands/ are deleted, so the
 * client never shows leftovers from older builds. The scope we register to is
 * bulk-overwritten by the PUT below (which also drops stale commands in it);
 * the opposite scope is cleaned explicitly because a PUT never touches it.
 */
async function pruneStale(rest, scope, currentNames) {
  let removed = 0;
  try {
    const existing = await rest.get(scope.list);
    for (const command of existing) {
      if (currentNames.has(command.name)) continue;
      await rest.delete(scope.deleteFor(command.id));
      console.log(`[deploy] Deleted stale ${scope.label} command /${command.name}.`);
      removed += 1;
    }
  } catch (error) {
    console.warn(`[deploy] Could not prune stale ${scope.label} commands:`, error.message ?? error);
  }
  return removed;
}

/*
 * Register slash commands globally (or per guild) and prune any stale commands
 * left over from previous builds in both scopes. Safe to call on every boot.
 */
export async function deployCommands() {
  const body = await collectCommands();
  const currentNames = new Set(body.map((command) => command.name));
  const rest = new REST({ version: '10' }).setToken(config.token);

  if (body.length === 0) {
    throw new Error('No commands found in src/commands/ — nothing to deploy.');
  }

  let target, staleScope;
  if (config.guildId) {
    target = {
      label: `guild ${config.guildId}`,
      list: Routes.applicationGuildCommands(config.clientId, config.guildId),
      deleteFor: (id) => Routes.applicationGuildCommand(config.clientId, config.guildId, id),
      register: () => rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body }),
    };
    staleScope = {
      label: 'global',
      list: Routes.applicationCommands(config.clientId),
      deleteFor: (id) => Routes.applicationCommand(config.clientId, id),
    };
  } else {
    target = {
      label: 'global',
      list: Routes.applicationCommands(config.clientId),
      deleteFor: (id) => Routes.applicationCommand(config.clientId, id),
      register: () => rest.put(Routes.applicationCommands(config.clientId), { body }),
    };
    staleScope = null;
  }

  const removedElsewhere = staleScope ? await pruneStale(rest, staleScope, currentNames) : 0;
  const removedHere = await pruneStale(rest, target, currentNames);
  await target.register();

  console.log(`[deploy] Registered ${body.length} command(s) (${target.label}): ${[...currentNames].join(', ')}`);
  if (removedHere + removedElsewhere > 0) {
    console.log(`[deploy] Removed ${removedHere + removedElsewhere} stale command(s) not in the current system.`);
  }
  console.log('[deploy] Discord now shows only the current commands.');
  return { registered: body.length, removed: removedHere + removedElsewhere };
}

/* CLI entry point — keeps `npm run deploy` working. */
if (process.argv[1] && process.argv[1].endsWith('deploy-commands.js')) {
  deployCommands().catch((error) => {
    console.error('[deploy] Failed to deploy commands:', error);
    process.exit(1);
  });
}
