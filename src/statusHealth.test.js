import test from 'node:test';
import assert from 'node:assert/strict';
import { createStatusHealthSnapshot } from './statusHealth.js';

test('health snapshot reports the Discord client and successful MySQL query', async () => {
  const snapshot = await createStatusHealthSnapshot({
    botReady: true,
    checkDatabase: async () => [{ affectedRows: 0 }],
    logger: { error: assert.fail },
  });
  assert.equal(snapshot.services.bot.status, 'operational');
  assert.equal(snapshot.services.database.status, 'operational');
  assert.equal(snapshot.services.database.detail, 'The EasySupport database query succeeded.');
  assert.ok(snapshot.services.database.latencyMs >= 0);
  assert.ok(Number.isFinite(Date.parse(snapshot.checkedAt)));
});

test('health snapshot reports an offline bot and failed database without leaking driver errors', async () => {
  const logged = [];
  const snapshot = await createStatusHealthSnapshot({
    botReady: false,
    checkDatabase: async () => { throw new Error('private database host and password'); },
    logger: { error: (...values) => logged.push(values) },
  });
  assert.equal(snapshot.services.bot.status, 'outage');
  assert.equal(snapshot.services.database.status, 'outage');
  assert.equal(snapshot.services.database.detail, 'The EasySupport database query failed.');
  assert.equal(logged.length, 1);
});
