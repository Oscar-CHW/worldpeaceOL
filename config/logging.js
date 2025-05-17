/**
 * Logging Configuration
 * Centralized logging system with categories and verbosity levels
 */

// Environment configuration for logging
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
let VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';

// Enable verbose logging for development automatically
if (process.env.NODE_ENV === 'development') {
    VERBOSE_LOGGING = true;
    console.log('Enabling verbose logging for development');
}

// Server statistics for tracking application state
const serverStats = {
    startTime: new Date(),
    totalConnections: 0,
    matchesMade: 0,
    commandsExecuted: 0,
    errors: 0
};

/**
 * Logging category toggles
 * Controls which categories of logs are displayed
 */
const logCategories = {
    CONNECTIONS: true,      // User connections and disconnections
    ROOM_EVENTS: true,      // Room creation, deletion, joining, leaving
    MATCHMAKING: true,      // Matchmaking attempts and results
    GAME_EVENTS: false,     // In-game actions (unit spawning, attacks, etc.)
    PLAYER_READY: false,    // Player ready status changes
    AUTH_EVENTS: false,     // Login, signup, auth events
    TESTING: false,         // System test and debug functions
    ERRORS: true            // Always log errors (can't be disabled)
};

/**
 * Consistent logging function across the application
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, debug, warn, error, success)
 * @param {string} category - Log category for filtering
 */
function log(message, level = 'info', category = null) {
    // Always log errors regardless of settings
    if (level === 'error') {
        serverStats.errors++;
        const stack = new Error().stack.split('\n').slice(2).join('\n');
        console.error(`[ERROR] ${message}`);
        if (VERBOSE_LOGGING) {
            console.error(`Stack trace:\n${stack}`);
        }
        return;
    }
    
    // Skip logging if verbose mode disabled and level is debug
    if (level === 'debug' && !VERBOSE_LOGGING) {
        return;
    }
    
    // Skip logging if category is disabled
    if (category && logCategories[category] === false) {
        return;
    }
    
    // Format and output the log
    const timestamp = new Date().toISOString();
    let logPrefix = `[${timestamp}]`;
    
    // Add level to prefix
    switch(level) {
        case 'info': logPrefix += ' [INFO]'; break;
        case 'warn': logPrefix += ' [WARN]'; break;
        case 'debug': logPrefix += ' [DEBUG]'; break;
        case 'success': logPrefix += ' [SUCCESS]'; break;
    }
    
    // Add category if provided
    if (category) {
        logPrefix += ` [${category}]`;
    }
    
    // Get the caller function name for debug logs
    if (VERBOSE_LOGGING && level === 'debug') {
        try {
            const caller = new Error().stack.split('\n')[2].trim();
            const functionName = caller.match(/at (\w+)/);
            if (functionName && functionName[1]) {
                logPrefix += ` [${functionName[1]}]`;
            }
        } catch (e) {
            // Ignore errors getting caller info
        }
    }
    
    console.log(`${logPrefix} ${message}`);
}

module.exports = {
    log,
    logCategories,
    serverStats,
    DEBUG_MODE,
    VERBOSE_LOGGING
}; 