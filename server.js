const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const prisma = require('./prisma/client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const readline = require('readline');
const SQLiteStore = require('connect-sqlite3')(session);
// Add passport and Google OAuth support
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// Add dotenv for environment variables
require('dotenv').config();

// Server configuration
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';

// Server statistics
const serverStats = {
    startTime: new Date(),
    totalConnections: 0,
    matchesMade: 0,
    commandsExecuted: 0,
    errors: 0
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

// Console logging utilities
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    let formattedMessage = '';
    
    switch(type) {
        case 'info':
            formattedMessage = `[${timestamp}] [INFO] ${message}`;
            break;
        case 'error':
            serverStats.errors++;
            formattedMessage = `[${timestamp}] [ERROR] ${message}`;
            break;
        case 'warn':
            formattedMessage = `[${timestamp}] [WARN] ${message}`;
            break;
        case 'success':
            formattedMessage = `[${timestamp}] [SUCCESS] ${message}`;
            break;
        case 'debug':
            if (!DEBUG_MODE) return; // Only log debug in debug mode
            formattedMessage = `[${timestamp}] [DEBUG] ${message}`;
            break;
        case 'verbose':
            if (!VERBOSE_LOGGING) return; // Skip verbose logging unless enabled
            formattedMessage = `[${timestamp}] [VERBOSE] ${message}`;
            break;
    }
    
    console.log(formattedMessage);
}

// Create readline interface for console commands
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'server> '
});

// Command system
const commands = {
    help: {
        description: 'Shows the list of available commands',
        execute: () => {
            log('Available commands:', 'success');
            Object.keys(commands).forEach(cmd => {
                console.log(`  ${cmd.padEnd(15)} - ${commands[cmd].description}`);
            });
            return true;
        }
    },
    
    status: {
        description: 'Shows the current server status',
        execute: async () => {
            const uptime = Math.floor((new Date() - serverStats.startTime) / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            
            const userCount = await prisma.user.count();
            const matchCount = await prisma.match.count();
            const queueCount = await prisma.pairingQueue.count();
            
            log('=== Server Status ===', 'success');
            log(`Uptime: ${hours}h ${minutes}m ${seconds}s`, 'success');
            log(`Online users: ${onlineUserCount}`, 'success');
            log(`Users in queue: ${queueCount}`, 'success');
            log(`Active rooms: ${rooms.size}`, 'success');
            log(`Total users: ${userCount}`, 'success');
            log(`Total matches: ${matchCount}`, 'success');
            log(`Connections since start: ${serverStats.totalConnections}`, 'success');
            log(`Matches made since start: ${serverStats.matchesMade}`, 'success');
            log(`Errors since start: ${serverStats.errors}`, 'success');
            log('=====================', 'success');
            return true;
        }
    },
    
    users: {
        description: 'Lists currently connected users',
        execute: () => {
            log(`Connected users (${onlineUserCount}):`, 'success');
            let count = 0;
            connectedUsers.forEach(socketId => {
                const roomId = userRooms.get(socketId);
                console.log(`  ${socketId.substring(0, 8)}... ${roomId ? `(in room ${roomId})` : '(in lobby)'}`);
                count++;
                
                // Limit output to first 20 users
                if (count === 20 && connectedUsers.size > 20) {
                    console.log(`  ... and ${connectedUsers.size - 20} more`);
                    return;
                }
            });
            return true;
        }
    },
    
    rooms: {
        description: 'Lists active game rooms',
        execute: () => {
            log(`Active rooms (${rooms.size}):`, 'success');
            let count = 0;
            rooms.forEach((room, roomId) => {
                console.log(`  ${roomId}: ${room.players.length} players, Mode: ${room.gameMode || 'classic'}, Started: ${room.Started ? 'Yes' : 'No'}`);
                count++;
                
                // Limit output to first 20 rooms
                if (count === 20 && rooms.size > 20) {
                    console.log(`  ... and ${rooms.size - 20} more`);
                    return;
                }
            });
            return true;
        }
    },
    
    queue: {
        description: 'Shows users in matchmaking queue',
        execute: async () => {
            const queuedUsers = await prisma.pairingQueue.findMany({
                include: { user: { select: { username: true, elo: true } } }
            });
            
            log(`Users in matchmaking queue (${queuedUsers.length}):`, 'success');
            queuedUsers.forEach(entry => {
                console.log(`  ${entry.user.username} (ELO: ${entry.user.elo}), Range: ${entry.eloMin || 'any'}-${entry.eloMax || 'any'}`);
            });
            return true;
        }
    },
    
    clear: {
        description: 'Clears the console',
        execute: () => {
            console.clear();
            return true;
        }
    },
    
    debug: {
        description: 'Toggles debug mode',
        execute: (args) => {
            if (args[0] === 'on') {
                DEBUG_MODE = true;
                log('Debug mode enabled', 'success');
            } else if (args[0] === 'off') {
                DEBUG_MODE = false;
                log('Debug mode disabled', 'success');
            } else {
                DEBUG_MODE = !DEBUG_MODE;
                log(`Debug mode ${DEBUG_MODE ? 'enabled' : 'disabled'}`, 'success');
            }
            return true;
        }
    },
    
    verbose: {
        description: 'Toggles verbose logging',
        execute: (args) => {
            if (args[0] === 'on') {
                VERBOSE_LOGGING = true;
                log('Verbose logging enabled', 'success');
            } else if (args[0] === 'off') {
                VERBOSE_LOGGING = false;
                log('Verbose logging disabled', 'success');
            } else {
                VERBOSE_LOGGING = !VERBOSE_LOGGING;
                log(`Verbose logging ${VERBOSE_LOGGING ? 'enabled' : 'disabled'}`, 'success');
            }
            return true;
        }
    },
    
    match: {
        description: 'Forces matchmaking check for all users in queue',
        execute: async () => {
            const queuedUsers = await prisma.pairingQueue.findMany({
                select: { userId: true }
            });
            
            log(`Processing matchmaking for ${queuedUsers.length} users in queue`, 'info');
            
            let matchCount = 0;
            for (const user of queuedUsers) {
                const matchResult = await tryMatchmaking(user.userId);
                
                if (matchResult) {
                    matchCount++;
                    serverStats.matchesMade++;
                    log(`Match found for user ${user.userId}, creating room ${matchResult.roomId}`, 'success');
                    
                    // Create a room for the match
                    const roomId = matchResult.roomId;
                    
                    // Fetch usernames for both players
                    const player1 = await prisma.user.findUnique({
                        where: { id: matchResult.player1.id },
                        select: { username: true }
                    });
                    
                    const player2 = await prisma.user.findUnique({
                        where: { id: matchResult.player2.id },
                        select: { username: true }
                    });
                    
                    // Update both users' lastRoom
                    await prisma.user.update({
                        where: { id: matchResult.player1.id },
                        data: { lastRoom: roomId }
                    });
                    
                    await prisma.user.update({
                        where: { id: matchResult.player2.id },
                        data: { lastRoom: roomId }
                    });
                    
                    // Create the room in memory
                    const room = {
                        Started: false,
                        gameMode: 'classic', // Default game mode
                        players: [
                            {
                                socketId: null, // Will be set when they join the room
                                username: player1.username || `Player1`,
                                isHost: true,
                                userId: matchResult.player1.id
                            },
                            {
                                socketId: null, // Will be set when they join the room
                                username: player2.username || `Player2`,
                                isHost: false,
                                userId: matchResult.player2.id
                            }
                        ]
                    };
                    
                    // Store the room
                    rooms.set(roomId, room);
                    
                    log(`Created room ${roomId} for matched players: ${player1.username} vs ${player2.username}`, 'success');
                }
            }
            
            log(`Matchmaking complete. Created ${matchCount} matches.`, 'success');
            return true;
        }
    },
    
    stop: {
        description: 'Stops the server',
        execute: () => {
            log('Stopping server...', 'info');
            // Clean up resources and exit
            if (global.matchmakingInterval) {
                clearInterval(global.matchmakingInterval);
            }
            log('Server stopped.', 'success');
            process.exit(0);
            return true;
        }
    }
};

// Handle commands from the console
rl.on('line', async (line) => {
    const args = line.trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();
    
    if (commands[cmd]) {
        serverStats.commandsExecuted++;
        try {
            await commands[cmd].execute(args);
        } catch (error) {
            log(`Error executing command ${cmd}: ${error.message}`, 'error');
        }
    } else if (cmd) {
        log(`Unknown command: ${cmd}. Type 'help' for a list of commands.`, 'warn');
    }
    
    rl.prompt();
});

rl.on('close', () => {
    log('Server is shutting down...', 'info');
    process.exit(0);
});

// Ensure db directory exists
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Store room data globally
const rooms = new Map();
// Store which room each socket is in
const userRooms = new Map();
// Track connected users and their count
const connectedUsers = new Set();
let onlineUserCount = 0;

// Game mode configurations
const gameModes = {
  classic: {
    initialGold: 500,
    miningRate: 50,
    unitCosts: {
      miner: 100,
      soldier: 200,
      barrier: 50
    },
    unitStats: {
      miner: { health: 100, speed: 1 },
      soldier: { health: 200, damage: 10, speed: 1 },
      barrier: { health: 300 }
    },
    rpsGoldReward: 100, // Gold awarded for winning RPS
    miningInterval: 1000 // 1 second mining tick
  },
  insane: {
    initialGold: 1000,
    miningRate: 100,
    unitCosts: {
      miner: 100,
      soldier: 250,
      barrier: 75,
      berserker: 400  // Extra unit only in insane mode
    },
    unitStats: {
      miner: { health: 80, speed: 1.5 },
      soldier: { health: 250, damage: 20, speed: 1.3 },
      barrier: { health: 500 },
      berserker: { health: 180, damage: 40, speed: 1.8 }
    },
    rpsGoldReward: 200, // Double gold for insane mode
    miningInterval: 800 // Faster mining tick (0.8 seconds)
  },
  beta: {
    initialGold: 700,
    miningRate: 65,
    unitCosts: {
      miner: 120,
      soldier: 220,
      barrier: 60,
      scout: 150  // Extra unit only in beta mode
    },
    unitStats: {
      miner: { health: 120, speed: 1, ability: "Find Bonus" },
      soldier: { health: 180, damage: 15, speed: 1, ability: "Stun" },
      barrier: { health: 350, ability: "Repair" },
      scout: { health: 90, damage: 5, speed: 2, ability: "Stealth" }
    },
    rpsGoldReward: 150, // Moderate gold reward
    miningInterval: 900, // Moderate mining tick (0.9 seconds)
    specialRules: {
      bonusChance: 0.2 // 20% chance for miners to find bonus gold
    }
  }
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Create session middleware
const sessionMiddleware = session({
    store: new SQLiteStore({ 
        db: 'sessions.sqlite',
        dir: dbDir,
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'tianxia-taiping-secret-key',
    resave: true,
    saveUninitialized: true,
    cookie: { 
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        httpOnly: true,
        sameSite: 'lax'
    }
});

// Apply session middleware to Express
app.use(sessionMiddleware);

// Initialize Passport and session support
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport to use Google OAuth 2.0 strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    scope: ['profile', 'email'],
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        // Check if we are linking an existing account
        if (req.session && req.session.linkGoogleToUserId) {
            const userId = req.session.linkGoogleToUserId;
            
            // Check if this Google ID is already linked to another account
            const existingGoogleUser = await prisma.user.findFirst({
                where: { googleId: profile.id }
            });
            
            if (existingGoogleUser && existingGoogleUser.id !== userId) {
                // This Google account is already linked to another user
                return done(null, false, { message: 'This Google account is already linked to another user' });
            }
            
            // Update the existing user with Google info
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    googleId: profile.id,
                    email: profile.emails?.[0]?.value || null
                }
            });
            
            return done(null, user);
        }
        
        // Regular authentication flow
        // Check if user already exists with this Google ID
        let user = await prisma.user.findFirst({
            where: {
                googleId: profile.id
            }
        });

        if (!user) {
            // If no user with this Google ID exists, create a new one
            // Generate a unique username based on Google profile
            const username = `${profile.displayName.replace(/\s+/g, '')}_${Math.floor(Math.random() * 1000)}`;
            
            user = await prisma.user.create({
                data: {
                    username: username,
                    googleId: profile.id,
                    email: profile.emails?.[0]?.value || null,
                    password: await bcrypt.hash(Math.random().toString(36).slice(-10), 10), // Generate random password
                    role: 'PLAYER',
                    elo: 1200,
                    banStatus: 'CLEAR'
                }
            });
        }
        
        return done(null, user);
    } catch (error) {
        console.error("Error in Google authentication strategy:", error);
        return done(error);
    }
}));

