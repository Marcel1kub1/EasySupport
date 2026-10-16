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
  getGuildStats,
  getRecentClosures,
} from './db.js';
const __dirname = path.resolve();
const viewsDir = path.join(__dirname, 'src', 'views');

async function renderPage(res, template, pageLocals = {}) {
  const body = await ejs.renderFile(path.join(viewsDir, template), pageLocals);
  return res.render('layout', { ...pageLocals, body });
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
    const [status, announcements, stats] = await Promise.all([
      getSystemStatus(),
      getAnnouncements(),
      getGuildStats(),
    ]);
    const guildCount = stats.length;
    const totalTickets = stats.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const openTickets = stats.reduce((sum, s) => sum + Number(s.open || 0), 0);
    return renderPage(res, 'index', {
      title: 'EasySupport — Home',
      admin,
      repoUrl: 'https://github.com/Marcel1kub1/EasySupport',
      status,
      announcements,
      guildCount,
      totalTickets,
      openTickets,
    });
  });

  app.get('/status', async (req, res) => {
    const admin = isAuthed(req);
    const [status, announcements, stats, recent] = await Promise.all([
      getSystemStatus(),
      getAnnouncements(),
      getGuildStats(),
      getRecentClosures(),
    ]);
    return renderPage(res, 'status', {
      title: 'EasySupport — Status',
      admin,
      status,
      announcements,
      stats,
      recent,
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
      stats: [],
      recent: [],
      notFound: true,
    });
  });

  return app;
}

export default { createWebApp };

