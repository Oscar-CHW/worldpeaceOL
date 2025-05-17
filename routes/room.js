/**
 * Room Routes
 * Handles room creation, joining, and management
 */
const express = require('express');
const { log } = require('../config/logging');
const { createRoom, getRoomById, rooms } = require('../models/rooms');
const { isAuthenticated } = require('./auth');
const prisma = require('../prisma/client');

const router = express.Router();

// Create a new room
router.post('/room', isAuthenticated, async (req, res) => {
    try {
        const { gameMode, isPrivate, roomName } = req.body;
        const userId = req.session.userId;
        
        // Create room
        const room = createRoom({
            creatorId: userId,
            isPrivate: isPrivate || false,
            gameMode: gameMode || 'classic',
            roomName: roomName || ''
        });
        
        // Update user's last room
        await prisma.user.update({
            where: { id: userId },
            data: { lastRoomId: room.id }
        });
        
        log(`Room ${room.id} created by user ${userId}`, 'info', 'ROOM_EVENTS');
        
        res.status(201).json({
            roomId: room.id,
            name: room.name,
            gameMode: room.gameMode
        });
    } catch (error) {
        log(`Error creating room: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not create room' });
    }
});

// Get room details
router.get('/room/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = getRoomById(roomId);
        
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        
        // Filter sensitive information
        const safeRoom = {
            id: room.id,
            name: room.name,
            createdAt: room.createdAt,
            isPrivate: room.isPrivate,
            gameMode: room.gameMode,
            status: room.status,
            playerCount: room.players.length,
            maxPlayers: room.maxPlayers,
            players: room.players.map(p => ({
                id: p.id,
                username: p.username,
                isReady: p.isReady,
                connected: !p.disconnectedAt
            }))
        };
        
        res.json(safeRoom);
    } catch (error) {
        log(`Error fetching room: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not fetch room details' });
    }
});

// List active rooms (with pagination and filtering)
router.get('/rooms', async (req, res) => {
    try {
        const { page = 1, limit = 20, gameMode, status } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = Math.min(parseInt(limit, 10), 50); // Cap at 50
        
        // Convert rooms Map to array and apply filters
        let roomArray = Array.from(rooms.values())
            .filter(room => {
                if (gameMode && room.gameMode !== gameMode) return false;
                if (status && room.status !== status) return false;
                if (room.isPrivate) return false; // Don't list private rooms
                return true;
            });
        
        // Sort by created date (newest first)
        roomArray.sort((a, b) => b.createdAt - a.createdAt);
        
        // Apply pagination
        const startIdx = (pageNum - 1) * limitNum;
        const paginatedRooms = roomArray.slice(startIdx, startIdx + limitNum);
        
        // Format rooms for response
        const formattedRooms = paginatedRooms.map(room => ({
            id: room.id,
            name: room.name,
            gameMode: room.gameMode,
            status: room.status,
            playerCount: room.players.length,
            maxPlayers: room.maxPlayers,
            createdAt: room.createdAt
        }));
        
        res.json({
            rooms: formattedRooms,
            total: roomArray.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(roomArray.length / limitNum)
        });
    } catch (error) {
        log(`Error listing rooms: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not list rooms' });
    }
});

// Check if room exists
router.get('/room/:roomId/exists', async (req, res) => {
    try {
        const { roomId } = req.params;
        const exists = rooms.has(roomId);
        
        res.json({ exists });
    } catch (error) {
        log(`Error checking room existence: ${error.message}`, 'error');
        res.status(500).json({ error: 'Could not check room existence' });
    }
});

module.exports = { router }; 