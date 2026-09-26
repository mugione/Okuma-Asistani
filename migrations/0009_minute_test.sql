-- 1 Dakika Okuma Testi (sözlü okuma akıcılığı / ORF benzeri ölçüm).
CREATE TABLE minute_tests (
  id                TEXT PRIMARY KEY,
  child_id          TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  text_id           INTEGER NOT NULL REFERENCES texts(id),
  started_at        TEXT NOT NULL,
  completed_at      TEXT,
  duration_seconds  REAL,
  words_read        INTEGER,            -- okunan kelime sayısı (son okunan kelimeye kadar)
  error_count       INTEGER,            -- yetişkin dinlediyse hatalı kelime sayısı
  wpm               REAL,               -- okunan kelime / dakika
  wcpm              REAL,               -- doğru okunan kelime / dakika (hata girilmediyse wpm)
  accuracy_percentage REAL,
  finished_text     INTEGER NOT NULL DEFAULT 0, -- metni süre dolmadan bitirdi mi
  is_record         INTEGER NOT NULL DEFAULT 0, -- kişisel rekor mu
  xp_earned         INTEGER NOT NULL DEFAULT 0,
  stat_date         TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_minute_tests_child_created ON minute_tests(child_id, created_at);

INSERT INTO achievements (id, title, description, icon, criteria_type, criteria_value, sort_order) VALUES
  ('minute_first', 'İlk Dakika', 'İlk 1 dakika okuma testini tamamladın.', 'Timer', 'minute_tests', 1, 16),
  ('minute_record', 'Rekor Kırıcı', '1 dakika testinde kendi rekorunu kırdın.', 'Trophy', 'minute_records', 1, 17),
  ('minute_5', 'Düzenli Ölçüm', '5 kez 1 dakika okuma testi yaptın.', 'CalendarClock', 'minute_tests', 5, 18),
  ('minute_60', 'Dakikada 60', '1 dakikada 60 kelimeyi doğru okudun.', 'Gauge', 'minute_best', 60, 19),
  ('minute_80', 'Dakikada 80', '1 dakikada 80 kelimeyi doğru okudun.', 'Gauge', 'minute_best', 80, 20),
  ('minute_100', 'Dakikada 100', '1 dakikada 100 kelimeyi doğru okudun.', 'Rocket', 'minute_best', 100, 21),
  ('minute_120', 'Dakikada 120', '1 dakikada 120 kelimeyi doğru okudun.', 'Zap', 'minute_best', 120, 22);
