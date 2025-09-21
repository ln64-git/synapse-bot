import { Client, GatewayIntentBits, Message } from "discord.js";
import { config } from "./config";
import { DatabaseService } from "./services/DatabaseService";
import { GuildSyncService } from "./services/GuildSyncService";
import { RealtimeTrackingService } from "./services/RealtimeTrackingService";

export class Bot {
    public client: Client;
    private dbService: DatabaseService;
    private guildSyncService: GuildSyncService;
    private trackingService: RealtimeTrackingService;

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessageReactions,
            ],
        });

        // Initialize services
        this.dbService = new DatabaseService();
        this.guildSyncService = new GuildSyncService(this.dbService);
        this.trackingService = new RealtimeTrackingService(this.dbService);
    }

    async init() {
        try {
            console.log('🔹 Initializing bot...');

            // Initialize database
            await this.dbService.initialize();
            console.log('🔹 Database service initialized');

            await this.client.login(config.botToken);
            this.setupEventHandlers();

            console.log(`🔹 Logged in as ${this.client.user?.tag}!`);
        } catch (error) {
            console.error('🔸 Failed to initialize bot:', error);
            throw error;
        }
    }

    private setupEventHandlers() {
        // Ready event
        this.client.once('ready', async () => {
            console.log('🔹 Bot is ready!');
            console.log(`🔹 Serving ${this.client.guilds.cache.size} guilds`);

            // Check guild sync status after bot is ready
            await this.checkAndSyncGuild();

            // Set up periodic sync verification (every 5 minutes)
            setInterval(async () => {
                await this.checkAndSyncGuild();
            }, 5 * 60 * 1000); // 5 minutes
        });

        // Real-time tracking events
        this.setupRealtimeTracking();

        // Error handling
        this.client.on('error', (error) => {
            console.error('🔸 Discord client error:', error);
        });

        // Warning handling
        this.client.on('warn', (warning) => {
            console.warn('⚠️ Discord client warning:', warning);
        });

        // Disconnect handling
        this.client.on('disconnect', () => {
            console.warn('⚠️ Bot disconnected from Discord');
        });

        // Reconnect handling
        this.client.on('reconnecting', () => {
            console.log('🔹 Bot reconnecting to Discord...');
        });
    }


    private setupRealtimeTracking() {
        // Message events
        this.client.on('messageCreate', async (message) => {
            await this.trackingService.trackMessage(message);
        });

        this.client.on('messageUpdate', async (oldMessage, newMessage) => {
            if (newMessage instanceof Message) {
                await this.trackingService.trackMessageUpdate(oldMessage, newMessage);
            }
        });

        this.client.on('messageDelete', async (message) => {
            await this.trackingService.trackMessageDelete(message);
        });

        // Reaction events
        this.client.on('messageReactionAdd', async (reaction, user) => {
            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    console.error('🔸 Error fetching reaction:', error);
                    return;
                }
            }
            await this.trackingService.trackReactionAdd(reaction, user);
        });

        this.client.on('messageReactionRemove', async (reaction, user) => {
            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    console.error('🔸 Error fetching reaction:', error);
                    return;
                }
            }
            await this.trackingService.trackReactionRemove(reaction, user);
        });

        // Voice state events
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            await this.trackingService.trackVoiceStateUpdate(oldState, newState);
        });

        // Guild member events
        this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
            if (newMember.partial) {
                try {
                    await newMember.fetch();
                } catch (error) {
                    console.error('🔸 Error fetching member:', error);
                    return;
                }
            }
            await this.trackingService.trackGuildMemberUpdate(oldMember, newMember);
        });

        // Cleanup on shutdown
        process.on('SIGINT', async () => {
            await this.trackingService.cleanupActiveSessions();
        });

        process.on('SIGTERM', async () => {
            await this.trackingService.cleanupActiveSessions();
        });
    }

    private async checkAndSyncGuild() {
        try {
            let guild;

            if (config.guildId) {
                guild = this.client.guilds.cache.get(config.guildId);
                if (!guild) {
                    console.warn(`⚠️ Guild ${config.guildId} not found`);
                    return;
                }
            } else {
                // Look for Arcados guild specifically, or use first available guild
                guild = this.client.guilds.cache.find(g => g.name === 'Arcados') || this.client.guilds.cache.first();
                if (!guild) {
                    console.warn(`⚠️ No guilds found to sync`);
                    return;
                }
                console.log(`🔹 No GUILD_ID configured, using guild: ${guild.name} (${guild.id})`);
            }

            console.log(`🔍 Verifying sync status for guild: ${guild.name}`);

            const syncStatus = await this.guildSyncService.checkGuildSyncStatus(guild.id);

            // Get actual Discord data for comparison
            const discordUsers = guild.memberCount;
            const discordRoles = guild.roles.cache.size;
            const discordChannels = guild.channels.cache.filter((c: any) => c.isTextBased()).size;

            // Calculate sync percentages
            const userSyncPercent = syncStatus.stats.totalUsers > 0 ?
                Math.round((syncStatus.stats.totalUsers / discordUsers) * 100) : 0;
            const roleSyncPercent = syncStatus.stats.totalRoles > 0 ?
                Math.round((syncStatus.stats.totalRoles / discordRoles) * 100) : 0;

            // Determine overall sync status
            const isFullySynced = syncStatus.isSynced &&
                userSyncPercent >= 95 &&
                roleSyncPercent >= 95;

            // Display detailed sync status
            console.log(`\n📊 SYNC VERIFICATION REPORT`);
            console.log(`═══════════════════════════════════════`);
            console.log(`🏰 Guild: ${guild.name}`);
            console.log(`🔄 Sync Status: ${isFullySynced ? '✅ FULLY SYNCED' : '⚠️ NEEDS ATTENTION'}`);
            console.log(`\n📈 Data Comparison:`);
            console.log(`   👥 Users:    ${syncStatus.stats.totalUsers}/${discordUsers} (${userSyncPercent}%)`);
            console.log(`   🎭 Roles:    ${syncStatus.stats.totalRoles}/${discordRoles} (${roleSyncPercent}%)`);
            console.log(`   💬 Messages: ${syncStatus.stats.totalMessages} (${discordChannels} channels)`);
            console.log(`   🎤 Voice:    ${syncStatus.stats.totalVoiceSessions} sessions`);
            console.log(`   ⏰ Last Sync: ${syncStatus.lastSync ? syncStatus.lastSync.toLocaleString() : 'Never'}`);

            if (isFullySynced) {
                console.log(`\n🎉 All systems operational! Guild is fully synced.`);
            } else {
                console.log(`\n⚠️  Sync issues detected:`);
                if (userSyncPercent < 95) console.log(`   • Users sync: ${userSyncPercent}% (needs refresh)`);
                if (roleSyncPercent < 95) console.log(`   • Roles sync: ${roleSyncPercent}% (needs refresh)`);
                if (syncStatus.stats.totalMessages === 0) console.log(`   • No messages synced`);
                if (syncStatus.stats.totalVoiceSessions === 0) console.log(`   • No voice sessions tracked`);

                console.log(`\n🔧 Auto-syncing guild...`);
            }

            console.log(`═══════════════════════════════════════\n`);

            // Auto-sync if needed (either needsFullSync or sync percentages are low)
            const needsSync = syncStatus.needsFullSync ||
                userSyncPercent < 95 ||
                roleSyncPercent < 95 ||
                syncStatus.stats.totalMessages === 0;

            if (needsSync) {
                console.log(`🔄 Auto-syncing guild ${guild.name}...`);
                const result = await this.guildSyncService.syncGuild(guild, true);

                if (result.success) {
                    console.log(`✅ Auto-sync completed: ${result.syncedUsers} users, ${result.syncedRoles} roles, ${result.syncedMessages} messages`);
                } else {
                    console.error(`❌ Auto-sync failed with ${result.errors.length} errors`);
                }
            }
        } catch (error) {
            console.error('🔸 Error during sync verification:', error);
        }
    }
}