(() => {
  // Check if user is logged in
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  const leaderboardList = document.getElementById('leaderboardList');
  const backToGameBtn = document.getElementById('backToGame');
  const profileBtn = document.getElementById('profileBtn');
  const brandLogo = document.getElementById('brandLogo');

  // Theme handling
  function updateLogo() {
    if (!brandLogo) return;
    const dark = document.documentElement.classList.contains('dark');
    brandLogo.src = dark ? 'Untitled design dark.svg' : 'Untitled design.svg';
  }

  // Initialize theme
  updateLogo();

  // Load leaderboard
  async function loadLeaderboard() {
    try {
      const response = await fetch('http://localhost:3000/api/scores/leaderboard');
      const data = await response.json();
      
      if (response.ok) {
        displayLeaderboard(data.leaderboard);
      } else {
        leaderboardList.innerHTML = '<div class="error">Failed to load leaderboard</div>';
      }
    } catch (error) {
      console.error('Leaderboard error:', error);
      leaderboardList.innerHTML = '<div class="error">Network error. Please try again.</div>';
    }
  }

  function displayLeaderboard(scores) {
    if (!scores || scores.length === 0) {
      leaderboardList.innerHTML = '<div class="empty">No scores yet. Be the first to play!</div>';
      return;
    }

    leaderboardList.innerHTML = '';
    
    scores.forEach((score, index) => {
      const entry = document.createElement('div');
      entry.className = 'leaderboard-entry';
      
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      
      entry.innerHTML = `
        <div class="rank">${medal}</div>
        <div class="player-info">
          <div class="player-name">${score.users.name}</div>
          <div class="score-details">
            <span class="score">${score.score.toLocaleString()}</span>
            <span class="accuracy">${score.accuracy}% accuracy</span>
            <span class="correct">${score.correct} correct</span>
          </div>
        </div>
        <div class="date">${new Date(score.created_at).toLocaleDateString()}</div>
      `;
      
      leaderboardList.appendChild(entry);
    });
  }

  // Navigation
  if (backToGameBtn) {
    backToGameBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      window.location.href = 'profile.html';
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

  // Load leaderboard on page load
  loadLeaderboard();
})(); 