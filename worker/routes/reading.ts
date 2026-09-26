import { Hono } from "hono";
import { z } from "zod";
import type {
  AnswerResult,
  PublicQuestion,
  AttemptSummary,
  FinishReadingResult,
  StartReadingResult,
  SubmitAnswersResult,
} from "../../shared/api-types";
import {
  calculateAccuracy,
  calculateNextTarget,
  calculateStars,
  calculateWpm,
  improvementPercent,
  initialTargetFromPlacement,
  istanbulDate,
  levelFromTargetWpm,
  MAX_ATTEMPTS_PER_DAY,
  MAX_REALISTIC_WPM,
  pickQuestions,
  QUESTIONS_PER_SESSION,
  XP,
} from "../../shared/reading";
import type { AppEnv } from "../env";
import { loadChildForActor } from "../lib/access";
import { all, first, newId, nowIso } from "../lib/db";
import { ApiError, notFound, ok, parse, readJson } from "../lib/http";
import { activityUpdate, awardAchievements, refreshDailyStatsStmt } from "../lib/progress";

interface SessionRow {
  id: string;
  child_id: string;
  text_id: number;
  reading_mode: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  word_count: number;
  wpm: number | null;
  accuracy_percentage: number | null;
  comprehension_percentage: number | null;
  attempt_number: number;
  target_wpm: number;
  xp_earned: number;
  stat_date: string;
  question_ids: string | null;
  assisted: "listen" | "echo" | null;
}

interface QuestionRow {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

const toPublic = (r: QuestionRow): PublicQuestion => ({
  id: r.id,
  question: r.question,
  options: (["a", "b", "c", "d"] as const).map((key) => ({ key, text: r[`option_${key}`] })),
});

const startSchema = z.object({
  childId: z.uuid(),
  textId: z.number().int().positive(),
  mode: z.enum(["placement", "normal", "tracking", "chunks"]),
  /** Dinle-Oku: kendi okumasından önce metni dinledi (listen) ya da cümle cümle tekrar etti (echo). */
  assisted: z.enum(["listen", "echo"]).optional(),
});

const finishSchema = z.object({
  // Frontend yalnızca süreyi gönderir; WPM backend'de hesaplanır.
  durationSeconds: z.number().positive().max(60 * 60),
  // İsteğe bağlı: bir yetişkin dinlediyse takılınan/yanlış okunan kelime sayısı.
  errorCount: z.number().int().min(0).max(1000).nullable().optional(),
  // Dinle-Oku: tamamlanan destek adımları (dinleme, birlikte okuma).
  assistedSteps: z.number().int().min(0).max(2).optional(),
});

const answersSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.number().int().positive(), selectedOption: z.enum(["a", "b", "c", "d"]) }))
    .min(1)
    .max(10),
});

/** Süre ölçümünde istemci/sunucu saat farkı için tolerans. */
const CLOCK_GRACE_SECONDS = 15;

export const reading = new Hono<AppEnv>();

async function loadSession(c: Parameters<typeof loadChildForActor>[0], id: string) {
  const session = await first<SessionRow>(c.env.DB, "SELECT * FROM reading_sessions WHERE id = ?", id);
  if (!session) throw notFound("Okuma oturumu");
  const child = await loadChildForActor(c, session.child_id);
  return { session, child };
}

