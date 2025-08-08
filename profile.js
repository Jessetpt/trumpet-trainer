(() => {
  // Check if user is logged in
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  const userInfo = document.getElementById('userInfo');
  const statsList = document.getElementById('statsList');
  const backToGameBtn = document.getElementById('backToGame');
  const leaderboardBtn = document.getElementById('leaderboardBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const brandLogo = document.getElementById('brandLogo');

  // Theme handling
  function updateLogo() {
    if (!brandLogo) return;
    const dark = document.documentElement.classList.contains('dark');
    brandLogo.src = dark ? 'Untitled design dark.svg' : 'Untitled design.svg';
  }

  // Initialize theme
  updateLogo();

  // Load user profile
  async function loadProfile() {
    const token = localStorage.getItem('authToken');
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    try {
      // Get user profile
      const profileResponse = await fetch('http://localhost:3000/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        displayUserInfo(profileData.user);
      } else {
        userInfo.innerHTML = '<div class="error">Failed to load profile</div>';
      }

      // Get best score
      const scoreResponse = await fetch('http://localhost:3000/api/scores/best', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (scoreResponse.ok) {
        const scoreData = await scoreResponse.json();
        displayStats(scoreData);
      } else {
        statsList.innerHTML = '<div class="error">Failed to load statistics</div>';
      }
    } catch (error) {
      console.error('Profile error:', error);
      userInfo.innerHTML = '<div class="error">Network error. Please try again.</div>';
    }
  }

  function displayUserInfo(user) {
    userInfo.innerHTML = `
      <div class="user-details">
        <div class="user-name">${user.name}</div>
        <div class="user-email">${user.email}</div>
        <div class="user-phone">${user.phone}</div>
        <div class="user-joined">Member since ${new Date(user.created_at).toLocaleDateString()}</div>
      </div>
    `;
  }

  function displayStats(scoreData) {
    const { bestScore, lastUpdated } = scoreData;
    
    statsList.innerHTML = `
      <div class="stat-item">
        <div class="stat-label">Best Score</div>
        <div class="stat-value">${bestScore ? bestScore.toLocaleString() : 'No scores yet'}</div>
      </div>
      ${lastUpdated ? `
        <div class="stat-item">
          <div class="stat-label">Last Updated</div>
          <div class="stat-value">${new Date(lastUpdated).toLocaleDateString()}</div>
        </div>
      ` : ''}
      <div class="stat-item">
        <div class="stat-label">Games Played</div>
        <div class="stat-value">${bestScore ? 'At least 1' : '0'}</div>
      </div>
    `;
  }

  // Navigation
  if (backToGameBtn) {
    backToGameBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
      window.location.href = 'leaderboard.html';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      window.location.href = 'login.html';
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

  // Load profile on page load
  loadProfile();
})(); 