import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommandOptionsOnlyBuilder } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: any) => Promise<void>;
}
