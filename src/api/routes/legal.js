import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const viewsDir = path.join(projectRoot, 'src', 'web', 'views');

export function setupRoutes(app, deps) {
  const { repoUrl } = deps;
  const layoutBase = { repoUrl, csrfToken: '', siteCssVersion: '0', message: '', error: '' };

  function renderLegalPage(viewName, title) {
    return async (_req, res) => {
      const body = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, viewName), {
        title: `EasySupport — ${title}`,
        active: viewName.replace('.ejs', ''),
        signedIn: false,
        repoUrl,
      }));
      const html = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, 'layout.ejs'), {
        ...layoutBase,
        title: `EasySupport — ${title}`,
        active: viewName.replace('.ejs', ''),
        body,
      }));
      return res.send(html);
    };
  }

  app.get('/impressum', renderLegalPage('impressum.ejs', 'Impressum'));
  app.get('/privacy', renderLegalPage('privacy.ejs', 'Data privacy'));
  app.get('/terms', renderLegalPage('terms.ejs', 'Terms of service'));
  app.get('/cancel', renderLegalPage('cancellation.ejs', 'Cancellation policy'));
}

export default { setupRoutes };