import test from 'node:test';
import assert from 'node:assert/strict';
import { getClusterConfig, getClusterStatus } from './cluster.js';

test('cluster defaults to one non-orchestrating public node', () => {
  assert.deepEqual(getClusterConfig({}), {
    id: 'primary',
    name: 'Primary node',
    region: 'Single-server deployment',
    endpoint: '/healthz',
  });
});

test('cluster status reflects monitored service health without visitor telemetry', () => {
  const cluster = getClusterStatus({
    bot: { status: 'operational' },
    database: { status: 'degraded' },
  }, getClusterConfig({ CLUSTER_REGION: 'EU' }));
  assert.equal(cluster.version, 1);
  assert.equal(cluster.mode, 'single-node');
  assert.equal(cluster.nodes[0].status, 'degraded');
  assert.equal(cluster.nodes[0].region, 'EU');
  assert.match(cluster.privacy, /not stored/i);
});
