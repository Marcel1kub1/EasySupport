import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const app = express();

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

/* ---------------------------------- API routes ---------------------------------- */

app.post('/api/admin/login', async (req, res) => {
  const { user, pass } = req.body;
  if (user === config.adminUser && pass === config.adminPassword) {
    req.session.admin = true;
    req.session.adminUser = user;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Invalid credentials.' });
});

app.get('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('es_session');
    res.json({ ok: true });
  });
});

/* ---------------------------------- SvelteKit handler ---------------------------------- */

let svelteHandler;
try {
  const mod = await import(path.join(root, 'build/handler.js'));
  svelteHandler = mod.handler;
} catch {
  svelteHandler = null;
}

app.use((req, res) => {
  if (svelteHandler) {
    svelteHandler(req, res);
  } else {
    res.status(503).type('text').send('SvelteKit build not found. Run `npm run build` first.');
  }
});

export function createWebApp() {
  return app;
}

export default { createWebApp };
