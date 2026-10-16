import express from 'express';
import session from 'express-session';
import ejs from 'ejs';
import path from 'node:path';
import os from 'node:os';
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
const startTime = Date.now();

async function renderPage(res, template, pageLocals = {}) {
  const active = pageLocals.active ?? '';
  const body = await ejs.renderFile(path.join(viewsDir, `${template}.ejs`), {
    ...pageLocals,
    active,
    message: pageLocals.message,
    repoUrl: pageLocals.repoUrl ?? 'https://github.com/Marcel1kub1/EasySupport',
  });
  return res.render('layout', { ...pageLocals, active, message: pageLocals.message, body });
}

async function getSystemMetrics() {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }
  return {
    uptime,
    uptimeFormatted: formatUptime(uptime),
    memoryUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    memoryTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    cpuCount: os.cpus().length,
    dbStatus,
    apiStatus: 'operational',
  };
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
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
      admin,
      repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
      status,
      announcements,
    });
  });

  app.get('/status', async (req, res) => {
    const admin = isAuthed(req);
    const [status, announcements, metrics] = await Promise.all([
      getSystemStatus(),
      getAnnouncements(),
      getSystemMetrics(),
    ]);
    return renderPage(res, 'status', {
      title: 'EasySupport — Status',
      admin,
      status,
      announcements,
      metrics,
    });
  });

  app.get('/admin/login', (req, res) => {
    if (isAuthed(req)) return res.redirect('/');
    return renderPage(res, 'login', { title: 'EasySupport — Admin Login', error: null });
  });

  app.post('/admin/login', (req, res) => {
    const { user, pass } = req.body;
    if (user === config.adminUser && pass === config.adminPassword) {
      req.session.admin = true;
      req.session.adminUser = user;
      return res.redirect('/');
    }
    return renderPage(res, 'login', { title: 'EasySupport — Admin Login', error: 'Invalid credentials.' });
  });

  app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('es_session');
      res.redirect('/');
    });
  });

  app.get('/admin', requireAdmin, (req, res) => {
    res.redirect('/');
  });

  app.post('/admin/status', requireAdmin, async (req, res) => {
    const { status_text } = req.body;
    if (!status_text || !status_text.trim()) {
      return res.redirect('/');
    }
    await setSystemStatus(status_text.trim());
    res.redirect('/');
  });

  app.post('/admin/announce', requireAdmin, async (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.redirect('/');
    }
    await createAnnouncement(title.trim(), content.trim(), req.session.adminUser ?? 'admin');
    res.redirect('/');
  });

  app.use((req, res) => {
    res.status(404);
    return renderPage(res, 'status', {
      title: 'EasySupport — Not Found',
      admin: isAuthed(req),
      status: null,
      announcements: [],
      metrics: null,
      notFound: true,
    });
  });

  return app;
}

export default { createWebApp };
