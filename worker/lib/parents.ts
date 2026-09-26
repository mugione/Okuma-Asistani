import type { Child, Parent } from "../../shared/api-types";
import { all, first } from "./db";

/** password_hash asla seçilmez: istemciye dönen hiçbir yanıtta yer almamalı. */
export const PARENT_COLUMNS = "id, name, username, created_at, updated_at, (password_hash IS NOT NULL) AS has_password";

export async function loadAccount(db: D1Database, parentId: string): Promise<(Parent & { children: Child[] }) | null> {
  const parent = await first<Parent>(db, `SELECT ${PARENT_COLUMNS} FROM parents WHERE id = ?`, parentId);
  if (!parent) return null;
  const children = await all<Child>(db, "SELECT * FROM children WHERE parent_id = ? ORDER BY created_at", parentId);
  return { ...parent, has_password: !!parent.has_password, children };
}
