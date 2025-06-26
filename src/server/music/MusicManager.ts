import { Client, Guild, VoiceChannel, TextChannel } from 'discord.js';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  VoiceConnection,
  AudioPlayer,
  VoiceConnectionStatus,
  entersState
} from '@discordjs/voice';
import { search, stream } from 'play-dl';
import SpotifyWebApi from 'spotify-web-api-node';
import { logger } from '../utils/logger.js';
import { Track, Queue } from '../../shared/types.js';

interface GuildConnection {
  connection: VoiceConnection;
  player: AudioPlayer;
  voiceChannel: VoiceChannel;
  textChannel?: TextChannel;
}

export class MusicManager {
  private client: Client;
  private connections: Map<string, GuildConnection> = new Map();
  private queues: Map<string, Queue> = new Map();
  private spotify?: SpotifyWebApi;

  constructor(client: Client) {
    this.client = client;
    this.initializeSpotify();
  }

  private initializeSpotify() {
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      this.spotify = new SpotifyWebApi({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      });

      this.spotify.clientCredentialsGrant().then(
        (data) => {
          this.spotify!.setAccessToken(data.body['access_token']);
          logger.info('Spotify API initialized successfully');
        },
        (err) => {
          logger.error('Spotify API initialization failed:', err);
        }
      );
    } else {
      logger.warn('Spotify credentials not provided - Spotify features disabled');
    }
  }

  public async joinChannel(voiceChannel: VoiceChannel, textChannel?: TextChannel): Promise<boolean> {
    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer();

      // Wait for connection to be ready
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      connection.subscribe(player);

      this.connections.set(voiceChannel.guild.id, {
        connection,
        player,
        voiceChannel,
        textChannel
      });

      // Initialize queue if it doesn't exist
      if (!this.queues.has(voiceChannel.guild.id)) {
        this.queues.set(voiceChannel.guild.id, {
          tracks: [],
          currentTrack: null,
          isPlaying: false,
          isPaused: false,
          volume: 100,
          loop: 'none',
          shuffle: false
        });
      }

      // Set up player event listeners
      player.on(AudioPlayerStatus.Playing, () => {
        const queue = this.queues.get(voiceChannel.guild.id)!;
        queue.isPlaying = true;
        queue.isPaused = false;
        this.queues.set(voiceChannel.guild.id, queue);
      });

      player.on(AudioPlayerStatus.Paused, () => {
        const queue = this.queues.get(voiceChannel.guild.id)!;
        queue.isPaused = true;
        this.queues.set(voiceChannel.guild.id, queue);
      });

      player.on(AudioPlayerStatus.Idle, () => {
        const queue = this.queues.get(voiceChannel.guild.id)!;
        queue.isPlaying = false;
        queue.isPaused = false;
        this.queues.set(voiceChannel.guild.id, queue);
        
        // Auto-play next track
        this.playNext(voiceChannel.guild.id);
      });

      logger.info(`Joined voice channel ${voiceChannel.name} in guild ${voiceChannel.guild.name}`);
      return true;
    } catch (error) {
      logger.error('Failed to join voice channel:', error);
      return false;
    }
  }

  public async addTrack(guildId: string, query: string, requester: { id: string; username: string; avatar?: string }): Promise<Track | null> {
    try {
      let track: Track;

      if (this.isYouTubeUrl(query)) {
        track = await this.getYouTubeTrack(query, requester);
      } else if (this.isSpotifyUrl(query)) {
        track = await this.getSpotifyTrack(query, requester);
      } else {
        // Search YouTube
        track = await this.searchYouTube(query, requester);
      }

      const queue = this.queues.get(guildId);
      if (queue) {
        queue.tracks.push(track);
        this.queues.set(guildId, queue);

        // If nothing is playing, start playing
        if (!queue.isPlaying && !queue.currentTrack) {
          this.playNext(guildId);
        }
      }

      return track;
    } catch (error) {
      logger.error('Failed to add track:', error);
      return null;
    }
  }

  private async getYouTubeTrack(url: string, requester: { id: string; username: string; avatar?: string }): Promise<Track> {
    const info = await search(url, { limit: 1 });
    if (!info.length) throw new Error('No video found');

    const video = info[0];
    return {
      id: video.id!,
      title: video.title!,
      duration: video.durationInSec || 0,
      thumbnail: video.thumbnails?.[0]?.url,
      url: video.url,
      requester,
      source: 'youtube'
    };
  }

  private async getSpotifyTrack(url: string, requester: { id: string; username: string; avatar?: string }): Promise<Track> {
    if (!this.spotify) {
      throw new Error('Spotify not configured');
    }

    const trackId = this.extractSpotifyTrackId(url);
    if (!trackId) throw new Error('Invalid Spotify URL');

    const track = await this.spotify.getTrack(trackId);
    const searchQuery = `${track.body.artists[0].name} ${track.body.name}`;
    
    // Search for YouTube equivalent
    const youtubeResults = await search(searchQuery, { limit: 1 });
    if (!youtubeResults.length) throw new Error('No YouTube equivalent found');

    const video = youtubeResults[0];
    return {
      id: video.id!,
      title: `${track.body.artists[0].name} - ${track.body.name}`,
      duration: Math.floor(track.body.duration_ms / 1000),
      thumbnail: track.body.album.images[0]?.url,
      url: video.url,
      requester,
      source: 'spotify'
    };
  }

  private async searchYouTube(query: string, requester: { id: string; username: string; avatar?: string }): Promise<Track> {
    const results = await search(query, { limit: 1 });
    if (!results.length) throw new Error('No results found');

    const video = results[0];
    return {
      id: video.id!,
      title: video.title!,
      duration: video.durationInSec || 0,
      thumbnail: video.thumbnails?.[0]?.url,
      url: video.url,
      requester,
      source: 'youtube'
    };
  }

  public async play(guildId: string): Promise<boolean> {
    const connection = this.connections.get(guildId);
    const queue = this.queues.get(guildId);

    if (!connection || !queue || !queue.currentTrack) {
      return false;
    }

    try {
      const streamInfo = await stream(queue.currentTrack.url, { quality: 2 });
      const resource = createAudioResource(streamInfo.stream, {
        inputType: streamInfo.type,
      });

      connection.player.play(resource);
      return true;
    } catch (error) {
      logger.error('Failed to play track:', error);
      return false;
    }
  }

  public pause(guildId: string): boolean {
    const connection = this.connections.get(guildId);
    if (!connection) return false;

    connection.player.pause();
    return true;
  }

  public resume(guildId: string): boolean {
    const connection = this.connections.get(guildId);
    if (!connection) return false;

    connection.player.unpause();
    return true;
  }

  public skip(guildId: string): boolean {
    const connection = this.connections.get(guildId);
    if (!connection) return false;

    connection.player.stop();
    return true;
  }

  public stop(guildId: string): boolean {
    const connection = this.connections.get(guildId);
    const queue = this.queues.get(guildId);

    if (!connection || !queue) return false;

    connection.player.stop();
    queue.tracks = [];
    queue.currentTrack = null;
    this.queues.set(guildId, queue);
    return true;
  }

  public shuffle(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue) return false;

    queue.shuffle = !queue.shuffle;
    
    if (queue.shuffle && queue.tracks.length > 1) {
      // Shuffle the queue
      for (let i = queue.tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
      }
    }

    this.queues.set(guildId, queue);
    return true;
  }

  public setVolume(guildId: string, volume: number): boolean {
    const queue = this.queues.get(guildId);
    if (!queue) return false;

    queue.volume = Math.max(0, Math.min(100, volume));
    this.queues.set(guildId, queue);
    return true;
  }

  public removeTrack(guildId: string, index: number): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || index < 0 || index >= queue.tracks.length) return false;

    queue.tracks.splice(index, 1);
    this.queues.set(guildId, queue);
    return true;
  }

  private async playNext(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue || queue.tracks.length === 0) return;

    const nextTrack = queue.tracks.shift()!;
    queue.currentTrack = nextTrack;
    this.queues.set(guildId, queue);

    await this.play(guildId);
  }

  public getQueue(guildId: string): Queue | null {
    return this.queues.get(guildId) || null;
  }

  public getConnection(guildId: string): GuildConnection | null {
    return this.connections.get(guildId) || null;
  }

  public getActiveConnections(): number {
    return this.connections.size;
  }

  public getTotalTracks(): number {
    return Array.from(this.queues.values()).reduce((total, queue) => total + queue.tracks.length, 0);
  }

  public disconnect(guildId: string): boolean {
    const connection = this.connections.get(guildId);
    if (!connection) return false;

    connection.connection.destroy();
    this.connections.delete(guildId);
    this.queues.delete(guildId);
    return true;
  }

  public cleanup(guildId?: string): void {
    if (guildId) {
      this.disconnect(guildId);
    } else {
      // Cleanup all connections
      for (const [guildId] of this.connections) {
        this.disconnect(guildId);
      }
    }
  }

  private isYouTubeUrl(url: string): boolean {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/.test(url);
  }

  private isSpotifyUrl(url: string): boolean {
    return /^https?:\/\/open\.spotify\.com\/track\//.test(url);
  }

  private extractSpotifyTrackId(url: string): string | null {
    const match = url.match(/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }
}