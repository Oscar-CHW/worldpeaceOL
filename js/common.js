import i18n from '../js/i18n.js';
import { createLanguageSelector } from '../js/language-selector.js';

document.addEventListener('DOMContentLoaded', function() {
    i18n.init();
    
    // Create language selector
    createLanguageSelector('language-selector');
    
    // Connect to Socket.IO
    // const title = document.querySelector('h1');
    PageStyleButton();
    // Add a subtle animation effect when the page loads
    // setTimeout(() => {
    //     title.style.opacity = '1';
    //     title.style.transform = 'translateY(0)';
    // }, 300);
    
    // Add an event listener for when the user clicks on the title
    // title.addEventListener('click', function() {
    //     // Create a ripple effect
    //     const colors = ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7'];
    //     const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
    //     // Change the text shadow color
    //     this.style.textShadow = `2px 2px 4px ${randomColor}`;
        
    //     // Add a small animation
    //     this.style.transform = 'scale(1.05)';
    //     setTimeout(() => {
    //         this.style.transform = 'scale(1)';
    //     }, 300);
    // });
}); 
async function PageStyleButton()
{
    //Temp. deleted the options so this is useless temp.
    // document.getElementById('standard-theme').addEventListener('click', function() {
    //     document.head.querySelector('style').textContent = '.nes-only { display: none !important; }'; //hide nesonly elemetns
    // });
    // document.getElementById('nes-theme').addEventListener('click', function() {
    //     document.head.querySelector('style').textContent = '.standard-only { display: none !important; }'; //hide nesonly elemetns

    // });
}
//well, check auth! and change the thing on the top right
async function checkAuth() {
    try {
        const response = await fetch('/api/user/me');
        
        if (response.status !== 401) {
            // User is logged in, update the auth links
            const data = await response.json();
            const authLinks = document.getElementById('auth-links');
            if (authLinks) {
                authLinks.innerHTML = `
                    <a href="/dashboard.html" class="standard-only" id="welcome-user" data-i18n="user_profile"></a>
                    <a href="#" id="logout-link" class="standard-only"data-i18n="logout"></a>
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
                
                return true;
            }
        } else {
            return false;
        }
    } catch (error) {
        console.error('Error checking auth status', error);
        return false;
    }
}

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