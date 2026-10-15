import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney } from '../util.js';

const blackjackGames = new Map(); // `${guildId}:${userId}` -> { bet, player:[], dealer:[] }

export async function render({ guildId, userId, action, args }) {
  const now = Date.now();
  const state = economy.buildState(guildId, userId);

  if (action === 'game') {
    const [game, choice] = args;
    const status = play(game, choice, guildId, userId, state, now);
    const fresh = economy.buildState(guildId, userId, now);
    return { status, embeds: [gamesEmbed(fresh, guildId, userId)], rows: [gamesRows()] };
  }

  return { embeds: [gamesEmbed(state, guildId, userId)], rows: [gamesRows()] };
}

function play(game, choice, guildId, userId, state, now) {
  const cfg = ECONOMY.games[game];
  if (!cfg) return 'Unknown game.';
  const spend = (amount) => {
    if (state.user.cash < amount) return false;
    economy.addCash(guildId, userId, -amount);
    return true;
  };

  if (game === 'slots') {
    if (!spend(cfg.cost)) return `Slots cost ${formatMoney(cfg.cost)} — you have ${formatMoney(state.user.cash)}.`;
    const reels = [roll(), roll(), roll()];
    const [a, b, c] = reels;
    if (a === b && b === c) {
      const win = Math.round(cfg.cost * cfg.jackpotMultiplier);
      economy.addCash(guildId, userId, win);
      return `🎰 ${reels.join(' ')} — **JACKPOT! +${formatMoney(win)}**`;
    }
    if (a === b || b === c) {
      const win = Math.round(cfg.cost * cfg.reelPay);
      economy.addCash(guildId, userId, win);
      return `🎰 ${reels.join(' ')} — two of a kind! +${formatMoney(win)}`;
    }
    return `🎰 ${reels.join(' ')} — no luck this spin.`;
  }

  if (game === 'scratch') {
    if (!spend(cfg.cost)) return `Scratch tickets cost ${formatMoney(cfg.cost)}.`;
    const rollValue = Math.random();
    const tier = rollValue < 0.6 ? 0 : rollValue < 0.9 ? 1 : rollValue < 0.99 ? 2 : 3;
    const win = cfg.tiers[tier];
    if (win > 0) {
      economy.addCash(guildId, userId, win);
      return `🎫 Scratch card: **+${formatMoney(win)}**!`;
    }
    return '🎫 Scratch card: nothing this time.';
  }

  if (game === 'flip') {
    if (!spend(cfg.cost)) return `A flip costs ${formatMoney(cfg.cost)}.`;
    const win = Math.random() < 0.5;
    if (win) {
      const payout = Math.round(cfg.cost * cfg.payout);
      economy.addCash(guildId, userId, payout);
      return `🪙 Flip: heads — **+${formatMoney(payout)}**`;
    }
    return '🪙 Flip: tails.';
  }

  if (game === 'cups') {
    if (!spend(cfg.cost)) return `Cup game costs ${formatMoney(cfg.cost)}.`;
    const ball = 1 + Math.floor(Math.random() * 3);
    const pick = Number(choice) || 1;
    if (pick === ball) {
      const payout = Math.round(cfg.cost * cfg.payout);
      economy.addCash(guildId, userId, payout);
      return `🥤 Cup ${ball} had the ball — **+${formatMoney(payout)}**`;
    }
    return `🥤 It was under cup ${ball}.`;
  }

  if (game === 'roll') {
    if (!spend(cfg.cost)) return `A dice roll costs ${formatMoney(cfg.cost)}.`;
    const over = (Number(choice) || 50) > 50;
    const die = 1 + Math.floor(Math.random() * 100);
    if (over ? die > 50 : die <= 50) {
      const payout = Math.round(cfg.cost * cfg.payout);
      economy.addCash(guildId, userId, payout);
      return `🎲 Rolled ${die} — **+${formatMoney(payout)}**`;
    }
    return `🎲 Rolled ${die} — so close.`;
  }

  if (game === 'blackjack') {
    return blackjack(choice, guildId, userId, state, cfg);
  }

  return 'Unknown game.';
}

function roll() {
  const faces = ['🌮', '🌯', '🥑'];
  return faces[Math.floor(Math.random() * faces.length)];
}

