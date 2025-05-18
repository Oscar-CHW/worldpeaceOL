import i18n from '../i18n.js';

// Initialize the i18n system
document.addEventListener('DOMContentLoaded', async () => {
    const socket = io();

    
    // Get real-time user count updates
    socket.on('userCountUpdate', (data) => {
        document.getElementById('player-count').textContent = data.count.toLocaleString();
    });
    checkLastRoom();


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
    
    // Initialize UI interactions
    initUI();
    UIStuff();

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

async function UIStuff()
{
    setTimeout(() => document.body.classList.remove('loading'), 100);
    
    // Mobile navigation toggle
    const navToggle = document.getElementById('nav-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    
    if (navToggle && mobileNav) {
        navToggle.addEventListener('click', function() {
            mobileNav.classList.toggle('active');
        });
    }
    
    // Header scroll behavior
    let lastScrollTop = 0;
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down & past threshold
            header.classList.add('collapsed');
            header.classList.remove('visible');
        } else {
            // Scrolling up
            header.classList.remove('collapsed');
            header.classList.add('visible');
        }
        
        lastScrollTop = scrollTop;
    });
    
    // Auth status check and display
    function checkAuthStatus() {
        // This will be set by the auth-status.js script
        if (window.isLoggedIn) {
            // Hide login/signup buttons
            document.getElementById('auth-buttons').classList.add('hidden');
            document.getElementById('mobile-auth-buttons').classList.add('hidden');
            
            // Show user welcome
            document.getElementById('user-welcome').classList.remove('hidden');
            document.getElementById('mobile-user-welcome').classList.remove('hidden');
            
            // Set username
            if (window.currentUser) {
                const displayName = window.currentUser.username || 'User';
                const firstLetter = displayName.charAt(0).toUpperCase();
                
                document.getElementById('username-display').textContent = displayName;
                document.getElementById('mobile-username-display').textContent = displayName;
                document.getElementById('user-avatar').textContent = firstLetter;
                document.getElementById('mobile-user-avatar').textContent = firstLetter;
            }
        } else {
            // Show login/signup buttons
            document.getElementById('auth-buttons').classList.remove('hidden');
            document.getElementById('mobile-auth-buttons').classList.remove('hidden');
            
            // Hide user welcome
            document.getElementById('user-welcome').classList.add('hidden');
            document.getElementById('mobile-user-welcome').classList.add('hidden');
        }
    }
    
    // Check auth status when the window loads and when auth status changes
    window.addEventListener('load', checkAuthStatus);
    document.addEventListener('auth-status-changed', checkAuthStatus);
    
    // Offline detection
    window.addEventListener('online', function() {
        document.querySelectorAll('.offline-notification').forEach(el => {
            el.classList.add('hidden');
        });
    });
    
    window.addEventListener('offline', function() {
        document.querySelectorAll('.offline-notification').forEach(el => {
            el.classList.remove('hidden');
        });
    });
    
    // Check initial state
    if (!navigator.onLine) {
        document.querySelectorAll('.offline-notification').forEach(el => {
            el.classList.remove('hidden');
        });
    }
    
    // Connect buttons to their functions
    document.getElementById('quick-match').addEventListener('click', function() {
        window.location.href = '/pairing.html';
    });
    
    document.getElementById('friend-battle').addEventListener('click', function() {
        window.location.href = '/friends.html';
    });
    
    document.getElementById('custom-room').addEventListener('click', function() {
        window.location.href = '/create-room.html';
    });
    
    // Connect NES theme buttons
    document.getElementById('quick-match-nes').addEventListener('click', function() {
        window.location.href = '/pairing.html';
    });
    
    document.getElementById('friend-battle-nes').addEventListener('click', function() {
        window.location.href = '/friends.html';
    });
    
    document.getElementById('custom-room-nes').addEventListener('click', function() {
        window.location.href = '/create-room.html';
    });
    
    // Sync player counts
    document.getElementById('player-count').textContent = 
        document.getElementById('player-count-nes').textContent = 
        document.getElementById('player-count').textContent || '7';
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