/**
 * Authentication Routes
 * Handles user authentication, registration, and sessions
 */
const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const { log } = require('../config/logging');
const config = require('../config/config');
const prisma = require('../prisma/client');
const { DEFAULT_RATING } = require('../utils/elo');

const router = express.Router();

// Middleware to check if a user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

// User registration endpoint
router.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // Check if username already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: username },
                    { email: email || null }
                ]
            }
        });
        
        if (existingUser) {
            if (existingUser.username === username) {
                return res.status(400).json({ error: 'Username already exists' });
            } else {
                return res.status(400).json({ error: 'Email already exists' });
            }
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, config.auth.bcrypt.saltRounds);
        
        // Create user
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                email,
                eloRating: DEFAULT_RATING,
                wins: 0,
                losses: 0
            }
        });
        
        // Set user as logged in
        req.session.userId = user.id;
        
        log(`User registered: ${username} (${user.id})`, 'info', 'AUTH_EVENTS');
        res.status(201).json({
            id: user.id,
            username: user.username,
            email: user.email,
            eloRating: user.eloRating
        });
    } catch (error) {
        log(`Registration error: ${error.message}`, 'error', 'AUTH_EVENTS');
        res.status(500).json({ error: 'Could not register user' });
    }
});

// User login endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // Find user
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: username },
                    { email: username }
                ]
            }
        });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Set user as logged in
        req.session.userId = user.id;
        
        log(`User logged in: ${username} (${user.id})`, 'info', 'AUTH_EVENTS');
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            eloRating: user.eloRating
        });
    } catch (error) {
        log(`Login error: ${error.message}`, 'error', 'AUTH_EVENTS');
        res.status(500).json({ error: 'Could not log in' });
    }
});

// User logout endpoint
router.post('/logout', (req, res) => {
    const userId = req.session.userId;
    
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                log(`Logout error: ${err.message}`, 'error', 'AUTH_EVENTS');
                return res.status(500).json({ error: 'Could not log out' });
            }
            res.clearCookie('connect.sid');
            if (userId) {
                log(`User logged out: ${userId}`, 'info', 'AUTH_EVENTS');
            }
            res.json({ message: 'Logged out successfully' });
        });
    } else {
        res.json({ message: 'Not logged in' });
    }
});

// Get current user info
router.get('/me', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                eloRating: true,
                wins: true,
                losses: true,
                createdAt: true,
                lastRoomId: true,
                role: true
            }
        });
        
        if (!user) {
            req.session.destroy();
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        log(`Error getting user info: ${error.message}`, 'error', 'AUTH_EVENTS');
        res.status(500).json({ error: 'Could not get user info' });
    }
});

// Google OAuth login routes
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account' // Force user to select account
}));

router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/login.html?error=google-auth-failed'
}), (req, res) => {
    // Successful authentication
    log(`User logged in via Google: ${req.user.id}`, 'info', 'AUTH_EVENTS');
    res.redirect('/dashboard.html');
});

// Link Google account to existing account
router.get('/google/link', isAuthenticated, (req, res) => {
    // Store user ID in session for linking after Google auth
    req.session.linkGoogleToUserId = req.session.userId;
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })(req, res);
});

module.exports = {
    router,
    isAuthenticated
}; 