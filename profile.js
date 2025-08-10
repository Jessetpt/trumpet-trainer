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
      // Get Supabase client
      const supabase = window.supabaseClient.get();
      if (!supabase) {
        throw new Error('Supabase not available');
      }

      // Get user profile from Supabase
      const { data: { user }, error: profileError } = await supabase.auth.getUser();
      
      if (profileError) {
        throw profileError;
      }

      if (user) {
        displayUserInfo(user);
      } else {
        userInfo.innerHTML = '<div class="error">Failed to load profile</div>';
      }

      // Get summary (total games + best score) from Supabase
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('score, created_at')
        .eq('user_id', user.id)
        .order('score', { ascending: false });

      if (scoresError) {
        throw scoresError;
      }

      const summary = {
        bestScore: scores.length > 0 ? scores[0].score : null,
        lastUpdated: scores.length > 0 ? scores[0].created_at : null,
        totalGames: scores.length
      };

      displayStats(summary);
    } catch (error) {
      console.error('Profile error:', error);
      userInfo.innerHTML = '<div class="error">Network error. Please try again.</div>';
    }
  }

  function displayUserInfo(user) {
    userInfo.innerHTML = `
      <div class="user-details">
        <div class="user-name">${user.user_metadata?.full_name || user.email || 'User'}</div>
        <div class="user-email">${user.email}</div>
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
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    // Set initial theme icon
    const isDark = document.documentElement.classList.contains('dark');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    
    themeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      updateLogo();
      themeToggle.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
    });
  }

  // Load profile on page load
  loadProfile();
})(); 