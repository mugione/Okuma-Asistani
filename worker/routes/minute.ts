import { Hono } from "hono";
import { z } from "zod";
import type { MinuteTestHistory, MinuteTestHistoryItem, MinuteTestResult, MinuteTestStart } from "../../shared/api-types";
import {
  calculateAccuracy,
  istanbulDate,
  MAX_REALISTIC_WPM,
  MINUTE_TEST_MIN_TIMED_SECONDS,
  MINUTE_TEST_SECONDS,
  XP,
} from "../../shared/reading";
import type { AppEnv } from "../env";
import { loadChildForActor } from "../lib/access";
import { all, first, newId, nowIso } from "../lib/db";
import { ApiError, notFound, ok, parse, readJson } from "../lib/http";
import { activityUpdate, awardAchievements, refreshDailyStatsStmt } from "../lib/progress";

const startSchema = z.object({ childId: z.uuid() });
const finishSchema = z.object({
  durationSeconds: z.number().positive().max(MINUTE_TEST_SECONDS + 5),
  /** Son okunan kelimeye kadar okunan kelime sayısı (istemci kelime indeksinden hesaplar). */
  wordsRead: z.number().int().min(1).max(1000),
  errorCount: z.number().int().min(0).max(1000).nullable().optional(),
  /** Metni süre dolmadan bitirdi ("Bitirdim"). */
  finishedText: z.boolean(),
});

const CLOCK_GRACE_SECONDS = 15;
const round1 = (n: number) => Math.round(n * 10) / 10;

export const minute = new Hono<AppEnv>();

/** Seviyeye uygun, bu çocuğun daha önce 1 dakika testi yapmadığı bir metin seçer. */
minute.post("/start", async (c) => {
  const body = parse(startSchema, await readJson(c));
  const child = await loadChildForActor(c, body.childId);
  const db = c.env.DB;
  const text = await first<MinuteTestStart["text"]>(
    db,
    `SELECT t.id, t.title, t.content, t.word_count, t.difficulty FROM texts t
      LEFT JOIN (SELECT text_id, MAX(created_at) last FROM minute_tests WHERE child_id = ?1 GROUP BY text_id) m ON m.text_id = t.id
      WHERE t.is_placement = 0
      ORDER BY m.last IS NOT NULL, m.last, ABS(COALESCE(t.effective_difficulty, t.difficulty) - ?2), t.word_count DESC, RANDOM()
      LIMIT 1`,
    child.id, child.current_level,
  );
  if (!text) throw notFound("Metin");
  const id = newId();
  const startedAt = nowIso();
  await db
    .prepare("INSERT INTO minute_tests (id, child_id, text_id, started_at, stat_date) VALUES (?, ?, ?, ?, ?)")
    .bind(id, child.id, text.id, startedAt, istanbulDate())
    .run();
  const data: MinuteTestStart = { testId: id, startedAt, seconds: MINUTE_TEST_SECONDS, text };
  return ok(c, data, 201);
});

