import { DatabaseService } from '../services/DatabaseService';
import { closeDatabase } from '../utils/database';

async function wipeDatabase() {
  const dbService = new DatabaseService();

  try {
    console.log('🔹 Initializing database service...');
    await dbService.initialize();

    console.log('🔹 Wiping database...');
    await dbService.wipeDatabase();
    console.log('🔹 Database wiped successfully');

  } catch (error) {
    console.error('🔸 Error wiping database:', error);
    process.exit(1);
  } finally {
    await dbService.close();
    await closeDatabase();
  }
}

// Main execution
async function main() {
  console.log('🔹 Starting database wipe...');
  await wipeDatabase();
  console.log('🔹 Database wipe completed');
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
