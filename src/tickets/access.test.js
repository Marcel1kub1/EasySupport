import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasTicketAccessRole } from './access.js';

test('ticket access role matches cached GuildMember roles', () => {
  const member = { roles: { cache: new Map([['role-1', {}]]) } };
  assert.equal(hasTicketAccessRole(member, 'role-1'), true);
  assert.equal(hasTicketAccessRole(member, 'role-2'), false);
});

test('ticket access role matches API interaction member role IDs', () => {
  assert.equal(hasTicketAccessRole({ roles: ['role-1'] }, 'role-1'), true);
  assert.equal(hasTicketAccessRole({ roles: ['role-1'] }, 'role-2'), false);
});

test('missing member role or configuration does not grant blacklist bypass', () => {
  assert.equal(hasTicketAccessRole({ roles: ['role-1'] }, ''), false);
  assert.equal(hasTicketAccessRole(null, 'role-1'), false);
  assert.equal(hasTicketAccessRole({ roles: null }, 'role-1'), false);
});
