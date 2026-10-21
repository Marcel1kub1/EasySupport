import { test } from 'node:test';
import assert from 'node:assert/strict';
import setup from './setup.js';

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
      return {
        ...payload,
        createMessageComponentCollector: () => ({ on() {} }),
      };
    },
    lastReply: () => replies.at(-1),
    replyText: () => replies.map((r) => r.content ?? '').join('\n'),
  };
}

test('setup shows configure form', async () => {
  const interaction = mock({});
  await setup.execute(interaction);
  const panel = interaction.lastReply();
  assert.equal(panel.embeds[0].data.title, 'EasySupport — Setup');
  assert.ok(panel.components.length > 0);
});
