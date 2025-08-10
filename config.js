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
if (typeof window.supabaseClient !== 'undefined') {
  window.supabaseClient.init(config.supabase.url, config.supabase.anonKey);
} else {
  // If supabaseClient isn't available yet, wait for it
  const checkSupabase = () => {
    if (typeof window.supabaseClient !== 'undefined') {
      window.supabaseClient.init(config.supabase.url, config.supabase.anonKey);
      console.log('✅ Supabase initialized from config.js');
    } else {
      setTimeout(checkSupabase, 100);
    }
  };
  checkSupabase();
}

// Log configuration in development
if (config.isDevelopment) {
  console.log('🔧 App Configuration:', config);
} 