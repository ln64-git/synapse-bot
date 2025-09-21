import {
  Message,
  MessageReaction,
  User as DiscordUser,
  GuildMember,
  VoiceState,
  VoiceChannel
} from 'discord.js';
import type {
  PartialMessage,
  PartialUser,
  PartialMessageReaction,
  PartialGuildMember
} from 'discord.js';
import { DatabaseService } from './DatabaseService';
import type { UserInteraction, VoiceSession } from '../types/database';

export class RealtimeTrackingService {
  private dbService: DatabaseService;
  private activeVoiceSessions: Map<string, VoiceSession> = new Map(); // userId -> session

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
  }

  // Message tracking
  async trackMessage(message: Message): Promise<void> {
    try {
      if (!message.guild || !message.author || message.author.bot) return;

      // Check if user has "bot" role
      const member = message.member;
      if (member && member.roles.cache.some(role => role.name.toLowerCase() === 'bot')) {
        return;
      }

      // Skip messages that start with "m!"
      if (message.content.startsWith('m!')) {
        return;
      }

      const dbMessage = {
        discordId: message.id,
        content: message.content,
        authorId: message.author.id,
        channelId: message.channelId,
        guildId: message.guild.id,
        timestamp: message.createdAt,
        editedAt: message.editedAt || undefined,
        mentions: message.mentions.users.map(user => user.id),
        reactions: message.reactions.cache.map(reaction => ({
          emoji: reaction.emoji.name || reaction.emoji.toString(),
          count: reaction.count,
          users: [],
        })),
        replyTo: message.reference?.messageId || undefined,
        attachments: message.attachments.map(attachment => ({
          id: attachment.id,
          filename: attachment.name,
          size: attachment.size,
          url: attachment.url,
          contentType: attachment.contentType || undefined,
        })),
        embeds: message.embeds,
      };

      await this.dbService.upsertMessage(dbMessage);

      // Track user interactions for mentions and replies
      if (message.guild) {
        await this.trackMessageInteractions(message);
      }

      console.log(`🔹 Tracked message from ${message.author.username} in ${message.guild.name}`);
    } catch (error) {
      console.error('🔸 Error tracking message:', error);
    }
  }

  async trackMessageUpdate(oldMessage: PartialMessage | Message, newMessage: Message): Promise<void> {
    try {
      if (!newMessage.guild || newMessage.author.bot) return;

      // Check if user has "bot" role
      const member = newMessage.member;
      if (member && member.roles.cache.some(role => role.name.toLowerCase() === 'bot')) {
        return;
      }

      // Skip messages that start with "m!"
      if (newMessage.content.startsWith('m!')) {
        return;
      }

      const dbMessage = {
        discordId: newMessage.id,
        content: newMessage.content,
        authorId: newMessage.author.id,
        channelId: newMessage.channelId,
        guildId: newMessage.guild.id,
        timestamp: newMessage.createdAt,
        editedAt: newMessage.editedAt || undefined,
        mentions: newMessage.mentions.users.map(user => user.id),
        reactions: newMessage.reactions.cache.map(reaction => ({
          emoji: reaction.emoji.name || reaction.emoji.toString(),
          count: reaction.count,
          users: [],
        })),
        replyTo: newMessage.reference?.messageId || undefined,
        attachments: newMessage.attachments.map(attachment => ({
          id: attachment.id,
          filename: attachment.name,
          size: attachment.size,
          url: attachment.url,
          contentType: attachment.contentType || undefined,
        })),
        embeds: newMessage.embeds,
      };

      await this.dbService.upsertMessage(dbMessage);
      console.log(`🔹 Updated message from ${newMessage.author.username}`);
    } catch (error) {
      console.error('🔸 Error tracking message update:', error);
    }
  }

  async trackMessageDelete(message: PartialMessage | Message): Promise<void> {
    try {
      if (!message.guild || !message.author) return;

      // Mark message as deleted in database
      const collections = this.dbService.getCollections();
      await collections.messages.updateOne(
        { discordId: message.id },
        { $set: { deletedAt: new Date() } }
      );

      console.log(`🔹 Marked message as deleted from ${message.author.username}`);
    } catch (error) {
      console.error('🔸 Error tracking message deletion:', error);
    }
  }

  // Reaction tracking
  async trackReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: DiscordUser | PartialUser): Promise<void> {
    try {
      if (user.bot || !reaction.message.guild) return;

      const message = await reaction.message.fetch();
      if (!message) return;

      // Record interaction
      await this.dbService.recordInteraction({
        fromUserId: user.id,
        toUserId: message.author.id,
        guildId: message.guild!.id,
        interactionType: 'reaction',
        messageId: message.id,
        channelId: message.channelId,
        timestamp: new Date(),
        metadata: {
          emoji: reaction.emoji.name || reaction.emoji.toString(),
        },
      });

      console.log(`🔹 Tracked reaction from ${user.username} to ${message.author.username}`);
    } catch (error) {
      console.error('🔸 Error tracking reaction:', error);
    }
  }

  async trackReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: DiscordUser | PartialUser): Promise<void> {
    try {
      if (user.bot || !reaction.message.guild) return;

      // Note: We don't remove the interaction record, just track the removal
      console.log(`🔹 Reaction removed by ${user.username}`);
    } catch (error) {
      console.error('🔸 Error tracking reaction removal:', error);
    }
  }

  // Voice channel tracking
  async trackVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    try {
      if (!newState.guild || !newState.member) return;

      const userId = newState.member.id;
      const guildId = newState.guild.id;

      // User joined a voice channel
      if (!oldState.channelId && newState.channelId) {
        const channel = newState.channel as VoiceChannel;
        const session: Omit<VoiceSession, '_id' | 'createdAt' | 'updatedAt'> = {
          userId,
          guildId,
          channelId: newState.channelId,
          channelName: channel.name,
          joinedAt: new Date(),
        };

        await this.dbService.createVoiceSession(session);
        this.activeVoiceSessions.set(userId, session as VoiceSession);

        // Record interaction for VC time
        await this.dbService.recordInteraction({
          fromUserId: userId,
          toUserId: userId, // Self-interaction for VC time
          guildId,
          interactionType: 'vc_time',
          channelId: newState.channelId,
          timestamp: new Date(),
          metadata: {
            action: 'joined',
            channelName: channel.name,
          },
        });

        console.log(`🔹 ${newState.member.displayName} joined voice channel ${channel.name}`);
      }

      // User left a voice channel
      if (oldState.channelId && !newState.channelId) {
        const session = this.activeVoiceSessions.get(userId);
        if (session) {
          await this.dbService.updateVoiceSession(userId, guildId, new Date());
          this.activeVoiceSessions.delete(userId);

          // Record interaction for VC time
          await this.dbService.recordInteraction({
            fromUserId: userId,
            toUserId: userId,
            guildId,
            interactionType: 'vc_time',
            channelId: oldState.channelId,
            timestamp: new Date(),
            metadata: {
              action: 'left',
              channelName: oldState.channel?.name,
            },
          });

          console.log(`🔹 ${newState.member.displayName} left voice channel`);
        }
      }

      // User switched voice channels
      if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // End previous session
        const oldSession = this.activeVoiceSessions.get(userId);
        if (oldSession) {
          await this.dbService.updateVoiceSession(userId, guildId, new Date());
        }

        // Start new session
        const channel = newState.channel as VoiceChannel;
        const session: Omit<VoiceSession, '_id' | 'createdAt' | 'updatedAt'> = {
          userId,
          guildId,
          channelId: newState.channelId,
          channelName: channel.name,
          joinedAt: new Date(),
        };

        await this.dbService.createVoiceSession(session);
        this.activeVoiceSessions.set(userId, session as VoiceSession);

        console.log(`🔹 ${newState.member.displayName} switched to voice channel ${channel.name}`);
      }
    } catch (error) {
      console.error('🔸 Error tracking voice state update:', error);
    }
  }

  // Guild member tracking
  async trackGuildMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember | PartialGuildMember): Promise<void> {
    try {
      const user: Omit<import('../types/database').User, '_id' | 'createdAt' | 'updatedAt'> = {
        discordId: newMember.id,
        username: newMember.user.username,
        displayName: newMember.displayName,
        discriminator: newMember.user.discriminator,
        avatar: newMember.user.avatar || undefined,
        bot: newMember.user.bot,
        aliases: [newMember.user.username, newMember.displayName].filter((name, index, arr) => arr.indexOf(name) === index),
        roles: newMember.roles.cache.map(role => role.id),
        joinedAt: newMember.joinedAt || new Date(),
        lastSeen: new Date(),
        guildId: newMember.guild.id,
      };

      await this.dbService.upsertUser(user);
      console.log(`🔹 Updated user ${newMember.displayName}`);
    } catch (error) {
      console.error('🔸 Error tracking guild member update:', error);
    }
  }

  // Helper method to track message interactions
  private async trackMessageInteractions(message: Message): Promise<void> {
    try {
      // Track mentions
      for (const mentionedUser of message.mentions.users.values()) {
        if (mentionedUser.id !== message.author.id) {
          await this.dbService.recordInteraction({
            fromUserId: message.author.id,
            toUserId: mentionedUser.id,
            guildId: message.guild!.id,
            interactionType: 'mention',
            messageId: message.id,
            channelId: message.channelId,
            timestamp: message.createdAt,
          });
        }
      }

      // Track replies
      if (message.reference?.messageId) {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMessage && repliedMessage.author.id !== message.author.id) {
          await this.dbService.recordInteraction({
            fromUserId: message.author.id,
            toUserId: repliedMessage.author.id,
            guildId: message.guild!.id,
            interactionType: 'reply',
            messageId: message.id,
            channelId: message.channelId,
            timestamp: message.createdAt,
            metadata: {
              repliedToMessageId: message.reference.messageId,
            },
          });
        }
      }
    } catch (error) {
      console.error('🔸 Error tracking message interactions:', error);
    }
  }

  // Get active voice sessions (for debugging)
  getActiveVoiceSessions(): Map<string, VoiceSession> {
    return new Map(this.activeVoiceSessions);
  }

  // Clean up active sessions (call on bot shutdown)
  async cleanupActiveSessions(): Promise<void> {
    const now = new Date();
    for (const [userId, session] of this.activeVoiceSessions) {
      try {
        await this.dbService.updateVoiceSession(userId, session.guildId, now);
      } catch (error) {
        console.error(`🔸 Error cleaning up voice session for user ${userId}:`, error);
      }
    }
    this.activeVoiceSessions.clear();
  }
}
