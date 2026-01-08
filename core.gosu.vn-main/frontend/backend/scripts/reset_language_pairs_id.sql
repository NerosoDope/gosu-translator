-- Reset ID sequence for language_pairs table to start from 1
-- This will reset the auto-increment counter

-- Option 1: Reset sequence without deleting data (if you want to keep existing data)
-- Note: This will only work if there are no existing records, or if you want to reset the counter for new records
SELECT setval('language_pairs_id_seq', 1, false);

-- Option 2: If you want to delete all data and reset (uncomment the line below)
-- TRUNCATE TABLE language_pairs RESTART IDENTITY CASCADE;