// Serialize and deserialize user for sessions
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id }
        });
        done(null, user);
    } catch (error) {
        done(error);
    }
});

// Share session with Socket.IO
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
};

// Admin middleware
const isAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if the user has ADMIN role
    if (user.role !== "ADMIN") {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Server error checking admin status' });
  }
};

// Check if user is banned middleware
const checkBanStatus = async (req, res, next) => {
  if (!req.session.userId) {
    return next();
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });
    
    if (user && user.banStatus === "BANNED") {
      // User is banned, destroy session and redirect
      req.session.destroy(err => {
        if (err) {
          console.error('Error destroying session for banned user:', err);
        }
      });
      
      return res.status(403).json({ error: 'Your account has been banned' });
    }
    
    next();
  } catch (error) {
    console.error('Ban check error:', error);
    next();
  }
};

// Apply ban check middleware to all requests
app.use(checkBanStatus);

// Socket.IO connection handling
io.on('connection', (socket) => {
    log(`User connected: ${socket.id}`, 'verbose');
    serverStats.totalConnections++;
    
    // Add user to connected users set
    connectedUsers.add(socket.id);
    onlineUserCount = connectedUsers.size;
    
    // Broadcast updated user count to all clients
    io.emit('userCountUpdate', { count: onlineUserCount });

    // Handle room check
    socket.on('checkRoom', (data) => {
        const { roomId } = data;
        const roomExists = rooms.has(roomId);
        
        log(`Checking if room ${roomId} exists: ${roomExists}`, 'verbose');
        
        // Respond with existence status
        socket.emit('roomCheckResult', { 
            exists: roomExists,
            roomId
        });
    });

    // Handle room creation
    socket.on('createRoom', async (data) => {
        try {
            // Check if user is already in a room
            if (userRooms.has(socket.id)) {
                const currentRoomId = userRooms.get(socket.id);
                log(`User ${socket.id} is already in room ${currentRoomId}, leaving before creating new room`, 'debug');
                
                // Leave current room first
                await leaveRoom(socket, currentRoomId);
            }
            
            // Use provided room ID or generate a new one
            const roomId = data.roomId || Math.random().toString(36).substring(2, 8).toUpperCase();
            
            // Check if room already exists
            if (rooms.has(roomId)) {
                socket.emit('error', { message: 'room_already_exists' });
                return;
            }
            
            // Create the room
            socket.join(roomId);
            
            // Set game mode (default to classic if not specified)
            const gameMode = data.gameMode || 'classic';
            
            // Initialize room data with username and game mode
            const roomData = {
              Started: false,
              gameMode: gameMode,
              players: [{
                  socketId: socket.id,
                  username: data.username || 'Player 1',
                  isHost: true,
                  userId: socket.request?.session?.userId
              }]
            };
            rooms.set(roomId, roomData);
            
            // Associate this socket with the room
            userRooms.set(socket.id, roomId);
            
            // Save the room ID to the user's database record if they're logged in
            if (socket.request && socket.request.session && socket.request.session.userId) {
                try {
                    await prisma.user.update({
                        where: { id: socket.request.session.userId },
                        data: { lastRoom: roomId }
                    });
                    log(`Saved lastRoom=${roomId} for user ID ${socket.request.session.userId}`, 'debug');
                } catch (dbError) {
                    log(`Error saving lastRoom to database: ${dbError}`, 'error');
                }
            }
            
            // Notify the creator that the room was created
            socket.emit('roomCreated', { roomId, gameMode });
            
            // Send initial player list to all clients in the room (including creator)
            io.in(roomId).emit('playerList', {
                players: roomData.players,
                gameMode: roomData.gameMode
            });
            
            log(`Room created: ${roomId} by user: ${data.username} (${socket.id}) with game mode: ${gameMode}`, 'info');
        } catch (error) {
            log(`Error creating room: ${error}`, 'error');
            socket.emit('error', { message: 'Failed to create room' });
        }
    });

    // Handle room joining
    socket.on('joinRoom', (data) => {
        const { roomId, username } = data;
        log(`User ${username} (${socket.id}) attempting to join room ${roomId}`, 'debug');
        
        // Check if user is already in a room
        if (userRooms.has(socket.id)) {
            const currentRoomId = userRooms.get(socket.id);
            log(`User ${socket.id} is already in room ${currentRoomId}, leaving before joining new room`, 'debug');
            
            // Leave current room first
            leaveRoom(socket, currentRoomId)
                .then(() => {
                    // Continue with join after leaving
                    processRoomJoin(socket, roomId, username);
                })
                .catch(error => {
                    console.error('Error leaving current room:', error);
                    socket.emit('error', { message: 'Failed to join room' });
                });
        } else {
            // Not in any room, proceed with join
            processRoomJoin(socket, roomId, username);
        }
    });

    // Handle joining an existing room
    function processRoomJoin(socket, roomId, username) {
        if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'room_not_found' });
            log(`Join room failed: Room ${roomId} not found for user ${username} (${socket.id})`, 'warn');
            return;
        }
        
        const room = rooms.get(roomId);
        log(`User ${username} (${socket.id}) attempting to join room ${roomId}`, 'debug');
        
        // Check if the user is already in the player list by username or userId
        const userId = socket.request?.session?.userId;
        const existingPlayerIndex = room.players.findIndex(p => 
            p.username === username || 
            (userId && p.userId === userId)
        );
        
        // If game already started, handle accordingly
        if (room.Started) {
            const isReconnect = existingPlayerIndex !== -1 || 
                              (room.gameState && room.gameState.players.some(p => 
                                  p.username === username));
            
            if (!isReconnect) {
                socket.emit('error', { message: 'game_already_started' });
                log(`Join room failed: Game already started in room ${roomId} for non-participant ${username}`, 'warn');
                return;
            }
            
            log(`Player ${username} is rejoining a started game in room ${roomId}`, 'debug');
        } else {
            // For games that haven't started yet
            
            // Check if room is full and user isn't already in it
            if (room.players.length >= 2 && existingPlayerIndex === -1) {
                socket.emit('error', { message: 'room_full' });
                log(`Join room failed: Room ${roomId} is full for new user ${username}`, 'warn');
                return;
            }
            
            // If this is a new player, check if username is taken
            if (existingPlayerIndex === -1 && room.players.some(p => p.username === username)) {
                socket.emit('error', { message: 'username_taken' });
                log(`Join room failed: Username ${username} already taken in room ${roomId}`, 'warn');
                return;
            }
        }
        
        // Join the socket.io room
        socket.join(roomId);
        
        // Update player data in the room
        if (existingPlayerIndex !== -1) {
            // Update existing player's socket ID
            room.players[existingPlayerIndex].socketId = socket.id;
            log(`Updated socket ID for player ${username} in room ${roomId}`, 'debug');
        } else {
            // Add new player to the room
            room.players.push({ 
                socketId: socket.id,
                username, 
                isHost: room.players.length === 0, // First player is host
                userId: socket.request?.session?.userId
            });
            log(`Added new player ${username} to room ${roomId}`, 'debug');
        }
        
        // If game already started, update the player's socket ID in the game state
        if (room.Started && room.gameState) {
            // Find player in game state and update their socket ID
            const playerInGame = room.gameState.players.find(p => p.username === username);
            if (playerInGame) {
                playerInGame.id = socket.id;
                log(`Updated socket ID in game state for player ${username} in room ${roomId}`, 'debug');
            }
            
            // Send game state to the reconnected player
            socket.emit('gameStarted', room.gameState);
            log(`Sent game state to reconnected player ${username} in room ${roomId}`, 'debug');
        }
        
        // Associate this socket with the room
        userRooms.set(socket.id, roomId);
        
        // Save the room ID to the user's database record if they're logged in
        if (socket.request && socket.request.session && socket.request.session.userId) {
            try {
                prisma.user.update({
                    where: { id: socket.request.session.userId },
                    data: { lastRoom: roomId }
                }).then(() => {
                    log(`Saved lastRoom=${roomId} for user ID ${socket.request.session.userId}`, 'verbose');
                }).catch(dbError => {
                    log(`Error saving lastRoom to database: ${dbError}`, 'error');
                });
            } catch (dbError) {
                log(`Error in lastRoom update transaction: ${dbError}`, 'error');
            }
        }
        
        log(`User ${username} (${socket.id}) joined room ${roomId}`, 'info');
        
        // Send updated player list to all clients in the room
        io.to(roomId).emit('playerList', { 
            players: room.players,
            gameMode: room.gameMode 
        });
        
        // Send confirmation to the client that they've joined successfully
        socket.emit('joinedRoom', { 
            roomId,
            players: room.players,
            gameMode: room.gameMode
        });
    }

    // Handle leaving room
    socket.on('leaveRoom', () => {
        try {
            // Get the room from userRooms map
            const roomId = userRooms.get(socket.id);
            if (!roomId) {
                socket.emit('error', { message: 'not_in_room' });
                return;
            }
            
            leaveRoom(socket, roomId);
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    });

    // Reusable function for leaving a room
    async function leaveRoom(socket, roomId) {
        const room = rooms.get(roomId);
        
        if (room) {
            // Find the leaving player
            const leavingPlayer = room.players.find(p => p.socketId === socket.id);
            
            // Remove player from room
            room.players = room.players.filter(p => p.socketId !== socket.id);
            
            // Remove the socket from the user-room mapping
            userRooms.delete(socket.id);
            
            // If room is empty, delete it
            if (room.players.length === 0) {
                rooms.delete(roomId);
                log(`Room ${roomId} deleted because it's empty`, 'info');
                
                // If the user is logged in, clear their lastRoom since the room no longer exists
                if (socket.request && socket.request.session && socket.request.session.userId) {
                    try {
                        await prisma.user.update({
                            where: { id: socket.request.session.userId },
                            data: { lastRoom: null }
                        });
                        log(`Cleared lastRoom for user ID ${socket.request.session.userId} as room was deleted`, 'info');
                    } catch (dbError) {
                        log(`Error clearing lastRoom in database: ${dbError}`, 'error');
                    }
                }
            } else {
                
                // Update remaining players
                io.to(roomId).emit('playerList', {
                    players: room.players
                });
                
                // Notify remaining players that someone left
                io.to(roomId).emit('playerLeft', {
                    username: leavingPlayer?.username,
                    isHost: leavingPlayer?.isHost
                });
            }
            
            // Leave the socket room
            socket.leave(roomId);
            
            log(`User ${socket.id} left room ${roomId}`, 'info');
            
            return true;
        }
        
        return false;
    }

    socket.on('disconnect', () => {
        log(`User disconnected: ${socket.id}`, 'verbose');
        
        // Remove from connected users set
        connectedUsers.delete(socket.id);
        onlineUserCount = connectedUsers.size;
        
        // Broadcast updated user count
        io.emit('userCountUpdate', { count: onlineUserCount });
        
        // Check if user was in a room
        if (userRooms.has(socket.id)) {
            const roomId = userRooms.get(socket.id);
            log(`Disconnected user ${socket.id} was in room ${roomId}, cleaning up`, 'info');
            
            leaveRoom(socket, roomId);
        } else {
            log(`Disconnected user ${socket.id} was not in any room`, 'info');
        }
    });

    // Debug function to log the current user-room map
    function logUserRoomMap() {
    }

    // Handle start game
    socket.on('startGame', () => {
        // Get the room from userRooms map
        const roomId = userRooms.get(socket.id);
        if (!roomId) {
            socket.emit('error', { message: 'not_in_room' });
            return;
        }
        
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'room_not_found' });
            return;
        }
        
        // Check if sender is the host
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) {
            socket.emit('error', { message: 'only_host_can_start' });
            return;
        }
        
        // Check if there are exactly 2 players
        if (room.players.length !== 2) {
            socket.emit('error', { message: 'need_two_players' });
            return;
        }
        
        // Check if game already started
        if (room.gameState && room.gameState.started) {
            socket.emit('error', { message: 'game_already_started' });
            return;
        }
        
        log(`Starting game in room ${roomId} with mode ${room.gameMode || 'classic'}`, 'info');
        
        // Set the Started flag to true
        room.Started = true;
        
        // Get game mode configuration
        const gameMode = room.gameMode || 'classic';
        const modeConfig = gameModes[gameMode] || gameModes.classic;
        
        // Initialize game state with game mode settings
        // Place two minerals: one for each side (static positions for now)
        room.gameState = {
            started: true,
            gameMode: gameMode,
            players: room.players.map(p => ({
                id: p.socketId,
                username: p.username,
                gold: modeConfig.initialGold,
                hp: 100
            })),
            units: [],
            minerals: [
                { id: 1, x: 100, y: 300 }, // left mineral
                { id: 2, x: 900, y: 300 }  // right mineral
            ]
        };
        
        // Send initial game state to all players
        io.to(roomId).emit('gameStarted', room.gameState);

        // Start mining interval for this room when the game starts
        startMiningInterval(roomId);
    });

    // Handle mineral collection
    socket.on('collectMineral', (data) => {
        const { position, value } = data;
        
        // Get the room from userRooms map
        const roomId = userRooms.get(socket.id);
        if (!roomId) {
            socket.emit('error', { message: 'not_in_room' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Only process if room exists, game has started, and game state is initialized
        if (!room || !room.gameState || !room.gameState.started) return;
        
        const player = room.gameState.players.find(p => p.id === socket.id || p.socketId === socket.id);
        if (!player) return;
        
        // Add gold to player (fixed value of 75)
        player.gold += value || 75;
        
        // Get both players' gold amounts
        const playersGold = room.gameState.players.map(p => ({
            playerId: p.id || p.socketId,
            gold: p.gold
        }));
        
        // Notify all players with complete gold information
        io.to(roomId).emit('goldSyncUpdate', {
            players: playersGold
        });
    });

    // Handle unit spawn
    socket.on('spawnUnit', (data) => {
        const { unitId, unitType, x, y, isLeftPlayer } = data;
        
        // Get the room from userRooms map
        const roomId = userRooms.get(socket.id);
        if (!roomId) {
            socket.emit('error', { message: 'not_in_room' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Only process if room exists, game has started, and game state is initialized
        if (!room || !room.gameState || !room.gameState.started) {
            log(`Invalid unit spawn attempt: room exists=${!!room}, game started=${room?.gameState?.started}`);
            return;
        }
        
        // Find player by socket ID
        let player = room.gameState.players.find(p => p.id === socket.id);
        if (!player) {
            // Try finding by socketId if not found by id
            player = room.gameState.players.find(p => p.socketId === socket.id);
            if (!player) {
                log(`Player not found for socket ID: ${socket.id}`);
                return;
            }
        }
        
        // Get game mode configuration for unit costs
        const gameMode = room.gameMode || 'classic';
        const modeConfig = gameModes[gameMode] || gameModes.classic;
        
        // Get unit cost from the game mode configuration
        const cost = modeConfig.unitCosts[unitType] || 100; // Default to 100 if not specified
        
        if (player.gold < cost) {
            log(`Not enough gold: player has ${player.gold}, needs ${cost}`);
            socket.emit('error', { message: 'not_enough_gold' });
            return;
        }
        
        // Deduct gold
        player.gold -= cost;
        
        // Get unit stats from the game mode configuration
        const unitStats = modeConfig.unitStats[unitType] || {};
        
        log(`Player ${socket.id} spawned ${unitType} at (${x}, ${y}), isLeftPlayer: ${isLeftPlayer}`);
        
        // Broadcast unit spawn to all clients in the room
        const unitData = {
            id: unitId || Date.now(),
            type: unitType,
            x,
            y,
            isLeftPlayer,
            playerId: socket.id, // Track owner
            ...unitStats // Add the unit stats from the game mode configuration
        };
        
        // Add to server-side unit list for this room
        if (!room.gameState.units) room.gameState.units = [];
        room.gameState.units.push(unitData);
        
        // Emit to all clients in the room
        io.to(roomId).emit('unitSpawned', unitData);
        
        // Get both players' gold amounts
        const playersGold = room.gameState.players.map(p => ({
            playerId: p.id || p.socketId,
            gold: p.gold
        }));
        
        // Send gold update to all players
        io.to(roomId).emit('goldSyncUpdate', {
            players: playersGold
        });
    });

    // --- Server-side mining tick ---
    // Start mining interval for this room when the game starts
    function startMiningInterval(roomId) {
        const room = rooms.get(roomId);
        if (!room) return;
        if (room.miningInterval) return; // Already running
        
        // Get mining rate and interval based on game mode
        const gameMode = room.gameMode || 'classic';
        const modeConfig = gameModes[gameMode] || gameModes.classic;
        const miningRate = modeConfig.miningRate;
        const intervalTime = modeConfig.miningInterval || 1000; // Default to 1 second
        
        room.miningInterval = setInterval(() => {
            if (!room.gameState || !room.gameState.units || !room.gameState.minerals) return;
            // For each miner unit, check if it's close to a mineral
            room.gameState.units.forEach(unit => {
                if (unit.type !== 'miner') return;
                // Use unit.x, unit.y (should be updated by client on move)
                const isNearMineral = room.gameState.minerals.some(mineral => {
                    const dx = (unit.x ?? 0) - mineral.x;
                    const dy = (unit.y ?? 0) - mineral.y;
                    return Math.sqrt(dx*dx + dy*dy) < 32;
                });
                if (isNearMineral) {
                    // Find player
                    let player = room.gameState.players.find(p => p.id === unit.playerId || p.socketId === unit.playerId);
                    if (player) {
                        // Apply basic mining rate
                        player.gold += miningRate;
                        
                        // Check for bonus gold in beta mode
                        if (gameMode === 'beta' && modeConfig.specialRules?.bonusChance) {
                            if (Math.random() < modeConfig.specialRules.bonusChance) {
                                const bonus = Math.floor(Math.random() * 30) + 20; // 20-50 bonus gold
                                player.gold += bonus;
                                
                                // Notify player of bonus gold (if we had a way to send individual messages)
                                io.to(roomId).emit('bonusGold', {
                                    playerId: player.id || player.socketId,
                                    amount: bonus,
                                    unitId: unit.id
                                });
                            }
                        }
                    }
                }
            });
            // Sync gold for both players
            io.to(roomId).emit('goldSyncUpdate', {
                players: room.gameState.players.map(p => ({ playerId: p.id || p.socketId, gold: p.gold }))
            });
        }, intervalTime);
    }

    // Mining: Only the owner of the mining unit gets the gold
    socket.on('collectMineral', (data) => {
        const { unitId, x, y } = data; // Expect miner's position from client
        const roomId = userRooms.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || !room.gameState || !room.gameState.units || !room.gameState.minerals) return;
        const unit = room.gameState.units.find(u => u.id === unitId);
        if (!unit || unit.type !== 'miner') return;
        // Only the owner can collect
        if (unit.playerId !== socket.id) return;
        // Check if miner is close enough to any mineral
        const isNearMineral = room.gameState.minerals.some(mineral => {
            const dx = (x ?? unit.x) - mineral.x;
            const dy = (y ?? unit.y) - mineral.y;
            return Math.sqrt(dx*dx + dy*dy) < 32;
        });
        if (!isNearMineral) return;
        // Find player
        let player = room.gameState.players.find(p => p.id === socket.id || p.socketId === socket.id);
        if (!player) return;
        player.gold += 50;
        // Sync gold for both players
        io.to(roomId).emit('goldSyncUpdate', {
            players: room.gameState.players.map(p => ({ playerId: p.id || p.socketId, gold: p.gold }))
        });
    });

    // --- Rock Paper Scissors (RPS) Mini-game ---
    socket.on('rpsPlay', (data) => {
        const { move } = data; // move: 'rock', 'paper', or 'scissors' or null
        const roomId = userRooms.get(socket.id);
        if (!roomId) {
            socket.emit('error', { message: 'not_in_room' });
            return;
        }
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'room_not_found' });
            return;
        }
        if (!room.rps) room.rps = {};
        room.rps[socket.id] = move;
        socket.emit('rpsMoveReceived', { move });
        // Start timer if not already started
        if (!room.rpsTimer) {
            room.rpsTimer = setTimeout(() => {
                finishRPSRound(roomId);
            }, 10000);
        }
        // If both players have played, finish round early
        if (Object.keys(room.rps).length === 2) {
            clearTimeout(room.rpsTimer);
            room.rpsTimer = null;
            finishRPSRound(roomId);
        }
    });

    function finishRPSRound(roomId) {
        const room = rooms.get(roomId);
        if (!room || !room.rps) return;
        const [p1, p2] = room.players;
        const move1 = room.rps[p1.socketId];
        const move2 = room.rps[p2.socketId];
        let winner = 'draw';
        if (move1 && move2) {
            if (move1 === move2) {
                winner = 'draw';
            } else if (
                (move1 === 'rock' && move2 === 'scissors') ||
                (move1 === 'scissors' && move2 === 'paper') ||
                (move1 === 'paper' && move2 === 'rock')
            ) {
                winner = p1.username;
            } else {
                winner = p2.username;
            }
        } else if (move1 && !move2) {
            winner = p1.username;
        } else if (!move1 && move2) {
            winner = p2.username;
        }
        
        // Get game mode configuration for RPS gold reward
        const gameMode = room.gameMode || 'classic';
        const modeConfig = gameModes[gameMode] || gameModes.classic;
        const goldReward = modeConfig.rpsGoldReward || 100; // Default to 100 if not specified
        
        // Award gold to winner based on game mode
        if (winner !== 'draw') {
            const player = room.gameState.players.find(p => p.username === winner);
            if (player) player.gold += goldReward;
        }
        // Broadcast result
        io.to(roomId).emit('rpsResult', {
            player1: { username: p1.username, move: move1 },
            player2: { username: p2.username, move: move2 },
            winner,
            goldReward // Include the gold reward in the response
        });
        // Sync gold
        io.to(roomId).emit('goldSyncUpdate', {
            players: room.gameState.players.map(p => ({ playerId: p.id || p.socketId, gold: p.gold }))
        });
        room.rps = {};
        // DO NOT auto-restart or auto-reset here. Wait for explicit rpsReset from clients.
    }

    socket.on('rpsReset', () => {
        const roomId = userRooms.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        room.rps = {};
        io.to(roomId).emit('rpsReset');
    });

    // --- Game Over ---
    socket.on('gameOver', (data) => {
        const roomId = userRooms.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        if (room.gameState && room.gameState.ended) return; // Prevent duplicate
        room.gameState.ended = true;
        // Clean up intervals
        if (room.miningInterval) {
            clearInterval(room.miningInterval);
            room.miningInterval = null;
        }
        // Broadcast to all players
        io.to(roomId).emit('gameOver', { winner: data.winner });
    });

    // Add handler for setting game mode
    socket.on('setGameMode', (data) => {
        const roomId = userRooms.get(socket.id);
        if (!roomId) {
            socket.emit('error', { message: 'not_in_room' });
            return;
        }
        
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'room_not_found' });
            return;
        }
        
        // Check if sender is the host
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) {
            socket.emit('error', { message: 'only_host_can_change_mode' });
            return;
        }
        
        // Check if game already started
        if (room.Started) {
            socket.emit('error', { message: 'cannot_change_mode_after_start' });
            return;
        }
        
        // Update game mode
        const newMode = data.mode || 'classic';
        room.gameMode = newMode;
        
        // Notify all players in the room
        io.to(roomId).emit('gameModeChanged', { gameMode: newMode });
        
        log(`Game mode changed to ${newMode} in room ${roomId}`, 'info');
    });
});

