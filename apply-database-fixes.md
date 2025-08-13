# 🚨 **CRITICAL: Apply Database Fixes for Leaderboards**

## **What This Fixes:**
Your leaderboards are not working because your live Supabase database is missing the required columns that the code expects.

## **Step-by-Step Instructions:**

### **1. Open Your Supabase Dashboard**
- Go to [https://supabase.com](https://supabase.com)
- Sign in to your account
- Open your **Trumpet Trainer** project

### **2. Go to SQL Editor**
- In the left sidebar, click **SQL Editor**
- Click **New Query**

### **3. Copy and Paste This SQL Code:**
```sql
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
```

### **4. Run the SQL**
- Click the **Run** button (▶️)
- Wait for it to complete
- You should see results showing the new columns were added

### **5. Test the Fix**
- Open `test-database-connection.html` in your browser
- Run the "Run All Tests" button
- All tests should now pass with green checkmarks

### **6. Test Your Leaderboards**
- Go to your live site
- Try the leaderboards - they should work now!
- Play a game - scores should save and appear in leaderboards

## **What This Does:**
1. ✅ **Adds missing columns** that your code expects
2. ✅ **Updates existing scores** with default values
3. ✅ **Creates performance indexes** for faster queries
4. ✅ **Makes leaderboards functional** again

## **If You Get Errors:**
- Make sure you're in the right Supabase project
- Check that you have admin access to the database
- The `IF NOT EXISTS` clause should prevent duplicate column errors

## **After Running This:**
Your leaderboards will work immediately! The code I've updated will automatically detect the new columns and use them for filtering and display.

---

**🎺 Once you run this SQL, your leaderboards will be fully functional online!** 