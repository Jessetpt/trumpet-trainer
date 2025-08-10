// Configuration for Trumpet Trainer
// Automatically detects environment and sets appropriate URLs

const config = {
  // Supabase configuration
  supabase: {
    url: 'https://ooiowourmbkmhrhuaybl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vaW93b3VybWJrbWhyaHVheWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzE1NjYsImV4cCI6MjA3MDIwNzU2Nn0.Jbv5EKbQ4TZmWP-mVZoXymguXXS_8Fw4Kgm0DM4GU0o'
  },
  
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

// Initialize Supabase when config loads
if (typeof window.supabaseClient !== 'undefined') {
  window.supabaseClient.init(config.supabase.url, config.supabase.anonKey);
}

// Log configuration in development
if (config.isDevelopment) {
  console.log('🔧 App Configuration:', config);
} 