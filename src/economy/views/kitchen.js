import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { economy } from '../instance.js';
import { ECONOMY } from '../config.js';
import { formatMoney, formatIngredients } from '../util.js';
import { formatDuration } from '../util.js';

const COOK = 'cooking';

export async function render({ guildId, userId, action, args }) {
  const now = Date.now();

  if (action === 'cook') {
    const recipe = ECONOMY.kitchen.recipes.find((r) => r.key === args[0]);
    if (!recipe) return { status: 'Unknown recipe.', embeds: [], rows: [] };
    const jobs = economy.listCooking(guildId, userId, now);
    if (jobs.length >= ECONOMY.kitchen.slots) {
      return { status: `All ${ECONOMY.kitchen.slots} stove slots are busy.`, embeds: [kitchenEmbed(guildId, userId, now)], rows: [kitchenRows(guildId, userId, now)] };
    }
    const state = economy.buildState(guildId, userId, now);
    if (state.user.ingredients < recipe.ingredients) {
      return { status: `**${recipe.label}** needs ${recipe.ingredients} ingredients — you have ${formatIngredients(state.user.ingredients)}.`, embeds: [kitchenEmbed(guildId, userId, now)], rows: [kitchenRows(guildId, userId, now)] };
    }
    economy.addIngredients(guildId, userId, -recipe.ingredients);
    economy.startCooking(guildId, userId, recipe.key, now + recipe.minutes * 60_000);
    return { status: `🍳 **${recipe.label}** is on the stove — ready in ${formatDuration(recipe.minutes * 60_000)}.`, embeds: [kitchenEmbed(guildId, userId, now)], rows: [kitchenRows(guildId, userId, now)] };
  }

  if (action === 'collect') {
    const recipeKey = args[0];
    const job = economy.listKitchen(guildId, userId).find((j) => j.recipe === recipeKey && j.expiresAt <= now);
    if (!job) return { status: 'That dish is not ready yet.', embeds: [kitchenEmbed(guildId, userId, now)], rows: [kitchenRows(guildId, userId, now)] };
    const recipe = ECONOMY.kitchen.recipes.find((r) => r.key === recipeKey);
    economy.finishCooking(guildId, userId, recipeKey);
    economy.addCash(guildId, userId, recipe.reward);
    return { status: `✅ Collected **${recipe.label}** — +${formatMoney(recipe.reward)}.`, embeds: [kitchenEmbed(guildId, userId, now)], rows: [kitchenRows(guildId, userId, now)] };
  }

  return { embeds: [kitchenEmbed(guildId, userId, now)], rows: [kitchenRows(guildId, userId, now)] };
}

function kitchenEmbed(guildId, userId, now) {
  const jobs = economy.listCooking(guildId, userId, now);
  const state = economy.buildState(guildId, userId, now);

  const stoveLines = Array.from({ length: ECONOMY.kitchen.slots }, (_, i) => {
    const job = jobs[i];
    if (!job) return `🔥 Slot ${i + 1}: *empty*`;
    const recipe = ECONOMY.kitchen.recipes.find((r) => r.key === job.recipe);
    const ready = job.expiresAt <= now;
    return `🔥 Slot ${i + 1}: **${recipe.label}** — ${ready ? '**ready!**' : `ready in ${formatDuration(job.expiresAt - now)}`}`;
  });

  const recipeLines = ECONOMY.kitchen.recipes.map(
    (r) => `**${r.label}** · ${r.ingredients}🥘 · ${r.minutes}min · 💵 ${formatMoney(r.reward)}`
  );

  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('🍳 Kitchen')
    .addFields(
      { name: 'Stove', value: stoveLines.join('\n') },
      { name: 'Recipes', value: recipeLines.join('\n') }
    )
    .setFooter({ text: `Ingredients: ${formatIngredients(state.user.ingredients)} · mine with ⛏️` });
}

function kitchenRows(guildId, userId, now) {
  const jobs = economy.listCooking(guildId, userId, now);
  const busy = new Set(jobs.map((j) => j.recipe));
  const ready = new Set(jobs.filter((j) => j.expiresAt <= now).map((j) => j.recipe));
  const rows = [];

  for (const recipe of ECONOMY.kitchen.recipes) {
    if (rows.length === 0 || rows.at(-1).components.length === 2) rows.push(new ActionRowBuilder());
    const components = [];
    if (ready.has(recipe.key)) {
      components.push(new ButtonBuilder().setCustomId(`taco:collect:${recipe.key}`).setLabel(`Collect ${recipe.label}`).setStyle(ButtonStyle.Success));
    } else {
      components.push(new ButtonBuilder().setCustomId(`taco:cook:${recipe.key}`).setLabel(`Cook ${recipe.label}`).setStyle(ButtonStyle.Secondary).setDisabled(busy.has(recipe.key)));
    }
    rows.at(-1).addComponents(components);
  }
  return rows;
}