minute.post("/:id/finish", async (c) => {
  const body = parse(finishSchema, await readJson(c));
  const db = c.env.DB;
  const test = await first<{ id: string; child_id: string; text_id: number; started_at: string; completed_at: string | null; stat_date: string }>(
    db, "SELECT id, child_id, text_id, started_at, completed_at, stat_date FROM minute_tests WHERE id = ?", c.req.param("id"));
  if (!test) throw notFound("Test");
  const child = await loadChildForActor(c, test.child_id);
  if (test.completed_at) throw new ApiError(409, "ALREADY_FINISHED", "Bu test zaten tamamlandı.");

  const text = await first<{ word_count: number }>(db, "SELECT word_count FROM texts WHERE id = ?", test.text_id);
  if (!text) throw notFound("Metin");

  // --- Doğrulama: sonuçlar istemciye körü körüne güvenilmeden hesaplanır.
  const elapsed = (Date.now() - Date.parse(test.started_at)) / 1000;
  if (body.durationSeconds > elapsed + CLOCK_GRACE_SECONDS) {
    throw new ApiError(400, "INVALID_DURATION", "Test süresi, testin başladığı andan geçen süreden uzun olamaz.");
  }
  if (body.wordsRead > text.word_count) throw new ApiError(400, "INVALID_WORDS", "Okunan kelime sayısı metinden fazla olamaz.");
  if (body.finishedText && body.wordsRead !== text.word_count) {
    throw new ApiError(400, "INVALID_WORDS", "Metni bitirdiysen tüm kelimeler okunmuş olmalı.");
  }
  if (!body.finishedText && body.durationSeconds < MINUTE_TEST_MIN_TIMED_SECONDS) {
    throw new ApiError(400, "INVALID_DURATION", "Süre dolmadan test bitirilemez; metni bitirdiysen \"Bitirdim\"e bas.");
  }
  const errors = Math.min(body.errorCount ?? 0, body.wordsRead);
  const minutes = body.durationSeconds / 60;
  const wpm = round1(body.wordsRead / minutes);
  const wcpm = round1((body.wordsRead - errors) / minutes);
  if (wpm > MAX_REALISTIC_WPM) {
    throw new ApiError(422, "UNREALISTIC_SPEED", "Bu hız gerçekçi görünmüyor. Son okuduğun kelimeyi doğru seçtiğinden emin ol.");
  }
  const accuracy = body.errorCount === undefined || body.errorCount === null ? null : calculateAccuracy(body.wordsRead, errors);

  const stats = await first<{ best: number | null }>(
    db, "SELECT MAX(wcpm) best FROM minute_tests WHERE child_id = ? AND completed_at IS NOT NULL", child.id);
  const lastRow = await first<{ wcpm: number }>(
    db, "SELECT wcpm FROM minute_tests WHERE child_id = ? AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1", child.id);
  const previousBest = stats?.best ?? null;
  // Rekor: daha önce en az bir test yapılmış ve bu sonuç önceki en iyiyi geçmişse.
  const isRecord = previousBest !== null && wcpm > previousBest;

  const today = istanbulDate();
  const activity = activityUpdate(child, today);
  const xpEarned =
    XP.minuteTest + (isRecord ? XP.minuteRecord : 0) + (body.finishedText ? XP.minuteFinishedText : 0) + activity.dailyXp;
  const completedAt = nowIso();

  await db.batch([
    db
      .prepare(
        `UPDATE minute_tests SET completed_at = ?, duration_seconds = ?, words_read = ?, error_count = ?, wpm = ?, wcpm = ?,
           accuracy_percentage = ?, finished_text = ?, is_record = ?, xp_earned = ? WHERE id = ? AND completed_at IS NULL`,
      )
      .bind(completedAt, round1(body.durationSeconds), body.wordsRead, body.errorCount ?? null, wpm, wcpm, accuracy,
        body.finishedText ? 1 : 0, isRecord ? 1 : 0, xpEarned, test.id),
    db
      .prepare(
        `UPDATE children SET xp = xp + ?, total_words = total_words + ?, total_minutes = total_minutes + ?,
           current_streak = ?, longest_streak = ?, last_active_date = ?, updated_at = ?
         WHERE id = ? AND EXISTS (SELECT 1 FROM minute_tests WHERE id = ? AND completed_at = ?)`,
      )
      .bind(xpEarned, body.wordsRead, body.durationSeconds / 60, activity.streak, activity.longest, today, completedAt,
        child.id, test.id, completedAt),
    refreshDailyStatsStmt(db, child.id, test.stat_date),
  ]);

  const newAchievements = await awardAchievements(db, child.id);
  const data: MinuteTestResult = {
    testId: test.id,
    wordsRead: body.wordsRead,
    durationSeconds: round1(body.durationSeconds),
    wpm,
    wcpm,
    accuracy,
    finishedText: body.finishedText,
    isRecord,
    previousBest,
    previous: lastRow?.wcpm ?? null,
    xpEarned,
    newAchievements,
  };
  return ok(c, data);
});

/** Çocuğun 1 dakika testi geçmişi (son 20) ve en iyi sonucu. */
export async function minuteHistory(db: D1Database, childId: string): Promise<MinuteTestHistory> {
  const [summary, items] = await Promise.all([
    first<{ best: number | null; count: number }>(
      db, "SELECT MAX(wcpm) best, COUNT(*) count FROM minute_tests WHERE child_id = ? AND completed_at IS NOT NULL", childId),
    all<MinuteTestHistoryItem>(
      db,
      `SELECT m.id, t.title, m.wcpm, m.wpm, m.accuracy_percentage, m.words_read, m.finished_text, m.is_record, m.completed_at
         FROM minute_tests m JOIN texts t ON t.id = m.text_id
        WHERE m.child_id = ? AND m.completed_at IS NOT NULL ORDER BY m.completed_at DESC LIMIT 20`,
      childId),
  ]);
  return { best: summary?.best ?? null, count: summary?.count ?? 0, items };
}
