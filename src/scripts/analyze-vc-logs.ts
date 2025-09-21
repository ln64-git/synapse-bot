import { DatabaseService } from '../services/DatabaseService';
import { closeDatabase } from '../utils/database';
import { config } from '../config';

interface AnalysisOptions {
  days?: number;
  topUsers?: number;
  topChannels?: number;
  showRecent?: boolean;
  showStats?: boolean;
}

async function analyzeVCLogs(options: AnalysisOptions = {}) {
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

    console.log(`🔹 Analyzing VC logs for guild ${guildId}...`);

    // Get date range
    const days = options.days || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.log(`🔹 Analyzing data from last ${days} days (since ${startDate.toLocaleDateString()})`);

    // Get voice sessions in date range
    const voiceSessions = await collections.voiceSessions
      .find({
        guildId,
        joinedAt: { $gte: startDate }
      })
      .sort({ joinedAt: -1 })
      .toArray();

    console.log(`🔹 Found ${voiceSessions.length} voice sessions in the last ${days} days`);

    if (options.showStats) {
      // Overall statistics
      const totalSessions = await collections.voiceSessions.countDocuments({ guildId });
      const totalDuration = voiceSessions.reduce((sum: number, session: any) => sum + (session.duration || 0), 0);
      const avgDuration = voiceSessions.length > 0 ? Math.round(totalDuration / voiceSessions.length) : 0;

      console.log('\n📊 VOICE SESSION STATISTICS');
      console.log('═══════════════════════════════════════');
      console.log(`📅 Period: Last ${days} days`);
      console.log(`🎤 Total Sessions: ${voiceSessions.length}`);
      console.log(`⏱️  Total Duration: ${Math.round(totalDuration / 60)} minutes`);
      console.log(`📈 Average Duration: ${Math.round(avgDuration / 60)} minutes`);
      console.log(`📊 All Time Sessions: ${totalSessions}`);
    }

    if (options.topUsers) {
      // Top users by session count
      const userStats = new Map<string, { count: number, totalDuration: number, username?: string }>();

      for (const session of voiceSessions) {
        const existing = userStats.get(session.userId) || { count: 0, totalDuration: 0 };
        userStats.set(session.userId, {
          count: existing.count + 1,
          totalDuration: existing.totalDuration + (session.duration || 0)
        });
      }

      // Fetch user data for display names
      const userIds = Array.from(userStats.keys());
      const userData = new Map<string, { username: string, displayName?: string }>();

      for (const userId of userIds) {
        const user = await collections.users.findOne({ discordId: userId, guildId }) as any;
        if (user) {
          userData.set(userId, {
            username: user.username || 'Unknown',
            displayName: user.displayName
          });
        }
      }

      const topUsers = Array.from(userStats.entries())
        .map(([userId, stats]) => {
          const userInfo = userData.get(userId);
          const displayName = userInfo?.displayName || userInfo?.username || `User ${userId}`;
          return { userId, displayName, ...stats };
        })
        .sort((a, b) => b.totalDuration - a.totalDuration)
        .slice(0, options.topUsers);

      console.log(`\n👥 TOP ${options.topUsers} USERS BY TIME SPENT IN VC`);
      console.log('═══════════════════════════════════════');
      topUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.displayName}: ${Math.round(user.totalDuration / 60)} min (${user.count} sessions)`);
      });
    }

    if (options.topChannels) {
      // Top channels by session count
      const channelStats = new Map<string, { count: number, totalDuration: number, channelName: string }>();

      for (const session of voiceSessions) {
        const existing = channelStats.get(session.channelId) || { count: 0, totalDuration: 0, channelName: session.channelName || 'Unknown' };
        channelStats.set(session.channelId, {
          count: existing.count + 1,
          totalDuration: existing.totalDuration + (session.duration || 0),
          channelName: session.channelName || 'Unknown'
        });
      }

      const topChannels = Array.from(channelStats.entries())
        .map(([channelId, stats]) => ({ channelId, ...stats }))
        .sort((a, b) => b.count - a.count)
        .slice(0, options.topChannels);

      console.log(`\n🎵 TOP ${options.topChannels} CHANNELS BY SESSION COUNT`);
      console.log('═══════════════════════════════════════');
      topChannels.forEach((channel, index) => {
        console.log(`${index + 1}. ${channel.channelName}: ${channel.count} sessions (${Math.round(channel.totalDuration / 60)} min)`);
      });
    }

    if (options.showRecent) {
      // Recent sessions
      const recentSessions = voiceSessions.slice(0, 10);

      // Fetch user data for recent sessions
      const recentUserIds = [...new Set(recentSessions.map((s: any) => s.userId))];
      const recentUserData = new Map<string, { username: string, displayName?: string }>();

      for (const userId of recentUserIds) {
        const user = await collections.users.findOne({ discordId: String(userId), guildId });
        if (user) {
          const userObj = user as any;
          recentUserData.set(String(userId), {
            username: String(userObj.username || 'Unknown'),
            displayName: userObj.displayName ? String(userObj.displayName) : undefined
          });
        }
      }

      console.log('\n🕒 RECENT VOICE SESSIONS');
      console.log('═══════════════════════════════════════');
      recentSessions.forEach((session: any, index: number) => {
        const joinedAt = new Date(session.joinedAt).toLocaleString();
        const duration = session.duration ? Math.round(session.duration / 60) : 'Active';
        const status = session.leftAt ? 'Completed' : 'Active';

        const userInfo = recentUserData.get(session.userId);
        const displayName = userInfo?.displayName || userInfo?.username || `User ${session.userId}`;

        console.log(`${index + 1}. ${displayName} in ${session.channelName || 'Unknown'}`);
        console.log(`   Joined: ${joinedAt}`);
        console.log(`   Duration: ${duration} minutes (${status})`);
        if (session.leftAt) {
          console.log(`   Left: ${new Date(session.leftAt).toLocaleString()}`);
        }
        console.log('');
      });
    }

    // Hourly activity analysis
    const hourlyStats = new Map<number, number>();
    for (const session of voiceSessions) {
      const hour = new Date(session.joinedAt).getHours();
      hourlyStats.set(hour, (hourlyStats.get(hour) || 0) + 1);
    }

    console.log('\n⏰ HOURLY ACTIVITY PATTERN');
    console.log('═══════════════════════════════════════');
    for (let hour = 0; hour < 24; hour++) {
      const count = hourlyStats.get(hour) || 0;
      const bar = '█'.repeat(Math.min(Math.ceil(count / 5), 20));
      console.log(`${hour.toString().padStart(2, '0')}:00 ${bar} ${count}`);
    }

    console.log('\n🔹 VC logs analysis completed successfully');

  } catch (error) {
    console.error('🔸 Error analyzing VC logs:', error);
    process.exit(1);
  } finally {
    await dbService.close();
    await closeDatabase();
  }
}

// Parse command line arguments
function parseArgs(): AnalysisOptions {
  const args = process.argv.slice(2);
  const options: AnalysisOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--days':
        options.days = parseInt(args[i + 1]) || 7;
        i++;
        break;
      case '--top-users':
        options.topUsers = parseInt(args[i + 1]) || 10;
        i++;
        break;
      case '--top-channels':
        options.topChannels = parseInt(args[i + 1]) || 10;
        i++;
        break;
      case '--recent':
        options.showRecent = true;
        break;
      case '--stats':
        options.showStats = true;
        break;
      case '--all':
        options.showStats = true;
        options.showRecent = true;
        options.topUsers = 10;
        options.topChannels = 10;
        break;
      case '--help':
        console.log(`
VC Logs Analysis Tool

Usage: npx tsx src/scripts/analyze-vc-logs.ts [options]

Options:
  --days N              Analyze last N days (default: 7)
  --top-users N         Show top N users by time spent in VC (default: 10)
  --top-channels N      Show top N channels by session count (default: 10)
  --recent              Show recent voice sessions
  --stats               Show overall statistics
  --all                 Show all analysis (equivalent to --stats --recent --top-users 10 --top-channels 10)
  --help                Show this help message

Examples:
  npx tsx src/scripts/analyze-vc-logs.ts --all
  npx tsx src/scripts/analyze-vc-logs.ts --days 14 --top-users 5 --stats
  npx tsx src/scripts/analyze-vc-logs.ts --recent --days 3
        `);
        process.exit(0);
        break;
    }
  }

  return options;
}

// Main execution
async function main() {
  const options = parseArgs();

  // If no options provided, show all analysis
  if (Object.keys(options).length === 0) {
    options.showStats = true;
    options.showRecent = true;
    options.topUsers = 10;
    options.topChannels = 10;
  }

  console.log('🔹 Starting VC logs analysis...');
  console.log('🔹 Options:', options);

  await analyzeVCLogs(options);
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
