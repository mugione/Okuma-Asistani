import type { Context } from "hono";
import type { Child } from "../../shared/api-types";
import type { AppEnv } from "../env";
import { first } from "./db";
import { ApiError, notFound } from "./http";

/**
 * Çocuk kaydını getirir ve isteği yapan ebeveynin erişimini doğrular.
 * MVP'de ebeveyn kimliği X-Parent-Id başlığıdır (tahmin edilemeyen UUID).
 * Gerçek kimlik doğrulama eklendiğinde yalnızca `parentId` değişkeninin kaynağı değişir.
 */
export async function loadChildForActor(c: Context<AppEnv>, childId: string): Promise<Child> {
  const child = await first<Child>(c.env.DB, "SELECT * FROM children WHERE id = ?", childId);
  if (!child) throw notFound("Çocuk profili");
  const parentId = c.get("parentId");
  if (!parentId || parentId !== child.parent_id) {
    throw new ApiError(403, "FORBIDDEN", "Bu profile erişim izniniz yok.");
  }
  return child;
}
