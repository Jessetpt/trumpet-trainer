(() => {
  // Check if user is logged in
  const token = localStorage.getItem('authToken');
  if (!token) {
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
      // Use configuration to get the correct API base URL
      const baseUrl = window.appConfig ? window.appConfig.apiBaseUrl : 'http://localhost:3000/api';
      const profileResponse = await fetch(`${baseUrl}/user/profile`, {
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

      // Get summary (total games + best score)
      const summaryResponse = await fetch(`${baseUrl}/scores/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (summaryResponse.ok) {
        const summary = await summaryResponse.json();
        displayStats(summary);
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

  function displayStats(summary) {
    const { bestScore, lastUpdated, totalGames } = summary;
    const best = bestScore ? Number(bestScore).toLocaleString() : 'No scores yet';
    const games = Number(totalGames || 0).toLocaleString();
    
    statsList.innerHTML = `
      <div class="stat-item">
        <div class="stat-label">Best Score</div>
        <div class="stat-value">${best}</div>
      </div>
      ${lastUpdated ? `
        <div class="stat-item">
          <div class="stat-label">Last Updated</div>
          <div class="stat-value">${new Date(lastUpdated).toLocaleDateString()}</div>
        </div>
      ` : ''}
      <div class="stat-item">
        <div class="stat-label">Games Played</div>
        <div class="stat-value">${games}</div>
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