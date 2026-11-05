import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChannelType } from 'discord.js';
import { bulkUpdateGuildSettings, getAllRolePermissions, getRolePermissions, setRolePermission } from '../../../database/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const viewsDir = path.join(projectRoot, 'src', 'web', 'views');

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
    { key: 'log_channel', label: 'Log Channel', type: 'toggle' },
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

export function setupAdminRoutes(app, deps) {
  const { requireAuth, requireGuildAuth, getUserGuilds, requireCsrf, client, pool, config } = deps;

  app.get('/admin/modules/:guildId/:module', requireAuth, requireGuildAuth, async (_req, res) => {
    const guildId = _req.params.guildId;
    const module = _req.params.module;
    const moduleSettings = getModuleSettings(module);
    if (!moduleSettings) return res.redirect(`/dashboard/${guildId}`);

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect(`/dashboard/${guildId}`);

    const settings = {};
    const rows = await pool.query('SELECT setting_key, setting_value FROM guild_settings WHERE guild_id = ?', [guildId]);
    for (const row of rows[0]) {
      settings[row.setting_key] = row.setting_value;
    }

    const roles = guild.roles.cache
      .filter((role) => !role.managed && role.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({ id: role.id, name: role.name }));
    const channels = guild.channels.cache
      .filter((channel) => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
      .sort((a, b) => a.position - b.position)
      .map((channel) => ({ id: channel.id, name: channel.name }));
    const categories = guild.channels.cache
      .filter((channel) => channel.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position)
      .map((channel) => ({ id: channel.id, name: channel.name }));

    return res.render(path.join(viewsDir, `modules/${module}.ejs`), {
      title: `EasySupport — ${MODULE_LABELS[module]}`,
      active: `module-${module}`,
      guildId,
      guildName: guild.name,
      botInGuild: true,
      settings,
      moduleFields: moduleSettings,
      moduleLabel: MODULE_LABELS[module],
      roles,
      channels,
      categories,
      user: _req.session.discordUser,
      guilds: getUserGuilds(_req),
      repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
      csrfToken: res.locals.csrfToken ?? '',
      siteCssVersion: '0',
      config,
    });
  });

  app.post('/admin/modules/:guildId/:module', requireAuth, requireGuildAuth, requireCsrf, async (_req, res) => {
    const guildId = _req.params.guildId;
    const module = _req.params.module;
    const moduleSettings = getModuleSettings(module);
    if (!moduleSettings) return res.redirect(`/dashboard/${guildId}`);

    const updates = {};
    for (const field of moduleSettings) {
      if (field.type === 'toggle') {
        updates[field.key] = _req.body[field.key] === 'true' ? 'true' : 'false';
      } else {
        updates[field.key] = _req.body[field.key] ?? '';
      }
    }

    await bulkUpdateGuildSettings(guildId, updates);
    return res.redirect(`/admin/modules/${guildId}/${module}?saved=1`);
  });

  app.get('/admin/:guildId/roles', requireAuth, requireGuildAuth, async (_req, res) => {
    const guildId = _req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect(`/dashboard/${guildId}`);

    const roles = guild.roles.cache
      .filter((role) => !role.managed && role.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
      }));

    const allPerms = await getAllRolePermissions(guildId);
    const permMap = new Map();
    for (const p of allPerms) {
      const key = `${p.role_id}:${p.command_name}`;
      permMap.set(key, Boolean(p.allowed));
    }

    const rolesWithPerms = roles.map((role) => {
      const perms = {};
      for (const cmd of COMMAND_NAMES) {
        perms[cmd] = permMap.get(`${role.id}:${cmd}`) ?? true;
      }
      return { ...role, perms };
    });

    return res.render(path.join(viewsDir, 'roles.ejs'), {
      title: 'EasySupport — Staff Roles',
      active: 'roles',
      guildId,
      guildName: guild.name,
      botInGuild: true,
      roles: rolesWithPerms,
      commands: COMMAND_NAMES,
      user: _req.session.discordUser,
      guilds: getUserGuilds(_req),
      repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
      csrfToken: res.locals.csrfToken ?? '',
      siteCssVersion: '0',
      config,
    });
  });

  app.get('/admin/:guildId/roles/:roleId', requireAuth, requireGuildAuth, async (_req, res) => {
    const guildId = _req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect(`/dashboard/${guildId}`);

    const role = guild.roles.cache.get(_req.params.roleId);
    if (!role || role.managed || role.id === guild.id) {
      return res.redirect(`/admin/${guildId}/roles`);
    }

    const perms = await getRolePermissions(guildId, _req.params.roleId);
    const permMap = {};
    for (const cmd of COMMAND_NAMES) {
      permMap[cmd] = perms.find((p) => p.command_name === cmd)?.allowed ?? true;
    }

    return res.render(path.join(viewsDir, 'role-detail.ejs'), {
      title: `EasySupport — ${role.name} Permissions`,
      active: 'roles',
      guildId,
      guildName: guild.name,
      botInGuild: true,
      role: { id: role.id, name: role.name, color: role.color },
      commands: COMMAND_NAMES,
      perms: permMap,
      user: _req.session.discordUser,
      guilds: getUserGuilds(_req),
      repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
      csrfToken: res.locals.csrfToken ?? '',
      siteCssVersion: '0',
      config,
    });
  });

  app.post('/admin/:guildId/roles/:roleId/toggle', requireAuth, requireGuildAuth, requireCsrf, async (_req, res) => {
    const guildId = _req.params.guildId;
    const { command_name: commandName, allowed } = _req.body;
    if (!commandName || !COMMAND_NAMES.includes(commandName)) {
      return res.redirect(`/admin/${guildId}/roles`);
    }

    const isAllowed = allowed === 'true' || allowed === true;
    await setRolePermission(guildId, _req.params.roleId, commandName, isAllowed);
    res.redirect(`/admin/${guildId}/roles/${_req.params.roleId}`);
  });
}

export default { setupAdminRoutes };
