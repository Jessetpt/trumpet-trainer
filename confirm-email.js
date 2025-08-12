(() => {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');
  const expiresAt = urlParams.get('expires_at');
  const tokenType = urlParams.get('token_type');
  const type = urlParams.get('type');

  // Get DOM elements
  const confirmStatus = document.getElementById('confirmStatus');
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

  // Function to get Supabase client
  async function getSupabase() {
    if (window.supabaseClient && typeof window.supabaseClient.get === 'function') {
      if (window.supabaseClient.isReady && !window.supabaseClient.isReady()) {
        let attempts = 0;
        while (!window.supabaseClient.isReady() && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
      }
      return window.supabaseClient.get();
    }
    
    // Fallback to creating our own
    const supabaseUrl = 'https://ooiowourmbkmhrhuaybl.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vaW93b3VybWJrbWhyaHVheWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzE1NjYsImV4cCI6MjA3MDIwNzU2Nn0.Jbv5EKbQ4TZmWP-mVZoXymguXXS_8Fw4Kgm0DM4GU0o';
    
    if (window.supabase && window.supabase.createClient) {
      return window.supabase.createClient(supabaseUrl, supabaseKey);
    }
    
    return null;
  }

  // Function to handle email confirmation
  async function confirmEmail() {
    try {
      console.log('🔍 Processing email confirmation...');
      console.log('📧 Token type:', type);
      console.log('🔑 Access token:', accessToken ? 'Present' : 'Missing');

      if (!accessToken) {
        throw new Error('No access token found in URL');
      }

      const supabaseClient = await getSupabase();
      if (!supabaseClient) {
        throw new Error('Failed to initialize Supabase');
      }

      console.log('🔧 Setting Supabase session...');
      // Set the session manually
      const { data, error } = await supabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      console.log('📨 Session response:', { data, error });

      if (error) {
        console.error('❌ Session error:', error);
        throw new Error(error.message);
      }

      if (data.user && data.user.email_confirmed_at) {
        console.log('✅ Email confirmed successfully!');
        showSuccess();
      } else {
        console.log('❌ Email not confirmed, user data:', data.user);
        throw new Error('Email confirmation failed');
      }

    } catch (error) {
      console.error('❌ Confirmation error:', error);
      showError(error.message);
    }
  }

  // Function to show success message
  function showSuccess() {
    confirmStatus.style.display = 'none';
    successMessage.style.display = 'block';
  }

  // Function to show error message
  function showError(message) {
    confirmStatus.style.display = 'none';
    errorMessage.style.display = 'block';
    errorText.textContent = message || 'There was a problem confirming your email.';
  }

  // Start confirmation process when page loads
  console.log('🔍 Page loaded with params:', { type, accessToken: accessToken ? 'Present' : 'Missing' });
  
  if (type === 'signup' && accessToken) {
    console.log('✅ Starting confirmation process...');
    confirmEmail();
  } else {
    console.log('❌ Invalid parameters:', { type, hasToken: !!accessToken });
    showError('Invalid confirmation link. Please check your email and try again.');
  }
})(); 