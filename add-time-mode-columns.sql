-- Add missing columns for time_mode and mode filtering
ALTER TABLE scores ADD COLUMN IF NOT EXISTS time_mode TEXT NOT NULL DEFAULT '60s';
ALTER TABLE scores ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'normal';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scores_time_mode ON scores(time_mode);
CREATE INDEX IF NOT EXISTS idx_scores_mode ON scores(mode);

-- Update existing scores with default values (since we can't determine their original mode/time)
-- This ensures all existing scores have values for filtering
UPDATE scores SET time_mode = '60s' WHERE time_mode IS NULL;
UPDATE scores SET mode = 'normal' WHERE mode IS NULL; 