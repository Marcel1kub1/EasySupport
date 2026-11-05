import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChannelType } from 'discord.js';
import { getReleaseFeed } from '../services/releaseFeed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const viewsDir = path.join(projectRoot, 'frontend', 'views');

const modules = [
  { key: 'tickets', short: 'TK', title: 'Tickets', desc: 'Panels, staff access, transcripts and intake.', command: 'panel', search: 'setup highrankdm' },
  { key: 'moderation', short: 'MD', title: 'Moderation', desc: 'Staff tools, warnings and action logs.', command: 'moderation' },
  { key: 'anti_nuke', short: 'AN', title: 'Anti-Nuke', desc: 'Protect channels, roles and members.', command: 'anti_nuke' },
  { key: 'automod', short: 'AM', title: 'Automod', desc: 'Filter spam, links, words and excess mentions.', command: 'automod' },
  { key: 'leveling', short: 'LV', title: 'Leveling', desc: 'XP, level announcements and role rewards.', command: 'leveling' },
  { key: 'economy', short: 'EC', title: 'Economy', desc: 'Currency, daily rewards and member shops.', command: 'economy' },
  { key: 'giveaways', short: 'GW', title: 'Giveaways', desc: 'Entry channels, durations and winner counts.', command: 'giveaways' },
  { key: 'vouches', short: 'VC', title: 'Vouches', desc: 'Reputation channels, cooldowns and rewards.', command: 'vouches' },
  { key: 'welcome_goodbye_boost', short: 'WB', title: 'Welcome & boosts', desc: 'Member greetings, farewells and boosts.', command: 'welcome_goodbye_boost' },
  { key: 'logging', short: 'LG', title: 'Logging', desc: 'Choose the events and channels to record.', command: 'logging' },
];

const MODULE_LABELS = {
  tickets: 'Tickets',
  moderation: 'Moderation',
  anti_nuke: 'Anti-Nuke',
  automod: 'Automod',
  leveling: 'Leveling',
  economy: 'Economy',
  giveaways: 'Giveaways',
  vouches: 'Vouches',
  welcome_goodbye_boost: 'Welcome/Goodbye/Boost',
  logging: 'Logging',
};

const COMMAND_NAMES = [
  'ticket', 'highrankdm', 'moderation', 'anti_nuke', 'automod', 'leveling',
  'economy', 'giveaways', 'vouches', 'welcome_goodbye_boost', 'logging',
];

