import { Hono } from "hono";
import { z } from "zod";
import type { LeaderboardData, LeaderboardEntry } from "../../shared/api-types";
import { istanbulDate, weekStart } from "../../shared/reading";
import type { AppEnv } from "../env";
import { loadChildForActor } from "../lib/access";
import { all, first } from "../lib/db";
import { ApiError, ok, parse } from "../lib/http";

const querySchema = z.object({
  period: z.enum(["day", "week", "year"]).default("week"),
  childId: z.uuid().optional(),
});

/** Sıralamaya katılan çocuklar: kullanıcı adı/şifresi olan hesaplar ve ebeveyni gizlememiş olanlar. */
const ELIGIBLE = "p.username IS NOT NULL AND c.show_in_leaderboard = 1";

/** Yalnızca ad: ilk kelime (soyadı gösterilmez). */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export const leaderboard = new Hono<AppEnv>();

/**
 * Mahalle sıralaması: seçilen dönemde kazanılan XP'ye göre ilk 10.
 * Yalnızca giriş yapmış kullanıcılar görebilir (çocuk isimleri herkese açık değildir).
 */
leaderboard.get("/", async (c) => {
  if (!c.get("parentId")) throw new ApiError(401, "UNAUTHORIZED", "Sıralamayı görmek için giriş yapın.");
  const q = parse(querySchema, c.req.query());
  const db = c.env.DB;
  const to = istanbulDate();
  const from = q.period === "day" ? to : q.period === "week" ? weekStart(to) : `${to.slice(0, 4)}-01-01`;

  const [rows, count] = await Promise.all([
    all<{ id: string; name: string; avatar: string; xp: number }>(
      db,
      `SELECT c.id, c.name, c.avatar, SUM(ds.xp_earned) xp
         FROM daily_stats ds JOIN children c ON c.id = ds.child_id JOIN parents p ON p.id = c.parent_id
        WHERE ${ELIGIBLE} AND ds.date BETWEEN ? AND ?
        GROUP BY c.id HAVING xp > 0
        ORDER BY xp DESC, c.created_at
        LIMIT 10`,
      from, to,
    ),
    first<{ n: number }>(
      db,
      `SELECT COUNT(*) n FROM (SELECT c.id FROM daily_stats ds JOIN children c ON c.id = ds.child_id JOIN parents p ON p.id = c.parent_id
        WHERE ${ELIGIBLE} AND ds.date BETWEEN ? AND ? GROUP BY c.id HAVING SUM(ds.xp_earned) > 0)`,
      from, to,
    ),
  ]);

  // Eşit XP'ye aynı sıra (1, 2, 2, 4 …).
  const top: LeaderboardEntry[] = [];
  rows.forEach((r, i) => {
    const rank = i > 0 && rows[i - 1].xp === r.xp ? top[i - 1].rank : i + 1;
    top.push({ rank, name: firstName(r.name), avatar: r.avatar, xp: r.xp, isMe: r.id === q.childId });
  });

  let me: LeaderboardData["me"] = null;
  if (q.childId) {
    const child = await loadChildForActor(c, q.childId);
    const account = await first<{ username: string | null }>(db, "SELECT username FROM parents WHERE id = ?", child.parent_id);
    const mine = await first<{ xp: number | null }>(
      db, "SELECT SUM(xp_earned) xp FROM daily_stats WHERE child_id = ? AND date BETWEEN ? AND ?", child.id, from, to);
    const xp = mine?.xp ?? 0;
    const eligible = !!account?.username && child.show_in_leaderboard === 1;
    let rank: number | null = null;
    if (eligible && xp > 0) {
      const ahead = await first<{ n: number }>(
        db,
        `SELECT COUNT(*) n FROM (SELECT c.id FROM daily_stats ds JOIN children c ON c.id = ds.child_id JOIN parents p ON p.id = c.parent_id
          WHERE ${ELIGIBLE} AND ds.date BETWEEN ? AND ? GROUP BY c.id HAVING SUM(ds.xp_earned) > ?)`,
        from, to, xp,
      );
      rank = (ahead?.n ?? 0) + 1;
    }
    me = { rank, xp, eligible, reason: eligible ? null : !account?.username ? "no_account" : "hidden" };
  }

  const data: LeaderboardData = { period: q.period, from, to, top, participants: count?.n ?? 0, me };
  return ok(c, data);
});
