import i18n from '../i18n.js';
import { createLanguageSelector } from '../language-selector.js';

// Initialize the i18n system
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize language system
    i18n.init();
    
    // Create language selector
    createLanguageSelector('language-selector');
    
    // Connect to Socket.IO
    const socket = io();
    
    // Get real-time user count updates
    socket.on('userCountUpdate', (data) => {
        document.getElementById('player-count').textContent = data.count.toLocaleString();
    });
    
    // Initial user count
    fetchUserCount();
    
    // Join Room modal elements
    const joinRoomModal = document.getElementById('join-room-modal');
    const closeModalBtn = document.querySelector('.join-room-close');
    const roomIdInput = document.getElementById('room-id-input');
    const joinRoomForm = document.getElementById('join-room-form');
    const errorMessage = document.getElementById('error-message');
    const lastRoomPrompt = document.getElementById('last-room-prompt');
    const lastRoomId = document.getElementById('last-room-id');
    const rejoinRoomBtn = document.getElementById('rejoin-btn');
    
    // Check if user is logged in
    checkAuth();
    
    // Initialize UI interactions
    initUI();
    
    // Set up game mode tabs
    setupGameModeTabs();
    
    // Add visual animation when page loads
    setTimeout(() => {
        const title = document.querySelector('h1');
        if (title) {
            title.style.opacity = '1';
            title.style.transform = 'translateY(0)';
        }
    }, 300);
});

async function fetchUserCount() {
    try {
        const response = await fetch('/api/users/count');
        if (response.ok) {
            const data = await response.json();
            const playerCountElement = document.getElementById('player-count');
            if (playerCountElement) {
                playerCountElement.textContent = data.count.toLocaleString();
            }
        }
    } catch (error) {
        console.error('Error fetching user count:', error);
    }
}

async function checkAuth() {
    try {
        const response = await fetch('/api/user/me');
        
        if (response.status !== 401) {
            // User is logged in, update the auth links
            const data = await response.json();
            const authLinks = document.getElementById('auth-links');
            if (authLinks) {
                authLinks.innerHTML = `
                    <a href="/dashboard.html" id="welcome-user" data-i18n="user_profile"></a>
                    <a href="#" id="logout-link" data-i18n="logout"></a>
                `;
                
                // Update welcome text
                const welcomeUser = document.getElementById('welcome-user');
                if (welcomeUser) {
                    welcomeUser.textContent = `${i18n.translate('welcome')}, ${data.username}`;
                }
                
                // Apply translations to newly created elements
                i18n.applyTranslations();
                
                // Add logout functionality
                const logoutLink = document.getElementById('logout-link');
                if (logoutLink) {
                    logoutLink.addEventListener('click', async (e) => {
                        e.preventDefault();
                        
                        try {
                            await fetch('/api/logout', {
                                method: 'POST'
                            });
                            window.location.reload();
                        } catch (error) {
                            console.error('Logout failed', error);
                        }
                    });
                }

                // Show room buttons if they exist
                const roomButtons = document.getElementById('room-buttons');
                if (roomButtons) {
                    roomButtons.style.display = 'flex';
                }

                // Check for last room
                checkLastRoom();
            }
        }
    } catch (error) {
        console.error('Error checking auth status', error);
    }
}

