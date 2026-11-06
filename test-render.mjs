import ejs from 'ejs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viewsDir = path.join(__dirname, 'src', 'web', 'views');

const repoUrl = 'https://github.com/Marcel1kub1/EasySupport';
const csrfToken = 'test-csrf';
const siteCssVersion = '0';
const modules = [
  { key: 'tickets', short: 'TK', title: 'Tickets', desc: 'Panels, staff access, transcripts and intake.', command: 'panel', search: 'setup highrankdm' },
  { key: 'moderation', short: 'MD', title: 'Moderation', desc: 'Staff tools, warnings and action logs.', command: 'moderation' },
  { key: 'logging', short: 'LG', title: 'Logging', desc: 'Choose the events and channels to record.', command: 'logging' },
];
const user = { id: '123', username: 'testuser', globalName: 'Test User', avatar: 'abc', discriminator: '0001' };
const guilds = [{ id: 'g1', name: 'Test Guild', icon: 'icon1', owner: true }];
const guildId = 'g1';
const guildName = 'Test Guild';
const botInGuild = true;
const latestRelease = { version: 'v1.0.0', title: 'Release 1', summary: 'First release', date: '2026-01-01', url: 'https://example.com', changes: { Added: ['Feature A'] }, commands: [], files: [] };
const releases = [latestRelease];
const config = { clientId: 'clientid', clientSecret: 'secret', oauthRedirectUri: 'http://localhost/auth/callback', oauthScope: 'identify guilds' };
const roles = [{ id: 'r1', name: 'Admin', color: 0xff0000, position: 10, perms: { ticket: true } }];
const channels = [{ id: 'c1', name: 'general' }];
const categories = [{ id: 'cat1', name: 'Category' }];
const commands = ['ticket', 'moderation'];
const settings = { panel_channel: 'c1' };
const moduleFields = [{ key: 'panel_channel', label: 'Panel Channel', type: 'channel' }];
const moduleLabel = 'Tickets';

const views = [
  { file: 'layout.ejs', data: { title: 'Test', active: 'home', body: '<p>body</p>', repoUrl, csrfToken, siteCssVersion, message: '', error: '', modules, signedIn: false } },
  { file: 'index.ejs', data: { title: 'Home', active: 'home', repoUrl, csrfToken, siteCssVersion, modules, signedIn: false } },
  { file: 'docs.ejs', data: { title: 'Docs', active: 'docs', repoUrl, csrfToken, siteCssVersion, modules, signedIn: false } },
  { file: 'dashboard.ejs', data: { title: 'Dashboard', active: 'dashboard', guilds, user, noGuilds: false, repoUrl, csrfToken, siteCssVersion, modules, releases, latestRelease, githubReleasesPage: 'https://example.com/releases', config, guildId, guildName, botInGuild, guildIcon: null, memberCount: 100, channelCount: 5, roleCount: 3, currentGuild: { id: guildId, name: guildName } } },
  { file: 'updates.ejs', data: { title: 'Updates', active: 'updates', guildId, guildName, guilds, user, botInGuild, releases, latestRelease, repoUrl, csrfToken, siteCssVersion, modules, config, githubReleasesPage: 'https://example.com/releases' } },
  { file: 'roles.ejs', data: { title: 'Roles', active: 'roles', guildId, guildName, botInGuild, roles, commands, user, guilds, repoUrl, csrfToken, siteCssVersion, modules, config } },
  { file: 'role-detail.ejs', data: { title: 'Role', active: 'roles', guildId, guildName, botInGuild, role: { id: 'r1', name: 'Admin', color: 0xff0000 }, commands, perms: { ticket: true }, user, guilds, repoUrl, csrfToken, siteCssVersion, modules, config } },
  { file: 'not-found.ejs', data: { title: 'Not Found', notFound: true, signedIn: false } },
  { file: 'impressum.ejs', data: { title: 'Impressum', active: 'impressum', repoUrl, csrfToken, siteCssVersion, modules, signedIn: false } },
  { file: 'privacy.ejs', data: { title: 'Privacy', active: 'privacy', repoUrl, csrfToken, siteCssVersion, modules, signedIn: false } },
  { file: 'terms.ejs', data: { title: 'Terms', active: 'terms', repoUrl, csrfToken, siteCssVersion, modules, signedIn: false } },
  { file: 'cancellation.ejs', data: { title: 'Cancellation', active: 'cancellation', repoUrl, csrfToken, siteCssVersion, modules, signedIn: false } },
];

const moduleViews = [
  { file: 'modules/tickets.ejs', data: { title: 'Tickets', active: 'module-tickets', guildId, guildName, botInGuild, settings, moduleFields, moduleLabel, roles, channels, categories, user, guilds, repoUrl, csrfToken, siteCssVersion, modules, config } },
  { file: 'modules/logging.ejs', data: { title: 'Logging', active: 'module-logging', guildId, guildName, botInGuild, settings, moduleFields, moduleLabel, roles, channels, categories, user, guilds, repoUrl, csrfToken, siteCssVersion, modules, config } },
  { file: 'modules/anti_nuke.ejs', data: { title: 'Anti-Nuke', active: 'module-anti_nuke', guildId, guildName, botInGuild, settings, moduleFields, moduleLabel, roles, channels, categories, user, guilds, repoUrl, csrfToken, siteCssVersion, modules, config } },
];

for (const v of [...views, ...moduleViews]) {
  try {
    const full = path.join(viewsDir, v.file);
    const html = await ejs.renderFile(full, v.data, { async: true, viewsDir });
    console.log(`OK: ${v.file}`);
  } catch (err) {
    console.error(`ERROR: ${v.file} -> ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
  }
}