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

// Analytics: bulk insert note events
app.post('/api/analytics/note_events', authenticateToken, async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array required' });
    }
    // Prepare rows
    const rows = events.map((e) => ({
      user_id: req.user.userId,
      run_id: e.run_id,
      midi: e.midi,
      spelling: e.spelling,
      correct: !!e.correct,
      response_ms: Math.max(0, parseInt(e.response_ms || 0, 10)),
      game_mode: e.game_mode || 'normal',
      time_mode: e.time_mode || '60s',
      created_at: new Date().toISOString()
    }));

    // Try to insert into note_events; fall back to create-table guidance if needed
    const { error } = await supabase.from('note_events').insert(rows);
    if (error) {
      console.error('Insert note_events error:', error);
      return res.status(500).json({ error: 'Failed to save note events' });
    }
    res.json({ ok: true, inserted: rows.length });
  } catch (err) {
    console.error('note_events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics: per-note averages for current user
app.get('/api/analytics/note-averages', authenticateToken, async (req, res) => {
  try {
    const { game_mode, time_mode } = req.query;
    let query = supabase
      .from('note_events')
      .select('midi, spelling, correct, response_ms')
      .eq('user_id', req.user.userId);
    if (game_mode) query = query.eq('game_mode', String(game_mode));
    if (time_mode) query = query.eq('time_mode', String(time_mode));

    const { data, error } = await query;
    if (error) {
      console.error('note-averages select error:', error);
      return res.status(500).json({ error: 'Failed to load analytics' });
    }

    // Aggregate in Node (simple and avoids SQL portability issues)
    const byKey = new Map();
    for (const row of data) {
      const key = `${row.midi}|${row.spelling||''}`;
      const agg = byKey.get(key) || { midi: row.midi, spelling: row.spelling, count: 0, total: 0, correct: 0 };
      agg.count += 1;
      agg.total += Number(row.response_ms) || 0;
      if (row.correct) agg.correct += 1;
      byKey.set(key, agg);
    }
    const result = Array.from(byKey.values()).map(a => ({
      midi: a.midi,
      spelling: a.spelling,
      attempts: a.count,
      avg_ms: Math.round(a.total / Math.max(1, a.count)),
      accuracy_pct: a.count ? Math.round(100 * a.correct / a.count) : 0
    })).sort((x,y) => y.avg_ms - x.avg_ms);

    res.json({ notes: result });
  } catch (err) {
    console.error('note-averages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics: individual note responses
app.post('/api/analytics/note-responses', authenticateToken, async (req, res) => {
  try {
    const { note_name, midi_value, response_time_ms, correct, difficulty, time_mode, run_id } = req.body;
    
    if (!note_name || !midi_value || !run_id) {
      return res.status(400).json({ error: 'note_name, midi_value, and run_id required' });
    }

    const { error } = await supabase.from('note_responses').insert({
      user_id: req.user.userId,
      run_id: String(run_id),
      note_name: String(note_name),
      midi_value: parseInt(midi_value, 10),
      response_time_ms: Math.max(0, parseInt(response_time_ms, 10)),
      correct: !!correct,
      difficulty: String(difficulty || 'normal'),
      time_mode: String(time_mode || '60s'),
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('Insert note_responses error:', error);
      return res.status(500).json({ error: 'Failed to save note response' });
    }

    res.json({ ok: true, saved: true });
  } catch (err) {
    console.error('note-responses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics: get aggregated note responses for current user
app.get('/api/analytics/note-responses', authenticateToken, async (req, res) => {
  try {
    const { difficulty, time_mode } = req.query;
    
    let query = supabase
      .from('note_responses')
      .select('note_name, midi_value, response_time_ms, correct')
      .eq('user_id', req.user.userId);
    
    if (difficulty) {
      query = query.eq('difficulty', String(difficulty));
    }
    if (time_mode) {
      query = query.eq('time_mode', String(time_mode));
    }

    const { data, error } = await query;
    if (error) {
      console.error('Select note_responses error:', error);
      return res.status(500).json({ error: 'Failed to load note data' });
    }

    // Aggregate the data by note
    const noteStats = new Map();
    
    for (const row of data) {
      const key = row.note_name;
      if (!noteStats.has(key)) {
        noteStats.set(key, {
          note_name: row.note_name,
          midi_value: row.midi_value,
          attempts: 0,
          total_response_time: 0,
          correct_attempts: 0
        });
      }
      
      const stats = noteStats.get(key);
      stats.attempts += 1;
      stats.total_response_time += row.response_time_ms;
      if (row.correct) stats.correct_attempts += 1;
    }

    // Convert to array and calculate averages
    const notes = Array.from(noteStats.values()).map(stats => ({
      note_name: stats.note_name,
      midi_value: stats.midi_value,
      attempts: stats.attempts,
      avg_response_time: Math.round(stats.total_response_time / stats.attempts),
      accuracy_pct: Math.round((stats.correct_attempts / stats.attempts) * 100)
    }));

    // Sort by average response time (slowest first)
    notes.sort((a, b) => b.avg_response_time - a.avg_response_time);

    res.json({ notes });
  } catch (err) {
    console.error('Get note-responses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Trumpet Trainer server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 