import { createPool } from "mysql2/promise";
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname$1, "..");
function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}
const config = {
  token: required("DISCORD_TOKEN"),
  clientId: required("CLIENT_ID"),
  guildId: process.env.GUILD_ID ?? null,
  dbFile: process.env.DB_FILE ?? path.join(root, "data", "tickets.db"),
  transcriptDir: process.env.TRANSCRIPT_DIR ?? path.join(root, "transcripts"),
  // MySQL storage (replaces SQLite). Required credentials; never commit values.
  mysqlHost: required("MYSQL_HOST"),
  mysqlPort: Number(process.env.MYSQL_PORT ?? "3306"),
  mysqlUser: required("MYSQL_USER"),
  mysqlPassword: required("MYSQL_PASSWORD"),
  mysqlDatabase: required("MYSQL_DATABASE"),
  // Website admin credentials (env-only, never committed).
  adminUser: required("ADMIN_USER"),
  adminPassword: required("ADMIN_PASSWORD"),
  port: Number(process.env.PORT ?? "3000"),
  sessionSecret: process.env.SESSION_SECRET || "easysupport-dev-secret-change-me"
};
const capitalize = (key) => key.charAt(0).toUpperCase() + key.slice(1);
const CATEGORIES = {
  general: {
    label: "General support",
    emoji: "❓",
    description: "Anything that does not fit elsewhere",
    staffRole: "🛎️ Support Staff",
    questions: ["What do you need help with?", "When did the problem happen? (optional)"]
  },
  Suggest: {
    label: "Suggest",
    emoji: "💳",
    description: "Suggest an new feature, improvement or system",
    staffRole: "🏗️ Distributed Systems Architect and Development Team",
    questions: [
      "Feature, improvement or system you want to suggest",
      "What should it do?"
    ]
  },
  report: {
    label: "Report a user",
    emoji: "🚨",
    description: "Report rule-breaking behaviour",
    staffRole: "🖥️ Moderation Team",
    questions: ["Who are you reporting?", "What happened?"]
  },
  appeals: {
    label: "Ban appeal",
    emoji: "⚖️",
    description: "Appeal a ban or mute — reviewed by the moderation team",
    staffRole: "🖥️ Moderation Team",
    questions: [
      { label: "Your username or user ID", style: "short", required: true },
      "Why should the sanction be lifted?"
    ]
  }
};
const TICKET_STATUSES = {
  open: {
    label: "Waiting for staff",
    emoji: "🟡"
  },
  pending: {
    label: "Awaiting user reply",
    emoji: "🟠"
  },
  claimed: {
    label: "Claimed by",
    emoji: "🟢",
    claimable: true
  },
  escalated: {
    label: "Escalated to management",
    emoji: "🔺",
    staffRole: "꧁👑 Support Lead ꧂"
    // high-rank team: access + one ping on escalation
  },
  closed: {
    label: "Closed",
    emoji: "🔒",
    terminal: true
  }
};
Object.keys(TICKET_STATUSES).find((key) => TICKET_STATUSES[key].terminal) ?? "closed";
const QUESTION_OPTIONAL = /\s*\(optional\)\s*$/i;
function normalizeQuestion(question, index) {
  const base = { id: `q${index}`, label: `Question ${index + 1}`, style: "paragraph", required: true };
  if (typeof question === "string") {
    return {
      ...base,
      label: question.replace(QUESTION_OPTIONAL, "").slice(0, 80),
      required: !QUESTION_OPTIONAL.test(question)
    };
  }
  return { ...base, ...question, label: String(question.label ?? base.label).slice(0, 80) };
}
function normalizeEntry(key, entry, defaults) {
  const source = entry ?? {};
  const label = source.label ?? capitalize(key);
  const questions = (source.questions ?? source.intake ?? []).slice(0, 5).map(normalizeQuestion);
  return {
    key,
    label,
    emoji: source.emoji ?? null,
    description: source.description ?? label,
    staffRole: source.staffRole ?? source.staffRoleId ?? null,
    // name or ID
    staffRoleId: source.staffRoleId ?? null,
    // legacy raw ID escape hatch
    questions,
    claimable: source.claimable ?? defaults.claimable ?? false,
    staffOnly: source.staffOnly ?? true,
    terminal: source.terminal ?? false
  };
}
for (const [key, entry] of Object.entries(CATEGORIES)) {
  CATEGORIES[key] = normalizeEntry(key, entry, {});
}
for (const [key, entry] of Object.entries(TICKET_STATUSES)) {
  TICKET_STATUSES[key] = normalizeEntry(key, entry, {});
}
const pool = createPool({
  host: config.mysqlHost,
  port: config.mysqlPort,
  user: config.mysqlUser,
  password: config.mysqlPassword,
  database: config.mysqlDatabase,
  connectionLimit: 10
});
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}
const openStatuses = Object.entries(TICKET_STATUSES).filter(([, meta]) => !meta.terminal).map(([key]) => key);
`
SELECT COUNT(*) AS n FROM tickets
WHERE guild_id = ? AND user_id = ? AND status IN (${openStatuses.length ? openStatuses.map(() => "?").join(", ") : "'__none__'"})
`;
`
SELECT COUNT(*) AS n FROM tickets
WHERE guild_id = ? AND status IN (${openStatuses.length ? openStatuses.map(() => "?").join(", ") : "'__none__'"})
`;
async function getSystemStatus() {
  return get("SELECT * FROM system_status WHERE id = 1", []);
}
async function getAnnouncements() {
  return query("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 10");
}
const STATUS_ORDER = { operational: 0, maintenance: 1, degraded: 1, outage: 2 };
const STATUS_LABEL = {
  operational: "Operational",
  degraded: "Degraded Performance",
  outage: "Major Outage",
  maintenance: "Maintenance"
};
async function getComponentStatuses() {
  let dbStatus = "operational";
  try {
    await pool.query("SELECT 1");
  } catch {
    dbStatus = "outage";
  }
  return [
    {
      id: "gateway",
      name: "Gateway Shard 0",
      desc: "Discord gateway WebSocket",
      status: "operational",
      label: STATUS_LABEL.operational
    },
    {
      id: "lavalink",
      name: "Lavalink Audio Node",
      desc: "Voice & audio processing",
      status: "operational",
      label: STATUS_LABEL.operational
    },
    {
      id: "rest",
      name: "REST API Endpoint",
      desc: "REST API and HTTP endpoints",
      status: dbStatus,
      label: STATUS_LABEL[dbStatus] ?? STATUS_LABEL.operational
    }
  ];
}
async function load({ fetch }) {
  const [status, announcements, components] = await Promise.all([
    getSystemStatus(),
    getAnnouncements(),
    getComponentStatuses()
  ]);
  const order = STATUS_ORDER;
  let worst = "operational";
  for (const c of components) {
    if (order[c.status] > order[worst]) worst = c.status;
  }
  return {
    status,
    announcements,
    components,
    globalStatus: worst,
    globalLabel: STATUS_LABEL[worst] ?? STATUS_LABEL.operational
  };
}
export {
  load
};
