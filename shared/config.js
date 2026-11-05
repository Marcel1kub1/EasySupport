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
  clientSecret: required('CLIENT_SECRET'),
  guildId: process.env.GUILD_ID ?? null,
  dbFile: process.env.DB_FILE ?? path.join(root, 'data', 'tickets.db'),
  transcriptDir: process.env.TRANSCRIPT_DIR ?? path.join(root, 'transcripts'),
  mysqlHost: required('MYSQL_HOST'),
  mysqlPort: Number(process.env.MYSQL_PORT ?? '3306'),
  mysqlUser: required('MYSQL_USER'),
  mysqlPassword: required('MYSQL_PASSWORD'),
  mysqlDatabase: required('MYSQL_DATABASE'),
  port: Number(process.env.PORT ?? '3000'),
  sessionSecret: process.env.SESSION_SECRET || 'easysupport-dev-secret-change-me',
  oauthRedirectUri: required('OAUTH_REDIRECT_URI'),
  oauthScope: process.env.OAUTH_SCOPE ?? 'identify guilds',
  statusUrl: process.env.STATUS_URL ?? 'https://easyvstatus.wisp.uno',
  impressumContent: process.env.IMPRESSUM_CONTENT ?? '<strong>EasySupport</strong><br>Self-hosted Discord support bot<br>Contact: imprint@example.com',
  impressumLinkText: process.env.IMPRESSUM_LINK_TEXT ?? 'Impressum',
  privacyLinkText: process.env.PRIVACY_LINK_TEXT ?? 'Datenschutz',
  termsLinkText: process.env.TERMS_LINK_TEXT ?? 'AGB',
  impressumProviderName: process.env.IMPRESSUM_PROVIDER_NAME ?? 'EasySupport',
  impressumProviderAddress: process.env.IMPRESSUM_PROVIDER_ADDRESS ?? '',
  impressumProviderEmail: process.env.IMPRESSUM_PROVIDER_EMAIL ?? 'imprint@example.com',
  impressumProviderPhone: process.env.IMPRESSUM_PROVIDER_PHONE ?? '',
  impressumTradeRegister: process.env.IMPRESSUM_TRADE_REGISTER ?? '',
  impressumVatId: process.env.IMPRESSUM_VAT_ID ?? '',
};
