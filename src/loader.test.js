import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadModules, loadCommandNames } from './loader.js';

const PROJECT_ROOT = path.join(import.meta.dirname, '..');

test('existing commands load with no duplicates', async () => {
  const names = await loadCommandNames(path.join(PROJECT_ROOT, 'src', 'commands'));
  assert.deepEqual([...names].sort(), ['panel', 'setup']);
});

test('economy commands are discovered through the nested directory', async () => {
  const names = await loadCommandNames(path.join(PROJECT_ROOT, 'src', 'economy', 'commands'));
  const expected = [
    'buy', 'clean', 'cooldowns', 'daily', 'employees', 'found', 'hire', 'menu',
    'mine', 'shack', 'shop', 'tips', 'upgrades', 'work',
  ];
  assert.deepEqual([...names].sort(), expected.sort());
  assert.equal(new Set(names).size, names.length, 'duplicate command names found');
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
