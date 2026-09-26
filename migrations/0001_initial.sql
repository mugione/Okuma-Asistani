-- OkuHız – başlangıç şeması (Cloudflare D1 / SQLite)
-- Kimlikler: kullanıcı verisi için UUID (TEXT), içerik için INTEGER.

CREATE TABLE parents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE children (
  id                   TEXT PRIMARY KEY,
  parent_id            TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  birth_year           INTEGER,
  grade                INTEGER,
  avatar               TEXT NOT NULL DEFAULT 'avatar-1',
  current_level        INTEGER NOT NULL DEFAULT 1 CHECK (current_level BETWEEN 1 AND 5),
  target_wpm           INTEGER NOT NULL DEFAULT 70,
  total_words          INTEGER NOT NULL DEFAULT 0,
  total_minutes        REAL    NOT NULL DEFAULT 0,
  current_streak       INTEGER NOT NULL DEFAULT 0,
  longest_streak       INTEGER NOT NULL DEFAULT 0,
  xp                   INTEGER NOT NULL DEFAULT 0,
  placement_completed  INTEGER NOT NULL DEFAULT 0,
  last_active_date     TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE texts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  content             TEXT NOT NULL,
  category            TEXT NOT NULL,
  difficulty          INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  grade_level         INTEGER NOT NULL,
  word_count          INTEGER NOT NULL CHECK (word_count > 0),
  estimated_duration  INTEGER NOT NULL, -- saniye
  source_type         TEXT NOT NULL DEFAULT 'system' CHECK (source_type IN ('system','manual')),
  is_placement        INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE questions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  text_id         INTEGER NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT NOT NULL,
  option_d        TEXT NOT NULL,
  correct_option  TEXT NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  explanation     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE reading_sessions (
  id                        TEXT PRIMARY KEY,
  child_id                  TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  text_id                   INTEGER NOT NULL REFERENCES texts(id),
  reading_mode              TEXT NOT NULL CHECK (reading_mode IN ('placement','normal','tracking','chunks')),
  started_at                TEXT NOT NULL,
  completed_at              TEXT,
  duration_seconds          REAL,
  word_count                INTEGER NOT NULL,
  wpm                       REAL,
  accuracy_percentage       REAL,
  comprehension_percentage  REAL,
  attempt_number            INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number BETWEEN 1 AND 3),
  target_wpm                INTEGER NOT NULL,
  xp_earned                 INTEGER NOT NULL DEFAULT 0,
  stat_date                 TEXT NOT NULL, -- Türkiye saatine göre YYYY-MM-DD
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE question_answers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       TEXT NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
  question_id      INTEGER NOT NULL REFERENCES questions(id),
  selected_option  TEXT NOT NULL CHECK (selected_option IN ('a','b','c','d')),
  is_correct       INTEGER NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (session_id, question_id)
);

CREATE TABLE game_sessions (
  id                   TEXT PRIMARY KEY,
  child_id             TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  game_type            TEXT NOT NULL CHECK (game_type IN ('word_catch','sentence_recall','missing_word')),
  total_items          INTEGER NOT NULL,
  correct_items        INTEGER NOT NULL,
  accuracy_percentage  REAL NOT NULL,
  avg_reaction_ms      INTEGER,
  display_ms           INTEGER, -- kelimeyi yakala: oyun sonundaki adaptif gösterim süresi
  duration_seconds     REAL NOT NULL,
  xp_earned            INTEGER NOT NULL DEFAULT 0,
  stat_date            TEXT NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE achievements (
  id              TEXT PRIMARY KEY, -- ör. first_reading
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  icon            TEXT NOT NULL, -- Lucide ikon adı
  criteria_type   TEXT NOT NULL,
  criteria_value  INTEGER NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE child_achievements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id        TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  achievement_id  TEXT NOT NULL REFERENCES achievements(id),
  earned_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (child_id, achievement_id)
);

-- Okuma ve oyun oturumlarından türetilen günlük özet (her kayıtta yeniden hesaplanır).
CREATE TABLE daily_stats (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id               TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date                   TEXT NOT NULL,
  reading_minutes        REAL NOT NULL DEFAULT 0,
  words_read             INTEGER NOT NULL DEFAULT 0,
  sessions_completed     INTEGER NOT NULL DEFAULT 0,
  average_wpm            REAL,
  average_accuracy       REAL,
  average_comprehension  REAL,
  xp_earned              INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (child_id, date)
);
