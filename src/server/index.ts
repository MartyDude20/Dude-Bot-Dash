import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { createServer } from 'http';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';


import { logger } from './utils/logger.js';
import { MusicManager } from './music/MusicManager.js';
import { setupCommands } from './commands/index.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { BotStats, ServerInfo } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DiscordMusicBot {
  public client: Client;
  public musicManager: MusicManager;
  public app: express.Application;
  public server: any;
  public io: SocketServer;
  public startTime: number;

  constructor() {
    this.startTime = Date.now();
    
    // Initialize Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Initialize music manager
    this.musicManager = new MusicManager(this.client);

    // Initialize Express app
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();

    // Initialize HTTP server and Socket.IO
    this.server = createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:5173"],
        methods: ["GET", "POST"]
      }
    });

    this.setupDiscordEvents();
    this.setupSocketEvents();
  }

  private setupMiddleware() {
    this.app.use(helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
    }));
    
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:5173"]
    }));

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    this.app.use('/api', limiter);

    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../../dist')));
  }

  private setupRoutes() {
    // Health check endpoints
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    this.app.get('/ready', (req, res) => {
      const isReady = this.client.isReady();
      res.status(isReady ? 200 : 503).json({ 
        ready: isReady, 
        timestamp: new Date().toISOString() 
      });
    });

    this.app.get('/live', (req, res) => {
      res.json({ 
        alive: true, 
        uptime: Date.now() - this.startTime,
        timestamp: new Date().toISOString() 
      });
    });

    // API routes
    this.app.get('/api/stats', (req, res) => {
      const stats: BotStats = {
        uptime: Date.now() - this.startTime,
        serverCount: this.client.guilds.cache.size,
        activeConnections: this.musicManager.getActiveConnections(),
        totalTracks: this.musicManager.getTotalTracks(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
      };
      res.json(stats);
    });

    this.app.get('/api/servers', (req, res) => {
      const servers: ServerInfo[] = this.client.guilds.cache.map(guild => {
        const connection = this.musicManager.getConnection(guild.id);
        const queue = this.musicManager.getQueue(guild.id);
        
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL() ?? undefined,
          memberCount: guild.memberCount,
          isConnected: !!connection,
          voiceChannel: connection ? {
            id: connection.voiceChannel.id,
            name: connection.voiceChannel.name,
            memberCount: connection.voiceChannel.members.size
          } : undefined,
          queue: queue || {
            tracks: [],
            currentTrack: null,
            isPlaying: false,
            isPaused: false,
            volume: 100,
            loop: 'none',
            shuffle: false
          }
        };
      });
      res.json(servers);
    });

    // Serve React app for all other routes
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../../dist/index.html'));
    });
  }

  private setupDiscordEvents() {
    this.client.once('ready', async () => {
      logger.info(`Bot is ready! Logged in as ${this.client.user?.tag}`);
      
      // Register slash commands
      await this.registerCommands();
      
      // Set up command handlers
      setupCommands(this.client, this.musicManager, this.io);
      
      // Start broadcasting stats
      this.startStatsInterval();
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });

    this.client.on('guildCreate', (guild) => {
      logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
      this.broadcastServersUpdate();
    });

    this.client.on('guildDelete', (guild) => {
      logger.info(`Left guild: ${guild.name} (${guild.id})`);
      this.musicManager.cleanup(guild.id);
      this.broadcastServersUpdate();
    });
  }

  private setupSocketEvents() {
    setupSocketHandlers(this.io, this.musicManager);
  }

  private async registerCommands() {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_BOT_TOKEN) {
      logger.error('Missing required environment variables');
      process.exit(1);
    }

    const commands = [
      {
        name: 'play',
        description: 'Play a song from YouTube or Spotify',
        options: [{
          name: 'query',
          description: 'Song name, URL, or search query',
          type: 3, // STRING
          required: true
        }]
      },
      {
        name: 'skip',
        description: 'Skip the current song'
      },
      {
        name: 'pause',
        description: 'Pause the current song'
      },
      {
        name: 'resume',
        description: 'Resume the paused song'
      },
      {
        name: 'stop',
        description: 'Stop playing and clear the queue'
      },
      {
        name: 'queue',
        description: 'Show the current queue'
      },
      {
        name: 'nowplaying',
        description: 'Show currently playing song'
      },
      {
        name: 'shuffle',
        description: 'Toggle shuffle mode'
      },
      {
        name: 'volume',
        description: 'Set the volume (0-100)',
        options: [{
          name: 'level',
          description: 'Volume level (0-100)',
          type: 4, // INTEGER
          required: true,
          min_value: 0,
          max_value: 100
        }]
      }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

    try {
      logger.info('Started refreshing application (/) commands.');
      await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
        body: commands,
      });
      logger.info('Successfully reloaded application (/) commands.');
    } catch (error) {
      logger.error('Error refreshing commands:', error);
    }
  }

  private startStatsInterval() {
    setInterval(() => {
      const stats: BotStats = {
        uptime: Date.now() - this.startTime,
        serverCount: this.client.guilds.cache.size,
        activeConnections: this.musicManager.getActiveConnections(),
        totalTracks: this.musicManager.getTotalTracks(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
      };
      this.io.emit('stats-update', stats);
    }, 5000);
  }

  private broadcastServersUpdate() {
    const servers: ServerInfo[] = this.client.guilds.cache.map(guild => {
      const connection = this.musicManager.getConnection(guild.id);
      const queue = this.musicManager.getQueue(guild.id);
      
      return {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL() ?? undefined,
        memberCount: guild.memberCount,
        isConnected: !!connection,
        voiceChannel: connection ? {
          id: connection.voiceChannel.id,
          name: connection.voiceChannel.name,
          memberCount: connection.voiceChannel.members.size
        } : undefined,
        queue: queue || {
          tracks: [],
          currentTrack: null,
          isPlaying: false,
          isPaused: false,
          volume: 100,
          loop: 'none',
          shuffle: false
        }
      };
    });
    this.io.emit('servers-list', servers);
  }

  public async start() {
    try {
      await this.client.login(process.env.DISCORD_BOT_TOKEN);
      
      const port = process.env.PORT || 3000;
      this.server.listen(port, () => {
        logger.info(`Server is running on port ${port}`);
      });
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  public async shutdown() {
    logger.info('Shutting down bot...');
    this.musicManager.cleanup();
    await this.client.destroy();
    this.server.close();
    process.exit(0);
  }
}

// Initialize and start the bot
const bot = new DiscordMusicBot();

// Graceful shutdown
process.on('SIGTERM', () => bot.shutdown());
process.on('SIGINT', () => bot.shutdown());

bot.start().catch(error => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});

export default bot;