/*
 * The Taco Empire panel: ONE command (/taco) that opens an interactive board.
 * Every economy action is a button inside the panel — no command sprawl.
 *
 * Router contract
 *   views/*.js   export { render(ctx), } where ctx = { guildId, userId, args, state }
 *   buttons      customId 'taco:<action>:<...>'  (never collides with 'ticket:*')
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { economy } from './instance.js';
import { renderView } from './views/index.js';

export const PANEL_PREFIX = 'taco:';

/** Modal customIds the panel opens (franchise naming, gifting). */
const PANEL_MODALS = new Set(['franchise-name', 'gift-modal']);


/** Routes a `taco:*` button customId. Returns the updated message payload. */
export async function handlePanelInteraction(interaction) {
  const parts = interaction.customId.slice(PANEL_PREFIX.length).split(':');
  return renderView(parts[0], {
    guildId: interaction.guildId,
    userId: interaction.user.id,
    args: parts.slice(1),
    interaction,
  });
}

/** Routes `taco:*` modal submits back into the owning view. */
export async function handlePanelModal(interaction) {
  const modal = interaction.customId.slice(PANEL_PREFIX.length);
  if (modal === 'franchise-name') {
    const name = interaction.fields.getTextInputValue('name');
    return renderView('crewcreate', {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      args: name.split(' '),
      interaction,
    });
  }
  if (modal === 'gift-modal') {
    const member = interaction.fields.getTextInputValue('member').trim();
    const amount = Number(interaction.fields.getTextInputValue('amount').trim()) || 0;
    return renderView('me', {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      args: [],
      interaction,
      modal: { gift: { member, amount } },
    });
  }
  return renderView('home', { guildId: interaction.guildId, userId: interaction.user.id, args: [] });
}

export { economy };

/* ------------------------------------------------------------------------- */
/* Panel plumbing shared by every view                                       */
/* ------------------------------------------------------------------------- */

const NAV_ITEMS = [
  ['home', '🏠 Shack', ButtonStyle.Secondary],
  ['shop', '🛒 Shop', ButtonStyle.Secondary],
  ['menu', '🌮 Menu', ButtonStyle.Secondary],
  ['staff', '🧑‍🍳 Staff', ButtonStyle.Secondary],
  ['empire', '🏢 Empire', ButtonStyle.Secondary],
  ['market', '📈 Sauce Market', ButtonStyle.Secondary],
  ['kitchen', '🍳 Kitchen', ButtonStyle.Secondary],
  ['crew', '🤝 Crew', ButtonStyle.Secondary],
  ['games', '🎲 Games', ButtonStyle.Secondary],
  ['quests', '📋 Quests', ButtonStyle.Secondary],
  ['board', '🏆 Board', ButtonStyle.Secondary],
  ['me', '📈 Profile', ButtonStyle.Secondary],
];

/** Navigation buttons appended to every panel message. */
export function navRow(current) {
  const rows = [];
  let row = new ActionRowBuilder();
  for (const [key, label, style] of NAV_ITEMS) {
    if (row.components.length === 5) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${PANEL_PREFIX}nav:${key}`)
        .setLabel(label)
        .setStyle(current === key ? ButtonStyle.Primary : style)
        .setDisabled(current === key)
    );
  }
  rows.push(row);
  return rows;
}

/** Every panel interaction is ephemeral, so the channel stays clean. */
export function panelReply({ content, embeds = [], components = [], files = [] }) {
  return { content, embeds, components, files, flags: MessageFlags.Ephemeral };
}
