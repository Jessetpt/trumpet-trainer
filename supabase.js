// Supabase client configuration
// This file will be updated with your actual Supabase credentials

// Initialize Supabase client
let supabase = null;

// Function to initialize Supabase with credentials
function initSupabase(url, anonKey) {
  if (typeof window !== 'undefined' && window.supabase) {
    // If Supabase is already loaded globally
    supabase = window.supabase.createClient(url, anonKey);
    console.log('✅ Supabase initialized successfully');
  } else {
    console.error('Supabase not loaded. Please include the Supabase client script.');
    return null;
  }
  return supabase;
}

// Function to get Supabase client
function getSupabase() {
  if (!supabase) {
    console.error('Supabase not initialized. Call initSupabase() first.');
    return null;
  }
  return supabase;
}

// Export for use in other files
window.supabaseClient = {
  init: initSupabase,
  get: getSupabase
}; 