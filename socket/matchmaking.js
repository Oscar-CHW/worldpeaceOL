/**
 * Matchmaking module
 * Handles player matchmaking queues and pairing
 */
const { log } = require('../config/logging');
const { rooms, createRoom, addPlayerToRoom } = require('../models/rooms');
const { activeUserSockets } = require('../models/users');
const prisma = require('../prisma/client');
const config = require('../config/config');

// Matchmaking data structures
const matchmakingQueue = new Map(); // Map user IDs to matchmaking data
let matchmakingInterval = null;

/**
 * Add a user to the matchmaking queue
 * @param {string} userId - User ID to add
 * @param {Object} preferences - Matchmaking preferences (gameMode, etc)
 * @returns {boolean} Success status
 */
function addToMatchmaking(userId, preferences = {}) {
    if (!userId) return false;
    
    const { gameMode = 'classic', skill = 'any' } = preferences;
    
    // Add to queue with timestamp
    matchmakingQueue.set(userId, {
        userId,
        preferences: { gameMode, skill },
        joinedAt: new Date(),
        status: 'waiting'
    });
    
    log(`User ${userId} joined matchmaking queue with preferences: ${JSON.stringify(preferences)}`, 'info', 'MATCHMAKING');
    
    // Ensure matchmaking interval is running
    if (!matchmakingInterval) {
        setupMatchmakingInterval();
    }
    
    return true;
}

/**
 * Remove a user from the matchmaking queue
 * @param {string} userId - User ID to remove
 * @returns {boolean} Success status
 */
function removeFromMatchmaking(userId) {
    if (!userId || !matchmakingQueue.has(userId)) return false;
    
    matchmakingQueue.delete(userId);
    log(`User ${userId} left matchmaking queue`, 'info', 'MATCHMAKING');
    
    // Stop interval if queue is empty
    if (matchmakingQueue.size === 0 && matchmakingInterval) {
        clearInterval(matchmakingInterval);
        matchmakingInterval = null;
    }
    
    return true;
}

/**
 * Set up matchmaking interval to periodically check for matches
 */
function setupMatchmakingInterval() {
    if (matchmakingInterval) {
        clearInterval(matchmakingInterval);
    }
    
    matchmakingInterval = setInterval(() => {
        if (matchmakingQueue.size >= 2) {
            log(`Checking matchmaking queue: ${matchmakingQueue.size} players waiting`, 'debug', 'MATCHMAKING');
            processMatchmakingQueue();
        }
    }, config.game.matchmakingInterval);
    
    log('Matchmaking system started', 'info', 'MATCHMAKING');
}

/**
 * Process the matchmaking queue to create matches
 */
async function processMatchmakingQueue() {
    const players = [...matchmakingQueue.values()].filter(p => p.status === 'waiting');
    
    // Sort by waiting time (oldest first)
    players.sort((a, b) => a.joinedAt - b.joinedAt);
    
    // Process players
    for (let i = 0; i < players.length - 1; i++) {
        const player1 = players[i];
        if (player1.status !== 'waiting') continue;
        
        // Find compatible player
        for (let j = i + 1; j < players.length; j++) {
            const player2 = players[j];
            if (player2.status !== 'waiting') continue;
            
            // Check compatibility (game mode)
            if (player1.preferences.gameMode !== player2.preferences.gameMode) continue;
            
            // Attempt to pair these players
            const success = await tryMatchmaking(player1.userId, player2.userId, player1.preferences.gameMode);
            if (success) {
                // Mark both players as matched
                player1.status = 'matched';
                player2.status = 'matched';
                break;
            }
        }
    }
    
    // Clean up matched players from queue
    for (const [userId, data] of matchmakingQueue.entries()) {
        if (data.status === 'matched') {
            matchmakingQueue.delete(userId);
        }
    }
}

/**
 * Try to match two players together
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @param {string} gameMode - The game mode to use
 * @returns {Promise<boolean>} Success status
 */
async function tryMatchmaking(userId1, userId2, gameMode = 'classic') {
    try {
        log(`Attempting to match users ${userId1} and ${userId2} in ${gameMode} mode`, 'info', 'MATCHMAKING');
        
        // Create match in database
        const match = await prisma.match.create({
            data: {
                gameMode,
                playerIds: [userId1, userId2],
                status: 'pending'
            }
        });
        
        // Get the players' data
        const [player1, player2] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId1 } }),
            prisma.user.findUnique({ where: { id: userId2 } })
        ]);
        
        if (!player1 || !player2) {
            log(`Failed to match: unable to find player data`, 'error', 'MATCHMAKING');
            return false;
        }
        
        // Verify both players are still connected
        if (!activeUserSockets.has(userId1) || !activeUserSockets.has(userId2)) {
            log(`Failed to match: one or both players disconnected`, 'warn', 'MATCHMAKING');
            return false;
        }
        
        // Create a room
        const room = createRoom({
            creatorId: 'system', 
            isPrivate: false, 
            gameMode,
            maxPlayers: 2,
            roomName: `Match #${match.id}`
        });
        
        // Add players to room
        const playerData1 = {
            id: player1.id,
            username: player1.username,
            elo: player1.eloRating
        };
        
        const playerData2 = {
            id: player2.id,
            username: player2.username,
            elo: player2.eloRating
        };
        
        addPlayerToRoom(room.id, playerData1);
        addPlayerToRoom(room.id, playerData2);
        
        // Update match record
        await prisma.match.update({
            where: { id: match.id },
            data: {
                roomId: room.id,
                status: 'created'
            }
        });
        
        // Update players' last room info
        await Promise.all([
            prisma.user.update({
                where: { id: userId1 },
                data: { lastRoomId: room.id }
            }),
            prisma.user.update({
                where: { id: userId2 },
                data: { lastRoomId: room.id }
            })
        ]);
        
        log(`Successfully matched users ${userId1} and ${userId2} in room ${room.id}`, 'success', 'MATCHMAKING');
        return true;
    } catch (error) {
        log(`Error in tryMatchmaking: ${error.message}`, 'error', 'MATCHMAKING');
        return false;
    }
}

/**
 * Get the current matchmaking queue status
 * @returns {Array} Array of players in queue with basic info
 */
function getMatchmakingStatus() {
    return [...matchmakingQueue.values()].map(p => ({
        userId: p.userId,
        gameMode: p.preferences.gameMode,
        waitTime: Math.floor((Date.now() - p.joinedAt) / 1000) // Wait time in seconds
    }));
}

module.exports = {
    matchmakingQueue,
    addToMatchmaking,
    removeFromMatchmaking,
    setupMatchmakingInterval,
    processMatchmakingQueue,
    tryMatchmaking,
    getMatchmakingStatus
}; 