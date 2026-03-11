-- Outcome windows: add 12h, remove 7d
ALTER TABLE outcomes DROP CONSTRAINT IF EXISTS outcomes_window_check;
ALTER TABLE outcomes ADD CONSTRAINT outcomes_window_check CHECK ("window" IN ('1h', '4h', '12h', '24h'));
