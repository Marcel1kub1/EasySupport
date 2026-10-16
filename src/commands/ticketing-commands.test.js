/*
 * Ticketing-side commands (src/commands/): the new admin tools and their guards hold.
 * Runs against a throwaway database.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TMP_DB = path.join(os.tmpdir(), `ticketing-cmds-${process.pid}.db`);

let commands;

before(async () => {
  process.env.DB_FILE = TMP_DB;
  for (const file of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) {
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  commands = {};
  const dir = import.meta.dirname;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    commands[file.slice(0, -3)] = (await import(pathToFileURL(path.join(dir, file)).href)).default;
  }
});

function mock({ options = {}, subcommand = null, guildId = 'guild-1', admin = true, channel, guild } = {}) {
  const replies = [];
  return {
    guildId,
    channelId: 'channel-1',
    guild: guild ?? { id: guildId, name: 'Test Guild' },
    user: { id: 'admin-1', username: 'admin', tag: 'admin#0001' },
    memberPermissions: { has: () => admin },
    channel: channel ?? { isTextBased: () => true },
    options: {
      getString: (n) => options[n] ?? null,
      getInteger: (n) => options[n] ?? null,
      getUser: (n) => options[n] ?? null,
      getRole: (n) => options[n] ?? null,
      getChannel: (n) => options[n] ?? null,
      getSubcommand: () => subcommand,
    },
    reply: async (payload) => {
      replies.push(payload);
      return payload;
    },
    deferReply: async (payload) => {
      replies.push(payload);
      return payload;
    },
    editReply: async (payload) => {
      replies.push(payload);
      return payload;
    },
    lastReply: () => replies.at(-1),
    replyText: () => replies.map((r) => r.content ?? '').join('\n'),
  };
}

test('blacklist blocks, reports and unblocks a member', async () => {
  const member = { id: 'user-42', bot: false };

  const checkBefore = mock({ options: { member }, subcommand: 'check' });
  await commands.blacklist.execute(checkBefore);
  assert.match(checkBefore.replyText(), /is not blocked/);

  const add = mock({ options: { member }, subcommand: 'add' });
  await commands.blacklist.execute(add);
  assert.match(add.replyText(), /can no longer open tickets/);

  const checkAfter = mock({ options: { member }, subcommand: 'check' });
  await commands.blacklist.execute(checkAfter);
  assert.match(checkAfter.replyText(), /is blocked/);

  const remove = mock({ options: { member }, subcommand: 'remove' });
  await commands.blacklist.execute(remove);
  assert.match(remove.replyText(), /can open tickets again/);
});

test('export builds a snapshot and DMs it (then cleans up)', async () => {
  const sent = [];
  const admin = mock({
    admin: true,
    user: {
      id: 'admin-1',
      username: 'admin',
      tag: 'admin#0001',
      send: async (payload) => {
        sent.push(payload);
        return payload;
      },
    },
  });
  // the command reads interaction.user (not the mock's user prop)
  admin.user = {
    id: 'admin-1',
    username: 'admin',
    tag: 'admin#0001',
    send: async (payload) => {
      sent.push(payload);
      return payload;
    },
  };

  await commands.export.execute(admin);
  assert.match(admin.replyText(), /Snapshot sent to your DMs/);
  assert.equal(sent.length, 1);
  assert.ok(sent[0].files?.[0], 'expected the database file attached');
  // the temporary snapshot is removed afterwards
  const leftovers = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('ticketbot-export-'));
  assert.deepEqual(leftovers, []);
});

test('export refuses non-admins', async () => {
  const denied = mock({ admin: false });
  await commands.export.execute(denied);
  assert.match(denied.replyText(), /Administrator only/);
});

test('setup writes the staff-of-the-month role', async () => {
  const staffRole = { id: 'role-staff' };
  const motmRole = { id: 'role-motm' };
  const category = { id: 'cat-1', type: 4 }; // ChannelType.GuildCategory
  const logChannel = { id: 'chan-log', isTextBased: () => true };
  const guild = {
    members: { me: { permissions: { has: () => true } } },
  };

  const interaction = mock({
    options: { staff_role: staffRole, log_channel: logChannel, category, staff_of_month_role: motmRole, max_open: 3 },
    guild,
  });
  await commands.setup.execute(interaction);

  const settings = (await import('../db.js')).getGuild('guild-1');
  assert.equal(settings.staff_role_id, 'role-staff');
  assert.equal(settings.motm_role_id, 'role-motm');
  assert.equal(settings.max_open_tickets, 3);
});