// ===== API Routes =====

// ===== Admin API Routes =====

// Get all users (admin only)
app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        elo: true,
        banStatus: true,
        createdAt: true,
        updatedAt: true
        // password is intentionally excluded for security
      },
      orderBy: {
        id: 'asc'
      }
    });
    
    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// Get single user by ID (admin only)
app.get('/api/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        elo: true,
        banStatus: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

// Update user (admin only)
app.put('/api/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const { username, role, elo } = req.body;
    
    // Validate input
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Validate role
    if (role && !["ADMIN", "PLAYER"].includes(role)) {
      return res.status(400).json({ error: 'Role must be either ADMIN or PLAYER' });
    }
    
    if (typeof elo !== 'undefined' && (isNaN(elo) || elo < 0)) {
      return res.status(400).json({ error: 'ELO must be a non-negative number' });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if username is already taken by another user
    if (username !== existingUser.username) {
      const userWithSameUsername = await prisma.user.findUnique({
        where: { username }
      });
      
      if (userWithSameUsername) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }
    
    // Prepare update data
    const updateData = {
      username,
      ...(role && { role }),
      ...(typeof elo !== 'undefined' && { elo: parseInt(elo) })
    };
    
    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        elo: true,
        banStatus: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deleting self
    if (userId === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Delete user
    await prisma.user.delete({
      where: { id: userId }
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ===== Regular User API Routes =====

// Signup endpoint
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码是必填项' });
    }
    
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    // Count total users to determine if this is the first user
    const userCount = await prisma.user.count();
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: userCount === 0 ? "ADMIN" : "PLAYER", // First user gets ADMIN role, others get PLAYER role
        elo: 1200
      }
    });
    
    // Set session to log in the user automatically
    req.session.userId = newUser.id;
    
    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      elo: newUser.elo
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: '注册失败，请稍后再试' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码是必填项' });
    }
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { username }
    });
    
    // User not found or password incorrect
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    // Check if user is banned
    if (user.banStatus === "BANNED") {
      return res.status(403).json({ error: '您的账户已被封禁' });
    }
    
    // Set session
    req.session.userId = user.id;
    
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      elo: user.elo
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败，请稍后再试' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: '退出登录失败' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: '已成功退出登录' });
  });
});

