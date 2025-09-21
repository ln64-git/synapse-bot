import { DatabaseService } from './DatabaseService';
import type { UserInteraction, User, Message, VoiceSession } from '../types/database';

export interface AffinityScore {
  fromUserId: string;
  toUserId: string;
  guildId: string;
  totalScore: number;
  breakdown: {
    reactions: number;
    mentions: number;
    replies: number;
    vcRelativeScore: number;
  };
  interactionCounts: {
    reactions: number;
    mentions: number;
    replies: number;
    vcSessions: number;
  };
  timeRange: {
    firstInteraction: Date | null;
    lastInteraction: Date | null;
    daysActive: number;
  };
  relativeScore: number; // Score relative to user's other relationships
  rank: number; // Rank among all relationships for this user
  vcDetails?: {
    totalMinutes: number;
    sessionCount: number;
    averageSessionLength: number;
    relativeScore: number; // How much time spent with this user vs others
    topChannels: Array<{ channelName: string; minutes: number }>;
  };
}

export interface AffinityAnalysis {
  user1: User | null;
  user2: User | null;
  affinity: AffinityScore | null;
  reverseAffinity: AffinityScore | null;
  mutualScore: number; // Combined score
  relationshipType: 'strong' | 'moderate' | 'weak' | 'none';
  insights: string[];
}

export class AffinityService {
  private dbService: DatabaseService;

  // Scoring weights for different interaction types (VC relative score prioritized)
  private readonly SCORING_WEIGHTS = {
    reactions: 1.0,
    mentions: 2.0,
    replies: 3.0,
    vcRelativeScore: 50.0, // Relative VC score is the primary indicator
  };

