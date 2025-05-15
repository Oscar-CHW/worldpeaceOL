import i18n from '../i18n.js';
import { createLanguageSelector } from '../language-selector.js';

// Game state
let gameState = {
    gold: 500,
    units: [],
    isLeftPlayer: false
};

// Unit costs
const UNIT_COSTS = {
    miner: 100,
    soldier: 200
};

// Mineral value
const MINERAL_VALUE = 75;

document.addEventListener('DOMContentLoaded', async function() {
    // Get room ID and username from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');
    const usernameFromUrl = urlParams.get('username');
    
    if (!roomId) {
        window.location.href = '/';
        throw new Error('No room ID provided');
    }

    let currentUser = null;
    
    // Initialize language system
    i18n.init();
    
    // Create language selector
    createLanguageSelector('language-selector');
    
    // Check authentication first
    async function checkAuth() {
        try {
            const response = await fetch('/api/user/me');
            if (response.status === 401) {
                window.location.href = '/login.html';
                return false;
            }
            currentUser = await response.json();
            
            // Update auth links immediately after successful authentication
            const authLinks = document.getElementById('auth-links');
            authLinks.innerHTML = `
                <a href="/dashboard.html" id="welcome-user" data-i18n="user_profile"></a>
                <a href="#" id="logout-link" data-i18n="logout"></a>
            `;
            
            // Update welcome text
            document.getElementById('welcome-user').textContent = `${i18n.translate('welcome')}, ${currentUser.username}`;
            
            // Apply translations to newly created elements
            i18n.applyTranslations();
            
            // Add logout functionality
            document.getElementById('logout-link').addEventListener('click', async (e) => {
                e.preventDefault();
                
                try {
                    await fetch('/api/logout', {
                        method: 'POST'
                    });
                    window.location.href = '/';
                } catch (error) {
                    console.error('Logout failed', error);
                }
            });
            
            return true;
        } catch (error) {
            console.error('Error checking auth status:', error);
            window.location.href = '/login.html';
            return false;
        }
    }
    
    // Check authentication and proceed if authenticated
    if (await checkAuth()) {
        // Initialize Socket.IO
        const socket = io();
        
        // Set room ID display
        document.getElementById('room-id').textContent = roomId;
        
        // Set up copy room link button
        document.getElementById('copy-room-link').addEventListener('click', () => {
            const url = `${window.location.origin}/game-room.html?roomId=${roomId}`;
            navigator.clipboard.writeText(url).then(() => {
                alert(i18n.translate('link_copied'));
            }).catch(err => {
                console.error('Failed to copy link:', err);
            });
        });
        
        // Set up start game button
        document.getElementById('start-game-btn').addEventListener('click', () => {
            socket.emit('startGame');
        });
        
        // Set up leave room button
        document.getElementById('leave-room-btn').addEventListener('click', () => {
            socket.emit('leaveRoom');
            window.location.href = '/';
        });

        // First, check if the room exists
        socket.on('connect', () => {
            // We'll emit a custom event to check if the room exists
            socket.emit('checkRoom', { roomId });
        });
        
        // Handle room check response
        socket.on('roomCheckResult', (data) => {
            if (data.exists) {
                // Room exists, join it
                socket.emit('joinRoom', {
                    roomId,
                    username: currentUser.username
                });
            } else {
                // Room doesn't exist, create it
                socket.emit('createRoom', {
                    roomId,
                    username: currentUser.username
                });
            }
        });
        
        // Handle player list updates
        socket.on('playerList', (data) => {
            console.log('Received player list:', data);
            const playersList = document.getElementById('players');
            const playerCount = document.getElementById('player-count');
            const startButton = document.getElementById('start-game-btn');
            
            // Update player count
            playerCount.textContent = data.players.length;
            
            // Update player list
            playersList.innerHTML = data.players.map(player => 
                `<li>${player.username} ${player.isHost ? `(${i18n.translate('room_owner')})` : ''}</li>`
            ).join('');

            // Find current user in the player list
            const currentPlayer = data.players.find(p => p.username === currentUser.username);
            
            // Show start button only if:
            // 1. Current user is the host
            // 2. There are exactly 2 players
            if (currentPlayer?.isHost && data.players.length === 2) {
                startButton.style.display = 'block';
            } else {
                startButton.style.display = 'none';
            }
        });
        
        // Handle gold updates
        socket.on('goldUpdate', (data) => {
            if (data.playerId === socket.id) {
                gameState.gold = data.gold;
                updateGoldDisplay();
            }
        });
        
        // Handle unit spawned
        socket.on('unitSpawned', (data) => {
            // Add the unit to the game
            spawnUnit(data);
        });
        
        // Handle game start
        socket.on('gameStarted', (initialState) => {
            document.querySelector('.room-info').style.display = 'none';
            document.querySelector('.player-list').style.display = 'none';
            document.querySelector('.room-actions').style.display = 'none';
            document.getElementById('game-container').style.display = 'block';
            
            // Find which player we are (left or right)
            const players = initialState.players;
            gameState.isLeftPlayer = players[0].id === socket.id;
            
            // Initialize game state
            setupGame();
        });
        
        // Handle host change
        socket.on('hostChanged', (data) => {
            if (data.isHost) {
                alert(i18n.translate('you_are_host'));
            }
        });
        
        // Handle player left
        socket.on('playerLeft', (data) => {
            if (data.isHost) {
                alert(i18n.translate('host_left'));
                // Redirect to homepage when host leaves
                window.location.href = '/';
            } else {
                alert(i18n.translate('player_left'));
            }
        });
        
        // Handle errors
        socket.on('error', (data) => {
            console.error('Socket error:', data.message);
            alert(i18n.translate(data.message) || data.message);
        });
        
        // Functions for game setup and display
        function setupGame() {
            // Set player names
            const playerInfoElements = document.querySelectorAll('.player-info');
            playerInfoElements[gameState.isLeftPlayer ? 0 : 1].querySelector('.player-name').textContent = currentUser.username;
            playerInfoElements[gameState.isLeftPlayer ? 1 : 0].querySelector('.player-name').textContent = "Opponent";
            
            // Initialize gold display
            updateGoldDisplay();
            
            // Setup unit selection
            setupUnitSelection();
        }
        
        function updateGoldDisplay() {
            const goldElement = document.querySelector(`.player-info.${gameState.isLeftPlayer ? 'left' : 'right'} .gold-amount`);
            if (goldElement) {
                goldElement.textContent = gameState.gold;
            }
        }
        
        function setupUnitSelection() {
            const unitOptions = document.querySelectorAll('.unit-option');
            unitOptions.forEach(option => {
                option.addEventListener('click', () => {
                    const unitType = option.getAttribute('data-unit');
                    const cost = UNIT_COSTS[unitType];
                    
                    if (gameState.gold >= cost) {
                        spawnNewUnit(unitType);
                    } else {
                        alert(i18n.translate('not_enough_gold'));
                    }
                });
            });
        }
        
        function spawnNewUnit(unitType) {
            // Determine spawn position
            const x = gameState.isLeftPlayer ? 100 : 700;
            const y = 300;
            
            // Generate unique ID
            const unitId = Date.now() + Math.random().toString(16).slice(2);
            
            // Emit spawn unit event
            socket.emit('spawnUnit', {
                unitId,
                unitType,
                x,
                y,
                isLeftPlayer: gameState.isLeftPlayer
            });
        }
        
        function spawnUnit(unitData) {
            // Add unit to game state
            gameState.units.push(unitData);
            
            // Create unit element
            const unitElement = document.createElement('div');
            unitElement.className = `unit ${unitData.type} ${unitData.isLeftPlayer ? 'left' : 'right'}`;
            unitElement.id = `unit-${unitData.id}`;
            unitElement.style.left = `${unitData.x}px`;
            unitElement.style.top = `${unitData.y}px`;
            
            // Add unit image
            const unitImage = document.createElement('img');
            unitImage.src = `images/${unitData.type}.png`;
            unitImage.alt = unitData.type;
            unitElement.appendChild(unitImage);
            
            // Add to game field
            document.querySelector('.game-field').appendChild(unitElement);
            
            // If it's a miner, add mineral collection behavior
            if (unitData.type === 'miner') {
                setupMiner(unitData, unitElement);
            } else if (unitData.type === 'soldier') {
                setupSoldier(unitData, unitElement);
            }
        }
        
        // Placeholder functions for unit behaviors
        function setupMiner(unitData, unitElement) {
            // Miner behavior would go here
            console.log(`Miner ${unitData.id} is ready to mine!`);
        }
        
        function setupSoldier(unitData, unitElement) {
            // Soldier behavior would go here
            console.log(`Soldier ${unitData.id} is ready to fight!`);
        }
    }
}); 