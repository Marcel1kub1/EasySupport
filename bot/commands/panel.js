import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getGuild } from '../db.js';
import { CATEGORIES, resolveStaffRole } from '../categories.js';
import { panelArt } from '../art.js';

const MAX_BUTTONS_PER_ROW = 5;

export default {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Post a ticket panel with one button per category')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Channel to post the panel in (default: current channel)').setRequired(false)
    ),
  async execute(interaction) {
    const settings = await getGuild(interaction.guildId);
    if (!settings?.staff_role_id) {
      return interaction.reply({ content: 'This bot has not been set up please do /setup if you are the owner', flags: MessageFlags.Ephemeral });
    }

    const target = interaction.options.getChannel('channel') ?? interaction.channel;
    if (!target.isTextBased()) {
      return interaction.reply({ content: 'Pick a text channel.', flags: MessageFlags.Ephemeral });
    }

    const entries = Object.entries(CATEGORIES);
    const rows = [];
    for (let i = 0; i < entries.length; i += MAX_BUTTONS_PER_ROW) {
      rows.push(
        new ActionRowBuilder().addComponents(
          entries.slice(i, i + MAX_BUTTONS_PER_ROW).map(([key, cat]) => {
            const button = new ButtonBuilder()
              .setCustomId(`ticket:open:${key}`)
              .setLabel(cat.label)
              .setStyle(ButtonStyle.Primary);
            if (cat.emoji) button.setEmoji(cat.emoji);
            return button;
          })
        )
      );
    }

    // Show which role handles each category (plain text — a role mention inside
    // an embed would notify the role every time someone views the panel feed).
    const fields = entries.map(([, cat]) => {
      let value = cat.description;
      const configured = cat.staffRole ?? cat.staffRoleId;
      if (configured) {
        const role = resolveStaffRole(interaction.guild, configured);
        value += role
          ? `\nHandled by: @${role.name}`
          : '\nHandled by: *(role not found — check src/categories.js)*';
      }
      const name = cat.emoji ? `${cat.emoji} ${cat.label}` : cat.label;
      return { name, value };
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Open a ticket')
      .setDescription('Pick a topic below — a private channel with our team will be created for you.')
      .addFields(fields)
      .setImage('attachment://panel-art.png')
      .setFooter({ text: 'Please open one ticket per issue.' });

    // Generated banner: one labeled card per category, deterministic and cached.
    const art = await panelArt(entries.map(([key, cat]) => ({ key, label: cat.label, emoji: cat.emoji })));

    await target.send({
      embeds: [embed],
      components: rows,
      files: [{ attachment: art, name: 'panel-art.png' }],
    });
    await interaction.reply({ content: `Panel posted in <#${target.id}>.`, flags: MessageFlags.Ephemeral });
  },
};
