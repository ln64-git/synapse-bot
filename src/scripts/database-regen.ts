import { DatabaseService } from '../services/DatabaseService';
import { closeDatabase } from '../utils/database';
import { config } from '../config';

interface RegenOptions {
  wipe?: boolean;
  syncSapphire?: boolean;
  showStats?: boolean;
}

async function regenDatabase(options: RegenOptions = {}) {
  const dbService = new DatabaseService();

  try {
    console.log('🔹 Initializing database service...');
    await dbService.initialize();

    if (options.wipe) {
      console.log('🔹 Wiping database...');
      await dbService.wipeDatabase();
      console.log('🔹 Database wiped successfully');
    }

    if (options.syncSapphire) {
      console.log('🔹 Syncing Sapphire VC logs...');
      const result = await dbService.syncSapphireVCLogs();

      if (result.success) {
        console.log(`🔹 Successfully synced ${result.sessionsCreated} voice sessions from Sapphire logs`);
      } else {
        console.error('🔸 Failed to sync Sapphire logs:');
        result.errors.forEach(error => console.error(`  - ${error}`));
      }
    }

    if (options.showStats) {
      console.log('🔹 Gathering database statistics...');

      // Get stats for all guilds or a specific guild
      const guildId = config.guildId;
      if (guildId) {
        const stats = await dbService.getGuildStats(guildId);
        console.log(`🔹 Database stats for guild ${guildId}:`);
        console.log(`  - Users: ${stats.totalUsers}`);
        console.log(`  - Messages: ${stats.totalMessages}`);
        console.log(`  - Roles: ${stats.totalRoles}`);
        console.log(`  - Voice Sessions: ${stats.totalVoiceSessions}`);
      } else {
        console.log('🔸 No guild ID configured, cannot show stats');
      }
    }

    console.log('🔹 Database regeneration completed successfully');

  } catch (error) {
    console.error('🔸 Error during database regeneration:', error);
    process.exit(1);
  } finally {
    await dbService.close();
    await closeDatabase();
  }
}

// Parse command line arguments
function parseArgs(): RegenOptions {
  const args = process.argv.slice(2);
  const options: RegenOptions = {};

  for (const arg of args) {
    switch (arg) {
      case '--wipe':
        options.wipe = true;
        break;
      case '--sync-sapphire':
        options.syncSapphire = true;
        break;
      case '--stats':
        options.showStats = true;
        break;
      case '--help':
        console.log(`
Database Regeneration Tool

Usage: npx tsx src/scripts/database-regen.ts [options]

Options:
  --wipe              Wipe all data from the database
  --sync-sapphire     Sync voice session data from Sapphire bot logs
  --stats             Show database statistics
  --help              Show this help message

Examples:
  npx tsx src/scripts/database-regen.ts --wipe --stats
  npx tsx src/scripts/database-regen.ts --sync-sapphire --stats
  npx tsx src/scripts/database-regen.ts --wipe --sync-sapphire --stats
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

  // If no options provided, show help
  if (Object.keys(options).length === 0) {
    console.log('🔸 No options provided. Use --help for usage information.');
    process.exit(1);
  }

  console.log('🔹 Starting database regeneration...');
  console.log('🔹 Options:', options);

  await regenDatabase(options);
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
