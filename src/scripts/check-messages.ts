import { DatabaseService } from '../services/DatabaseService';
import { closeDatabase } from '../utils/database';
import { config } from '../config';

async function checkMessages() {
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

    console.log(`🔹 Checking messages for guild ${guildId}...`);

    // Get total count of messages
    const totalMessages = await collections.messages.countDocuments({ guildId });
    console.log(`📊 Total messages in database: ${totalMessages}`);

    if (totalMessages === 0) {
      console.log('❌ No messages found! The bot might not be syncing properly.');
      return;
    }

    // Get recent messages
    const recentMessages = await collections.messages
      .find({ guildId })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    console.log('\n📋 RECENT MESSAGES:');
    console.log('═══════════════════════════════════════');
    recentMessages.forEach((message: any, index: number) => {
      console.log(`${index + 1}. ${message.content.substring(0, 100)}...`);
      console.log(`   Author: ${message.authorId}`);
      console.log(`   Mentions: ${message.mentions?.length || 0} users`);
      if (message.mentions && message.mentions.length > 0) {
        console.log(`   Mentioned users: ${message.mentions.join(', ')}`);
      }
      console.log(`   Reply to: ${message.replyTo || 'None'}`);
      console.log(`   Timestamp: ${message.timestamp}`);
      console.log('');
    });

    // Check for messages with mentions
    const messagesWithMentions = await collections.messages
      .find({ guildId, mentions: { $exists: true, $not: { $size: 0 } } })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    console.log(`\n📊 MESSAGES WITH MENTIONS: ${messagesWithMentions.length}`);
    console.log('═══════════════════════════════════════');
    messagesWithMentions.forEach((message: any, index: number) => {
      console.log(`${index + 1}. ${message.content.substring(0, 50)}...`);
      console.log(`   Author: ${message.authorId}`);
      console.log(`   Mentions: ${message.mentions.join(', ')}`);
      console.log(`   Timestamp: ${message.timestamp}`);
      console.log('');
    });

    // Check for messages with replies
    const messagesWithReplies = await collections.messages
      .find({ guildId, replyTo: { $exists: true } })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    console.log(`\n📊 MESSAGES WITH REPLIES: ${messagesWithReplies.length}`);
    console.log('═══════════════════════════════════════');
    messagesWithReplies.forEach((message: any, index: number) => {
      console.log(`${index + 1}. ${message.content.substring(0, 50)}...`);
      console.log(`   Author: ${message.authorId}`);
      console.log(`   Reply to: ${message.replyTo}`);
      console.log(`   Timestamp: ${message.timestamp}`);
      console.log('');
    });

    // Check specific users from the affinity test
    const user1Id = '354823920010002432';
    const user2Id = '354543127450615808';

    console.log(`\n🔍 CHECKING SPECIFIC USERS' MESSAGES:`);
    console.log('═══════════════════════════════════════');

    const user1Messages = await collections.messages
      .find({ authorId: user1Id, guildId })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    console.log(`User 1 (${user1Id}) messages: ${user1Messages.length}`);
    user1Messages.forEach((message: any, index: number) => {
      console.log(`  ${index + 1}. ${message.content.substring(0, 50)}...`);
      console.log(`     Mentions: ${message.mentions?.length || 0}`);
      console.log(`     Reply to: ${message.replyTo || 'None'}`);
    });

    const user2Messages = await collections.messages
      .find({ authorId: user2Id, guildId })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    console.log(`\nUser 2 (${user2Id}) messages: ${user2Messages.length}`);
    user2Messages.forEach((message: any, index: number) => {
      console.log(`  ${index + 1}. ${message.content.substring(0, 50)}...`);
      console.log(`     Mentions: ${message.mentions?.length || 0}`);
      console.log(`     Reply to: ${message.replyTo || 'None'}`);
    });

    console.log('\n🔹 Message check completed');

  } catch (error) {
    console.error('🔸 Error checking messages:', error);
    process.exit(1);
  } finally {
    await dbService.close();
    await closeDatabase();
  }
}

// Main execution
async function main() {
  console.log('🔹 Starting message check...');
  await checkMessages();
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
