(() => {
  // Check if user is logged in
  const token = localStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // Cache for leaderboard data to prevent excessive API calls
  const leaderboardCache = new Map();
  const CACHE_DURATION = 30000; // 30 seconds

  // Current filters state
  let currentFilters = {
    difficulty: 'normal',
    time_mode: '60s'
  };

  // Theme handling
  function updateLogo() {
    const navLogo = document.getElementById('nav-logo');
    if (navLogo) {
      const dark = document.documentElement.classList.contains('dark');
      navLogo.src = dark ? 'Untitled design dark.svg' : 'Untitled design.svg';
    }
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

  // Load leaderboard with caching
  async function loadLeaderboard() {
    const cacheKey = `${currentFilters.difficulty}-${currentFilters.time_mode}`;
    const cached = leaderboardCache.get(cacheKey);
    
    // Check if we have recent cached data
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      displayLeaderboard(cached.data);
      return;
    }

    const content = document.getElementById('leaderboard-content');
    if (content) {
      content.innerHTML = '<div class="loading">Loading leaderboard...</div>';
    }
    
    try {
      // Use configuration to get the correct API base URL
      const baseUrl = window.appConfig ? window.appConfig.apiBaseUrl : 'http://localhost:3000/api';
      const url = new URL(`${baseUrl}/scores/leaderboard`);
      url.searchParams.set('mode', currentFilters.difficulty);
      url.searchParams.set('time_mode', currentFilters.time_mode);
      
      const response = await fetch(url.toString(), { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Cache the successful response
        leaderboardCache.set(cacheKey, {
          data: data.leaderboard,
          timestamp: Date.now()
        });
        displayLeaderboard(data.leaderboard);
      } else {
        const content = document.getElementById('leaderboard-content');
        if (content) {
          content.innerHTML = `<div class="error">Failed to load leaderboard</div>`;
        }
      }
    } catch (error) {
      console.error('Leaderboard error:', error);
      const content = document.getElementById('leaderboard-content');
      if (content) {
        content.innerHTML = '<div class="error">Network error. Please try again.</div>';
      }
    }
  }

  function displayLeaderboard(scores) {
    const content = document.getElementById('leaderboard-content');
    if (!content) return;

    const myLast = getLastScoreFor(currentFilters.difficulty, currentFilters.time_mode);
    
    if (!scores || scores.length === 0) {
      content.innerHTML = '<div class="no-data">No scores yet. Be the first to play!</div>';
      return;
    }

    const table = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Score</th>
            <th>Correct</th>
            <th>Accuracy</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${scores.map((score, index) => {
            const rank = index + 1;
            const isMe = myLast && Number(score.score) === Number(myLast.score);
            const rowClass = isMe ? 'my-score' : '';
            
            return `
              <tr class="${rowClass}" ${isMe ? 'style="outline: 2px solid var(--primary-teal); border-radius: 8px; background: rgba(32,156,189,0.08);"' : ''}>
                <td class="rank-cell rank-${rank}">${rank}</td>
                <td>${score.users?.name || 'Anonymous'}${isMe ? ' (You)' : ''}</td>
                <td class="score-cell">${score.score.toLocaleString()}</td>
                <td>${score.correct}</td>
                <td class="accuracy-cell">${score.accuracy}%</td>
                <td class="date-cell">${new Date(score.created_at).toLocaleDateString()}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    content.innerHTML = table;
  }

  // Filter event handlers
  function bindFilterEvents() {
    const difficultyFilter = document.getElementById('difficulty-filter');
    const timeFilter = document.getElementById('time-filter');
    
    if (difficultyFilter) {
      difficultyFilter.addEventListener('change', () => {
        currentFilters.difficulty = difficultyFilter.value;
        loadLeaderboard();
      });
    }
    
    if (timeFilter) {
      timeFilter.addEventListener('change', () => {
        currentFilters.time_mode = timeFilter.value;
        loadLeaderboard();
      });
    }
  }



  // Initialize page
  function initialize() {
    // Set initial filter values
    const difficultyFilter = document.getElementById('difficulty-filter');
    const timeFilter = document.getElementById('time-filter');
    
    if (difficultyFilter) {
      difficultyFilter.value = currentFilters.difficulty;
    }
    if (timeFilter) {
      timeFilter.value = currentFilters.time_mode;
    }

    // Bind events
    bindFilterEvents();
    
    // Load initial data
    loadLeaderboard();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})(); 