(() => {
  // Initialize Supabase client
  const supabaseUrl = 'https://ooiowourmbkmhrhuaybl.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vaW93b3VybWJrbWhyaHVheWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzE1NjYsImV4cCI6MjA3MDIwNzU2Nn0.Jbv5EKbQ4TZmWP-mVZoXymguXXS_8Fw4Kgm0DM4GU0o';
  let supabase = null;
  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase UMD not loaded. Check CSP and CDN include.');
  } else {
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
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

  // Store access token for API calls
  function setAuthTokenFromSession(session) {
    const accessToken = session?.access_token;
    if (accessToken) {
      localStorage.setItem('authToken', accessToken);
    }
  }

  // Form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      const email = formData.get('email');
      const password = formData.get('password');
      const name = formData.get('name');
      const phone = formData.get('phone');

      submitButton.textContent = isResetMode ? 'Sending...' : (isLoginMode ? 'Signing In...' : 'Creating Account...');
      submitButton.disabled = true;

      try {
        if (isResetMode) {
          if (!supabase) return alert('Supabase failed to load. Refresh and try again.');
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
          });
          if (error) return alert(error.message || 'Password reset failed');
          alert('Password reset link sent to your email!');
          isResetMode = false;
          isLoginMode = true;
          toggleMode();
        } else if (isLoginMode) {
          if (!supabase) return alert('Supabase failed to load. Refresh and try again.');
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) return alert(error.message || 'Login failed');
          setAuthTokenFromSession(data.session);
          window.location.href = 'index.html';
        } else {
          if (!supabase) return alert('Supabase failed to load. Refresh and try again.');
          // Create account directly via Supabase
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name,
                phone
              }
            }
          });
          
          if (signUpError) return alert(signUpError.message || 'Registration failed');

          // Immediately sign in to obtain access token
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) return alert(error.message || 'Auto login failed');
          setAuthTokenFromSession(data.session);
          window.location.href = 'index.html';
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