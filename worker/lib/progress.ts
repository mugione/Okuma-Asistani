import type { Achievement, Child } from "../../shared/api-types";
import { nextStreak, XP } from "../../shared/reading";
import { all, first, nowIso } from "./db";

/** Günlük aktivite: seri ve günlük çalışma XP'si. */
export function activityUpdate(child: Child, today: string) {
  const isFirstToday = child.last_active_date !== today;
  const streak = nextStreak(child.current_streak, child.last_active_date, today);
  return {
    dailyXp: isFirstToday ? XP.dailyPractice : 0,
    streak,
    longest: Math.max(child.longest_streak, streak),
  };
}

/** Oturum tablolarından günlük özeti yeniden hesaplar (idempotent). */
export function refreshDailyStatsStmt(db: D1Database, childId: string, date: string): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO daily_stats (child_id, date, reading_minutes, words_read, sessions_completed,
         average_wpm, average_accuracy, average_comprehension, xp_earned)
       SELECT ?1, ?2,
         (COALESCE(r.secs, 0) + COALESCE(g.secs, 0) + COALESCE(m.secs, 0)) / 60.0,
         COALESCE(r.words, 0) + COALESCE(m.words, 0), COALESCE(r.cnt, 0),
         r.avg_wpm, r.avg_acc, r.avg_comp,
         COALESCE(r.xp, 0) + COALESCE(g.xp, 0) + COALESCE(m.xp, 0)
       FROM
         (SELECT SUM(duration_seconds) secs, SUM(word_count) words, COUNT(*) cnt,
                 ROUND(AVG(CASE WHEN assisted IS NULL THEN wpm END), 1) avg_wpm, ROUND(AVG(accuracy_percentage), 1) avg_acc,
                 ROUND(AVG(comprehension_percentage), 1) avg_comp, SUM(xp_earned) xp
            FROM reading_sessions WHERE child_id = ?1 AND stat_date = ?2 AND completed_at IS NOT NULL) r,
         (SELECT SUM(duration_seconds) secs, SUM(xp_earned) xp
            FROM game_sessions WHERE child_id = ?1 AND stat_date = ?2) g,
         (SELECT SUM(duration_seconds) secs, SUM(words_read) words, SUM(xp_earned) xp
            FROM minute_tests WHERE child_id = ?1 AND stat_date = ?2 AND completed_at IS NOT NULL) m
       WHERE true -- SQLite: INSERT…SELECT ile ON CONFLICT arasındaki ayrıştırma belirsizliğini giderir
       ON CONFLICT (child_id, date) DO UPDATE SET
         reading_minutes = excluded.reading_minutes,
         words_read = excluded.words_read,
         sessions_completed = excluded.sessions_completed,
         average_wpm = excluded.average_wpm,
         average_accuracy = excluded.average_accuracy,
         average_comprehension = excluded.average_comprehension,
         xp_earned = excluded.xp_earned`,
    )
    .bind(childId, date);
}

interface Metrics {
  listen_sessions: number;
  echo_sessions: number;
  minute_tests: number;
  minute_records: number;
  minute_best: number;
  readings: number;
  perfect_comprehension: number;
  good_comprehension: number;
  third_attempt: number;
  games: number;
  categories: number;
  words: number;
  xp: number;
  streak: number;
}

/** Yeni kazanılan rozetleri ekler ve döndürür. */
export async function awardAchievements(
  db: D1Database,
  childId: string,
  extra: { improvement?: number } = {},
): Promise<Achievement[]> {
  const metrics = await first<Metrics>(
    db,
    `SELECT
       (SELECT COUNT(*) FROM reading_sessions WHERE child_id = ?1 AND assisted = 'listen' AND completed_at IS NOT NULL) listen_sessions,
       (SELECT COUNT(*) FROM reading_sessions WHERE child_id = ?1 AND assisted = 'echo' AND completed_at IS NOT NULL) echo_sessions,
       (SELECT COUNT(*) FROM minute_tests WHERE child_id = ?1 AND completed_at IS NOT NULL) minute_tests,
       (SELECT COUNT(*) FROM minute_tests WHERE child_id = ?1 AND is_record = 1) minute_records,
       (SELECT COALESCE(MAX(wcpm), 0) FROM minute_tests WHERE child_id = ?1 AND completed_at IS NOT NULL) minute_best,
       (SELECT COUNT(*) FROM reading_sessions WHERE child_id = ?1 AND completed_at IS NOT NULL) readings,
       (SELECT COUNT(*) FROM reading_sessions WHERE child_id = ?1 AND comprehension_percentage >= 100) perfect_comprehension,
       (SELECT COUNT(*) FROM reading_sessions WHERE child_id = ?1 AND comprehension_percentage >= 80) good_comprehension,
       (SELECT COUNT(*) FROM reading_sessions WHERE child_id = ?1 AND attempt_number = 3 AND completed_at IS NOT NULL) third_attempt,
       (SELECT COUNT(*) FROM game_sessions WHERE child_id = ?1) games,
       (SELECT COUNT(DISTINCT t.category) FROM reading_sessions rs JOIN texts t ON t.id = rs.text_id
          WHERE rs.child_id = ?1 AND rs.completed_at IS NOT NULL AND t.is_placement = 0) categories,
       c.total_words words, c.xp xp, c.longest_streak streak
     FROM children c WHERE c.id = ?1`,
    childId,
  );
  if (!metrics) return [];

  const pending = await all<Achievement & { criteria_type: string; criteria_value: number }>(
    db,
    `SELECT a.* FROM achievements a
      WHERE NOT EXISTS (SELECT 1 FROM child_achievements ca WHERE ca.child_id = ? AND ca.achievement_id = a.id)
      ORDER BY a.sort_order`,
    childId,
  );

  const value = (type: string): number => {
    if (type === "improvement") return extra.improvement ?? 0;
    return (metrics as unknown as Record<string, number>)[type] ?? 0;
  };
  const earned = pending.filter((a) => value(a.criteria_type) >= a.criteria_value);
  if (!earned.length) return [];

  const earnedAt = nowIso();
  await db.batch(
    earned.map((a) =>
      db
        .prepare("INSERT OR IGNORE INTO child_achievements (child_id, achievement_id, earned_at) VALUES (?, ?, ?)")
        .bind(childId, a.id, earnedAt),
    ),
  );
  return earned.map(({ id, title, description, icon }) => ({ id, title, description, icon, earned_at: earnedAt }));
}
