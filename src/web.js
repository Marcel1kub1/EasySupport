import express from 'express';
import session from 'express-session';
import ejs from 'ejs';
import { ChannelType } from 'discord.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import {
  getRolePermissions,
  getAllRolePermissions,
  setRolePermission,
  getGuildSettings,
  bulkUpdateGuildSettings,
} from './db.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewsDir = path.join(projectRoot, 'src', 'views');
const siteCssPath = path.join(projectRoot, 'src', 'public', 'site.css');
const siteCssVersion = createHash('sha256').update(readFileSync(siteCssPath)).digest('hex').slice(0, 12);
const releaseDataPath = path.join(projectRoot, 'src', 'data', 'releases.json');
const localReleaseFeed = JSON.parse(readFileSync(releaseDataPath, 'utf8'));
const githubReleasesUrl = 'https://api.github.com/repos/Marcel1kub1/EasySupport/releases?per_page=10';
const githubReleasesPage = 'https://github.com/Marcel1kub1/EasySupport/releases';
const releaseCacheDuration = 5 * 60 * 1000;
let releaseCache = Array.isArray(localReleaseFeed.releases) ? localReleaseFeed.releases : [];
let releaseCacheUpdatedAt = 0;
let releaseRefreshPromise;
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

function isReleaseEntry(release) {
  return (
    release &&
    typeof release.version === 'string' &&
    typeof release.title === 'string' &&
    typeof release.date === 'string' &&
    typeof release.summary === 'string' &&
    release.changes &&
    typeof release.changes === 'object' &&
    !Array.isArray(release.changes) &&
    Object.values(release.changes).every(Array.isArray) &&
    Array.isArray(release.commands) &&
    release.commands.every((command) => typeof command.name === 'string' && typeof command.description === 'string') &&
    Array.isArray(release.files) &&
    release.files.every((file) => typeof file === 'string')
  );
}

if (!Array.isArray(localReleaseFeed.releases) || !localReleaseFeed.releases.every(isReleaseEntry)) {
  throw new Error(`Invalid local release feed at ${releaseDataPath}`);
}

function releaseChanges(body) {
  const changes = {};
  let category = 'Release notes';

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      category = heading[1].replaceAll('**', '').replaceAll('`', '');
      continue;
    }

    const entry = line
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replaceAll('**', '')
      .replaceAll('`', '');
    changes[category] ??= [];
    changes[category].push(entry);
  }

  return changes;
}

