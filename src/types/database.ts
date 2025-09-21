import { ObjectId } from 'mongodb';

// User tracking
export interface User {
  _id?: ObjectId;
  discordId: string;
  username: string;
  displayName: string;
  discriminator: string;
  avatar?: string;
  bot: boolean;
  aliases: string[]; // Track name changes
  roles: string[]; // Role IDs
  joinedAt: Date;
  lastSeen: Date;
  guildId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Role tracking
export interface Role {
  _id?: ObjectId;
  discordId: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  mentionable: boolean;
  hoist: boolean;
  managed: boolean;
  guildId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Message tracking
export interface Message {
  _id?: ObjectId;
  discordId: string;
  content: string;
  authorId: string;
  channelId: string;
  guildId: string;
  timestamp: Date;
  editedAt?: Date;
  deletedAt?: Date;
  mentions: string[]; // User IDs mentioned
  reactions: Reaction[];
  replyTo?: string; // Message ID this is replying to
  attachments: Attachment[];
  embeds: any[]; // Discord embed objects
  createdAt: Date;
  updatedAt: Date;
}

// Reaction tracking
export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // User IDs who reacted
}

// Attachment tracking
export interface Attachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  contentType?: string;
}

// Voice channel tracking
export interface VoiceSession {
  _id?: ObjectId;
  userId: string;
  guildId: string;
  channelId: string;
  channelName: string;
  joinedAt: Date;
  leftAt?: Date;
  duration?: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
}

// Guild sync status
export interface GuildSync {
  _id?: ObjectId;
  guildId: string;
  lastSyncAt: Date;
  lastMessageId?: string; // Last message processed
  totalUsers: number;
  totalMessages: number;
  totalRoles: number;
  isFullySynced: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// User interaction tracking for affinity scoring
export interface UserInteraction {
  _id?: ObjectId;
  fromUserId: string;
  toUserId: string;
  guildId: string;
  interactionType: 'reaction' | 'mention' | 'reply' | 'vc_time';
  messageId?: string;
  channelId?: string;
  timestamp: Date;
  metadata?: any; // Additional data specific to interaction type
  createdAt: Date;
}

// Database collections interface
export interface DatabaseCollections {
  users: any;
  roles: any;
  messages: any;
  voiceSessions: any;
  guildSyncs: any;
  userInteractions: any;
}
