(() => {
  const loginForm = document.getElementById('loginForm');
  const showLoginLink = document.getElementById('showLogin');
  const brandLogo = document.getElementById('brandLogo');
  const formTitle = document.querySelector('.login-card h1');
  const formSubtitle = document.querySelector('.login-card .subtitle');
  const submitButton = document.querySelector('.cta');
  const passwordField = document.getElementById('password');
  const passwordLabel = document.querySelector('label[for="password"]');

  let isLoginMode = false;

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
    
    if (isLoginMode) {
      // Switch to login mode
      formTitle.textContent = 'Welcome Back';
      formSubtitle.textContent = 'Sign in to continue your trumpet training';
      submitButton.textContent = 'Sign In & Play';
      passwordLabel.textContent = 'Password';
      passwordField.placeholder = 'Enter your password';
      showLoginLink.textContent = 'Create new account';
      
      // Hide name and phone fields
      document.querySelector('label[for="name"]').parentElement.style.display = 'none';
      document.querySelector('label[for="phone"]').parentElement.style.display = 'none';
      
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
      
      // Show name and phone fields
      document.querySelector('label[for="name"]').parentElement.style.display = 'grid';
      document.querySelector('label[for="phone"]').parentElement.style.display = 'grid';
      
      // Clear the form
      loginForm.reset();
    }
  }

  // Form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(loginForm);
      const userData = {
        email: formData.get('email'),
        password: formData.get('password')
      };
      
      if (!isLoginMode) {
        // Signup mode - include all fields
        userData.name = formData.get('name');
        userData.phone = formData.get('phone');
      }
      
      // Show loading state
      submitButton.textContent = isLoginMode ? 'Signing In...' : 'Creating Account...';
      submitButton.disabled = true;
      
      try {
        if (isLoginMode) {
          // Login logic
          const response = await fetch('http://localhost:3000/api/auth/login', {
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
        // Reset button state
        submitButton.textContent = isLoginMode ? 'Sign In & Play' : 'Create Account & Start Playing';
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