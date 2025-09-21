# Database Sync System

This document describes the comprehensive database synchronization system implemented in the Synapse Bot.

## Overview

The bot automatically tracks and syncs Discord server data to a MongoDB database, including:
- **Users**: Profile information, roles, aliases, and activity
- **Roles**: All server roles with permissions and metadata
- **Messages**: Content, reactions, mentions, replies, and attachments
- **Voice Sessions**: Time spent in voice channels
- **User Interactions**: Reactions, mentions, replies for affinity scoring

## Features

### 🔹 Automatic Startup Sync
- Bot checks if the configured guild is fully synced on startup
- Performs full sync if needed
- Logs sync status and statistics

### 🔹 Real-time Tracking
- Tracks new messages, edits, and deletions
- Monitors reactions and user interactions
- Records voice channel join/leave events
- Updates user information when roles change

### 🔹 Manual Sync Command
- `/sync` - Check sync status and perform manual sync
- `/sync force:true` - Force full sync even if already synced
- `/sync type:users` - Sync specific data types
- `/sync type:status` - Check current sync status

## Database Schema

### Collections

#### `users`
```typescript
{
  discordId: string;        // Discord user ID
  username: string;         // Current username
  displayName: string;      // Server display name
  discriminator: string;    // User discriminator
  avatar?: string;          // Avatar hash
  bot: boolean;            // Is bot account
  aliases: string[];       // Track name changes
  roles: string[];         // Role IDs
  joinedAt: Date;          // When joined server
  lastSeen: Date;          // Last activity
  guildId: string;         // Server ID
  createdAt: Date;         // Record creation
  updatedAt: Date;         // Last update
}
```

#### `messages`
```typescript
{
  discordId: string;       // Message ID
  content: string;         // Message content
  authorId: string;        // Author user ID
  channelId: string;       // Channel ID
  guildId: string;         // Server ID
  timestamp: Date;         // Message timestamp
  editedAt?: Date;         // Edit timestamp
  deletedAt?: Date;        // Deletion timestamp
  mentions: string[];      // Mentioned user IDs
  reactions: Reaction[];   // Reaction data
  replyTo?: string;        // Replied message ID
  attachments: Attachment[]; // File attachments
  embeds: any[];           // Discord embeds
}
```

#### `voiceSessions`
```typescript
{
  userId: string;          // User ID
  guildId: string;         // Server ID
  channelId: string;       // Voice channel ID
  channelName: string;     // Channel name
  joinedAt: Date;          // Join time
  leftAt?: Date;           // Leave time
  duration?: number;       // Session duration (seconds)
}
```

#### `userInteractions`
```typescript
{
  fromUserId: string;      // User who performed action
  toUserId: string;        // Target user
  guildId: string;         // Server ID
  interactionType: 'reaction' | 'mention' | 'reply' | 'vc_time';
  messageId?: string;      // Related message
  channelId?: string;      // Related channel
  timestamp: Date;         // When it happened
  metadata?: any;          // Additional data
}
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Required
BOT_TOKEN=your_discord_bot_token_here
MONGO_URI=mongodb://localhost:27017
DB_NAME=synapse-bot

# Optional
GUILD_ID=your_guild_id_for_testing
BOT_PREFIX=!
BOT_OWNER_ID=your_user_id
NODE_ENV=development
PORT=3000
```

## Usage

### Starting the Bot
```bash
npm start
```

The bot will:
1. Connect to MongoDB
2. Login to Discord
3. Check guild sync status
4. Perform full sync if needed
5. Start real-time tracking

### Manual Sync
Use the `/sync` command in Discord:
- `/sync` - Check status and sync if needed
- `/sync force:true` - Force full sync
- `/sync type:status` - Just check status
- `/sync type:users` - Sync only users

### Monitoring
The bot logs all sync activities:
```
🔹 Guild sync completed: 150 users, 25 roles, 5000 messages
🔹 Tracked message from username in Server Name
🔹 username joined voice channel General
```

## Performance Considerations

- **Message Sync**: Limited to 1000 messages per channel to prevent API rate limits
- **Batch Processing**: Processes data in batches for efficiency
- **Indexes**: Database indexes created for optimal query performance
- **Incremental Sync**: Only syncs new/updated data after initial full sync

## Error Handling

- All sync operations include comprehensive error handling
- Failed operations are logged but don't stop the bot
- Partial sync results are reported
- Database connection issues are handled gracefully

## Future Enhancements

This system provides the foundation for:
- User relationship mapping
- Affinity scoring based on interactions
- Conversation analysis
- Sentiment tracking
- AI-powered user insights

The tracked data can be used to build sophisticated relationship analysis and user behavior insights as outlined in the project's ideas document.
