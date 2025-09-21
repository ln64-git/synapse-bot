import { DatabaseService } from './services/DatabaseService';
import { config } from './config';

async function optimizedAffinityTest() {
  console.log('🔹 Optimized Affinity Test...');

  const dbService = new DatabaseService();

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

    // Get interactions with limits to avoid memory issues
    console.log('🔹 Fetching interactions (limited to recent 1000)...');

    const collections = dbService.getCollections();

    // Get recent interactions only
    const interactions1to2 = await collections.userInteractions
      .find({
        fromUserId: user1Id,
        toUserId: user2Id,
        guildId,
        timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
      })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();

    const interactions2to1 = await collections.userInteractions
      .find({
        fromUserId: user2Id,
        toUserId: user1Id,
        guildId,
        timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
      })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();

    console.log(`🔹 Interactions from ${user1.displayName} to ${user2.displayName}: ${interactions1to2.length}`);
    console.log(`🔹 Interactions from ${user2.displayName} to ${user1.displayName}: ${interactions2to1.length}`);

    // Calculate scores with time decay
    const scoringWeights = {
      reaction: 1.0,
      mention: 2.0,
      reply: 3.0,
    };

    const now = new Date();
    const TIME_DECAY_DAYS = 90;

    function calculateTimeDecay(timestamp: Date): number {
      const daysDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff <= TIME_DECAY_DAYS) {
        return 1.0; // Full weight for recent interactions
      }

      // Exponential decay for older interactions
      const decayFactor = Math.exp(-(daysDiff - TIME_DECAY_DAYS) / 30);
      return Math.max(0.1, decayFactor); // Minimum 10% weight
    }

    let score1to2 = 0;
    let score2to1 = 0;

    const counts1to2: Record<string, number> = { reaction: 0, mention: 0, reply: 0 };
    const counts2to1: Record<string, number> = { reaction: 0, mention: 0, reply: 0 };

    // Process interactions with time decay
    for (const interaction of interactions1to2) {
      const timeDecay = calculateTimeDecay(interaction.timestamp);
      counts1to2[interaction.interactionType] = (counts1to2[interaction.interactionType] || 0) + 1;
      score1to2 += (scoringWeights[interaction.interactionType as keyof typeof scoringWeights] || 0) * timeDecay;
    }

    for (const interaction of interactions2to1) {
      const timeDecay = calculateTimeDecay(interaction.timestamp);
      counts2to1[interaction.interactionType] = (counts2to1[interaction.interactionType] || 0) + 1;
      score2to1 += (scoringWeights[interaction.interactionType as keyof typeof scoringWeights] || 0) * timeDecay;
    }

    const mutualScore = score1to2 + score2to1;

    console.log('\n🔹 AFFINITY ANALYSIS RESULTS:');
    console.log('================================');
    console.log(`User 1: ${user1.displayName} (${user1.discordId})`);
    console.log(`User 2: ${user2.displayName} (${user2.discordId})`);
    console.log(`Mutual Score: ${mutualScore.toFixed(2)}`);
    console.log(`\nDirectional Scores:`);
    console.log(`  ${user1.displayName} → ${user2.displayName}: ${score1to2.toFixed(2)}`);
    console.log(`  ${user2.displayName} → ${user1.displayName}: ${score2to1.toFixed(2)}`);

    console.log(`\nBreakdown for ${user1.displayName} → ${user2.displayName}:`);
    console.log(`  Replies: ${counts1to2.reply} (${(counts1to2.reply * scoringWeights.reply).toFixed(2)} points)`);
    console.log(`  Mentions: ${counts1to2.mention} (${(counts1to2.mention * scoringWeights.mention).toFixed(2)} points)`);
    console.log(`  Reactions: ${counts1to2.reaction} (${(counts1to2.reaction * scoringWeights.reaction).toFixed(2)} points)`);

    console.log(`\nBreakdown for ${user2.displayName} → ${user1.displayName}:`);
    console.log(`  Replies: ${counts2to1.reply} (${(counts2to1.reply * scoringWeights.reply).toFixed(2)} points)`);
    console.log(`  Mentions: ${counts2to1.mention} (${(counts2to1.mention * scoringWeights.mention).toFixed(2)} points)`);
    console.log(`  Reactions: ${counts2to1.reaction} (${(counts2to1.reaction * scoringWeights.reaction).toFixed(2)} points)`);

    // Determine relationship type
    let relationshipType = 'none';
    if (mutualScore >= 50) relationshipType = 'strong';
    else if (mutualScore >= 20) relationshipType = 'moderate';
    else if (mutualScore >= 5) relationshipType = 'weak';

    console.log(`\nRelationship Type: ${relationshipType.toUpperCase()}`);

    // Time range analysis
    if (interactions1to2.length > 0 || interactions2to1.length > 0) {
      const allInteractions = [...interactions1to2, ...interactions2to1];
      const timestamps = allInteractions.map(i => i.timestamp);
      const firstInteraction = new Date(Math.min(...timestamps.map(t => t.getTime())));
      const lastInteraction = new Date(Math.max(...timestamps.map(t => t.getTime())));
      const daysActive = (lastInteraction.getTime() - firstInteraction.getTime()) / (1000 * 60 * 60 * 24);

      console.log(`\nTime Range:`);
      console.log(`  First Interaction: ${firstInteraction.toLocaleDateString()}`);
      console.log(`  Last Interaction: ${lastInteraction.toLocaleDateString()}`);
      console.log(`  Days Active: ${Math.round(daysActive)}`);
    }

    // Show recent interactions
    if (interactions1to2.length > 0) {
      console.log(`\n🔹 Recent interactions from ${user1.displayName} to ${user2.displayName}:`);
      interactions1to2.slice(0, 5).forEach((interaction: any, index: number) => {
        console.log(`  ${index + 1}. ${interaction.interactionType} at ${interaction.timestamp.toLocaleString()}`);
      });
    }

    if (interactions2to1.length > 0) {
      console.log(`\n🔹 Recent interactions from ${user2.displayName} to ${user1.displayName}:`);
      interactions2to1.slice(0, 5).forEach((interaction: any, index: number) => {
        console.log(`  ${index + 1}. ${interaction.interactionType} at ${interaction.timestamp.toLocaleString()}`);
      });
    }

    console.log('\n🔹 Optimized affinity test completed successfully!');

  } catch (error) {
    console.error('🔸 Error in optimized affinity test:', error);
  } finally {
    await dbService.close();
  }
}

// Run the test
optimizedAffinityTest().catch(console.error);
