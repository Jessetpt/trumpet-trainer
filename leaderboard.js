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

  // Get current user ID for highlighting
  function getCurrentUserId() {
    try {
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        return user.id;
      }
    } catch (error) {
      console.error('Error parsing current user:', error);
    }
    return null;
  }

  // Initialize Supabase client
  function initSupabase() {
    try {
      console.log('🔍 Checking Supabase availability...');
      console.log('window.supabase:', typeof window.supabase);
      console.log('window.supabaseClient:', typeof window.supabaseClient);
      
      // Check if Supabase is available
      if (typeof window.supabase === 'undefined') {
        console.error('❌ Supabase client not loaded');
        return false;
      }

      // Get Supabase client from window.supabaseClient
      if (typeof window.supabaseClient === 'undefined' || typeof window.supabaseClient.get !== 'function') {
        console.error('❌ Supabase client wrapper not available');
        return false;
      }

      const supabase = window.supabaseClient.get();
      if (!supabase) {
        console.error('❌ Failed to get Supabase client');
        return false;
      }

      console.log('✅ Supabase client initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Supabase initialization error:', error);
      return false;
    }
  }

  // Wait for Supabase to be ready
  function waitForSupabase(maxAttempts = 10) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const checkSupabase = () => {
        attempts++;
        
        if (initSupabase()) {
          resolve(true);
          return;
        }
        
        if (attempts >= maxAttempts) {
          reject(new Error('Supabase failed to initialize after multiple attempts'));
          return;
        }
        
        // Wait 500ms before next attempt
        setTimeout(checkSupabase, 500);
      };
      
      checkSupabase();
    });
  }

  // Load leaderboard with caching and improved error handling
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
      // Wait for Supabase to be ready
      await waitForSupabase();

      // Get Supabase client
      const supabase = window.supabaseClient.get();
      if (!supabase) {
        throw new Error('Failed to get Supabase client');
      }

      // Test the connection by making a simple query
      console.log('🧪 Testing Supabase connection...');
      const { data: testData, error: testError } = await supabase
        .from('scores')
        .select('count', { count: 'exact', head: true })
        .limit(1);

      if (testError) {
        console.error('❌ Supabase connection test failed:', testError);
        throw new Error(`Database connection failed: ${testError.message}`);
      }

      console.log('✅ Supabase connection test successful');

      // Fetch leaderboard from Supabase with better error handling
      const { data, error } = await supabase
        .from('scores')
        .select(`
          score,
          correct,
          mistakes,
          best_streak,
          avg_response,
          accuracy,
          created_at,
          user_id,
          users!scores_user_id_fkey(name, email)
        `)
        .eq('mode', currentFilters.difficulty)
        .eq('time_mode', currentFilters.time_mode)
        .order('score', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Transform data to match expected format
      const leaderboardData = data.map(score => ({
        score: score.score,
        correct: score.correct,
        mistakes: score.mistakes,
        best_streak: score.best_streak,
        avg_response: score.avg_response,
        accuracy: score.accuracy,
        created_at: score.created_at,
        user_id: score.user_id,
        username: score.users?.name || score.users?.email || 'Anonymous'
      }));

      // Cache the successful response
      leaderboardCache.set(cacheKey, {
        data: leaderboardData,
        timestamp: Date.now()
      });
      
      displayLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Leaderboard error:', error);
      const content = document.getElementById('leaderboard-content');
      if (content) {
        let errorMessage = 'Failed to load leaderboard.';
        let errorDetails = '';
        
        if (error.message.includes('Supabase client not available')) {
          errorMessage = 'Supabase connection failed. Please refresh the page.';
          errorDetails = 'The database connection is not available.';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection.';
          errorDetails = 'Unable to connect to the server.';
        } else {
          errorDetails = error.message || 'Unknown error';
        }
        
        content.innerHTML = `
          <div class="error">
            <p>${errorMessage}</p>
            ${errorDetails ? `<p class="error-details">${errorDetails}</p>` : ''}
            <button onclick="loadLeaderboard()" class="retry-btn">Retry</button>
            <button onclick="location.reload()" class="retry-btn">Refresh Page</button>
          </div>
        `;
      }
    }
  }

  function displayLeaderboard(scores) {
    const content = document.getElementById('leaderboard-content');
    if (!content) return;

    const currentUserId = getCurrentUserId();
    
    if (!scores || scores.length === 0) {
      content.innerHTML = '<div class="no-data">No scores yet for this mode. Be the first to play!</div>';
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
            const isMe = currentUserId && score.user_id === currentUserId;
            const rowClass = isMe ? 'my-score' : '';
            
            return `
              <tr class="${rowClass}" ${isMe ? 'style="outline: 2px solid var(--primary-teal); border-radius: 8px; background: rgba(32,156,189,0.08);"' : ''}>
                <td class="rank-cell rank-${rank}">${rank}</td>
                <td>${score.username || 'Anonymous'}${isMe ? ' (You)' : ''}</td>
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