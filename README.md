# 🎵 Discord Music Bot with Web Dashboard

A comprehensive Discord music bot with YouTube and Spotify integration, featuring a modern web dashboard for real-time monitoring and control.

## ✨ Features

### Discord Integration
- **Slash Commands**: `/play`, `/skip`, `/queue`, `/pause`, `/resume`, `/stop`, `/shuffle`, `/nowplaying`, `/volume`
- **Voice Channel Support**: Automatic joining and connection management
- **Multi-Server**: Supports multiple Discord servers simultaneously
- **Real-time Updates**: Live status tracking and queue management

### Music Sources
- **YouTube Integration**: Search videos, extract metadata, handle URLs
- **Spotify Integration**: Track search with fallback to YouTube playback
- **Smart Detection**: Automatically identifies YouTube/Spotify URLs vs search queries
- **High Quality Audio**: Optimized audio streaming

### Web Dashboard
- **Real-time Monitoring**: Live bot status, server connections, queue updates via WebSocket
- **Server Management**: Multi-guild support with server selection
- **Queue Visualization**: Track listings with thumbnails, duration, requester info
- **Player Controls**: Play/pause/skip/stop controls with volume adjustment
- **Beautiful UI**: Modern design with animations and responsive layout

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Discord Bot Token
- (Optional) YouTube API Key
- (Optional) Spotify Client ID & Secret

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd discord-music-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   DISCORD_BOT_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   # Optional APIs
   YOUTUBE_API_KEY=your_youtube_key_here
   SPOTIFY_CLIENT_ID=your_spotify_id_here
   SPOTIFY_CLIENT_SECRET=your_spotify_secret_here
   ```

4. **Start the application**
   ```bash
   # Development mode (with hot reload)
   npm run dev
   
   # Production mode
   npm run build
   npm start
   ```

5. **Access the dashboard**
   Open http://localhost:3000 in your browser

## 🎮 Discord Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/play <query>` | Play a song from YouTube or Spotify | `/play Never Gonna Give You Up` |
| `/skip` | Skip the current song | `/skip` |
| `/pause` | Pause the current song | `/pause` |
| `/resume` | Resume the paused song | `/resume` |
| `/stop` | Stop playing and clear the queue | `/stop` |
| `/queue` | Show the current queue | `/queue` |
| `/nowplaying` | Show currently playing song | `/nowplaying` |
| `/shuffle` | Toggle shuffle mode | `/shuffle` |
| `/volume <0-100>` | Set the volume | `/volume 50` |

## 🌐 Web Dashboard Features

### Server Overview
- View all connected Discord servers
- Real-time connection status
- Member count and activity indicators
- Quick server switching

### Music Player
- Now playing information with album art
- Playback controls (play/pause/skip/stop)
- Volume control slider
- Shuffle toggle
- Queue management

### Queue Management
- Visual queue with track thumbnails
- Track information (title, duration, requester)
- Remove tracks from queue
- Real-time updates via WebSocket

## 🏗️ Architecture

### Backend (`src/server/`)
- **Discord.js**: Discord API integration
- **@discordjs/voice**: Voice channel handling
- **play-dl**: YouTube audio streaming
- **spotify-web-api-node**: Spotify integration
- **Express**: REST API server
- **Socket.IO**: Real-time communication

### Frontend (`src/`)
- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Smooth animations
- **Socket.IO Client**: Real-time updates

## 📁 Project Structure

```
src/
├── server/                 # Backend code
│   ├── commands/          # Discord slash commands
│   ├── music/             # Music management
│   ├── socket/            # WebSocket handlers
│   ├── utils/             # Utilities (logger, etc.)
│   └── index.ts           # Main server file
├── components/            # React components
│   └── Dashboard.tsx      # Main dashboard
├── shared/                # Shared types
│   └── types.ts           # TypeScript interfaces
└── App.tsx               # React app entry
```

## 🔧 Configuration

### Discord Bot Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token to your `.env` file
5. Enable necessary intents (Guilds, Guild Voice States, Guild Messages, Message Content)
6. Invite the bot to your server with proper permissions

### Required Permissions
- Connect to Voice Channels
- Speak in Voice Channels
- Use Slash Commands
- Send Messages
- View Channels

### Optional API Setup

#### YouTube API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable YouTube Data API v3
3. Create credentials (API Key)
4. Add the key to your `.env` file

#### Spotify API
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Copy Client ID and Client Secret to your `.env` file

## 🚀 Deployment

### Railway (Recommended)
1. Fork this repository
2. Connect to Railway
3. Set environment variables
4. Deploy automatically

### Docker
```dockerfile
# Dockerfile included for containerized deployment
docker build -t discord-music-bot .
docker run -p 3000:3000 discord-music-bot
```

### Manual Deployment
1. Build the project: `npm run build`
2. Start the server: `npm start`
3. Ensure environment variables are set

## 🔍 Health Checks

The bot includes health check endpoints:
- `/health` - General health status
- `/ready` - Discord client ready status
- `/live` - Application liveness
- `/api/stats` - Bot statistics

## 🐛 Troubleshooting

### Common Issues

**Bot not responding to commands**
- Ensure bot has proper permissions
- Check if slash commands are registered
- Verify bot token is correct

**Voice connection issues**
- Bot needs "Connect" and "Speak" permissions
- Check if voice channel is not full
- Ensure bot is not already connected to another channel

**Web dashboard not loading**
- Check if server is running on correct port
- Verify WebSocket connection
- Check browser console for errors

### Debug Mode
Set environment variable for detailed logging:
```bash
NODE_ENV=development
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

- Create an issue for bug reports
- Join our Discord server for help
- Check the documentation for guides

---

Built with ❤️ using Discord.js, React, and TypeScript