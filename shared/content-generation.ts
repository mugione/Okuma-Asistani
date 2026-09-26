/**
 * Gelecekte yapay zekâ ile metin üretimi için arayüz.
 * MVP'de KULLANILMAZ: tüm metinler D1'de hazır bulunur ve harici AI API çağrısı yapılmaz.
 */
export interface GenerateReadingTextInput {
  category: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  gradeLevel: number;
  targetWordCount: number;
  questionCount: number;
}

export interface GeneratedQuestion {
  question: string;
  options: [string, string, string, string];
  correctOption: "a" | "b" | "c" | "d";
  explanation?: string;
}

export interface GeneratedContent {
  title: string;
  content: string;
  category: string;
  difficulty: number;
  wordCount: number;
  questions: GeneratedQuestion[];
}

export interface ContentGenerationService {
  generateReadingText(input: GenerateReadingTextInput): Promise<GeneratedContent>;
}
