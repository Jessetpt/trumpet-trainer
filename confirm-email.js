(() => {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');
  const type = urlParams.get('type');

  console.log('🔍 Confirmation page loaded with:', { type, hasToken: !!accessToken });

  // If we have the right parameters, just redirect immediately
  if (type === 'signup' && accessToken) {
    console.log('✅ Valid confirmation link, redirecting to login page...');
    
    // Try to set the session quickly, then redirect
    if (window.supabaseClient && typeof window.supabaseClient.get === 'function') {
      const supabaseClient = window.supabaseClient.get();
      if (supabaseClient) {
        // Set session silently
        supabaseClient.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        }).then(() => {
          console.log('✅ Session set, redirecting...');
          window.location.href = 'login.html?confirmed=true';
        }).catch(() => {
          console.log('⚠️ Session setting failed, redirecting anyway...');
          window.location.href = 'login.html?confirmed=true';
        });
      } else {
        // No Supabase client, just redirect
        window.location.href = 'login.html?confirmed=true';
      }
    } else {
      // No Supabase, just redirect
      window.location.href = 'login.html?confirmed=true';
    }
  } else {
    console.log('❌ Invalid confirmation link, redirecting to login...');
    window.location.href = 'login.html?error=invalid_link';
  }
})(); 