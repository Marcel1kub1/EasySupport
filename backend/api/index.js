import express from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../shared/config.js';
import { setupHealthRoutes } from './routes/health.js';
import { setupPublicRoutes } from './routes/public.js';
import { setupAuthRoutes } from './routes/auth.js';
import { setupDashboardRoutes } from './routes/dashboard.js';
import { setupAdminRoutes } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const viewsDir = path.join(projectRoot, 'frontend', 'views');
const publicDir = path.join(projectRoot, 'frontend', 'public');

const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const mutationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

function requireCsrf(req, res, next) {
  const providedToken = req.get('x-csrf-token') ?? req.body?._csrf;
  const expectedToken = req.session.csrfToken;
  if (
    typeof providedToken !== 'string' ||
    typeof expectedToken !== 'string' ||
    providedToken.length !== expectedToken.length ||
    !timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken))
  ) {
    return res.status(403).send('Invalid CSRF token.');
  }
  next();
}

export function createWebApp(client, pool) {
  const app = express();

  app.set('trust proxy', 1);
  app.set('views', viewsDir);
  app.set('view engine', 'ejs');

  app.use(express.static(publicDir));
  app.use('/assets', express.static(path.join(projectRoot, 'assets')));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(publicRateLimiter);

  app.use(
    session({
      name: 'es_session',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  app.use((req, res, next) => {
    req.session.csrfToken ??= randomBytes(32).toString('hex');
    res.locals.csrfToken = req.session.csrfToken ?? '';
    next();
  });

  app.use('/admin', adminRateLimiter);

  // Cookie consent middleware
  app.use((req, res, next) => {
    const cookieHeader = req.headers.cookie ?? '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => c.trim().split('=')).filter((pair) => pair.length === 2).map(([k, v]) => [k, decodeURIComponent(v)])
    );
    let consent = null;
    try {
      consent = cookies.es_cookie_consent ? JSON.parse(cookies.es_cookie_consent) : null;
    } catch {
      consent = null;
    }
    res.locals.cookieConsent = consent;
    res.locals.impressumLinkText = config.impressumLinkText;
    res.locals.privacyLinkText = config.privacyLinkText;
    res.locals.termsLinkText = config.termsLinkText;
    next();
  });

  // Cookie consent save endpoint
  app.post('/api/cookie-consent', express.json(), (req, res) => {
    const { necessary, analytics, marketing } = req.body ?? {};
    const consent = {
      necessary: Boolean(necessary),
      analytics: Boolean(analytics),
      marketing: Boolean(marketing),
      updatedAt: new Date().toISOString(),
    };
    res.cookie('es_cookie_consent', JSON.stringify(consent), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
    res.json({ ok: true, consent });
  });

  function isAuthed(req) {
    return Boolean(req.session?.discordUser);
  }

  function requireAuth(req, res, next) {
    if (!isAuthed(req)) return res.redirect('/login');
    next();
  }

  function getUserGuilds(req) {
    return req.session?.userGuilds ?? [];
  }

  function requireGuildAccess(req, res, next) {
    const guildId = req.params.guildId;
    if (!guildId) return res.redirect('/dashboard');

    const userGuilds = getUserGuilds(req);
    const manages = userGuilds.some(
      (g) => g.id === guildId && (g.owner || (g.permissions & 0x20) !== 0)
    );
    if (!manages) {
      return res.status(403).send('<h1>Forbidden</h1><p>You do not manage this server.</p><a href="/dashboard">Back to servers</a>');
    }
    next();
  }

  // Mount route groups
  setupHealthRoutes(app, client, pool);
  setupPublicRoutes(app, 'https://github.com/Marcel1kub1/EasySupport');
  setupAuthRoutes(app, config);
  setupDashboardRoutes(app, {
    requireAuth,
    requireGuildAuth: requireGuildAccess,
    getUserGuilds,
    client,
    pool,
    config,
  });
  setupAdminRoutes(app, {
    requireAuth,
    requireGuildAuth: requireGuildAccess,
    getUserGuilds,
    requireCsrf,
    client,
    pool,
    config,
  });

  app.use((req, res) => {
    res.status(404);
    return res.send('<h1>Not Found</h1><a href="/">Home</a>');
  });

  return app;
}

export default { createWebApp };
