import { db } from '../db.js';
import { createEconomyDb } from './db.js';

/** The economy repository bound to the bot's shared database. */
export const economy = createEconomyDb(db);
