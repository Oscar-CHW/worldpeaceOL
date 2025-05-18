/**
 * User Authentication Status Handler
 * This file checks user authentication status and updates UI elements accordingly.
 * Include this in all pages that need to show user authentication status.
 */

// Check if user is logged in and update UI elements
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/me');
        
        if (response.status === 401) {
            // Not logged in
            showLoggedOutUI();
            return;
        }
        
        if (response.ok) {
            const userData = await response.json();
            // User is logged in
            showLoggedInUI(userData);
        } else {
            // Error occurred
            showLoggedOutUI();
        }
    } catch (error) {
        console.error('Error checking authentication status:', error);
        showLoggedOutUI();
    }
}

// Update UI for logged in users
function showLoggedInUI(userData) {
    const authLinks = document.querySelector('.auth-links');
    if (!authLinks) return;
    
    authLinks.innerHTML = `
        <div id="user-profile-link">
            <a href="/dashboard.html">Welcome, ${userData.username}</a>
            <a href="#" id="logout-link">Logout</a>
        </div>
    `;
    
    // Add logout handler
    document.getElementById('logout-link').addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST'
            });
            
            if (response.ok) {
                window.location.reload();
            }
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });
}

// Update UI for logged out users
function showLoggedOutUI() {
    const authLinks = document.querySelector('.auth-links');
    if (!authLinks) return;
    
    authLinks.innerHTML = `
        <div id="auth-buttons">
            <a href="/login.html" aria-label="Log in to your account">Log in</a>
            <a href="/signup.html" aria-label="Create a new account">Sign up</a>
        </div>
    `;
}

// Check auth status when the page loads
document.addEventListener('DOMContentLoaded', checkAuthStatus);

// Mobile navigation toggle for all pages
(function() {
    const navToggle = document.getElementById('nav-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    if (navToggle && mobileNav) {
        navToggle.addEventListener('click', function() {
            mobileNav.classList.toggle('active');
        });
    }
})();

// Highlight active nav link based on current page
(function() {
    const path = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        // Remove any existing active classes
        link.classList.remove('active', 'is-primary');
        // Mark as active if href matches current path
        if (link.pathname === path) {
            link.classList.add('active');
            if (link.classList.contains('nes-btn')) {
                link.classList.add('is-primary');
            }
        }
    });
})();

// Export functions for use in other modules
export { checkAuthStatus, showLoggedInUI, showLoggedOutUI };