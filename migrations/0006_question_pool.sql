-- Soru havuzu: her okumada havuzdan seçilen soruların kimlikleri (JSON dizi) saklanır.
-- Böylece tekrar okumalarda farklı sorular gelir ve cevaplar yalnızca sorulan sorulara göre puanlanır.
ALTER TABLE reading_sessions ADD COLUMN question_ids TEXT;
