/**
 * Application Configuration
 * Central configuration settings loaded from environment variables
 */
require('dotenv').config();

/**
 * Application configuration object
 */
const config = {
    // Server settings
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        environment: process.env.NODE_ENV || 'development',
        host: process.env.HOST || 'localhost'
    },
    
    // Session configuration
    session: {
        secret: process.env.SESSION_SECRET || 'tianxia-taiping-secret-key',
        cookie: { 
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    },
    
    // Auth settings 
    auth: {
        google: {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
        },
        bcrypt: {
            saltRounds: 10
        }
    },
    
    // Game settings
    game: {
        abandonTimeout: parseInt(process.env.ABANDON_TIMEOUT || '60000', 10), // 60 seconds before considering player abandoned
        matchmakingInterval: parseInt(process.env.MATCHMAKING_INTERVAL || '5000', 10), // Check for matches every 5 seconds
        reconnectWindow: parseInt(process.env.RECONNECT_WINDOW || '120000', 10), // 2 minutes to reconnect to game
        maxPlayers: parseInt(process.env.MAX_PLAYERS || '2', 10) // Maximum players per room
    },
    
    // Paths
    paths: {
        dbDir: process.env.DB_DIR || './db',
        staticDir: process.env.STATIC_DIR || './',
        imagesDir: process.env.IMAGES_DIR || './images'
    }
};

module.exports = config; 