function mapGitHubRelease(release) {
  if (
    !release ||
    typeof release.tag_name !== 'string' ||
    typeof release.html_url !== 'string' ||
    typeof release.published_at !== 'string' ||
    release.draft ||
    release.prerelease
  ) {
    return null;
  }

  const body = typeof release.body === 'string' ? release.body : '';
  const bodyLines = body.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const summaryLine = bodyLines.find((line) => !/^#{1,6}\s|^[-*+]\s|^\d+\.\s/.test(line));
  const summary = (summaryLine ?? bodyLines[0] ?? release.name ?? release.tag_name)
    .replace(/^[-*+]\s+/, '')
    .replaceAll('**', '')
    .replaceAll('`', '');

  return {
    version: release.tag_name,
    title: release.name?.trim() || `EasySupport ${release.tag_name}`,
    date: release.published_at.slice(0, 10),
    summary: summary.length > 240 ? `${summary.slice(0, 237)}...` : summary,
    changes: releaseChanges(body),
    commands: [],
    files: [],
    url: release.html_url,
  };
}

export async function getReleaseFeed() {
  if (Date.now() - releaseCacheUpdatedAt < releaseCacheDuration) return releaseCache;
  if (releaseRefreshPromise) return releaseRefreshPromise;

  releaseRefreshPromise = (async () => {
    try {
      const response = await fetch(githubReleasesUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'EasySupport-Guild-Dashboard',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`GitHub Releases API returned HTTP ${response.status}`);

      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('GitHub Releases API returned an invalid release list');

      releaseCache = payload.map(mapGitHubRelease).filter(Boolean);
      releaseCacheUpdatedAt = Date.now();
    } catch (error) {
      console.error('[releases] Could not refresh GitHub releases; using the last available feed:', error);
      releaseCacheUpdatedAt = Date.now();
    } finally {
      releaseRefreshPromise = undefined;
    }

    return releaseCache;
  })();

  return releaseRefreshPromise;
}

const templateDefaults = {
  active: '',
  message: undefined,
  error: null,
  repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
  signedIn: false,
  notFound: false,
  guilds: [],
  guildId: null,
  guildName: null,
  user: null,
  noGuilds: false,
  botInGuild: false,
  guildIcon: null,
  memberCount: null,
  channelCount: 0,
  roleCount: 0,
  modules,
  releases: [],
  latestRelease: null,
  githubReleasesPage,
  siteCssVersion,
  config,
};

async function renderPage(res, view, locals = {}) {
  const pageLocals = { ...templateDefaults, ...locals };
  const body = await ejs.renderFile(path.join(viewsDir, `${view}.ejs`), pageLocals);
  const html = await ejs.renderFile(path.join(viewsDir, 'layout.ejs'), { ...pageLocals, body });
  return res.send(html);
}

export function createWebApp(client) {
  const app = express();

  app.set('views', viewsDir);
  app.set('view engine', 'ejs');

  app.use(express.static(path.join(projectRoot, 'src', 'public')));
  app.use('/vendor/gsap', express.static(path.join(projectRoot, 'node_modules', 'gsap', 'dist'), { index: false }));
  app.use('/assets', express.static(path.join(projectRoot, 'assets')));
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

  /* ---------------------------------- auth (Discord OAuth2) ---------------------------------- */

  function isAuthed(req) {
    return Boolean(req.session.discordUser);
  }

  function requireAuth(req, res, next) {
    if (!isAuthed(req)) return res.redirect('/login');
    next();
  }

  /** Returns the guilds the current user manages (from session). */
  function getUserGuilds(req) {
    return req.session.userGuilds ?? [];
  }

  /** Middleware: ensure the user manages the guild in :guildId. */
  function requireGuildAccess(req, res, next) {
    const guildId = req.params.guildId;
    if (!guildId) return res.redirect('/dashboard');

    const userGuilds = getUserGuilds(req);
    const manages = userGuilds.some(
      (g) => g.id === guildId && (g.owner || (g.permissions & 0x20) !== 0) // Manage Guild permission = 0x20
    );
    if (!manages) {
      return res.status(403).send('<h1>Forbidden</h1><p>You do not manage this server.</p><a href="/dashboard">Back to servers</a>');
    }
    next();
  }

  /* ---------------------------------- routes -------------------------------- */

  app.get('/', async (req, res) => {
    return renderPage(res, 'index', {
      title: 'EasySupport — Home',
      active: 'home',
      signedIn: isAuthed(req),
      repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
    });
  });

  app.get('/status', (req, res) => res.redirect('/'));

  app.get('/login', (req, res) => {
    if (isAuthed(req)) return res.redirect('/dashboard');
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.oauthRedirectUri,
      response_type: 'code',
      scope: config.oauthScope,
      prompt: 'consent',
    });
    return res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login?error=missing_code');

    try {
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.oauthRedirectUri,
        }),
      });
      if (!tokenResponse.ok) throw new Error('Token exchange failed');
      const tokenData = await tokenResponse.json();

      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
      });
      if (!userResponse.ok) throw new Error('Failed to fetch user');
      const user = await userResponse.json();

      const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
      });
      const guilds = guildsResponse.ok ? (await guildsResponse.json()) : [];

      // Only keep guilds the user manages (owner or Manage Guild permission)
      const managedGuilds = guilds.filter(
        (g) => g.owner || (g.permissions & 0x20) !== 0
      );

      req.session.discordUser = {
        id: user.id,
        username: user.username,
        globalName: user.global_name ?? user.username,
        avatar: user.avatar,
        discriminator: user.discriminator,
      };
      req.session.userGuilds = managedGuilds;
      req.session.accessToken = tokenData.access_token;

      return res.redirect('/dashboard');
    } catch (error) {
      console.error('[oauth] Callback error:', error);
      return res.redirect('/login?error=callback_failed');
    }
  });

  app.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('es_session');
      res.redirect('/');
    });
  });

  /* ---------------------------------- dashboard (guild-scoped) ---------------------------------- */

  app.get('/dashboard', requireAuth, async (req, res) => {
    const guilds = getUserGuilds(req);
    if (guilds.length === 0) {
      return renderPage(res, 'dashboard', {
        title: 'EasySupport — Dashboard',
        active: 'dashboard',
        guilds: [],
        user: req.session.discordUser,
        noGuilds: true,
      });
    }
    // Redirect to the first managed guild's dashboard
    return res.redirect(`/dashboard/${guilds[0].id}`);
  });

  app.get('/dashboard/:guildId/updates', requireAuth, requireGuildAccess, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect(`/dashboard/${guildId}`);
    const releases = await getReleaseFeed();

    return renderPage(res, 'updates', {
      title: 'EasySupport — What’s new',
      active: 'updates',
      guildId,
      guildName: guild.name,
      guilds: getUserGuilds(req),
      user: req.session.discordUser,
      botInGuild: true,
      releases,
      latestRelease: releases[0] ?? null,
    });
  });

  app.get('/dashboard/:guildId', requireAuth, requireGuildAccess, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    const releases = await getReleaseFeed();
    const guilds = getUserGuilds(req);
    const currentGuild = guilds.find((g) => g.id === guildId) ?? { id: guildId, name: guild?.name ?? 'Unknown Server' };
    const roles = guild?.roles.cache
      .filter((role) => !role.managed && role.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({ id: role.id, name: role.name })) ?? [];

    return renderPage(res, 'dashboard', {
      title: `EasySupport — ${currentGuild.name}`,
      active: 'dashboard',
      guildId,
      guildName: currentGuild.name,
      guilds,
      user: req.session.discordUser,
      currentGuild,
      botInGuild: Boolean(guild),
      guildIcon: guild?.iconURL({ size: 128 }) ?? (currentGuild.icon ? `https://cdn.discordapp.com/icons/${guildId}/${currentGuild.icon}.png?size=128` : null),
      memberCount: guild?.memberCount ?? null,
      channelCount: guild?.channels.cache.filter((channel) => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement).size ?? 0,
      roleCount: roles.length,
      releases,
      latestRelease: releases[0] ?? null,
    });
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

  /* ---------------------------------- dashboard (guild-scoped) ---------------------------------- */

  app.get('/admin/modules/:guildId/:module', requireAuth, requireGuildAccess, async (req, res) => {
    const guildId = req.params.guildId;
    const module = req.params.module;
    const moduleSettings = getModuleSettings(module);
    if (!moduleSettings) return res.redirect(`/dashboard/${guildId}`);

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect(`/dashboard/${guildId}`);

    const settings = await getGuildSettings(guildId);
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

    return renderPage(res, `modules/${module}`, {
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
      user: req.session.discordUser,
      guilds: getUserGuilds(req),
    });
  });

  app.post('/admin/modules/:guildId/:module', requireAuth, requireGuildAccess, async (req, res) => {
    const guildId = req.params.guildId;
    const module = req.params.module;
    const moduleSettings = getModuleSettings(module);
    if (!moduleSettings) return res.redirect(`/dashboard/${guildId}`);

    const updates = {};
    for (const field of moduleSettings) {
      if (field.type === 'toggle') {
        updates[field.key] = req.body[field.key] === 'true' ? 'true' : 'false';
      } else {
        updates[field.key] = req.body[field.key] ?? '';
      }
    }

    await bulkUpdateGuildSettings(guildId, updates);

    return res.redirect(`/admin/modules/${guildId}/${module}?saved=1`);
  });

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

  app.get('/admin/:guildId/roles', requireAuth, requireGuildAccess, async (req, res) => {
    const guildId = req.params.guildId;
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

    return renderPage(res, 'roles', {
      title: 'EasySupport — Staff Roles',
      active: 'roles',
      guildId,
      guildName: guild.name,
      botInGuild: true,
      roles: rolesWithPerms,
      commands: COMMAND_NAMES,
      user: req.session.discordUser,
      guilds: getUserGuilds(req),
    });
  });

  app.get('/admin/:guildId/roles/:roleId', requireAuth, requireGuildAccess, async (req, res) => {
    const guildId = req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect(`/dashboard/${guildId}`);

    const role = guild.roles.cache.get(req.params.roleId);
    if (!role || role.managed || role.id === guild.id) {
      return res.redirect(`/admin/${guildId}/roles`);
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
      botInGuild: true,
      role: { id: role.id, name: role.name, color: role.color },
      commands: COMMAND_NAMES,
      perms: permMap,
      user: req.session.discordUser,
      guilds: getUserGuilds(req),
    });
  });

  app.post('/admin/:guildId/roles/:roleId/toggle', requireAuth, requireGuildAccess, async (req, res) => {
    const guildId = req.params.guildId;
    const { command_name: commandName, allowed } = req.body;
    if (!commandName || !COMMAND_NAMES.includes(commandName)) {
      return res.redirect(`/admin/${guildId}/roles`);
    }

    const isAllowed = allowed === 'true' || allowed === true;
    await setRolePermission(guildId, req.params.roleId, commandName, isAllowed);

    res.redirect(`/admin/${guildId}/roles/${req.params.roleId}`);
  });

  app.use((req, res) => {
    res.status(404);
    return renderPage(res, 'not-found', {
      title: 'EasySupport — Not Found',
      notFound: true,
      signedIn: isAuthed(req),
    });
  });

  return app;
}

export default { createWebApp };