const MODULE_SETTINGS = {
  tickets: [
    { key: 'panel_channel', label: 'Panel Channel', type: 'channel' },
    { key: 'ticket_category', label: 'Ticket Category', type: 'category' },
    { key: 'log_channel', label: 'Log Channel', type: 'channel' },
    { key: 'transcript_channel', label: 'Transcript Channel', type: 'channel' },
    { key: 'welcome_dm', label: 'Welcome DM', type: 'toggle' },
    { key: 'close_timeout', label: 'Close Timeout', type: 'number', unit: 'min' },
    { key: 'max_tickets_per_user', label: 'Max Tickets Per User', type: 'number' },
    { key: 'ticket_open_role', label: 'Ticket Access Role', type: 'role' },
    { key: 'staff_role', label: 'Staff Role', type: 'role' },
    { key: 'support_role', label: 'Support Role', type: 'role' },
    { key: 'ticket_prefix', label: 'Ticket Prefix', type: 'text' },
  ],
  moderation: [
    { key: 'mod_log_channel', label: 'Mod Log Channel', type: 'channel' },
    { key: 'mute_role', label: 'Mute Role', type: 'role' },
    { key: 'default_mute_duration', label: 'Default Mute Duration', type: 'number', unit: 'min' },
    { key: 'warn_threshold', label: 'Warn Threshold', type: 'number' },
    { key: 'auto_mute_on_warns', label: 'Auto Mute on Warns', type: 'toggle' },
    { key: 'log_deletions', label: 'Log Deletions', type: 'toggle' },
    { key: 'log_edits', label: 'Log Edits', type: 'toggle' },
    { key: 'log_member_actions', label: 'Log Member Actions', type: 'toggle' },
    { key: 'mod_command_channel', label: 'Mod Command Channel', type: 'channel' },
  ],
  anti_nuke: [
    { key: 'anti_raid_enabled', label: 'Anti-Raid', type: 'toggle' },
    { key: 'anti_raid_threshold', label: 'Raid Threshold', type: 'number' },
    { key: 'anti_raid_action', label: 'Raid Action', type: 'select', options: ['none', 'kick', 'ban'] },
    { key: 'anti_spam_enabled', label: 'Anti-Spam', type: 'toggle' },
    { key: 'anti_spam_threshold', label: 'Spam Threshold', type: 'number' },
    { key: 'anti_invite_enabled', label: 'Anti-Invite', type: 'toggle' },
    { key: 'anti_link_enabled', label: 'Anti-Link', type: 'toggle' },
    { key: 'nuke_protection_enabled', label: 'Nuke Protection', type: 'toggle' },
    { key: 'whitelist_roles', label: 'Whitelisted Roles', type: 'text' },
    { key: 'whitelist_users', label: 'Whitelisted Users', type: 'text' },
  ],
  automod: [
    { key: 'word_filter_enabled', label: 'Word Filter', type: 'toggle' },
    { key: 'blocked_words', label: 'Blocked Words', type: 'text' },
    { key: 'link_filter_enabled', label: 'Link Filter', type: 'toggle' },
    { key: 'allowed_domains', label: 'Allowed Domains', type: 'text' },
    { key: 'mention_spam_enabled', label: 'Mention Spam', type: 'toggle' },
    { key: 'mention_spam_threshold', label: 'Mention Threshold', type: 'number' },
    { key: 'caps_filter_enabled', label: 'Caps Filter', type: 'toggle' },
    { key: 'caps_threshold', label: 'Caps Threshold', type: 'number' },
    { key: 'max_line_length', label: 'Max Line Length', type: 'number' },
    { key: 'automod_action', label: 'Default Action', type: 'select', options: ['none', 'delete', 'mute', 'kick'] },
  ],
  leveling: [
    { key: 'leveling_enabled', label: 'Leveling Enabled', type: 'toggle' },
    { key: 'xp_per_message', label: 'XP Per Message', type: 'number' },
    { key: 'xp_cooldown', label: 'XP Cooldown', type: 'number', unit: 'sec' },
    { key: 'level_up_channel', label: 'Level Up Channel', type: 'channel' },
    { key: 'level_up_message', label: 'Level Up Message', type: 'text' },
    { key: 'role_rewards', label: 'Role Rewards', type: 'text' },
    { key: 'leaderboard_channel', label: 'Leaderboard Channel', type: 'channel' },
    { key: 'disable_xp_channels', label: 'Disable XP Channels', type: 'text' },
    { key: 'disable_xp_roles', label: 'Disable XP Roles', type: 'text' },
    { key: 'xp_multiplier', label: 'XP Multiplier', type: 'number' },
  ],
  economy: [
    { key: 'economy_enabled', label: 'Economy Enabled', type: 'toggle' },
    { key: 'daily_amount', label: 'Daily Amount', type: 'number' },
    { key: 'daily_cooldown', label: 'Daily Cooldown', type: 'number', unit: 'hr' },
    { key: 'work_amount', label: 'Work Amount', type: 'number' },
    { key: 'work_cooldown', label: 'Work Cooldown', type: 'number', unit: 'min' },
    { key: 'pay_enabled', label: 'Pay Enabled', type: 'toggle' },
    { key: 'shop_enabled', label: 'Shop Enabled', type: 'toggle' },
    { key: 'currency_name', label: 'Currency Name', type: 'text' },
    { key: 'currency_emoji', label: 'Currency Emoji', type: 'text' },
    { key: 'starting_balance', label: 'Starting Balance', type: 'number' },
  ],
  giveaways: [
    { key: 'giveaway_channel', label: 'Giveaway Channel', type: 'channel' },
    { key: 'giveaway_role', label: 'Giveaway Role', type: 'role' },
    { key: 'min_giveaway_duration', label: 'Min Duration', type: 'number', unit: 'min' },
    { key: 'max_giveaway_duration', label: 'Max Duration', type: 'number', unit: 'min' },
    { key: 'giveaway_emoji', label: 'Giveaway Emoji', type: 'text' },
    { key: 'winner_count_default', label: 'Default Winner Count', type: 'number' },
    { key: 'giveaway_log_channel', label: 'Log Channel', type: 'channel' },
  ],
  vouches: [
    { key: 'vouches_channel', label: 'Vouches Channel', type: 'channel' },
    { key: 'vouches_enabled', label: 'Vouches Enabled', type: 'toggle' },
    { key: 'vouch_cooldown', label: 'Vouch Cooldown', type: 'number', unit: 'hr' },
    { key: 'max_vouches_per_user', label: 'Max Vouches Per User', type: 'number' },
    { key: 'vouch_leaderboard', label: 'Vouch Leaderboard', type: 'toggle' },
    { key: 'anonymous_vouches', label: 'Anonymous Vouches', type: 'toggle' },
    { key: 'vouch_rewards', label: 'Vouch Rewards', type: 'text' },
  ],
  welcome_goodbye_boost: [
    { key: 'welcome_enabled', label: 'Welcome Messages', type: 'toggle' },
    { key: 'welcome_channel', label: 'Welcome Channel', type: 'channel' },
    { key: 'welcome_message', label: 'Welcome Message', type: 'text' },
    { key: 'goodbye_enabled', label: 'Goodbye Messages', type: 'toggle' },
    { key: 'goodbye_channel', label: 'Goodbye Channel', type: 'channel' },
    { key: 'goodbye_message', label: 'Goodbye Message', type: 'text' },
    { key: 'boost_enabled', label: 'Boost Messages', type: 'toggle' },
    { key: 'boost_channel', label: 'Boost Channel', type: 'channel' },
    { key: 'boost_message', label: 'Boost Message', type: 'text' },
    { key: 'boost_role', label: 'Boost Role', type: 'role' },
  ],
  logging: [
    { key: 'log_channel', label: 'Log Channel', type: 'channel' },
    { key: 'log_message_delete', label: 'Message Delete', type: 'toggle' },
    { key: 'log_message_edit', label: 'Message Edit', type: 'toggle' },
    { key: 'log_member_join', label: 'Member Join', type: 'toggle' },
    { key: 'log_member_leave', label: 'Member Leave', type: 'toggle' },
    { key: 'log_member_ban', label: 'Member Ban', type: 'toggle' },
    { key: 'log_member_unban', label: 'Member Unban', type: 'toggle' },
    { key: 'log_role_create', label: 'Role Create', type: 'toggle' },
    { key: 'log_role_delete', label: 'Role Delete', type: 'toggle' },
    { key: 'log_channel_create', label: 'Channel Create', type: 'toggle' },
    { key: 'log_channel_delete', label: 'Channel Delete', type: 'toggle' },
    { key: 'log_voice_join', label: 'Voice Join', type: 'toggle' },
    { key: 'log_voice_leave', label: 'Voice Leave', type: 'toggle' },
    { key: 'log_nickname_change', label: 'Nickname Change', type: 'toggle' },
    { key: 'log_avatar_change', label: 'Avatar Change', type: 'toggle' },
  ],
};

