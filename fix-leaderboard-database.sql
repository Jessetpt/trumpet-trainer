-- 🚨 CRITICAL FIX: Add missing columns for leaderboard functionality
-- This script will fix the database schema mismatch that's preventing leaderboards from working online

-- Add the missing time_mode and game_mode columns
ALTER TABLE scores ADD COLUMN IF NOT EXISTS time_mode TEXT NOT NULL DEFAULT '60s';
ALTER TABLE scores ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'normal';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scores_time_mode ON scores(time_mode);
CREATE INDEX IF NOT EXISTS idx_scores_game_mode ON scores(game_mode);

-- Update existing scores with default values to ensure all scores can be filtered
UPDATE scores SET time_mode = '60s' WHERE time_mode IS NULL;
UPDATE scores SET game_mode = 'normal' WHERE game_mode IS NULL;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'scores' 
AND column_name IN ('time_mode', 'game_mode', 'mode')
ORDER BY column_name;

-- Check if we have any scores to work with
SELECT COUNT(*) as total_scores FROM scores;

-- Show sample of updated scores
SELECT 
    id, 
    score, 
    game_mode, 
    time_mode, 
    created_at 
FROM scores 
LIMIT 5; 