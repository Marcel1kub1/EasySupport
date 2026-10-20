import express from 'express';
import session from 'express-session';
import ejs from 'ejs';
import path from 'node:path';
import { config } from './config.js';
import {
  getSystemStatus,
  setSystemStatusWithAnnouncement,
  getAnnouncements,
  createAnnouncement,
  pool,
  getRolePermissions,
  getAllRolePermissions,
  setRolePermission,
  deleteRolePermission,
  getGuildSettings,
  bulkUpdateGuildSettings,
} from './db.js';

const __dirname = path.resolve();
const viewsDir = path.join(__dirname, 'src', 'views');

const templateDefaults = {
  active: '',
  message: undefined,
  error: null,
  repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
  admin: false,
  notFound: false,
  status: null,
  announcements: [],
  components: [],
  overallStatus: 'operational',
  overallLabel: 'All systems operational',
};

async function renderPage(res, view, locals = {}) {
  const pageLocals = { ...templateDefaults, ...locals };
  const body = await ejs.renderFile(path.join(viewsDir, `${view}.ejs`), pageLocals);
  const html = await ejs.renderFile(path.join(viewsDir, 'layout.ejs'), { ...pageLocals, body });
  return res.send(html);
}

const STATUS_ORDER = { operational: 0, degraded: 1, outage: 2 };
const STATUS_LABEL = {
  operational: 'Operational',
  degraded: 'Degraded Performance',
  outage: 'Major Outage',
  maintenance: 'Maintenance',
};

/** Hardcoded announcement templates an admin can post to the status page with one click. */
const HARDCODED_ANNOUNCEMENTS = [
  {
    key: 'operational',
    title: 'All systems operational',
    content: 'All systems operational. Gateway, database, and API endpoints are healthy.',
    type: 'info',
  },
  {
    key: 'maintenance',
    title: 'Scheduled maintenance',
    content: 'MySQL maintenance window tonight 02:00–04:00 UTC. Brief blips possible during failover.',
    type: 'warn',
  },
  {
    key: 'feature',
    title: 'New feature',
    content: 'High-rank DM module is now live. Use /setup to configure per-guild module toggles.',
    type: 'feature',
  },
  {
    key: 'outage',
    title: 'Major outage',
    content: 'We are experiencing issues with the Discord gateway. Some features may be delayed.',
    type: 'err',
  },
];

async function getComponentStatuses() {
  let dbStatus = 'operational';
  try {
    await pool.query('SELECT 1');
  } catch {
    dbStatus = 'outage';
  }

  return [
    { name: 'Gateway', desc: 'Discord gateway WebSocket', status: 'operational', label: STATUS_LABEL.operational },
    { name: 'Database', desc: 'MySQL storage', status: dbStatus, label: STATUS_LABEL[dbStatus] ?? STATUS_LABEL.operational },
    { name: 'API', desc: 'REST API and HTTP endpoints', status: 'operational', label: STATUS_LABEL.operational },
  ];
}

function overallStatus(components) {
  let worst = 'operational';
  for (const c of components) {
    if (STATUS_ORDER[c.status] > STATUS_ORDER[worst]) worst = c.status;
  }
  return worst;
}

