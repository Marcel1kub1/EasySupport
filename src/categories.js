/*
 * ============================================================================
 * TICKET BOT — MAIN CONFIGURATION
 * ----------------------------------------------------------------------------
 * This is the ONLY file you need to edit. Categories, statuses and role pings
 * are all defined here and picked up automatically at runtime.
 *
 * Quick rules:
 *  - Every field is optional; sensible defaults are filled in.
 *  - Roles are given by NAME ('Support Team') or by ID ('123456789012345678').
 *    An unknown role is skipped with a console warning — nothing breaks.
 *  - Questions can be plain strings; append " (optional)" to make one optional.
 * ============================================================================
 */

const capitalize = (key) => key.charAt(0).toUpperCase() + key.slice(1);

/* ============================== TICKET CATEGORIES ==========================
 * One button per category is rendered on the /panel message.
 *
 *   label        - button text and ticket heading        (default: the key)
 *   emoji        - Unicode emoji on the button           (default: none)
 *   description  - help text on the panel                (default: label)
 *   staffRole    - team pinged + granted access when a ticket of this
 *                  category opens                        (default: nobody)
 *   questions    - intake questions asked in a popup before the channel is
 *                  created (max 5). Strings are required paragraph questions,
 *                  objects give full control:
 *                  { label: 'Order ID', style: 'short', required: false }
 */
export const CATEGORIES = {
  general: {
    label: 'General support',
    emoji: '❓',
    description: 'Anything that does not fit elsewhere',
    staffRole: '🛎️ Support Staff',
    questions: ['What do you need help with?', 'When did the problem happen? (optional)'],
  },

  Suggest: {
    label: 'Suggest',
    emoji: '💳',
    description: 'Suggest an new feature, improvement or system',
    staffRole: '🏗️ Distributed Systems Architect and Development Team',
    questions: [
      'Feature, improvement or system you want to suggest',
      'What should it do?',
    ],
  },

  report: {
    label: 'Report a user',
    emoji: '🚨',
    description: 'Report rule-breaking behaviour',
    staffRole: '🖥️ Moderation Team',
    questions: ['Who are you reporting?', 'What happened?'],
  },

  appeals: {
    label: 'Ban appeal',
    emoji: '⚖️',
    description: 'Appeal a ban or mute — reviewed by the moderation team',
    staffRole: '🖥️ Moderation Team',
    questions: [
      { label: 'Your username or user ID', style: 'short', required: true },
      'Why should the sanction be lifted?',
    ],
  },
};

/* =============================== TICKET STATUSES ===========================
 * One entry per status. Each one automatically becomes a button on the ticket
 * panel — no code changes needed anywhere else.
 *
 *   label        - text in the embed, on the button and in logs (default: key)
 *   emoji        - Unicode emoji next to the label           (default: none)
 *   staffRole    - team granted access + pinged once when the ticket enters
 *                  this status (e.g. a high-rank role for escalations)
 *   claimable    - record which staff member set the status (default: false)
 *   staffOnly    - only staff may press the button           (default: true;
 *                  set false to let members use it)
 *   terminal     - final status: close protocol runs — confirmation, reason,
 *                  transcript + rating DM, channel deletion    (default: false)
 *
 * Tickets count against the per-user limit in EVERY non-terminal status.
 */
export const TICKET_STATUSES = {
  open: {
    label: 'Waiting for staff',
    emoji: '🟡',
  },

  pending: {
    label: 'Awaiting user reply',
    emoji: '🟠',
  },

  claimed: {
    label: 'Claimed by',
    emoji: '🟢',
    claimable: true,
  },

  escalated: {
    label: 'Escalated to management',
    emoji: '🔺',
    staffRole: '꧁👑 Support Lead ꧂', // high-rank team: access + one ping on escalation
  },

  closed: {
    label: 'Closed',
    emoji: '🔒',
    terminal: true,
  },
};

/* ================================== SETTINGS ===============================
 * Status every new ticket starts in and the status that ends it.
 */
export const DEFAULT_STATUS = 'open';
export const TERMINAL_STATUS =
  Object.keys(TICKET_STATUSES).find((key) => TICKET_STATUSES[key].terminal) ?? 'closed';

/* ============================ do not edit below ============================
 * The normalizers fill in defaults so the config above can stay minimal.
 * Legacy field names (intake, staffRoleId) are still accepted.
 */

const QUESTION_OPTIONAL = /\s*\(optional\)\s*$/i;

function normalizeQuestion(question, index) {
  const base = { id: `q${index}`, label: `Question ${index + 1}`, style: 'paragraph', required: true };

  if (typeof question === 'string') {
    return {
      ...base,
      label: question.replace(QUESTION_OPTIONAL, '').slice(0, 80),
      required: !QUESTION_OPTIONAL.test(question),
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
    staffRole: source.staffRole ?? source.staffRoleId ?? null, // name or ID
    staffRoleId: source.staffRoleId ?? null, // legacy raw ID escape hatch
    questions,
    claimable: source.claimable ?? defaults.claimable ?? false,
    staffOnly: source.staffOnly ?? true,
    terminal: source.terminal ?? false,
  };
}

for (const [key, entry] of Object.entries(CATEGORIES)) {
  CATEGORIES[key] = normalizeEntry(key, entry, {});
}
for (const [key, entry] of Object.entries(TICKET_STATUSES)) {
  TICKET_STATUSES[key] = normalizeEntry(key, entry, {});
}

/**
 * Returns a normalized category/status entry, or null for unknown keys.
 * Works for both CATEGORIES and TICKET_STATUSES.
 */
export function getStatusMeta(key) {
  return TICKET_STATUSES[key] ?? null;
}

/**
 * Resolves a configured role (name or numeric ID) to a guild role.
 * Returns null when the role does not exist — callers warn and skip.
 */
export function resolveStaffRole(guild, value) {
  if (!value) return null;
  if (/^\d{16,20}$/.test(String(value))) {
    return guild.roles.cache.get(String(value)) ?? null;
  }
  const name = String(value).toLowerCase();
  return guild.roles.cache.find((role) => role?.name?.toLowerCase() === name) ?? null;
}
