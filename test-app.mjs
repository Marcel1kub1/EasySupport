import http from 'node:http';
import { createWebApp } from './src/web/index.js';
import { config } from './src/config.js';

const client = {
  isReady: () => false,
  guilds: { cache: new Map() },
  user: { tag: 'TestBot' },
};

const pool = {
  query: async () => [[], []],
  end: async () => {},
};

const app = await createWebApp(client, pool);

const server = app.listen(0);
const port = server.address().port;

const routes = ['/', '/docs', '/status', '/impressum', '/privacy', '/terms', '/cancel', '/healthz', '/login', '/logout', '/nonexistent'];

for (const path of routes) {
  try {
    const res = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }).on('error', reject);
    });
    const preview = res.body.substring(0, 150).replace(/\n/g, ' ');
    console.log(`${res.status} ${path} -> ${preview}`);
  } catch (err) {
    console.error(`ERROR on ${path}:`, err.message);
  }
}

server.close();