/** Conteúdo público: não contém gabarito nem explicações antes da resposta. */
export interface ExerciseOption { id: string; label: string }
/** Leitura da API antes da resposta; o cenário atual do banco é texto. */
export type ParticipantExercise = Pick<Exercise, 'id' | 'moduleId' | 'title' | 'question' | 'options'> & {
  scenario: string;
  sortOrder: number;
};

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
}
export interface Exercise {
  id: string;
  moduleId: string;
  category: 'phishing' | 'social-engineering';
  title: string;
  introduction: string;
  scenario: {
    kind: 'sms' | 'link' | 'call';
    label: string;
    sender: string;
    message: string;
    address?: string;
  };
  question: string;
  options: readonly ExerciseOption[];
  takeaway: string;
}

export interface ExerciseAttempt {
  /** Chave de idempotência: reutilizar em tentativas de envio da mesma resposta. */
  id: string;
  exerciseId: string;
  selectedOptionId: string;
  submittedAt: string;
}

export interface ExerciseResult {
  attempt: ExerciseAttempt;
  correct: boolean;
  selectedLabel: string;
  correctLabel: string;
  explanation: string;
  completedAt: string | null;
  evaluation: 'demonstrative' | 'server';
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface PerformanceSummary {
  total: number;
  completed: number;
  correct: number;
  reviewed: number;
  points: number;
  isComplete: boolean;
}

export interface ParticipantSummary extends PerformanceSummary {
  exerciseStats: readonly { exerciseId: string; attempts: number; correct: number; incorrect: number }[];
}

export interface TrainingProgress {
  evaluation: 'demonstrative' | 'server';
  completions: readonly { exerciseId: string; correct: boolean }[];
  results: readonly ExerciseResult[];
  summary: ParticipantSummary;
  achievements: readonly Achievement[];
  modules: readonly (PerformanceSummary & { moduleId: string })[];
}

export interface TrainingService {
  getExercises(): Promise<readonly Exercise[]>;
  getProgress(): Promise<TrainingProgress>;
  submitAttempt(attempt: Omit<ExerciseAttempt, 'submittedAt'>): Promise<ExerciseResult>;
  completeAttempt(attemptId: string): Promise<TrainingProgress>;
}
