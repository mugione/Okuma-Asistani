import { Hono } from "hono";
import { z } from "zod";
import type { GameResultResponse } from "../../shared/api-types";
import { istanbulDate, XP } from "../../shared/reading";
import type { AppEnv } from "../env";
import { loadChildForActor } from "../lib/access";
import { newId, nowIso } from "../lib/db";
import { ApiError, ok, parse, readJson } from "../lib/http";
import { activityUpdate, awardAchievements, refreshDailyStatsStmt } from "../lib/progress";

const resultSchema = z.object({
  childId: z.uuid(),
  gameType: z.enum(["word_catch", "sentence_recall", "missing_word", "sentence_verify", "word_chain", "syllables", "antonyms", "spelling"]),
  totalItems: z.number().int().min(1).max(100),
  correctItems: z.number().int().min(0).max(100),
  avgReactionMs: z.number().int().min(0).max(60_000).nullable().optional(),
  displayMs: z.number().int().min(100).max(5_000).nullable().optional(),
  durationSeconds: z.number().positive().max(30 * 60),
});

export const games = new Hono<AppEnv>();

games.post("/result", async (c) => {
  const body = parse(resultSchema, await readJson(c));
  if (body.correctItems > body.totalItems) {
    throw new ApiError(400, "VALIDATION_ERROR", "Doğru sayısı toplam sayıdan büyük olamaz.");
  }
  // Her maddeye en az ~0,3 sn düşmeli; daha hızlısı gerçekçi değildir.
  if (body.durationSeconds < body.totalItems * 0.3) {
    throw new ApiError(400, "INVALID_DURATION", "Oyun süresi geçersiz.");
  }
  const child = await loadChildForActor(c, body.childId);
  const db = c.env.DB;
  const today = istanbulDate();
  const accuracy = Math.round((body.correctItems / body.totalItems) * 1000) / 10;
  const activity = activityUpdate(child, today);
  const xpEarned = XP.gameCompleted + (accuracy >= 80 ? XP.gameAccuracyBonus : 0) + activity.dailyXp;
  const id = newId();
  const now = nowIso();

  await db.batch([
    db
      .prepare(
        `INSERT INTO game_sessions (id, child_id, game_type, total_items, correct_items, accuracy_percentage,
           avg_reaction_ms, display_ms, duration_seconds, xp_earned, stat_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, child.id, body.gameType, body.totalItems, body.correctItems, accuracy, body.avgReactionMs ?? null,
        body.gameType === "word_catch" ? (body.displayMs ?? null) : null, body.durationSeconds, xpEarned, today, now),
    db
      .prepare(
        `UPDATE children SET xp = xp + ?, total_minutes = total_minutes + ?, current_streak = ?, longest_streak = ?,
           last_active_date = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(xpEarned, body.durationSeconds / 60, activity.streak, activity.longest, today, now, child.id),
    refreshDailyStatsStmt(db, child.id, today),
  ]);

  const newAchievements = await awardAchievements(db, child.id);
  const data: GameResultResponse = { gameSessionId: id, xpEarned, accuracy, newAchievements };
  return ok(c, data, 201);
});
