-- Kullanıcı adı + şifre ile giriş (e-posta gerekmez) ve cihazlar arası oturumlar.
ALTER TABLE parents ADD COLUMN username TEXT;
ALTER TABLE parents ADD COLUMN password_hash TEXT;
CREATE UNIQUE INDEX idx_parents_username ON parents(username) WHERE username IS NOT NULL;

-- Oturum token'larının yalnızca SHA-256 özeti saklanır; token'ın kendisi veritabanında yoktur.
CREATE TABLE auth_sessions (
  token_hash    TEXT PRIMARY KEY,
  parent_id     TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_auth_sessions_parent ON auth_sessions(parent_id);
CREATE INDEX idx_auth_sessions_expires ON auth_sessions(expires_at);