  // Time decay factor (interactions older than this get reduced weight)
  private readonly TIME_DECAY_DAYS = 90;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
  }

  /**
   * Calculate affinity score from USER_1 to USER_2
   */
  async calculateAffinity(
    fromUserId: string,
    toUserId: string,
    guildId: string
  ): Promise<AffinityScore> {
    const collections = this.dbService.getCollections();

    // Get all interactions between the users (limit to recent ones for performance)
    const interactions = await collections.userInteractions
      .find({
        fromUserId,
        toUserId,
        guildId,
      })
      .sort({ timestamp: -1 })
      .limit(1000) // Limit to most recent 1000 interactions
      .toArray();

    // Get voice sessions for VC time calculation (all time)
    const voiceSessions = await collections.voiceSessions
      .find({
        userId: fromUserId,
        guildId,
        // Include both completed and active sessions
      })
      .sort({ joinedAt: -1 })
      .limit(500) // Increased limit for all-time data
      .toArray();

    // Calculate scores for each interaction type
    const scores = await this.calculateInteractionScores(interactions, voiceSessions, toUserId, fromUserId, guildId);

    // Calculate time range
    const timeRange = this.calculateTimeRange(interactions);

    // Calculate relative score and rank
    const { relativeScore, rank } = await this.calculateRelativeMetrics(fromUserId, guildId, scores.total);

    return {
      fromUserId,
      toUserId,
      guildId,
      totalScore: scores.total,
      breakdown: scores.breakdown,
      interactionCounts: scores.counts,
      timeRange,
      relativeScore,
      rank,
      vcDetails: scores.vcDetails,
    };
  }

  /**
   * Calculate reverse affinity (USER_2 to USER_1) and provide full analysis
   */
  async analyzeRelationship(
    user1Id: string,
    user2Id: string,
    guildId: string
  ): Promise<AffinityAnalysis> {
    const [user1, user2, affinity, reverseAffinity] = await Promise.all([
      this.dbService.getUser(user1Id, guildId),
      this.dbService.getUser(user2Id, guildId),
      this.calculateAffinity(user1Id, user2Id, guildId),
      this.calculateAffinity(user2Id, user1Id, guildId),
    ]);

    const mutualScore = affinity.totalScore + reverseAffinity.totalScore;
    const relationshipType = this.determineRelationshipType(mutualScore, affinity.totalScore, reverseAffinity.totalScore);
    const insights = this.generateInsights(affinity, reverseAffinity, user1, user2);

    return {
      user1,
      user2,
      affinity,
      reverseAffinity,
      mutualScore,
      relationshipType,
      insights,
    };
  }

  /**
   * Get top relationships for a user
   */
  async getTopRelationships(
    userId: string,
    guildId: string,
    limit: number = 10
  ): Promise<AffinityScore[]> {
    const collections = this.dbService.getCollections();

    // Get all unique users this person has interacted with (text interactions)
    const textInteractions = await collections.userInteractions
      .aggregate([
        {
          $match: {
            fromUserId: userId,
            guildId,
            timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
          }
        },
        { $group: { _id: '$toUserId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 25 } // Top 25 text interaction users
      ])
      .toArray();

    // Get all unique users this person has spent VC time with
    const vcInteractions = await collections.voiceSessions
      .aggregate([
        {
          $match: {
            userId,
            guildId,
            // Include both completed and active sessions
          }
        },
        {
          $lookup: {
            from: 'voiceSessions',
            let: { userId: '$userId', channelId: '$channelId', joinedAt: '$joinedAt', leftAt: '$leftAt' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $ne: ['$userId', '$$userId'] },
                      { $eq: ['$channelId', '$$channelId'] },
                      { $eq: ['$guildId', guildId] }
                    ]
                  }
                }
              }
            ],
            as: 'overlappingSessions'
          }
        },
        {
          $unwind: '$overlappingSessions'
        },
        {
          $group: {
            _id: '$overlappingSessions.userId',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 25 // Top 25 VC interaction users
        }
      ])
      .toArray();

    // Combine both lists and deduplicate
    const allUserIds = new Set<string>();

    // Add text interaction users
    for (const interaction of textInteractions) {
      allUserIds.add(interaction._id);
    }

    // Add VC interaction users
    for (const interaction of vcInteractions) {
      allUserIds.add(interaction._id);
    }

    const relationships: AffinityScore[] = [];

    for (const targetUserId of allUserIds) {
      const affinity = await this.calculateAffinity(userId, targetUserId, guildId);
      if (affinity.totalScore > 0) {
        relationships.push(affinity);
      }
    }

    return relationships
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit);
  }

  private async calculateInteractionScores(
    interactions: UserInteraction[],
    voiceSessions: VoiceSession[],
    targetUserId: string,
    fromUserId: string,
    guildId: string
  ) {
    let reactions = 0;
    let mentions = 0;
    let replies = 0;
    let vcRelativeScore = 0;

    let reactionCount = 0;
    let mentionCount = 0;
    let replyCount = 0;
    let vcSessionCount = 0;

    const now = new Date();

    // Process each interaction
    for (const interaction of interactions) {
      const timeDecay = this.calculateTimeDecay(interaction.timestamp, now);

      switch (interaction.interactionType) {
        case 'reaction':
          reactions += this.SCORING_WEIGHTS.reactions * timeDecay;
          reactionCount++;
          break;
        case 'mention':
          mentions += this.SCORING_WEIGHTS.mentions * timeDecay;
          mentionCount++;
          break;
        case 'reply':
          replies += this.SCORING_WEIGHTS.replies * timeDecay;
          replyCount++;
          break;
      }
    }

    // Calculate VC time with target user using overlap detection
    const vcTimeData = await this.calculateVCTimeWithUser(fromUserId, targetUserId, guildId, voiceSessions);

    // Use relative VC score as the primary affinity indicator
    // This represents what percentage of total VC time is spent with this specific user
    const vcRelativeScoreValue = vcTimeData.relativeScore; // Already calculated as percentage
    vcRelativeScore = vcRelativeScoreValue * this.SCORING_WEIGHTS.vcRelativeScore;
    vcSessionCount = vcTimeData.sessionCount;

    const total = reactions + mentions + replies + vcRelativeScore;

    return {
      total,
      breakdown: {
        reactions,
        mentions,
        replies,
        vcRelativeScore,
      },
      counts: {
        reactions: reactionCount,
        mentions: mentionCount,
        replies: replyCount,
        vcSessions: vcSessionCount,
      },
      vcDetails: vcTimeData, // Additional VC-specific data
    };
  }

  private calculateTimeDecay(timestamp: Date, now: Date): number {
    const daysDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff <= this.TIME_DECAY_DAYS) {
      return 1.0; // Full weight for recent interactions
    }

    // Exponential decay for older interactions
    const decayFactor = Math.exp(-(daysDiff - this.TIME_DECAY_DAYS) / 30);
    return Math.max(0.1, decayFactor); // Minimum 10% weight
  }

  private calculateTimeRange(interactions: UserInteraction[]): {
    firstInteraction: Date | null;
    lastInteraction: Date | null;
    daysActive: number;
  } {
    if (interactions.length === 0) {
      return {
        firstInteraction: null,
        lastInteraction: null,
        daysActive: 0,
      };
    }

    const timestamps = interactions.map(i => i.timestamp);
    const firstInteraction = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const lastInteraction = new Date(Math.max(...timestamps.map(t => t.getTime())));
    const daysActive = (lastInteraction.getTime() - firstInteraction.getTime()) / (1000 * 60 * 60 * 24);

    return {
      firstInteraction,
      lastInteraction,
      daysActive: Math.round(daysActive),
    };
  }

  private async calculateRelativeMetrics(
    userId: string,
    guildId: string,
    currentScore: number
  ): Promise<{ relativeScore: number; rank: number }> {
    const collections = this.dbService.getCollections();

    // Get all users this person has interacted with (recent interactions only)
    const interactionStats = await collections.userInteractions
      .aggregate([
        {
          $match: {
            fromUserId: userId,
            guildId,
            timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: '$toUserId',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
      .toArray();

    if (interactionStats.length === 0) {
      return { relativeScore: 0, rank: 1 };
    }

    // Calculate relative score based on percentile
    const scores = interactionStats.map((stat: any) => stat.count).sort((a: number, b: number) => b - a);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length;

    // Normalize score: 0-100 scale based on percentile
    const percentile = scores.findIndex((score: number) => score <= currentScore) / scores.length;
    const relativeScore = Math.min(percentile * 100, 100);

    // Calculate rank
    const rank = scores.findIndex((score: number) => score <= currentScore) + 1;

    return { relativeScore, rank };
  }

  private determineRelationshipType(
    mutualScore: number,
    score1to2: number,
    score2to1: number
  ): 'strong' | 'moderate' | 'weak' | 'none' {
    // Thresholds based on VC relative score prioritization
    // Since VC relative score is now the primary factor (50x weight)
    if (mutualScore >= 100) return 'strong';  // 2%+ relative VC time combined
    if (mutualScore >= 50) return 'moderate';  // 1%+ relative VC time combined
    if (mutualScore >= 10) return 'weak';     // 0.2%+ relative VC time combined
    return 'none';
  }

  private generateInsights(
    affinity: AffinityScore,
    reverseAffinity: AffinityScore,
    user1: User | null,
    user2: User | null
  ): string[] {
    const insights: string[] = [];

    // Basic relationship strength
    if (affinity.totalScore > reverseAffinity.totalScore) {
      insights.push(`${user1?.displayName || 'User 1'} initiates more interactions with ${user2?.displayName || 'User 2'}`);
    } else if (reverseAffinity.totalScore > affinity.totalScore) {
      insights.push(`${user2?.displayName || 'User 2'} initiates more interactions with ${user1?.displayName || 'User 1'}`);
    } else if (affinity.totalScore > 0) {
      insights.push('Both users initiate interactions equally');
    }

    // Interaction type analysis
    const totalInteractions = affinity.interactionCounts.reactions +
      affinity.interactionCounts.mentions +
      affinity.interactionCounts.replies;

    if (affinity.interactionCounts.replies > totalInteractions * 0.4) {
      insights.push('High level of direct conversation (many replies)');
    }
    if (affinity.interactionCounts.mentions > totalInteractions * 0.3) {
      insights.push('Frequent mentions suggest close relationship');
    }
    // VC-specific insights (now prioritized)
    if (affinity.vcDetails) {
      const vcDetails = affinity.vcDetails;

      if (vcDetails.totalMinutes > 60) {
        insights.push(`Extensive voice chat time together (${Math.round(vcDetails.totalMinutes)} minutes)`);
      } else if (vcDetails.totalMinutes > 10) {
        insights.push(`Moderate voice chat time together (${Math.round(vcDetails.totalMinutes)} minutes)`);
      }

      // VC relative score is now the primary affinity indicator
      if (vcDetails.relativeScore > 20) {
        insights.push(`Very high VC affinity - ${vcDetails.relativeScore.toFixed(1)}% of total VC time spent together`);
      } else if (vcDetails.relativeScore > 10) {
        insights.push(`High VC affinity - ${vcDetails.relativeScore.toFixed(1)}% of total VC time spent together`);
      } else if (vcDetails.relativeScore > 2) {
        insights.push(`Moderate VC affinity - ${vcDetails.relativeScore.toFixed(1)}% of total VC time spent together`);
      } else if (vcDetails.relativeScore > 0) {
        insights.push(`Low VC affinity - ${vcDetails.relativeScore.toFixed(1)}% of total VC time spent together`);
      }

      if (vcDetails.topChannels.length > 0) {
        const topChannel = vcDetails.topChannels[0];
        insights.push(`Most time spent in "${topChannel.channelName}" (${Math.round(topChannel.minutes)} minutes)`);
      }

      if (vcDetails.averageSessionLength > 30) {
        insights.push(`Long average VC sessions (${Math.round(vcDetails.averageSessionLength)} minutes)`);
      }
    } else if (affinity.breakdown.vcRelativeScore > 10) {
      insights.push('Significant voice chat time together');
    }

    // Time-based insights
    if (affinity.timeRange.daysActive > 30) {
      insights.push('Long-term relationship (30+ days)');
    }
    if (affinity.timeRange.lastInteraction) {
      const daysSinceLastInteraction = (Date.now() - affinity.timeRange.lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastInteraction > 7) {
        insights.push('No recent interactions (7+ days)');
      } else if (daysSinceLastInteraction < 1) {
        insights.push('Very recent interaction');
      }
    }

    // Relative ranking
    if (affinity.rank <= 3) {
      insights.push(`Top ${affinity.rank} relationship for ${user1?.displayName || 'User 1'}`);
    }

    return insights;
  }

  /**
   * Calculate VC time spent together with another user using overlap detection
   */
  private async calculateVCTimeWithUser(
    fromUserId: string,
    targetUserId: string,
    guildId: string,
    fromUserSessions: VoiceSession[]
  ): Promise<{
    totalMinutes: number;
    sessionCount: number;
    averageSessionLength: number;
    relativeScore: number; // How much time spent with this user vs others
    topChannels: Array<{ channelName: string; minutes: number }>;
  }> {
    const collections = this.dbService.getCollections();

    // Get target user's voice sessions (all time)
    const targetUserSessions = await collections.voiceSessions
      .find({
        userId: targetUserId,
        guildId,
        // Include both completed and active sessions
      })
      .sort({ joinedAt: -1 })
      .limit(500) // Increased limit for all-time data
      .toArray();

    // Find overlapping sessions
    const overlappingSessions = this.findOverlappingSessions(fromUserSessions, targetUserSessions);

    // Calculate total time together
    let totalMinutes = 0;
    const channelTimeMap = new Map<string, number>();

    for (const overlap of overlappingSessions) {
      const durationMinutes = overlap.durationMinutes;
      totalMinutes += durationMinutes;

      // Track time per channel
      const channelName = overlap.channelName;
      channelTimeMap.set(channelName, (channelTimeMap.get(channelName) || 0) + durationMinutes);
    }

    // Calculate relative score - time with this user vs time with all other users
    // This represents what percentage of fromUserId's total VC time is spent with targetUserId
    const totalVCTime = await this.getTotalVCTimeForUser(fromUserId, guildId);
    const relativeScore = totalVCTime > 0 ? (totalMinutes / totalVCTime) * 100 : 0;

    // Get top channels
    const topChannels = Array.from(channelTimeMap.entries())
      .map(([channelName, minutes]) => ({ channelName, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);

    return {
      totalMinutes,
      sessionCount: overlappingSessions.length,
      averageSessionLength: overlappingSessions.length > 0 ? totalMinutes / overlappingSessions.length : 0,
      relativeScore,
      topChannels,
    };
  }

  /**
   * Find overlapping voice sessions between two users
   */
  private findOverlappingSessions(
    user1Sessions: VoiceSession[],
    user2Sessions: VoiceSession[]
  ): Array<{
    channelName: string;
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
  }> {
    const overlaps: Array<{
      channelName: string;
      startTime: Date;
      endTime: Date;
      durationMinutes: number;
    }> = [];

    for (const session1 of user1Sessions) {
      for (const session2 of user2Sessions) {
        // Skip if same user (shouldn't happen but just in case)
        if (session1.userId === session2.userId) continue;

        // Check if sessions are in the same channel
        if (session1.channelId !== session2.channelId) continue;

        // Handle active sessions (no leftAt) by using current time
        const session1End = session1.leftAt || new Date();
        const session2End = session2.leftAt || new Date();

        // Check for time overlap
        const overlap = this.calculateTimeOverlap(
          session1.joinedAt,
          session1End,
          session2.joinedAt,
          session2End
        );

        if (overlap.durationMinutes > 0) {
          overlaps.push({
            channelName: session1.channelName,
            startTime: overlap.startTime,
            endTime: overlap.endTime,
            durationMinutes: overlap.durationMinutes,
          });
        }
      }
    }

    // Deduplicate overlapping sessions by merging overlapping time ranges
    return this.mergeOverlappingTimeRanges(overlaps);
  }

  /**
   * Merge overlapping time ranges to avoid double-counting
   */
  private mergeOverlappingTimeRanges(
    overlaps: Array<{
      channelName: string;
      startTime: Date;
      endTime: Date;
      durationMinutes: number;
    }>
  ): Array<{
    channelName: string;
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
  }> {
    if (overlaps.length === 0) return overlaps;

    // Group by channel
    const channelGroups = new Map<string, typeof overlaps>();
    for (const overlap of overlaps) {
      if (!channelGroups.has(overlap.channelName)) {
        channelGroups.set(overlap.channelName, []);
      }
      channelGroups.get(overlap.channelName)!.push(overlap);
    }

    const merged: typeof overlaps = [];

    for (const [channelName, channelOverlaps] of channelGroups) {
      // Sort by start time
      channelOverlaps.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      let current = channelOverlaps[0];
      for (let i = 1; i < channelOverlaps.length; i++) {
        const next = channelOverlaps[i];

        // If next overlap starts before current ends, merge them
        if (next.startTime <= current.endTime) {
          current = {
            channelName,
            startTime: current.startTime,
            endTime: new Date(Math.max(current.endTime.getTime(), next.endTime.getTime())),
            durationMinutes: (Math.max(current.endTime.getTime(), next.endTime.getTime()) - current.startTime.getTime()) / (1000 * 60)
          };
        } else {
          // No overlap, add current and move to next
          merged.push(current);
          current = next;
        }
      }
      merged.push(current);
    }

    return merged;
  }

  /**
   * Calculate time overlap between two time ranges
   */
  private calculateTimeOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): {
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
  } {
    const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
    const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));

    if (overlapStart >= overlapEnd) {
      return {
        startTime: overlapStart,
        endTime: overlapEnd,
        durationMinutes: 0,
      };
    }

    const durationMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60);

    return {
      startTime: overlapStart,
      endTime: overlapEnd,
      durationMinutes,
    };
  }

  /**
   * Get total VC time for a user (for relative scoring)
   */
  private async getTotalVCTimeForUser(userId: string, guildId: string): Promise<number> {
    const collections = this.dbService.getCollections();

    // Use aggregation for better performance - all time data
    const result = await collections.voiceSessions
      .aggregate([
        {
          $match: {
            userId,
            guildId,
            // Include both completed and active sessions
          }
        },
        {
          $project: {
            durationMinutes: {
              $divide: [
                {
                  $subtract: [
                    { $ifNull: ["$leftAt", "$$NOW"] }, // Use current time if leftAt is null
                    "$joinedAt"
                  ]
                },
                60000 // Convert milliseconds to minutes
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalMinutes: { $sum: "$durationMinutes" }
          }
        }
      ])
      .toArray();

    return result.length > 0 ? result[0].totalMinutes : 0;
  }
}
