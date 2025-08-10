// Configuration for Trumpet Trainer
// Automatically detects environment and sets appropriate URLs

const config = {
  // API base URL - automatically detects environment
  apiBaseUrl: (() => {
    // If we're running on localhost, use localhost:3000
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
    
    // If we're running on a different domain (production), use the same domain
    // This assumes your API is served from the same domain as your frontend
    return `${window.location.protocol}//${window.location.host}/api`;
  })(),
  
  // Environment detection
  isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  isProduction: window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1',
  
  // App settings
  appName: 'Trumpet Trainer',
  version: '1.0.0'
};

// Make config available globally
window.appConfig = config;

// Log configuration in development
if (config.isDevelopment) {
  console.log('🔧 App Configuration:', config);
} 