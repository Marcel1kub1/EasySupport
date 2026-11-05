import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../shared/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const viewsDir = path.join(projectRoot, 'frontend', 'views');

function renderLawPage(view, title, active, locals = {}) {
  return async (_req, res) => {
    const body = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, view), {
      title,
      active,
      signedIn: Boolean(_req.session?.discordUser),
      repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
      ...locals,
    }));
    const html = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, 'layout.ejs'), {
      ...{ title, active, signedIn: Boolean(_req.session?.discordUser), repoUrl: 'https://github.com/Marcel1kub1/EasySupport', csrfToken: res.locals.csrfToken ?? '' },
      body,
    }));
    return res.send(html);
  };
}

export function setupPublicRoutes(app, repoUrl) {
  app.get('/', async (_req, res) => {
    const body = await import('ejs').then((e) => e.renderFile(path.join(viewsDir, 'index.ejs'), {
      title: 'EasySupport — Home',
      active: 'home',
      signedIn: Boolean(_req.session?.discordUser),
      repoUrl,
      impressumLinkText: config.impressumLinkText,
      privacyLinkText: config.privacyLinkText,
      termsLinkText: config.termsLinkText,
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

  app.get('/terms', renderLawPage('terms.ejs', 'EasySupport — Terms of Service', 'terms'));

  app.get('/privacy', renderLawPage('privacy.ejs', 'EasySupport — Data Privacy', 'privacy'));

  app.get('/impressum', renderLawPage('impressum.ejs', 'EasySupport — Impressum', 'impressum', {
    impressumContent: config.impressumContent,
    providerName: config.impressumProviderName,
    providerAddress: config.impressumProviderAddress,
    providerEmail: config.impressumProviderEmail,
    providerPhone: config.impressumProviderPhone,
    tradeRegister: config.impressumTradeRegister,
    vatId: config.impressumVatId,
  }));
}
