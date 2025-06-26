import { Client, CommandInteraction, GuildMember, VoiceChannel, TextChannel } from 'discord.js';
import { Server as SocketServer } from 'socket.io';
import { MusicManager } from '../music/MusicManager.js';
import { logger } from '../utils/logger.js';

export function setupCommands(client: Client, musicManager: MusicManager, io: SocketServer) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, guildId, member, channel } = interaction;
    
    if (!guildId || !member || !channel) {
      await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
      return;
    }

    const guildMember = member as GuildMember;
    const textChannel = channel as TextChannel;

    try {
      switch (commandName) {
        case 'play':
          await handlePlayCommand(interaction, musicManager, guildMember, textChannel, io);
          break;
        case 'skip':
          await handleSkipCommand(interaction, musicManager, guildId, io);
          break;
        case 'pause':
          await handlePauseCommand(interaction, musicManager, guildId, io);
          break;
        case 'resume':
          await handleResumeCommand(interaction, musicManager, guildId, io);
          break;
        case 'stop':
          await handleStopCommand(interaction, musicManager, guildId, io);
          break;
        case 'queue':
          await handleQueueCommand(interaction, musicManager, guildId);
          break;
        case 'nowplaying':
          await handleNowPlayingCommand(interaction, musicManager, guildId);
          break;
        case 'shuffle':
          await handleShuffleCommand(interaction, musicManager, guildId, io);
          break;
        case 'volume':
          await handleVolumeCommand(interaction, musicManager, guildId, io);
          break;
        default:
          await interaction.reply({ content: 'Unknown command!', ephemeral: true });
      }
    } catch (error) {
      logger.error(`Error handling command ${commandName}:`, error);
      if (!interaction.replied) {
        await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
      }
    }
  });
}

async function handlePlayCommand(
  interaction: CommandInteraction,
  musicManager: MusicManager,
  member: GuildMember,
  textChannel: TextChannel,
  io: SocketServer
) {
  const query = interaction.options.get('query')?.value as string;
  
  if (!member.voice.channel) {
    await interaction.reply({ content: '❌ You need to be in a voice channel to play music!', ephemeral: true });
    return;
  }

  const voiceChannel = member.voice.channel as VoiceChannel;
  
  await interaction.deferReply();

  // Check if bot is already connected to a different channel
  const existingConnection = musicManager.getConnection(interaction.guildId!);
  if (existingConnection && existingConnection.voiceChannel.id !== voiceChannel.id) {
    await interaction.editReply('❌ I\'m already connected to a different voice channel!');
    return;
  }

  // Join voice channel if not already connected
  if (!existingConnection) {
    const success = await musicManager.joinChannel(voiceChannel, textChannel);
    if (!success) {
      await interaction.editReply('❌ Failed to join the voice channel!');
      return;
    }
  }

  // Add track to queue
  const track = await musicManager.addTrack(interaction.guildId!, query, {
    id: interaction.user.id,
    username: interaction.user.username,
    avatar: interaction.user.displayAvatarURL()
  });

  if (!track) {
    await interaction.editReply('❌ Could not find or add the requested track!');
    return;
  }

  const queue = musicManager.getQueue(interaction.guildId!);
  const position = queue?.tracks.length || 0;

  await interaction.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '🎵 Track Added to Queue',
      description: `**${track.title}**\n` +
                  `Duration: ${formatDuration(track.duration)}\n` +
                  `Requested by: ${track.requester.username}\n` +
                  `Position in queue: ${position}`,
      thumbnail: { url: track.thumbnail || '' },
      footer: { text: `Source: ${track.source.toUpperCase()}` }
    }]
  });

  // Broadcast queue update
  broadcastQueueUpdate(io, interaction.guildId!, musicManager);
}

async function handleSkipCommand(
  interaction: CommandInteraction,
  musicManager: MusicManager,
  guildId: string,
  io: SocketServer
) {
  const connection = musicManager.getConnection(guildId);
  if (!connection) {
    await interaction.reply({ content: '❌ I\'m not connected to a voice channel!', ephemeral: true });
    return;
  }

  const queue = musicManager.getQueue(guildId);
  if (!queue?.currentTrack) {
    await interaction.reply({ content: '❌ Nothing is currently playing!', ephemeral: true });
    return;
  }

  const skippedTrack = queue.currentTrack;
  const success = musicManager.skip(guildId);

  if (success) {
    await interaction.reply({
      embeds: [{
        color: 0xffa500,
        title: '⏭️ Track Skipped',
        description: `Skipped: **${skippedTrack.title}**`
      }]
    });
    broadcastQueueUpdate(io, guildId, musicManager);
  } else {
    await interaction.reply({ content: '❌ Failed to skip the track!', ephemeral: true });
  }
}

async function handlePauseCommand(
  interaction: CommandInteraction,
  musicManager: MusicManager,
  guildId: string,
  io: SocketServer
) {
  const queue = musicManager.getQueue(guildId);
  if (!queue?.isPlaying) {
    await interaction.reply({ content: '❌ Nothing is currently playing!', ephemeral: true });
    return;
  }

  if (queue.isPaused) {
    await interaction.reply({ content: '❌ Music is already paused!', ephemeral: true });
    return;
  }

  const success = musicManager.pause(guildId);
  if (success) {
    await interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '⏸️ Music Paused',
        description: 'Music playback has been paused.'
      }]
    });
    broadcastQueueUpdate(io, guildId, musicManager);
  } else {
    await interaction.reply({ content: '❌ Failed to pause the music!', ephemeral: true });
  }
}

