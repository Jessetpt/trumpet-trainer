// Theme utility functions for dark mode toggle
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const navThemeToggle = document.getElementById('nav-theme-toggle');
    
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    }
    
    // Initialize theme icons and logos
    if (themeToggle) {
        updateThemeIcon(savedTheme);
        updateLogo(savedTheme);
        
        themeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon(isDark ? 'dark' : 'light');
            updateLogo(isDark ? 'dark' : 'light');
        });
    }
    
    if (navThemeToggle) {
        updateNavThemeIcon(savedTheme);
        updateNavLogo(savedTheme);
        
        navThemeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateNavThemeIcon(isDark ? 'dark' : 'light');
            updateNavLogo(isDark ? 'dark' : 'light');
        });
    }
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
}

function updateLogo(theme) {
    const navLogo = document.getElementById('nav-logo');
    if (navLogo) {
        navLogo.src = theme === 'dark' ? 'Untitled design dark.svg' : 'Untitled design.svg';
    }
}

function updateNavThemeIcon(theme) {
    const navThemeToggle = document.getElementById('nav-theme-toggle');
    if (navThemeToggle) {
        navThemeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        navThemeToggle.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
}

function updateNavLogo(theme) {
    const navLogo = document.getElementById('nav-logo');
    if (navLogo) {
        navLogo.src = theme === 'dark' ? 'Untitled design dark.svg' : 'Untitled design.svg';
    }
    
    // Also update the game logos to use dark version in dark mode
    const gameLogos = document.querySelectorAll('#brandLogo');
    gameLogos.forEach(logo => {
        logo.src = theme === 'dark' ? 'Untitled design dark.svg' : 'Untitled design.svg';
    });
}

// Initialize theme when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
} 