import { DatabaseService } from '../services/DatabaseService';
import { AffinityService } from '../services/AffinityService';
import { config } from '../config';

async function showTopAffinities() {
  console.log('🔹 Top Affinities Analysis...');

  const dbService = new DatabaseService();
  const affinityService = new AffinityService(dbService);

  try {
    // Initialize database
    console.log('🔹 Connecting to MongoDB...');
    await dbService.initialize();
    console.log('🔹 Database initialized');

    const userId = process.env.USER_1;
    const guildId = config.guildId;

    if (!userId) {
      console.error('🔸 Please set USER_1 environment variable');
      console.log('Usage: USER_1=123456789012345678 bun run top-affinities');
      return;
    }

    if (!guildId) {
      console.error('🔸 No guild ID configured');
      return;
    }

    console.log(`🔹 Analyzing top affinities for user ${userId} in guild ${guildId}`);

    // Get user info
    const collections = dbService.getCollections();
    const user = await collections.users.findOne({ discordId: userId });

    if (!user) {
      console.error(`🔸 User ${userId} not found in database`);
      return;
    }

    console.log(`🔹 User: ${user.displayName} (${user.username})`);

    // Get top relationships
    console.log('🔹 Fetching top relationships...');
    const topRelationships = await affinityService.getTopRelationships(userId, guildId, 20);

    if (topRelationships.length === 0) {
      console.log('🔸 No relationships found for this user');
      return;
    }

    console.log(`\n🔹 TOP ${topRelationships.length} RELATIONSHIPS FOR ${user.displayName.toUpperCase()}:`);
    console.log('='.repeat(80));

    for (let i = 0; i < topRelationships.length; i++) {
      const relationship = topRelationships[i];

      // Get target user info
      const targetUser = await collections.users.findOne({ discordId: relationship.toUserId });
      const targetName = targetUser ? targetUser.displayName : 'Unknown User';

      // Determine relationship strength
      let strength = 'WEAK';
      if (relationship.totalScore >= 15) strength = 'STRONG';
      else if (relationship.totalScore >= 8) strength = 'MODERATE';

      console.log(`\n${i + 1}. ${targetName} (${relationship.toUserId})`);
      console.log(`   Score: ${relationship.totalScore.toFixed(2)} (${strength})`);
      console.log(`   Rank: #${relationship.rank}`);

      // Breakdown
      console.log(`   Breakdown:`);
      console.log(`     VC Relative Score: ${relationship.breakdown.vcRelativeScore.toFixed(2)} points`);
      console.log(`     Replies: ${relationship.breakdown.replies.toFixed(2)} points`);
      console.log(`     Mentions: ${relationship.breakdown.mentions.toFixed(2)} points`);
      console.log(`     Reactions: ${relationship.breakdown.reactions.toFixed(2)} points`);

      // Interaction counts
      console.log(`   Interactions:`);
      console.log(`     VC Sessions: ${relationship.interactionCounts.vcSessions}`);
      console.log(`     Replies: ${relationship.interactionCounts.replies}`);
      console.log(`     Mentions: ${relationship.interactionCounts.mentions}`);
      console.log(`     Reactions: ${relationship.interactionCounts.reactions}`);

      // Time range
      if (relationship.timeRange.firstInteraction && relationship.timeRange.lastInteraction) {
        const daysActive = relationship.timeRange.daysActive;
        console.log(`   Time Range: ${daysActive} days active`);
        console.log(`     First: ${relationship.timeRange.firstInteraction.toLocaleDateString()}`);
        console.log(`     Last: ${relationship.timeRange.lastInteraction.toLocaleDateString()}`);
      }

      // VC Details if available
      if (relationship.vcDetails) {
        console.log(`   Voice Chat:`);
        console.log(`     Total Time: ${Math.round(relationship.vcDetails.totalMinutes)} minutes`);
        console.log(`     Sessions: ${relationship.vcDetails.sessionCount}`);
        console.log(`     Avg Session: ${Math.round(relationship.vcDetails.averageSessionLength)} minutes`);
        console.log(`     Relative Score: ${relationship.vcDetails.relativeScore.toFixed(1)}%`);

        if (relationship.vcDetails.topChannels.length > 0) {
          console.log(`     Top Channels:`);
          relationship.vcDetails.topChannels.slice(0, 3).forEach((channel, idx) => {
            console.log(`       ${idx + 1}. ${channel.channelName}: ${Math.round(channel.minutes)} minutes`);
          });
        }
      }

      console.log('   ' + '-'.repeat(60));
    }

    // Summary statistics
    console.log('\n🔹 SUMMARY STATISTICS:');
    console.log('='.repeat(40));

    const totalScore = topRelationships.reduce((sum, r) => sum + r.totalScore, 0);
    const avgScore = totalScore / topRelationships.length;
    const strongCount = topRelationships.filter(r => r.totalScore >= 15).length;
    const moderateCount = topRelationships.filter(r => r.totalScore >= 8 && r.totalScore < 15).length;
    const weakCount = topRelationships.filter(r => r.totalScore < 8).length;

    console.log(`Total Relationships: ${topRelationships.length}`);
    console.log(`Average Score: ${avgScore.toFixed(2)}`);
    console.log(`Strong (≥15): ${strongCount}`);
    console.log(`Moderate (8-14): ${moderateCount}`);
    console.log(`Weak (<8): ${weakCount}`);

    // VC-focused relationships (now based on relative score)
    const vcFocused = topRelationships.filter(r => r.breakdown.vcRelativeScore > r.breakdown.replies + r.breakdown.mentions + r.breakdown.reactions);
    console.log(`VC-Focused Relationships: ${vcFocused.length}`);

    // Text-focused relationships
    const textFocused = topRelationships.filter(r => r.breakdown.vcRelativeScore < r.breakdown.replies + r.breakdown.mentions + r.breakdown.reactions);
    console.log(`Text-Focused Relationships: ${textFocused.length}`);

    console.log('\n🔹 Top affinities analysis completed successfully!');

  } catch (error) {
    console.error('🔸 Error in top affinities analysis:', error);
  } finally {
    await dbService.close();
  }
}

// Parse command line arguments
function parseArgs(): { userId?: string } {
  const args = process.argv.slice(2);
  const options: { userId?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--user' && i + 1 < args.length) {
      options.userId = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (arg === '--help') {
      console.log(`
Top Affinities Analysis Tool

Usage: bun run top-affinities [options]

Options:
  --user <userId>    Analyze specific user ID (overrides USER_1 env var)
  --help            Show this help message

Environment Variables:
  USER_1            User ID to analyze (required if --user not provided)

Examples:
  USER_1=123456789012345678 bun run top-affinities
  bun run top-affinities --user 123456789012345678
      `);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  if (options.userId) {
    process.env.USER_1 = options.userId;
  }

  await showTopAffinities();
}

main().catch(console.error);
