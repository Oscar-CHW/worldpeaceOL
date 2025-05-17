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
        const userByUsername = await prisma.user.findUnique({
            where: { username }
        });
        
        if (userByUsername) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Only check email uniqueness if email is provided
        if (email) {
            const userByEmail = await prisma.user.findUnique({
                where: { email }
            });
            
            if (userByEmail) {
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
                elo: DEFAULT_RATING
            }
        });
        
        // Set user as logged in
        req.session.userId = user.id;
        
        log(`User registered: ${username} (${user.id})`, 'info', 'AUTH_EVENTS');
        res.status(201).json({
            id: user.id,
            username: user.username,
            email: user.email,
            eloRating: user.elo
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
        const userId = parseInt(req.session.userId, 10);
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                elo: true,
                createdAt: true,
                lastRoom: true,
                role: true
            }
        });
        
        if (!user) {
            req.session.destroy();
            return res.status(404).json({ error: 'User not found' });
        }
        
        // For backward compatibility, remap some fields
        const responseUser = {
            ...user,
            eloRating: user.elo
        };
        
        res.json(responseUser);
    } catch (error) {
        log(`Error getting user info: ${error.message}`, 'error', 'AUTH_EVENTS');
        res.status(500).json({ error: 'Could not get user info' });
    }
});

// Google OAuth login routes
router.get('/google', (req, res) => {
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account' // Force user to select account
    })(req, res);
});

router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/login.html?error=google-auth-failed',
    scope: ['profile', 'email']
}), (req, res) => {
    // Successful authentication
    if (req.user) {
        // Set session userId explicitly
        req.session.userId = req.user.id;
        
        // Save session before redirecting
        req.session.save(err => {
            if (err) {
                log(`Session save error: ${err.message}`, 'error');
                return res.redirect('/login.html?error=session-error');
            }
            log(`User logged in via Google: ${req.user.id}`, 'info', 'AUTH_EVENTS');
            res.redirect('/dashboard.html');
        });
    } else {
        log('Google auth failed - no user object', 'error');
        res.redirect('/login.html?error=google-auth-failed');
    }
});

// Check Google authentication status
router.get('/google/status', isAuthenticated, async (req, res) => {
    try {
        const userId = parseInt(req.session.userId, 10);
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { googleId: true }
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            isAuthenticated: !!user.googleId
        });
    } catch (error) {
        log(`Error checking Google auth status: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not check Google authentication status' });
    }
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

// Unlink Google account
router.post('/google/unlink', isAuthenticated, async (req, res) => {
    try {
        const userId = parseInt(req.session.userId, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { googleId: null }
        });
        
        res.json({ success: true });
    } catch (error) {
        log(`Error unlinking Google account: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not unlink Google account' });
    }
});

module.exports = {
    router,
    isAuthenticated
}; 