// Get current user endpoint
app.get('/api/user/me', isAuthenticated, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      elo: user.elo
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// Add this API endpoint to clear lastRoom
app.post('/api/user/clear-last-room', isAuthenticated, async (req, res) => {
    try {
        // Update user to clear lastRoom field
        await prisma.user.update({
            where: { id: req.session.userId },
            data: { lastRoom: null }
        });
        
        log(`Cleared lastRoom for user ID ${req.session.userId}`, 'info');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing lastRoom:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Existing /api/user/last-room endpoint update to better check room existence
app.get('/api/user/last-room', isAuthenticated, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.session.userId }
        });
        
        if (!user || !user.lastRoom) {
            return res.json({ hasLastRoom: false });
        }
        
        // Check if the room still exists
        const roomExists = rooms.has(user.lastRoom);
        
        // Check if the room has this user as a player
        let isInRoom = false;
        if (roomExists) {
            const room = rooms.get(user.lastRoom);
            isInRoom = room.players.some(p => 
                p.userId === req.session.userId || 
                p.username === user.username
            );
            
            // If room exists but user is not in it, clear the lastRoom reference
            if (!isInRoom) {
                await prisma.user.update({
                    where: { id: req.session.userId },
                    data: { lastRoom: null }
                });
                log(`User ${req.session.userId} not found in room ${user.lastRoom}, cleared lastRoom reference`, 'info');
            }
        } else {
            // Room doesn't exist anymore, clear the lastRoom field
            await prisma.user.update({
                where: { id: req.session.userId },
                data: { lastRoom: null }
            });
            log(`Room ${user.lastRoom} no longer exists, cleared lastRoom for user ${req.session.userId}`, 'info');
        }
        
        // Detailed logging to debug matchmaking
        log(`Last room check for user ${req.session.userId}: roomId=${user.lastRoom}, exists=${roomExists}, isInRoom=${isInRoom}`, 'verbose');
        
        res.json({
            hasLastRoom: roomExists && isInRoom,
            roomId: (roomExists && isInRoom) ? user.lastRoom : null
        });
    } catch (error) {
        console.error('Error checking last room:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user info
app.get('/api/me', isAuthenticated, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return user info without password
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      elo: user.elo,
      banStatus: user.banStatus,
      lastRoom: user.lastRoom
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Friend system API routes
app.post('/api/friends/request', isAuthenticated, async (req, res) => {
  try {
    const { targetUsername } = req.body;
    const senderId = req.session.userId;

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { username: targetUsername }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if sending request to self
    if (targetUser.id === senderId) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself' });
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId: targetUser.id },
          { senderId: targetUser.id, receiverId: senderId }
        ]
      }
    });

    if (existingFriendship) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    // Create friendship
    const friendship = await prisma.friendship.create({
      data: {
        senderId,
        receiverId: targetUser.id,
        status: 'pending'
      }
    });

    res.status(201).json(friendship);
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

app.get('/api/friends', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Get all accepted friendships where the user is either sender or receiver
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'accepted' },
          { receiverId: userId, status: 'accepted' }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            rank: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            rank: true
          }
        }
      }
    });

    // Format the response
    const friends = friendships.map(friendship => {
      const friend = friendship.senderId === userId 
        ? friendship.receiver 
        : friendship.sender;
      
      return {
        friendshipId: friendship.id,
        userId: friend.id,
        username: friend.username,
        rank: friend.rank
      };
    });

    res.json(friends);
  } catch (error) {
    console.error('Error getting friends:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

app.get('/api/friends/requests', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Get all pending friend requests received by the user
    const friendRequests = await prisma.friendship.findMany({
      where: {
        receiverId: userId,
        status: 'pending'
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            rank: true
          }
        }
      }
    });

    // Format the response
    const requests = friendRequests.map(request => ({
      requestId: request.id,
      from: {
        userId: request.sender.id,
        username: request.sender.username,
        rank: request.sender.rank
      },
      createdAt: request.createdAt
    }));

    res.json(requests);
  } catch (error) {
    console.error('Error getting friend requests:', error);
    res.status(500).json({ error: 'Failed to get friend requests' });
  }
});

