import { DatabaseService } from '../services/DatabaseService';
import { AffinityService } from '../services/AffinityService';
import { config } from '../config';

async function optimizedAffinityTest() {
  console.log('🔹 Advanced Affinity Test with VC Analysis...');

  const dbService = new DatabaseService();
  const affinityService = new AffinityService(dbService);

  try {
    // Initialize database
    await dbService.initialize();
    console.log('🔹 Database initialized');

    // Get USER_1 and USER_2 from environment
    const user1Id = process.env.USER_1;
    const user2Id = process.env.USER_2;
    const guildId = config.guildId;

    if (!user1Id || !user2Id || !guildId) {
      console.error('🔸 Missing USER_1, USER_2, or GUILD_ID in environment variables');
      return;
    }

    console.log(`🔹 Testing with USER_1 (${user1Id}) and USER_2 (${user2Id}) in guild ${guildId}`);

    // Check if users exist in database
    const user1 = await dbService.getUser(user1Id, guildId);
    const user2 = await dbService.getUser(user2Id, guildId);

    console.log(`🔹 User 1 found: ${user1 ? user1.displayName : 'Not found'}`);
    console.log(`🔹 User 2 found: ${user2 ? user2.displayName : 'Not found'}`);

    if (!user1 || !user2) {
      console.log('🔸 One or both users not found in database. Make sure to sync the guild first!');
      return;
    }

    // Get basic stats
    const stats = await dbService.getGuildStats(guildId);
    console.log(`🔹 Guild stats: ${stats.totalUsers} users, ${stats.totalMessages} messages, ${stats.totalRoles} roles`);

    // Use the new AffinityService for comprehensive analysis
    console.log('🔹 Analyzing relationship with advanced VC scoring...');
    const analysis = await affinityService.analyzeRelationship(user1Id, user2Id, guildId);

    console.log('\n🔹 ADVANCED AFFINITY ANALYSIS RESULTS:');
    console.log('=====================================');
    console.log(`User 1: ${user1.displayName} (${user1.discordId})`);
    console.log(`User 2: ${user2.displayName} (${user2.discordId})`);
    console.log(`Mutual Score: ${analysis.mutualScore.toFixed(2)}`);
    console.log(`Relationship Type: ${analysis.relationshipType.toUpperCase()}`);

    console.log(`\nDirectional Scores:`);
    console.log(`  ${user1.displayName} → ${user2.displayName}: ${analysis.affinity?.totalScore.toFixed(2) || 0}`);
    console.log(`  ${user2.displayName} → ${user1.displayName}: ${analysis.reverseAffinity?.totalScore.toFixed(2) || 0}`);

    // Detailed breakdown for both directions
    console.log(`\n🔹 RELATIONSHIP BREAKDOWN:`);
    console.log('='.repeat(50));

    if (analysis.affinity) {
      console.log(`\n${user1.displayName} → ${user2.displayName}:`);
      console.log(`  VC Relative Score: ${analysis.affinity.breakdown.vcRelativeScore.toFixed(2)} points`);
      console.log(`  Replies: ${analysis.affinity.breakdown.replies.toFixed(2)} points`);
      console.log(`  Mentions: ${analysis.affinity.breakdown.mentions.toFixed(2)} points`);
      console.log(`  Reactions: ${analysis.affinity.breakdown.reactions.toFixed(2)} points`);

      // VC-specific details for user1 → user2
      if (analysis.affinity.vcDetails) {
        const vc = analysis.affinity.vcDetails;
        console.log(`\n  🔹 VOICE CHAT ANALYSIS:`);
        console.log(`    Total time together: ${Math.round(vc.totalMinutes)} minutes`);
        console.log(`    Number of sessions: ${vc.sessionCount}`);
        console.log(`    Average session length: ${Math.round(vc.averageSessionLength)} minutes`);
        console.log(`    Relative VC score: ${vc.relativeScore.toFixed(1)}% of total VC time`);

        if (vc.topChannels.length > 0) {
          console.log(`    Top channels:`);
          vc.topChannels.forEach((channel, index) => {
            console.log(`      ${index + 1}. ${channel.channelName}: ${Math.round(channel.minutes)} minutes`);
          });
        }
      }
    }

    if (analysis.reverseAffinity) {
      console.log(`\n${user2.displayName} → ${user1.displayName}:`);
      console.log(`  VC Relative Score: ${analysis.reverseAffinity.breakdown.vcRelativeScore.toFixed(2)} points`);
      console.log(`  Replies: ${analysis.reverseAffinity.breakdown.replies.toFixed(2)} points`);
      console.log(`  Mentions: ${analysis.reverseAffinity.breakdown.mentions.toFixed(2)} points`);
      console.log(`  Reactions: ${analysis.reverseAffinity.breakdown.reactions.toFixed(2)} points`);

      // VC-specific details for user2 → user1
      if (analysis.reverseAffinity.vcDetails) {
        const vc = analysis.reverseAffinity.vcDetails;
        console.log(`\n  🔹 VOICE CHAT ANALYSIS:`);
        console.log(`    Total time together: ${Math.round(vc.totalMinutes)} minutes`);
        console.log(`    Number of sessions: ${vc.sessionCount}`);
        console.log(`    Average session length: ${Math.round(vc.averageSessionLength)} minutes`);
        console.log(`    Relative VC score: ${vc.relativeScore.toFixed(1)}% of total VC time`);

        if (vc.topChannels.length > 0) {
          console.log(`    Top channels:`);
          vc.topChannels.forEach((channel, index) => {
            console.log(`      ${index + 1}. ${channel.channelName}: ${Math.round(channel.minutes)} minutes`);
          });
        }
      }
    }

    // Interaction counts
    if (analysis.affinity) {
      console.log(`\nInteraction Counts (${user1.displayName} → ${user2.displayName}):`);
      console.log(`  VC Sessions: ${analysis.affinity.interactionCounts.vcSessions}`);
      console.log(`  Replies: ${analysis.affinity.interactionCounts.replies}`);
      console.log(`  Mentions: ${analysis.affinity.interactionCounts.mentions}`);
      console.log(`  Reactions: ${analysis.affinity.interactionCounts.reactions}`);
    }

    // Time range analysis
    if (analysis.affinity?.timeRange) {
      const timeRange = analysis.affinity.timeRange;
      console.log(`\nTime Range:`);
      console.log(`  First Interaction: ${timeRange.firstInteraction?.toLocaleDateString() || 'Unknown'}`);
      console.log(`  Last Interaction: ${timeRange.lastInteraction?.toLocaleDateString() || 'Unknown'}`);
      console.log(`  Days Active: ${timeRange.daysActive}`);
    }


    console.log('\n🔹 Advanced affinity test completed successfully!');

  } catch (error) {
    console.error('🔸 Error in optimized affinity test:', error);
  } finally {
    await dbService.close();
  }
}

// Run the test
optimizedAffinityTest().catch(console.error);
