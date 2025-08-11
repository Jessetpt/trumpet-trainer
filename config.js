// Configuration for Trumpet Trainer
// Supabase-only configuration - no localhost APIs

const config = {
  // Supabase configuration
  supabase: {
    url: 'https://ooiowourmbkmhrhuaybl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vaW93b3VybWJrbWhyaHVheWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzE1NjYsImV4cCI6MjA3MDIwNzU2Nn0.Jbv5EKbQ4TZmWP-mVZoXymguXXS_8Fw4Kgm0DM4GU0o'
  },
  
  // App settings
  appName: 'Trumpet Trainer',
  version: '1.0.0'
};

// Make config available globally
window.appConfig = config;

// Initialize Supabase when config loads
function initializeSupabase() {
  if (typeof window.supabaseClient !== 'undefined') {
    console.log('🔧 Config: supabaseClient available, initializing...');
    const result = window.supabaseClient.init(config.supabase.url, config.supabase.anonKey);
    if (result) {
      console.log('✅ Config: Supabase initialized successfully');
    } else {
      console.error('❌ Config: Failed to initialize Supabase');
    }
  } else {
    console.log('⏳ Config: supabaseClient not available yet, waiting...');
    // If supabaseClient isn't available yet, wait for it
    setTimeout(initializeSupabase, 100);
  }
}

// Start initialization
initializeSupabase();

// Log configuration in development
if (config.isDevelopment) {
  console.log('🔧 App Configuration:', config);
} 