app.post('/api/friends/respond', isAuthenticated, async (req, res) => {
  try {
    const { requestId, action } = req.body;
    const userId = req.session.userId;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Find the request
    const request = await prisma.friendship.findUnique({
      where: { id: parseInt(requestId) }
    });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Verify the user is the receiver of this request
    if (request.receiverId !== userId) {
      return res.status(403).json({ error: 'Not authorized to respond to this request' });
    }

    // Update the request
    const updatedRequest = await prisma.friendship.update({
      where: { id: parseInt(requestId) },
      data: { status: action === 'accept' ? 'accepted' : 'rejected' }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error('Error responding to friend request:', error);
    res.status(500).json({ error: 'Failed to respond to friend request' });
  }
});

app.delete('/api/friends/:friendshipId', isAuthenticated, async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.session.userId;

    // Find the friendship
    const friendship = await prisma.friendship.findUnique({
      where: { id: parseInt(friendshipId) }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    // Check if user is part of this friendship
    if (friendship.senderId !== userId && friendship.receiverId !== userId) {
      return res.status(403).json({ error: 'Not authorized to remove this friendship' });
    }

    // Delete the friendship
    await prisma.friendship.delete({
      where: { id: parseInt(friendshipId) }
    });

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// Friend duel API route
app.post('/api/friends/duel', isAuthenticated, async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.session.userId;

    // Verify the friendship exists and is accepted
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: parseInt(friendId), status: 'accepted' },
          { senderId: parseInt(friendId), receiverId: userId, status: 'accepted' }
        ]
      }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'This person is not your friend' });
    }

    // Create a new room for the duel
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Return the room ID to redirect the user
    res.json({ roomId });
  } catch (error) {
    console.error('Error initiating friend duel:', error);
    res.status(500).json({ error: 'Failed to initiate duel' });
  }
});

