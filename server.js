const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
// In development, disable CSP to allow external CDNs like jsdelivr and Supabase
if ((process.env.NODE_ENV || 'development') === 'development') {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );
} else {
  app.use(helmet());
}
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
// Prevent caching of API responses
app.use('/api/', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Auth middleware - verify Supabase access token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = { userId: data.user.id, email: data.user.email };
    next();
  } catch (err) {
    console.error('Auth verify error:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// User registration (creates Supabase Auth user and profile row)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Create user in Supabase Auth (auto-confirm email for local/dev)
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone }
    });
    if (createErr) {
      if (createErr.message?.includes('already registered')) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }
      console.error('Auth create user error:', createErr);
      return res.status(500).json({ error: 'Failed to create auth user' });
    }

    const authUser = created.user;

    // Hash password for legacy column (not used for auth)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Upsert profile in users table with id matching auth.uid()
    const { data: profile, error: upsertErr } = await supabase
      .from('users')
      .upsert({
        id: authUser.id,
        name,
        email,
        phone,
        password: hashedPassword,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select('id, name, email, phone, created_at')
      .single();

    if (upsertErr) {
      console.error('Profile upsert error:', upsertErr);
      return res.status(500).json({ error: 'Failed to save profile' });
    }

    res.status(201).json({
      message: 'Account created',
      user: profile
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deprecated custom login kept for compatibility (not used with Supabase Auth)
app.post('/api/auth/login', async (req, res) => {
  return res.status(400).json({ error: 'Use Supabase Auth login on the client.' });
});

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, created_at')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save high score
app.post('/api/scores', authenticateToken, async (req, res) => {
  try {
    const { score, correct, mistakes, bestStreak, avgResponse, accuracy, mode, time_mode, run_id } = req.body;

    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }
    if (!run_id || typeof run_id !== 'string') {
      return res.status(400).json({ error: 'run_id is required' });
    }

    const allowedModes = new Set(['normal','lead','hard','doublec','ultra']);
    const modeValue = (typeof mode === 'string' ? mode.toLowerCase() : 'normal');
    if (!allowedModes.has(modeValue)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }

    const allowedTime = new Set(['30s','60s','120s','infinite','increment']);
    const timeModeValue = (typeof time_mode === 'string' ? time_mode.toLowerCase() : '60s');
    const finalTimeMode = allowedTime.has(timeModeValue) ? timeModeValue : '60s';

    // Insert with time_mode and mode columns
    let insertReq = await supabase
      .from('scores')
      .insert([
        {
          user_id: req.user.userId,
          score,
          correct,
          mistakes,
          best_streak: bestStreak,
          avg_response: avgResponse,
          accuracy,
          mode: modeValue,
          time_mode: finalTimeMode,
          run_id,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    let saved = insertReq.data;

    if (insertReq.error) {
      const text = String(insertReq.error.message || '').toLowerCase();
      const isConflict = text.includes('duplicate key') || text.includes('unique');

      if (isConflict) {
        const existing = await supabase
          .from('scores')
          .select('*')
          .eq('user_id', req.user.userId)
          .eq('run_id', run_id)
          .single();
        if (existing.error) return res.status(500).json({ error: 'Failed to save score' });
        saved = existing.data;
      } else {
        console.error('Supabase error:', insertReq.error);
        return res.status(500).json({ error: 'Failed to save score' });
      }
    }

    res.status(201).json({ message: 'Score saved successfully', score: saved });

  } catch (error) {
    console.error('Save score error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's best score
app.get('/api/scores/best', authenticateToken, async (req, res) => {
  try {
    const { mode, time_mode } = req.query;
    let query = supabase
      .from('scores')
      .select('score, created_at')
      .eq('user_id', req.user.userId)
      .order('score', { ascending: false })
      .limit(1)
      .single();

    // Filter by mode and time_mode if provided
    if (mode) {
      query = query.eq('mode', String(mode).toLowerCase());
    }
    if (time_mode) {
      query = query.eq('time_mode', String(time_mode).toLowerCase());
    }

    const { data: bestScore, error } = await query;

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to get best score' });
    }

    res.json({
      bestScore: bestScore ? bestScore.score : 0,
      lastUpdated: bestScore ? bestScore.created_at : null
    });

  } catch (error) {
    console.error('Get best score error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's score summary (total games + best score)
app.get('/api/scores/summary', authenticateToken, async (req, res) => {
  try {
    // Total games played
    const { count, error: totalErr } = await supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.userId);
    if (totalErr) {
      console.error('Supabase total games error:', totalErr);
      return res.status(500).json({ error: 'Failed to get total games' });
    }

    // Best score overall
    const { data: bestScore, error: bestErr } = await supabase
      .from('scores')
      .select('score, created_at')
      .eq('user_id', req.user.userId)
      .order('score', { ascending: false })
      .limit(1)
      .single();
    if (bestErr && bestErr.code !== 'PGRST116') {
      console.error('Supabase best score error:', bestErr);
      return res.status(500).json({ error: 'Failed to get best score' });
    }

    res.json({
      totalGames: typeof count === 'number' ? count : 0,
      bestScore: bestScore ? bestScore.score : 0,
      lastUpdated: bestScore ? bestScore.created_at : null
    });
  } catch (e) {
    console.error('Score summary error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leaderboard (require mode and time_mode)
app.get('/api/scores/leaderboard', async (req, res) => {
  try {
    const allowedModes = new Set(['normal','lead','hard','doublec','ultra']);
    const { mode, time_mode } = req.query;
    const requested = String(mode || '').toLowerCase();
    const timeFilter = String(time_mode || '').toLowerCase();
    if (!requested || !allowedModes.has(requested)) {
      return res.status(400).json({ error: 'mode query param required: normal|lead|hard|doublec|ultra' });
    }
    if (!timeFilter) {
      return res.status(400).json({ error: 'time_mode query param required: 30s|60s|120s|infinite|increment' });
    }

    // Filter by mode and time_mode columns
    let { data: leaderboard, error } = await supabase
      .from('scores')
      .select(`
        score,
        correct,
        accuracy,
        created_at,
        users!inner(name)
      `)
      .eq('mode', requested)
      .eq('time_mode', timeFilter)
      .order('score', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to get leaderboard' });
    }

    res.json({ leaderboard });

  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});











// Start server
app.listen(PORT, () => {
  console.log(`🚀 Trumpet Trainer server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 