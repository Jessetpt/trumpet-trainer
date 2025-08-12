(() => {
  // Use shared Supabase client to avoid conflicts
  let supabase = null;
  
  // Function to get Supabase client
  async function getSupabase() {
    if (supabase) return supabase;
    
    // Try to get from shared client first
    if (window.supabaseClient && typeof window.supabaseClient.get === 'function') {
      // Wait for the shared client to be ready
      if (window.supabaseClient.isReady && !window.supabaseClient.isReady()) {
        // Wait up to 5 seconds for it to be ready
        let attempts = 0;
        while (!window.supabaseClient.isReady() && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
      }
      
      supabase = window.supabaseClient.get();
      if (supabase) return supabase;
    }
    
    // Fallback to creating our own if shared one isn't available
    const supabaseUrl = 'https://ooiowourmbkmhrhuaybl.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vaW93b3VybWJrbWhyaHVheWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzE1NjYsImV4cCI6MjA3MDIwNzU2Nn0.Jbv5EKbQ4TZmWP-mVZoXymguXXS_8Fw4Kgm0DM4GU0o';
    
    if (!window.supabase || !window.supabase.createClient) {
      console.error('Supabase UMD not loaded. Check CSP and CDN include.');
      return null;
    } else {
      supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
      return supabase;
    }
  }

  const loginForm = document.getElementById('loginForm');
  const showLoginLink = document.getElementById('showLogin');
  const brandLogo = document.getElementById('brandLogo');
  const formTitle = document.querySelector('.login-card h1');
  const formSubtitle = document.querySelector('.login-card .subtitle');
  const submitButton = document.querySelector('.cta');
  const passwordField = document.getElementById('password');
  const passwordLabel = document.querySelector('label[for="password"]');
  const forgotPasswordLink = document.getElementById('forgotPassword');

  let isLoginMode = false;
  let isResetMode = false;

  // Mobile detection
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
  }

  function showMobileMessage() {
    const mobileMessage = document.getElementById('mobileMessage');
    const loginContainer = document.querySelector('.login-container');
    
    if (mobileMessage && loginContainer) {
      mobileMessage.style.display = 'flex';
      loginContainer.style.display = 'none';
    }
  }

  // Check if mobile and show message
  if (isMobileDevice()) {
    showMobileMessage();
  }

  // Check for existing session when page loads
  (async () => {
    await checkExistingSession();
  })();

  // Theme handling
  function updateLogo() {
    if (!brandLogo) return;
    const dark = document.documentElement.classList.contains('dark');
    brandLogo.src = dark ? 'Untitled design dark.svg' : 'Untitled design.svg';
  }

  // Initialize theme
  updateLogo();

  // Toggle between signup and login
  function toggleMode() {
    isLoginMode = !isLoginMode;
    isResetMode = false;
    
          if (isLoginMode) {
        // Switch to login mode
        formTitle.textContent = 'Welcome Back';
        formSubtitle.textContent = 'Sign in to continue your trumpet training';
        submitButton.textContent = 'Sign In & Play';
        passwordLabel.textContent = 'Password';
        passwordField.placeholder = 'Enter your password';
        showLoginLink.textContent = 'Create new account';
        
        // Hide name and phone fields and remove required attribute
        const nameField = document.getElementById('name');
        const phoneField = document.getElementById('phone');
        document.querySelector('label[for="name"]').parentElement.style.display = 'none';
        document.querySelector('label[for="phone"]').parentElement.style.display = 'none';
        if (nameField) nameField.removeAttribute('required');
        if (phoneField) phoneField.removeAttribute('required');
        
        // Show password and forgot password
        document.querySelector('label[for="password"]').parentElement.style.display = 'grid';
        forgotPasswordLink.style.display = 'block';
        
        // Clear the form
        loginForm.reset();
      } else {
        // Switch to signup mode
        formTitle.textContent = 'Trumpet Trainer';
        formSubtitle.textContent = 'Create your account to track high scores and compete with other players';
        submitButton.textContent = 'Create Account & Start Playing';
        passwordLabel.textContent = 'Password';
        passwordField.placeholder = 'Create a password';
        showLoginLink.textContent = 'Already have an account? Sign In';
        
        // Show name and phone fields and add required attribute
        const nameField = document.getElementById('name');
        const phoneField = document.getElementById('phone');
        document.querySelector('label[for="name"]').parentElement.style.display = 'grid';
        document.querySelector('label[for="phone"]').parentElement.style.display = 'grid';
        document.querySelector('label[for="password"]').parentElement.style.display = 'grid';
        forgotPasswordLink.style.display = 'block';
        if (nameField) nameField.setAttribute('required', 'required');
        if (phoneField) phoneField.setAttribute('required', 'required');
        
        // Clear the form
        loginForm.reset();
      }
  }

  // Check if user is already logged in and restore session
  async function checkExistingSession() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const supabaseClient = await getSupabase();
      if (!supabaseClient) return;
      
      // Get the current session
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error || !session) {
        console.log('No valid session found, clearing stored data');
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        return;
      }

      // Always restore user data if we have a valid session
      if (session.user) {
        const userData = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email,
          phone: session.user.user_metadata?.phone || ''
        };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('✅ Existing session restored:', userData);
      }
    } catch (error) {
      console.error('Error checking existing session:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
    }
  }

  // Store access token for API calls
  function setAuthTokenFromSession(session) {
    const accessToken = session?.access_token;
    if (accessToken) {
      localStorage.setItem('authToken', accessToken);
      
      // Also store the current user data for the leaderboard and game
      if (session.user) {
        const userData = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email,
          phone: session.user.user_metadata?.phone || ''
        };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('✅ User data stored:', userData);
      }
    }
  }

  // Form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('🎯 Form submitted! Current mode:', { isLoginMode, isResetMode });
      const formData = new FormData(loginForm);
      const email = formData.get('email');
      const password = formData.get('password');
      const name = formData.get('name');
      const phone = formData.get('phone');

      submitButton.textContent = isResetMode ? 'Sending...' : (isLoginMode ? 'Signing In...' : 'Creating Account...');
      submitButton.disabled = true;

      try {
        if (isResetMode) {
          const supabaseClient = await getSupabase();
          if (!supabaseClient) return alert('Supabase failed to load. Refresh and try again.');
          const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://trumpet-trainer.com/reset-password.html'
          });
          if (error) return alert(error.message || 'Password reset failed');
          alert('Password reset link sent to your email!');
          isResetMode = false;
          isLoginMode = true;
          toggleMode();
        } else if (isLoginMode) {
          const supabaseClient = await getSupabase();
          if (!supabaseClient) return alert('Supabase failed to load. Refresh and try again.');
          const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (error) return alert(error.message || 'Login failed');
          setAuthTokenFromSession(data.session);
          window.location.href = 'index.html';
        } else {
          console.log('🚀 Starting signup process...');
          const supabaseClient = await getSupabase();
          console.log('🔧 Supabase client:', supabaseClient);
          if (!supabaseClient) return alert('Supabase failed to load. Refresh and try again.');
          
          console.log('📧 Attempting signup with email:', email);
          // Create account via Supabase
          const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
              data: {
                name,
                phone
              },
              emailRedirectTo: 'https://trumpet-trainer.com/login.html'
            }
          });
          
          console.log('📨 Signup response:', { signUpData, signUpError });
          console.log('📨 Signup data details:', JSON.stringify(signUpData, null, 2));
          console.log('📨 Signup error details:', JSON.stringify(signUpError, null, 2));
          
          if (signUpError) {
            console.error('❌ Signup error:', signUpError);
            return alert(signUpError.message || 'Registration failed');
          }

          // Check if email confirmation is required
          if (signUpData.user && !signUpData.user.email_confirmed_at) {
            console.log('✅ Account created, email confirmation required');
            alert('Account created successfully! Please check your email and click the confirmation link before signing in.');
            // Switch to login mode so user can sign in after confirming email
            isLoginMode = true;
            toggleMode();
          } else {
            console.log('✅ Account created, email already confirmed');
            // If email is already confirmed (rare), proceed to login
            alert('Account created successfully! You can now sign in.');
            isLoginMode = true;
            toggleMode();
          }
        }
      } catch (err) {
        console.error(err);
        alert('Network error. Please try again.');
      } finally {
        submitButton.textContent = isResetMode ? 'Send Reset Link' : (isLoginMode ? 'Sign In & Play' : 'Create Account & Start Playing');
        submitButton.disabled = false;
      }
    });
  }

  // Toggle between signup and login
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMode();
    });
  }

  // Forgot password functionality
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      showResetForm();
    });
  }

  function showResetForm() {
    isResetMode = true;
    isLoginMode = false;
    formTitle.textContent = 'Reset Password';
    formSubtitle.textContent = 'Enter your email to receive a reset link';
    submitButton.textContent = 'Send Reset Link';
    
    // Hide all fields except email and remove required attributes
    const nameField = document.getElementById('name');
    const phoneField = document.getElementById('phone');
    const passwordField = document.getElementById('password');
    document.querySelector('label[for="name"]').parentElement.style.display = 'none';
    document.querySelector('label[for="phone"]').parentElement.style.display = 'none';
    document.querySelector('label[for="password"]').parentElement.style.display = 'none';
    if (nameField) nameField.removeAttribute('required');
    if (phoneField) phoneField.removeAttribute('required');
    if (passwordField) passwordField.removeAttribute('required');
    
    // Show back to login link
    showLoginLink.textContent = 'Back to Login';
    forgotPasswordLink.style.display = 'none';
  }

  // Theme toggle
  const themeToggle = document.createElement('button');
  themeToggle.textContent = '🌙';
  themeToggle.className = 'theme-toggle';
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    updateLogo();
    themeToggle.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
  });
  document.body.appendChild(themeToggle);
})(); 