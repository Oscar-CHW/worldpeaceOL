/**
 * User management module
 * Handles connected users, authentication, and related functionality
 */
const { log } = require('../config/logging');

// User storage
const connectedUsers = new Set(); // Track connected socket IDs
const activeUserSockets = new Map(); // Map user IDs to socket IDs
const userDisconnects = new Map(); // Track user disconnection counts
let onlineUserCount = 0; // Track number of connected users

/**
 * Add a connected user
 * @param {string} socketId - Socket ID of the connected user
 * @param {string|null} userId - User ID if authenticated, null otherwise
 * @returns {boolean} Success status
 */
function addConnectedUser(socketId, userId = null) {
    if (!socketId) return false;
    
    connectedUsers.add(socketId);
    onlineUserCount++;
    
    if (userId) {
        activeUserSockets.set(userId, socketId);
        // Reset disconnect counter on successful connection
        userDisconnects.delete(userId);
    }
    
    log(`User connected: ${socketId}${userId ? ` (userId: ${userId})` : ''}`, 'info', 'CONNECTIONS');
    return true;
}

/**
 * Remove a connected user
 * @param {string} socketId - Socket ID of the connected user
 * @param {string|null} userId - User ID if authenticated, null otherwise
 * @returns {boolean} Success status
 */
function removeConnectedUser(socketId, userId = null) {
    if (!socketId || !connectedUsers.has(socketId)) return false;
    
    connectedUsers.delete(socketId);
    
    if (onlineUserCount > 0) {
        onlineUserCount--;
    }
    
    if (userId) {
        // Only remove from activeUserSockets if this socket is the currently active one
        if (activeUserSockets.get(userId) === socketId) {
            activeUserSockets.delete(userId);
        }
        
        // Track disconnections for this user
        const disconnectCount = (userDisconnects.get(userId) || 0) + 1;
        userDisconnects.set(userId, disconnectCount);
        
        log(`User disconnected: ${socketId} (userId: ${userId}), disconnect count: ${disconnectCount}`, 'info', 'CONNECTIONS');
    } else {
        log(`User disconnected: ${socketId}`, 'info', 'CONNECTIONS');
    }
    
    return true;
}

/**
 * Check if a user is connected
 * @param {string} userId - User ID to check
 * @returns {boolean} Whether the user is connected
 */
function isUserConnected(userId) {
    return activeUserSockets.has(userId);
}

/**
 * Get the socket ID for a user
 * @param {string} userId - User ID to find socket for
 * @returns {string|null} Socket ID if found, null otherwise
 */
function getUserSocketId(userId) {
    return activeUserSockets.get(userId) || null;
}

/**
 * Get the number of online users
 * @returns {number} Number of online users
 */
function getOnlineUserCount() {
    return onlineUserCount;
}

/**
 * Check if a user has disconnected repeatedly
 * @param {string} userId - User ID to check
 * @param {number} threshold - Disconnect count threshold
 * @returns {boolean} Whether the user has excessive disconnects
 */
function hasExcessiveDisconnects(userId, threshold = 3) {
    if (!userId) return false;
    const count = userDisconnects.get(userId) || 0;
    return count >= threshold;
}

/**
 * Reset the disconnect counter for a user
 * @param {string} userId - User ID to reset
 */
function resetDisconnectCounter(userId) {
    if (userId) {
        userDisconnects.delete(userId);
    }
}

module.exports = {
    connectedUsers,
    activeUserSockets,
    userDisconnects,
    addConnectedUser,
    removeConnectedUser,
    isUserConnected,
    getUserSocketId,
    getOnlineUserCount,
    hasExcessiveDisconnects,
    resetDisconnectCounter
}; 