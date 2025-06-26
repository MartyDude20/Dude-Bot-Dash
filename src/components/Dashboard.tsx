import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, 
  Play, 
  Pause, 
  SkipForward, 
  Square, 
  Shuffle, 
  Volume2, 
  Users, 
  Clock,
  Trash2,
  Server,
  Activity
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { BotStats, ServerInfo, Queue, Track } from '../shared/types';

interface DashboardProps {}

export const Dashboard: React.FC<DashboardProps> = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [currentQueue, setCurrentQueue] = useState<Queue | null>(null);

  useEffect(() => {
    const socketConnection = io();
    setSocket(socketConnection);

    socketConnection.on('connect', () => {
      setIsConnected(true);
    });

    socketConnection.on('disconnect', () => {
      setIsConnected(false);
    });

    socketConnection.on('stats-update', (newStats: BotStats) => {
      setStats(newStats);
    });

    socketConnection.on('servers-list', (serversList: ServerInfo[]) => {
      setServers(serversList);
      if (!selectedServer && serversList.length > 0) {
        setSelectedServer(serversList[0].id);
      }
    });

    socketConnection.on('queue-update', (serverId: string, queue: Queue) => {
      if (serverId === selectedServer) {
        setCurrentQueue(queue);
      }
    });

    // Initial data fetch
    fetchStats();
    fetchServers();

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedServer && socket) {
      socket.emit('join-server', selectedServer);
      const server = servers.find(s => s.id === selectedServer);
      if (server) {
        setCurrentQueue(server.queue);
      }
    }
  }, [selectedServer, socket, servers]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/servers');
      const data = await response.json();
      setServers(data);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    }
  };

  const controlPlayer = (action: 'play' | 'pause' | 'skip' | 'stop' | 'shuffle') => {
    if (socket && selectedServer) {
      socket.emit('control-player', selectedServer, action);
    }
  };

  const setVolume = (volume: number) => {
    if (socket && selectedServer) {
      socket.emit('set-volume', selectedServer, volume);
    }
  };

  const removeTrack = (index: number) => {
    if (socket && selectedServer) {
      socket.emit('remove-track', selectedServer, index);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m ${seconds % 60}s`;
  };

  const selectedServerInfo = servers.find(s => s.id === selectedServer);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Discord Music Bot</h1>
                <div className="flex items-center space-x-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-gray-300">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
            
            {stats && (
              <div className="flex items-center space-x-6 text-sm text-gray-300">
                <div className="flex items-center space-x-2">
                  <Server className="w-4 h-4" />
                  <span>{stats.serverCount} servers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4" />
                  <span>{stats.activeConnections} active</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>{formatUptime(stats.uptime)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Server Selection */}
          <div className="lg:col-span-1">
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Server className="w-5 h-5 mr-2" />
                Servers
              </h2>
              
              <div className="space-y-3">
                {servers.map((server) => (
                  <motion.button
                    key={server.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedServer(server.id)}
                    className={`w-full p-4 rounded-xl text-left transition-all duration-200 ${
                      selectedServer === server.id
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                        : 'bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {server.icon ? (
                          <img 
                            src={server.icon} 
                            alt={server.name}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {server.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="text-white font-medium">{server.name}</div>
                          <div className="text-gray-400 text-sm flex items-center">
                            <Users className="w-3 h-3 mr-1" />
                            {server.memberCount}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {server.isConnected && (
                          <div className="w-2 h-2 bg-green-400 rounded-full" />
                        )}
                        {server.queue.tracks.length > 0 && (
                          <div className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs">
                            {server.queue.tracks.length}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Player & Queue */}
          <div className="lg:col-span-2 space-y-8">
            {/* Now Playing */}
            {currentQueue?.currentTrack && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-6"
              >
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Music className="w-5 h-5 mr-2" />
                  Now Playing
                </h2>
                
                <div className="flex items-center space-x-4">
                  {currentQueue.currentTrack.thumbnail && (
                    <img
                      src={currentQueue.currentTrack.thumbnail}
                      alt={currentQueue.currentTrack.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-white font-medium mb-1">
                      {currentQueue.currentTrack.title}
                    </h3>
                    <div className="text-gray-400 text-sm">
                      Requested by {currentQueue.currentTrack.requester.username} • 
                      {formatDuration(currentQueue.currentTrack.duration)}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`px-2 py-1 rounded-full text-xs ${
                      currentQueue.isPlaying 
                        ? 'bg-green-500/20 text-green-300' 
                        : currentQueue.isPaused
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-gray-500/20 text-gray-300'
                    }`}>
                      {currentQueue.isPlaying ? 'Playing' : currentQueue.isPaused ? 'Paused' : 'Stopped'}
                    </div>
                  </div>
                </div>

                {/* Player Controls */}
                <div className="flex items-center justify-between mt-6">
                  <div className="flex items-center space-x-3">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => controlPlayer(currentQueue.isPaused ? 'play' : 'pause')}
                      className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white hover:shadow-lg transition-shadow"
                    >
                      {currentQueue.isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => controlPlayer('skip')}
                      className="p-3 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition-colors"
                    >
                      <SkipForward className="w-5 h-5" />
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => controlPlayer('stop')}
                      className="p-3 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition-colors"
                    >
                      <Square className="w-5 h-5" />
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => controlPlayer('shuffle')}
                      className={`p-3 rounded-full text-white transition-colors ${
                        currentQueue.shuffle 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      <Shuffle className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* Volume Control */}
                  <div className="flex items-center space-x-3">
                    <Volume2 className="w-5 h-5 text-gray-400" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={currentQueue.volume}
                      onChange={(e) => setVolume(parseInt(e.target.value))}
                      className="w-24 accent-purple-500"
                    />
                    <span className="text-gray-400 text-sm w-8">
                      {currentQueue.volume}%
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Queue */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <Music className="w-5 h-5 mr-2" />
                  Queue
                </h2>
                {selectedServerInfo && (
                  <div className="text-gray-400 text-sm">
                    {selectedServerInfo.queue.tracks.length} tracks
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {currentQueue?.tracks.map((track, index) => (
                    <motion.div
                      key={`${track.id}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center space-x-4 p-4 bg-gray-800/30 rounded-xl hover:bg-gray-700/30 transition-colors group"
                    >
                      <div className="text-gray-400 font-mono text-sm w-6">
                        {index + 1}
                      </div>
                      
                      {track.thumbnail && (
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      
                      <div className="flex-1">
                        <div className="text-white font-medium">{track.title}</div>
                        <div className="text-gray-400 text-sm">
                          {track.requester.username} • {formatDuration(track.duration)}
                        </div>
                      </div>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeTrack(index)}
                        className="p-2 bg-red-500/20 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {(!currentQueue?.tracks.length && !currentQueue?.currentTrack) && (
                  <div className="text-center py-12">
                    <Music className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <div className="text-gray-400">
                      No music in queue. Use Discord commands to add tracks!
                    </div>
                    <div className="text-gray-500 text-sm mt-2">
                      Try: <code className="bg-gray-800 px-2 py-1 rounded">/play [song name]</code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;