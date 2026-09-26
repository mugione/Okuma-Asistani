import { Hono } from "hono";
import { z } from "zod";
import type {
  Achievement,
  Child,
  ProgressData,
  ProgressPoint,
  ReadHistoryItem,
  RecentSession,
  StatsData,
  StatsRange,
  TodayData,
} from "../../shared/api-types";
import {
  addDays,
  clampTarget,
  DEFAULT_TARGET_WPM,
  effectiveStreak,
  istanbulDate,
  levelFromTargetWpm,
  movingAverage,
  TARGET_ACCURACY,
  TARGET_COMPREHENSION,
  TARGET_WPM_MAX,
  TARGET_WPM_MIN,
} from "../../shared/reading";
import type { AppEnv } from "../env";
import { loadChildForActor } from "../lib/access";
import { minuteHistory } from "./minute";
import { all, first, newId, nowIso } from "../lib/db";
import { ApiError, notFound, ok, parse, readJson } from "../lib/http";

const AVATARS = Array.from({ length: 8 }, (_, i) => `avatar-${i + 1}`) as [string, ...string[]];

const childFields = {
  name: z.string().trim().min(1).max(40),
  // Workers'ta global kapsamda saat 1970'tir; yıl kontrolü istek anında yapılır.
  birthYear: z
    .number()
    .int()
    .refine((y) => {
      const year = new Date().getUTCFullYear();
      return y >= year - 16 && y <= year - 3;
    }, "Doğum yılı geçersiz.")
    .nullable()
    .optional(),
  grade: z.number().int().min(1).max(8).nullable().optional(),
  avatar: z.enum(AVATARS),
};

const createChildSchema = z.object({ parentId: z.uuid(), ...childFields });
const updateChildSchema = z
  .object({
    ...childFields,
    targetWpm: z.number().int().min(TARGET_WPM_MIN).max(TARGET_WPM_MAX),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "En az bir alan gönderilmeli." });

const rangeSchema = z.enum(["7", "30", "all"]).default("30");

export const children = new Hono<AppEnv>();

children.post("/", async (c) => {
  const body = parse(createChildSchema, await readJson(c));
  if (c.get("parentId") !== body.parentId) throw new ApiError(403, "FORBIDDEN", "Bu aileye erişim izniniz yok.");
  const parent = await first(c.env.DB, "SELECT id FROM parents WHERE id = ?", body.parentId);
  if (!parent) throw notFound("Aile");

  const id = newId();
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO children (id, parent_id, name, birth_year, grade, avatar, current_level, target_wpm, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, body.parentId, body.name, body.birthYear ?? null, body.grade ?? null, body.avatar,
      levelFromTargetWpm(DEFAULT_TARGET_WPM), DEFAULT_TARGET_WPM, now, now)
    .run();
  return ok(c, await first<Child>(c.env.DB, "SELECT * FROM children WHERE id = ?", id), 201);
});

children.get("/:id", async (c) => ok(c, await loadChildForActor(c, c.req.param("id"))));

