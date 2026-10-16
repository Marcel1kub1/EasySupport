import { Events } from 'discord.js';

export default {
  name: Events.GuildCreate,
  async execute(guild) {
    try {
      await guild.roles.fetch();
      const roles = guild.roles.cache
        .filter((role) => role.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => role.name);
      console.log(
        `[guild] Scanned ${roles.length} role(s) in ${guild.name} (${guild.id}) on join: ${roles.join(', ') || 'none'}.`,
      );
    } catch (error) {
      console.error(`[guild] Failed to scan roles for ${guild.id} (${guild.name}):`, error);
    }
  },
};
