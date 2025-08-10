(() => {
  // Initialize Supabase client
  const supabaseUrl = 'https://ooiowourmbkmhrhuaybl.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vaW93b3VybWJrbWhyaHVheWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzE1NjYsImV4cCI6MjA3MDIwNzU2Nn0.Jbv5EKbQ4TZmWP-mVZoXymguXXS_8Fw4Kgm0DM4GU0o';
  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase UMD not loaded on reset page.');
    alert('Loading error: Supabase library blocked. Refresh and try again.');
    return;
  }
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  const resetForm = document.getElementById('resetForm');
  const brandLogo = document.getElementById('brandLogo');

  // Mobile detection
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
  }

  function showMobileMessage() {
    const mobileMessage = document.getElementById('mobileMessage');
    const resetContainer = document.querySelector('.reset-container');
    
    if (mobileMessage && resetContainer) {
      mobileMessage.style.display = 'flex';
      resetContainer.style.display = 'none';
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

  // Handle password reset
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(resetForm);
      const newPassword = formData.get('newPassword');
      const confirmPassword = formData.get('confirmPassword');
      
      if (newPassword !== confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      if (newPassword.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
      }
      
      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        console.log('Reset page session:', session, sessionErr);
        // Update password using Supabase Auth (works when user arrived via magic link)
        const { data, error } = await supabase.auth.updateUser({ password: newPassword });
        console.log('Update user result:', { data, error });
        if (error) {
          alert(error.message || 'Failed to update password');
        } else {
          alert('Password updated successfully! You can now log in.');
          window.location.href = 'login.html';
        }
      } catch (error) {
        console.error('Password update error:', error);
        alert('Failed to update password. Please try again.');
      }
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