children.put("/:id", async (c) => {
  const child = await loadChildForActor(c, c.req.param("id"));
  const body = parse(updateChildSchema, await readJson(c));
  const target = body.targetWpm !== undefined ? clampTarget(body.targetWpm) : child.target_wpm;
  await c.env.DB.prepare(
    `UPDATE children SET name = ?, birth_year = ?, grade = ?, avatar = ?, target_wpm = ?, current_level = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      body.name ?? child.name,
      body.birthYear !== undefined ? body.birthYear : child.birth_year,
      body.grade !== undefined ? body.grade : child.grade,
      body.avatar ?? child.avatar,
      target,
      levelFromTargetWpm(target),
      nowIso(),
      child.id,
    )
    .run();
  return ok(c, await first<Child>(c.env.DB, "SELECT * FROM children WHERE id = ?", child.id));
});

children.get("/:id/today", async (c) => {
  const child = await loadChildForActor(c, c.req.param("id"));
  const db = c.env.DB;
  const today = istanbulDate();

  const [stats, readingsWithAnswers, games, stars, recommended, placement, lastWordCatch] = await Promise.all([
    first<{ reading_minutes: number; words_read: number; sessions_completed: number; xp_earned: number }>(
      db, "SELECT * FROM daily_stats WHERE child_id = ? AND date = ?", child.id, today),
    first<{ n: number }>(db,
      "SELECT COUNT(*) n FROM reading_sessions WHERE child_id = ? AND stat_date = ? AND comprehension_percentage IS NOT NULL",
      child.id, today),
    first<{ n: number }>(db, "SELECT COUNT(*) n FROM game_sessions WHERE child_id = ? AND stat_date = ?", child.id, today),
    first<{ total: number | null }>(db,
      `SELECT SUM(CASE
          WHEN comprehension_percentage >= 90 AND (accuracy_percentage IS NULL OR accuracy_percentage >= 95) THEN 3
          WHEN comprehension_percentage >= 80 THEN 2 ELSE 1 END) total
       FROM reading_sessions WHERE child_id = ? AND comprehension_percentage IS NOT NULL`, child.id),
    first<{ id: number }>(db,
      `SELECT t.id FROM texts t
       LEFT JOIN (SELECT text_id, MAX(created_at) last FROM reading_sessions WHERE child_id = ?1 GROUP BY text_id) r
         ON r.text_id = t.id
       WHERE t.is_placement = 0
       ORDER BY ABS(t.difficulty - ?2) <= 1 DESC, r.last IS NOT NULL, r.last, ABS(t.difficulty - ?2), RANDOM()
       LIMIT 1`, child.id, child.current_level),
    first<{ id: number }>(db, "SELECT id FROM texts WHERE is_placement = 1 LIMIT 1"),
    first<{ display_ms: number | null }>(db,
      "SELECT display_ms FROM game_sessions WHERE child_id = ? AND game_type = 'word_catch' ORDER BY created_at DESC LIMIT 1",
      child.id),
  ]);

  const modes = ["tracking", "chunks", "normal"] as const;
  const dayIndex = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);

  const data: TodayData = {
    child,
    date: today,
    streak: effectiveStreak(child.current_streak, child.last_active_date, today),
    targets: { wpm: child.target_wpm, accuracy: TARGET_ACCURACY, comprehension: TARGET_COMPREHENSION },
    today: {
      readingMinutes: Math.round((stats?.reading_minutes ?? 0) * 10) / 10,
      wordsRead: stats?.words_read ?? 0,
      sessionsCompleted: stats?.sessions_completed ?? 0,
      xpEarned: stats?.xp_earned ?? 0,
      trainingDone: (readingsWithAnswers?.n ?? 0) > 0 && (games?.n ?? 0) > 0,
    },
    totalStars: stars?.total ?? 0,
    plan: [
      { key: "game", label: "Kelime oyunu", minutes: 2 },
      { key: "reading", label: "Okuma", minutes: 4 },
      { key: "repeat", label: "Tekrar okuma", minutes: 2 },
      { key: "questions", label: "Anlama soruları", minutes: 2 },
    ],
    recommendedTextId: recommended?.id ?? null,
    placementTextId: placement?.id ?? null,
    wordCatchDisplayMs: lastWordCatch?.display_ms ?? 800,
    recommendedMode: modes[dayIndex % modes.length],
  };
  return ok(c, data);
});

function rangeStart(range: StatsRange, today: string): string {
  if (range === "all") return "0000-01-01";
  return addDays(today, -(Number(range) - 1));
}

children.get("/:id/stats", async (c) => {
  const child = await loadChildForActor(c, c.req.param("id"));
  const range = parse(rangeSchema, c.req.query("range"));
  const since = rangeStart(range, istanbulDate());

  const [r, g] = await Promise.all([
    first<{ cnt: number; avg_wpm: number | null; avg_acc: number | null; avg_comp: number | null; secs: number | null;
      words: number | null; best: number | null; days: number }>(
      c.env.DB,
      `SELECT COUNT(*) cnt, ROUND(AVG(wpm), 1) avg_wpm, ROUND(AVG(accuracy_percentage), 1) avg_acc,
              ROUND(AVG(comprehension_percentage), 1) avg_comp, SUM(duration_seconds) secs, SUM(word_count) words,
              MAX(wpm) best, COUNT(DISTINCT stat_date) days
         FROM reading_sessions WHERE child_id = ? AND completed_at IS NOT NULL AND stat_date >= ?`,
      child.id, since),
    first<{ cnt: number; acc: number | null; secs: number | null }>(
      c.env.DB,
      `SELECT COUNT(*) cnt, ROUND(AVG(accuracy_percentage), 1) acc, SUM(duration_seconds) secs
         FROM game_sessions WHERE child_id = ? AND stat_date >= ?`,
      child.id, since),
  ]);
  const activeDays = await first<{ n: number }>(
    c.env.DB,
    "SELECT COUNT(*) n FROM daily_stats WHERE child_id = ? AND date >= ? AND (sessions_completed > 0 OR reading_minutes > 0)",
    child.id, since,
  );

  const data: StatsData = {
    range,
    sessionCount: r?.cnt ?? 0,
    averageWpm: r?.avg_wpm ?? null,
    averageAccuracy: r?.avg_acc ?? null,
    averageComprehension: r?.avg_comp ?? null,
    totalMinutes: Math.round((((r?.secs ?? 0) + (g?.secs ?? 0)) / 60) * 10) / 10,
    totalWords: r?.words ?? 0,
    gamesPlayed: g?.cnt ?? 0,
    gameAccuracy: g?.acc ?? null,
    activeDays: activeDays?.n ?? 0,
    bestWpm: r?.best ?? null,
  };
  return ok(c, data);
});

children.get("/:id/progress", async (c) => {
  const child = await loadChildForActor(c, c.req.param("id"));
  const range = parse(rangeSchema, c.req.query("range"));
  const today = istanbulDate();
  const db = c.env.DB;

  type Row = { date: string; average_wpm: number | null; average_comprehension: number | null;
    average_accuracy: number | null; reading_minutes: number };
  const firstRow = await first<{ date: string }>(db, "SELECT MIN(date) date FROM daily_stats WHERE child_id = ?", child.id);
  let since = rangeStart(range, today);
  if (range === "all") since = firstRow?.date ?? today;

  const [rows, history, recent] = await Promise.all([
    all<Row>(db, "SELECT * FROM daily_stats WHERE child_id = ? AND date >= ? ORDER BY date", child.id, since),
    // Hareketli ortalamanın aralık başında da anlamlı olması için önceki 6 aktif gün.
    all<{ average_wpm: number }>(db,
      `SELECT average_wpm FROM daily_stats WHERE child_id = ? AND date < ? AND average_wpm IS NOT NULL
       ORDER BY date DESC LIMIT 6`, child.id, since),
    all<RecentSession>(db,
      `SELECT rs.id, t.title, rs.reading_mode, rs.wpm, rs.accuracy_percentage, rs.comprehension_percentage,
              rs.attempt_number, rs.completed_at
         FROM reading_sessions rs JOIN texts t ON t.id = rs.text_id
        WHERE rs.child_id = ? AND rs.completed_at IS NOT NULL
        ORDER BY rs.completed_at DESC LIMIT 10`, child.id),
  ]);

  const byDate = new Map(rows.map((r) => [r.date, r]));
  const dates: string[] = [];
  const span = Math.round((Date.parse(today) - Date.parse(since)) / 86_400_000);
  if (span <= 366) {
    for (let d = since; d <= today; d = addDays(d, 1)) dates.push(d);
  } else {
    dates.push(...rows.map((r) => r.date));
  }

  const seed = history.reverse().map((h, i) => ({ date: `h${i}`, value: h.average_wpm }));
  const series = dates.map((date) => ({ date, value: byDate.get(date)?.average_wpm ?? null }));
  const trend = movingAverage([...seed, ...series], 7).slice(seed.length);

  const points: ProgressPoint[] = dates.map((date, i) => {
    const r = byDate.get(date);
    return {
      date,
      wpm: r?.average_wpm ?? null,
      wpmTrend: trend[i],
      comprehension: r?.average_comprehension ?? null,
      accuracy: r?.average_accuracy ?? null,
      minutes: Math.round((r?.reading_minutes ?? 0) * 10) / 10,
    };
  });
  const data: ProgressData = { range, points, recentSessions: recent };
  return ok(c, data);
});

children.get("/:id/reading-history", async (c) => {
  const child = await loadChildForActor(c, c.req.param("id"));
  const list = await all<ReadHistoryItem>(
    c.env.DB,
    `SELECT rs.text_id, COUNT(*) times_read, MAX(rs.wpm) best_wpm, MAX(rs.comprehension_percentage) best_comprehension,
            MAX(rs.completed_at) last_read_at
       FROM reading_sessions rs JOIN texts t ON t.id = rs.text_id
      WHERE rs.child_id = ? AND rs.completed_at IS NOT NULL AND t.is_placement = 0
      GROUP BY rs.text_id`,
    child.id,
  );
  return ok(c, list);
});

children.get("/:id/minute-tests", async (c) => {
  const child = await loadChildForActor(c, c.req.param("id"));
  return ok(c, await minuteHistory(c.env.DB, child.id));
});

children.get("/:id/achievements", async (c) => {
  const child = await loadChildForActor(c, c.req.param("id"));
  const list = await all<Achievement>(
    c.env.DB,
    `SELECT a.id, a.title, a.description, a.icon, ca.earned_at
       FROM achievements a LEFT JOIN child_achievements ca ON ca.achievement_id = a.id AND ca.child_id = ?
      ORDER BY ca.earned_at IS NULL, a.sort_order`,
    child.id,
  );
  return ok(c, list);
});
