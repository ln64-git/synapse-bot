import { DatabaseService } from '../services/DatabaseService';
import { closeDatabase } from '../utils/database';
import { config } from '../config';

async function checkInteractions() {
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

    console.log(`🔹 Checking interactions for guild ${guildId}...`);

    // Get total count of interactions
    const totalInteractions = await collections.userInteractions.countDocuments({ guildId });
    console.log(`📊 Total interactions in database: ${totalInteractions}`);

    if (totalInteractions === 0) {
      console.log('❌ No interactions found! This explains why affinity scores are 0.');
      console.log('🔍 Let me check if the bot is tracking interactions...');

      // Check if there are any messages
      const totalMessages = await collections.messages.countDocuments({ guildId });
      console.log(`📊 Total messages in database: ${totalMessages}`);

      if (totalMessages > 0) {
        console.log('🔸 Messages exist but no interactions were tracked.');
        console.log('🔸 This suggests the interaction tracking might not be working properly.');

        // Check a few recent messages to see if they have mentions or replies
        const recentMessages = await collections.messages
          .find({ guildId })
          .sort({ timestamp: -1 })
          .limit(5)
          .toArray();

        console.log('\n📋 RECENT MESSAGES:');
        console.log('═══════════════════════════════════════');
        recentMessages.forEach((message: any, index: number) => {
          console.log(`${index + 1}. ${message.content.substring(0, 50)}...`);
          console.log(`   Author: ${message.authorId}`);
          console.log(`   Mentions: ${message.mentions?.length || 0}`);
          console.log(`   Reply to: ${message.replyTo || 'None'}`);
          console.log(`   Timestamp: ${message.timestamp}`);
          console.log('');
        });
      } else {
        console.log('🔸 No messages found either. The bot might not be syncing properly.');
      }

      return;
    }

    // Get interaction types breakdown
    const interactionTypes = await collections.userInteractions.aggregate([
      { $match: { guildId } },
      { $group: { _id: '$interactionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('\n📊 INTERACTION TYPES:');
    console.log('═══════════════════════════════════════');
    interactionTypes.forEach((type: any) => {
      console.log(`${type._id}: ${type.count}`);
    });

    // Get recent interactions
    const recentInteractions = await collections.userInteractions
      .find({ guildId })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    console.log('\n📋 RECENT INTERACTIONS:');
    console.log('═══════════════════════════════════════');
    recentInteractions.forEach((interaction: any, index: number) => {
      console.log(`${index + 1}. ${interaction.fromUserId} → ${interaction.toUserId}`);
      console.log(`   Type: ${interaction.interactionType}`);
      console.log(`   Timestamp: ${interaction.timestamp}`);
      console.log(`   Channel: ${interaction.channelId || 'N/A'}`);
      console.log('');
    });

    // Check specific users from the affinity test
    const user1Id = '354823920010002432';
    const user2Id = '354543127450615808';

    console.log(`\n🔍 CHECKING SPECIFIC USERS:`);
    console.log('═══════════════════════════════════════');
    console.log(`User 1 (${user1Id}):`);

    const user1Interactions = await collections.userInteractions
      .find({ fromUserId: user1Id, guildId })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    console.log(`  Interactions FROM user 1: ${user1Interactions.length}`);
    user1Interactions.forEach((interaction: any, index: number) => {
      console.log(`    ${index + 1}. → ${interaction.toUserId} (${interaction.interactionType})`);
    });

    const user1Received = await collections.userInteractions
      .find({ toUserId: user1Id, guildId })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    console.log(`  Interactions TO user 1: ${user1Received.length}`);
    user1Received.forEach((interaction: any, index: number) => {
      console.log(`    ${index + 1}. ${interaction.fromUserId} → (${interaction.interactionType})`);
    });

    console.log(`\nUser 2 (${user2Id}):`);

    const user2Interactions = await collections.userInteractions
      .find({ fromUserId: user2Id, guildId })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    console.log(`  Interactions FROM user 2: ${user2Interactions.length}`);
    user2Interactions.forEach((interaction: any, index: number) => {
      console.log(`    ${index + 1}. → ${interaction.toUserId} (${interaction.interactionType})`);
    });

    const user2Received = await collections.userInteractions
      .find({ toUserId: user2Id, guildId })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    console.log(`  Interactions TO user 2: ${user2Received.length}`);
    user2Received.forEach((interaction: any, index: number) => {
      console.log(`    ${index + 1}. ${interaction.fromUserId} → (${interaction.interactionType})`);
    });

    console.log('\n🔹 Interaction check completed');

  } catch (error) {
    console.error('🔸 Error checking interactions:', error);
    process.exit(1);
  } finally {
    await dbService.close();
    await closeDatabase();
  }
}

// Main execution
async function main() {
  console.log('🔹 Starting interaction check...');
  await checkInteractions();
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