reading.post("/start", async (c) => {
  const body = parse(startSchema, await readJson(c));
  const child = await loadChildForActor(c, body.childId);
  const db = c.env.DB;
  const text = await first<{ id: number; word_count: number; is_placement: number }>(
    db, "SELECT id, word_count, is_placement FROM texts WHERE id = ?", body.textId);
  if (!text) throw notFound("Metin");
  if ((body.mode === "placement") !== (text.is_placement === 1)) {
    throw new ApiError(400, "INVALID_MODE", "Seviye testi yalnızca seviye testi metniyle yapılabilir.");
  }
  if (body.assisted && body.mode !== "normal") {
    throw new ApiError(400, "INVALID_MODE", "Dinle-Oku yalnızca normal okuma ile kullanılabilir.");
  }

  const today = istanbulDate();
  const previous = await first<{ n: number }>(
    db,
    "SELECT COUNT(*) n FROM reading_sessions WHERE child_id = ? AND text_id = ? AND stat_date = ? AND completed_at IS NOT NULL",
    child.id, text.id, today,
  );
  const attemptNumber = (previous?.n ?? 0) + 1;
  if (attemptNumber > MAX_ATTEMPTS_PER_DAY) {
    throw new ApiError(409, "MAX_ATTEMPTS", "Bu metni bugün 3 kez okudun. Yarın tekrar deneyebilirsin!");
  }

  // Soru havuzundan seçim: bu çocuğa bu metinde daha önce sorulanlar sona bırakılır.
  const [pool, previous_] = await Promise.all([
    all<QuestionRow>(db, "SELECT id, question, option_a, option_b, option_c, option_d FROM questions WHERE text_id = ? ORDER BY id", text.id),
    all<{ question_id: number; n: number }>(
      db,
      `SELECT qa.question_id, COUNT(*) n FROM question_answers qa JOIN reading_sessions rs ON rs.id = qa.session_id
        WHERE rs.child_id = ? AND rs.text_id = ? GROUP BY qa.question_id`,
      child.id, text.id,
    ),
  ]);
  const count = body.mode === "placement" ? pool.length : QUESTIONS_PER_SESSION;
  const chosenIds = pickQuestions(pool.map((q) => q.id), new Map(previous_.map((p) => [p.question_id, p.n])), count);
  const chosen = pool.filter((q) => chosenIds.includes(q.id));

  const id = newId();
  const startedAt = nowIso();
  await db
    .prepare(
      `INSERT INTO reading_sessions (id, child_id, text_id, reading_mode, started_at, word_count, attempt_number, target_wpm, stat_date, question_ids, assisted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, child.id, text.id, body.mode, startedAt, text.word_count, attemptNumber, child.target_wpm, today, JSON.stringify(chosenIds),
      body.assisted ?? null)
    .run();

  const data: StartReadingResult = {
    sessionId: id,
    attemptNumber,
    targetWpm: child.target_wpm,
    startedAt,
    questions: chosen.map(toPublic),
  };
  return ok(c, data, 201);
});

reading.post("/:id/finish", async (c) => {
  const body = parse(finishSchema, await readJson(c));
  const { session, child } = await loadSession(c, c.req.param("id"));
  const db = c.env.DB;
  if (session.completed_at) throw new ApiError(409, "ALREADY_FINISHED", "Bu okuma zaten tamamlandı.");

  const elapsed = (Date.now() - Date.parse(session.started_at)) / 1000;
  if (body.durationSeconds > elapsed + CLOCK_GRACE_SECONDS) {
    throw new ApiError(400, "INVALID_DURATION", "Okuma süresi oturum süresinden uzun olamaz.");
  }

  // WPM, D1'deki kelime sayısından hesaplanır; istemciden gelen bir WPM değeri kabul edilmez.
  const durationSeconds = Math.round(body.durationSeconds * 10) / 10;
  const wpm = calculateWpm(session.word_count, durationSeconds);
  if (wpm > MAX_REALISTIC_WPM) {
    throw new ApiError(422, "UNREALISTIC_SPEED", "Çok hızlı bitirdin! Metnin tamamını okuduğundan emin ol.");
  }
  const accuracy =
    body.errorCount === undefined || body.errorCount === null ? null : calculateAccuracy(session.word_count, body.errorCount);

  const today = istanbulDate();
  const activity = activityUpdate(child, today);
  const xpEarned =
    XP.readingCompleted +
    (session.attempt_number > 1 ? XP.repeatReading : 0) +
    (accuracy !== null && accuracy >= 95 ? XP.accuracyBonus : 0) +
    (session.assisted ? (body.assistedSteps ?? 0) * XP.listenStep : 0) +
    activity.dailyXp;
  const completedAt = nowIso();

  await db.batch([
    db
      .prepare(
        `UPDATE reading_sessions SET completed_at = ?, duration_seconds = ?, wpm = ?, accuracy_percentage = ?, xp_earned = ?
         WHERE id = ? AND completed_at IS NULL`,
      )
      .bind(completedAt, durationSeconds, wpm, accuracy, xpEarned, session.id),
    db
      .prepare(
        // Eşzamanlı iki "bitir" isteğinde XP'nin iki kez eklenmemesi için: yalnızca bu istek oturumu kapattıysa.
        `UPDATE children SET xp = xp + ?, total_words = total_words + ?, total_minutes = total_minutes + ?,
           current_streak = ?, longest_streak = ?, last_active_date = ?, updated_at = ?
         WHERE id = ? AND EXISTS (SELECT 1 FROM reading_sessions WHERE id = ? AND completed_at = ?)`,
      )
      .bind(xpEarned, session.word_count, durationSeconds / 60, activity.streak, activity.longest, today, completedAt,
        child.id, session.id, completedAt),
    refreshDailyStatsStmt(db, child.id, session.stat_date),
  ]);

  const attempts = await all<AttemptSummary>(
    db,
    `SELECT attempt_number, wpm FROM reading_sessions
      WHERE child_id = ? AND text_id = ? AND stat_date = ? AND completed_at IS NOT NULL ORDER BY attempt_number`,
    child.id, session.text_id, session.stat_date,
  );
  const improvement = attempts.length > 1 ? improvementPercent(attempts[0].wpm, wpm) : null;
  const newAchievements = await awardAchievements(db, child.id, { improvement: improvement ?? 0 });

  const data: FinishReadingResult = {
    sessionId: session.id,
    wpm,
    durationSeconds,
    wordCount: session.word_count,
    accuracy,
    attemptNumber: session.attempt_number,
    xpEarned,
    attempts,
    improvementPercent: improvement,
    canRepeat: session.reading_mode !== "placement" && session.attempt_number < MAX_ATTEMPTS_PER_DAY,
    newAchievements,
  };
  return ok(c, data);
});

reading.post("/:id/answers", async (c) => {
  const body = parse(answersSchema, await readJson(c));
  const { session, child } = await loadSession(c, c.req.param("id"));
  const db = c.env.DB;
  if (!session.completed_at || session.wpm === null) {
    throw new ApiError(409, "NOT_FINISHED", "Soruları cevaplamadan önce okumayı bitirmelisin.");
  }
  if (session.comprehension_percentage !== null) {
    throw new ApiError(409, "ALREADY_ANSWERED", "Bu okumanın soruları zaten cevaplandı.");
  }

  const pool = await all<{ id: number; correct_option: string; explanation: string | null }>(
    db, "SELECT id, correct_option, explanation FROM questions WHERE text_id = ? ORDER BY id", session.text_id);
  // Yalnızca bu okumada sorulan sorular puanlanır (eski oturumlarda: metnin tüm soruları).
  const askedIds: number[] | null = session.question_ids ? JSON.parse(session.question_ids) : null;
  const questions = askedIds ? pool.filter((q) => askedIds.includes(q.id)) : pool;
  const submitted = new Map(body.answers.map((a) => [a.questionId, a.selectedOption]));
  if (submitted.size !== body.answers.length) {
    throw new ApiError(400, "DUPLICATE_ANSWER", "Aynı soru birden fazla kez cevaplanamaz.");
  }
  if (submitted.size !== questions.length || questions.some((q) => !submitted.has(q.id))) {
    throw new ApiError(400, "INCOMPLETE_ANSWERS", "Bu okumanın tüm soruları cevaplanmalı.");
  }

  // Doğru cevap D1'den kontrol edilir; puan backend'de hesaplanır.
  const results: AnswerResult[] = questions.map((q) => {
    const selected = submitted.get(q.id)!;
    return {
      questionId: q.id,
      selectedOption: selected,
      correctOption: q.correct_option,
      isCorrect: selected === q.correct_option,
      explanation: q.explanation,
    };
  });
  const correctCount = results.filter((r) => r.isCorrect).length;
  const comprehension = Math.round((correctCount / questions.length) * 1000) / 10;
  const xpEarned = comprehension >= 80 ? XP.comprehensionBonus : 0;

  const previousTarget = child.target_wpm;
  // Dinle-Oku'da çocuk metni az önce dinlediği için hız yüksek çıkar: hedef değiştirilmez.
  const newTarget = session.assisted
    ? previousTarget
    : session.reading_mode === "placement"
      ? initialTargetFromPlacement(session.wpm, comprehension)
      : calculateNextTarget({
          currentTargetWpm: previousTarget,
          actualWpm: session.wpm,
          accuracy: session.accuracy_percentage,
          comprehension,
        });
  const newLevel = levelFromTargetWpm(newTarget);
  const now = nowIso();

  const batch = [
    ...results.map((r) =>
      db
        .prepare("INSERT INTO question_answers (session_id, question_id, selected_option, is_correct, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(session.id, r.questionId, r.selectedOption, r.isCorrect ? 1 : 0, now),
    ),
    db
      .prepare("UPDATE reading_sessions SET comprehension_percentage = ?, xp_earned = xp_earned + ? WHERE id = ?")
      .bind(comprehension, xpEarned, session.id),
    db
      .prepare(
        `UPDATE children SET xp = xp + ?, target_wpm = ?, current_level = ?, updated_at = ?,
           placement_completed = CASE WHEN ? THEN 1 ELSE placement_completed END WHERE id = ?`,
      )
      .bind(xpEarned, newTarget, newLevel, now, session.reading_mode === "placement" ? 1 : 0, child.id),
    refreshDailyStatsStmt(db, child.id, session.stat_date),
  ];
  try {
    await db.batch(batch);
  } catch (e) {
    // Eşzamanlı ikinci gönderim: UNIQUE(session_id, question_id) tüm işlemi geri alır.
    if (String(e).includes("UNIQUE")) throw new ApiError(409, "ALREADY_ANSWERED", "Bu okumanın soruları zaten cevaplandı.");
    throw e;
  }

  const newAchievements = await awardAchievements(db, child.id);
  const data: SubmitAnswersResult = {
    comprehension,
    correctCount,
    totalQuestions: questions.length,
    results,
    stars: calculateStars(comprehension, session.accuracy_percentage),
    xpEarned,
    previousTargetWpm: previousTarget,
    newTargetWpm: newTarget,
    newLevel,
    newAchievements,
  };
  return ok(c, data);
});
