import i18n from '../i18n.js';
import { createLanguageSelector } from '../language-selector.js';

// Game state
let gameState = {
    gold: 0,
    units: [],
    isLeftPlayer: false,
    rps: {
        playerChoice: null,
        opponentChoice: null,
        roundActive: false,
        roundTimer: null,
        countdownTimer: null
    }
};

// Unit costs
const UNIT_COSTS = {
    miner: 100,
    soldier: 200
};

// Mineral value
const MINERAL_VALUE = 75;

// RPS reward
const RPS_REWARD = 100;

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
        
        // Handle synchronized gold updates
        socket.on('goldSyncUpdate', (data) => {
            // Update both players' gold displays
            data.players.forEach(playerData => {
                if (playerData.playerId === socket.id) {
                    // This is our gold
                    gameState.gold = playerData.gold;
                }
                
                // Update the display for this player
                const isCurrentPlayer = playerData.playerId === socket.id;
                const playerSide = (isCurrentPlayer === gameState.isLeftPlayer) ? 'left' : 'right';
                
                const goldElement = document.querySelector(`.player-info.${playerSide} .gold-amount`);
                if (goldElement) {
                    goldElement.textContent = playerData.gold;
                }
            });
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
            gameState.isLeftPlayer = players[0].id === socket.id || players[0].socketId === socket.id;
            
            // Find our player object and get initial gold
            const ourPlayer = players.find(p => p.id === socket.id || p.socketId === socket.id);
            if (ourPlayer) {
                gameState.gold = ourPlayer.gold;
            }
            
            // Initialize game state
            setupGame();
            
            // Update both players' gold displays
            const leftPlayer = gameState.isLeftPlayer ? ourPlayer : players.find(p => p.id !== socket.id && p.socketId !== socket.id);
            const rightPlayer = gameState.isLeftPlayer ? players.find(p => p.id !== socket.id && p.socketId !== socket.id) : ourPlayer;
            
            // Set gold displays
            const leftGoldElement = document.querySelector('.player-info.left .gold-amount');
            const rightGoldElement = document.querySelector('.player-info.right .gold-amount');
            
            if (leftGoldElement && leftPlayer) {
                leftGoldElement.textContent = leftPlayer.gold;
            }
            
            if (rightGoldElement && rightPlayer) {
                rightGoldElement.textContent = rightPlayer.gold;
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
            const leftInfoElement = playerInfoElements[0];
            const rightInfoElement = playerInfoElements[1];
            
            if (gameState.isLeftPlayer) {
                leftInfoElement.querySelector('.player-name').textContent = currentUser.username;
                rightInfoElement.querySelector('.player-name').textContent = "Opponent";
                
                // Show controls on left side (player's side)
                leftInfoElement.classList.add('player-side');
                rightInfoElement.classList.add('opponent-side');
            } else {
                rightInfoElement.querySelector('.player-name').textContent = currentUser.username;
                leftInfoElement.querySelector('.player-name').textContent = "Opponent";
                
                // Show controls on right side (player's side)
                rightInfoElement.classList.add('player-side');
                leftInfoElement.classList.add('opponent-side');
                
                // Move player controls to the right side
                const playerControls = document.getElementById('player-controls');
                if (playerControls) {
                    const rightPlayerInfo = document.querySelector('.player-info.right');
                    if (rightPlayerInfo) {
                        const rightControls = rightPlayerInfo.querySelector('.opponent-controls');
                        if (rightControls) {
                            rightControls.appendChild(playerControls);
                        }
                    }
                }
            }
            
            // Initialize gold display
            updateGoldDisplay();
            
            // Setup unit selection
            setupUnitSelection();
            
            // Emit event to start first RPS round
            socket.emit('rpsRoundStart');
        }
        
        function updateGoldDisplay() {
            // This function is now only used for initial display setup
            // Real-time updates come through goldSyncUpdate event
            const leftGoldElement = document.querySelector('.player-info.left .gold-amount');
            const rightGoldElement = document.querySelector('.player-info.right .gold-amount');
            
            if (gameState.isLeftPlayer) {
                // We are the left player
                leftGoldElement.textContent = gameState.gold;
            } else {
                // We are the right player
                rightGoldElement.textContent = gameState.gold;
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
        
        // Rock Paper Scissors game setup
        function setupRPSGame(socket) {
            // Get RPS buttons and add event listeners
            const rpsButtons = document.querySelectorAll('.rps-btn');
            rpsButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!gameState.rps.roundActive) return;
                    
                    // Get the player's choice
                    const choice = btn.getAttribute('data-choice');
                    
                    // Clear any previous selections
                    rpsButtons.forEach(b => b.classList.remove('selected'));
                    
                    // Mark this button as selected
                    btn.classList.add('selected');
                    
                    // Store the choice and send it to the server
                    gameState.rps.playerChoice = choice;
                    socket.emit('rpsChoice', { choice });
                    
                    // Show the choice 
                    document.getElementById('player-choice').textContent = getChoiceEmoji(choice);
                    
                    // Update message
                    document.getElementById('rps-message').textContent = "Waiting for opponent...";
                });
            });
            
            // Listen for opponent's choice
            socket.on('rpsOpponentChoice', (data) => {
                gameState.rps.opponentChoice = data.choice;
                document.getElementById('opponent-choice').textContent = getChoiceEmoji(data.choice);
                
                // If both players have made a choice, determine the winner
                if (gameState.rps.playerChoice && gameState.rps.opponentChoice) {
                    determineRPSWinner(socket);
                }
            });
            
            // Listen for RPS round start event
            socket.on('rpsRoundStart', () => {
                startRPSRound();
            });
            
            // Listen for RPS round end event
            socket.on('rpsRoundEnd', () => {
                // Only reset UI elements here, game state is reset in startRPSRound
                document.getElementById('rps-message').textContent = "Preparing next round...";
                document.getElementById('rps-timer').style.display = 'none';
                
                if (gameState.rps.countdownTimer) {
                    clearInterval(gameState.rps.countdownTimer);
                    gameState.rps.countdownTimer = null;
                }
                
                gameState.rps.roundActive = false;
            });
        }
        
        // Start a new Rock Paper Scissors round
        function startRPSRound() {
            // Reset the game state
            gameState.rps.playerChoice = null;
            gameState.rps.opponentChoice = null;
            gameState.rps.roundActive = true;
            
            // Clear previous choices
            document.getElementById('player-choice').textContent = '';
            document.getElementById('opponent-choice').textContent = '';
            
            // Remove any previous button states
            document.querySelectorAll('.rps-btn').forEach(btn => {
                btn.classList.remove('selected', 'winner', 'loser');
            });
            
            // Update the message
            document.getElementById('rps-message').textContent = "Choose rock, paper, or scissors";
            
            // Start a 10-second countdown for this round
            let countdown = 10;
            document.getElementById('timer-count').textContent = countdown;
            document.getElementById('rps-timer').style.display = 'block';
            
            gameState.rps.countdownTimer = setInterval(() => {
                countdown--;
                document.getElementById('timer-count').textContent = countdown;
                
                if (countdown <= 0) {
                    clearInterval(gameState.rps.countdownTimer);
                    
                    // If player hasn't made a choice, make a random one
                    if (!gameState.rps.playerChoice) {
                        const choices = ['rock', 'paper', 'scissors'];
                        const randomChoice = choices[Math.floor(Math.random() * choices.length)];
                        
                        // Simulate a click on the corresponding button
                        const btn = document.querySelector(`.rps-btn[data-choice="${randomChoice}"]`);
                        if (btn) btn.click();
                    }
                }
            }, 1000);
        }
        
        // Determine the winner of the RPS round
        function determineRPSWinner(socket) {
            const playerChoice = gameState.rps.playerChoice;
            const opponentChoice = gameState.rps.opponentChoice;
            
            let result;
            if (playerChoice === opponentChoice) {
                result = 'tie';
                document.getElementById('rps-message').textContent = "It's a tie!";
            } else if (
                (playerChoice === 'rock' && opponentChoice === 'scissors') ||
                (playerChoice === 'paper' && opponentChoice === 'rock') ||
                (playerChoice === 'scissors' && opponentChoice === 'paper')
            ) {
                result = 'win';
                document.getElementById('rps-message').textContent = "You win! +100 gold";
                
                // Find the button in the player's side
                const playerSide = document.querySelector('.player-side');
                if (playerSide) {
                    const winningBtn = playerSide.querySelector(`.rps-btn[data-choice="${playerChoice}"]`);
                    if (winningBtn) {
                        winningBtn.classList.add('winner');
                    }
                }
                
                // Add gold for winning
                gameState.gold += RPS_REWARD;
                updateGoldDisplay();
                
                // Tell the server about the gold increase
                socket.emit('rpsWin');
            } else {
                result = 'lose';
                document.getElementById('rps-message').textContent = "You lose!";
                
                // Find the button in the player's side
                const playerSide = document.querySelector('.player-side');
                if (playerSide) {
                    const losingBtn = playerSide.querySelector(`.rps-btn[data-choice="${playerChoice}"]`);
                    if (losingBtn) {
                        losingBtn.classList.add('loser');
                    }
                }
            }
            
            // End the current round
            endRPSRound(socket);
        }
        
        // End the current RPS round
        function endRPSRound(socket) {
            gameState.rps.roundActive = false;
            
            // Clear any timers
            if (gameState.rps.countdownTimer) {
                clearInterval(gameState.rps.countdownTimer);
                gameState.rps.countdownTimer = null;
            }
            
            // Hide the timer
            document.getElementById('rps-timer').style.display = 'none';
            
            // Broadcast end of round to all players
            socket.emit('rpsRoundEnd');
            
            // Start a new round after 3 seconds
            setTimeout(() => {
                socket.emit('rpsRoundStart');
            }, 3000);
        }
        
        // Helper function to get emoji for a choice
        function getChoiceEmoji(choice) {
            switch (choice) {
                case 'rock': return '✊';
                case 'paper': return '✋';
                case 'scissors': return '✌️';
                default: return '';
            }
        }

        // Set up RPS game
        setupRPSGame(socket);
    }
}); 