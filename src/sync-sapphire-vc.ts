import { DatabaseService } from "./services/DatabaseService";

async function syncSapphireVC() {
  const dbService = new DatabaseService();

  try {
    console.log('🔹 Starting Sapphire VC sync...');
    await dbService.initialize();

    const result = await dbService.syncSapphireVCLogs();

    if (result.success) {
      console.log(`✅ Sync completed successfully!`);
      console.log(`📊 Created ${result.sessionsCreated} voice sessions`);
    } else {
      console.log(`❌ Sync completed with ${result.errors.length} errors:`);
      result.errors.forEach(error => console.log(`   - ${error}`));
    }

    await dbService.close();
  } catch (error) {
    console.error('🔸 Sync failed:', error);
    process.exit(1);
  }
}

syncSapphireVC().then(() => {
  console.log('🔹 Sync completed');
  process.exit(0);
}).catch((error) => {
  console.error('🔸 Sync failed:', error);
  process.exit(1);
});
