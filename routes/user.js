/**
 * User Routes
 * Handles user profiles, statistics, and management
 */
const express = require('express');
const { log } = require('../config/logging');
const { isAuthenticated } = require('./auth');
const { rooms } = require('../models/rooms');
const { getPlayerRankings } = require('../utils/elo');
const prisma = require('../prisma/client');

const router = express.Router();

// Get user profile
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                displayName: true,
                eloRating: true,
                wins: true,
                losses: true,
                createdAt: true
            }
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Calculate additional stats
        const totalGames = user.wins + user.losses;
        const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0;
        
        res.json({
            ...user,
            totalGames,
            winRate
        });
    } catch (error) {
        log(`Error fetching user profile: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not fetch user profile' });
    }
});

// Get current user's last room
router.get('/user/last-room', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { lastRoomId: true }
        });
        
        if (!user || !user.lastRoomId) {
            return res.json({ hasLastRoom: false });
        }
        
        // Check if room still exists
        const roomExists = rooms.has(user.lastRoomId);
        
        res.json({
            hasLastRoom: roomExists,
            roomId: roomExists ? user.lastRoomId : null
        });
    } catch (error) {
        log(`Error getting last room: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not get last room info' });
    }
});

// Get user match history
router.get('/user/:userId/matches', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = Math.min(parseInt(limit, 10), 50); // Cap at 50
        
        // Get total count
        const totalMatches = await prisma.match.count({
            where: {
                playerIds: {
                    has: userId
                },
                status: 'completed'
            }
        });
        
        // Get paginated matches
        const matches = await prisma.match.findMany({
            where: {
                playerIds: {
                    has: userId
                },
                status: 'completed'
            },
            orderBy: {
                endedAt: 'desc'
            },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            include: {
                winner: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });
        
        // Format matches for response
        const formattedMatches = await Promise.all(matches.map(async match => {
            // Get opponent info
            const opponentId = match.playerIds.find(id => id !== userId);
            const opponent = await prisma.user.findUnique({
                where: { id: opponentId },
                select: { id: true, username: true, eloRating: true }
            });
            
            return {
                id: match.id,
                gameMode: match.gameMode,
                createdAt: match.createdAt,
                endedAt: match.endedAt,
                won: match.winnerId === userId,
                opponent: opponent || { id: 'unknown', username: 'Unknown Player' },
                eloChange: match.eloChanges?.[userId] || 0
            };
        }));
        
        res.json({
            matches: formattedMatches,
            total: totalMatches,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalMatches / limitNum)
        });
    } catch (error) {
        log(`Error fetching match history: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not fetch match history' });
    }
});

// Get user leaderboard
router.get('/users/leaderboard', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const limitNum = Math.min(parseInt(limit, 10), 100); // Cap at 100
        
        const rankings = await getPlayerRankings(limitNum);
        
        res.json({
            rankings,
            limit: limitNum
        });
    } catch (error) {
        log(`Error fetching leaderboard: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not fetch leaderboard' });
    }
});

// Get user count
router.get('/users/count', async (req, res) => {
    try {
        const count = await prisma.user.count();
        res.json({ count });
    } catch (error) {
        log(`Error fetching user count: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not fetch user count' });
    }
});

module.exports = { router }; 