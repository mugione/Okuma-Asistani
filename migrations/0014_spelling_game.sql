-- Yeni oyun: spelling (Doğru Yazılanı Bul). CHECK kısıtı değiştirilemediği için tablo yeniden
-- oluşturulur; game_sessions tablosuna başka tablo bağlı olmadığından kayıtlar güvenle korunur.
CREATE TABLE game_sessions_new (
  id                   TEXT PRIMARY KEY,
  child_id             TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  game_type            TEXT NOT NULL CHECK (game_type IN ('word_catch','sentence_recall','missing_word','sentence_verify','word_chain','syllables','antonyms','spelling')),
  total_items          INTEGER NOT NULL,
  correct_items        INTEGER NOT NULL,
  accuracy_percentage  REAL NOT NULL,
  avg_reaction_ms      INTEGER,
  display_ms           INTEGER,
  duration_seconds     REAL NOT NULL,
  xp_earned            INTEGER NOT NULL DEFAULT 0,
  stat_date            TEXT NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO game_sessions_new SELECT id, child_id, game_type, total_items, correct_items, accuracy_percentage,
  avg_reaction_ms, display_ms, duration_seconds, xp_earned, stat_date, created_at FROM game_sessions;
DROP TABLE game_sessions;
ALTER TABLE game_sessions_new RENAME TO game_sessions;
CREATE INDEX idx_game_sessions_child_created ON game_sessions(child_id, created_at);
