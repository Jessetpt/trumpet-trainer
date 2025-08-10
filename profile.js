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

  // Load user profile with improved error handling
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

      // Get current user from localStorage first (more reliable)
      const currentUser = localStorage.getItem('currentUser');
      if (!currentUser) {
        throw new Error('User session not found');
      }

      const user = JSON.parse(currentUser);
      if (!user || !user.id) {
        throw new Error('Invalid user data');
      }

      // Display user info immediately
      displayUserInfo(user);

      // Get comprehensive stats from Supabase
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select(`
          score,
          correct,
          mistakes,
          best_streak,
          avg_response,
          accuracy,
          mode,
          time_mode,
          created_at
        `)
        .eq('user_id', user.id)
        .order('score', { ascending: false });

      if (scoresError) {
        console.error('Scores error:', scoresError);
        throw scoresError;
      }

      // Calculate comprehensive statistics
      const stats = calculateComprehensiveStats(scores || []);
      displayStats(stats);

    } catch (error) {
      console.error('Profile error:', error);
      userInfo.innerHTML = '<div class="error">Failed to load profile. Please try refreshing the page.</div>';
      statsList.innerHTML = '<div class="error">Failed to load statistics.</div>';
    }
  }

  function displayUserInfo(user) {
    const displayName = user.user_metadata?.full_name || user.email || 'User';
    const email = user.email || 'No email';
    const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown';
    
    userInfo.innerHTML = `
      <div class="user-details">
        <div class="user-name">${displayName}</div>
        <div class="user-email">${email}</div>
        <div class="user-joined">Member since ${joinDate}</div>
      </div>
    `;
  }

  function calculateComprehensiveStats(scores) {
    if (!scores || scores.length === 0) {
      return {
        totalGames: 0,
        bestScore: null,
        bestScoreMode: null,
        bestScoreTime: null,
        averageScore: 0,
        totalCorrect: 0,
        totalMistakes: 0,
        averageAccuracy: 0,
        lastPlayed: null,
        modeBreakdown: {}
      };
    }

    // Calculate overall stats
    const totalGames = scores.length;
    const bestScore = Math.max(...scores.map(s => s.score));
    const bestScoreEntry = scores.find(s => s.score === bestScore);
    const averageScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / totalGames);
    const totalCorrect = scores.reduce((sum, s) => sum + (s.correct || 0), 0);
    const totalMistakes = scores.reduce((sum, s) => sum + (s.mistakes || 0), 0);
    const averageAccuracy = Math.round(scores.reduce((sum, s) => sum + (s.accuracy || 0), 0) / totalGames);
    const lastPlayed = new Date(Math.max(...scores.map(s => new Date(s.created_at))));

    // Calculate mode breakdown
    const modeBreakdown = {};
    scores.forEach(score => {
      const key = `${score.mode}-${score.time_mode}`;
      if (!modeBreakdown[key]) {
        modeBreakdown[key] = {
          mode: score.mode,
          timeMode: score.time_mode,
          games: 0,
          bestScore: 0,
          averageScore: 0
        };
      }
      
      modeBreakdown[key].games++;
      modeBreakdown[key].bestScore = Math.max(modeBreakdown[key].bestScore, score.score);
      modeBreakdown[key].averageScore += score.score;
    });

    // Calculate averages for each mode
    Object.values(modeBreakdown).forEach(mode => {
      mode.averageScore = Math.round(mode.averageScore / mode.games);
    });

    return {
      totalGames,
      bestScore,
      bestScoreMode: bestScoreEntry?.mode || null,
      bestScoreTime: bestScoreEntry?.time_mode || null,
      averageScore,
      totalCorrect,
      totalMistakes,
      averageAccuracy,
      lastPlayed,
      modeBreakdown
    };
  }

  function displayStats(stats) {
    const { 
      totalGames, 
      bestScore, 
      bestScoreMode, 
      bestScoreTime, 
      averageScore, 
      totalCorrect, 
      totalMistakes, 
      averageAccuracy, 
      lastPlayed,
      modeBreakdown 
    } = stats;

    if (totalGames === 0) {
      statsList.innerHTML = `
        <div class="stat-item">
          <div class="stat-label">No Games Yet</div>
          <div class="stat-value">Play your first game to see stats!</div>
        </div>
      `;
      return;
    }

    let statsHTML = `
      <div class="stat-item">
        <div class="stat-label">Total Games</div>
        <div class="stat-value">${totalGames.toLocaleString()}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Best Score</div>
        <div class="stat-value">${bestScore.toLocaleString()}</div>
        ${bestScoreMode && bestScoreTime ? `<div class="stat-detail">${bestScoreMode} - ${bestScoreTime}</div>` : ''}
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Average Score</div>
        <div class="stat-value">${averageScore.toLocaleString()}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Total Correct</div>
        <div class="stat-value">${totalCorrect.toLocaleString()}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Total Mistakes</div>
        <div class="stat-value">${totalMistakes.toLocaleString()}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Average Accuracy</div>
        <div class="stat-value">${averageAccuracy}%</div>
      </div>
    `;

    // Add last played date if available
    if (lastPlayed) {
      statsHTML += `
        <div class="stat-item">
          <div class="stat-label">Last Played</div>
          <div class="stat-value">${lastPlayed.toLocaleDateString()}</div>
        </div>
      `;
    }

    // Add mode breakdown if there are multiple modes
    const modeKeys = Object.keys(modeBreakdown);
    if (modeKeys.length > 1) {
      statsHTML += `
        <div class="stat-item stat-breakdown">
          <div class="stat-label">Mode Breakdown</div>
          <div class="stat-value">
            ${modeKeys.map(key => {
              const mode = modeBreakdown[key];
              return `${mode.mode} ${mode.timeMode}: ${mode.games} games, best: ${mode.bestScore.toLocaleString()}`;
            }).join('<br>')}
          </div>
        </div>
      `;
    }

    statsList.innerHTML = statsHTML;
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