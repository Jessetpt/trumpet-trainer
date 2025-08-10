(() => {
  // Check if user is logged in
  const token = localStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const leaderboardList = document.getElementById('leaderboardList');
  const backToGameBtn = document.getElementById('backToGame');
  const profileBtn = document.getElementById('profileBtn');
  const brandLogo = document.getElementById('brandLogo');
  const modeSelect = document.getElementById('mode');
  const timeModeSelect = document.getElementById('timeMode');

  // Theme handling
  function updateLogo() {
    if (!brandLogo) return;
    const dark = document.documentElement.classList.contains('dark');
    brandLogo.src = dark ? 'Untitled design dark.svg' : 'Untitled design.svg';
  }

  // Initialize theme
  updateLogo();
  
  // Check for saved theme preference and apply it
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }

  function getLastScoreFor(mode, timeMode) {
    try {
      const raw = localStorage.getItem('lastScore');
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj && obj.mode === mode && (!timeMode || obj.time_mode === timeMode)) return obj;
    } catch {}
    return null;
  }

  // Load leaderboard
  async function loadLeaderboard(mode, timeMode) {
    leaderboardList.innerHTML = '<div class="loading">Loading leaderboard...</div>';
    try {
      // Use configuration to get the correct API base URL
      const baseUrl = window.appConfig ? window.appConfig.apiBaseUrl : 'http://localhost:3000/api';
      const url = new URL(`${baseUrl}/scores/leaderboard`);
      url.searchParams.set('mode', mode);
      url.searchParams.set('time_mode', timeMode);
      url.searchParams.set('_t', Date.now().toString());
      const response = await fetch(url.toString(), { cache: 'no-store' });
      const data = await response.json();
      
      if (response.ok) {
        displayLeaderboard(data.leaderboard, mode, timeMode);
      } else {
        leaderboardList.innerHTML = `<div class="error">${data.error || 'Failed to load leaderboard'}</div>`;
      }
    } catch (error) {
      console.error('Leaderboard error:', error);
      leaderboardList.innerHTML = '<div class="error">Network error. Please try again.</div>';
    }
  }

  function displayLeaderboard(scores, mode, timeMode) {
    const myLast = getLastScoreFor(mode, timeMode);
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

      const isMe = myLast && Number(score.score) === Number(myLast.score);
      if (isMe) entry.style.cssText = 'outline: 2px solid var(--accent); border-radius: 10px; background: rgba(32,156,189,0.08)';
      
      entry.innerHTML = `
        <div class="rank">${medal}</div>
        <div class="player-info">
          <div class="player-name">${score.users.name}${isMe ? ' (You)' : ''}</div>
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

  function reload() {
    const mode = modeSelect ? modeSelect.value : 'normal';
    const timeMode = timeModeSelect ? timeModeSelect.value : '60s';
    loadLeaderboard(mode, timeMode);
  }

  if (modeSelect) {
    modeSelect.addEventListener('change', reload);
  }
  if (timeModeSelect) {
    timeModeSelect.addEventListener('change', reload);
  }



  // Load leaderboard on page load
  reload();
})(); 