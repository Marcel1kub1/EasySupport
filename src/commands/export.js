import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('export')
    .setDescription('DM yourself a copy of the database (backups, migrations)')
    .setDefaultMemberPermissions(0x8),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has(0x8)) {
      return interaction.reply({ content: 'Administrator only.', flags: MessageFlags.Ephemeral });
    }
    await interaction.reply({ content: '📦 Building a snapshot…', flags: MessageFlags.Ephemeral });

    const snapshot = path.join(os.tmpdir(), `ticketbot-export-${Date.now()}.db`);
    try {
      // VACUUM INTO produces a clean, consistent copy even while the bot writes.
      db.exec(`VACUUM INTO '${snapshot}'`);
      await interaction.user.send({
        content: `📦 Database snapshot for **${interaction.guild.name ?? 'this server'}** (${(fs.statSync(snapshot).size / 1024).toFixed(0)} KB). The live database was not modified.`,
        files: [{ attachment: snapshot, name: `ticketbot-${interaction.guildId}.db` }],
      });
      await interaction.editReply({ content: '✅ Snapshot sent to your DMs.' });
    } catch (error) {
      console.error('[export] Failed to snapshot the database:', error);
      await interaction.editReply({ content: '❌ Could not build the snapshot (are your DMs open?).' });
    } finally {
      fs.rmSync(snapshot, { force: true });
    }
  },
};
