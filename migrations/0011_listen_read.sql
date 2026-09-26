-- Dinle-Oku: kendi okumasından önce metni dinleyen (listen) veya cümle cümle dinleyip tekrar eden (echo)
-- okumalar işaretlenir. Bu okumalar hedef hızı değiştirmez ve hız ortalamalarına katılmaz.
-- (reading_mode CHECK kısıtını değiştirmek tabloyu yeniden kurmayı gerektirir; cevaplar zincirleme
-- silinmesin diye ayrı sütun kullanılır.)
ALTER TABLE reading_sessions ADD COLUMN assisted TEXT CHECK (assisted IN ('listen','echo'));

INSERT INTO achievements (id, title, description, icon, criteria_type, criteria_value, sort_order) VALUES
  ('listen_5', 'İyi Dinleyici', '5 kez Dinle-Oku ile okudun.', 'Headphones', 'listen_sessions', 5, 23),
  ('echo_5', 'Yankı Ustası', '5 kez yankı okuması yaptın.', 'AudioLines', 'echo_sessions', 5, 24);
