import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Recursively imports every .js module under `dir` and reports it to `onModule`.
 * Used for commands (src/commands/**), gateway events (src/events/**) and the
 * economy command tree (src/economy/commands/**) — subdirectories are supported
 * so new modules can be grouped without touching the loaders.
 *
 * onModule(moduleDefault, relativePathWithoutExtension)
 */
export async function loadModules(dir, onModule) {
  const walk = async (current, prefix) => {
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full, `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
        const mod = await import(pathToFileURL(full).href);
        const name = entry.name.slice(0, -3);
        onModule(mod.default, `${prefix}${name}`, full);
      }
    }
  };
  await walk(dir, '');
}

/** Collects `data.name` of every command module found under `dir`. */
export async function loadCommandNames(dir) {
  const names = [];
  await loadModules(dir, (command) => {
    if (command?.data?.name && typeof command.execute === 'function') {
      names.push(command.data.name);
    }
  });
  return names;
}
