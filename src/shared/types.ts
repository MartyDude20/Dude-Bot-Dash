export interface Track {
  id: string;
  title: string;
  duration: number;
  thumbnail?: string;
  url: string;
  requester: {
    id: string;
    username: string;
    avatar?: string;
  };
  source: 'youtube' | 'spotify' | 'demo';
}

export interface Queue {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  loop: 'none' | 'track' | 'queue';
  shuffle: boolean;
}

export interface ServerInfo {
  id: string;
  name: string;
  icon?: string;
  memberCount: number;
  isConnected: boolean;
  voiceChannel?: {
    id: string;
    name: string;
    memberCount: number;
  };
  queue: Queue;
}

export interface BotStats {
  uptime: number;
  serverCount: number;
  activeConnections: number;
  totalTracks: number;
  memoryUsage: number;
}

export interface SocketEvents {
  // Client to Server
  'join-server': (serverId: string) => void;
  'leave-server': (serverId: string) => void;
  'control-player': (serverId: string, action: 'play' | 'pause' | 'skip' | 'stop' | 'shuffle') => void;
  'set-volume': (serverId: string, volume: number) => void;
  'remove-track': (serverId: string, trackIndex: number) => void;

  // Server to Client
  'server-update': (serverInfo: ServerInfo) => void;
  'queue-update': (serverId: string, queue: Queue) => void;
  'stats-update': (stats: BotStats) => void;
  'servers-list': (servers: ServerInfo[]) => void;
  'error': (message: string) => void;
}