async function checkLastRoom() {
    try {
        const response = await fetch('/api/user/last-room');
        if (response.ok) {
            const data = await response.json();
            
            if (data.hasLastRoom && data.roomId) {
                const lastRoom = data.roomId;
                const lastRoomId = document.getElementById('last-room-id');
                const lastRoomPrompt = document.getElementById('last-room-prompt');
                
                if (lastRoomId) {
                    lastRoomId.textContent = `Room ID: ${lastRoom}`;
                }
                
                if (lastRoomPrompt) {
                    lastRoomPrompt.style.display = 'block';
                }
                
                const rejoinRoomBtn = document.getElementById('rejoin-btn');
                if (rejoinRoomBtn) {
                    rejoinRoomBtn.addEventListener('click', () => {
                        window.location.href = `/game-room.html?roomId=${lastRoom}`;
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error checking last room:', error);
    }
}

function initUI() {
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const joinModal = document.getElementById('join-room-modal');
    const closeBtn = document.querySelector('.join-room-close');
    
    // Create Room button - check login status first
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/user/me');
                
                if (response.status === 401) {
                    // Show error message if not logged in
                    const errorMessage = document.getElementById('error-message');
                    if (errorMessage) {
                        errorMessage.style.display = 'block';
                    }
                    return;
                }
                
                // If logged in, proceed to create room page
                window.location.href = 'create-room.html';
            } catch (error) {
                console.error('Error checking auth status:', error);
                const errorMessage = document.getElementById('error-message');
                if (errorMessage) {
                    errorMessage.style.display = 'block';
                }
            }
        });
    }
    
    // Join Room button - show modal
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', () => {
            if (joinModal) {
                joinModal.classList.add('active');
                joinModal.setAttribute('aria-hidden', 'false');
                
                const roomIdInput = document.getElementById('room-id-input');
                if (roomIdInput) {
                    roomIdInput.focus();
                }
                
                // Trap focus in modal
                trapFocus(joinModal);
            }
        });
    }
    
    // Close modal when clicking the close button
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (joinModal) {
                joinModal.classList.remove('active');
                joinModal.setAttribute('aria-hidden', 'true');
                if (joinRoomBtn) {
                    joinRoomBtn.focus();
                }
            }
        });
    }
    
    // Handle join room form submission
    const joinRoomForm = document.getElementById('join-room-form');
    if (joinRoomForm) {
        joinRoomForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const roomIdInput = document.getElementById('room-id-input');
            
            if (roomIdInput && roomIdInput.value.trim()) {
                try {
                    // Check if user is logged in
                    const response = await fetch('/api/user/me');
                    
                    if (response.status === 401) {
                        // Show error message if not logged in
                        const errorMessage = document.getElementById('error-message');
                        if (errorMessage) {
                            errorMessage.style.display = 'block';
                        }
                        return;
                    }
                    
                    // Redirect to game room page with room ID
                    window.location.href = `/game-room.html?roomId=${roomIdInput.value.trim()}`;
                } catch (error) {
                    console.error('Error joining room:', error);
                    const errorMessage = document.getElementById('error-message');
                    if (errorMessage) {
                        errorMessage.style.display = 'block';
                    }
                }
            } else if (roomIdInput) {
                roomIdInput.focus();
            }
        });
    }
    
    // Set up matchmaking cards
    const quickMatch = document.getElementById('quick-match');
    if (quickMatch) {
        quickMatch.addEventListener('click', () => {
            window.location.href = '/pairing.html';
        });
    }
    
    const friendBattle = document.getElementById('friend-battle');
    if (friendBattle) {
        friendBattle.addEventListener('click', () => {
            window.location.href = '/friends.html';
        });
    }
    
    const customRoom = document.getElementById('custom-room');
    if (customRoom) {
        customRoom.addEventListener('click', () => {
            window.location.href = '/create-room.html';
        });
    }
    
    // Close modal on escape or outside click
    if (joinModal) {
        // Close modal on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && joinModal.classList.contains('active')) {
                joinModal.classList.remove('active');
                joinModal.setAttribute('aria-hidden', 'true');
                if (joinRoomBtn) {
                    joinRoomBtn.focus();
                }
            }
        });
        
        // Close modal if clicked outside
        joinModal.addEventListener('click', (e) => {
            if (e.target === joinModal) {
                joinModal.classList.remove('active');
                joinModal.setAttribute('aria-hidden', 'true');
                if (joinRoomBtn) {
                    joinRoomBtn.focus();
                }
            }
        });
    }
    
    // Add click animation to title (like in games)
    const titleContainer = document.querySelector('.title-container');
    if (titleContainer) {
        titleContainer.addEventListener('click', () => {
            const title = document.querySelector('h1');
            if (title) {
                title.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    title.style.transform = 'scale(1)';
                }, 200);
            }
        });
    }
    
    // Allow pressing Enter to submit the form
    const roomIdInput = document.getElementById('room-id-input');
    const submitJoinRoomBtn = document.getElementById('submit-join-room');
    if (roomIdInput && submitJoinRoomBtn) {
        roomIdInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                submitJoinRoomBtn.click();
            }
        });
    }
}

// Set up game mode tabs with descriptions
function setupGameModeTabs() {
    const modes = document.querySelectorAll('.game-mode');
    const descriptionEl = document.getElementById('mode-description');
    
    if (!modes.length || !descriptionEl) return;
    
    const modeDescriptions = {
        'mode-classic': 'The original strategy game experience. Build armies, collect resources, and work toward world peace.',
        'mode-insane': 'Faster gameplay, more powerful units, and chaotic battles! For players who enjoy intense, action-packed matches.',
        'mode-beta': 'Experimental new features and game variants. Help us test new mechanics and provide feedback!'
    };
    
    modes.forEach((mode, index) => {
        mode.addEventListener('click', () => {
            // Update selection state
            modes.forEach(m => {
                m.classList.remove('active');
                m.setAttribute('aria-selected', 'false');
                m.setAttribute('tabindex', '-1');
            });
            
            mode.classList.add('active');
            mode.setAttribute('aria-selected', 'true');
            mode.setAttribute('tabindex', '0');
            
            // Update description
            descriptionEl.textContent = modeDescriptions[mode.id] || '';
            
            // Announce to screen reader
            announceToScreenReader(`Selected ${mode.textContent} game mode`);
        });
        
        // Keyboard navigation
        mode.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = (index + 1) % modes.length;
                modes[nextIndex].focus();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = (index - 1 + modes.length) % modes.length;
                modes[prevIndex].focus();
            }
        });
    });
}

// Helper for focus trapping in modals
function trapFocus(element) {
    const focusableElements = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length < 2) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    element.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        }
    });
}

// Announce messages to screen readers
function announceToScreenReader(message) {
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.classList.add('sr-only');
    document.body.appendChild(ariaLive);
    
    setTimeout(() => {
        ariaLive.textContent = message;
        
        // Remove after announcement
        setTimeout(() => {
            document.body.removeChild(ariaLive);
        }, 3000);
    }, 100);
}

// Listen for language changes
document.addEventListener('languageChanged', (e) => {
    // Update document language
    document.documentElement.lang = e.detail.language;
    
    // Update dynamic content that isn't handled by data-i18n
    const welcomeUser = document.getElementById('welcome-user');
    if (welcomeUser) {
        // The username needs to be preserved
        const username = welcomeUser.textContent.split(', ')[1];
        welcomeUser.textContent = `${i18n.translate('welcome')}, ${username}`;
    }
}); 