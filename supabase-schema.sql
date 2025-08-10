-- Enable Row Level Security
-- Note: app.jwt_secret is set automatically by Supabase

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scores table
CREATE TABLE IF NOT EXISTS scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL DEFAULT 0,
  mistakes INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  avg_response INTEGER NOT NULL DEFAULT 0,
  accuracy DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Columns for mode and de-duplication per run
ALTER TABLE scores ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE scores ADD COLUMN IF NOT EXISTS run_id TEXT;
-- Preferred new columns (avoid reserved-name confusion with SQL aggregate MODE)
ALTER TABLE scores ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE scores ADD COLUMN IF NOT EXISTS time_mode TEXT NOT NULL DEFAULT '60s';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_mode ON scores(mode);
CREATE INDEX IF NOT EXISTS idx_scores_game_mode ON scores(game_mode);
CREATE INDEX IF NOT EXISTS idx_scores_time_mode ON scores(time_mode);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_user_run ON scores(user_id, run_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for scores table
CREATE POLICY "Users can view their own scores" ON scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scores" ON scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Public leaderboard view (read-only)
CREATE POLICY "Anyone can view leaderboard" ON scores
  FOR SELECT USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to get user's best score
CREATE OR REPLACE FUNCTION get_user_best_score(user_uuid UUID)
RETURNS TABLE (
  best_score INTEGER,
  total_games INTEGER,
  avg_score DECIMAL(10,2),
  total_correct INTEGER,
  total_mistakes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    MAX(s.score)::INTEGER as best_score,
    COUNT(s.id)::INTEGER as total_games,
    AVG(s.score)::DECIMAL(10,2) as avg_score,
    SUM(s.correct)::INTEGER as total_correct,
    SUM(s.mistakes)::INTEGER as total_mistakes
  FROM scores s
  WHERE s.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create view for leaderboard with user names (include time_mode and game_mode)
DROP VIEW IF EXISTS leaderboard;
CREATE VIEW leaderboard AS
SELECT 
  s.id,
  s.score,
  s.correct,
  s.mistakes,
  s.best_streak,
  s.accuracy,
  s.created_at,
  s.game_mode,
  s.time_mode,
  s.run_id,
  u.name AS player_name
FROM scores s
JOIN users u ON s.user_id = u.id
ORDER BY s.score DESC, s.created_at ASC;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated; 