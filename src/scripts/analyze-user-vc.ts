import { DatabaseService } from '../services/DatabaseService';
import { closeDatabase } from '../utils/database';
import { config } from '../config';

async function analyzeUserVC(targetUserId: string) {
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

    console.log(`🔹 Analyzing VC activity for user ${targetUserId} in guild ${guildId}...`);

    // Get user data
    const user = await collections.users.findOne({ discordId: targetUserId, guildId });
    if (!user) {
      console.error(`❌ User ${targetUserId} not found in database`);
      return;
    }

    console.log(`\n👤 USER INFO:`);
    console.log('═══════════════════════════════════════');
    console.log(`Username: ${user.username}`);
    console.log(`Display Name: ${user.displayName}`);
    console.log(`Discord ID: ${user.discordId}`);
    console.log(`Bot: ${user.bot ? 'Yes' : 'No'}`);
    console.log(`Last Seen: ${user.lastSeen}`);

    // Get all voice sessions for this user
    const voiceSessions = await collections.voiceSessions
      .find({ userId: targetUserId, guildId })
      .sort({ joinedAt: -1 })
      .toArray();

    console.log(`\n🎤 VOICE SESSIONS (${voiceSessions.length} total):`);
    console.log('═══════════════════════════════════════');

    if (voiceSessions.length === 0) {
      console.log('❌ No voice sessions found for this user');
      return;
    }

    // Calculate statistics
    const totalDuration = voiceSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    const avgDuration = voiceSessions.length > 0 ? Math.round(totalDuration / voiceSessions.length) : 0;
    const minDuration = Math.min(...voiceSessions.map(s => s.duration || 0));
    const maxDuration = Math.max(...voiceSessions.map(s => s.duration || 0));

    console.log(`📊 Total Duration: ${Math.round(totalDuration / 60)} minutes (${Math.round(totalDuration / 3600)} hours)`);
    console.log(`📊 Average Duration: ${Math.round(avgDuration / 60)} minutes`);
    console.log(`📊 Shortest Session: ${Math.round(minDuration / 60)} minutes`);
    console.log(`📊 Longest Session: ${Math.round(maxDuration / 60)} minutes`);

    // Group by channel
    const channelStats = new Map<string, { count: number, totalDuration: number, channelName: string }>();
    voiceSessions.forEach(session => {
      const key = session.channelId;
      const existing = channelStats.get(key) || { count: 0, totalDuration: 0, channelName: session.channelName || 'Unknown' };
      channelStats.set(key, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + (session.duration || 0),
        channelName: session.channelName || 'Unknown'
      });
    });

    console.log(`\n🎵 CHANNEL BREAKDOWN:`);
    console.log('═══════════════════════════════════════');
    const sortedChannels = Array.from(channelStats.entries())
      .map(([channelId, stats]) => ({ channelId, ...stats }))
      .sort((a, b) => b.totalDuration - a.totalDuration);

    sortedChannels.forEach((channel, index) => {
      const avgDuration = channel.count > 0 ? Math.round(channel.totalDuration / channel.count) : 0;
      console.log(`${index + 1}. ${channel.channelName} (${channel.channelId})`);
      console.log(`   Sessions: ${channel.count}`);
      console.log(`   Total Time: ${Math.round(channel.totalDuration / 60)} minutes`);
      console.log(`   Average: ${Math.round(avgDuration / 60)} minutes per session`);
      console.log('');
    });

    // Check for suspicious patterns
    console.log(`\n🔍 DATA QUALITY ANALYSIS:`);
    console.log('═══════════════════════════════════════');

    // Very long sessions (>8 hours)
    const veryLongSessions = voiceSessions.filter(s => s.duration && s.duration > 28800); // > 8 hours
    console.log(`🔸 Very long sessions (>8h): ${veryLongSessions.length}`);

    // Very short sessions (<1 minute)
    const veryShortSessions = voiceSessions.filter(s => s.duration && s.duration < 60); // < 1 minute
    console.log(`🔸 Very short sessions (<1m): ${veryShortSessions.length}`);

    // Sessions with missing duration
    const missingDuration = voiceSessions.filter(s => !s.duration && s.leftAt);
    console.log(`🔸 Sessions with missing duration: ${missingDuration.length}`);

    // Sessions without leftAt (still active)
    const activeSessions = voiceSessions.filter(s => !s.leftAt);
    console.log(`🔸 Active sessions (no leftAt): ${activeSessions.length}`);

    // Sessions with duration mismatches
    const durationMismatches = voiceSessions.filter(s => {
      if (!s.leftAt || !s.duration) return false;
      const calculatedDuration = Math.floor((s.leftAt.getTime() - s.joinedAt.getTime()) / 1000);
      return Math.abs(calculatedDuration - s.duration) > 5; // 5 second tolerance
    });
    console.log(`🔸 Sessions with duration mismatches: ${durationMismatches.length}`);

    // Show detailed session list
    console.log(`\n📋 DETAILED SESSION LIST:`);
    console.log('═══════════════════════════════════════');
    voiceSessions.forEach((session, index) => {
      const duration = session.duration || 0;
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const status = session.leftAt ? 'Completed' : 'Active';

      console.log(`${index + 1}. ${session.channelName || 'Unknown'} (${session.channelId})`);
      console.log(`   Joined: ${session.joinedAt.toLocaleString()}`);
      console.log(`   Left: ${session.leftAt?.toLocaleString() || 'Still active'}`);
      console.log(`   Duration: ${hours}h ${minutes}m (${duration} seconds)`);
      console.log(`   Status: ${status}`);

      // Check for data quality issues
      if (duration > 28800) {
        console.log(`   ⚠️  VERY LONG SESSION (>8 hours)`);
      }
      if (duration < 60 && session.leftAt) {
        console.log(`   ⚠️  VERY SHORT SESSION (<1 minute)`);
      }
      if (!session.duration && session.leftAt) {
        console.log(`   ⚠️  MISSING DURATION`);
      }
      if (session.leftAt) {
        const calculatedDuration = Math.floor((session.leftAt.getTime() - session.joinedAt.getTime()) / 1000);
        if (Math.abs(calculatedDuration - duration) > 5) {
          console.log(`   ⚠️  DURATION MISMATCH (calculated: ${calculatedDuration}s, stored: ${duration}s)`);
        }
      }
      console.log('');
    });

    // Time range analysis
    const oldestSession = voiceSessions[voiceSessions.length - 1];
    const newestSession = voiceSessions[0];

    console.log(`\n⏰ TIME RANGE:`);
    console.log('═══════════════════════════════════════');
    console.log(`📅 Oldest session: ${oldestSession?.joinedAt.toLocaleString()}`);
    console.log(`📅 Newest session: ${newestSession?.joinedAt.toLocaleString()}`);

    if (oldestSession && newestSession) {
      const timeSpan = newestSession.joinedAt.getTime() - oldestSession.joinedAt.getTime();
      const daysSpan = Math.floor(timeSpan / (1000 * 60 * 60 * 24));
      console.log(`📅 Data spans: ${daysSpan} days`);
    }

    console.log('\n🔹 User VC analysis completed');

  } catch (error) {
    console.error('🔸 Error analyzing user VC:', error);
    process.exit(1);
  } finally {
    await dbService.close();
    await closeDatabase();
  }
}

// Parse command line arguments
function parseArgs(): { userId: string } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx src/scripts/analyze-user-vc.ts <user_id>');
    console.log('Example: npx tsx src/scripts/analyze-user-vc.ts 354823920010002432');
    process.exit(1);
  }

  return { userId: args[0] };
}

// Main execution
async function main() {
  const { userId } = parseArgs();
  console.log(`🔹 Starting VC analysis for user ${userId}...`);
  await analyzeUserVC(userId);
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
