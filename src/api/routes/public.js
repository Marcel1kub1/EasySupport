import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const viewsDir = path.join(projectRoot, 'src', 'web', 'views');

export function setupPublicRoutes(app, deps) {
  const { repoUrl } = deps;

  app.get('/', async (_req, res) => {
    const body = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, 'index.ejs'), {
      title: 'EasySupport — Home',
      active: 'home',
      signedIn: Boolean(_req.session?.discordUser),
      repoUrl,
    }));
    const html = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, 'layout.ejs'), {
      ...{ title: 'EasySupport — Home', active: 'home', signedIn: Boolean(_req.session?.discordUser), repoUrl, csrfToken: res.locals.csrfToken ?? '' },
      body,
    }));
    return res.send(html);
  });

  app.get('/docs', async (_req, res) => {
    const body = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, 'docs.ejs'), {
      title: 'EasySupport — Documentation',
      active: 'docs',
      signedIn: Boolean(_req.session?.discordUser),
      repoUrl,
    }));
    const html = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, 'layout.ejs'), {
      ...{ title: 'EasySupport — Documentation', active: 'docs', signedIn: Boolean(_req.session?.discordUser), repoUrl, csrfToken: res.locals.csrfToken ?? '' },
      body,
    }));
    return res.send(html);
  });

  app.get('/status', (_req, res) => res.redirect(config.statusUrl));
}
