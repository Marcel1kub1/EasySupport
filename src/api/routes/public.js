import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const viewsDir = path.join(projectRoot, 'src', 'web', 'views');

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

export function setupRoutes(app, deps) {
  const { repoUrl, config: configDep } = deps;
  const cfg = configDep ?? config;
  const siteCssVersion = '0';
  const layoutBase = { repoUrl, csrfToken: '', siteCssVersion, message: '', error: '' };

  function renderWithLayout(res, viewName, title, active, extra = {}) {
    return async (_req, res) => {
      const body = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, viewName), {
        title: `EasySupport — ${title}`,
        active,
        signedIn: false,
        repoUrl,
        modules,
        ...extra,
      }));
      const html = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, 'layout.ejs'), {
        ...layoutBase,
        title: `EasySupport — ${title}`,
        active,
        body,
        ...extra,
      }));
      return res.send(html);
    };
  }

  app.get('/', renderWithLayout(app, 'index.ejs', 'Home', 'home'));
  app.get('/docs', renderWithLayout(app, 'docs.ejs', 'Documentation', 'docs'));
  app.get('/status', (_req, res) => res.redirect(cfg.statusUrl));
}

export default { setupRoutes };
