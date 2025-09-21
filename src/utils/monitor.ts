import { DatabaseService } from '../services/DatabaseService';

export class SyncMonitor {
  private dbService: DatabaseService;

  constructor() {
    this.dbService = new DatabaseService();
  }

  async getSyncProgress(guildId: string): Promise<{
    isRunning: boolean;
    progress: {
      users: number;
      roles: number;
      messages: number;
      voiceSessions: number;
    };
    lastUpdate: Date;
  }> {
    await this.dbService.initialize();

    const stats = await this.dbService.getGuildStats(guildId);
    const guildSync = await this.dbService.getGuildSync(guildId);

    return {
      isRunning: !guildSync?.isFullySynced || false,
      progress: {
        users: stats.totalUsers,
        roles: stats.totalRoles,
        messages: stats.totalMessages,
        voiceSessions: stats.totalVoiceSessions,
      },
      lastUpdate: guildSync?.lastSyncAt || new Date(),
    };
  }

  async startMonitoring(guildId: string, intervalMs: number = 5000): Promise<void> {
    console.log(`🔹 Starting sync monitoring for guild ${guildId}...`);

    const monitor = setInterval(async () => {
      try {
        const progress = await this.getSyncProgress(guildId);

        if (progress.isRunning) {
          console.log(`🔹 Sync Progress: ${progress.progress.users} users, ${progress.progress.roles} roles, ${progress.progress.messages} messages, ${progress.progress.voiceSessions} voice sessions`);
        } else {
          console.log(`🔹 Sync completed! Final stats: ${progress.progress.users} users, ${progress.progress.roles} roles, ${progress.progress.messages} messages, ${progress.progress.voiceSessions} voice sessions`);
          clearInterval(monitor);
        }
      } catch (error) {
        console.error('🔸 Error monitoring sync progress:', error);
      }
    }, intervalMs);
  }
}
