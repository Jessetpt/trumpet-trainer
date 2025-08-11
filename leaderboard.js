(() => {
  // Cache for leaderboard data to prevent excessive API calls
  const leaderboardCache = new Map();
  const CACHE_DURATION = 30000; // 30 seconds

  // Current filters state
  let currentFilters = {
    difficulty: 'normal',
    time_mode: '60s'
  };

  // Theme handling - let theme.js handle this to avoid conflicts
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

  // Simplified authentication check
  async function checkAuthentication() {
    console.log('🔐 Checking authentication...');
    
    // Check if user is already logged in
    const token = localStorage.getItem('authToken');
    if (token) {
      console.log('✅ Auth token found, proceeding with leaderboard');
      return true;
    }

    // Try to restore session from Supabase
    try {
      await waitForSupabase();
      const supabase = window.supabaseClient.get();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          // Session exists, restore user data
          const userData = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email,
            phone: session.user.user_metadata?.phone || ''
          };
          localStorage.setItem('currentUser', JSON.stringify(userData));
          localStorage.setItem('authToken', session.access_token);
          console.log('✅ Session restored in leaderboard.js:', userData);
          return true;
        }
      }
    } catch (error) {
      console.error('Error restoring session:', error);
    }
    
    // No valid session, redirect to login
    console.log('🔐 No valid session found, redirecting to login');
    window.location.href = 'login.html';
    return false;
  }

  // Wait for Supabase to be ready
  function waitForSupabase(maxAttempts = 30) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const checkSupabase = () => {
        attempts++;
        
        if (typeof window.supabaseClient !== 'undefined' && 
            typeof window.supabaseClient.get === 'function' && 
            window.supabaseClient.isReady && 
            window.supabaseClient.isReady()) {
          console.log('✅ Supabase client ready');
          resolve(true);
          return;
        }
        
        if (attempts >= maxAttempts) {
          reject(new Error('Supabase failed to initialize after multiple attempts'));
          return;
        }
        
        setTimeout(checkSupabase, 300);
      };
      
      checkSupabase();
    });
  }

  // Test Supabase connection
  async function testSupabaseConnection() {
    try {
      console.log('🧪 Testing Supabase connection...');
      
      await waitForSupabase();
      const supabase = window.supabaseClient.get();
      if (!supabase) {
        throw new Error('Failed to get Supabase client');
      }

      // Test basic connection
      const { data: testData, error: testError } = await supabase
        .from('scores')
        .select('count', { count: 'exact', head: true })
        .limit(1);

      if (testError) {
        console.error('❌ Connection test failed:', testError);
        return false;
      }

      console.log('✅ Supabase connection successful');
      return true;
    } catch (error) {
      console.error('❌ Supabase test failed:', error);
      return false;
    }
  }

  // Load leaderboard with improved error handling
  async function loadLeaderboard() {
    console.log('🚀 Loading leaderboard...');
    console.log('📊 Current filters:', currentFilters);
    
    const cacheKey = `${currentFilters.difficulty}-${currentFilters.time_mode}`;
    const cached = leaderboardCache.get(cacheKey);
    
    // Check if we have recent cached data
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('💾 Using cached leaderboard data');
      displayLeaderboard(cached.data);
      return;
    }

    const content = document.getElementById('leaderboard-content');
    if (content) {
      content.innerHTML = '<div class="loading">Loading leaderboard...</div>';
    }
    
    try {
      await waitForSupabase();
      const supabase = window.supabaseClient.get();
      if (!supabase) {
        throw new Error('Database connection not available');
      }

      // Fetch leaderboard data
      console.log('📥 Fetching leaderboard data...');
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
          game_mode,
          time_mode
        `)
        .eq('game_mode', currentFilters.difficulty)
        .eq('time_mode', currentFilters.time_mode)
        .order('score', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log(`✅ Successfully fetched ${data.length} scores`);
      
      // Transform data for display
      const leaderboardData = data.map(score => {
        let username = 'Anonymous';
        const currentUserId = getCurrentUserId();
        
        if (currentUserId && score.user_id === currentUserId) {
          try {
            const currentUser = localStorage.getItem('currentUser');
            if (currentUser) {
              const user = JSON.parse(currentUser);
              username = user.name || user.email || 'You';
            }
          } catch (error) {
            console.error('Error parsing current user:', error);
          }
        } else {
          username = `Player ${score.user_id.slice(0, 8)}`;
        }
        
        return {
          score: score.score,
          correct: score.correct,
          mistakes: score.mistakes,
          best_streak: score.best_streak,
          avg_response: score.avg_response,
          accuracy: score.accuracy,
          created_at: score.created_at,
          user_id: score.user_id,
          username: username
        };
      });

      // Cache the successful response
      leaderboardCache.set(cacheKey, {
        data: leaderboardData,
        timestamp: Date.now()
      });
      
      displayLeaderboard(leaderboardData);
    } catch (error) {
      console.error('❌ Leaderboard error:', error);
      const content = document.getElementById('leaderboard-content');
      if (content) {
        let errorMessage = 'Failed to load leaderboard.';
        let errorDetails = '';
        
        if (error.message.includes('permission') || error.message.includes('JWT')) {
          errorMessage = 'Please log in to view the leaderboard.';
          errorDetails = 'Your session may have expired.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection.';
          errorDetails = 'Unable to connect to the server.';
        } else if (error.message.includes('Database connection not available')) {
          errorMessage = 'Database connection failed.';
          errorDetails = 'Please refresh the page and try again.';
        } else {
          errorDetails = error.message || 'Unknown error occurred';
        }
        
        content.innerHTML = `
          <div class="error">
            <p>${errorMessage}</p>
            ${errorDetails ? `<p class="error-details">${errorDetails}</p>` : ''}
            <div class="error-actions">
              <button onclick="loadLeaderboard()" class="retry-btn">🔄 Try Again</button>
              <button onclick="location.reload()" class="retry-btn">🔄 Refresh Page</button>
            </div>
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
      let message = 'No scores yet for this mode. Be the first to play!';
      
      if (currentUserId) {
        message = `No scores yet for ${currentFilters.difficulty} mode with ${currentFilters.time_mode} time limit. Play a game to see your score here!`;
      } else {
        message = 'No scores yet for this mode. Please log in to play and see your scores!';
      }
      
      content.innerHTML = `
        <div class="no-data">
          <p>${message}</p>
          ${currentUserId ? '<a href="index.html" class="play-btn">🎮 Play Now</a>' : '<a href="login.html" class="play-btn">🔐 Log In</a>'}
        </div>
      `;
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
  async function initialize() {
    console.log('🚀 Initializing leaderboard page...');
    
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
    
    try {
      // Check authentication first
      const isAuthenticated = await checkAuthentication();
      if (!isAuthenticated) {
        return; // User will be redirected to login
      }
      
      // Test database connection
      const connectionSuccess = await testSupabaseConnection();
      if (connectionSuccess) {
        console.log('✅ Database connection successful, loading leaderboard...');
        loadLeaderboard();
      } else {
        console.error('❌ Database connection failed');
        const content = document.getElementById('leaderboard-content');
        if (content) {
          content.innerHTML = `
            <div class="error">
              <p>Unable to connect to the database.</p>
              <p class="error-details">Please check your connection and try again.</p>
              <div class="error-actions">
                <button onclick="location.reload()" class="retry-btn">🔄 Refresh Page</button>
                <button onclick="loadLeaderboard()" class="retry-btn">🔄 Try Again</button>
              </div>
            </div>
          `;
        }
      }
    } catch (error) {
      console.error('❌ Initialization error:', error);
      const content = document.getElementById('leaderboard-content');
      if (content) {
        content.innerHTML = `
          <div class="error">
            <p>Failed to initialize the leaderboard.</p>
            <p class="error-details">${error.message}</p>
            <div class="error-actions">
              <button onclick="location.reload()" class="retry-btn">🔄 Refresh Page</button>
            </div>
          </div>
        `;
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // Add global test function for debugging
  window.testLeaderboardConnection = async function() {
    console.log('🧪 Testing leaderboard connection...');
    try {
      const success = await testSupabaseConnection();
      console.log('✅ Connection test result:', success);
      return success;
    } catch (error) {
      console.error('❌ Connection test error:', error);
      return false;
    }
  };
})(); 