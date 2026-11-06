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

function optional(name) {
  const value = process.env[name];
  if (!value || value.toLowerCase() === 'not needed') return null;
  return value;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  clientSecret: required('CLIENT_SECRET'),
  guildId: process.env.GUILD_ID ?? null,
  dbFile: process.env.DB_FILE ?? path.join(root, 'data', 'tickets.db'),
  transcriptDir: process.env.TRANSCRIPT_DIR ?? path.join(root, 'transcripts'),
  // MySQL storage (replaces SQLite). Required credentials; never commit values.
  mysqlHost: required('MYSQL_HOST'),
  mysqlPort: Number(process.env.MYSQL_PORT ?? '3306'),
  mysqlUser: required('MYSQL_USER'),
  mysqlPassword: required('MYSQL_PASSWORD'),
  mysqlDatabase: required('MYSQL_DATABASE'),
  // Website port (combined bot + web process)
  port: Number(process.env.PORT ?? '3000'),
  sessionSecret: process.env.SESSION_SECRET || 'easysupport-dev-secret-change-me',
  // Discord OAuth2 for multi-server dashboard
  oauthRedirectUri: required('OAUTH_REDIRECT_URI'),
  oauthScope: process.env.OAUTH_SCOPE ?? 'identify guilds',
  statusUrl: process.env.STATUS_URL ?? 'https://easyvstatus.wisp.uno',
  dataRetentionDays: Number(process.env.DATA_RETENTION_DAYS ?? '90'),
  // Impressum (legal notice) content, configurable via environment variable
  // HTML is supported. Required by European Law (Impressumspflicht).
  impressumContent: process.env.IMPRESSUM_CONTENT ?? '<strong>EasySupport</strong><br>Self-hosted Discord support ticket bot<br>Contact: imprint@example.com',
  impressumLinkText: process.env.IMPRESSUM_LINK_TEXT ?? 'Legal notice',
  privacyLinkText: process.env.PRIVACY_LINK_TEXT ?? 'Privacy policy',
  termsLinkText: process.env.TERMS_LINK_TEXT ?? 'Terms of service',
  // Impressum provider details (individual fields)
  impressumProviderName: optional('IMPRESSUM_PROVIDER_NAME') ?? 'EasySupport',
  impressumProviderAddress: optional('IMPRESSUM_PROVIDER_ADDRESS'),
  impressumProviderCity: optional('IMPRESSUM_PROVIDER_CITY'),
  impressumProviderCountry: optional('IMPRESSUM_PROVIDER_COUNTRY'),
  impressumProviderEmail: optional('IMPRESSUM_PROVIDER_EMAIL') ?? 'imprint@example.com',
  impressumProviderPhone: optional('IMPRESSUM_PROVIDER_PHONE'),
  impressumTradeRegister: optional('IMPRESSUM_TRADE_REGISTER'),
  impressumVatId: optional('IMPRESSUM_VAT_ID'),
};