function blackjack(choice, guildId, userId, state, cfg) {
  const key = `${guildId}:${userId}`;
  let game = blackjackGames.get(key);
  const handValue = (hand) => {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
      if (card === 'A') {
        aces += 1;
        total += 11;
      } else if (['K', 'Q', 'J'].includes(card)) total += 10;
      else total += Number(card);
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  };
  const draw = () => {
    const deck = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return deck[Math.floor(Math.random() * deck.length)];
  };
  const settle = (outcome) => {
    blackjackGames.delete(key);
    return outcome;
  };

  if (choice === 'hit' && game) {
    game.player.push(draw());
    const player = handValue(game.player);
    if (player > 21) {
      return settle(`🃏 Bust with ${player} — the bet is gone.`);
    }
    blackjackGames.set(key, game);
    return `🃏 You: ${game.player.join(' ')} = **${player}**. Hit or stand?`;
  }

  if (choice === 'stand' && game) {
    while (handValue(game.dealer) < 17) game.dealer.push(draw());
    const player = handValue(game.player);
    const dealer = handValue(game.dealer);
    blackjackGames.delete(key);
    if (dealer > 21 || player > dealer) {
      const win = Math.round(game.bet * cfg.payout);
      economy.addCash(guildId, userId, win);
      return settle(`🃏 ${player} vs dealer ${dealer} — **you win +${formatMoney(win)}**`);
    }
    if (player === dealer) {
      economy.addCash(guildId, userId, game.bet);
      return settle(`🃏 Push — bet returned.`);
    }
    return settle(`🃏 ${player} vs dealer ${dealer} — dealer wins.`);
  }

  // start a new hand
  const bet = Math.min(cfg.maxBet, Math.max(cfg.minBet, Number(choice) || cfg.minBet));
  if (state.user.cash < bet) return `Blackjack bets start at ${formatMoney(cfg.minBet)}.`;
  economy.addCash(guildId, userId, -bet);
  const fresh = { bet, player: [draw(), draw()], dealer: [draw()] };
  blackjackGames.set(key, fresh);
  const player = handValue(fresh.player);
  if (player === 21) {
    const win = Math.round(bet * cfg.payout * 1.5);
    economy.addCash(guildId, userId, win);
    blackjackGames.delete(key);
    return `🃏 Blackjack! **+${formatMoney(win)}**`;
  }
  return `🃏 You: ${fresh.player.join(' ')} = **${player}** · Dealer shows ${fresh.dealer[0]}. Hit or stand?`;
}

function gamesEmbed(state, guildId, userId) {
  const active = blackjackGames.get(`${guildId}:${userId}`);
  const lines = [
    `🎰 **Slots** — ${formatMoney(ECONOMY.games.slots.cost)} per spin · jackpot ×${ECONOMY.games.slots.jackpotMultiplier}`,
    `🃏 **Blackjack** — ${formatMoney(ECONOMY.games.blackjack.minBet)}–${formatMoney(ECONOMY.games.blackjack.maxBet)} bets`,
    `🎫 **Scratch** — ${formatMoney(ECONOMY.games.scratch.cost)} a ticket, up to ${formatMoney(ECONOMY.games.scratch.tiers.at(-1))}`,
    `🪙 **Coin flip** — ${formatMoney(ECONOMY.games.flip.cost)} · ×${ECONOMY.games.flip.payout}`,
    `🥤 **Cups** — ${formatMoney(ECONOMY.games.cups.cost)} · ×${ECONOMY.games.cups.payout}`,
    `🎲 **Dice** — ${formatMoney(ECONOMY.games.roll.cost)} · ×${ECONOMY.games.roll.payout}`,
  ];

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🎲 Mini-games')
    .setDescription(
      lines.join('\n') +
        (active ? `\n\n🃏 **Table open:** ${active.player.join(' ')} — hit or stand?` : '') +
        '\n\nHouse edge is on purpose — treat it as entertainment, not a plan.'
    )
    .setFooter({ text: `Balance: ${formatMoney(state.user.cash)} ${ECONOMY.currency}` });
}

function gamesRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('taco:game:slots').setLabel('🎰 Spin').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('taco:game:blackjack:25000').setLabel('🃏 Blackjack').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('taco:game:scratch').setLabel('🎫 Scratch').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('taco:game:flip').setLabel('🪙 Flip').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('taco:game:cups:1').setLabel('🥤 Cup 1').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('taco:game:cups:2').setLabel('🥤 Cup 2').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('taco:game:cups:3').setLabel('🥤 Cup 3').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('taco:game:roll:over').setLabel('🎲 Roll over 50').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('taco:game:roll:under').setLabel('🎲 Roll 50 or under').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('taco:game:blackjack:hit').setLabel('🃏 Hit').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('taco:game:blackjack:stand').setLabel('🃏 Stand').setStyle(ButtonStyle.Danger)
    ),
  ];
}
