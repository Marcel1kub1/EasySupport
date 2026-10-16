import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  guildId: process.env.GUILD_ID ?? null,
  dbFile: process.env.DB_FILE ?? path.join(root, 'data', 'tickets.db'),
  transcriptDir: process.env.TRANSCRIPT_DIR ?? path.join(root, 'transcripts'),
  // MySQL storage (replaces SQLite). Required credentials; never commit values.
  mysqlHost: required('MYSQL_HOST'),
  mysqlPort: Number(process.env.MYSQL_PORT ?? '3306'),
  mysqlUser: required('MYSQL_USER'),
  mysqlPassword: required('MYSQL_PASSWORD'),
  mysqlDatabase: required('MYSQL_DATABASE'),
  // Website admin credentials (env-only, never committed).
  adminUser: required('ADMIN_USER'),
  adminPassword: required('ADMIN_PASSWORD'),
  port: Number(process.env.PORT ?? '3000'),
  sessionSecret: process.env.SESSION_SECRET || 'easysupport-dev-secret-change-me',
};
