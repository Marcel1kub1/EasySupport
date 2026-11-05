import { Events } from 'discord.js';
import {
  getGuild,
  setRolePermission,
  bulkUpdateGuildSettings,
} from '../db.js';

const DEFAULT_ROLE_PERMISSIONS = {
  // Commands that admins/moderators should be able to use by default
  moderation: ['Administrator', 'Moderator'],
  anti_nuke: ['Administrator'],
  automod: ['Administrator'],
  leveling: ['Administrator', 'Moderator'],
  economy: ['Administrator'],
  giveaways: ['Administrator', 'Moderator'],
  vouches: ['Administrator', 'Moderator'],
  welcome_goodbye_boost: ['Administrator'],
  logging: ['Administrator'],
};

const DEFAULT_SETTINGS = {
  tickets: {
    ticket_prefix: 'ticket',
    welcome_dm: 'true',
    close_timeout: '0',
    max_tickets_per_user: '3',
  },
  moderation: {
    default_mute_duration: '60',
    warn_threshold: '3',
    auto_mute_on_warns: 'false',
    log_deletions: 'true',
    log_edits: 'true',
    log_member_actions: 'true',
  },
  anti_nuke: {
    anti_raid_enabled: 'false',
    anti_raid_threshold: '5',
    anti_raid_action: 'kick',
    anti_spam_enabled: 'false',
    anti_spam_threshold: '5',
    anti_invite_enabled: 'false',
    anti_link_enabled: 'false',
    nuke_protection_enabled: 'false',
  },
  automod: {
    word_filter_enabled: 'false',
    link_filter_enabled: 'false',
    mention_spam_enabled: 'false',
    mention_spam_threshold: '5',
    caps_filter_enabled: 'false',
    caps_threshold: '0.7',
    max_line_length: '500',
    automod_action: 'delete',
  },
  leveling: {
    leveling_enabled: 'true',
    xp_per_message: '15',
    xp_cooldown: '60',
  },
  economy: {
    economy_enabled: 'true',
    daily_amount: '100',
    daily_cooldown: '24',
    work_amount: '50',
    work_cooldown: '60',
    pay_enabled: 'true',
    shop_enabled: 'true',
    currency_name: 'Credits',
    currency_emoji: '💰',
    starting_balance: '0',
  },
  giveaways: {
    min_giveaway_duration: '5',
    max_giveaway_duration: '43200',
    giveaway_emoji: '🎉',
    winner_count_default: '1',
  },
  vouches: {
    vouches_enabled: 'true',
    vouch_cooldown: '24',
    max_vouches_per_user: '1',
    vouch_leaderboard: 'true',
    anonymous_vouches: 'false',
  },
  welcome_goodbye_boost: {
    welcome_enabled: 'false',
    goodbye_enabled: 'false',
    boost_enabled: 'false',
  },
  logging: {
    log_message_delete: 'false',
    log_message_edit: 'false',
    log_member_join: 'false',
    log_member_leave: 'false',
    log_member_ban: 'true',
    log_member_unban: 'true',
    log_role_create: 'false',
    log_role_delete: 'false',
    log_channel_create: 'false',
    log_channel_delete: 'false',
    log_voice_join: 'false',
    log_voice_leave: 'false',
    log_nickname_change: 'false',
    log_avatar_change: 'false',
  },
};

export default {
  name: Events.GuildCreate,
  async execute(guild) {
    try {
      await guild.roles.fetch();

      // Check if guild already has settings
      const existing = await getGuild(guild.id);
      if (existing) {
        console.log(`[guild] Settings already exist for ${guild.name} (${guild.id}), skipping init.`);
        return;
      }

      // Initialize default guild settings
      const allSettings = {};
      for (const [module, settings] of Object.entries(DEFAULT_SETTINGS)) {
        Object.assign(allSettings, settings);
      }
      await bulkUpdateGuildSettings(guild.id, allSettings);

      // Set default role permissions
      // Give @everyone limited access, administrators full access
      const everyoneRole = guild.roles.everyone;
      if (everyoneRole) {
        // Everyone gets basic read-only commands
        await setRolePermission(guild.id, everyoneRole.id, 'leveling', true);
        await setRolePermission(guild.id, everyoneRole.id, 'vouches', true);
        await setRolePermission(guild.id, everyoneRole.id, 'economy', true);
      }

      // Find admin/moderator roles and grant permissions
      const adminRoles = guild.roles.cache.filter((role) =>
        role.permissions.has('Administrator') || role.name.toLowerCase().includes('admin')
      );
      const modRoles = guild.roles.cache.filter((role) =>
        role.permissions.has('ModerateMembers') ||
        role.permissions.has('KickMembers') ||
        role.permissions.has('BanMembers') ||
        role.name.toLowerCase().includes('mod')
      );

      for (const role of adminRoles.values()) {
        for (const [module] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
          await setRolePermission(guild.id, role.id, module, true);
        }
      }

      for (const role of modRoles.values()) {
        if (adminRoles.has(role.id)) continue;
        for (const [module, allowedRoles] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
          if (allowedRoles.includes('Moderator')) {
            await setRolePermission(guild.id, role.id, module, true);
          }
        }
      }

      console.log(
        `[guild] Initialized settings and role permissions for ${guild.name} (${guild.id}).`,
      );
    } catch (error) {
      console.error(`[guild] Failed to initialize settings for ${guild.id} (${guild.name}):`, error);
    }
  },
};
