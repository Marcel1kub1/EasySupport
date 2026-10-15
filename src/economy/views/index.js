/*
 * Panel view registry. Each view receives { guildId, userId, args } and returns
 * a panel payload (embeds + components). Actions that change state return a
 * refreshed view plus a short status line.
 */
import { navRow, panelReply } from '../panel.js';
import * as home from './home.js';
import * as shop from './shop.js';
import * as menu from './menu.js';
import * as staff from './staff.js';
import * as empire from './empire.js';
import * as market from './market.js';
import * as kitchen from './kitchen.js';
import * as crew from './crew.js';
import * as games from './games.js';
import * as quests from './quests.js';
import * as board from './board.js';
import * as me from './me.js';

export const VIEWS = {
  home, shop, menu, staff, empire, market, kitchen, crew, games, quests, board, me,
};

/**
 * Renders a view. `args` are the customId segments after the view name, e.g.
 * `taco:buy:better_stove` → view 'buy' with args ['better_stove'].
 * Views may also be rendered for navigation via `nav:<name>`.
 */
export async function renderView(name, { guildId, userId, args = [], interaction }) {
  const view = name.startsWith('nav:') ? name.slice(4) : name;

  let status = null;
  let target = view;
  let handler = VIEWS[view];

  // Action segments map onto views: `work` lives in home, `buy` in shop, etc.
  const ACTION_MAP = {
    work: 'home', tips: 'home', clean: 'home', daily: 'home',
    buy: 'shop', expand: 'empire', hire: 'staff', train: 'staff',
    set: 'menu', prestige: 'empire', priority: 'me', donate: 'crew',
    mktbuy: 'market', mktsell: 'market', cook: 'kitchen', collect: 'kitchen',
    crewcreate: 'crew', crewjoin: 'crew', crewleave: 'crew',
    game: 'games', claim: 'quests', redeem: 'me', gift: 'me',
  };

  if (!handler && ACTION_MAP[view]) {
    target = ACTION_MAP[view];
    handler = VIEWS[target];
  }
  if (!handler) {
    handler = VIEWS.home;
    target = 'home';
    status = 'That action is no longer available.';
  }

  const result = await handler.render({ guildId, userId, action: view, args, interaction });
  const statusLine = result.status ?? status;

  return panelReply({
    content: statusLine ?? undefined,
    embeds: result.embeds ?? [],
    components: [...(result.rows ?? []), ...navRow(target)],
    files: result.files ?? [],
  });
}
