import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { newId, nowIso } from "../lib/db";
import { ApiError, notFound, ok, parse, readJson } from "../lib/http";
import { loadAccount } from "../lib/parents";

// Hesapsız (yalnızca bu cihazda) aile. Kullanıcı adı/şifre için bkz. /api/auth/register.
// Veri minimizasyonu: e-posta vb. kişisel bilgi toplanmaz; bilinmeyen alanlar Zod tarafından atılır.
const createParentSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export const parents = new Hono<AppEnv>();

parents.post("/", async (c) => {
  const body = parse(createParentSchema, await readJson(c));
  const id = newId();
  const now = nowIso();
  await c.env.DB.prepare("INSERT INTO parents (id, name, email, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)")
    .bind(id, body.name, now, now)
    .run();
  const account = await loadAccount(c.env.DB, id);
  const { children: _children, ...parent } = account!;
  return ok(c, parent, 201);
});

parents.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (c.get("parentId") !== id) throw new ApiError(403, "FORBIDDEN", "Bu aileye erişim izniniz yok.");
  const account = await loadAccount(c.env.DB, id);
  if (!account) throw notFound("Aile");
  return ok(c, account);
});