async function handleResumeCommand(
  interaction: CommandInteraction,
  musicManager: MusicManager,
  guildId: string,
  io: SocketServer
) {
  const queue = musicManager.getQueue(guildId);
  if (!queue?.isPaused) {
    await interaction.reply({ content: '❌ Music is not paused!', ephemeral: true });
    return;
  }

  const success = musicManager.resume(guildId);
  if (success) {
    await interaction.reply({
      embeds: [{
        color: 0x00ff00,
        title: '▶️ Music Resumed',
        description: 'Music playback has been resumed.'
      }]
    });
    broadcastQueueUpdate(io, guildId, musicManager);
  } else {
    await interaction.reply({ content: '❌ Failed to resume the music!', ephemeral: true });
  }
}

async function handleStopCommand(
  interaction: CommandInteraction,
  musicManager: MusicManager,
  guildId: string,
  io: SocketServer
) {
  const connection = musicManager.getConnection(guildId);
  if (!connection) {
    await interaction.reply({ content: '❌ I\'m not connected to a voice channel!', ephemeral: true });
    return;
  }

  const success = musicManager.stop(guildId);
  if (success) {
    await interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: '⏹️ Music Stopped',
        description: 'Music playback stopped and queue cleared.'
      }]
    });
    broadcastQueueUpdate(io, guildId, musicManager);
  } else {
    await interaction.reply({ content: '❌ Failed to stop the music!', ephemeral: true });
  }
}

async function handleQueueCommand(
  interaction: CommandInteraction,
  musicManager: MusicManager,
  guildId: string
) {
  const queue = musicManager.getQueue(guildId);
  if (!queue || (!queue.currentTrack && queue.tracks.length === 0)) {
    await interaction.reply({ content: '❌ The queue is empty!', ephemeral: true });
    return;
  }

  let description = '';
  
  if (queue.currentTrack) {
    description += `**Now Playing:**\n🎵 ${queue.currentTrack.title}\n` +
                  `Requested by: ${queue.currentTrack.requester.username}\n\n`;
  }

  if (queue.tracks.length > 0) {
    description += '**Up Next:**\n';
    queue.tracks.slice(0, 10).forEach((track, index) => {
      description += `${index + 1}. ${track.title} (${formatDuration(track.duration)})\n`;
    });
    
    if (queue.tracks.length > 10) {
      description += `\n...and ${queue.tracks.length - 10} more tracks`;
    }
  }

  await interaction.reply({
    embeds: [{
      color: 0x0099ff,
      title: '🎵 Music Queue',
      description,
      footer: {
        text: `${queue.tracks.length} tracks in queue • Volume: ${queue.volume}% • ${queue.shuffle ? 'Shuffle: ON' : 'Shuffle: OFF'}`
      }
    }]
  });
}

async function handleNowPlayingCommand(
  interaction: CommandInteraction,
  musicManager: MusicManager,
  guildId: string
) {
  const queue = musicManager.getQueue(guildId);
  if (!queue?.currentTrack) {
    await interaction.reply({ content: '❌ Nothing is currently playing!', ephemeral: true });
    return;
  }

  const track = queue.currentTrack;
  await interaction.reply({
    embeds: [{
      color: 0x00ff00,
      title: '🎵 Now Playing',
      description: `**${track.title}**\n` +
                  `Duration: ${formatDuration(track.duration)}\n` +
                  `Requested by: ${track.requester.username}\n` +
                  `Status: ${queue.isPlaying ? (queue.isPaused ? '⏸️ Paused' : '▶️ Playing') : '⏹️ Stopped'}`,
      thumbnail: { url: track.thumbnail || '' },
      footer: { text: `Source: ${track.source.toUpperCase()} • Volume: ${queue.volume}%` }
    }]
  });
}

async function handleShuffleCommand(
  interaction: CommandInteraction,
  musicManager: MusicManager,
  guildId: string,
  io: SocketServer
) {
  const queue = musicManager.getQueue(guildId);
  if (!queue || queue.tracks.length < 2) {
    await interaction.reply({ content: '❌ Need at least 2 tracks in queue to shuffle!', ephemeral: true });
    return;
  }

  const success = musicManager.shuffle(guildId);
  if (success) {
    const newQueue = musicManager.getQueue(guildId);
    await interaction.reply({
      embeds: [{
        color: 0x9932cc,
        title: '🔀 Shuffle Toggled',
        description: `Shuffle is now **${newQueue?.shuffle ? 'ON' : 'OFF'}**`
      }]
    });
    broadcastQueueUpdate(io, guildId, musicManager);
  } else {
    await interaction.reply({ content: '❌ Failed to toggle shuffle!', ephemeral: true });
  }
}

async function handleVolumeCommand(
  interaction: CommandInteraction,
  musicManager: MusicManager,
  guildId: string,
  io: SocketServer
) {
  const volume = interaction.options.get('level')?.value as number;
  
  const success = musicManager.setVolume(guildId, volume);
  if (success) {
    await interaction.reply({
      embeds: [{
        color: 0x00ffff,
        title: '🔊 Volume Changed',
        description: `Volume set to **${volume}%**`
      }]
    });
    broadcastQueueUpdate(io, guildId, musicManager);
  } else {
    await interaction.reply({ content: '❌ Failed to set volume!', ephemeral: true });
  }
}

function broadcastQueueUpdate(io: SocketServer, guildId: string, musicManager: MusicManager) {
  const queue = musicManager.getQueue(guildId);
  if (queue) {
    io.emit('queue-update', guildId, queue);
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}