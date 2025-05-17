/**
 * UI Enhancement Script
 * Provides additional UI/UX improvements for the World Peace Online game
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI enhancements
    initImageLoader();
    initAnimations();
    initTitleAnimation();
    initRippleEffect();
    initThemeToggle();
    initAccessibility();
    
    // Check if the browser supports backdrop-filter
    if (!CSS.supports('backdrop-filter', 'blur(10px)')) {
        document.documentElement.classList.add('no-backdrop-filter');
    }
});

/**
 * Handle image loading with fade-in effect
 */
function initImageLoader() {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
        // Skip if image is already loaded
        if (img.complete) {
            img.classList.add('loaded');
        } else {
            img.addEventListener('load', function() {
                img.classList.add('loaded');
            });
        }
        
        // Handle errors
        img.addEventListener('error', function() {
            console.warn('Failed to load image:', img.src);
            img.alt = 'Image failed to load';
            img.classList.add('error');
        });
    });
}

/**
 * Initialize animations for elements
 */
function initAnimations() {
    // Add fade-in animation to elements as they scroll into view
    const animatedElements = document.querySelectorAll('.title-container, .auth-form, .dashboard-container, .section');
    
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fadeIn');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        
        animatedElements.forEach(el => {
            observer.observe(el);
        });
    } else {
        // Fallback for browsers without IntersectionObserver
        animatedElements.forEach(el => {
            el.classList.add('fadeIn');
        });
    }
}

/**
 * Special animation for the title
 */
function initTitleAnimation() {
    const title = document.querySelector('h1');
    if (title) {
        setTimeout(() => {
            title.style.opacity = '1';
            title.style.transform = 'translateY(0)';
        }, 300);
    }
}

/**
 * Add ripple effect to buttons
 */
function initRippleEffect() {
    const buttons = document.querySelectorAll('button, .room-button, .auth-links a');
    
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const x = e.clientX - e.target.getBoundingClientRect().left;
            const y = e.clientY - e.target.getBoundingClientRect().top;
            
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            button.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

/**
 * Add theme toggle functionality
 */
function initThemeToggle() {
    // Create theme toggle button
    const themeToggle = document.createElement('div');
    themeToggle.id = 'theme-toggle';
    themeToggle.innerHTML = '<span>🌙</span>';
    themeToggle.title = 'Toggle dark/light mode';
    themeToggle.setAttribute('aria-label', 'Toggle dark/light mode');
    themeToggle.setAttribute('role', 'button');
    themeToggle.setAttribute('tabindex', '0');
    
    // Check user preference and system theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
    
    // Set initial theme
    if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark-theme');
        themeToggle.querySelector('span').textContent = '☀️';
    }
    
    // Add event listener
    themeToggle.addEventListener('click', toggleTheme);
    themeToggle.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTheme();
        }
    });
    
    // Add to document
    document.body.appendChild(themeToggle);
    
    // Add styles for theme toggle
    const style = document.createElement('style');
    style.textContent = `
        #theme-toggle {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            background-color: rgba(0,0,0,0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1001;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        }
        
        #theme-toggle:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        
        .dark-theme {
            --card-bg: rgba(30, 30, 30, 0.9);
            --text-color: #f0f0f0;
            --header-bg: rgba(30, 30, 30, 0.95);
            --bg-color: #121212;
            --primary-color: #5a79cd;
            --primary-dark: #4c68b8;
        }
        
        .no-backdrop-filter .header {
            background-color: rgba(30, 30, 30, 0.95);
        }
    `;
    document.head.appendChild(style);
}

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark-theme');
    const themeToggle = document.getElementById('theme-toggle');
    
    if (isDark) {
        localStorage.setItem('theme', 'dark');
        themeToggle.querySelector('span').textContent = '☀️';
    } else {
        localStorage.setItem('theme', 'light');
        themeToggle.querySelector('span').textContent = '🌙';
    }
}

/**
 * Additional accessibility improvements
 */
function initAccessibility() {
    // Add keyboard navigation improvements
    const focusableElements = document.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    
    focusableElements.forEach(el => {
        el.addEventListener('keydown', function(e) {
            // Allow pressing space to activate buttons and links
            if (e.key === ' ' && (el.tagName === 'BUTTON' || el.tagName === 'A')) {
                e.preventDefault();
                el.click();
            }
        });
    });
    
    // Enhance form labels with aria-describedby for better screen reader support
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        const id = input.id;
        if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) {
                const helpId = `${id}-help`;
                const helpText = document.createElement('div');
                helpText.id = helpId;
                helpText.className = 'sr-only';
                helpText.textContent = `Enter your ${label.textContent}`;
                
                input.parentNode.insertBefore(helpText, input.nextSibling);
                input.setAttribute('aria-describedby', helpId);
            }
        }
    });
}

// Function to detect when DOM is fully loaded and initialized
window.onload = function() {
    // Remove loading state
    document.body.classList.remove('loading');
    document.body.classList.add('loaded');
    
    // Update CSS variables based on viewport height for better mobile experience
    function updateViewportHeight() {
        // Fix for mobile viewport height issues
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    
    // Initialize and add resize listener
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    
    // Add smooth transitions when navigating between pages
    document.querySelectorAll('a').forEach(link => {
        // Only apply to internal links
        if (link.hostname === window.location.hostname) {
            link.addEventListener('click', function(e) {
                // Don't apply to links that open in new tabs or have specific behaviors
                if (e.ctrlKey || e.metaKey || this.target === '_blank') return;
                
                e.preventDefault();
                document.body.classList.add('page-transition');
                
                setTimeout(() => {
                    window.location.href = this.href;
                }, 300);
            });
        }
    });
};

// Add performance monitoring
let pageLoadTime = window.performance && window.performance.timing ? 
    window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart : 
    0;

if (pageLoadTime > 0) {
    console.log(`Page loaded in ${pageLoadTime}ms`);
} 