/** API sözleşmesi – frontend ve Worker ortak tipleri. */

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Parent {
  id: string;
  name: string;
  /** Kullanıcı adı/şifre belirlenmediyse null (hesap yalnızca bu cihazda). */
  username: string | null;
  has_password: boolean;
  created_at: string;
  updated_at: string;
}

export type Account = Parent & { children: Child[] };

export interface AuthResult {
  /** Oturum token'ı: istemci Authorization: Bearer başlığıyla gönderir. */
  token: string;
  account: Account;
}

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  birth_year: number | null;
  grade: number | null;
  avatar: string;
  current_level: number;
  target_wpm: number;
  total_words: number;
  total_minutes: number;
  current_streak: number;
  longest_streak: number;
  xp: number;
  placement_completed: number;
  last_active_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TextSummary {
  id: number;
  slug: string;
  title: string;
  category: string;
  difficulty: number;
  grade_level: number;
  word_count: number;
  estimated_duration: number;
}

/** Çocuğun bir metni okuma geçmişi (kütüphanede "okundu" gösterimi için). */
export interface ReadHistoryItem {
  text_id: number;
  times_read: number;
  best_wpm: number;
  best_comprehension: number | null;
  last_read_at: string;
}

export interface TextDetail extends TextSummary {
  content: string;
  source_type: "system" | "manual";
  questions: PublicQuestion[];
}

/** Doğru cevap istemciye GÖNDERİLMEZ. */
export interface PublicQuestion {
  id: number;
  question: string;
  options: { key: "a" | "b" | "c" | "d"; text: string }[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned_at?: string | null;
}

export interface StartReadingResult {
  sessionId: string;
  attemptNumber: number;
  targetWpm: number;
  startedAt: string;
  /** Bu okuma için havuzdan seçilen sorular (cevaplar hariç). */
  questions: PublicQuestion[];
}

export interface AttemptSummary {
  attempt_number: number;
  wpm: number;
}

export interface FinishReadingResult {
  sessionId: string;
  wpm: number;
  durationSeconds: number;
  wordCount: number;
  accuracy: number | null;
  attemptNumber: number;
  xpEarned: number;
  attempts: AttemptSummary[];
  improvementPercent: number | null;
  canRepeat: boolean;
  newAchievements: Achievement[];
}

export interface AnswerResult {
  questionId: number;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
  explanation: string | null;
}

export interface SubmitAnswersResult {
  comprehension: number;
  correctCount: number;
  totalQuestions: number;
  results: AnswerResult[];
  stars: number;
  xpEarned: number;
  previousTargetWpm: number;
  newTargetWpm: number;
  newLevel: number;
  newAchievements: Achievement[];
}

export interface TodayData {
  child: Child;
  date: string;
  streak: number;
  targets: { wpm: number; accuracy: number; comprehension: number };
  today: {
    readingMinutes: number;
    wordsRead: number;
    sessionsCompleted: number;
    xpEarned: number;
    trainingDone: boolean;
  };
  totalStars: number;
  plan: { key: string; label: string; minutes: number }[];
  recommendedTextId: number | null;
  placementTextId: number | null;
  wordCatchDisplayMs: number;
  recommendedMode: Exclude<ReadingModeName, "placement">;
}

export type ReadingModeName = "placement" | "normal" | "tracking" | "chunks";
export type StatsRange = "7" | "30" | "all";

export interface StatsData {
  range: StatsRange;
  sessionCount: number;
  averageWpm: number | null;
  averageAccuracy: number | null;
  averageComprehension: number | null;
  totalMinutes: number;
  totalWords: number;
  gamesPlayed: number;
  gameAccuracy: number | null;
  activeDays: number;
  bestWpm: number | null;
}

export interface ProgressPoint {
  date: string;
  wpm: number | null;
  wpmTrend: number | null;
  comprehension: number | null;
  accuracy: number | null;
  minutes: number;
}

export interface RecentSession {
  id: string;
  title: string;
  reading_mode: string;
  wpm: number;
  accuracy_percentage: number | null;
  comprehension_percentage: number | null;
  attempt_number: number;
  completed_at: string;
}

export interface ProgressData {
  range: StatsRange;
  points: ProgressPoint[];
  recentSessions: RecentSession[];
}

export type GameType = "word_catch" | "sentence_recall" | "missing_word";

export interface GameResultResponse {
  gameSessionId: string;
  xpEarned: number;
  accuracy: number;
  newAchievements: Achievement[];
}
