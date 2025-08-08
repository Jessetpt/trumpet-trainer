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
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// User registration
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

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          name,
          email,
          phone,
          password: hashedPassword,
          created_at: new Date().toISOString()
        }
      ])
      .select('id, name, email, phone, created_at')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, password')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
           res.status(500).json({ error: 'Internal server error' });
     }
   });
   
   // Password reset request
   app.post('/api/auth/forgot-password', async (req, res) => {
     try {
       const { email } = req.body;
   
       if (!email) {
         return res.status(400).json({ error: 'Email is required' });
       }
   
       // Check if user exists
       const { data: user, error } = await supabase
         .from('users')
         .select('id, name, email')
         .eq('email', email)
         .single();
   
       if (error || !user) {
         return res.status(404).json({ error: 'No account found with this email' });
       }
   
       // Generate reset token (in production, you'd send this via email)
       const resetToken = jwt.sign(
         { userId: user.id, email: user.email, type: 'password-reset' },
         process.env.JWT_SECRET,
         { expiresIn: '1h' }
       );
   
       // For now, just return the token (in production, send via email)
       res.json({
         message: 'Password reset link sent to your email',
         resetToken: resetToken, // Remove this in production
         note: 'In production, this would be sent via email'
       });
   
     } catch (error) {
       console.error('Password reset error:', error);
       res.status(500).json({ error: 'Internal server error' });
     }
   });
   
   // Reset password with token
   app.post('/api/auth/reset-password', async (req, res) => {
     try {
       const { resetToken, newPassword } = req.body;
   
       if (!resetToken || !newPassword) {
         return res.status(400).json({ error: 'Reset token and new password are required' });
       }
   
       if (newPassword.length < 6) {
         return res.status(400).json({ error: 'Password must be at least 6 characters' });
       }
   
       // Verify reset token
       const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
       if (decoded.type !== 'password-reset') {
         return res.status(400).json({ error: 'Invalid reset token' });
       }
   
       // Hash new password
       const hashedPassword = await bcrypt.hash(newPassword, 12);
   
       // Update password
       const { error } = await supabase
         .from('users')
         .update({ password: hashedPassword })
         .eq('id', decoded.userId);
   
       if (error) {
         console.error('Supabase error:', error);
         return res.status(500).json({ error: 'Failed to update password' });
       }
   
       res.json({ message: 'Password updated successfully' });
   
     } catch (error) {
       console.error('Reset password error:', error);
       res.status(500).json({ error: 'Invalid or expired reset token' });
     }
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
    const { score, correct, mistakes, bestStreak, avgResponse, accuracy } = req.body;

    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }

    const { data: newScore, error } = await supabase
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
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to save score' });
    }

    res.status(201).json({
      message: 'Score saved successfully',
      score: newScore
    });

  } catch (error) {
    console.error('Save score error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's best score
app.get('/api/scores/best', authenticateToken, async (req, res) => {
  try {
    const { data: bestScore, error } = await supabase
      .from('scores')
      .select('score, created_at')
      .eq('user_id', req.user.userId)
      .order('score', { ascending: false })
      .limit(1)
      .single();

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

// Get leaderboard
app.get('/api/scores/leaderboard', async (req, res) => {
  try {
    const { data: leaderboard, error } = await supabase
      .from('scores')
      .select(`
        score,
        correct,
        accuracy,
        created_at,
        users!inner(name)
      `)
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