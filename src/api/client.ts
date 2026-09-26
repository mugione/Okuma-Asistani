import type {
  Account,
  Achievement,
  AuthResult,
  ApiResponse,
  Child,
  FinishReadingResult,
  GameResultResponse,
  GameType,
  LeaderboardData,
  LeaderboardPeriod,
  MinuteTestHistory,
  MinuteTestResult,
  MinuteTestStart,
  Parent,
  ProgressData,
  ReadHistoryItem,
  ReadingModeName,
  StartReadingResult,
  StatsData,
  StatsRange,
  SubmitAnswersResult,
  TextDetail,
  TextSummary,
  TodayData,
} from "../../shared/api-types";
import { load } from "../lib/storage";

export const PARENT_KEY = "okuhiz.parentId";
export const CHILD_KEY = "okuhiz.childId";
/** Kullanıcı adı/şifreyle açılan oturumun token'ı. */
export const SESSION_KEY = "okuhiz.session";

export class ApiRequestError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = load(SESSION_KEY);
  const parentId = token ? null : load(PARENT_KEY);
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(parentId ? { "x-parent-id": parentId } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK", "İnternet bağlantısı yok gibi görünüyor. Tekrar dener misin?");
  }
  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new ApiRequestError(res.status, "BAD_RESPONSE", "Sunucudan beklenmeyen bir cevap geldi.");
  }
  if (!json.success) throw new ApiRequestError(res.status, json.error.code, json.error.message);
  return json.data;
}

export const api = {
  me: () => request<Account>("GET", "/api/auth/me"),
  register: (body: { name: string; username: string; password: string }) => request<AuthResult>("POST", "/api/auth/register", body),
  login: (body: { username: string; password: string }) => request<AuthResult>("POST", "/api/auth/login", body),
  setCredentials: (body: { username: string; password: string }) => request<AuthResult>("POST", "/api/auth/credentials", body),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ changed: boolean }>("POST", "/api/auth/password", body),
  logout: () => request<{ loggedOut: boolean }>("POST", "/api/auth/logout"),
  createParent: (body: { name: string }) => request<Parent>("POST", "/api/parents", body),
  getParent: (id: string) => request<Parent & { children: Child[] }>("GET", `/api/parents/${id}`),
  createChild: (body: { parentId: string; name: string; grade?: number | null; birthYear?: number | null; avatar: string }) =>
    request<Child>("POST", "/api/children", body),
  leaderboard: (period: LeaderboardPeriod, childId?: string) =>
    request<LeaderboardData>("GET", `/api/leaderboard?period=${period}${childId ? `&childId=${childId}` : ""}`),
  updateChild: (id: string, body: Partial<{ name: string; grade: number | null; birthYear: number | null; avatar: string; targetWpm: number; showInLeaderboard: boolean }>) =>
    request<Child>("PUT", `/api/children/${id}`, body),
  getChild: (id: string) => request<Child>("GET", `/api/children/${id}`),
  today: (childId: string) => request<TodayData>("GET", `/api/children/${childId}/today`),
  stats: (childId: string, range: StatsRange) => request<StatsData>("GET", `/api/children/${childId}/stats?range=${range}`),
  progress: (childId: string, range: StatsRange) =>
    request<ProgressData>("GET", `/api/children/${childId}/progress?range=${range}`),
  readingHistory: (childId: string) => request<ReadHistoryItem[]>("GET", `/api/children/${childId}/reading-history`),
  achievements: (childId: string) => request<Achievement[]>("GET", `/api/children/${childId}/achievements`),
  texts: () => request<TextSummary[]>("GET", "/api/texts"),
  text: (id: number) => request<TextDetail>("GET", `/api/texts/${id}`),
  startReading: (body: { childId: string; textId: number; mode: ReadingModeName; assisted?: "listen" | "echo" }) =>
    request<StartReadingResult>("POST", "/api/reading/start", body),
  finishReading: (sessionId: string, body: { durationSeconds: number; errorCount?: number | null; assistedSteps?: number }) =>
    request<FinishReadingResult>("POST", `/api/reading/${sessionId}/finish`, body),
  submitAnswers: (sessionId: string, answers: { questionId: number; selectedOption: string }[]) =>
    request<SubmitAnswersResult>("POST", `/api/reading/${sessionId}/answers`, { answers }),
  startMinuteTest: (childId: string) => request<MinuteTestStart>("POST", "/api/minute/start", { childId }),
  finishMinuteTest: (testId: string, body: { durationSeconds: number; wordsRead: number; errorCount?: number | null; finishedText: boolean }) =>
    request<MinuteTestResult>("POST", `/api/minute/${testId}/finish`, body),
  minuteHistory: (childId: string) => request<MinuteTestHistory>("GET", `/api/children/${childId}/minute-tests`),
  gameResult: (body: {
    childId: string;
    gameType: GameType;
    totalItems: number;
    correctItems: number;
    avgReactionMs?: number | null;
    displayMs?: number | null;
    durationSeconds: number;
  }) => request<GameResultResponse>("POST", "/api/games/result", body),
};
