import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney } from '../util.js';
import { franchiseBonus, nextFranchiseLevel } from './crew-engine.js';

export async function render({ guildId, userId, action, args, interaction }) {
  const franchise = economy.getFranchise(guildId, userId);

  if (action === 'crewcreate') {
    const name = args.join(' ').trim();
    if (!name) {
      const modal = new ModalBuilder()
        .setCustomId('taco:franchise-name')
        .setTitle('Name your franchise')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('name').setLabel('Franchise name').setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(true)
          )
        );
      if (interaction) await interaction.showModal(modal);
      return { status: 'Name your franchise in the popup.', embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
    }
    const state = economy.buildState(guildId, userId);
    if (state.user.cash < ECONOMY.franchise.createCost) {
      return { status: `Founding costs **${formatMoney(ECONOMY.franchise.createCost)}**.`, embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
    }
    economy.addCash(guildId, userId, -ECONOMY.franchise.createCost);
    economy.createFranchise(guildId, userId, name);
    return { status: `🤝 **${name}** is founded — invite members with /taco → Crew → Join.`, embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
  }

  if (action === 'crewjoin') {
    const target = args[0];
    const result = economy.joinFranchise(guildId, userId, target);
    if (!result.ok) return { status: result.reason, embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
    return { status: `🤝 You joined **${result.name}**.`, embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
  }

  if (action === 'crewdonate') {
    if (!franchise) return { status: 'Join or found a franchise first.', embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
    const amount = Number(args[0]) || 0;
    if (amount <= 0) return { status: 'Pick an amount.', embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
    const cash = economy.getUser(guildId, userId)?.cash ?? 0;
    if (cash < amount) return { status: `You have ${formatMoney(cash)}.`, embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
    economy.addCash(guildId, userId, -amount);
    economy.donateToFranchise(guildId, userId, amount);
    return { status: `💝 Donated **${formatMoney(amount)}** to the franchise.`, embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
  }

  if (action === 'crewleave') {
    if (!franchise) return { status: 'You are not in a franchise.', embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
    economy.leaveFranchise(guildId, userId);
    return { status: '👋 You left the franchise.', embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
  }

  return { embeds: [crewEmbed(guildId, userId)], rows: [crewRows(guildId, userId)] };
}

function crewEmbed(guildId, userId) {
  const state = economy.buildState(guildId, userId);
  const franchise = economy.getFranchise(guildId, userId);
  const bonus = franchise ? franchiseBonus(franchise, ECONOMY) : 0;

  if (!franchise) {
    const open = economy.listFranchises(guildId);
    const list = open.length
      ? open.map((f) => `**${f.name}** — ${f.members}/${ECONOMY.franchise.maxMembers} members · pot ${formatMoney(f.pot)}`).join('\n')
      : '*No franchises yet — found the first one!*';
    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🤝 Franchises')
      .setDescription(
        `Pool cash, unlock collective perks and climb the franchise board.\n\n${list}` +
          `\n\nFounding costs **${formatMoney(ECONOMY.franchise.createCost)}** ${ECONOMY.currency}.`
      )
      .setFooter({ text: 'Found · join · donate · leave — all in this panel' });
  }

  const members = economy.listFranchiseMembers(guildId, franchise.id);
  const memberLines = members
    .map((m) => `${ECONOMY.franchise.roles[m.role] ?? 'Member'} — <@${m.user_id}>`)
    .join('\n');
  const nextLevel = nextFranchiseLevel({ ...franchise, members: members.length }, ECONOMY);

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🤝 ${franchise.name}`)
    .addFields(
      { name: `Members (${members.length}/${ECONOMY.franchise.maxMembers})`, value: memberLines || '*just you*' },
      { name: 'Franchise pot', value: `**${formatMoney(franchise.pot)}** ${ECONOMY.currency}`, inline: true },
      { name: 'Income bonus', value: bonus > 0 ? `+${Math.round(bonus * 100)}% for members` : 'level up with more members', inline: true },
      { name: 'Next level', value: nextLevel ? `${nextLevel.members} members · 💵 ${formatMoney(nextLevel.cost)} → +${Math.round(nextLevel.bonus * 100)}%` : 'maxed out', inline: true }
    )
    .setFooter({ text: 'Donate to the shared pot to fund level-ups' });
}

function crewRows(guildId, userId) {
  const franchise = economy.getFranchise(guildId, userId);
  const rows = [];
  const push = (label, id, style, disabled = false) => {
    if (rows.length === 0 || rows.at(-1).components.length === 4) rows.push(new ActionRowBuilder());
    rows.at(-1).addComponents(new ButtonBuilder().setCustomId(`taco:${id}`).setLabel(label).setStyle(style).setDisabled(disabled));
  };

  if (!franchise) {
    push('➕ Found', 'crewcreate', ButtonStyle.Success);
    for (const f of economy.listFranchises(guildId).slice(0, 3)) push(`Join ${f.name}`, `crewjoin:${f.id}`, ButtonStyle.Primary);
    return rows;
  }

  push('💝 Donate 100k', 'crewdonate:100000', ButtonStyle.Success);
  push('💝 Donate 1M', 'crewdonate:1000000', ButtonStyle.Success);
  push('👋 Leave', 'crewleave', ButtonStyle.Danger);
  return rows;
}
