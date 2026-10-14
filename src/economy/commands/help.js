import { SlashCommandBuilder } from 'discord.js';
import { ECONOMY } from '../config.js';

const CATEGORIES = [
  {
    title: '🎫 Ticketing',
    commands: [
      ['/setup', 'Configure staff role, log channel, open-ticket limit'],
      ['/panel', 'Post the ticket panel'],
    ],
  },
  {
    title: '🌮 Earning',
    commands: [
      ['/found <name>', 'Name your first shack'],
      ['/work', 'Cook tacos for cash — the main earner'],
      ['/tips', 'Collect the tip jar'],
      ['/daily', 'Streak bonus'],
      ['/mine', 'Gather ingredients'],
    ],
  },
  {
    title: '🏢 Empire',
    commands: [
      ['/shack', 'All your businesses at a glance'],
      ['/upgrades', 'Browse the equipment ladder'],
      ['/buy', 'Upgrades, boosts, HQ and decorations'],
      ['/shop', 'Boost store'],
      ['/menu view|set', 'Menu slots and items'],
      ['/hire', 'Hire staff for passive income'],
      ['/employees list|train', 'Staff overview and training'],
      ['/expand', 'More upgrade slots'],
      ['/location list|buy', 'Restaurants, hotels and the truck'],
      ['/prestige', 'Reset a maxed business for a multiplier'],
    ],
  },
  {
    title: '🎲 Social & events',
    commands: [
      ['/leaderboard', 'Richest members'],
      ['/gift <member> <amount>', 'Send cash (small fee)'],
      ['/donate <amount>', 'Fill the community pot'],
      ['/goal', 'Pot progress'],
      ['/coupons', 'Active coupon codes'],
      ['/redeem <code>', 'Redeem a coupon'],
      ['/rewards', 'Your streak, tasks and coupons'],
      ['/tasks view|claim', 'Daily tasks'],
      ['/achievements · /badge view', 'Goals and badges'],
      ['/remind <action>', 'Ping when a cooldown ends'],
      ['/rushhour · /event', 'Income windows'],
      ['/priority buy|view', 'Priority support for tickets'],
    ],
  },
];

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('All commands, grouped by what they do'),
  async execute(interaction) {
    const sections = CATEGORIES.map((group) => {
      const lines = group.commands.map(([name, description]) => `\`${name}\` — ${description}`).join('\n');
      return `**${group.title}**\n${lines}`;
    });

    const total = CATEGORIES.reduce((n, g) => n + g.commands.length, 0);
    return interaction.reply({
      content: `🌮 **EasySupport — ${total} commands**\n\n${sections.join('\n\n')}`,
    });
  },
};
