import {
  getTicketByChannel,
  logMessage,
  getSetting,
  addXp,
} from '../db.js';
import { getStatusMeta } from '../categories.js';

const ANTINUKE_ACTIONS = new Map();

/*
 * Automated interaction logging: every message sent inside a ticket channel
 * that has not reached a terminal status is stored, so a complete transcript
 * can be produced on closure.
 */
export default {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    // ---- Leveling: award XP ----
    const levelingEnabled = await getSetting(message.guildId, 'leveling_enabled');
    if (levelingEnabled !== 'false') {
      const cooldownKey = `${message.guildId}:${message.author.id}`;
      const lastXp = ANTINUKE_ACTIONS.get(cooldownKey) ?? 0;
      const xpCooldown = Number(await getSetting(message.guildId, 'xp_cooldown') ?? '60');
      if (Date.now() - lastXp > xpCooldown * 1000) {
        const xpAmount = Number(await getSetting(message.guildId, 'xp_per_message') ?? '15');
        await addXp(message.guildId, message.author.id, xpAmount);
        ANTINUKE_ACTIONS.set(cooldownKey, Date.now());
      }
    }

    // ---- Ticket message logging ----
    const ticket = await getTicketByChannel(message.channel.id);
    if (!ticket || getStatusMeta(ticket.status)?.terminal) return;

    const content =
      message.content?.trim() ||
      (message.attachments.size > 0 ? `[${message.attachments.size} attachment(s)]` : '[no text content]');

    await logMessage({
      ticketId: ticket.id,
      authorId: message.author.id,
      authorTag: message.author.tag,
      content,
      createdAt: message.createdAt.toISOString(),
    });

    // ---- Automod filtering ----
    const automodEnabled = await getSetting(message.guildId, 'automod_enabled');
    if (automodEnabled === 'true') {
      await handleAutomod(message);
    }

    // ---- Anti-nuke tracking ----
    const antiNukeEnabled = await getSetting(message.guildId, 'anti_nuke_enabled');
    if (antiNukeEnabled === 'true') {
      await handleAntiNuke(message);
    }
  },
};

async function handleAutomod(message) {
  const wordFilterEnabled = await getSetting(message.guildId, 'word_filter_enabled');
  if (wordFilterEnabled === 'true') {
    const blockedWords = await getSetting(message.guildId, 'blocked_words') ?? '';
    const words = blockedWords.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
    const content = message.content.toLowerCase();
    const matched = words.find((w) => content.includes(w));
    if (matched) {
      await message.delete().catch(() => {});
      const action = await getSetting(message.guildId, 'automod_action') ?? 'delete';
      if (action === 'mute') {
        await message.member.timeout(600_000, 'Automod: blocked word').catch(() => {});
      }
      return;
    }
  }

  const linkFilterEnabled = await getSetting(message.guildId, 'link_filter_enabled');
  if (linkFilterEnabled === 'true') {
    const allowedDomains = await getSetting(message.guildId, 'allowed_domains') ?? '';
    const domains = allowedDomains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = message.content.match(urlRegex) ?? [];
    for (const url of urls) {
      try {
        const domain = new URL(url).hostname.toLowerCase();
        if (!domains.includes(domain) && !domains.some((d) => domain.endsWith('.' + d))) {
          await message.delete().catch(() => {});
          const action = await getSetting(message.guildId, 'automod_action') ?? 'delete';
          if (action === 'mute') {
            await message.member.timeout(600_000, 'Automod: blocked link').catch(() => {});
          }
          return;
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }

  const mentionSpamEnabled = await getSetting(message.guildId, 'mention_spam_enabled');
  if (mentionSpamEnabled === 'true') {
    const threshold = Number(await getSetting(message.guildId, 'mention_spam_threshold') ?? '5');
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount >= threshold) {
      await message.delete().catch(() => {});
      const action = await getSetting(message.guildId, 'automod_action') ?? 'delete';
      if (action === 'mute') {
        await message.member.timeout(600_000, 'Automod: mention spam').catch(() => {});
      }
    }
  }

  const capsFilterEnabled = await getSetting(message.guildId, 'caps_filter_enabled');
  if (capsFilterEnabled === 'true') {
    const threshold = Number(await getSetting(message.guildId, 'caps_threshold') ?? '0.7');
    const content = message.content;
    if (content.length >= 10) {
      const capsCount = (content.match(/[A-Z]/g) ?? []).length;
      const capsRatio = capsCount / content.length;
      if (capsRatio > threshold) {
        await message.delete().catch(() => {});
        const action = await getSetting(message.guildId, 'automod_action') ?? 'delete';
        if (action === 'mute') {
          await message.member.timeout(600_000, 'Automod: excessive caps').catch(() => {});
        }
      }
    }
  }
}

async function handleAntiNuke(message) {
  const antiSpamEnabled = await getSetting(message.guildId, 'anti_spam_enabled');
  if (antiSpamEnabled === 'true') {
    const threshold = Number(await getSetting(message.guildId, 'anti_spam_threshold') ?? '5');
    const key = `${message.guildId}:${message.author.id}`;
    const now = Date.now();
    const windowMs = 10_000;

    let history = ANTINUKE_ACTIONS.get(key) ?? [];
    history = history.filter((t) => now - t < windowMs);
    history.push(now);
    ANTINUKE_ACTIONS.set(key, history);

    if (history.length > threshold) {
      const action = await getSetting(message.guildId, 'automod_action') ?? 'delete';
      try {
        if (action === 'mute') {
          await message.member.timeout(600_000, 'Anti-nuke: spam').catch(() => {});
        } else if (action === 'kick') {
          await message.member.kick('Anti-nuke: spam').catch(() => {});
        } else if (action === 'ban') {
          await message.member.ban({ reason: 'Anti-nuke: spam' }).catch(() => {});
        }
      } catch {
        // Action may fail if permissions missing
      }
    }
  }
}

// Cleanup old anti-nuke history every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, history] of ANTINUKE_ACTIONS.entries()) {
    const filtered = history.filter((t) => now - t < 60_000);
    if (filtered.length === 0) {
      ANTINUKE_ACTIONS.delete(key);
    } else {
      ANTINUKE_ACTIONS.set(key, filtered);
    }
  }
}, 60_000);