// Open pairing system API endpoints
app.post('/api/pairing/join', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { eloMin, eloMax } = req.body;
    
    // Check if user is already in queue
    const existingQueue = await prisma.pairingQueue.findUnique({
      where: { userId }
    });
    
    if (existingQueue) {
      return res.status(400).json({ error: 'You are already in the matchmaking queue' });
    }
    
    // Add user to queue
    const queue = await prisma.pairingQueue.create({
      data: {
        userId,
        eloMin: eloMin ? parseInt(eloMin) : null,
        eloMax: eloMax ? parseInt(eloMax) : null
      }
    });
    
    // Try to find a match immediately
    const matchResult = await tryMatchmaking(userId);
    
    // If match found, create room and update user records
    if (matchResult) {
      log(`Match found for user ${userId}, creating room ${matchResult.roomId}`, 'success');
      
      // Create a room for the match
      const roomId = matchResult.roomId;
      
      // Update both users' lastRoom
      await prisma.user.update({
        where: { id: matchResult.player1.id },
        data: { lastRoom: roomId }
      });
      
      await prisma.user.update({
        where: { id: matchResult.player2.id },
        data: { lastRoom: roomId }
      });
      
      // Create the room in memory
      const room = {
        Started: false,
        gameMode: 'classic', // Default game mode
        players: [
          {
            socketId: null, // Will be set when they join the room
            username: matchResult.player1.username || `Player1`,
            isHost: true,
            userId: matchResult.player1.id
          },
          {
            socketId: null, // Will be set when they join the room
            username: matchResult.player2.username || `Player2`,
            isHost: false,
            userId: matchResult.player2.id
          }
        ]
      };
      
      // Store the room
      rooms.set(roomId, room);
      
      log(`Created room ${roomId} for matched players: ${matchResult.player1.username} vs ${matchResult.player2.username}`, 'success');
    } else {
      log(`No immediate match found for user ${userId}, added to queue`, 'info');
      
      // Schedule continuous matchmaking attempts
      // We'll try every 5 seconds to find matches for users in queue
      if (!global.matchmakingInterval) {
        log('Starting global matchmaking interval', 'info');
        global.matchmakingInterval = setInterval(async () => {
          try {
            // Get all users in queue
            const queuedUsers = await prisma.pairingQueue.findMany({
              select: { userId: true }
            });
            
            log(`Processing matchmaking for ${queuedUsers.length} users in queue`, 'info');
            
            // Try matchmaking for each user
            for (const user of queuedUsers) {
              const matchResult = await tryMatchmaking(user.userId);
              
              if (matchResult) {
                log(`Match found for user ${user.userId}, creating room ${matchResult.roomId}`, 'success');
                
                // Create a room for the match
                const roomId = matchResult.roomId;
                
                // Fetch usernames for both players
                const player1 = await prisma.user.findUnique({
                  where: { id: matchResult.player1.id },
                  select: { username: true }
                });
                
                const player2 = await prisma.user.findUnique({
                  where: { id: matchResult.player2.id },
                  select: { username: true }
                });
                
                // Update both users' lastRoom
                await prisma.user.update({
                  where: { id: matchResult.player1.id },
                  data: { lastRoom: roomId }
                });
                
                await prisma.user.update({
                  where: { id: matchResult.player2.id },
                  data: { lastRoom: roomId }
                });
                
                // Create the room in memory
                const room = {
                  Started: false,
                  gameMode: 'classic', // Default game mode
                  players: [
                    {
                      socketId: null, // Will be set when they join the room
                      username: player1.username || `Player1`,
                      isHost: true,
                      userId: matchResult.player1.id
                    },
                    {
                      socketId: null, // Will be set when they join the room
                      username: player2.username || `Player2`,
                      isHost: false,
                      userId: matchResult.player2.id
                    }
                  ]
                };
                
                // Store the room
                rooms.set(roomId, room);
                
                log(`Created room ${roomId} for matched players: ${player1.username} vs ${player2.username}`, 'success');
              }
            }
          } catch (error) {
            log(`Error in matchmaking interval: ${error}`, 'error');
          }
        }, 5000);
      }
    }
    
    res.status(201).json({ message: 'Joined matchmaking queue' });
  } catch (error) {
    log(`Error joining matchmaking queue: ${error}`, 'error');
    res.status(500).json({ error: 'Failed to join matchmaking queue' });
  }
});

