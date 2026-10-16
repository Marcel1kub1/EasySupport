import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadModules, loadCommandNames } from './loader.js';

const PROJECT_ROOT = path.join(import.meta.dirname, '..');

test('existing commands load with no duplicates', async () => {
  const names = await loadCommandNames(path.join(PROJECT_ROOT, 'src', 'commands'));
  assert.deepEqual([...names].sort(), ['blacklist', 'export', 'panel', 'setup']);
});

test('loader walks nested directories and skips non-js files', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-test-'));
  try {
    fs.mkdirSync(path.join(tmp, 'group'));
    fs.writeFileSync(path.join(tmp, 'a.js'), 'export default { name: "a", data: { name: "a" }, execute() {} }');
    fs.writeFileSync(path.join(tmp, 'group', 'b.js'), 'export default { name: "b", data: { name: "b" }, execute() {} }');
    fs.writeFileSync(path.join(tmp, 'notes.txt'), 'ignored');
    fs.writeFileSync(path.join(tmp, 'group', 'README.md'), 'ignored');

    const seen = [];
    await loadModules(tmp, (mod, name) => {
      if (mod?.data?.name) seen.push(mod.data.name);
    });
    assert.deepEqual(seen.sort(), ['a', 'b']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('modules without a command shape are ignored, not fatal', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-test-'));
  try {
    fs.writeFileSync(path.join(tmp, 'lib.js'), 'export const helper = () => 1;');
    fs.writeFileSync(path.join(tmp, 'half.js'), 'export default { data: { name: "half" } };'); // no execute
    const names = await loadCommandNames(tmp);
    assert.deepEqual(names, []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

/**
 * Discord rejects the whole deploy payload when any single command breaks its
 * option rules — this mirrors what the API validates so `npm run deploy` can
 * never fail on a structural mistake again.
 */
test('every command payload satisfies Discord option rules', async () => {
  const payload = [];
  await loadModules(path.join(PROJECT_ROOT, 'src', 'commands'), (command) => {
      if (command?.data?.name && typeof command.execute === 'function') {
        payload.push(command.data.toJSON());
      }
    });

  const SUB = new Set([1, 2]); // subcommand, subcommand group
  for (const command of payload) {
    const options = command.options ?? [];

    // 1. subcommands are mutually exclusive with any other option type
    const subs = options.filter((o) => SUB.has(o.type));
    const others = options.filter((o) => !SUB.has(o.type));
    assert.ok(
      !(subs.length > 0 && others.length > 0),
      `/${command.name} mixes subcommands with other options`
    );

    // 2. required options must come before optional ones (also inside subcommands)
    const groups = subs.length > 0 ? subs.flatMap((s) => [s.options ?? []]) : [options];
    for (const group of groups) {
      let seenOptional = false;
      for (const option of group) {
        if (option.required === true) {
          assert.ok(!seenOptional, `/${command.name} has a required option after an optional one`);
        } else {
          seenOptional = true;
        }
      }
    }

    // 3. structural limits
    assert.ok(options.length <= 25, `/${command.name} has more than 25 options`);
    for (const option of options) {
      assert.ok((option.choices ?? []).length <= 25, `/${command.name}.${option.name} has too many choices`);
      assert.ok(option.description.length >= 1 && option.description.length <= 100, `/${command.name}.${option.name} bad description`);
    }
    assert.ok(command.description.length >= 1 && command.description.length <= 100, `/${command.name} bad description`);
  }
});
