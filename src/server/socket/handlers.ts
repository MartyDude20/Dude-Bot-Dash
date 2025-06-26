import { Server as SocketServer } from 'socket.io';
import { MusicManager } from '../music/MusicManager.js';
import { logger } from '../utils/logger.js';
import { SocketEvents } from '../../shared/types.js';

export function setupSocketHandlers(io: SocketServer, musicManager: MusicManager) {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('join-server', (serverId: string) => {
      logger.info(`Client ${socket.id} joined server ${serverId}`);
      socket.join(`server:${serverId}`);
      
      // Send current queue state
      const queue = musicManager.getQueue(serverId);
      if (queue) {
        socket.emit('queue-update', serverId, queue);
      }
    });

    socket.on('leave-server', (serverId: string) => {
      logger.info(`Client ${socket.id} left server ${serverId}`);
      socket.leave(`server:${serverId}`);
    });

    socket.on('control-player', (serverId: string, action: 'play' | 'pause' | 'skip' | 'stop' | 'shuffle') => {
      logger.info(`Player control: ${action} for server ${serverId}`);
      
      try {
        let success = false;
        
        switch (action) {
          case 'play':
            success = musicManager.resume(serverId);
            break;
          case 'pause':
            success = musicManager.pause(serverId);
            break;
          case 'skip':
            success = musicManager.skip(serverId);
            break;
          case 'stop':
            success = musicManager.stop(serverId);
            break;
          case 'shuffle':
            success = musicManager.shuffle(serverId);
            break;
        }

        if (success) {
          // Broadcast updated queue to all clients in this server
          const queue = musicManager.getQueue(serverId);
          if (queue) {
            io.to(`server:${serverId}`).emit('queue-update', serverId, queue);
          }
        } else {
          socket.emit('error', `Failed to ${action} player`);
        }
      } catch (error) {
        logger.error(`Error controlling player:`, error);
        socket.emit('error', 'An error occurred while controlling the player');
      }
    });

    socket.on('set-volume', (serverId: string, volume: number) => {
      logger.info(`Setting volume to ${volume} for server ${serverId}`);
      
      try {
        const success = musicManager.setVolume(serverId, volume);
        
        if (success) {
          const queue = musicManager.getQueue(serverId);
          if (queue) {
            io.to(`server:${serverId}`).emit('queue-update', serverId, queue);
          }
        } else {
          socket.emit('error', 'Failed to set volume');
        }
      } catch (error) {
        logger.error(`Error setting volume:`, error);
        socket.emit('error', 'An error occurred while setting volume');
      }
    });

    socket.on('remove-track', (serverId: string, trackIndex: number) => {
      logger.info(`Removing track ${trackIndex} from server ${serverId}`);
      
      try {
        const success = musicManager.removeTrack(serverId, trackIndex);
        
        if (success) {
          const queue = musicManager.getQueue(serverId);
          if (queue) {
            io.to(`server:${serverId}`).emit('queue-update', serverId, queue);
          }
        } else {
          socket.emit('error', 'Failed to remove track');
        }
      } catch (error) {
        logger.error(`Error removing track:`, error);
        socket.emit('error', 'An error occurred while removing the track');
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
}