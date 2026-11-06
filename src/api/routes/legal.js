import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const viewsDir = path.join(projectRoot, 'src', 'web', 'views');

export function setupRoutes(app, deps) {
  const { repoUrl } = deps;

  function renderLegalPage(res, viewName, title) {
    return async (_req, res) => {
      const body = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, viewName), {
        title: `EasySupport — ${title}`,
        active: viewName.replace('.ejs', ''),
        signedIn: false,
        repoUrl,
      }));
      const html = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, 'layout.ejs'), {
        ...{ title: `EasySupport — ${title}`, active: viewName.replace('.ejs', ''), signedIn: false, repoUrl, csrfToken: '' },
        body,
      }));
      return res.send(html);
    };
  }

  app.get('/impressum', renderLegalPage(app, 'impressum.ejs', 'Impressum'));
  app.get('/privacy', renderLegalPage(app, 'privacy.ejs', 'Data privacy'));
  app.get('/terms', renderLegalPage(app, 'terms.ejs', 'Terms of service'));
  app.get('/cancel', renderLegalPage(app, 'cancellation.ejs', 'Cancellation policy'));
}

export default { setupRoutes };