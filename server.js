/**
 * World Peace Online - Main Server
 * Modular implementation of the game server
 */
const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const SQLiteStore = require('connect-sqlite3')(session);

// Load environment variables
require('dotenv').config();

// Import modules
const config = require('./config/config');
const { log, serverStats } = require('./config/logging');
const { rooms, userRooms } = require('./models/rooms');
const { connectedUsers, addConnectedUser, removeConnectedUser } = require('./models/users');
const { matchmakingQueue, setupMatchmakingInterval } = require('./socket/matchmaking');
const { DEFAULT_RATING } = require('./utils/elo');
const { router: authRouter, isAuthenticated } = require('./routes/auth');
const { router: userRouter } = require('./routes/user');
const { router: roomRouter } = require('./routes/room');
const { initSocketHandlers } = require('./socket/connection');
const prisma = require('./prisma/client');

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Ensure db directory exists
const dbDir = path.join(__dirname, config.paths.dbDir);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log('Created db directory for sessions', 'info');
}

// Session configuration
app.use(session({
    store: new SQLiteStore({ 
        db: path.join(config.paths.dbDir, 'sessions.sqlite')
    }),
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: config.session.cookie
}));

// Configure Passport
app.use(passport.initialize());
app.use(passport.session());

// Serialize and deserialize user for session storage
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth strategy
passport.use(new GoogleStrategy({
    clientID: config.auth.google.clientID,
    clientSecret: config.auth.google.clientSecret,
    callbackURL: config.auth.google.callbackURL,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        // Try to find a user with this Google ID
        let user = await prisma.user.findUnique({
            where: { googleId: profile.id }
        });
        
        // Handle linking to existing account
        if (req.session.linkGoogleToUserId) {
            if (user) {
                return done(null, false, { message: 'This Google account is already linked to another user' });
            }
            
            const existingUser = await prisma.user.findUnique({
                where: { id: req.session.linkGoogleToUserId }
            });
            
            if (!existingUser) {
                return done(null, false, { message: 'User not found' });
            }
            
            user = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    googleId: profile.id,
                    email: profile.emails[0].value
                }
            });
            
            delete req.session.linkGoogleToUserId;
            return done(null, user);
        }
        
        // Handle normal login/registration
        if (user) {
            // User found, log them in
            return done(null, user);
        } else {
            // Check if a user with this email already exists
            let existingUserByEmail = null;
            if (profile.emails && profile.emails.length > 0) {
                existingUserByEmail = await prisma.user.findUnique({
                    where: { email: profile.emails[0].value }
                });
            }
            
            if (existingUserByEmail) {
                // Update the existing user with Google ID
                user = await prisma.user.update({
                    where: { id: existingUserByEmail.id },
                    data: { googleId: profile.id }
                });
            } else {
                // Create new user
                const username = profile.displayName.toLowerCase().replace(/\s+/g, '') + 
                    Math.floor(Math.random() * 1000);
                
                user = await prisma.user.create({
                    data: {
                        googleId: profile.id,
                        username,
                        email: profile.emails ? profile.emails[0].value : null,
                        displayName: profile.displayName,
                        eloRating: DEFAULT_RATING,
                        wins: 0,
                        losses: 0
                    }
                });
                
                log(`New user created via Google: ${username}`, 'info', 'AUTH_EVENTS');
            }
            
            return done(null, user);
        }
    } catch (error) {
        log(`Google auth error: ${error.message}`, 'error', 'AUTH_EVENTS');
        return done(error, null);
    }
}));

// Mount API routes
// Auth routes
app.use('/api', authRouter); // Keep for backward compatibility
app.use('/api/auth', authRouter);

// User routes
app.use('/api/user', userRouter);
app.use('/api', userRouter); // For /api/users/count 

// Room routes
app.use('/api/room', roomRouter);

// Additional endpoints for backward compatibility
app.post('/api/user/clear-last-room', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        await prisma.user.update({
            where: { id: userId },
            data: { lastRoomId: null }
        });
        res.json({ success: true });
    } catch (error) {
        log(`Error clearing last room: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not clear last room' });
    }
});

// Admin check middleware
const isAdmin = async (req, res, next) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const user = await prisma.user.findUnique({
            where: { id: req.session.userId },
            select: { role: true }
        });
        
        if (!user || user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        next();
    } catch (error) {
        log(`Admin check error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin routes
app.get('/api/admin/stats', isAdmin, (req, res) => {
    res.json({
        serverStats,
        rooms: rooms.size,
        users: connectedUsers.size,
        matchmakingQueue: matchmakingQueue.size
    });
});

// Initialize socket handlers
initSocketHandlers(io);

// Start matchmaking system
setupMatchmakingInterval();

// Start server
const PORT = config.server.port;
httpServer.listen(PORT, () => {
    log(`Server listening on port ${PORT}`, 'success');
    log(`Environment: ${config.server.environment}`, 'info');
    
    // Log non-production warning
    if (config.server.environment !== 'production') {
        log('Running in development mode - not suitable for production', 'warn');
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    log(`Uncaught Exception: ${error.message}`, 'error');
    log(error.stack, 'error');
    // In production, we might want to gracefully restart the server
    if (config.server.environment === 'production') {
        log('Critical error, shutting down', 'error');
        process.exit(1);
    }
}); 