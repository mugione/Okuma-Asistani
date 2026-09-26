-- Mahalle sıralaması: ebeveyn çocuğunu sıralamadan çıkarabilir (varsayılan: görünür).
ALTER TABLE children ADD COLUMN show_in_leaderboard INTEGER NOT NULL DEFAULT 1;
-- Dönemlik XP toplamları için.
CREATE INDEX idx_daily_stats_date_child ON daily_stats(date, child_id);