app.delete('/api/pairing/leave', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    // Remove from queue
    await prisma.pairingQueue.deleteMany({
      where: { userId }
    });
    
    res.json({ message: 'Left matchmaking queue' });
  } catch (error) {
    log(`Error leaving matchmaking queue: ${error}`, 'error');
    res.status(500).json({ error: 'Failed to leave matchmaking queue' });
  }
});

app.get('/api/pairing/status', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    // Check if in queue
    const queueEntry = await prisma.pairingQueue.findUnique({
      where: { userId }
    });
    
    if (!queueEntry) {
      return res.json({ inQueue: false });
    }
    
    res.json({
      inQueue: true,
      joinedAt: queueEntry.joinedAt,
      eloMin: queueEntry.eloMin,
      eloMax: queueEntry.eloMax
    });
  } catch (error) {
    log(`Error checking queue status: ${error}`, 'error');
    res.status(500).json({ error: 'Failed to check queue status' });
  }
});

// Function to try matchmaking for a user
async function tryMatchmaking(userId) {
  try {
    // Get user's queue entry and ELO
    const userQueue = await prisma.pairingQueue.findUnique({
      where: { userId },
      include: { user: true }
    });
    
    if (!userQueue) return null;
    
    const userElo = userQueue.user.elo;
    
    // Find potential match based on ELO and time in queue
    const potentialMatches = await prisma.pairingQueue.findMany({
      where: {
        userId: { not: userId },
        // Apply ELO filters if specified by either user
        ...(userQueue.eloMin !== null && {
          user: { elo: { gte: userQueue.eloMin }}
        }),
        ...(userQueue.eloMax !== null && {
          user: { elo: { lte: userQueue.eloMax }}
        })
      },
      include: { user: true },
      orderBy: { joinedAt: 'asc' }
    });
    
    // Filter matches further based on matched user's ELO preferences
    const compatibleMatches = potentialMatches.filter(match => {
      const matchEloMin = match.eloMin;
      const matchEloMax = match.eloMax;
      
      // Check if this user's ELO falls within the match's ELO range (if specified)
      const withinMatchMinElo = matchEloMin === null || userElo >= matchEloMin;
      const withinMatchMaxElo = matchEloMax === null || userElo <= matchEloMax;
      
      return withinMatchMinElo && withinMatchMaxElo;
    });
    
    if (compatibleMatches.length === 0) {
      return null; // No matches found
    }
    
    // Get the first compatible match (oldest in queue)
    const match = compatibleMatches[0];
    
    // Create a game room
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create match record
    await prisma.match.create({
      data: {
        player1Id: userId,
        player2Id: match.userId,
        completed: false
      }
    });
    
    // Remove both users from the queue
    await prisma.pairingQueue.deleteMany({
      where: {
        userId: { in: [userId, match.userId] }
      }
    });
    
    return {
      roomId,
      player1: {
        id: userId,
        elo: userElo,
        username: userQueue.user.username
      },
      player2: {
        id: match.userId,
        elo: match.user.elo,
        username: match.user.username
      }
    };
  } catch (error) {
    log(`Error in matchmaking: ${error}`, 'error');
    return null;
  }
}

// Admin ban/unban API
app.post('/api/admin/users/:id/ban', isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Don't allow banning admins or self
    if (existingUser.role === "ADMIN" || userId === req.session.userId) {
      return res.status(400).json({ error: 'Cannot ban administrators or yourself' });
    }
    
    // Ban user
    await prisma.user.update({
      where: { id: userId },
      data: { banStatus: "BANNED" }
    });
    
    res.json({ message: 'User banned successfully' });
  } catch (error) {
    log(`Ban user error: ${error}`, 'error');
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

app.post('/api/admin/users/:id/unban', isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Unban user
    await prisma.user.update({
      where: { id: userId },
      data: { banStatus: "CLEAR" }
    });
    
    res.json({ message: 'User unbanned successfully' });
  } catch (error) {
    log(`Unban user error: ${error}`, 'error');
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login.html?error=google-login-failed' }),
  (req, res) => {
    // On successful authentication, set session
    if (req.user) {
      req.session.userId = req.user.id;
    }
    // Redirect to dashboard on success
    res.redirect('/dashboard.html');
  }
);

// Route for linking existing account with Google
app.get('/auth/google/link', isAuthenticated, (req, res) => {
  // Store the user ID in the session to connect after Google auth
  req.session.linkGoogleToUserId = req.session.userId;
  // Redirect to Google auth with a special 'link' parameter
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    state: 'linking-account'
  })(req, res);
});

