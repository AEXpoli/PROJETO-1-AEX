export interface HealthResponse {
  status: 'ok';
}
export type { LearningModule, ParticipantExercise } from './training';
export type { SubmitExerciseAttempt, RecordedExerciseResult, ParticipantProgress } from './training';

export type { Exercise, ExerciseOption, ExerciseAttempt, ExerciseResult, TrainingProgress, Achievement, ParticipantSummary, PerformanceSummary, TrainingService } from './training';

export interface ApplicationInfo {
  name: string;
  phase: 3;
}