export function createWebApp(client) {
  const app = express();

  app.set('views', viewsDir);
  app.set('view engine', 'ejs');

  app.use(express.static(path.join(__dirname, 'src', 'public')));
  app.use('/assets', express.static(path.join(__dirname, 'assets')));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.use(
    session({
      name: 'es_session',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 },
    })
  );

  /* ---------------------------------- auth ---------------------------------- */

  function isAuthed(req) {
    return Boolean(req.session.admin);
  }

  function requireAdmin(req, res, next) {
    if (!isAuthed(req)) return res.redirect('/admin/login');
    next();
  }

  /* ---------------------------------- routes -------------------------------- */

  app.get('/', async (req, res) => {
    const admin = isAuthed(req);
    const [status, announcements] = await Promise.all([
      getSystemStatus(),
      getAnnouncements(),
    ]);
    return renderPage(res, 'index', {
      title: 'EasySupport — Home',
      active: 'home',
      admin,
      repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
      status,
      announcements,
    });
  });

  app.get('/status', async (req, res) => {
    const admin = isAuthed(req);
    const [status, announcements, components] = await Promise.all([
      getSystemStatus(),
      getAnnouncements(),
      getComponentStatuses(),
    ]);
    const overall = overallStatus(components);
    return renderPage(res, 'status', {
      title: 'EasySupport — Status',
      active: 'status',
      admin,
      status,
      announcements,
      components,
      overallStatus: overall,
      overallLabel: STATUS_LABEL[overall],
    });
  });

  app.get('/admin/login', (req, res) => {
    if (isAuthed(req)) return res.redirect('/');
    return renderPage(res, 'login', { title: 'EasySupport — Admin Login', active: 'login', error: null });
  });

  app.post('/admin/login', (req, res) => {
    const { user, pass } = req.body;
    if (user === config.adminUser && pass === config.adminPassword) {
      req.session.admin = true;
      req.session.adminUser = user;
      return res.redirect('/');
    }
    return renderPage(res, 'login', { title: 'EasySupport — Admin Login', active: 'login', error: 'Invalid credentials.' });
  });

  app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('es_session');
      res.redirect('/');
    });
  });

  app.get('/admin', requireAdmin, async (req, res) => {
    const [status, announcements] = await Promise.all([
      getSystemStatus(),
      getAnnouncements(),
    ]);
    return renderPage(res, 'admin', {
      title: 'EasySupport — Admin',
      active: 'admin',
      status,
      announcements,
      hardcoded: HARDCODED_ANNOUNCEMENTS,
      statusUpdated: req.query.updated === 'status',
    });
  });

  app.post('/admin/status', requireAdmin, async (req, res) => {
    const statusText = typeof req.body.status_text === 'string' ? req.body.status_text.trim() : '';
    if (!statusText || statusText.length > 255) {
      return res.redirect('/admin');
    }
    await setSystemStatusWithAnnouncement(statusText, req.session.adminUser ?? 'admin');
    res.redirect('/admin?updated=status');
  });

  app.post('/admin/announce', requireAdmin, async (req, res) => {
    const { key } = req.body;
    if (key) {
      const template = HARDCODED_ANNOUNCEMENTS.find((announcement) => announcement.key === key);
      if (!template) return res.redirect('/admin');
      await createAnnouncement(template.title, template.content, req.session.adminUser ?? 'admin');
    } else {
      const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
      const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
      if (!title || title.length > 255 || !content) return res.redirect('/admin');
      await createAnnouncement(title, content, req.session.adminUser ?? 'admin');
    }
    res.redirect('/admin');
  });

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

  /* ---------------------------------- dashboard ---------------------------------- */

  app.get('/dashboard', requireAdmin, async (req, res) => {
    const guildId = resolveGuildId();
    if (!guildId) return res.redirect('/admin');

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect('/admin');

    return renderPage(res, 'dashboard', {
      title: 'EasySupport — Dashboard',
      active: 'dashboard',
      guildId,
      guildName: guild.name,
    });
  });

  app.get('/admin/modules/:module', requireAdmin, async (req, res) => {
    const guildId = resolveGuildId();
    if (!guildId) return res.redirect('/admin');

    const module = req.params.module;
    const moduleSettings = getModuleSettings(module);
    if (!moduleSettings) return res.redirect('/dashboard');

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect('/admin');

    const settings = await getGuildSettings(guildId);

    return renderPage(res, `modules/${module}`, {
      title: `EasySupport — ${MODULE_LABELS[module]}`,
      active: `module-${module}`,
      guildId,
      guildName: guild.name,
      settings,
      moduleFields: moduleSettings,
      moduleLabel: MODULE_LABELS[module],
    });
  });

  app.post('/admin/modules/:module', requireAdmin, async (req, res) => {
    const guildId = resolveGuildId();
    if (!guildId) return res.redirect('/admin');

    const module = req.params.module;
    const moduleSettings = getModuleSettings(module);
    if (!moduleSettings) return res.redirect('/dashboard');

    const updates = {};
    for (const field of moduleSettings) {
      if (field.type === 'toggle') {
        updates[field.key] = req.body[field.key] === 'true' ? 'true' : 'false';
      } else {
        updates[field.key] = req.body[field.key] ?? '';
      }
    }

    await bulkUpdateGuildSettings(guildId, updates);

    return res.redirect(`/admin/modules/${module}?saved=1`);
  });

  function resolveGuildId() {
    const guild = client.guilds.cache.first();
    return guild ? guild.id : null;
  }

  const COMMAND_NAMES = [
    'ticket',
    'highrankdm',
    'moderation',
    'anti_nuke',
    'automod',
    'leveling',
    'economy',
    'giveaways',
    'vouches',
    'welcome_goodbye_boost',
    'logging',
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

  app.get('/admin/roles', requireAdmin, async (req, res) => {
    const guildId = resolveGuildId();
    if (!guildId) {
      return res.redirect('/admin');
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.redirect('/admin');
    }

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

    return renderPage(res, 'roles', {
      title: 'EasySupport — Role Permissions',
      active: 'roles',
      guildId,
      guildName: guild.name,
      roles: rolesWithPerms,
      commands: COMMAND_NAMES,
    });
  });

  app.get('/admin/roles/:roleId', requireAdmin, async (req, res) => {
    const guildId = resolveGuildId();
    if (!guildId) {
      return res.redirect('/admin');
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.redirect('/admin');
    }

    const role = guild.roles.cache.get(req.params.roleId);
    if (!role || role.managed || role.id === guild.id) {
      return res.redirect('/admin/roles');
    }

    const perms = await getRolePermissions(guildId, req.params.roleId);
    const permMap = {};
    for (const cmd of COMMAND_NAMES) {
      permMap[cmd] = perms.find((p) => p.command_name === cmd)?.allowed ?? true;
    }

    return renderPage(res, 'role-detail', {
      title: `EasySupport — ${role.name} Permissions`,
      active: 'roles',
      guildId,
      guildName: guild.name,
      role: { id: role.id, name: role.name, color: role.color },
      commands: COMMAND_NAMES,
      perms: permMap,
    });
  });

  app.post('/admin/roles/:roleId/toggle', requireAdmin, async (req, res) => {
    const guildId = resolveGuildId();
    if (!guildId) {
      return res.redirect('/admin');
    }

    const { command_name: commandName, allowed } = req.body;
    if (!commandName || !COMMAND_NAMES.includes(commandName)) {
      return res.redirect('/admin/roles');
    }

    const isAllowed = allowed === 'true' || allowed === true;
    await setRolePermission(guildId, req.params.roleId, commandName, isAllowed);

    res.redirect(`/admin/roles/${req.params.roleId}`);
  });

  app.use((req, res) => {
    res.status(404);
    return renderPage(res, 'status', {
      title: 'EasySupport — Not Found',
      admin: isAuthed(req),
      status: null,
      announcements: [],
      components: [],
      overallStatus: 'outage',
      overallLabel: STATUS_LABEL.outage,
      notFound: true,
    });
  });

  return app;
}

export default { createWebApp };