// Callback for account linking - use the same callback URL
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/dashboard.html?error=google-link-failed' }),
  (req, res) => {
    // Check if this is a linking attempt
    if (req.session.linkGoogleToUserId) {
      // Clear the linking session var
      delete req.session.linkGoogleToUserId;
      
      // Make sure the user ID is in the session
      if (req.user) {
        req.session.userId = req.user.id;
      }
      
      // Redirect to dashboard with success message
      return res.redirect('/dashboard.html?success=google-linked');
    }
    
    // Normal login flow
    if (req.user) {
      req.session.userId = req.user.id;
    }
    // Redirect to dashboard on success
    res.redirect('/dashboard.html');
  }
);

// Check Google authentication status
app.get('/api/auth/google/status', (req, res) => {
  res.json({
    isAuthenticated: !!req.user,
    user: req.user ? {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    } : null
  });
});

// Unlink Google account
app.post('/api/auth/google/unlink', isAuthenticated, async (req, res) => {
  try {
    // Update user to remove Google ID
    await prisma.user.update({
      where: { id: req.session.userId },
      data: { 
        googleId: null,
        email: null  // Optionally remove the email too if it came from Google
      }
    });
    
    res.json({ success: true, message: 'Google account unlinked successfully' });
  } catch (error) {
    log(`Error unlinking Google account: ${error}`, 'error');
    res.status(500).json({ error: 'Failed to unlink Google account' });
  }
});

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Add a new API endpoint to get the current user count
app.get('/api/users/count', (req, res) => {
    res.json({ count: onlineUserCount });
});

// Add an endpoint to manually check for matches (for debugging and testing)
app.post('/api/pairing/check-matches', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Check if user is in queue
        const queueEntry = await prisma.pairingQueue.findUnique({
            where: { userId }
        });
        
        if (!queueEntry) {
            return res.status(400).json({ error: 'You are not in the matchmaking queue' });
        }
        
        // Try to find a match
        const matchResult = await tryMatchmaking(userId);
        
        if (matchResult) {
            // Create a room for the match
            const roomId = matchResult.roomId;
            
            // Update both users' lastRoom
            await prisma.user.update({
                where: { id: matchResult.player1.id },
                data: { lastRoom: roomId }
            });
            
            await prisma.user.update({
                where: { id: matchResult.player2.id },
                data: { lastRoom: roomId }
            });
            
            // Create the room in memory
            const room = {
                Started: false,
                gameMode: 'classic', // Default game mode
                players: [
                    {
                        socketId: null, // Will be set when they join the room
                        username: matchResult.player1.username || `Player1`,
                        isHost: true,
                        userId: matchResult.player1.id
                    },
                    {
                        socketId: null, // Will be set when they join the room
                        username: matchResult.player2.username || `Player2`,
                        isHost: false,
                        userId: matchResult.player2.id
                    }
                ]
            };
            
            // Store the room
            rooms.set(roomId, room);
            
            return res.json({ 
                matched: true, 
                roomId,
                message: 'Match found! Redirecting to game room...'
            });
        }
        
        return res.json({ 
            matched: false,
            message: 'No match found yet. Still in queue.'
        });
    } catch (error) {
        log(`Error checking for matches: ${error}`, 'error');
        res.status(500).json({ error: 'Failed to check for matches' });
    }
});

// Initialize database and start server
async function startServer() {
  try {
    // Check if Prisma schema exists
    log('Starting server and initializing database...', 'info');
    
    // Start the global matchmaking interval if it doesn't exist
    if (!global.matchmakingInterval) {
      log('Starting global matchmaking interval', 'info');
      global.matchmakingInterval = setInterval(async () => {
        try {
          // Get all users in queue
          const queuedUsers = await prisma.pairingQueue.findMany({
            select: { userId: true }
          });
          
          log(`Processing matchmaking for ${queuedUsers.length} users in queue`, 'info');
          
          // Try matchmaking for each user
          for (const user of queuedUsers) {
            const matchResult = await tryMatchmaking(user.userId);
            
            if (matchResult) {
              log(`Match found for user ${user.userId}, creating room ${matchResult.roomId}`, 'success');
              
              // Create a room for the match
              const roomId = matchResult.roomId;
              
              try {
                // Fetch usernames for both players
                const player1 = await prisma.user.findUnique({
                  where: { id: matchResult.player1.id },
                  select: { username: true }
                });
                
                const player2 = await prisma.user.findUnique({
                  where: { id: matchResult.player2.id },
                  select: { username: true }
                });
                
                // Update both users' lastRoom
                await prisma.user.update({
                  where: { id: matchResult.player1.id },
                  data: { lastRoom: roomId }
                });
                
                await prisma.user.update({
                  where: { id: matchResult.player2.id },
                  data: { lastRoom: roomId }
                });
                
                // Create the room in memory
                const room = {
                  Started: false,
                  gameMode: 'classic', // Default game mode
                  players: [
                    {
                      socketId: null, // Will be set when they join the room
                      username: player1.username || `Player1`,
                      isHost: true,
                      userId: matchResult.player1.id
                    },
                    {
                      socketId: null, // Will be set when they join the room
                      username: player2.username || `Player2`,
                      isHost: false,
                      userId: matchResult.player2.id
                    }
                  ]
                };
                
                // Store the room
                rooms.set(roomId, room);
                
                log(`Created room ${roomId} for matched players: ${player1.username} vs ${player2.username}`, 'success');
              } catch (innerError) {
                log(`Error setting up match: ${innerError}`, 'error');
              }
            }
          }
        } catch (error) {
          log(`Error in matchmaking interval: ${error}`, 'error');
        }
      }, 5000);
    }
    
    httpServer.listen(PORT, () => {
      console.clear();
      console.log(`
==================================
    天下太平 Web Server v1.0
==================================

 ████████╗██╗ █████╗ ███╗   ██╗██╗  ██╗██╗ █████╗ 
 ╚══██╔══╝██║██╔══██╗████╗  ██║╚██╗██╔╝██║██╔══██╗
    ██║   ██║███████║██╔██╗ ██║ ╚███╔╝ ██║███████║
    ██║   ██║██╔══██║██║╚██╗██║ ██╔██╗ ██║██╔══██║
    ██║   ██║██║  ██║██║ ╚████║██╔╝ ██╗██║██║  ██║
    ╚═╝   ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝
                                                   
████████╗ █████╗ ██╗██████╗ ██╗███╗   ██╗ ██████╗ 
╚══██╔══╝██╔══██╗██║██╔══██╗██║████╗  ██║██╔════╝ 
   ██║   ███████║██║██████╔╝██║██╔██╗ ██║██║  ███╗
   ██║   ██╔══██║██║██╔═══╝ ██║██║╚██╗██║██║   ██║
   ██║   ██║  ██║██║██║     ██║██║ ╚████║╚██████╔╝
   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚═╝  ╚═══╝ ╚═════╝ 
                                                   
      `);
      log(`Server is running on http://localhost:${PORT}`, 'success');
      log(`Website "天下太平" is now available!`, 'success');
      log(`Type 'help' for a list of available commands`, 'info');
      rl.prompt();
    });
  } catch (error) {
    log(`Failed to start server: ${error}`, 'error');
    process.exit(1);
  }
}

// Handle cleanup of matchmaking on server shutdown
process.on('SIGINT', async () => {
  if (global.matchmakingInterval) {
    clearInterval(global.matchmakingInterval);
  }
  log('Gracefully shutting down...', 'info');
  process.exit(0);
});

startServer();