function getModuleSettings(module) {
  return MODULE_SETTINGS[module] ?? null;
}

export function setupDashboardRoutes(app, deps) {
  const { requireAuth, requireGuildAuth, getUserGuilds, client, pool, config } = deps;

  app.get('/dashboard', requireAuth, async (req, res) => {
    const guilds = getUserGuilds(req);
    if (guilds.length === 0) {
      return res.render(path.join(viewsDir, 'dashboard.ejs'), {
        title: 'EasySupport — Dashboard',
        active: 'dashboard',
        guilds: [],
        user: req.session.discordUser,
        noGuilds: true,
        repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
        csrfToken: res.locals.csrfToken ?? '',
        modules,
        releases: [],
        latestRelease: null,
        githubReleasesPage: 'https://github.com/Marcel1kub1/EasySupport/releases',
        siteCssVersion: '0',
        config,
      });
    }
    return res.redirect(`/dashboard/${guilds[0].id}`);
  });

  app.get('/dashboard/:guildId/updates', requireAuth, requireGuildAuth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = client?.guilds.cache.get(guildId);
    if (!guild) return res.redirect(`/dashboard/${guildId}`);
    const releases = await getReleaseFeed();

    return res.render(path.join(viewsDir, 'updates.ejs'), {
      title: 'EasySupport — What’s new',
      active: 'updates',
      guildId,
      guildName: guild.name,
      guilds: getUserGuilds(req),
      user: req.session.discordUser,
      botInGuild: true,
      releases,
      latestRelease: releases[0] ?? null,
      repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
      csrfToken: res.locals.csrfToken ?? '',
      modules,
      siteCssVersion: '0',
      config,
    });
  });

  app.get('/dashboard/:guildId', requireAuth, requireGuildAuth, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = client?.guilds.cache.get(guildId);
    const releases = await getReleaseFeed();
    const guilds = getUserGuilds(req);
    const currentGuild = guilds.find((g) => g.id === guildId) ?? { id: guildId, name: guild?.name ?? 'Unknown Server' };
    const roles = guild?.roles.cache
      .filter((role) => !role.managed && role.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({ id: role.id, name: role.name })) ?? [];

    return res.render(path.join(viewsDir, 'dashboard.ejs'), {
      title: `EasySupport — ${currentGuild.name}`,
      active: 'dashboard',
      guildId,
      guildName: currentGuild.name,
      guilds,
      user: req.session.discordUser,
      currentGuild,
      botInGuild: Boolean(guild),
      guildIcon: guild?.iconURL({ size: 128 }) ?? null,
      memberCount: guild?.memberCount ?? null,
      channelCount: guild?.channels.cache.filter((channel) => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement).size ?? 0,
      roleCount: roles.length,
      releases,
      latestRelease: releases[0] ?? null,
      repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
      csrfToken: res.locals.csrfToken ?? '',
      modules,
      siteCssVersion: '0',
      config,
    });
  });
}

export default { setupDashboardRoutes };
