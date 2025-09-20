# Discord Bot Template

A clean, minimal Discord bot template built with TypeScript and Discord.js v14.

## Features

- 🔹 Dynamic command registration
- 🔹 TypeScript support with proper type definitions
- 🔹 Error handling with emoji indicators
- 🔹 Guild-specific or global command deployment
- 🔹 Clean, extensible architecture
- 🔹 MongoDB integration ready

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create a `.env` file:**
   ```env
   BOT_TOKEN=your_discord_bot_token_here
   GUILD_ID=your_guild_id_for_testing  # Optional, for guild-specific commands
   MONGO_URI=mongodb://localhost:27017  # Optional, for database features
   ```

3. **Run the bot:**
   ```bash
   npm start
   ```

## Project Structure

```
src/
├── Bot.ts              # Main bot class
├── main.ts             # Entry point
├── commands/           # Command files
│   └── ping.ts
├── types/              # TypeScript type definitions
│   └── index.ts
└── utils/              # Utility functions
    └── database.ts

docs/                   # Documentation
├── SYNC_COMMAND_README.md
└── USER_TRACKING_README.md

data/                   # Runtime data (gitignored)
└── logs/              # Log files
```

## Adding Commands

Commands are automatically loaded from the `src/commands/` directory. Here's how to create a new command:

```typescript
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';

export const myCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('mycommand')
        .setDescription('My awesome command!'),
    
    async execute(interaction) {
        await interaction.reply('🔹 Hello from my command!');
    }
};
```

## Development

### Running in development mode:
```bash
npm run dev
```

### Building:
```bash
npm run build
```

### Cleaning build artifacts:
```bash
npm run clean
```

## Environment Variables

- `BOT_TOKEN` (required): Your Discord bot token
- `GUILD_ID` (optional): Guild ID for testing commands locally
- `MONGO_URI` (optional): MongoDB connection string for database features

## Getting Started with Discord

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the token and add it to your `.env` file
5. In "OAuth2" > "URL Generator", select "bot" and "applications.commands" scopes
6. Select necessary permissions and use the generated URL to invite your bot

## Documentation

- [Sync Commands](docs/SYNC_COMMAND_README.md) - Database synchronization features
- [User Tracking](docs/USER_TRACKING_README.md) - User and message tracking system

## License

MIT
