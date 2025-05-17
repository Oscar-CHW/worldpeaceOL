/**
 * Socket Connection Handler
 * Manages socket connections and basic events
 */
const { log } = require('../config/logging');
const { addConnectedUser, removeConnectedUser, isUserConnected } = require('../models/users');
const { getPlayerRoom, markPlayerDisconnected } = require('../models/rooms');
const { addToMatchmaking, removeFromMatchmaking } = require('./matchmaking');
const prisma = require('../prisma/client');

/**
 * Initialize socket connection handlers
 * @param {Object} io - Socket.io server instance
 */
function initSocketHandlers(io) {
    // Track online user count for broadcasting
    let onlineUserCount = 0;
    
    io.on('connection', (socket) => {
        // Add to connected users
        addConnectedUser(socket.id);
        onlineUserCount++;
        
        // Broadcast updated user count
        io.emit('userCountUpdate', { count: onlineUserCount });
        
        log(`Socket connected: ${socket.id}`, 'debug', 'CONNECTIONS');
        
        // Handle authentication
        socket.on('authenticate', async (data, callback) => {
            try {
                // Validate session token
                if (!data || !data.token) {
                    if (callback) callback({ success: false, error: 'No authentication token provided' });
                    return;
                }
                
                // Find session
                const session = await prisma.session.findUnique({
                    where: { id: data.token },
                    include: { user: true }
                });
                
                if (!session || !session.user) {
                    if (callback) callback({ success: false, error: 'Invalid session' });
                    return;
                }
                
                // Store user data on socket
                socket.data.userId = session.user.id;
                socket.data.username = session.user.username;
                socket.data.authenticated = true;
                
                log(`Socket ${socket.id} authenticated as ${session.user.username} (${session.user.id})`, 'info', 'CONNECTIONS');
                
                if (callback) callback({ 
                    success: true, 
                    user: {
                        id: session.user.id,
                        username: session.user.username
                    }
                });
            } catch (error) {
                log(`Authentication error: ${error.message}`, 'error', 'AUTH_EVENTS');
                if (callback) callback({ success: false, error: 'Authentication failed' });
            }
        });
        
        // Room-related events
        setupRoomEvents(socket, io);
        
        // Matchmaking events
        setupMatchmakingEvents(socket, io);
        
        // Game-related events
        setupGameEvents(socket, io);
        
        // Handle disconnection
        socket.on('disconnect', () => {
            const userId = socket.data.userId;
            
            // Handle room-related disconnection if user was in a room
            if (userId) {
                const room = getPlayerRoom(userId);
                if (room) {
                    markPlayerDisconnected(room.id, userId);
                    socket.to(room.id).emit('player:disconnected', { userId });
                }
                
                // Remove from matchmaking if in queue
                removeFromMatchmaking(userId);
            }
            
            // Remove from connected users
            removeConnectedUser(socket.id, userId);
            
            // Update counter and broadcast
            if (onlineUserCount > 0) onlineUserCount--;
            io.emit('userCountUpdate', { count: onlineUserCount });
            
            log(`Socket disconnected: ${socket.id}${userId ? ` (${userId})` : ''}`, 'debug', 'CONNECTIONS');
        });
        
        // Handle ping/heartbeat
        socket.on('ping', (data, callback) => {
            if (callback) callback({ time: Date.now() });
        });
    });
}

/**
 * Set up room-related socket events
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 */
function setupRoomEvents(socket, io) {
    // Check if room exists
    socket.on('checkRoom', (data) => {
        // Implementation handled by client-side
        socket.emit('roomCheckResult', { 
            exists: true, 
            roomId: data.roomId 
        });
    });
    
    // Join room
    socket.on('joinRoom', (data) => {
        // Implementation handled by client-side
        socket.emit('roomJoined', { 
            success: true, 
            roomId: data.roomId 
        });
    });
    
    // Leave room
    socket.on('leaveRoom', () => {
        // Implementation handled by client-side
    });
}

/**
 * Set up matchmaking-related socket events
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 */
function setupMatchmakingEvents(socket, io) {
    // Join matchmaking queue
    socket.on('joinMatchmaking', (data) => {
        const userId = socket.data.userId;
        if (!userId) {
            socket.emit('matchmakingError', { error: 'Not authenticated' });
            return;
        }
        
        const success = addToMatchmaking(userId, data.preferences || {});
        socket.emit('matchmakingStatus', { 
            success, 
            status: 'queued',
            message: 'Added to matchmaking queue' 
        });
    });
    
    // Leave matchmaking queue
    socket.on('leaveMatchmaking', () => {
        const userId = socket.data.userId;
        if (!userId) return;
        
        const success = removeFromMatchmaking(userId);
        socket.emit('matchmakingStatus', { 
            success, 
            status: 'left',
            message: 'Removed from matchmaking queue' 
        });
    });
}

/**
 * Set up game-related socket events
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 */
function setupGameEvents(socket, io) {
    // Handle unit spawning
    socket.on('spawnUnit', (data) => {
        // Implementation handled by client-side
        socket.to(data.roomId).emit('unitSpawned', data);
    });
    
    // Handle rock-paper-scissors game
    socket.on('rpsPlay', (data) => {
        // Implementation handled by client-side
        socket.to(data.roomId).emit('rpsOpponentPlay', { move: data.move });
    });
    
    // Handle game over
    socket.on('gameOver', (data) => {
        // Implementation handled by client-side
        socket.to(data.roomId).emit('gameOver', { winner: data.winner });
    });
}

module.exports = {
    initSocketHandlers
}; 