import express from 'express';
import session from 'express-session';
import ejs from 'ejs';
import path from 'node:path';
import { config } from './config.js';
import {
  getSystemStatus,
  setSystemStatus,
  getAnnouncements,
  createAnnouncement,
  pool,
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

export function createWebApp() {
  const app = express();

  app.set('views', viewsDir);
  app.set('view engine', 'ejs');

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
    });
  });

  app.post('/admin/status', requireAdmin, async (req, res) => {
    const { status_text } = req.body;
    if (!status_text || !status_text.trim()) {
      return res.redirect('/admin');
    }
    await setSystemStatus(status_text.trim());
    res.redirect('/admin');
  });

  app.post('/admin/announce', requireAdmin, async (req, res) => {
    const { key } = req.body;
    const template = HARDCODED_ANNOUNCEMENTS.find((t) => t.key === key);
    if (!template) return res.redirect('/admin');
    await createAnnouncement(template.title, template.content, req.session.adminUser ?? 'admin');
    res.redirect('/admin');
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