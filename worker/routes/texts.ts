import { Hono } from "hono";
import { z } from "zod";
import type { PublicQuestion, TextDetail, TextSummary } from "../../shared/api-types";
import type { AppEnv } from "../env";
import { all, first } from "../lib/db";
import { notFound, ok, parse } from "../lib/http";

const listSchema = z.object({
  category: z.string().max(40).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
});

const SUMMARY_COLUMNS =
  "id, slug, title, category, difficulty, grade_level, word_count, estimated_duration, readability_score, readability_level, effective_difficulty";

export const texts = new Hono<AppEnv>();

texts.get("/", async (c) => {
  const q = parse(listSchema, c.req.query());
  const where = ["is_placement = 0"];
  const params: unknown[] = [];
  if (q.category) {
    where.push("category = ?");
    params.push(q.category);
  }
  if (q.difficulty) {
    where.push("COALESCE(effective_difficulty, difficulty) = ?");
    params.push(q.difficulty);
  }
  const list = await all<TextSummary>(
    c.env.DB,
    `SELECT ${SUMMARY_COLUMNS} FROM texts WHERE ${where.join(" AND ")} ORDER BY COALESCE(effective_difficulty, difficulty), readability_score DESC, title`,
    ...params,
  );
  return ok(c, list);
});

texts.get("/:id", async (c) => {
  const id = parse(z.coerce.number().int().positive(), c.req.param("id"));
  const text = await first<Omit<TextDetail, "questions">>(
    c.env.DB,
    `SELECT ${SUMMARY_COLUMNS}, content, source_type FROM texts WHERE id = ?`,
    id,
  );
  if (!text) throw notFound("Metin");
  const rows = await all<{ id: number; question: string; option_a: string; option_b: string; option_c: string; option_d: string }>(
    c.env.DB,
    // correct_option ve explanation bilerek seçilmez: cevaplar backend'de puanlanır.
    "SELECT id, question, option_a, option_b, option_c, option_d FROM questions WHERE text_id = ? ORDER BY id",
    id,
  );
  const questions: PublicQuestion[] = rows.map((r) => ({
    id: r.id,
    question: r.question,
    options: (["a", "b", "c", "d"] as const).map((key) => ({ key, text: r[`option_${key}`] })),
  }));
  return ok(c, { ...text, questions } satisfies TextDetail);
});
