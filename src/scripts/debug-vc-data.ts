import { DatabaseService } from '../services/DatabaseService';
import { closeDatabase } from '../utils/database';
import { config } from '../config';

async function debugVCData() {
  const dbService = new DatabaseService();

  try {
    console.log('🔹 Initializing database service...');
    await dbService.initialize();

    const collections = dbService.getCollections();
    const guildId = config.guildId;

    if (!guildId) {
      console.error('🔸 No guild ID configured');
      return;
    }

    console.log(`🔹 Debugging VC data for guild ${guildId}...`);

    // Get all voice sessions
    const allSessions = await collections.voiceSessions
      .find({ guildId })
      .sort({ joinedAt: -1 })
      .toArray();

    console.log(`🔹 Total voice sessions in database: ${allSessions.length}`);

    // Check for data quality issues
    console.log('\n🔍 DATA QUALITY CHECKS');
    console.log('═══════════════════════════════════════');

    // 1. Check for sessions with missing data
    const missingChannelName = allSessions.filter((s: { channelName: string; }) => !s.channelName || s.channelName.startsWith('Channel '));
    const missingDuration = allSessions.filter((s: { duration: any; leftAt: any; }) => !s.duration && s.leftAt);
    const missingLeftAt = allSessions.filter((s: { leftAt: any; }) => !s.leftAt);
    const invalidDurations = allSessions.filter((s: { duration: number; }) => s.duration && (s.duration < 0 || s.duration > 86400)); // > 24 hours

    console.log(`📊 Sessions with missing/invalid channel names: ${missingChannelName.length}`);
    console.log(`📊 Sessions with missing duration (but have leftAt): ${missingDuration.length}`);
    console.log(`📊 Sessions without leftAt (still active?): ${missingLeftAt.length}`);
    console.log(`📊 Sessions with invalid durations (>24h or <0): ${invalidDurations.length}`);

    // 2. Check for duplicate sessions
    const sessionKeys = new Map<string, number>();
    allSessions.forEach((session: { userId: any; channelId: any; joinedAt: { getTime: () => any; }; }) => {
      const key = `${session.userId}-${session.channelId}-${session.joinedAt.getTime()}`;
      sessionKeys.set(key, (sessionKeys.get(key) || 0) + 1);
    });
    const duplicates = Array.from(sessionKeys.entries()).filter(([_, count]) => count > 1);
    console.log(`📊 Potential duplicate sessions: ${duplicates.length}`);

    // 3. Check for overlapping sessions (same user in multiple channels)
    const userSessions = new Map<string, any[]>();
    allSessions.forEach((session: { userId: any; channelId: any; joinedAt: { getTime: () => any; }; }) => {
      if (!userSessions.has(session.userId)) {
        userSessions.set(session.userId, []);
      }
      userSessions.get(session.userId)!.push(session);
    });

    let overlappingSessions = 0;
    for (const [userId, sessions] of userSessions) {
      const sortedSessions = sessions.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
      for (let i = 0; i < sortedSessions.length - 1; i++) {
        const current = sortedSessions[i];
        const next = sortedSessions[i + 1];
        if (current.leftAt && next.joinedAt < current.leftAt) {
          overlappingSessions++;
        }
      }
    }
    console.log(`📊 Overlapping sessions (same user in multiple channels): ${overlappingSessions}`);

    // 4. Check for sessions with impossible durations
    const impossibleDurations = allSessions.filter((s: { leftAt: { getTime: () => any; }; joinedAt: { getTime: () => any; }; duration: any; }) => {
      if (!s.leftAt || !s.joinedAt || !s.duration) return false;
      const calculatedDuration = Math.floor((s.leftAt.getTime() - s.joinedAt.getTime()) / 1000);
      return Math.abs(calculatedDuration - s.duration) > 5; // 5 second tolerance
    });
    console.log(`📊 Sessions with duration mismatches: ${impossibleDurations.length}`);

    // 5. Check for sessions in the future
    const now = new Date();
    const futureSessions = allSessions.filter((s: { joinedAt: { getTime: () => any; }; }) => s.joinedAt > now);
    console.log(`📊 Sessions in the future: ${futureSessions.length}`);

    // 6. Check for very old sessions
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const veryOldSessions = allSessions.filter((s: { joinedAt: { getTime: () => any; }; }) => s.joinedAt < oneYearAgo);
    console.log(`📊 Sessions older than 1 year: ${veryOldSessions.length}`);

    // 7. Check channel distribution
    const channelStats = new Map<string, { count: number, totalDuration: number, channelName: string }>();
    allSessions.forEach((session: { channelId: any; duration: any; channelName: any; }) => {
      const key = session.channelId;
      const existing = channelStats.get(key) || { count: 0, totalDuration: 0, channelName: session.channelName || 'Unknown' };
      channelStats.set(key, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + (session.duration || 0),
        channelName: session.channelName || 'Unknown'
      });
    });

    console.log('\n🎵 CHANNEL DISTRIBUTION');
    console.log('═══════════════════════════════════════');
    const sortedChannels = Array.from(channelStats.entries())
      .map(([channelId, stats]) => ({ channelId, ...stats }))
      .sort((a, b) => b.count - a.count);

    sortedChannels.forEach((channel, index) => {
      const avgDuration = channel.count > 0 ? Math.round(channel.totalDuration / channel.count) : 0;
      console.log(`${index + 1}. ${channel.channelName} (${channel.channelId}): ${channel.count} sessions, avg ${Math.round(avgDuration / 60)} min`);
    });

    // 8. Check for suspicious patterns
    console.log('\n🚨 SUSPICIOUS PATTERNS');
    console.log('═══════════════════════════════════════');

    // Very short sessions (might be connection issues)
    const veryShortSessions = allSessions.filter((s: { duration: number; }) => s.duration && s.duration < 10); // < 10 seconds
    console.log(`🔸 Very short sessions (<10s): ${veryShortSessions.length}`);

    // Very long sessions (might be data errors)
    const veryLongSessions = allSessions.filter((s: { duration: number; }) => s.duration && s.duration > 28800); // > 8 hours
    console.log(`🔸 Very long sessions (>8h): ${veryLongSessions.length}`);

    // Sessions with same join/leave time
    const instantSessions = allSessions.filter((s: { leftAt: { getTime: () => any; }; joinedAt: { getTime: () => any; }; }) => s.leftAt && s.joinedAt.getTime() === s.leftAt.getTime());
    console.log(`🔸 Instant sessions (same join/leave time): ${instantSessions.length}`);

    // 9. Show sample problematic sessions
    if (missingChannelName.length > 0) {
      console.log('\n📋 SAMPLE SESSIONS WITH MISSING CHANNEL NAMES');
      console.log('═══════════════════════════════════════');
      missingChannelName.slice(0, 5).forEach((session: { userId: any; channelName: any; channelId: any; joinedAt: { toLocaleString: () => any; }; duration: number; }, index: number) => {
        console.log(`${index + 1}. User ${session.userId} in ${session.channelName || 'Unknown'} (${session.channelId})`);
        console.log(`   Joined: ${session.joinedAt.toLocaleString()}`);
        console.log(`   Duration: ${session.duration ? Math.round(session.duration / 60) + ' min' : 'Unknown'}`);
        console.log('');
      });
    }

    if (impossibleDurations.length > 0) {
      console.log('\n📋 SAMPLE SESSIONS WITH DURATION MISMATCHES');
      console.log('═══════════════════════════════════════');
      impossibleDurations.slice(0, 5).forEach((session: { leftAt: any; joinedAt: { getTime: () => number; }; userId: any; channelName: any; duration: number; }, index: number) => {
        const calculatedDuration = Math.floor((session.leftAt!.getTime() - session.joinedAt.getTime()) / 1000);
        console.log(`${index + 1}. User ${session.userId} in ${session.channelName || 'Unknown'}`);
        console.log(`   Stored duration: ${session.duration} seconds`);
        console.log(`   Calculated duration: ${calculatedDuration} seconds`);
        console.log(`   Difference: ${Math.abs(calculatedDuration - session.duration)} seconds`);
        console.log('');
      });
    }

    if (veryLongSessions.length > 0) {
      console.log('\n📋 SAMPLE VERY LONG SESSIONS');
      console.log('═══════════════════════════════════════');
      veryLongSessions.slice(0, 5).forEach((session: { userId: any; channelName: any; duration: any; joinedAt: { toLocaleString: () => any; }; leftAt: { toLocaleString: () => any; }; }, index: number) => {
        console.log(`${index + 1}. User ${session.userId} in ${session.channelName || 'Unknown'}`);
        console.log(`   Duration: ${Math.round(session.duration! / 60)} minutes (${Math.round(session.duration! / 3600)} hours)`);
        console.log(`   Joined: ${session.joinedAt.toLocaleString()}`);
        console.log(`   Left: ${session.leftAt?.toLocaleString() || 'Still active'}`);
        console.log('');
      });
    }

    // 10. Time range analysis
    const oldestSession = allSessions[allSessions.length - 1];
    const newestSession = allSessions[0];

    console.log('\n⏰ TIME RANGE ANALYSIS');
    console.log('═══════════════════════════════════════');
    console.log(`📅 Oldest session: ${oldestSession?.joinedAt.toLocaleString()}`);
    console.log(`📅 Newest session: ${newestSession?.joinedAt.toLocaleString()}`);

    if (oldestSession && newestSession) {
      const timeSpan = newestSession.joinedAt.getTime() - oldestSession.joinedAt.getTime();
      const daysSpan = Math.floor(timeSpan / (1000 * 60 * 60 * 24));
      console.log(`📅 Data spans: ${daysSpan} days`);
    }

    console.log('\n🔹 VC data debugging completed');

  } catch (error) {
    console.error('🔸 Error debugging VC data:', error);
    process.exit(1);
  } finally {
    await dbService.close();
    await closeDatabase();
  }
}

// Main execution
async function main() {
  console.log('🔹 Starting VC data debugging...');
  await debugVCData();
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🔸 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔸 Unhandled Rejection:', { reason, promise });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🔹 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🔹 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main();
