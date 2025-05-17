/**
 * Room management module
 * Handles room creation, management, and game state
 */
const { v4: uuidv4 } = require('uuid');
const { log } = require('../config/logging');
const { gameModes, getGameMode } = require('./game-modes');
const config = require('../config/config');

// Room storage
const rooms = new Map(); // Store game rooms
const userRooms = new Map(); // Map user IDs to room IDs
const abandonTimers = new Map(); // Map room+player to abandon timers

/**
 * Create a new game room
 * @param {Object} options - Room creation options
 * @returns {Object} The created room object
 */
function createRoom(options = {}) {
    const {
        creatorId,
        isPrivate = false,
        gameMode = 'classic',
        maxPlayers = config.game.maxPlayers,
        roomName = ''
    } = options;

    const roomId = uuidv4().substring(0, 8);
    const mode = getGameMode(gameMode);
    
    const room = {
        id: roomId,
        name: roomName || `Game ${roomId}`,
        createdAt: new Date(),
        creatorId,
        isPrivate,
        gameMode,
        maxPlayers,
        players: [],
        status: 'waiting', // waiting, playing, ended
        gameState: {
            turn: 0,
            currentPlayer: 0,
            gold: [],
            units: [],
            map: null,
            lastAction: null,
            startedAt: null,
            endedAt: null,
            winner: null
        },
        chatHistory: [],
        spectators: []
    };

    rooms.set(roomId, room);
    log(`Room ${roomId} created by user ${creatorId}`, 'info', 'ROOM_EVENTS');
    return room;
}

/**
 * Get a room by its ID
 * @param {string} roomId - The room ID to retrieve
 * @returns {Object|null} The room object or null if not found
 */
function getRoomById(roomId) {
    return rooms.get(roomId) || null;
}

/**
 * Add a player to a room
 * @param {string} roomId - The room ID
 * @param {Object} player - The player to add
 * @returns {boolean} Success status
 */
function addPlayerToRoom(roomId, player) {
    const room = rooms.get(roomId);
    if (!room) {
        log(`Failed to add player to room ${roomId}: Room not found`, 'error', 'ROOM_EVENTS');
        return false;
    }

    if (room.players.length >= room.maxPlayers) {
        log(`Failed to add player to room ${roomId}: Room is full`, 'warn', 'ROOM_EVENTS');
        return false;
    }

    if (room.players.some(p => p.id === player.id)) {
        log(`Player ${player.id} is already in room ${roomId}`, 'warn', 'ROOM_EVENTS');
        return true;
    }

    room.players.push({
        ...player,
        isReady: false,
        joinedAt: new Date(),
        disconnectedAt: null
    });
    
    userRooms.set(player.id, roomId);
    log(`Player ${player.id} joined room ${roomId}`, 'info', 'ROOM_EVENTS');
    return true;
}

/**
 * Remove a player from a room
 * @param {string} roomId - The room ID
 * @param {string} playerId - The player ID to remove
 * @returns {boolean} Success status
 */
function removePlayerFromRoom(roomId, playerId) {
    const room = rooms.get(roomId);
    if (!room) {
        log(`Failed to remove player from room ${roomId}: Room not found`, 'error', 'ROOM_EVENTS');
        return false;
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
        log(`Failed to remove player from room ${roomId}: Player not found`, 'warn', 'ROOM_EVENTS');
        return false;
    }

    room.players.splice(playerIndex, 1);
    userRooms.delete(playerId);
    
    // Clean up abandon timer if it exists
    const timerKey = `${roomId}:${playerId}`;
    if (abandonTimers.has(timerKey)) {
        clearTimeout(abandonTimers.get(timerKey));
        abandonTimers.delete(timerKey);
    }
    
    log(`Player ${playerId} removed from room ${roomId}`, 'info', 'ROOM_EVENTS');
    
    // If room is empty, remove it
    if (room.players.length === 0 && room.spectators.length === 0) {
        deleteRoom(roomId);
    }
    
    return true;
}

/**
 * Delete a room
 * @param {string} roomId - The room ID to delete
 * @returns {boolean} Success status
 */
function deleteRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room) {
        return false;
    }
    
    // Clean up all associated user mappings
    room.players.forEach(player => {
        userRooms.delete(player.id);
    });
    
    // Clean up any abandon timers
    for (const [key, timer] of abandonTimers.entries()) {
        if (key.startsWith(`${roomId}:`)) {
            clearTimeout(timer);
            abandonTimers.delete(key);
        }
    }
    
    rooms.delete(roomId);
    log(`Room ${roomId} deleted`, 'info', 'ROOM_EVENTS');
    return true;
}

/**
 * Get the room a player is in
 * @param {string} playerId - The player ID
 * @returns {Object|null} The room object or null
 */
function getPlayerRoom(playerId) {
    const roomId = userRooms.get(playerId);
    if (!roomId) {
        return null;
    }
    return getRoomById(roomId);
}

/**
 * Mark a player as disconnected
 * @param {string} roomId - The room ID
 * @param {string} playerId - The player ID
 * @returns {boolean} Success status
 */
function markPlayerDisconnected(roomId, playerId) {
    const room = getRoomById(roomId);
    if (!room) return false;
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) return false;
    
    player.disconnectedAt = new Date();
    
    // Start abandon timer if game is in progress
    if (room.status === 'playing') {
        startAbandonTimer(roomId, playerId, config.game.abandonTimeout);
    }
    
    log(`Player ${playerId} disconnected from room ${roomId}`, 'info', 'CONNECTIONS');
    return true;
}

/**
 * Start the abandon timer for a player
 * @param {string} roomId - The room ID
 * @param {string} playerId - The player ID
 * @param {number} delay - Timer delay in ms
 */
function startAbandonTimer(roomId, playerId, delay = 60000) {
    const timerKey = `${roomId}:${playerId}`;
    
    // Clear existing timer if any
    if (abandonTimers.has(timerKey)) {
        clearTimeout(abandonTimers.get(timerKey));
    }
    
    const timer = setTimeout(async () => {
        log(`Player ${playerId} abandon timer expired in room ${roomId}`, 'info', 'ROOM_EVENTS');
        await abandonGame(roomId, playerId);
        abandonTimers.delete(timerKey);
    }, delay);
    
    abandonTimers.set(timerKey, timer);
    log(`Started abandon timer for player ${playerId} in room ${roomId}`, 'debug', 'ROOM_EVENTS');
}

/**
 * Handle player abandoning a game
 * @param {string} roomId - The room ID
 * @param {string} abandoningPlayerId - The player ID abandoning
 */
async function abandonGame(roomId, abandoningPlayerId) {
    const room = getRoomById(roomId);
    if (!room) return;
    
    if (room.status !== 'playing') return;
    
    // Find the other player who wins by default
    const winner = room.players.find(p => p.id !== abandoningPlayerId);
    if (!winner) return;
    
    room.status = 'ended';
    room.gameState.winner = winner.id;
    room.gameState.endedAt = new Date();
    room.gameState.endReason = 'abandoned';
    
    log(`Game in room ${roomId} ended due to player ${abandoningPlayerId} abandoning`, 'info', 'ROOM_EVENTS');
    
    // We'll trigger the game end event in the socket handler
}

module.exports = {
    rooms,
    userRooms,
    createRoom,
    getRoomById,
    addPlayerToRoom,
    removePlayerFromRoom,
    deleteRoom,
    getPlayerRoom,
    markPlayerDisconnected,
    startAbandonTimer,
    abandonGame
}; 