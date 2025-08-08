(() => {
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

  // Form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Form submitted!'); // Debug log
      
      const formData = new FormData(loginForm);
      const userData = {
        email: formData.get('email'),
        password: formData.get('password')
      };
      
      console.log('Form data:', userData); // Debug log
      
      if (!isLoginMode) {
        // Signup mode - include all fields
        userData.name = formData.get('name');
        userData.phone = formData.get('phone');
      }
      
      // Show loading state
      submitButton.textContent = isLoginMode ? 'Signing In...' : 'Creating Account...';
      submitButton.disabled = true;
      console.log('Starting authentication...'); // Debug log
      
      try {
        if (isResetMode) {
          // Password reset logic
          const response = await fetch('http://localhost:3000/api/auth/forgot-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: userData.email })
          });
          
          const data = await response.json();
          
          if (response.ok) {
            alert(`Password reset link sent! Token: ${data.resetToken}\n\nIn production, this would be sent via email.`);
            // Reset form back to login
            toggleMode();
          } else {
            alert(data.error || 'Password reset failed');
          }
        } else if (isLoginMode) {
          // Login logic
          console.log('Attempting login with:', userData);
          const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
          });
          
          const data = await response.json();
          console.log('Login response:', data);
          
          if (response.ok) {
            // Store user data and token
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            localStorage.setItem('authToken', data.token);
            window.location.href = 'index.html';
          } else {
            alert(data.error || 'Login failed');
          }
        } else {
          // Signup logic
          const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            // Store user data and token
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            localStorage.setItem('authToken', data.token);
            window.location.href = 'index.html';
          } else {
            alert(data.error || 'Registration failed');
          }
        }
              } catch (error) {
          console.error('Auth error:', error);
          alert('Network error. Please try again.');
        } finally {
          console.log('Authentication attempt completed'); // Debug log
        // Reset button state
        if (isResetMode) {
          submitButton.textContent = 'Send Reset Link';
        } else {
          submitButton.textContent = isLoginMode ? 'Sign In & Play' : 'Create Account & Start Playing';
        }
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