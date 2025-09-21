import { DatabaseService } from '../services/DatabaseService';
import { closeDatabase } from '../utils/database';
import { config } from '../config';

async function checkUser() {
  const dbService = new DatabaseService();

  try {
    console.log('🔹 Initializing database service...');
    await dbService.initialize();

    const collections = dbService.getCollections();
    const guildId = config.guildId;
    const targetUserId = '354823920010002432';

    if (!guildId) {
      console.error('🔸 No guild ID configured');
      return;
    }

    console.log(`🔹 Checking user ${targetUserId} in guild ${guildId}...`);

    // Check if user exists in users collection
    const user = await collections.users.findOne({ discordId: targetUserId, guildId });
    console.log('\n👤 USER DATA:');
    console.log('═══════════════════════════════════════');
    if (user) {
      console.log(`✅ User found in database:`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Display Name: ${user.displayName}`);
      console.log(`   Discord ID: ${user.discordId}`);
      console.log(`   Guild ID: ${user.guildId}`);
      console.log(`   Last Seen: ${user.lastSeen}`);
    } else {
      console.log(`❌ User NOT found in users collection`);
    }

    // Check voice sessions for this user
    const voiceSessions = await collections.voiceSessions
      .find({ userId: targetUserId, guildId })
      .sort({ joinedAt: -1 })
      .toArray();

    console.log(`\n🎤 VOICE SESSIONS (${voiceSessions.length} total):`);
    console.log('═══════════════════════════════════════');

    if (voiceSessions.length > 0) {
      let totalDuration = 0;
      voiceSessions.forEach((session: { duration: number; channelName: any; channelId: any; joinedAt: { toLocaleString: () => any; }; leftAt: any; }, index: number) => {
        const duration = session.duration || 0;
        totalDuration += duration;
        console.log(`${index + 1}. ${session.channelName || 'Unknown'} (${session.channelId})`);
        console.log(`   Joined: ${session.joinedAt.toLocaleString()}`);
        console.log(`   Duration: ${Math.round(duration / 60)} minutes`);
        console.log(`   Status: ${session.leftAt ? 'Completed' : 'Active'}`);
        console.log('');
      });

      console.log(`📊 Total duration: ${Math.round(totalDuration / 60)} minutes`);
      console.log(`📊 Average duration: ${Math.round(totalDuration / voiceSessions.length / 60)} minutes`);
    } else {
      console.log('❌ No voice sessions found for this user');
    }

    // Check if user appears in recent sessions
    const recentSessions = await collections.voiceSessions
      .find({ guildId })
      .sort({ joinedAt: -1 })
      .limit(20)
      .toArray();

    console.log(`\n🔍 CHECKING RECENT SESSIONS FOR USER ${targetUserId}:`);
    console.log('═══════════════════════════════════════');

    const userInRecent = recentSessions.filter((s: { userId: string; }) => s.userId === targetUserId);
    console.log(`Found ${userInRecent.length} sessions in recent 20 sessions`);

    if (userInRecent.length > 0) {
      userInRecent.forEach((session: { channelName: any; joinedAt: { toLocaleString: () => any; }; }, index: number) => {
        console.log(`${index + 1}. ${session.channelName || 'Unknown'} - ${session.joinedAt.toLocaleString()}`);
      });
    }

    // Check user interactions
    const interactions = await collections.userInteractions
      .find({ fromUserId: targetUserId, guildId })
      .limit(10)
      .toArray();

    console.log(`\n💬 USER INTERACTIONS (${interactions.length} found):`);
    console.log('═══════════════════════════════════════');
    interactions.forEach((interaction: { interactionType: any; toUserId: any; timestamp: { toLocaleString: () => any; }; }, index: number) => {
      console.log(`${index + 1}. ${interaction.interactionType} with ${interaction.toUserId} at ${interaction.timestamp.toLocaleString()}`);
    });

    console.log('\n🔹 User check completed');

  } catch (error) {
    console.error('🔸 Error checking user:', error);
    process.exit(1);
  } finally {
    await dbService.close();
    await closeDatabase();
  }
}

// Main execution
async function main() {
  console.log('🔹 Starting user check...');
  await checkUser();
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
