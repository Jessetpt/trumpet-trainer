// Supabase client configuration
// This file will be updated with your actual Supabase credentials

// Initialize Supabase client
let supabase = null;
let isInitialized = false;

// Function to initialize Supabase with credentials
function initSupabase(url, anonKey) {
  if (typeof window !== 'undefined' && window.supabase) {
    // If Supabase is already loaded globally
    supabase = window.supabase.createClient(url, anonKey);
    isInitialized = true;
    console.log('✅ Supabase initialized successfully');
    
    // Also set the global variable for compatibility
    window.supabaseClient = window.supabaseClient || {};
    window.supabaseClient.supabase = supabase;
    
    return supabase;
  } else {
    console.error('Supabase not loaded. Please include the Supabase client script.');
    return null;
  }
}

// Function to get Supabase client
function getSupabase() {
  if (!isInitialized || !supabase) {
    console.error('Supabase not initialized. Call initSupabase() first.');
    return null;
  }
  return supabase;
}

// Export for use in other files
window.supabaseClient = {
  init: initSupabase,
  get: getSupabase,
  isReady: () => isInitialized
}; 